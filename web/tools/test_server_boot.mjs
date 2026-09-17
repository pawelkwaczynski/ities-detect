// Starts a gunicorn for the browser tests with a throwaway login.
//
// The real server/auth.local.json never takes part: the password is generated here,
// hashed by werkzeug from the project venv, written to a temporary file and pointed at
// through ITIES_AUTH_FILE. The file is removed when the server stops, and the server
// is always stopped, so no gunicorn is left behind.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
// The runtime venv is the one server/start.sh uses: <root>/.venv.
const VENV_PYTHON = path.join(ROOT, ".venv/bin/python");
const GUNICORN = path.join(ROOT, ".venv/bin/gunicorn");
export const TEST_USER = "smoke-test-user";
// The owner clicks on 20412 while these tests run, so the test server has its own
// port. ITIES_TEST_PORT overrides it; nothing here ever touches 20412.
export const TEST_PORT = Number(process.env.ITIES_TEST_PORT || 20413);
export const BASE = `http://127.0.0.1:${TEST_PORT}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch (_) {
    return false;
  }
}

export async function startTestServer({ port = TEST_PORT } = {}) {
  if (port === 20412) {
    throw new Error("port 20412 belongs to the owner's server; the tests run on ITIES_TEST_PORT");
  }
  const base = `http://127.0.0.1:${port}`;
  if (await reachable(`${base}/healthz`)) {
    throw new Error(
      `port ${port} is already served. Stop that gunicorn first; the tests start their own.`
    );
  }
  const password = crypto.randomBytes(18).toString("base64url");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ities-smoke-auth-"));
  const authFile = path.join(dir, "auth.local.json");
  const hashed = spawnSync(
    VENV_PYTHON,
    [
      "-c",
      "import sys;from werkzeug.security import generate_password_hash;" +
        "sys.stdout.write(generate_password_hash(sys.argv[1]))",
      password,
    ],
    { encoding: "utf8" }
  );
  if (hashed.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`could not hash the test password: ${hashed.stderr || hashed.status}`);
  }
  fs.writeFileSync(
    authFile,
    JSON.stringify({
      users: { [TEST_USER]: hashed.stdout.trim() },
      secret_key: crypto.randomBytes(32).toString("hex"),
    }),
    { mode: 0o600 }
  );

  const logFile = path.join(dir, "gunicorn.log");
  const log = fs.openSync(logFile, "a");
  const server = spawn(
    GUNICORN,
    [
      "--chdir",
      path.join(ROOT, "server"),
      "--workers",
      "1",
      "--threads",
      "2",
      "--bind",
      `127.0.0.1:${port}`,
      "wsgi:app",
    ],
    {
      env: { ...process.env, ITIES_AUTH_FILE: authFile },
      stdio: ["ignore", log, log],
      // own process group, so one signal takes the master and its worker with it
      detached: true,
    }
  );

  const alive = () => {
    try {
      process.kill(server.pid, 0);
      return true;
    } catch (_) {
      return false;
    }
  };
  const signal = (name) => {
    try {
      process.kill(-server.pid, name);
    } catch (_) {
      try {
        server.kill(name);
      } catch (__) {
        /* already gone */
      }
    }
  };
  let stopped = false;
  const cleanUp = () => {
    try {
      fs.closeSync(log);
    } catch (_) {
      /* already closed */
    }
    fs.rmSync(dir, { recursive: true, force: true });
  };
  // Best effort, safe to call from a process exit handler.
  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal("SIGTERM");
    cleanUp();
  };
  // The one to await. A gunicorn that ignores SIGTERM still has to go, otherwise the
  // next run finds the port taken and the machine keeps a server nobody asked for.
  const stopAndWait = async () => {
    stopped = true;
    signal("SIGTERM");
    for (let i = 0; i < 50; i += 1) {
      if (!alive()) break;
      await sleep(100);
    }
    if (alive()) {
      signal("SIGKILL");
      for (let i = 0; i < 30; i += 1) {
        if (!alive()) break;
        await sleep(100);
      }
    }
    cleanUp();
    // The socket has to be free as well, not just the process gone.
    for (let i = 0; i < 30; i += 1) {
      if (!(await reachable(`${base}/healthz`))) return true;
      await sleep(200);
    }
    return false;
  };
  process.on("exit", stop);

  for (let i = 0; i < 100; i += 1) {
    if (await reachable(`${base}/healthz`)) {
      return { base, user: TEST_USER, password, authFile, stop, stopAndWait, logFile };
    }
    if (server.exitCode != null) break;
    await sleep(200);
  }
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").slice(-2000) : "";
  stop();
  throw new Error(`test server did not answer on ${base}/healthz\n${tail}`);
}

// Sign in with a real POST to /login from the page itself, so the browser keeps the
// session cookie the server sets. A form submit raced against the navigation that put
// us on /login and silently did nothing, which is why this posts instead.
export async function loginInBrowser(cdp, { evaluate, goto }, credentials, base = BASE) {
  const href = await evaluate(cdp, "location.href").catch(() => "");
  if (!String(href).startsWith(base)) await goto(cdp, `${base}/login`);
  const status = await evaluate(
    cdp,
    `(async () => {
       const body = new URLSearchParams({
         username: ${JSON.stringify(credentials.user)},
         password: ${JSON.stringify(credentials.password)},
         next: "/"
       });
       const response = await fetch("/login", {
         method: "POST",
         body,
         credentials: "same-origin",
         redirect: "follow"
       });
       return response.status;
     })()`
  );
  if (status !== 200) throw new Error(`POST /login answered ${status}`);
  const check = await evaluate(
    cdp,
    `fetch("/api/versions", { credentials: "same-origin" }).then((r) => r.status)`
  );
  if (check !== 200) throw new Error(`still signed out, /api/versions answered ${check}`);
  return true;
}
