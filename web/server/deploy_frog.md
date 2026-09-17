# Wdrożenie na Frog (Mikrus)

Wdrożenie wykonuje Claude, nie Codex. Ten plik to lista kroków.

Serwer: Alpine 3.23, Python 3.12, użytkownik `frog`, katalog `/home/frog/analizatory`,
venv z flask i gunicorn w `/home/frog/analizatory/.venv`. Ma `wget` i `tar`, nie ma
`scp` ani `pip` poza venvem. Port 20412 jest publikowany jako `https://frog01-20412.wykr.es`.

## Na Macu

1. `tools/fetch_pyodide.sh`, jeśli `static/pyodide/` jest puste.
2. `nice -n 10 node tools/parity_test.mjs`, bramka 0 różnic (`RELEASE_CHECK.md`).
3. `tools/build_deploy_bundle.sh --check-urls`.
   Powstaje `deploy/analizatory_bundle.tar.gz` (poniżej 5 MB, bez Pyodide) oraz
   `deploy/fetch_pyodide_on_server.sh`, `deploy/start.sh`, `deploy/crontab.txt`.
   Od 1.4.0 paczka niesie też `assets/partners/` (logotypy w stopce). Reszta katalogu
   `assets/` zostaje na Macu, bo to materiały źródłowe, 12 MB.

Testy przeglądarkowe (`tools/ui_smoke.mjs`, `tools/screenshots.mjs`) same uruchamiają
gunicorna na 127.0.0.1:20412 z własnym, tymczasowym plikiem logowania
(`ITIES_AUTH_FILE`) i same go zatrzymują. Nie trzeba nic startować ręcznie i nie wolno
trzymać innego serwera na tym porcie, bo testy wtedy odmawiają startu.

## Na Frog

Paczka trafia na serwer wgetem z adresu, który serwer widzi (nie ma `scp`).

```sh
cd /home/frog/analizatory
wget -O analizatory_bundle.tar.gz <adres>
tar -xzf analizatory_bundle.tar.gz
```

Wgraj osobno lokalny `server/auth.local.json` jako
`/home/frog/analizatory/server/auth.local.json`. Plik nie jest częścią repozytorium ani
pakietu wdrożeniowego. Na serwerze ustaw mu uprawnienia tylko dla właściciela:

```sh
chmod 600 /home/frog/analizatory/server/auth.local.json
sh deploy/fetch_pyodide_on_server.sh    # Pyodide 314.0.7 z jsDelivr, SHA-256 sprawdzany
sh deploy/start.sh
crontab deploy/crontab.txt              # @reboot i */5
wget -qO- http://127.0.0.1:20412/healthz
```

Po wgraniu sprawdź trzy rzeczy z zewnątrz:

```sh
wget -qO- https://frog01-20412.wykr.es/robots.txt          # User-agent: * / Disallow: /
wget -S -qO /dev/null https://frog01-20412.wykr.es/login   # X-Robots-Tag: noindex, nofollow, noarchive
wget -qO /dev/null https://frog01-20412.wykr.es/assets/partners/ul-logo.png
```

`fetch_pyodide_on_server.sh` można uruchamiać wielokrotnie: plik z poprawną sumą
zostaje nietknięty, więc przerwane pobieranie wznawia się zamiast zaczynać od nowa.
Robi kopie `.gz` (brotli na serwerze nie jest potrzebne, `app.py` schodzi na gzip,
gdy nie ma `.br`).

gunicorn: 1 worker, 2 wątki, `--max-requests 200`. Cel RSS poniżej 60 MB.
Log aplikacji: `/home/frog/analizatory/app.log`, log crona: `cron.log`.
