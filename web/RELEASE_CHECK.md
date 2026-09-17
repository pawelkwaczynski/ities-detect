# RELEASE_CHECK

Parity test of the frozen algorithm in Pyodide (Node) against the CPython baseline.

## Environment

- date: 2026-09-17T19:32:33.998Z
- pyodide: 314.0.7
- python (wasm): 3.14.2
- numpy 2.4.6, scipy 1.18.0, pandas 3.0.2
- algo 1.1  sha256 c0e29b1e799c8fba75a4375cc57ee644866bce96af97df941c79cce5ed118361
- files on disk: 485
- baseline rows: 485
- load pyodide: 0.84 s
- load packages: 0.86 s
- analyze wall: 58.91 s
- rss end: 846.7 MB

## Gate: 0 differences on status, delta_Es, Ip_analyte_fwd_uA (tol 1e-9)

- compared: 485
- differences: **0**
- missing on disk: 0
- missing in baseline: 0

PASS: Pyodide matches CPython on all compared files.

## Negative test (AMPHETAMINE_TARGET_DELTA_V = 0.356 in memory)

- files re-analysed: 200
- differences vs baseline: **27**
- wall: 21.95 s
PASS: the parity test reports differences when the threshold is wrong. The test can fail.

## Verdict

RELEASE GATE PASS

---

# 1.4.0, addendum 2 (17.09.2026, 21:50)

Sekcja dopisana po przebiegu testu parytetu. `tools/parity_test.mjs` nadpisuje ten plik
od góry, więc poprzedni zapis sekcji 1.4.0 przepadł przy tym przebiegu; jego kopia jest
w `BUILD_REPORT.md`, sekcja 1.4.0.

Serwer testowy stoi na **porcie 20413** (`ITIES_TEST_PORT`, domyślna wartość w
`tools/test_server_boot.mjs`, które odmawia startu na 20412). Port 20412 nie był
dotykany: żadnego `pkill` po wzorcu, kontrola sierot tylko przez
`lsof -nP -iTCP:20413`. Testy puszczane pojedynczo przez `nice -n 10`, z tymczasowym
plikiem logowania i hasłem losowanym w teście.

| test | wynik | liczby |
|---|---|---|
| a. `tools/i18n_check.mjs` | PASS | 381 kluczy użytych, 480 EN, 480 PL, 0 braków, 24 pliki |
| b. `tools/test_server.py` | PASS | 23 kontrole: logowanie, limit prób, robots, nagłówek, logotypy, MIME, br |
| c. `tools/parity_test.mjs` | PASS | 485 plików, **0 różnic**, analiza 58,91 s, RSS 846,7 MB |
| d. `tools/ui_smoke.mjs` | PASS | **35 z 35** kroków, 73,86 s, 0 błędów konsoli, 0 procesów na 20413 |
| e. `tools/screenshots.mjs` | PASS | 40 zrzutów, 0 błędów konsoli, brak procesu po przebiegu |
| f. `detect.mjs --json static/` | 1 znalezisko | `layout-transition` w `static/ities/styles.css:1460` |

Znalezisko z detektora jest to samo co w 1.4.0 i świadome: `transition: width 200ms` na
`.progress-fill` jest wprost wymagane przez brief 1.4 sekcja C.

Parytet powtórzony, bo zmienił się `static/ities/algo_stub.js` (nowa funkcja
`attach_point_prominence`, wywoływana wyłącznie dla wyniku ręcznego). Wyniki
automatyczne bez zmian: 0 różnic na 485 plikach.

## Nowe kroki UI smoke

```
v   pasek narzędzi: 7 kontrolek najwyższego poziomu (Lista | Sesja | Przelicz ponownie |
    Wersja algorytmu | Pliki, Tabela | Tryb ekspercki | Eksport), na 1440 px widocznych 6
    w jednym wierszu, wysokość 53 px; ukryta tu grupa „Lista plus dom"
w   w pasku nie ma słowa „wykryto" ani licznika plików, podsumowanie jest w #sidebar
x   klik członu „do oceny" filtruje listę do 1 pliku, drugi klik wraca do 3;
    Enter na członie „nie stwierdzono" (1) daje 1, czyli filtr działa z klawiatury
y   w stopce są przełączniki języka i motywu oraz 3 logotypy, w pasku ich nie ma
z   „Wyczyść sesję" jest w menu Sesja, aktywne przy plikach, po użyciu 0 plików
v2  tryb automatyczny: 4 tabliczki z numerami, 0 uchwytów; tryb ekspercki: 0 tabliczek,
    4 uchwyty, czyli numer punktu pokazuje się raz
w2  4.74_1400ul_TPrA(1).txt, wskazania 0,218 V i 0,281 V: punkt 3 ma 1,88 µA bez etykiety,
    punkt 4 ma 0,00 µA z etykietą „poniżej progu piku", dopisek przy werdykcie obecny
x2  24 pliki, skok „Następny do oceny" z 6.6_500ul_TPrA(1).txt na
    Komercja_52_1_3 100uL_IM20uL(1).txt: ten sam plik w nagłówku treści i w liście,
    wiersz w widocznym obszarze paska bocznego
bb  Cmd i klik: 2 karty; Shift i klik: 3 karty w kolejności listy; „Porównaj na jednym
    wykresie": 1 wykres z 3 krzywymi w legendzie; tryb ekspercki przy 2 plikach: zdanie
    o jednym pliku i 0 uchwytów; „Wyczyść zaznaczenie" wraca do jednego pliku
```

## Testy negatywne, czyli dowód, że nowe kontrole potrafią oblać

Trzy przebiegi z celowo popsutym produktem (nie testem), po każdym przywrócenie i
kontrola `diff`.

| co popsuto | co oblało |
|---|---|
| „Wyczyść sesję" wyjęte z menu Sesja z powrotem do paska | `FAIL v` (9 kontrolek w 2 wierszach) i `FAIL z` (item w menu = false) |
| `<span class="file-count">24 pliki</span>` wstawiony do paska | `FAIL w` (licznik plików w pasku = true) |
| `#app-prefs` przeniesione z powrotem do paska | `FAIL y` (język i motyw w stopce = false, w pasku = true) |
| klik w aktywny człon podsumowania nie wraca do „wszystkie" | `FAIL x` (back to=1 z 3) |
| `is-selected` zdjęte z `.file-item` | `FAIL x2` (brak wiersza zaznaczonego w liście) |
| tabliczki numerów rysowane też w trybie eksperckim | `FAIL v2` (4 tabliczki i 4 uchwyty naraz) |
| prominencja punktu ręcznego zawsze 1,00 µA | `FAIL w2` (punkt 4 bez etykiety, brak dopisku przy werdykcie) |
| modyfikatory Cmd i Shift ignorowane w pasku bocznym | `FAIL bb` (0 kart, 0 wykresów porównawczych, 4 uchwyty przy 2 plikach) |

Po każdym przywróceniu komplet znowu 35 z 35.

## Pakiet 1.4.0 z addendum 2

`deploy/analizatory_bundle.tar.gz`: **90 wpisów**, poniżej 0,8 MiB, stempel treści
**c5a3474d7e**. Rozmiar w bajtach i pełna suma SHA-256 są w `BUILD_REPORT.md`, sekcja
„1.4.0, addendum 2", bo ten plik jedzie w paczce i nie może podawać własnej sumy.
`tar -tzf` nie zawiera ani jednego wpisu z `_probe`, ani `server/auth.local.json`.
`static/_probe/` (pliki laboratoryjne odbierającego) usunięty przed budową.
Sprawdzenie na miejscu: `shasum -a 256 deploy/analizatory_bundle.tar.gz`.

## Werdykt

RELEASE GATE PASS dla 1.4.0 z addendum 2. Parytet 0 różnic, algorytm nietknięty,
port 20412 nietknięty.

---

# 1.4.0, addendum 2, poprawki po odbiorze zrzutów (17.09.2026, 22:20)

Dwie poprawki z odbioru: wiersze zapisanych sesji w menu Sesja i wysokość logotypu UŁ po
podmianie pliku na przycięty (940x330).

| test | wynik | liczby |
|---|---|---|
| `tools/i18n_check.mjs` | PASS | 380 kluczy użytych, 482 EN, 482 PL, 0 braków, 24 pliki |
| `tools/ui_smoke.mjs` | PASS | **36 z 36** kroków, 74,82 s, 0 błędów konsoli, 0 procesów na 20413 |
| `tools/screenshots.mjs` | PASS | 40 zrzutów, 0 błędów konsoli, brak procesu po przebiegu |

Nowy krok smoke:

```
cc  menu Sesja 340 px, od x 324 do 664 (mieści się w treści), przewijanie poziome menu
    0 px i listy 0 px, nazwa sesji 200 x 19 px (jedna linia z wielokropkiem), 3 akcje
    ikonowe z dymkami, kropka przy sesji bieżącej, wiersz meta „3 pliki · 144,5 KB ·
    17.09, 22:16" w całości wewnątrz wiersza
```

Test negatywny: zdjęta podwyższona swoistość reguły `.session-row-actions
.session-action`, przez co `\.menu-list button { width: 100% }` znowu rozciąga ikony na
całą szerokość wiersza. Wynik `FAIL cc`, przewijanie poziome listy 168 px, 35 z 36.
Po przywróceniu znowu 36 z 36.

Przy okazji poprawione, bo widać to było na zrzucie: menu Sesja rozwijało się w lewo od
przycisku (`right: 0`) i przy przycisku po lewej stronie paska wychodziło poza obszar
treści; teraz ma `left: 0`. Wiersz sesji dostał `height: auto` i `min-height: 42 px`,
bo bazowa reguła `button { height: 32 px }` obcinała drugą linię z liczbami.

Logotypy: po przycięciu pliku UŁ wysokości pudełek to UŁ 26 px, AHE 26 px, AIrON 22 px
(wcześniej 32, 26, 30). Napis „UNIWERSYTET ŁÓDZKI" ma teraz zbliżoną wysokość optyczną
do „ahe" i „AIRON". Pomiary i granica tego dopasowania są w komentarzu w
`static/shared/ui.css`: wordmark UŁ zajmuje 18 % wysokości swojego pliku, a AIrON 55 %,
więc pełne zrównanie wymagałoby pudełka UŁ około 56 px i nie mieści się w rzędzie 28 px.

---

# 1.4.0, addendum 4 i 5 plus FF, GG, LL (17.09.2026, 23:30)

Belka stanu pod paskiem narzędzi, filtry jako lista źródeł w pasku bocznym, nagłówek
64 px, oś czasu projektu na stronie wersji, logo 1024 z podglądem i ikona CV na
stronie logowania. Testy na porcie 20413, port 20412 nietknięty.

| test | wynik | liczby |
|---|---|---|
| `tools/i18n_check.mjs` | PASS | 417 kluczy użytych, 517 EN, 517 PL, 0 braków, 25 plików |
| `tools/test_server.py` | PASS | 23 kontrole, w tym nowa: `/assets/cv_icon_256.png` i `/assets/cv_icon_512.png` 200 bez sesji |
| `tools/ui_smoke.mjs` | PASS | **40 z 40** kroków, 79,77 s, 0 błędów konsoli, 0 procesów na 20413 |
| `tools/screenshots.mjs` | PASS | 43 zrzuty, 0 błędów konsoli, przy 390 px scrollWidth 375 |

Nowe i przerobione kroki smoke:

```
w   belka stanu 36 px pod paskiem (0 px odstępu), 4 pastylki plus licznik „3 pliki",
    poza header.toolbar i poza main, w pasku narzędzi zero liczników
x   pastylka „do oceny" filtruje listę do 1 pliku i zaznacza wiersz „Do oceny" w pasku
    bocznym; wiersz „Nie do oceny" w pasku bocznym podświetla pastylkę „nie do oceny";
    drugi klik wraca do 3; Enter na pastylce działa
ii  lista filtrów: 5 wierszy (Wszystkie, Wykryto, Do oceny, Nie stwierdzono, Nie do
    oceny) z licznikami 3/0/1/1/1, role=listbox, 0 obciętych etykiet, sekcje FILTRY i
    PLIKI, nagłówek 64 px z ikoną 48x48 w całości wewnątrz nagłówka, zero obcięcia,
    kontrolki segmentowej nie ma w DOM
gg  klik w logo otwiera podgląd 512 px z pliku 1024 px, podpis w dwóch elementach z
    odstępem 6 px, karta wyśrodkowana; klik i Escape zamykają
hh  klik w ikonę kafelka huba prowadzi na /ities/, nie otwiera podglądu, dymek
    „Otwórz ITIES Detect"
ff  strona wersji zaczyna się osią czasu: 10 wpisów od „12-15.01.2025" do „17.09.2026",
    nad tabelami, z przyciskiem powrotu
```

Test negatywny nowej kontroli serwera: po wyjęciu `/assets/cv_icon_512.png` z listy
publicznej `FAIL server: /assets/cv_icon_512.png without a session: 302`. Po
przywróceniu znowu komplet.
