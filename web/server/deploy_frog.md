# Wdrożenie na Frog (Mikrus)

Ten plik to lista kroków do wdrożenia ręcznego.

Serwer: Alpine 3.23, Python 3.12, użytkownik `frog`, katalog `/home/frog/analizatory`,
venv z flask i gunicorn w `/home/frog/analizatory/.venv`. Ma `wget` i `tar`, nie ma
`scp` ani `pip` poza venvem. Port 20412 jest publikowany jako `https://frog01-20412.wykr.es`.

## Na Macu

1. `tools/fetch_pyodide.sh`, jeśli `static/pyodide/` jest puste.
2. `nice -n 10 node tools/parity_test.mjs`, bramka 0 różnic (`RELEASE_CHECK.md`).
3. `tools/build_deploy_bundle.sh --check-urls`.
   Powstaje `deploy/analizatory_bundle.tar.gz` (poniżej 5 MB, bez Pyodide) oraz
   `deploy/fetch_pyodide_on_server.sh`, `deploy/start.sh`, `deploy/crontab.txt`.

## Na Frog

Paczka trafia na serwer wgetem z adresu, który serwer widzi (nie ma `scp`).

```sh
cd /home/frog/analizatory
wget -O analizatory_bundle.tar.gz <adres>
tar -xzf analizatory_bundle.tar.gz
sh deploy/fetch_pyodide_on_server.sh    # Pyodide 314.0.7 z jsDelivr, SHA-256 sprawdzany
sh deploy/start.sh
crontab deploy/crontab.txt              # @reboot i */5
wget -qO- http://127.0.0.1:20412/api/versions
```

`fetch_pyodide_on_server.sh` można uruchamiać wielokrotnie: plik z poprawną sumą
zostaje nietknięty, więc przerwane pobieranie wznawia się zamiast zaczynać od nowa.
Robi kopie `.gz` (brotli na serwerze nie jest potrzebne, `app.py` schodzi na gzip,
gdy nie ma `.br`).

gunicorn: 1 worker, 2 wątki, `--max-requests 200`. Cel RSS poniżej 60 MB.
Log aplikacji: `/home/frog/analizatory/app.log`, log crona: `cron.log`.
