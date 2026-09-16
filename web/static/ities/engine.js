// Main-thread client for the Pyodide analysis worker.

export class Engine {
  constructor({ workerUrl } = {}) {
    this.workerUrl = workerUrl || new URL("./worker.js", import.meta.url);
    this.worker = null;
    this.ready = false;
    this.version = null;
    this.sha256 = null;
    this.constants = null;
    this.cdn = false;
    this._pending = new Map();
    this._status = "idle";
    this._listeners = new Set();
  }

  on(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  emit(event) {
    for (const fn of this._listeners) fn(event);
  }

  get status() {
    return this._status;
  }

  _ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(this.workerUrl, { type: "module" });
    this.worker.onmessage = (ev) => this._onMessage(ev.data || {});
    this.worker.onerror = (err) => {
      const message = err && err.message ? err.message : "Worker error";
      this._status = "error";
      this.emit({ type: "error", id: null, message });
      for (const [, pending] of this._pending) {
        pending.reject(new Error(message));
      }
      this._pending.clear();
    };
  }

  _onMessage(msg) {
    if (msg.type === "status") {
      this._status = msg.stage;
      this.emit(msg);
      return;
    }
    if (msg.type === "ready") {
      this.ready = true;
      this.version = msg.version;
      this.sha256 = msg.sha256;
      this.constants = msg.constants;
      this.cdn = !!msg.cdn;
      this._status = "ready";
      this.emit(msg);
      const boot = this._pending.get("__init__");
      if (boot) {
        this._pending.delete("__init__");
        boot.resolve(msg);
      }
      return;
    }
    if (msg.type === "progress") {
      this.emit(msg);
      return;
    }
    if (msg.type === "result") {
      this.emit(msg);
      const pending = this._pending.get(msg.id);
      if (pending) {
        this._pending.delete(msg.id);
        pending.resolve(msg.result);
      }
      return;
    }
    if (msg.type === "error") {
      this._status = "error";
      this.emit(msg);
      if (msg.id == null) {
        const boot = this._pending.get("__init__");
        if (boot) {
          this._pending.delete("__init__");
          boot.reject(new Error(msg.message));
        }
        return;
      }
      const pending = this._pending.get(msg.id);
      if (pending) {
        this._pending.delete(msg.id);
        pending.reject(new Error(msg.message));
      }
    }
  }

  init(version, { forceCdn } = {}) {
    this._ensureWorker();
    this.ready = false;
    this._status = "pyodide";
    return new Promise((resolve, reject) => {
      this._pending.set("__init__", { resolve, reject });
      this.worker.postMessage({ type: "init", version, forceCdn: !!forceCdn });
    });
  }

  async retry({ useCdn } = {}) {
    this.destroy();
    this._ensureWorker();
    return this.init(this.version, { forceCdn: !!useCdn });
  }

  async switchVersion(version) {
    this.destroy();
    this._ensureWorker();
    return this.init(version);
  }

  analyze({ id, name, bytes, manual, done, total }) {
    if (!this.ready) return Promise.reject(new Error("Engine is not ready"));
    const jobId = id || "job-" + Math.random().toString(16).slice(2);
    const copy = bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);
    return new Promise((resolve, reject) => {
      this._pending.set(jobId, { resolve, reject });
      this.worker.postMessage({
        type: "analyze",
        id: jobId,
        name,
        bytes: copy,
        manual: manual || null,
        done,
        total,
      });
    });
  }

  async analyzeAll(items, { onProgress } = {}) {
    const results = [];
    const total = items.length;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const result = await this.analyze({
        ...item,
        done: i + 1,
        total,
      });
      results.push(result);
      const progress = { type: "progress", done: i + 1, total };
      onProgress?.(progress);
      this.emit(progress);
    }
    return results;
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this._status = "idle";
    for (const [, pending] of this._pending) {
      pending.reject(new Error("Engine restarted"));
    }
    this._pending.clear();
  }
}
