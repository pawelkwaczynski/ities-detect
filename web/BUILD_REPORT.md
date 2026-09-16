# BUILD_REPORT, 16.09.2026

Aplikacja z SPEC_APLIKACJI.md stoi lokalnie. Bramka parytetu: PASS.

Uruchomienie: `server/start.sh`  
Adres: http://127.0.0.1:20412  
Zatrzymanie: `pkill -f 'gunicorn.*20412'`

Serwer gunicorn już chodzi z tej sesji (port 20412).

## Drzewo (bez .venv, tools/node_modules, binariów Pyodide)

```
PRODUCT.md  SPEC_APLIKACJI.md  README.md  RELEASE_CHECK.md  BUILD_REPORT.md
algo/ities_algo_v1.0.py  algo/ities_algo_v1.1.py  algo/versions.json
assets/ities_logo_B.png  assets/ities_logo_A.jpg
server/app.py  server/wsgi.py  server/requirements.txt  server/start.sh  server/deploy_frog.md
static/index.html
static/shared/config.js  static/shared/tokens.css  static/shared/ui.css
static/ities/index.html  static/ities/app.js  static/ities/engine.js
static/ities/worker.js  static/ities/algo_stub.js  static/ities/styles.css
static/ities/versions.html
static/ities/ui/{format,sidebar,verdict,chart,details,table,session}.js
static/vendor/uplot/{uPlot.esm.js,uPlot.min.css}
static/pyodide/   # runtime + numpy/scipy/pandas, bez matplotlib; .br/.gz obok
tools/make_versions_json.py  tools/fetch_pyodide.sh  tools/parity_test.mjs
tools/test_server.py  tools/screenshots.mjs  tools/package.json
screenshots/*.png
```

`static/pyodide/`: 37 plików (wasm, stdlib, lock, koła numpy/scipy/pandas + dateutil/pytz/six, plus `.br`/`.gz`). Pyodide 314.0.7.

## Testy, sekcja 8

1. Parytet (`nice -n 10 node tools/parity_test.mjs`)
   - 485 plików, 485 wierszy baseline
   - różnice status / delta_Es / Ip_analyte_fwd_uA (tol 1e-9): **0**
   - load Pyodide 0.88 s, pakiety 0.95 s, analiza 60.74 s
   - zapis: RELEASE_CHECK.md
2. Test negatywny: `AMPHETAMINE_TARGET_DELTA_V = 0.356` w pamięci, 200 plików z delta_Es, **27 różnic**. Test umie paść.
3. Serwer (`tools/test_server.py`, Flask test client): PASS
   - `/api/versions` default 1.1
   - `/pyodide/pyodide.asm.wasm` MIME `application/wasm`
   - `Accept-Encoding: br` → `Content-Encoding: br`
4. Trzy pliki referencyjne (Node + ten sam stub co worker), v1.1:
   - `93P_300ul_TPra(1).txt` → uncertain, ΔE_s 0.36376953125 (UI: DO OCENY EKSPERTA, 0,364 V)
   - `BRB pH 7 CV 50uM codeine + 50uM TPrA.txt` → not_detected, ΔE_s 0.3094482421875
   - `132-1_blank(2).txt` → MEASUREMENT_QUALITY_FAIL, internal_reason NO_TPRA_IN_WINDOWS
5. Zrzuty: `screenshots/` desktop 1440×900 i mobile 390×844 (hub, pusty, wynik, tabela, ekspert, historia).
6. Automatyczny lint UI: `[]` (zero znalezisk).

## RSS gunicorn (po ruchu ze zrzutów)

`ps` RSS:

- master pid 20207: 31104 kB (30.4 MB)
- worker pid 21284: 38560 kB (37.7 MB)
- suma: 68.1 MB

Worker sam jest pod 60 MB. Suma master+worker jest 8 MB nad celem z specyfikacji. 1 worker, 2 wątki, `--max-requests 200`.

## Czego nie zrobiono

- Wdrożenie na Frog: zakaz z sekcji 9. Kroki w `server/deploy_frog.md`.
- Commit / publikacja: zakaz.
- Przełącznik „Pokaż kandydatów”: algorytm nie zwraca listy odrzuconych kandydatów, więc pominięty bez atrapy.
- W zrzucie sesji UI widać 93P. Pozostałe dwa pliki referencyjne policzone w Node (pkt 4); CDP `setFileInputFiles` w tej sesji podał do inputa jeden plik.
- DESIGN.md: nie ma go na liście z sekcji 1 specyfikacji, nie pisałem.
- coffee-paladin: `status.json` był nieświeży, daemon nie pilnował. Parytet poszedł przez `nice -n 10`.

## PeakWise, prompt ikony (PRODUCT.md)

Placeholder typograficzny PW + pik jest w hubie (`HUB_TILE_2_NAME` w `static/shared/config.js`). Prompt do ikony 1024 px, gdy właściciel zechce wygenerować:

> App icon, 1024×1024, rounded square like macOS 22% corner. Navy to bright blue field. White lettermark of a voltammetry peak (a single sharp ∧ with a small baseline), no flask, no shield, no text. Flat, print-like, not glossy. No police imagery.

## Wersje algorytmu

`tools/make_versions_json.py` → `algo/*.py` nietknięte poza wygenerowanym `algo/versions.json`.

- 1.1 (domyślna) sha256 `c0e29b1e799c8fba75a4375cc57ee644866bce96af97df941c79cce5ed118361`
- 1.0 sha256 `21119730486497ea19c595e1b8dca1d937357318a67c4facbdbd6438f056176b`

---

# Runda 2, 16.09.2026

Uwagi właściciela po obejrzeniu wdrożonej aplikacji, osiem punktów, wszystkie zrobione.
Pliki `algo/*.py` nietknięte, bramka parytetu przeszła ponownie.

## Co się zmieniło

1. **Dwa języki, EN domyślnie.** Nowy `static/shared/i18n.js`: jeden słownik z kluczami,
   EN i PL, wartości mogą być funkcjami (polska liczba mnoga „1 plik / 2 pliki / 5 plików").
   Przez słownik idzie hub, aplikacja, `versions.html`, słownik statusów 3.5, komunikaty,
   raport do druku i etykiety wykresu. Nagłówki CSV zostają techniczne (kolumny `result_row`).
   Wybór języka w `localStorage` pod kluczem `analizatory-lang`, `document.documentElement.lang`
   przestawiany razem z nim. Statyczne teksty przez `data-i18n`, dynamiczne przez `t(klucz, parametry)`.
   Tłumaczenia werdyktów: WYKRYTO → DETECTED, DO OCENY EKSPERTA → EXPERT REVIEW,
   NIE STWIERDZONO W TYM POMIARZE → NOT DETECTED IN THIS MEASUREMENT,
   POMIAR NIE NADAJE SIĘ DO OCENY → MEASUREMENT NOT ASSESSABLE,
   WZORZEC BEZ ANALITU → STANDARD ONLY, NO ANALYTE, PARA NIEPRAWIDŁOWA → INVALID PAIR,
   PLIK NIEPEŁNY → INCOMPLETE FILE, NIE ROZPOZNANO PLIKU → FILE NOT RECOGNISED.
2. **Motyw jako segmented control** System / Jasny / Ciemny w pasku narzędzi aplikacji,
   w pasku huba i na stronie wersji (`static/shared/prefs.js`). Select w stopce usunięty.
   Zapamiętany jak dotąd w `ities-theme`.
3. **Lista plików widoczna od razu.** Plik dostaje stan `queued / running / done / error`,
   pasek boczny pokazuje przy nim plakietkę „w kolejce" / „liczę…" / werdykt / „błąd”.
   Licznik „Wgrano N plików" w pasku narzędzi. Na ekranie < 900 px pasek boczny otwiera się
   sam po wgraniu i zamyka po wybraniu pliku.
4. **Analiza startuje sama.** Kolejka `pump()` w `app.js` bierze kolejny plik ze stanem
   `queued`; gdy silnik jeszcze wstaje, pliki czekają i ruszają na zdarzeniu `ready`.
   Przycisk został jako „Przelicz ponownie" (`toolbar.recompute`) i kolejkuje wszystko od nowa.
   Zmiana wersji algorytmu też przelicza sesję od nowa, stara wersja ląduje w `revisions`.
5. **Foldery.** Przycisk „Dodaj folder" (`webkitdirectory`) i upuszczenie folderu przez
   `DataTransfer.items` + `webkitGetAsEntry()` z rekurencyjnym `walkEntry`. W pasku bocznym
   węzeł z nazwą folderu, rozwijany, z licznikiem plików i wynikiem zbiorczym (plakietki
   WYKRYTO / DO OCENY / NIE STWIERDZONO / nie nadające się). Pliki z podfolderów trzymają
   ścieżkę w etykiecie (`seria_2/plik.txt`). Nieobsługiwane rozszerzenia pomijane z licznikiem
   „pominięto N (.nox)", osobno dla folderu i osobno dla plików luzem.
6. **Wykres jak w Colabie.** `static/ities/ui/chart.js` przepisany na uPlot z własnymi
   hakami rysowania, wzorowany na `plot_cv_branches`, `style_cv_axes`, `finish_cv_plot`
   i `set_colored_plot_title` z `algo/ities_algo_v1.1.py`: gałęzie FORWARD `#64748B`
   i RETURN `#7C9A86`, punkty 1-4 jako widoczne znaczniki z numerem na plakietce
   (niebieskie TPrA `#2563EB`, czerwone analit `#DC2626`), linie E5 i E6 kreskowane z
   podpisami, baseline analitu z `baseline_fits`, strzałka ΔE_s z wartością, linia zera,
   delikatna siatka, ramka, osie „E / V" i „I / µA", legenda z nazwami gałęzi i punktów,
   tytuł = nazwa pliku + werdykt w kolorze werdyktu. Wszystko rysowane na canvasie, więc
   PNG w raporcie do druku niesie tytuł, podpisy i legendę. Wysokość 420 do 560 px
   (proporcja 1,85 jak `figsize=(14, 7.6)`). Przełącznik E surowe / po kalibracji został.
   Przy okazji poprawione: font osi był podawany jako `13px var(--font)`, czego canvas nie
   rozumie, więc osie leciały krojem domyślnym; teraz jest pełny stos systemowy.
   Druga poprawka: tryb ekspercki wysyłał do algorytmu punkty w skali skalibrowanej,
   a `nearest_on_branch` oczekuje surowych; teraz wszystkie cztery jadą surowe.
7. **Historia wersji** dostała zdanie o różnicy 1.0 i 1.1 w obu językach oraz przetłumaczony
   changelog algorytmu (klucze `algo.changelog.*`, `algo/versions.json` nietknięty).
8. `APP_VERSION` = 1.1.0.

## Nowe i zmienione pliki

```
nowe:      static/shared/i18n.js  static/shared/prefs.js
przepisane: static/ities/ui/chart.js  static/ities/app.js  static/ities/ui/sidebar.js
            static/ities/ui/format.js  static/ities/ui/verdict.js  static/ities/ui/details.js
            static/ities/ui/table.js  static/ities/ui/session.js
            static/index.html  static/ities/index.html  static/ities/versions.html
            tools/screenshots.mjs
zmienione:  static/shared/tokens.css (tokeny wykresu i stanów)  static/shared/ui.css
            static/ities/styles.css
```

## Testy

1. Parytet `nice -n 10 node tools/parity_test.mjs`: 485 plików, **0 różnic** na
   status / delta_Es / Ip_analyte_fwd_uA (tol 1e-9), load Pyodide 0,85 s, pakiety 0,89 s,
   analiza 63,4 s. Test negatywny (`AMPHETAMINE_TARGET_DELTA_V = 0.356`): 27 różnic na 200
   plikach, czyli test nadal umie paść. Zapis w `RELEASE_CHECK.md`, gate PASS.
2. Automatyczny lint UI: `[]`.
3. Zrzuty przez `tools/screenshots.mjs` (Chrome przez CDP): hub, stan pusty, wynik,
   tabela, tryb ekspercki, folder, historia wersji; desktop 1440×900 i mobile 390×844,
   EN i PL, jasny i ciemny dla ekranu wyniku. Skrypt zbiera też błędy konsoli: **zero**.
4. Test folderu na `../07_etykiety_lab_20260916/Neutrale` (45 plików TXT) skopiowanym do
   `screenshots/.folder/Neutrale` z podfolderem `seria_2` (5 plików) i podrzuconym
   `pomiar_surowy.nox`. Chrome nie pozwala podać plików do inputa `webkitdirectory` przez
   `DOM.setFileInputFiles`, więc pliki wchodzą przez pomocniczy input, a potem obiema
   prawdziwymi drogami aplikacji: raz jako `FileList` z `webkitRelativePath`, raz jako
   upuszczone `FileSystemEntry`. Wynik w obu przebiegach identyczny:
   45 wierszy plików, licznik „Wgrano 45 plików", węzeł „Neutrale 45",
   zbiorczo „45 POMIAR NIE NADAJE SIĘ DO OCENY", „pominięto 1 (.nox)", 5 plików z etykietą
   `seria_2/`. Analiza 45 plików ruszyła sama, bez kliknięcia.
5. Bundle: `tools/build_deploy_bundle.sh` → `deploy/analizatory_bundle.tar.gz`,
   610 558 bajtów (0,58 MiB), 17 plików Pyodide do pobrania na serwerze.

Zrzuty na dysku to komplet z rundy 3, bo runda 3 przebudowała ten sam ekran.
