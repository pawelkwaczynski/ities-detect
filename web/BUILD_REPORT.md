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
5. Zrzuty: `screenshots/` desktop 1440×900 i mobile 390×844 (hub, pusty, wynik, tabela, ekspert, historia). Chrome `/Applications/Google Chrome.app` przez CDP, nie MCP.
6. `node ~/.claude/skills/impeccable/scripts/detect.mjs --json static/` → `[]` (zero znalezisk).

## RSS gunicorn (po ruchu ze zrzutów)

`ps` RSS:

- master pid 20207: 31104 kB (30.4 MB)
- worker pid 21284: 38560 kB (37.7 MB)
- suma: 68.1 MB

Worker sam jest pod 60 MB. Suma master+worker jest 8 MB nad celem z specyfikacji. 1 worker, 2 wątki, `--max-requests 200`.

## Czego nie zrobiono

- Wdrożenie na Frog: zakaz z sekcji 9 (wdraża Claude). Kroki w `server/deploy_frog.md`.
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
2. `node ~/.claude/skills/impeccable/scripts/detect.mjs --json static/` → `[]`.
3. Zrzuty przez `tools/screenshots.mjs` (Chrome przez CDP, nie MCP): hub, stan pusty, wynik,
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

---

# Runda 3, 16.09.2026

Brief `assets/inspiracje/BRIEF_RUNDA3.md` plus trzy makiety. Uwaga właściciela: „wykresy
słabe, Colab rysował lepiej". Przebudowany ekran wyniku, pasek boczny i pasek narzędzi.
`algo/*.py` nadal nietknięte, bramka parytetu przeszła po zmianach.

## Co zrobiono, punkt po punkcie z briefu

1. **Nagłówek pliku**: nazwa pliku 28 px, pod nią metadane z prawdziwego wyniku
   (próbka, data pliku z `lastModified`, liczba punktów z `n_points_total`,
   cykl z `cycle_used` i `n_cycles_detected`), po prawej plakietka werdyktu z kropką.
   Nad nagłówkiem okruszki Folder › Próbka › Plik.
2. **Cztery karty KPI** (ΔE_s, Wzorzec, Różnica w kolorze werdyktu, Status) plus piąta
   komórka z poziomą skalą tolerancji −30…+30 mV i znacznikiem. Gdy wyniku ΔE_s nie ma,
   karty pokazują „brak", a w miejscu skali stoi powód i naprawa.
3. **Wykres**: minimum 480 px wysokości (do 620 px), tytuł „Woltamperogram cykliczny"
   i podtytuł, legenda „Skan w przód / Skan wstecz" w nagłówku karty, numerowane punkty
   1-4 (1 i 2 niebieskie, 3 i 4 czerwone), pionowe przerywane E5 i E6 z podpisami,
   baseline analitu, strzałka ΔE_s, delikatna siatka, ramka, osie „E / V" i „I / µA".
   Pod wykresem: przełącznik E po kalibracji / E surowe, przełącznik „Pokaż znaczniki",
   przyciski przybliż, oddal, reset widoku, pełny ekran (Fullscreen API). Pod spodem
   legenda znaczników. Wykres rysuje się dwoma trybami nagłówka: na ekranie tytuł i
   legenda to tekst HTML, do PNG w raporcie ten sam wykres maluje tytuł i legendę na
   canvasie, żeby obrazek w raporcie bronił się sam.
4. **Panel „Piki"** obok wykresu: tabela # / E (V) / I (µA) / typ z kolorowymi kropkami
   (wzorzec−, wzorzec+, analit−, analit+), przyciski „Wykryj ponownie" i „Edytuj piki"
   (włącza tryb ekspercki), blok „Analiza ITIES": okno potencjałowe liczone z krzywej,
   wzorzec, ΔE_s, różnica w kolorze werdyktu, pod tym zdanie uzasadnienia i „co dalej".
   Gdy algorytm nie wskazał pików, zamiast tabeli stoi jedno zdanie.
5. **Pasek boczny**: nagłówek z ikoną i nazwą aplikacji, wyszukiwarka próbek (filtruje po
   ID próbki i nazwie pliku), filtry, drzewo Folder → Próbka → pliki z kropką statusu i
   datą pliku, na dole strefa „Przeciągnij pliki pomiarowe" z przyciskami. Kropka statusu
   niesie kolor, a jej etykieta i tooltip niosą słowo, więc nic nie mówi samym kolorem.
   Próbka z jednym plikiem rysuje się jako sam plik, bez chowania go za trójkątem;
   przy więcej niż 12 próbkach w folderze próbki wieloplikowe startują zwinięte.
6. **Pasek narzędzi**: Importuj pomiary (główny), Dodaj folder, Analizuj serię, licznik
   plików, wybór algorytmu, przełącznik Pliki / Tabela, po prawej PL/EN, motyw,
   przełącznik Tryb ekspercki i Eksport.
7. **Sekcje zwijane**: Parametry pomiaru (Ip wzorca i analitu z metodą, stężenie, czystość,
   LOD/LOQ, shift, punkty, cykle, kod statusu, progi tej wersji algorytmu, ostrzeżenia),
   Historia analizy (rewizje auto i eksperckie z wersją, statusem i czasem),
   Metadane pliku (nazwa, folder, rozmiar, data, SHA-256 pliku, wersja i SHA algorytmu,
   czas analizy, tryb, nazwy kolumn E i I odczytane z pliku).
8. **Stopka stanu**: kropka stanu, stan silnika, „Analiza zakończona · czas 0,09 s"
   (mierzony `performance.now()` wokół wywołania workera), pole Operator, wersja aplikacji.

Nie przeniesiono z makiet: skanu 50 mV/s, elektrody Ag/AgCl, projektu ITIES-24, zakładek
bez treści i przycisków bez funkcji (korekcja linii bazowej, wygładzanie, ROI, Udostępnij,
konto użytkownika). Oś X to E po kalibracji TPrA, przełącznik E surowe został.
Strefa upuszczania mówi „TXT z NOVA", nie CSV i DTA, bo tylko TXT jest obsługiwany.

`APP_VERSION` = 1.2.0 (1.1.0 to runda 2). Obie pozycje są w historii wersji, w obu językach.

## Błędy znalezione przy okazji i naprawione

- Wynik odtworzony z IndexedDB rysował się, zanim worker zdążył podać stałe algorytmu,
  więc karta „Wzorzec" i progi zostawały puste do następnego kliknięcia. Zdarzenie
  `ready` przerysowuje teraz treść.
- Natywny `select` w pasku narzędzi zostawał jasny w ciemnym motywie, praktycznie
  nieczytelny. Dostał te same powierzchnie co przyciski obok.
- `text-transform: uppercase` na etykietach zjadało znak mikro („I (µA)" → „I (MA)")
  i indeks w „ΔE_s". Etykiety nie są już wersalikowane.

## Nowe i zmienione pliki (runda 3)

```
nowe:       static/ities/ui/result.js
przepisane: static/ities/ui/sidebar.js  static/ities/ui/chart.js  static/ities/app.js
            static/ities/ui/verdict.js  static/ities/ui/details.js  static/ities/index.html
            static/ities/styles.css
zmienione:  static/shared/i18n.js (94 nowe klucze w obu językach)
            static/shared/ui.css (select, pola tekstowe)  static/shared/tokens.css (sidebar 300 px)
            tools/screenshots.mjs
usunięte:   martwy kod: renderDetails, renderVerdictCard, sampleSummary, formatTime,
            focusFile oraz nieużywane eksporty w chart.js i format.js
```

## Testy rundy 3

1. Parytet `nice -n 10 node tools/parity_test.mjs`: 485 plików, **0 różnic**
   (status / delta_Es / Ip_analyte_fwd_uA, tol 1e-9), load Pyodide 0,83 s, pakiety 0,89 s,
   analiza 56,61 s. Test negatywny: 27 różnic na 200 plikach, test nadal umie paść.
   `RELEASE_CHECK.md`, gate PASS.
2. `node ~/.claude/skills/impeccable/scripts/detect.mjs --json static/` → `[]`.
3. Zrzuty `tools/screenshots.mjs`: 18 plików w `screenshots/`, desktop 1440×900 i
   mobile 390×844, EN i PL, jasny i ciemny dla ekranu wyniku, plus tabela, tryb ekspercki,
   folder, historia wersji, hub i stan pusty. Błędy konsoli na wszystkich ekranach: **zero**.
4. Folder `Neutrale` (45 plików TXT, podfolder `seria_2` z 5 plikami, podrzucony
   `pomiar_surowy.nox`) obiema drogami, wejściem i upuszczeniem: 45 plików w sesji,
   licznik „Wgrano 45 plików", węzeł „Neutrale 45", zbiorczo
   „45 POMIAR NIE NADAJE SIĘ DO OCENY", „pominięto 1 (.nox)", 5 plików z etykietą `seria_2/`.
   Analiza 45 plików ruszyła sama.
5. Trzy pliki referencyjne w przeglądarce, wersja 1.1: `93P_300ul_TPra(1).txt` →
   DO OCENY EKSPERTA, ΔE_s 0,364 V, różnica +14 mV, punkty 1-4 z E −0,141 / −0,041 /
   0,218 / 0,328 V; `BRB pH 7 CV 50uM codeine + 50uM TPrA.txt` → NIE STWIERDZONO W TYM
   POMIARZE; `132-1_blank(2).txt` → POMIAR NIE NADAJE SIĘ DO OCENY. Czas jednego pliku
   0,09 do 0,11 s po starcie silnika.
6. Bundle: `tools/build_deploy_bundle.sh` → `deploy/analizatory_bundle.tar.gz`,
   620 690 bajtów (0,59 MiB), 17 plików Pyodide do pobrania na serwerze.

## Czego nie zrobiono

- Wdrożenia na Frog nie ruszałem (zakaz z sekcji 9 specyfikacji), commitów też nie.
- Przycisk „Dodaj folder" przez natywne okno wyboru katalogu nie da się uruchomić
  headless: Chrome odmawia `DOM.setFileInputFiles` na inpucie `webkitdirectory`.
  Przetestowana jest ta sama ścieżka kodu, tylko karmiona `FileList` z
  `webkitRelativePath` i osobno upuszczonymi `FileSystemEntry`.
- Zakładek Przegląd / Dane surowe / QC z makiet nie ma, bo nie miałyby treści.

# Integracja PeakWise, 16.09.2026

Wykonana instrukcja: `10_peakwise_web_20260916/HUB_INTEGRATION.md`. Wersja huba i ITIES
Detect zostaje **1.2.0**, PeakWise wchodzi jako aplikacja 1.0.0 z algorytmem 1.0.

## Co skopiowano z katalogu 10

```
static/peakwise/                 15 plików (index.html, versions.html, styles.css,
                                 app.js, engine.js, worker.js, algo_stub.js, ui/*.js)
algo/peakwise_algo_v1.0.py       45 kB, sha256 2d021d6e…7eed (zgadza się z HUB_INTEGRATION.md)
algo/peakwise_versions.json      1 wpis, jeden default
```

Ikony `static/assets/peakwise_icon_{256,512}.png` były już na miejscu i są bajt w bajt takie
same jak w katalogu 10, więc ich nie ruszałem. `assets/peakwise_icon_1024.png` też już leżał.

Czego nie skopiowano, zgodnie z instrukcją: `static/_hub_preview.html`, `static/shared/`,
`static/vendor/`, `static/pyodide/`, `server/app.py` z katalogu 10.

## Kafelek w `static/index.html`

Blok kafelka był dokładnie taki, jak cytuje HUB_INTEGRATION.md, mimo rundy 3. Zmiana:

```
- <div class="hub-tile is-soon" aria-disabled="true">     + <a class="hub-tile" href="/peakwise/">
- alt="" aria-hidden="true"                               + alt="PeakWise"
- <span class="hub-badge" data-i18n="hub.soon">soon</span> + <span class="hub-badge" id="peakwise-ver">v1.0</span>
- </div>                                                   + </a>
```

Dwujęzyczność kafelka jest taka sama jak u ITIES Detect: opis idzie przez
`data-i18n="hub.peakwise.desc"` (klucz był już w `shared/i18n.js` w obu językach), nazwa
produktu przez `HUB_TILE_2_NAME` z `shared/config.js`, a numer wersji nie jest tekstem do
tłumaczenia. Doszły cztery linijki w module strony, które biorą numer plakietki z
`/algo/peakwise_versions.json`, żeby nie powtarzać go w dwóch miejscach. Komentarz STORY na
górze pliku mówił „see PeakWise as coming soon", więc też go poprawiłem.

Do historii wersji dopisany wpis o PeakWise przy 1.2.0, w obu językach
(`app.changelog.1_2_0` w `static/shared/i18n.js`). Numer wersji aplikacji bez zmian.

## Wspólne pliki: 09 jest źródłem prawdy

Sprawdzone: PeakWise linkuje `/shared/tokens.css` i `/shared/ui.css`, czyta i zapisuje te
same klucze `localStorage` co hub i ITIES, czyli `analizatory-lang` i `ities-theme`.
Potwierdzone w działającej przeglądarce: język PL i motyw ciemny ustawione w hubie
obowiązują po wejściu w PeakWise (`{"theme":"dark","lang":"pl","addButton":"Dodaj pliki"}`).

Uwaga: zdanie z sekcji 6 HUB_INTEGRATION.md, że język PeakWise siedzi pod własnym kluczem
`peakwise-lang`, jest nieaktualne. W kodzie jest `STORAGE_KEY = "analizatory-lang"`.

Wersje wspólnych plików w katalogu 10 były starsze niż w 09 (`tokens.css`: sidebar 280 px
zamiast 300 px, `ui.css` bez stylu `select` i pól tekstowych z rundy 3). Zgodnie z zasadą,
że 09 jest źródłem prawdy, **nic z 10 nie nadpisało 09**; zsynchronizowane w drugą stronę,
09 do 10, żeby oba katalogi renderowały tak samo.

## Znaleziona i naprawiona regresja: select bez strzałki

Po podpięciu PeakWise pod nowszy `shared/ui.css` lista wyboru wersji algorytmu straciła
strzałkę. Runda 3 dała selectom `appearance: none` plus strzałkę rysowaną w
`background-image`, a `static/peakwise/styles.css` miał własną regułę
`.toolbar-field input, .toolbar select { background: … }`, która wygrywa specyficznością i
kasuje `background-image`. Efekt: płaskie pole bez żadnego znaku, że to lista.

Widać to na zrzucie sprzed poprawki, ITIES miał strzałkę, PeakWise nie. Poprawka w
`static/peakwise/styles.css`: z reguły wypada `select`, zostaje `.toolbar-field input`.
Selecty stylowane są odtąd w jednym miejscu, tak jak w ITIES. Zweryfikowane powtórnym
zrzutem, strzałka wróciła na desktopie i na mobile. Ta sama poprawka poszła do katalogu 10.

## Serwer

`server/app.py`:

1. Dopisany route `/peakwise/` bliźniaczy do `ities_index()`, cztery linijki. Bez niego
   kafelek prowadziłby pod adres, który zwraca 404.
2. `/algo/<plik>` oddaje `application/json` dla `.json`, `text/plain` dla reszty. Wcześniej
   manifest wersji szedł jako `text/plain`.
3. Przy okazji: nagłówek tego route brzmiał `text/plain; charset=utf-8; charset=utf-8`,
   bo Flask sam dokleja `charset`. Teraz jest jeden.

`tools/test_server.py` rozszerzony o `/peakwise/`, `/peakwise/app.js` z `no-cache`,
`/algo/peakwise_versions.json` z kontrolą typu MIME i dokładnie jednego wpisu `default`,
pobranie pliku algorytmu z manifestu oraz dwa warunki na sam kafelek (link `/peakwise/`
jest, plakietki `hub.soon` nie ma).

Przy okazji wyszło, że kontrola strony huba **była zepsuta od rundy 3**: sprawdzała
`b"Analizatory CV" not in hub.data`, a runda 3 przeniosła polskie napisy z `index.html` do
`shared/i18n.js`, więc ten warunek nie mógł już przejść. Teraz hub sprawdzany jest po
strukturze (`data-i18n="hub.title"`), a słownik po tym, że klucze huba są w obu językach.

## Testy

1. **Parytet ITIES**, `nice -n 10 node tools/parity_test.mjs`: 485 plików, **0 różnic**
   (status / delta_Es / Ip_analyte_fwd_uA, tol 1e-9). Analiza 56,66 s, RSS 1224,7 MB.
   Test negatywny: 27 różnic na 200 plikach. `RELEASE_CHECK.md`, gate PASS.
2. **Parytet PeakWise**, `tools/parity_test_peakwise.mjs` uruchomiony na skopiowanym tu
   `algo/peakwise_algo_v1.0.py`: 188 plików, **187 z 188 identycznych na każdym polu**,
   1 udokumentowany remis, **0 prawdziwych różnic**. Remis to
   `SPE iterations/LEYER HEIGHT/0,24/0,24 A/0,24(A) 1 mM FeMeOH ba(2)`, indeks piku
   katodowego ląduje na sąsiedniej próbce, bo WASM i natywne scipy inaczej zaokrąglają
   savgol_filter. Ep rozjeżdża się o 2,4 mV, Ip o 0,025 %, oba w granicach bramki.
   Test negatywny (`IP_DEFINICJA = 'styczne'`): 156 z 188 plików się rusza.
   `RELEASE_CHECK_PEAKWISE.md`, gate PASS z 1 remisem. Liczby zgadzają się co do cyfry z
   przebiegiem z katalogu 10, więc kopia algorytmu liczy to samo co oryginał.
3. `tools/test_server.py`: PASS. Sprawdzone, że umie paść: po schowaniu
   `static/peakwise/index.html` zwraca `FAIL  /peakwise/ status 404` i kod wyjścia 1.
4. `node ~/.claude/skills/impeccable/scripts/detect.mjs --json static/` → `[]`.
   Sprawdzone, że detektor w ogóle coś widzi: na podrzuconym pliku z `font-family: Arial`
   w podkatalogu zgłasza `overused-font`, więc pusty wynik na `static/` jest wynikiem, a
   nie ciszą zepsutego narzędzia.
5. **Zrzuty**, `tools/screenshots_peakwise.mjs` (headless Chrome po CDP, port 9224, serwer
   na 20412): 9 plików w `screenshots/`. Cztery zrzuty huba nadpisane, bo pokazywały
   plakietkę „wkrótce". Odczyty ze strony: kafelek `{"href":"/peakwise/","badge":"v1.0",
   "desc":"Piki anodowe i katodowe elektrod drukowanych 3D.","soon":0}`, pasek stanu
   PeakWise `Engine ready, v1.0 2d021d6e…7eed`. Błędy konsoli: jeden, 404 na
   `/favicon.ico`, opisany niżej.
6. **Bundle rozpakowany i uruchomiony**: `server/app.py` z paczki odpowiada 200 na `/`,
   `/ities/`, `/peakwise/`, `/peakwise/app.js`, `/peakwise/ui/i18n.js`,
   `/algo/peakwise_versions.json` (jako `application/json`) i `/algo/peakwise_algo_v1.0.py`,
   a suma pliku algorytmu w paczce zgadza się z manifestem.

Zrzuty: `hub-desktop-{en,pl}.png`, `hub-mobile-{en,pl}.png`,
`peakwise-empty-desktop-en.png`, `peakwise-result-desktop-en-light.png`,
`peakwise-result-desktop-pl-dark.png`, `peakwise-table-desktop-pl-dark.png`,
`peakwise-result-mobile-en-light.png`.

## Bundle

`tools/build_deploy_bundle.sh` → `deploy/analizatory_bundle.tar.gz`,
**666 761 bajtów (0,64 MiB)**, 77 wpisów, w tym 21 dotyczących PeakWise. Poprzednia paczka
miała 620 690 bajtów, czyli przyrost 46 071 bajtów. Do paczki dołożony
`RELEASE_CHECK_PEAKWISE.md`, żeby dowód bramki jechał razem z kodem. Bez Pyodide, bez
`__pycache__`, bez `.venv`; serwer nadal dociąga 17 plików Pyodide sam.

## Nowe i zmienione pliki

```
nowe:       static/peakwise/** (15)  algo/peakwise_algo_v1.0.py  algo/peakwise_versions.json
            tools/parity_test_peakwise.mjs  tools/screenshots_peakwise.mjs
            RELEASE_CHECK_PEAKWISE.md
zmienione:  static/index.html (kafelek, plakietka z manifestu, komentarz STORY)
            static/shared/i18n.js (wpis w historii wersji 1.2.0, EN i PL)
            static/peakwise/styles.css (select oddany do shared/ui.css)
            server/app.py (route /peakwise/, MIME manifestu, podwójny charset)
            tools/test_server.py (PeakWise plus naprawa kontroli huba)
            tools/build_deploy_bundle.sh (RELEASE_CHECK_PEAKWISE.md w paczce)
            .gitignore (artefakty nowych skryptów)
            deploy/analizatory_bundle.tar.gz, deploy/start.sh, deploy/crontab.txt,
            deploy/fetch_pyodide_on_server.sh (przebudowane)
            screenshots/hub-*.png (4 nadpisane) plus 5 nowych peakwise-*
w katalogu 10: static/shared/{tokens,ui}.css i static/peakwise/styles.css
            zsynchronizowane z 09, żeby nie rozjeżdżały się dalej
```

## Zostało otwarte

- `/favicon.ico` zwraca 404 na hubie i w ITIES Detect. PeakWise ma `<link rel="icon">`,
  hub i ITIES nie. To sprzed tej integracji, nie ruszałem, bo hub jest w rundzie 3.
- `.hub-tile.is-soon` w `shared/ui.css` i klucz `hub.soon` w `shared/i18n.js` nie mają już
  użytkownika. Zostawiłem, bo to plik wspólny, edytowany równolegle, a przy trzecim kafelku
  znów się przyda. Do skasowania przy sprzątaniu rundy 3.
- PeakWise ma własny słownik (`static/peakwise/ui/i18n.js`) i własny przełącznik motywu w
  stopce zamiast `shared/prefs.js`. Świadomie, zgodnie z sekcją 2b HUB_INTEGRATION.md.
  Scalenie po ustabilizowaniu katalogu 09 jest mechaniczne, opisane tam.
- Baseline CPython PeakWise (`wyniki/baseline_cpython.jsonl`, 188 rekordów) i zgodność z
  notatnikiem zostają w katalogu 10. `tools/parity_test_peakwise.mjs` czyta je stamtąd,
  zamiast robić drugą kopię pomiaru. `tools/` nie jedzie w paczce, więc wdrożeniu to nie
  przeszkadza, ale przeniesienie katalogu 10 zerwie ten test.
- Wdrożenia nie ruszałem, commitów nie robiłem. Gunicorn na 20412 zatrzymany,
  `pgrep -f 'gunicorn.*20412'` nic nie zwraca, port bez nasłuchu.

---

# 1.3.0, runda 2 (17.09.2026)

Runda 1 (Codex) wdrożyła brief `BRIEF_v1.3_UX_20260917.md` i urwała się na limicie:
`tools/ui_smoke.mjs` nie przechodził ani jednego kroku, parytet nie był puszczony po
zmianach, pakiet nie był zbudowany. Runda 2 wdraża `BRIEF_v1.3_ADDENDUM_20260917.md`,
który w kilku miejscach nadpisuje brief, naprawia smoke test i zamyka wydanie.

## Co wchodzi z addendum, punkt po punkcie

**1. Ręczna para bez zasiewu.** Zasiew `E3 = E1 + 0,350 V` zniknął z kodu. `analyze()`
nie zwraca listy odrzuconych kandydatów (są tylko liczniki `n_candidates_fwd/bwd`),
więc zgodnie z addendum nic takiego nie jest dorabiane w JS ani w Pythonie i wchodzi
tryb wskazywania: przycisk „Dodaj parę analitu" włącza tryb ekspercki, zakłada celownik
na wykresie i prosi po kolei o punkt 3 i punkt 4; „Wskaż wzorzec ręcznie" prosi o cztery
punkty w kolejności 1, 2, 3, 4. Dopiero po komplecie idzie `analyze(manual)`. Escape
przerywa. Każdy wiersz 1 do 4 w panelu „Piki" ma pole liczbowe E (V) ze skokiem 1 mV,
czynne w trybie eksperckim (WCAG 2.2 `dragging-alternative`); uchwyt na wykresie tylko
odzwierciedla wartość. Zapis korekty jest zablokowany, dopóki każdy z punktów 1 do 4 nie
pochodzi albo z algorytmu, albo ze wskazania technika (`manualGap` w `app.js`).
Linia werdyktu przy wyniku ręcznym ma dwa człony i nigdy sam ekspert:
„Automatycznie: DO OCENY EKSPERTA · Ekspert (12:03): NIE STWIERDZONO W TYM POMIARZE".

**2. Werdykt raz, karta jak w 1.0.** Wrócił blok `verdict-card`: słowo 32 px waga 600 w
kolorze tonu (token `--text-verdict`, spec sekcja 4), pod nim jedno zdanie z liczbą, pod
nim jedno zdanie „co dalej", po prawej skala tolerancji z legendą. Rząd czterech kart KPI
usunięty w całości razem z CSS i kluczami `kpi.*`. Plakietki werdyktu w nagłówku pliku już
nie ma (zostaje w pasku bocznym i w tabeli). Panel „Piki" ma sześć wierszy, brakujące z
„—". Test G.3(e) liczy słowo werdyktu w `#content`: dokładnie raz.

**3. Parametry pod trybem eksperckim.** Sekcja „Parametry analizy" jest w DOM tylko przy
włączonym trybie eksperckim. Twarde granice: tolerancja WYKRYTO 1 do 30 mV, tolerancja
DO OCENY nie mniejsza od WYKRYTO i nie większa niż 30 mV, ΔE_s wzorca 0,300 do 0,400 V,
okna TPrA w zakresie −1,0 do 1,0 V, szerokość okna co najmniej 0,05 V, „od" < „do".
Wartość poza granicą gasi przycisk „Zastosuj" i wypisuje powód pod polem. Przy aktywnym
nadpisaniu nad treścią stoi przyklejony pasek „Parametry własne: tolerancja 15/20 mV,
ΔE_s 0,350 V. Wyniki poza walidacją z 16.09.2026." z przyciskiem „Przywróć domyślne".
Pasma na skali tolerancji są wtedy kreskowane, nad skalą etykieta „progi własne", czysta
zieleń zostaje dla wartości domyślnych. Nadpisanie nie przeżywa odświeżenia strony, a
wynik policzony na własnych parametrach zachowuje `file.paramsOverride` i plakietkę.

**4. Raport PDF.** Stopka „ITIES Detect, aplikacja 1.3.0, algorytm 1.1 (SHA-256 …)"
powtarza się na każdej stronie (element `position: fixed`, Chrome powtarza go przy druku).
Numeracji „strona X z Y" nie ma, bo czysty CSS w Chrome jej nie daje; addendum na to
pozwala. Przy każdym wyniku: SHA-256 pliku, wersja algorytmu i tryb, a przy ręcznym
operator, godzina i powód korekty. Przy każdym NIE STWIERDZONO powtórzone zdanie ze
słownika 3.5. Liczby walidacji rozbite, bez sumowania do 192: „wykryto 121 z 293 plików
pozytywnych; fałszywie wykryto 0 ze 147 plików negatywnych i 0 z 45 neutralnych". Menu
„Eksport" ma wybór zakresu PDF (wszystkie, widoczne po filtrze, zaznaczona próbka) z
liczbą plików przy każdej pozycji; powyżej 50 plików wchodzi okno z liczbą stron. W menu
i w nagłówku raportu stoi zdanie o włączeniu grafiki tła, a style druku mają
`print-color-adjust: exact`. Przy sesji mieszanej nagłówek mówi, ile plików policzono na
parametrach własnych.

**5. Okno postępu.** Przycisk „Przerwij" zatrzymuje kolejkę po bieżącym pliku, reszta
zostaje w kolejce, w oknie pojawia się „Przerwano, N plików zostało w kolejce", a
„Przelicz wszystko" wznawia. Gdy silnik jeszcze wstaje, okno pisze „Czekam na silnik:
pakiety numpy, scipy, pandas". W karcie werdyktu jest przycisk „Następny do oceny", gdy
w sesji czeka więcej plików do oceny. Plik w trakcie liczenia pokazuje szkielet karty i
wykresu z `aria-busy`, nie pustą kartę.

**6. Usuwanie i Cofnij.** `Delete` usuwa zaznaczony plik tylko, gdy fokus jest w pasku
bocznym albo w treści wyniku. `Backspace` nie usuwa nigdy. Pasek „Usunięto X · Cofnij"
czeka na następną akcję użytkownika (kliknięcie albo klawisz poza paskiem), maksymalnie
60 sekund.

**7. `tools/i18n_check.mjs`.** Wyciąga `t("klucz")` i `data-i18n="klucz"` z
`static/ities/**`, `static/shared/**` i `static/index.html`, do tego rozwija rodziny
kluczy budowanych w locie (werdykty, powody MEASUREMENT_QUALITY_FAIL, legenda wykresu,
podpowiedzi wskazywania, metody Ip, changelogi). Oblewa, gdy klucza brakuje w EN albo w
PL, i wypisuje klucze bez użytkownika. Wynik: 0 braków.

**8. Testy G.3 h do k** dopisane do `tools/ui_smoke.mjs`, wyniki w `RELEASE_CHECK.md`.

## Naprawiony smoke test

`tools/ui_smoke.mjs` padał w pierwszej linijce: po `Page.navigate` czytał `localStorage`
bez czekania na dokument, więc trafiał w `about:blank` i dostawał SecurityError. Teraz
`goto()` czeka na `location.href` i `readyState`, wzorem `tools/screenshots.mjs`.
Przy okazji wyszły trzy prawdziwe błędy, które inaczej pojechałyby do odbioru:

1. **Podanie FileList do drugiego inputu opróżnia ją.** Po pierwszym imporcie folderu
   probe input był pusty, więc drugie wgranie tego samego folderu nie wywoływało niczego
   i licznik duplikatów nigdy się nie zapalał. Test przygotowuje probe przed każdym
   wgraniem.
2. **uPlot zjada `click` na obszarze wykresu.** Domyślne `drag.click` w uPlot woła
   `stopImmediatePropagation()`, gdy wskaźnik ruszył się od ostatniego wciśnięcia, a
   dojście myszą do piku i kliknięcie to dokładnie ten przypadek. Tryb wskazywania
   nasłuchuje więc `pointerdown`, nie `click`. Bez testu ta funkcja nie działałaby u
   człowieka prawie nigdy.
3. **Ekran wyniku nie odświeżał się po skończeniu kolejki.** Przycisk „Następny do oceny"
   zależy od statusu innych plików, a `pump()` przerysowywał treść tylko dla pliku
   właśnie policzonego. Teraz po opróżnieniu kolejki leci jedno `renderContent()`.

## Testy

Wszystko pojedynczo, przez `nice -n 10`, na serwerze `127.0.0.1:20412`.

| test | wynik |
|---|---|
| `node tools/i18n_check.mjs` | PASS, 291 kluczy, 359 EN, 359 PL, 0 braków |
| `node tools/params_override_test.mjs` | PASS, 7 z 7 asercji, 4,32 s |
| `node tools/parity_test.mjs` | PASS, 485 plików, **0 różnic**, 52,96 s, RSS 1132,5 MB |
| `node tools/ui_smoke.mjs` | PASS, 14 z 14, 21,89 s, 0 błędów konsoli |
| `node tools/screenshots.mjs` | 23 zrzuty, 0 błędów konsoli |
| `python3 tools/test_server.py` | PASS |
| `detect.mjs --json static/ities` | `[]` |

Testy negatywne (parytet 27 różnic, i18n brak klucza, smoke podwojony werdykt, detektor na
podrzuconym Arialu) opisane w `RELEASE_CHECK.md`.

## Kontrola antyregresyjna

Osobny przebieg w headless Chrome, poza smoke testem, na pytanie „co przestało działać":

- import folderu przyciskiem i przeciągnięciem: oba po 45 plików, 43 wiersze, 5 plików w
  podfolderze, 1 pominięty `.nox`, liczby identyczne jak przed zmianami;
- tryb ekspercki na pliku z pełną parą: 4 uchwyty, przeciągnięcie punktu 4 daje wynik
  ręczny i dwuczłonową linię werdyktu, Zapisz nieaktywny do czasu podania powodu;
- eksport CSV: 60 kolumn, `params_override` zawsze obecna i pusta przy domyślnych
  parametrach, obok `detection_tolerance_mV`, `uncertain_tolerance_mV`, `target_delta_V`;
- tabela: 11 kolumn, sortowanie i filtry bez zmian;
- `Backspace` nie usuwa pliku, `Delete` z fokusem na liście usuwa i pokazuje Cofnij;
- ciemny motyw i język EN: zrzuty `ities-result-desktop-en-dark.png`,
  `ities-result-desktop-en-light.png`, `ities-result-mobile-en-dark.png`.

## Zmienione pliki

```
static/ities/index.html        menu eksportu z zakresem PDF, parametry z granicami i
                               powodem pod polem, pasek parametrów własnych, Przerwij
                               i wiersz stanu w oknie postępu
static/ities/app.js            tryb wskazywania, walidacja granic, pasek parametrów,
                               przerwanie kolejki, Delete zamiast Backspace, Cofnij do
                               następnej akcji, zakres eksportu PDF, Następny do oceny
static/ities/styles.css        karta werdyktu, kreskowane pasma skali, pola liczbowe w
                               panelu Piki, podpowiedź wskazywania, pasek parametrów,
                               szkielet ładowania, stopka druku; wypadły style KPI,
                               plakietki werdyktu i bloku Analiza ITIES
static/ities/ui/result.js      karta werdyktu 1.0, nagłówek bez werdyktu, panel Piki z
                               polami liczbowymi i przyciskiem wskazywania, szkielet
static/ities/ui/verdict.js     deviationScale z flagą własnych progów, usunięty
                               nieużywany verdictBadge
static/ities/ui/chart.js       tryb wskazywania na pointerdown, kursor celownika
static/ities/ui/session.js     raport PDF: stopka na każdej stronie, tryb i powód przy
                               wyniku, zakres, sesja mieszana, rozbite liczby walidacji
static/shared/i18n.js          nowe klucze EN i PL, zmieniony changelog 1.3.0, rozbite
                               liczby walidacji w raporcie i na stronie wersji, usunięte
                               klucze bez użytkownika
tools/i18n_check.mjs           nowy
tools/ui_smoke.mjs             naprawiony start, kroki h do k, PASS/FAIL na krok
tools/screenshots.mjs          selektory po zmianie C, nowe zrzuty
RELEASE_CHECK.md               sekcja 1.3.0
BUILD_REPORT.md                ta sekcja
screenshots/                   23 pliki odświeżone
deploy/                        przebudowany pakiet
```

`algo/` i notatnik nietknięte. Żadnej nowej zależności, kroku budowania, CDN w runtime
ani zewnętrznego fontu. `static/peakwise/` nietknięty, w `static/shared/i18n.js` tylko
dopisane klucze i poprawione liczby walidacji.

## Czego nie ma i dlaczego

- **Numeracja stron w PDF.** Chrome nie liczy stron z czystego CSS, więc stopka na każdej
  stronie jest, ale bez „strona X z Y". Addendum sekcja 4 wprost na to pozwala.
- **Zasiew z listy kandydatów algorytmu.** `analyze()` zwraca tylko liczby kandydatów, nie
  ich potencjały. Addendum zabrania dorabiania takiej listy, więc został sam tryb
  wskazywania.
- **Dwuczłonowa linia werdyktu ma 21 px, nie 28 do 34 px.** Dwa słowa werdyktu plus
  podpisy „Automatycznie" i „Ekspert (imię, godzina)" w jednej linii przy 32 px łamią się
  na trzy wiersze na 1440 px. Pojedynczy werdykt trzyma pełne 32 px ze spec sekcja 4.
- **Backlog z sekcji 9 addendum, świadomie odłożony**: znacznik „sprawdzone" przy pliku z
  licznikiem; tabela jako ekran startowy po serii; lista duplikatów z „Dodaj mimo to";
  eksport i wczytanie całej sesji jako plik; wiersz sumy per folder w tabeli.

## Pakiet wdrożeniowy

`tools/build_deploy_bundle.sh` bez `--check-urls` → `deploy/analizatory_bundle.tar.gz`,
**686 029 bajtów**, 77 wpisów. Poprzednia paczka miała 666 761 bajtów, przyrost 19 268
bajtów. Rozpakowana kopia zgadza się co do bajtu z `static/ities/**` i
`static/shared/i18n.js` w katalogu roboczym, a `RELEASE_CHECK.md` w paczce ma sekcję
1.3.0. Bez Pyodide, serwer dociąga je sam. Nic nie było commitowane, publikowane ani
wysyłane na serwer. Gunicorn użyty do testów (127.0.0.1:20412) jest zatrzymany,
`pgrep -f 'gunicorn.*20412'` nic nie zwraca.

Uwaga dla odbierającego: `tools/ui_smoke.mjs` i `tools/screenshots.mjs` wymagają
działającego serwera na 20412, czyli wcześniejszego `bash server/start.sh`.

## Do sprawdzenia ręcznie w prawdziwej przeglądarce

1. Wskazywanie punktów myszą na pliku „wzorzec bez analitu": czy celownik trafia tam,
   gdzie człowiek celuje, i czy uchwyty siadają na gałęziach.
2. Wydruk do PDF z włączoną grafiką tła: czy stopka jest na każdej stronie i czy wykresy
   nie są blade.
3. Raport powyżej 50 plików: czy okno z liczbą stron nie przeszkadza w pracy.
4. Pola liczbowe w panelu „Piki" na klawiaturze: strzałka góra i dół po 1 mV.
5. Pasek „Parametry własne" przy długim przewijaniu listy wyników.

### 1.3.0, odbiór (17.09.2026, 12:40)
Odbiór w prawdziwym Chrome na lokalnym serwerze (5 plików referencyjnych, PL i EN): okno postępu z licznikami, wskazywanie pary 3 i 4 myszą (dwa kliknięcia, przyciąganie do gałęzi, linia werdyktu auto + ekspert), parametry pod trybem eksperckim z paskiem i kreskowaną skalą, powrót do domyślnych, dialog „Wyczyść sesję", tabela z zakresem eksportu. Trzy poprawki po odbiorze:
1. Okno postępu nigdy nie zamykało się samo: `dialog.show()` ustawia fokus na przycisku ×, a warunek „ma fokus" blokował zamknięcie. Teraz blokuje tylko wskaźnik nad oknem albo pointerdown/keydown użytkownika (`state.progress.touched`).
2. Etykieta licznika „NIE STWIERDZONO W TYM POMIARZE" łamała się w środku słowa (`overflow-wrap: anywhere`). Teraz `word-break: keep-all`, okno 580 px.
3. Pasek „Parametry własne" pokazywał ΔE_s z kropką w PL (`toFixed`). Teraz `toLocaleString(locale())`.
Po poprawkach: ui_smoke 14/14 (22,03 s, 0 błędów konsoli), i18n_check 0 braków, pakiet 686 239 B. Parytet nie wymagał powtórki (zmiany tylko w app.js i styles.css, nie w workerze ani w stubie).
Do zrobienia w kolejnej wersji (z odbioru): w widoku tabeli kolumna „Jakość" i chip „Werdykt" powtarzają to samo słowo dla statusów jakościowych; źródło w oknie postępu („5 files") nie tłumaczy się przy zmianie języka w trakcie sesji.

### 1.3.0, wdrożenie i bufor Cloudflare (17.09.2026, 13:30)
Po pierwszym wgraniu 1.3.0 na Froga strona padała u każdego, kto miał w przeglądarce wersję 1.2: `TypeError ... addEventListener` w starym app.js uruchomionym na nowym index.html. Przyczyna: publiczny adres wykr.es idzie przez Cloudflare, który buforuje .js i .css na krawędzi (cf-cache-status REVALIDATED) i narzuca przeglądarkom `cache-control: max-age=14400`, nadpisując nasze `no-cache` z gunicorna (bezpośredni port zwraca no-cache). Chrome przy zwykłym odświeżeniu nie sprawdza podzasobów, więc użytkownik zostawał ze starym kodem na 4 godziny.
Lekarstwo: `tools/stamp_versions.py` uruchamiany przez `tools/build_deploy_bundle.sh` na kopii roboczej dopisuje `?v=<skrót treści>` do każdego pierwszorzędnego odwołania do .js/.css (atrybuty src/href, import/from, new URL workera); vendor i pyodide zostają z długim buforem. Źródła w repo są bez stempli, stempel powstaje przy budowie pakietu. Sprawdzone: pakiet rozpakowany do katalogu tymczasowego i podany przez gunicorn na 127.0.0.1:20413, w Chrome 17 zasobów ze stemplem, 0 bez, 0 błędów konsoli. Pakiet: `deploy/analizatory_bundle.tar.gz`, 686 357 B, SHA-256 960bd164daee7e0d…, stempel 32a0a775ea.

### 1.3.0, poprawka po zgłoszeniu Pawła (17.09.2026, 15:30): grupy próbek nie dawały się rozwinąć
Przy więcej niż 12 próbkach grupy startują zwinięte, a zbiór `closedSamples` działał jak „zamknij", nie jak przełącznik: klik na zwiniętą grupę dodawał ją do zbioru i zostawiał zwiniętą. Teraz klik odwraca stan domyślny (`base = defaultOpen || zaznaczony plik w grupie; open = toggled ? !base : base`). Sprawdzone w Chrome na 20 plikach z 18 próbek: false → true → false. Pakiet przebudowany, stempel 11d23b3dec.

---

# 1.4.0 (17.09.2026, runda 2)

Runda 1 (Codex) urwała się na limicie w trakcie pisania `tools/test_server.py`. Runda 2
domknęła brief A do I i wdrożyła addendum J do P. Poniżej stan punkt po punkcie, wyniki
testów z liczbami, lista zmienionych plików i instrukcja wgrania pliku logowania.

## ETAP 1 i ETAP 2

Runda 1 nie zostawiła znacznika „ETAP 1 GOTOWY". Runda 2 zastała kod, który przechodził
`node --check` i `py_compile`, ale miał trzy dziury: `/login` zwracał 500, `/robots.txt`
404, a `BUILD_REPORT.md` nie miał sekcji 1.4.0. Wszystkie trzy zamknięte, opis niżej.

## Brief 1.4, sekcje A do I

- **A. Dymki.** Zrobione w rundzie 1 i sprawdzone tutaj: `static/shared/tooltip.js`,
  300 ms na najechanie, natychmiast po fokusie, `role="tooltip"` plus `aria-describedby`,
  Escape zamyka, pozycja pod elementem z marginesem 8 px od krawędzi. Ikona „i" przy
  przełączniku eksperta otwiera ten sam tekst jako klikalny popover. Wszystkie teksty
  przez `tip.*`, łapie je `tools/i18n_check.mjs`.
  Runda 2 dołożyła do modułu dwie rzeczy potrzebne dla addendum L: `data-tooltip-text`
  (treść budowana z manifestu, nie z słownika) i jeden opcjonalny odnośnik w dymku.
- **B. Własne foldery.** Zrobione w rundzie 1: „Nowy folder" w nagłówku listy, nazwa
  inline, przeciąganie wiersza na nagłówek folderu, menu „Przenieś do…", zmiana nazwy,
  usunięcie bez kasowania plików, wiersz statystyk, zapis w IndexedDB, kolumna `folder`
  w CSV i grupowanie w PDF. Sprawdzone krokiem smoke `m`.
- **C. Okno postępu.** Zrobione w rundzie 1, ale nie działało do końca: patrz „Błędy
  znalezione i naprawione", punkt 3. Po naprawie okno startowe jest wyśrodkowane
  (zmierzone: dx = 0 px, dy = 0 px od środka viewportu) i zamyka się samo po gotowości
  silnika.
- **D. Logowanie.** Zrobione w rundzie 1, z jednym błędem krytycznym: `GET /login`
  zwracał 500. Naprawione, patrz punkt 1 niżej. Reszta działa: 302 na `/login` bez sesji,
  ogólny komunikat przy złym haśle, brak ciasteczka sesji, 429 po piątej próbie z tego
  samego adresu, `/healthz` bez logowania, ciasteczko `HttpOnly`, `SameSite=Lax`,
  `Secure` za `X-Forwarded-Proto: https`.
- **E. Drobiazgi.** `APP_VERSION = "1.4.0"`, klucz `app.changelog.1_4_0` w EN i PL
  (uzupełniony w rundzie 2 o zdania dla J do P), wpis w `versions.html` bierze się z
  `APP_CHANGELOG_KEYS`, więc pojawia się sam. Dwuczłonowa linia werdyktu: pierwszy wiersz
  w pełnym rozmiarze, drugi 18 px z etykietą „Ekspert (imię, godzina):" w kolorze tekstu
  drugorzędnego (`.verdict-part-expert` w `static/ities/styles.css`).
- **F. Testy.** Wszystkie uruchomione, liczby niżej.
- **G. Czego nie robić.** Dotrzymane: hasło nigdzie poza `server/auth.local.json` (testy
  losują własne), zero zmian w `algo/`, zero nowych zależności, zero `alert/confirm/prompt`,
  zero emoji jako ikon, zero CDN w runtime, zero commitów i wdrożeń, Chrome tylko
  headless przez CDP w skryptach.
- **H. Raport.** Ten plik i `RELEASE_CHECK.md` sekcja 1.4.0.
- **I. Plakietki liczników.** Zrobione w rundzie 1, potwierdzone pomiarem w rundzie 2:
  krok smoke `i2` liczy elementy z klasą `tone-*` w pasku podsumowania, które mają inne
  tło niż przezroczyste. Wynik: 0 na 4 człony, i zero wystąpień „(?)" w pasku bocznym.

## Addendum, sekcje J do P

- **J. Logotypy w stopce.** Nowy moduł `static/shared/partners.js`, jedno miejsce dla
  trzech plików z `assets/partners/`. Wysokość 22 px, odstęp 16 px, skala szarości przez
  `filter: grayscale(1)`, pełny kolor po najechaniu i po fokusie, `alt` z pełną nazwą,
  dymek z tą samą nazwą, zero linków. Plik, którego nie ma na serwerze, usuwa swój własny
  węzeł (`error` na obrazku), więc nie zostaje pusta ramka. Stopka huba, ITIES Detect i
  PeakWise. W ciemnym motywie jasne podłoże pod rzędem logotypów zamiast przerabiania
  samych znaków, bo addendum zabrania ruszać logotypy poza skalą szarości.
  Serwer: `/assets/partners/<plik>` z `Cache-Control: public, max-age=2592000`.
- **K. Jedno miejsce dodawania plików.** Z paska narzędzi zniknęły „Importuj pomiary"
  i „Dodaj folder". Zostają dwa miejsca, które nie widzą się naraz: strefa w dole paska
  bocznego (zawsze) i karta stanu pustego (tylko przy pustej liście). Karta skrócona do
  jednego zdania i dwóch przycisków, lista formatów została tylko w strefie paska.
  Skróty `Cmd/Ctrl+O` i `Cmd/Ctrl+Shift+O`, wypisane w dymku strefy.
- **L. Wersje algorytmu.** Ikona „i" przy wyborze wersji, treść budowana z
  `algo/versions.json`: wersja, data, changelog (teksty z `algo.changelog.*`, nie z
  manifestu), zmierzone liczby z datą pomiaru, skrócony SHA-256, plus odnośnik „Historia
  wersji". Mapa wersja → klucze changelogu przeniesiona z `versions.html` do
  `static/ities/ui/format.js`, żeby było jedno źródło. Po zmianie wersji okno postępu
  pokazuje „Algorytm 1.0 (2026-08-20): stan notebooka z 20.08.2026: ...".
- **M. Bez indeksowania.** `/robots.txt` z `User-agent: *` i `Disallow: /`, nagłówek
  `X-Robots-Tag: noindex, nofollow, noarchive` na każdej odpowiedzi (także `/login` i
  `/robots.txt`), `<meta name="robots" content="noindex, nofollow">` w hubie, ITIES,
  PeakWise, obu stronach historii wersji i na stronie logowania. Bez sitemapy.
- **O. Przełączanie aplikacji.** Nowy moduł `static/shared/appswitch.js`: ikona domu
  (SVG 18 px) z dymkiem „Analizatory CV: wybór aplikacji" i przełącznik aplikacji jako
  menu obok nazwy. W ITIES Detect siedzi w nagłówku paska bocznego, a na wąskim ekranie
  druga kopia ikony domu jest w pasku narzędzi obok „Lista". W PeakWise pasek boczny nie
  ma nagłówka, więc ikona i przełącznik są w pasku narzędzi obok „Lista"; to jedyne
  odstępstwo od litery addendum i jest świadome. Skrót `Cmd/Ctrl+Shift+H` do huba.
  Hub pokazuje przy każdym kafelku liczbę plików w sesji danej aplikacji, czytaną
  bezpośrednio z jej IndexedDB; baza, której nie ma, nie jest zakładana.
- **P. Sesje.** IndexedDB podniesione do wersji 2: nowy magazyn `sessions` z kluczem `id`
  i wskaźnik bieżącej sesji w `meta`. Stara, bezimienna sesja 1.3 nie ginie, tylko staje
  się pierwszą nazwaną sesją (migracja w `ensureCurrentSession`). Menu „Sesja" obok
  „Eksport": nazwa bieżącej sesji do edycji, „Nowa sesja", „Zapisz sesję do pliku",
  „Wczytaj sesję z pliku" i lista zapisanych sesji z liczbą plików, rozmiarem i datą
  ostatniej zmiany, każda z „Zmień nazwę" i „Usuń". W stopce „Zapisano 18:12" po każdym
  zapisie (`aria-live`). Plik sesji to jeden JSON `nazwa.ities.json` z polem
  `format: "ities-session/1"`, plikami w base64 razem z sumami SHA-256, wynikami auto i
  eksperta, rewizjami, folderami, operatorem, parametrami własnymi i wersją aplikacji
  oraz algorytmu. Przy wczytaniu każda suma jest liczona ponownie; jedna niezgodność
  odrzuca cały plik i wypisuje nazwy. Zgodny plik pyta, czy zastąpić bieżącą sesję czy
  dodać jako nową, i odtwarza wszystko bez ponownego liczenia. Powyżej 200 MB ostrzeżenie
  przed zapisem. Nazwa sesji trafia do nagłówka raportu PDF. Plik nie zawiera niczego z
  serwera.

## Błędy znalezione i naprawione w rundzie 2

1. **`GET /login` zwracał 500.** `request.accept_languages.best_match(..., default_match="pl")`
   to sygnatura sprzed Werkzeug 3. W tym venv jest Werkzeug 3.1.8, gdzie parametr nazywa
   się `default`. Poprawione w `server/app.py`. Test `tools/test_server.py` ma teraz dwie
   kontrole na to: `GET /login` z `?lang=pl` i `GET /login` z nagłówkiem
   `Accept-Language: de-DE`, czyli ścieżką, która wywoływała błąd.
2. **`/robots.txt` zwracał 404.** Dodane wraz z nagłówkiem `X-Robots-Tag`.
3. **Okno startowe nigdy się nie zamykało.** Przy starcie `boot()` odtwarza sesję, a
   funkcja odtwarzająca zerowała `state.progress`, czyli obiekt postępu założony chwilę
   wcześniej przez `beginEngineProgress()`. Po zdarzeniu „silnik gotowy" `paintProgress()`
   wychodziło na pierwszej linii, bo nie miało czego malować, więc okno zostawało z
   napisem „Uruchamianie silnika analizy" i paskiem na 0 %. Objaw wyglądał jak zawieszony
   silnik, choć silnik był gotowy. Teraz cykl życia okna należy do silnika i serii, a nie
   do listy plików; `Wyczyść sesję` zeruje go jawnie, bo tam to ma sens.
4. **Logowanie kasowało wybór języka.** Strona logowania ustawiała ciasteczko
   `analizatory-lang` przy każdym wyświetleniu, na podstawie `Accept-Language`, a klient
   czytał ciasteczko przed `localStorage`. Skutek: operator ustawia polski w aplikacji,
   loguje się ponownie i dostaje angielski. Teraz serwer zapisuje ciasteczko tylko przy
   jawnym `?lang=`, a klient czyta najpierw własny wybór z `localStorage`. Poprawione po
   obu stronach i w PeakWise.
5. **Test przeglądarkowy nie umiał się zalogować powtarzalnie.** Wysyłka formularza
   ścigała się z nawigacją, która dopiero co postawiła stronę na `/login`, i znikała bez
   śladu. Teraz logowanie to `POST /login` przez `fetch` ze strony, z kontrolą, że
   `/api/versions` odpowiada 200. Dodatkowo każde polecenie CDP ma limit 60 s, a cały
   przebieg ma strażnika 20 minut, który wypisuje nazwę kroku, na którym stanął. Bez tego
   zawieszony test milczał i wyglądał jak długo liczący.
6. **Fokus w headless Chrome nie wywoływał zdarzeń.** `element.focus()` przesuwało
   `activeElement`, ale nie odpalało `focusin`, więc dymki po fokusie klawiaturą były
   nietestowalne. Skrypty włączają teraz `Emulation.setFocusEmulationEnabled`.

7. **Zatrzymanie serwera testowego było prośbą, nie faktem.** `stop()` wysyłał SIGTERM
   i node od razu kończył pracę. Gunicorn zamyka się łagodnie, więc master potrafił
   przeżyć wyjście skryptu i zostać na porcie 20412 z rodzicem 1. Złapane już po
   dopisaniu raportu: jeden taki proces został o 18:57 po skrypcie pomocniczym, mimo
   że kontrola w narzędziu chwilę wcześniej pokazała czysto. Teraz `stopAndWait()`
   czeka na zgon procesu, po 5 s eskaluje do SIGKILL i na koniec sprawdza, że
   `/healthz` już nie odpowiada; `ui_smoke.mjs` i `screenshots.mjs` czekają na to
   zamknięcie, zamiast je tylko zlecić. Sprawdzone po naprawie: 10 s po przebiegu
   smoke i 8 s po przebiegu zrzutów `pgrep -f 'gunicorn.*20412'` nic nie zwraca, a
   port 20412 nikt nie nasłuchuje (`lsof -nP -iTCP:20412 -sTCP:LISTEN` pusty).
   Uwaga na przyszłość: `pgrep -f 'gunicorn.*20412'` wywołane z powłoki trafia też we
   własne polecenie, więc sam pgrep nie wystarcza jako dowód, potrzebny jest `lsof`
   albo zapytanie o `/healthz`.

## Wyniki testów, liczby

Każdy przez `nice -n 10`, pojedynczo, nigdy równolegle.

| test | wynik | liczby |
|---|---|---|
| `tools/i18n_check.mjs` | PASS | 364 klucze użyte, 454 EN, 454 PL, 0 braków, 22 pliki |
| `tools/test_server.py` | PASS | 23 kontrole |
| `tools/params_override_test.mjs` | PASS | 7 z 7 asercji, 369,55 s |
| `tools/parity_test.mjs` | PASS | 485 plików, 0 różnic, analiza 63,60 s, RSS 837,9 MB |
| `tools/ui_smoke.mjs` | PASS | 26 z 26 kroków, 55,23 s, 0 błędów konsoli, 0 sierot |
| `tools/screenshots.mjs` | PASS | 32 zrzuty, 0 błędów konsoli, 0 sierot |
| `detect.mjs --json static/` | 1 znalezisko | `layout-transition`, `static/ities/styles.css:1416` |

Jedyne znalezisko detektora to `transition: width 200ms` na `.progress-fill`, czyli
dokładnie to, czego wymaga brief 1.4 sekcja C. Zostaje, świadomie.

Testy negatywne (dowód, że kontrole potrafią oblać) opisane w `RELEASE_CHECK.md`,
sekcja 1.4.0. W skrócie: parytet 27 różnic na 200 plikach przy przesuniętym progu,
i18n 1 brak po usunięciu `partner.ul` z PL, serwer 2 błędy po zmianie `X-Robots-Tag`
na `all`, smoke 25 z 26 po wstawieniu przycisku importu z powrotem do paska narzędzi,
parametry własne 6 z 7 po zmianie tolerancji z 15 mV na 2 mV, detektor 2 znaleziska po
podrzuceniu pliku z `font-family: Arial`, zrzuty wypisują `ReferenceError` zamiast
`console errors: none` po celowym błędzie w skrypcie huba.

## Pakiet wdrożeniowy

Pakiet z przetestowanego drzewa: **761 837 bajtów** (0,73 MiB), 87 wpisów, stempel
treści `fad956ac94`, 90 odwołań ostemplowanych, SHA-256
`19a525f90f7fbf43952de5bfc2d29074467222d6e86271607d0c894eea015d66`.

**Uwaga, katalog zmienił się pod ręką po testach.** O 18:52 pojawił się
`static/_probe/` (trzy pliki pomiarowe z laboratorium plus `list.json`, razem 155 KB),
o 18:56 `assets/partners/focusframe-logo.svg`, o 18:57 wstał gunicorn na 20412, którego
nie uruchamiał żaden z moich skryptów. To czyjaś równoległa praca; nie ruszałem tych
plików. Ostatnie przebudowanie paczki (19:04) wciągnęło je w środek:
**801 140 bajtów**, 93 wpisy, stempel `5697bc21b3`, SHA-256
`fc5d26dfedc740b01a5129438e4da60bbf5ec4c63a17b74ba1c824ba96a4637c`.
Tej paczki nie należy wdrażać: pomiary z laboratorium pod `static/` byłyby serwowane
każdemu zalogowanemu, a czwartego logotypu nie ma w addendum ani w kodzie stopki.
Przed wdrożeniem trzeba przebudować pakiet na drzewie bez `static/_probe/` i ustalić z
autorem zmian, co robi `focusframe-logo.svg`.
Sprawdzenie sumy: `shasum -a 256 deploy/analizatory_bundle.tar.gz`.
`RELEASE_CHECK.md` w paczce ma sekcję 1.4.0, `server/auth.local.json` nie ma tam wcale.
Paczka 1.3.0 miała 686 357 bajtów; przyrost 75 480 bajtów to trzy logotypy partnerów
(`assets/partners/`, 47 KB) i nowy kod.

Odmowa działa: po usunięciu na jeden przebieg wykluczenia `server/auth.local.json`
skrypt wypisał `refusing bundle: server/auth.local.json is present` i przerwał.
Po przywróceniu wykluczenia w paczce jest 0 wystąpień tej nazwy.

## Jak wgrać `auth.local.json` na serwer

Plik nie jest w repozytorium ani w paczce, wgrywa się go osobno i tylko raz.

1. Na Macu plik leży w `server/auth.local.json`. Nie otwieraj go, nie kopiuj jego treści
   do dokumentów ani do czatu.
2. Na serwerze nie ma `scp`, więc treść przenosi się przez schowek i `cat`:
   ```sh
   ssh frog@frog01.mikr.us
   cd /home/frog/analizatory/server
   cat > auth.local.json    # wklej zawartość, potem Ctrl-D
   chmod 600 auth.local.json
   ```
3. Sprawdź, że serwer go widzi i że bez niego nie wstaje:
   ```sh
   cd /home/frog/analizatory && sh deploy/start.sh
   wget -qO- http://127.0.0.1:20412/healthz     # pusta odpowiedź, kod 200
   ```
   Gdy pliku brakuje, `deploy/start.sh` kończy się komunikatem
   `missing authentication configuration: ...` i nic nie startuje. Serwer nigdy nie
   rusza „otwarty dla wszystkich".
4. Nowe hasło robi się tak (na Macu, w venv projektu), a wynik wkleja w pole `users`:
   ```sh
   .venv/bin/python -c "from werkzeug.security import generate_password_hash as h; import getpass; print(h(getpass.getpass()))"
   ```
   `secret_key` to 64 znaki hex, np. z `python3 -c "import secrets;print(secrets.token_hex(32))"`.
   Zmiana `secret_key` unieważnia wszystkie ciasteczka sesji, czyli wylogowuje wszystkich.

## Zmienione pliki

```
server/app.py                         best_match, robots.txt, X-Robots-Tag, cache logotypów, ciasteczko języka
server/templates/login.html           meta robots
server/deploy_frog.md                 assets/partners w paczce, testy startują własny serwer, kontrole po wdrożeniu
static/index.html                     meta robots, logotypy, liczba plików w sesji na kafelkach
static/ities/index.html               meta robots, pasek narzędzi bez importu, ikona domu, „i" przy wersji, menu Sesja, stopka
static/ities/app.js                   K, L, O, P, cykl życia okna postępu, applyPayload
static/ities/styles.css               menu sesji, wybór wersji, ikona domu na wąskim ekranie, stopka
static/ities/versions.html            meta robots, changelog z jednego źródła
static/ities/ui/format.js             algoChangelog, algoInfoText, algoFirstChange
static/ities/ui/session.js            nazwane sesje w IndexedDB v2, plik sesji, nazwa sesji w PDF
static/ities/ui/sidebar.js            ikona domu i przełącznik w nagłówku, dymek strefy upuszczania
static/peakwise/index.html            meta robots, logotypy, miejsce na ikonę domu
static/peakwise/app.js                dymki, ikona domu, przełącznik, logotypy, zgodność języka
static/peakwise/ui/i18n.js            własny wybór języka przed ciasteczkiem
static/peakwise/versions.html         meta robots
static/shared/appswitch.js            NOWY: ikona domu, przełącznik aplikacji, skrót do huba
static/shared/partners.js             NOWY: logotypy partnerów
static/shared/i18n.js                 47 nowych kluczy w EN i PL, kolejność źródeł języka, changelog 1.4.0
static/shared/tooltip.js              data-tooltip-text i jeden odnośnik w dymku
static/shared/ui.css                  logotypy, ikona domu, przełącznik, dymek z odnośnikiem, kafelki huba
tools/test_server_boot.mjs            NOWY: własny gunicorn i logowanie dla testów przeglądarkowych
tools/test_server.py                  GET /login, robots, nagłówek, meta, logotypy
tools/ui_smoke.mjs                    własny serwer, logowanie, kroki l, m, n, o, p, q, r, s, t, u, i2, strażnik
tools/screenshots.mjs                 własny serwer, logowanie, 7 nowych zrzutów, zrzut wycinka stopki
tools/i18n_check.mjs                  rodzina partner.* w tablicy DYNAMIC
tools/build_deploy_bundle.sh          assets/partners w paczce
BUILD_REPORT.md                       ta sekcja
RELEASE_CHECK.md                      sekcja 1.4.0
screenshots/                          32 pliki odświeżone, 7 nowych
deploy/                               przebudowany pakiet
```

`algo/` i notatnik nietknięte. Żadnej nowej zależności, kroku budowania, CDN w runtime
ani zewnętrznego fontu.

## Czego nie ma i dlaczego

- **Ikona domu w PeakWise jest w pasku narzędzi, nie w nagłówku paska bocznego.**
  PeakWise nie ma nagłówka paska bocznego; dorabianie go tylko dla ikony byłoby zmianą
  układu aplikacji, na którą addendum nie daje zgody („reszta bez zmian").
- **Plik sesji to JSON, nie ZIP.** Addendum samo to rozstrzyga: bez nowych bibliotek nie
  ma zipa. Plik z 45 pomiarami po 25 KB waży około 1,5 MB, base64 dokłada jedną trzecią.
- **Dymek wersji algorytmu nie ma osobnego popovera z przyciskiem zamknięcia.** Klik w
  ikonę „i" przypina ten sam dymek i odnośnik „Historia wersji" staje się klikalny;
  drugi klik albo Escape go zamyka. To jeden komponent zamiast dwóch.
- **W ciemnym motywie rząd logotypów dostaje jasne podłoże.** Addendum zabrania
  przerabiać znaki poza skalą szarości, a granatowy znak UŁ na ciemnym tle znika.
  Podłoże jest po stronie stopki, nie po stronie logotypu.
- **Odczyt liczby plików na kafelkach huba pokazuje bieżącą sesję danej aplikacji,**
  nie sumę wszystkich nazwanych sesji. Suma myliłaby się z tym, co użytkownik zobaczy po
  kliknięciu.

## Backlog

1. Zmiana nazwy sesji w wierszu listy działa przez pole tekstowe w tym wierszu; przy
   dużej liczbie sesji przydałoby się wyszukiwanie po nazwie.
2. Plik sesji nie jest skompresowany. Gdyby pojawił się przypadek 200 MB, warto sprawdzić
   `CompressionStream("gzip")`, które przeglądarka ma sama, bez nowej zależności.
3. W widoku tabeli kolumna „Jakość" i chip „Werdykt" nadal powtarzają to samo słowo dla
   statusów jakościowych (z odbioru 1.3.0).
4. Źródło w oknie postępu („5 files") nie tłumaczy się po zmianie języka w trakcie sesji
   (z odbioru 1.3.0).
5. PeakWise nadal ma własny słownik `static/peakwise/ui/i18n.js` obok wspólnego. Dwa
   słowniki to dwa miejsca do zapomnienia.
6. Wersja aplikacji jest w `app.js`, wersja PeakWise w `ui/app_version.js`. Jedno miejsce
   byłoby lepsze.

## Do sprawdzenia ręcznie w prawdziwej przeglądarce

1. Logowanie na telefonie: czy karta 360 px mieści się nad klawiaturą i czy menedżer
   haseł podstawia dane.
2. Logotypy w stopce w ciemnym motywie na prawdziwym ekranie: czy jasne podłoże nie
   wygląda jak łatka.
3. Zapis sesji z pełnym folderem laboratoryjnym (45 plików): ile trwa zapis i czy plik
   otwiera się z powrotem bez zauważalnej zwłoki.
4. Przełączanie między ITIES Detect i PeakWise przy wypełnionych obu sesjach: czy nic nie
   znika i czy liczby na kafelkach huba się zgadzają.
5. Dymek wersji algorytmu na ekranie dotykowym: czy klik w „i" przypina go i czy
   odnośnik „Historia wersji" da się trafić palcem.
6. Skróty `Cmd+O`, `Cmd+Shift+O` i `Cmd+Shift+H` w Safari, nie tylko w Chrome.

---

# 1.4.0, addendum 2 (17.09.2026, 21:50)

Wykonane: punkty Q do U z `BRIEF_v1.4_ADDENDUM2_20260917.md`, punkty V, W, X, Y, Z i AA
zgłoszone w trakcie rundy oraz punkt BB z `BRIEF_v1.4_ADDENDUM3_20260917.md`. Numer
wersji zostaje 1.4.0, zmiany dopisane do klucza `app.changelog.1_4_0` w EN i PL.
Zmiany odbierającego z 19:00 (logowanie po polsku, logo Focus Frame, plakietka „1 z 2",
reguła `sampleIdFromName`, `sampleIdManual`) zostały nietknięte.

## Q. Pasek narzędzi: siedem kontrolek w jednym wierszu

Od lewej: grupa wąskiego ekranu (`.toolbar-lead` z przyciskiem „Lista" i ikoną domu),
menu „Sesja", „Przelicz ponownie", wybór algorytmu z ikoną „i", kontrolka „Pliki |
Tabela". Rozpórka `.toolbar-spacer`, a po niej przełącznik „Tryb ekspercki" z ikoną „i"
i menu „Eksport". Razem siedem bezpośrednich dzieci paska; na 1440 px widocznych jest
sześć, bo grupa „Lista plus dom" chowa się, gdy pasek boczny stoi na stałe. Poniżej
1100 px rozpórka dostaje `flex-basis: 100%` i prawa grupa schodzi w całości do drugiego
wiersza. Poniżej 900 px zostają ikona listy, ikona domu i oba menu, reszta się chowa.
Ukryte pola `#file-input` i `#folder-input` wyszły z paska do `.main`, żeby licznik
kontrolek liczył tylko to, co widać. „Wyczyść sesję" jest wyłącznie w menu Sesja, pod
separatorem, w kolorze ostrzegawczym; dialog potwierdzenia bez zmian.

## R. Podsumowanie listy zamiast kontrolki segmentowej

`static/ities/ui/sidebar.js` rysuje `.list-summary` pod nagłówkiem aplikacji, nad
wyszukiwarką: wiersz „234 pliki · 59 pominięto: 57 .nox" i siatka dwa na dwa z czterema
członami werdyktów. Każdy człon to przycisk z `aria-pressed`, kropką 8 px z tokenu
werdyktu, liczbą 15 px `tabular-nums` i etykietą 13 px. Aktywny ma podkreślenie 2 px w
kolorze werdyktu i pełny kolor tekstu, nieaktywne są w kolorze drugorzędnym. Klik w
aktywny wraca do „wszystkie", człon „234 pliki" to filtr „wszystkie". Zero wypełnionych
teł. Na wąskim pasku siatka schodzi do jednej kolumny (`@container (min-width: 260px)`).
Stara kontrolka segmentowa i plakietki w pasku narzędzi zniknęły razem ze swoim CSS.

## S. Stopka: ustawienia rzadkie

`mountPrefs` przeniesione (nie skopiowane) z paska do stopki, do `#app-prefs`. Prawa
strona od lewej: EN | PL, System | Jasny | Ciemny, „Operator", logotypy partnerów,
„Historia wersji", „Wyloguj", numer wersji, separator „|", rok. Lewa strona dostała
napis „Zapisano 21:46", który wcześniej był po prawej. Stopka ma `min-height: 52 px`.
Przy 1440 px i pasku bocznym 300 px lewa grupa mierzy 551 px, a prawa 890 px, więc nie
mieszczą się w jednym wierszu i stopka ma 80 px w dwóch wierszach; przy szerszym oknie
schodzi do jednego wiersza. To jedyne miejsce, gdzie liczba z briefu (52 px) nie wychodzi
bez skracania treści, których brief zabrania ruszać.

## T. Testy i pakiet

Wyniki i testy negatywne w `RELEASE_CHECK.md`, sekcja „1.4.0, addendum 2".
`static/_probe/` usunięty przed budową pakietu.

## V. Jeden numer na punkt w trybie eksperckim

`static/ities/ui/chart.js`: w pętli punktów 1 do 4 tabliczka z numerem nie jest rysowana,
gdy `this.expert` jest prawdą, bo ten sam numer nosi uchwyt DOM `.pt-handle`. Kropka
punktu zostaje. Liczba narysowanych tabliczek ląduje w `host.dataset.pointPlates`, co
czyni tę regułę sprawdzalną spoza canvasa. PeakWise nie ma ani tabliczek, ani uchwytów,
więc nie było tam czego poprawiać.

## W. Ostrzeżenie przy słabych punktach ręcznych

`analyze(manual=...)` wstawia punkty przez `nearest_on_branch`, które zwraca
`prom: None`, więc miejsce bez piku wygląda w wyniku dokładnie jak pik. Pomiar dokłada
`attach_point_prominence` w `static/ities/algo_stub.js` (kod aplikacji, nie algorytmu):
na tej samej wygładzonej gałęzi co detektor szuka `find_peaks(y, prominence=0)` i bierze
najsilniejszy pik w promieniu 20 mV od wskazanego potencjału. Wynik trafia do osobnego
klucza `manual_prominence`, żadne pole werdyktu nie jest ruszane, a auto pozostaje
bajt w bajt (parytet 0 różnic po zmianie).

Na pliku `4.74_1400ul_TPrA(1).txt` (auto: WZORZEC BEZ ANALITU): punkt 3 przy 0,218 V ma
1,88 µA, punkt 4 przy 0,281 V ma 0,00 µA przy progu 0,15 µA. Kolumna „Prom. (µA)" jest w
panelu Piki, punkt poniżej progu dostaje bursztynową etykietę „poniżej progu piku" z
dymkiem, dwuczłonowa linia werdyktu dostaje dopisek „(punkt 4 poniżej progu piku)", a
tabela sesji i raport PDF jedno zdanie. Zapis korekty nadal możliwy: przed zapisem
pokazuje się dialog z tym samym zdaniem i przyciskiem „Zapisz mimo to".

Liczba z briefu (0,006 µA) i zmierzona (0,0025 µA, wyświetlane 0,00) różnią się, bo to
inna definicja pomiaru; obie są kilkadziesiąt razy poniżej progu i obie dają tę samą
decyzję. Podana jest zmierzona.

## X. Zaznaczenie w liście idzie za treścią

`selectFile` otwiera folder pliku, zdejmuje jego próbkę z `closedSamples`, renderuje i
przewija wiersz przez `scrollIntoView({ block: "nearest" })`. Klasa `is-selected` jest
teraz i na `.file-row`, i na `.file-item`, żeby dało się ją znaleźć z zewnątrz. Dotyczy
kliknięcia w liście, strzałek, wyboru z tabeli i przycisku „Następny do oceny".

## Y. Nagłówek paska bocznego

Ikona 44 px w swoim rozmiarze pikselowym (bez skalowania w górę), zaokrąglenie 22 %,
nazwa 15 px waga 600, podpis w jednej linii z `text-overflow: ellipsis` i dymkiem z
pełnym zdaniem. Klucz `app.tagline` skrócony do „Analiza pomiarów elektrochemicznych"
(EN „Electrochemical measurement analysis"), pełne zdanie w nowym `app.taglineFull`.
Nagłówek ma `min-height: 56 px` i wyrównanie do środka.

## Z. Logotypy w stopce

Rząd 28 px, odstęp 20 px, `object-fit: contain`, `max-width: 140 px`, skala szarości z
kolorem po najechaniu. Wysokości optyczne dobrane do plików i zapisane w komentarzu w
`static/shared/ui.css`: UŁ 32 px (szeroki biały margines w pliku), AIrON 30 px (podpis
pod znakiem), AHE 26 px (ciasny kadr). Teksty stopki 13 px, wyrównane do środka w pionie.
W ciemnym motywie jasne podłoże pod rzędem zostaje.

## AA. Powrót do aplikacji i rok w stopce

Nowy moduł `static/shared/backlink.js`: `mountBackLink(host, { fallback })` czyta
`document.referrer`, przyjmuje go tylko z tego samego origin i tylko gdy prowadzi do
`/ities/` albo `/peakwise/`, inaczej bierze zapasową ścieżkę strony. Przycisk „← Wróć do
ITIES Detect" (strzałka SVG plus tekst, EN i PL przez `common.backTo`) stoi u góry po
lewej na `versions.html` obu aplikacji, a na hubie pojawia się tylko wtedy, gdy ktoś
przyszedł z aplikacji. Link „Historia wersji" w stopce dostał dymek „Otwiera stronę
wersji; Twoje pliki zostają w sesji". Rok w stopce huba, obu aplikacji i stron wersji
jest oddzielony pionową kreską z odstępem 12 px.

## BB. Wiele plików naraz

Osobny moduł `static/ities/ui/multi.js` i osobny stan `state.selectedIds` (Set) obok
`state.selectedId` (plik aktywny), więc ścieżka jednoplikowa w `result.js` nie zmieniła
się ani o linię. Cmd lub Ctrl plus klik dodaje i zdejmuje, Shift plus klik bierze zakres
z widocznej listy, zwykły klik zaznacza jeden. Menu kontekstowe próbki ma „Zaznacz
wszystkie pliki próbki". Zaznaczone wiersze mają `aria-selected`. Przy wielu plikach
treść to kompaktowe karty w kolejności listy (nazwa, werdykt, zdanie z ΔE_s, wykres
280 px, panel Piki zwinięty) plus nagłówek „3 pliki zaznaczone" i „Wyczyść zaznaczenie".
Przycisk „Porównaj na jednym wykresie" rysuje jeden wykres: skan w przód linią ciągłą,
wstecz przerywaną, kolory z palety sześciu barw Okabe i Ito, legenda z nazwą i werdyktem,
punkty 1 do 4 tylko dla pliku aktywnego. Tryb ekspercki przy wielu plikach pokazuje
zdanie „Korekta ręczna działa na jednym pliku. Zaznacz jeden." i nie rysuje uchwytów.
Eksport ma pozycje „Zaznaczone pliki (n)" dla PDF i CSV. Strzałki góra i dół przesuwają
plik aktywny w obrębie zaznaczenia. Zaznaczenie nie jest zapisywane w sesji.

## Poprawka układu znaleziona przy robieniu zrzutów

Stopka była poza ekranem przy 1440 x 900, gdy treść była wysoka: `.app` był elementem
flex o niedefiniowanej wysokości, więc jego jedyny wiersz siatki rósł do wysokości ekranu
wyniku i spychał stopkę pod zgięcie. Teraz `body.app-body` i `.app` mają wysokość 100vh,
`.app` ma `grid-template-rows: minmax(0, 1fr)`, przewija się tylko `#content`, a przy
szerokości do 1023 px i przy druku wraca dawne zachowanie (przewijanie całej strony).
Przy 390 px stopka wychodziła poza ekran w poziomie (lewa grupa 551 px, prawa 721 px bez
zawijania); obie grupy dostały `flex-wrap: wrap` i `max-width: 100%`. Po poprawce
`scrollWidth` = 375 px przy `innerWidth` = 390 px, czyli zero przewijania w poziomie.
To była wada obecna przed tą rundą, nie regresja z niej.

## Zmienione pliki (addendum 2)

```
static/ities/index.html          pasek 7 kontrolek, menu Sesja z czyszczeniem, stopka, eksport zaznaczonych
static/ities/app.js              podsumowanie listy, zaznaczanie wielu plików, widok wielu kart, ujawnianie wyboru, dialog przy słabym punkcie
static/ities/algo_stub.js        attach_point_prominence dla punktów ręcznych
static/ities/styles.css          powłoka 100vh, pasek, podsumowanie, nagłówek paska bocznego, stopka, karty wielu plików
static/ities/ui/sidebar.js       nagłówek 56 px, podsumowanie z filtrami, modyfikatory klikania, aria-selected
static/ities/ui/multi.js         NOWY: karty wielu plików i wykres porównawczy
static/ities/ui/chart.js         brak tabliczek numerów w trybie eksperckim, seriesData i fixedHeight na eksport
static/ities/ui/result.js        kolumna Prom. (µA), etykieta poniżej progu, dopisek przy werdykcie
static/ities/ui/format.js        pointProminenceUa, belowThresholdPoints, belowThresholdSentence
static/ities/ui/table.js         zdanie o punkcie poniżej progu w kolumnie trybu
static/ities/ui/session.js       to samo zdanie w raporcie PDF
static/ities/versions.html       przycisk powrotu do aplikacji
static/index.html                przycisk powrotu (tylko z aplikacji), rok za kreską
static/peakwise/index.html       rok za kreską w stopce
static/peakwise/versions.html    przycisk powrotu, rok za kreską
static/peakwise/ui/i18n.js       klucze common.year i common.backTo
static/shared/backlink.js        NOWY: powrót do aplikacji
static/shared/i18n.js            klucze podsumowania, prominencji, wielu plików, powrotu, skrócony app.tagline, changelog 1.4.0
static/shared/partners.js        klasa per logotyp, rząd 28 px
static/shared/ui.css             logotypy, przycisk powrotu, separator roku, pasek huba
tools/ui_smoke.mjs               kroki v, w, x, y, z, v2, w2, x2, bb, port testowy, czyszczenie z menu
tools/screenshots.mjs            nowe zrzuty, port testowy, poprawione emulowanie telefonu
tools/test_server_boot.mjs       ITIES_TEST_PORT, odmowa uruchomienia na 20412
```

## Czego nie zrobiono i dlaczego

1. **Stopka nie ma 52 px przy 1440 px, tylko 80 px w dwóch wierszach.** Lewa strona
   (551 px) i prawa (890 px) nie mieszczą się w 1140 px obok paska bocznego, a brief
   zabrania skracać lewą stronę i wylicza wszystko, co ma stać po prawej.
2. **Test „x2" nie dowodzi samego przewinięcia listy**, tylko tego, że wiersz jest w
   widocznym obszarze paska po skoku. Przy 24 plikach lista mieści się bez przewijania.
3. **`tools/params_override_test.mjs` nie był uruchamiany w tej rundzie.** Trwa około
   370 s, a ścieżka parametrów własnych nie była ruszana; ostatni wynik z 1.4.0 zostaje
   w mocy.
4. **`tools/screenshots_peakwise.mjs` nie był uruchamiany**, bo oczekuje serwera na
   porcie 20412, którego nie wolno dotykać. PeakWise sprawdzony dwoma nowymi zrzutami z
   `screenshots.mjs` na porcie testowym.
5. **Liczba prominencji dla punktu 4 to 0,0025 µA, nie 0,006 µA z briefu.** Inna
   definicja pomiaru, ta sama decyzja.

## Pakiet 1.4.0 z addendum 2 (17.09.2026, 21:55)

- plik: `deploy/analizatory_bundle.tar.gz`
- wpisy: **90**
- rozmiar: **775 038 bajtów** (0,74 MiB)
- SHA-256: `e7cf7cbbb5fabf403fecb799c0227e661052351efef1580798c73b6db3cb7a33`
- stempel treści (`tools/stamp_versions.py`): **c5a3474d7e**, 99 odwołań przepisanych
- `tar -tzf`: zero wpisów `_probe`, zero `server/auth.local.json`
- `static/_probe/` (pliki laboratoryjne odbierającego) usunięty przed budową

Paczka zbudowana po dopisaniu sekcji do `RELEASE_CHECK.md`, bo ten plik jedzie w środku.
Suma jest tutaj, a nie w `RELEASE_CHECK.md`, żeby plik nie podawał własnej sumy.
Odmowa przy obecnym `auth.local.json` była sprawdzona w 1.4.0; mechanizm wykluczenia w
`tools/build_deploy_bundle.sh` nie był w tej rundzie ruszany, więc testu nie powtarzano.

## Poprawki po odbiorze zrzutów (17.09.2026, 22:20)

1. **Wiersze zapisanych sesji w menu Sesja.** Menu ma teraz stałe 340 px i rozwija się
   od lewej krawędzi przycisku (`left: 0`), bo przy przycisku po lewej stronie paska
   wersja z `right: 0` wychodziła poza obszar treści. Wiersz sesji: kropka przy sesji
   bieżącej, nazwa w jednej linii z `text-overflow: ellipsis` i `max-width: 200 px`,
   pod nią meta „3 pliki · 144,5 KB · 17.09, 22:16" w 12 px, po prawej trzy akcje
   ikonowe (Otwórz, Zmień nazwę, Usuń) z dymkami zamiast tekstu. Dwa błędy złapane przy
   okazji: reguła `.menu-list button { width: 100% }` rozciągała ikony na całą szerokość
   (stąd poziome przewijanie o 96 px, teraz swoistość `.session-row-actions
   .session-action`), a bazowa `button { height: 32 px }` obcinała drugą linię wiersza
   (teraz `height: auto` i `min-height: 42 px`). Nowe klucze `session.open` i
   `session.current` w EN i PL.
2. **Logotyp UŁ po podmianie pliku** (940x330, bez pustych marginesów): pudełka to
   UŁ 26 px, AHE 26 px, AIrON 22 px (wcześniej 32, 26, 30), komentarz w
   `static/shared/ui.css` zaktualizowany razem z pomiarami i granicą dopasowania.
   `static/shared/partners.js` ma nowe wymiary własne pliku (940x330), żeby proporcja
   liczona do atrybutu `width` była prawdziwa.
3. **Skrypt pakietu wyklucza teraz także kopie paczki** (`deploy/analizatory_bundle*.tar.gz`).
   W `deploy/` pojawiły się pliki „analizatory_bundle 2.tar.gz" i „analizatory_bundle
   3.tar.gz" (kopie robione poza tą sesją, prawdopodobnie przez synchronizację), przez
   co pierwsza próba spakowania miała 92 wpisy i 2,25 MiB. Kopii nie kasuję, bo nie są
   moje; wykluczenie załatwia sprawę po stronie paczki.

### Testy po poprawkach

- `tools/i18n_check.mjs`: 380 kluczy użytych, 482 EN, 482 PL, 0 braków, 24 pliki
- `tools/ui_smoke.mjs`: **36 z 36**, 74,82 s, 0 błędów konsoli, na 20413 nic nie zostało
- `tools/screenshots.mjs`: 40 zrzutów, 0 błędów konsoli, `scrollWidth` 375 px przy 390 px
- test negatywny nowego kroku `cc`: po zdjęciu swoistości reguły ikon przewijanie
  poziome listy 168 px i `FAIL cc`, 35 z 36; po przywróceniu znowu 36 z 36

### Pakiet po poprawkach

- wpisy: **90** (75 plików i 15 katalogów), zero kopii paczki w środku
- rozmiar: **787 119 bajtów** (0,75 MiB)
- SHA-256: `a329f08e000b615ca3fdb796b47c1ecd2d4be80be6ee80f25ce8d98302e23721`
- stempel treści: **f299c3b28f**
- `tar -tzf`: zero `_probe`, zero `server/auth.local.json`, zero `*.tar.gz` w środku

---

## PeakWise 1.1 (17.09.2026, agent równoległy)

Cel: PeakWise ma wyglądać i zachowywać się jak ITIES Detect 1.4. Algorytm nietknięty,
statusy i słownik zostają własne PeakWise (para pików, jedna gałąź, brak piku, nie do
odczytu), żadnych werdyktów ITIES.

Co zrobione:

- `static/peakwise/index.html` przepisany na ramę 1.4: pasek narzędzi (Lista i dom,
  Sesja ▾, Przelicz ponownie, wybór wersji algorytmu z ⓘ, Pliki/Tabela, język i motyw
  jako trzy ikony, Eksport ▾), belka stanu 36 px, stopka `status-bar` 52 px ze stanem
  silnika, operatorem, logotypami partnerów, historią wersji i wylogowaniem, okno
  postępu, okno potwierdzenia. `meta robots noindex` zachowane.
- `static/peakwise/styles.css` przebudowany: bloki powłoki (sidebar, nagłówek 64 px,
  lista filtrów, pasek narzędzi, menu, belka stanu, stopka, dialogi, siatki RWD)
  przeniesione jeden do jednego z `static/ities/styles.css`; sekcja „PeakWise own”
  trzyma kartę wyniku, wykres i tabelę bez zmian.
- `static/peakwise/ui/sidebar.js`: nagłówek 64 px z ikoną 48 px (srcset 256/512),
  przełącznikiem aplikacji i podpisem w jednej linii, sekcja FILTRY jako lista źródeł z
  licznikami, sekcja PLIKI z grupowaniem po elektrodzie, strefa upuszczania na dole.
  Zmiana nazwy elektrody dzieje się w polu na liście, `window.prompt` usunięty.
- `static/peakwise/ui/format.js`: `BUCKETS`, `bucketOf`, `bucketCounts`; jedno źródło
  liczb dla belki stanu i listy filtrów. Stary filtr `incomplete` nadal rozumiany, żeby
  sesja zapisana przez 1.0 otwierała się na swoim filtrze.
- `static/peakwise/ui/logopreview.js` (nowy): podgląd znaku po kliknięciu. Własny, bo
  `static/shared/logopreview.js` wskazuje plik ITIES i słownik ITIES.
- `static/peakwise/app.js`: menu Sesja (nazwa, nowa, zapis i odczyt z pliku, czyszczenie
  przez własne okno potwierdzenia, bez `window.confirm`), belka z pastylkami statusów
  spięta z filtrem paska bocznego, stopka ze stanem silnika i godziną zapisu, okno
  postępu z procentem, ⓘ przy wersji algorytmu, język i motyw przez
  `createSegmented` z `static/shared/prefs.js`. `APP_VERSION` 1.1.0.
- `static/peakwise/ui/i18n.js`: komplet nowych kluczy EN i PL. `ui/app_version.js`:
  wpis 1.1.0 w changelogu, widoczny na `versions.html`.
- `tools/ui_smoke_peakwise.mjs` (nowy): mini smoke na porcie 20414, PASS/FAIL na krok,
  kod 1 przy FAIL, `PW_SMOKE_BREAK` psuje wskazany krok na dowód, że test umie zawieść.
- `tools/screenshots_peakwise.mjs`: przy ustawionym `ITIES_TEST_PORT` uruchamia własny
  serwer i loguje się sam, więc nie potrzebuje serwera właściciela na 20412.

Testy 17.09.2026:

- `tools/parity_test_peakwise.mjs`: 188 plików, twardych różnic 0, remisów 1 (ten sam co
  16.09), test negatywny 156/188, `gate=PASS`, `RELEASE_CHECK_PEAKWISE.md` przepisany.
- `tools/ui_smoke_peakwise.mjs`: 8 z 8 kroków PASS, kod 0. Z `PW_SMOKE_BREAK` kod 1.
- `tools/screenshots_peakwise.mjs`: 9 zrzutów (desktop 1440, mobile 390, jasny i
  ciemny), zero błędów konsoli poza `404 /favicon.ico` ze strony logowania.

Świadomie pominięte:

- Tryb ekspercki: PeakWise go nie ma, więc slot w pasku narzędzi zostaje pusty.
- Lista zapisanych sesji w menu Sesja: PeakWise trzyma jedną sesję w IndexedDB, więc
  menu ma nazwę, nową sesję, zapis i odczyt z pliku oraz czyszczenie, bez listy.
- Parametry analizy i eksport PDF z zakresami: to sterowanie algorytmem ITIES, PeakWise
  nie ma odpowiednika.

Do sprawdzenia przez właściciela: na zrzucie ciemnym liczba przy słowie „plików” w belce
stanu nie jest widoczna, choć liczniki pastylek są. Reguła CSS jest ta sama co w ITIES,
przyczyny nie ustaliłem w czasie tej sesji.
