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
2. Automatyczny lint UI: `[]`.
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
4. Automatyczny lint UI: `[]`.
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
