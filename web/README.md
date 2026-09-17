# ITIES Detect (web) + hub Analizatory CV

Aplikacja laboratoryjna: detekcja amfetaminy z krzywych CV (ITIES). Liczy przeglądarka (Pyodide), serwer tylko serwuje pliki i `algo/versions.json`.

## Uruchomienie

Jedno polecenie z katalogu repo:

```bash
server/start.sh
```

Adres: http://127.0.0.1:20412

Wymaga Pythona 3 z `venv` (skrypt sam założy `.venv` i wgra Flask + gunicorn). Pyodide i uPlot muszą już leżeć w `static/pyodide/` i `static/vendor/uplot/` (`tools/fetch_pyodide.sh`).

Od 1.4.0 aplikacja jest za logowaniem. Serwer nie wstanie bez `server/auth.local.json`
(login, skrót hasła werkzeug, `secret_key`); plik jest lokalny, nie ma go w repozytorium
ani w pakiecie wdrożeniowym. Adres serwera można wskazać przez `ITIES_AUTH_FILE`.

Zatrzymanie: `pkill -f 'gunicorn.*20412'`.

## Test parytetu

```bash
nice -n 10 node tools/parity_test.mjs
```

Bramka: 0 różnic na 485 plikach wobec `../wyniki_analizy/eval_etykiety_20260916_baseline.csv`. Wynik: `RELEASE_CHECK.md`.

## Pakiet wdrożeniowy

```bash
tools/build_deploy_bundle.sh --check-urls
```

Buduje `deploy/analizatory_bundle.tar.gz` (server, algo, static bez `static/pyodide/`,
`assets/partners/`, README, RELEASE_CHECK, skrypty z `deploy/`) plus `deploy/fetch_pyodide_on_server.sh`,
`deploy/start.sh` i `deploy/crontab.txt`. Pyodide (87 MB) nie jedzie w paczce, serwer
ściąga go sam wgetem i sprawdza SHA-256. `--check-urls` odpytuje każdy adres jsDelivr
przed spakowaniem. Kroki na serwerze: `server/deploy_frog.md`.

## Testy przeglądarkowe

```bash
nice -n 10 node tools/ui_smoke.mjs
nice -n 10 node tools/screenshots.mjs
```

Oba same uruchamiają gunicorna na 127.0.0.1:20412 z tymczasowym plikiem logowania i
hasłem wylosowanym w teście, i same go zatrzymują. Prawdziwy `server/auth.local.json`
nie bierze w nich udziału. Port musi być wolny, inaczej testy odmawiają startu.

## Uwagi

Katalog `algo/` jest zamrożony. Manifest regeneruje `tools/make_versions_json.py`.
Wdrożenie na Frog: `server/deploy_frog.md` (wykonuje Claude).
