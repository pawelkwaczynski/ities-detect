# ITIES Detect Web + hub „Analizatory CV" — specyfikacja budowy (16.09.2026)

Właściciel: Paweł Kwaczyński. Odbiór: parity test + przegląd wizualny.
Kontekst produktu: `PRODUCT.md` (ten katalog).

## 0. Decyzje nieodwołalne
1. **Liczy przeglądarka, nie serwer.** Pyodide (Python w WebAssembly) w Web Workerze ładuje plik `algo/ities_algo_v1.1.py`
   BEZ ŻADNEJ ZMIANY w treści algorytmu i wywołuje `analyze(nazwa, bajty)` oraz `analyze(nazwa, bajty, manual={...})`.
   Zakaz przepisywania algorytmu na JavaScript. Zakaz „poprawiania" algorytmu w aplikacji.
2. **Jedno źródło prawdy:** katalog `algo/` (pliki wersji + `versions.json`). Aplikacja pokazuje wersję i jej SHA-256
   przy każdym wyniku i w każdym raporcie.
3. **Serwer = statyczny host + manifest.** Flask + gunicorn (1 worker, 2 wątki) serwuje `static/` i `/api/versions`,
   wspiera wstępnie skompresowane `.br`/`.gz` i poprawny MIME dla `.wasm`. Zero bazy danych w v1. Cel: < 60 MB RSS.
4. **Dane nie muszą opuszczać komputera.** Pliki i sesje żyją w przeglądarce (pamięć + IndexedDB), eksport CSV/PDF lokalnie.
5. **Test parytetu jest bramką wydania:** `tools/parity_test.mjs` uruchamia w Pyodide (Node) wszystkie 485 plików z
   `../07_etykiety_lab_20260916/{Pozytywne,Negatywy,Neutrale}` i porównuje z `../wyniki_analizy/eval_etykiety_20260916_baseline.csv`
   (kolumny status, delta_Es, Ip_analyte_fwd_uA; tolerancja 1e-9). Wynik zapisuje do `RELEASE_CHECK.md`. 0 różnic albo brak wydania.
6. **Język UI: polski. Kod, nazwy, komentarze: angielski.** Bez długich myślników w tekstach UI (przecinek albo kropka).
7. **Bez frameworków i bez kroku budowania.** Vanilla HTML/CSS/JS (ES modules). Jedyne biblioteki: Pyodide (self-hosted
   w `static/pyodide/` + fallback CDN jsdelivr) i uPlot (lokalna kopia, ~40 KB) do wykresu. Nic z CDN w runtime poza fallbackiem.

## 1. Struktura repo (`09_aplikacja_web_20260916/`)
```
PRODUCT.md  SPEC_APLIKACJI.md  RELEASE_CHECK.md  README.md
algo/ities_algo_v1.0.py  algo/ities_algo_v1.1.py  algo/versions.json     # frozen, do not edit
assets/ities_logo_B.png  assets/ities_logo_A.jpg
server/app.py  server/wsgi.py  server/requirements.txt  server/start.sh  server/deploy_frog.md
static/index.html                  # HUB: dwa kafelki
static/ities/index.html            # aplikacja ITIES Detect
static/ities/app.js  static/ities/worker.js  static/ities/ui/*.js  static/ities/styles.css
static/ities/versions.html         # historia wersji algorytmu i aplikacji
static/shared/tokens.css  static/shared/ui.css   # tokeny i komponenty wspólne dla huba i aplikacji
static/vendor/uplot/  static/pyodide/            # self-hosted (skrypt pobierający, nie commitować binariów do repo publicznego)
tools/fetch_pyodide.sh  tools/parity_test.mjs  tools/make_versions_json.py
```
`algo/versions.json`: `[{"version":"1.1","date":"2026-09-16","file":"ities_algo_v1.1.py","sha256":"<pełny>","default":true,
"changelog":["LOD/LOQ z aktywnej kalibracji + ostrzeżenie below_lod","diagnostyka wyboru pary (n_par_sanity, second_best_error_mV)"],
"measured":{"positives_detected":"121/293","false_positives_negatives":"0/147","false_positives_neutrals":"0/45","date":"2026-09-16"}}, {"version":"1.0", ...}]`.
Generowane przez `tools/make_versions_json.py` z nagłówków plików `algo/*.py` (pola ALGO_VERSION, ALGO_CELL_SHA256) i sha256 pliku.

## 2. Hub (`static/index.html`), tryb Operate, jedna strona
- Tytuł strony: „Analizatory CV". Nagłówek jednym zdaniem: „Narzędzia laboratorium do analizy woltamperometrii cyklicznej."
- Dwa kafelki obok siebie (na telefonie jeden pod drugim), rozmiar ikony 128 px, zaokrąglenie 22 % (jak ikony macOS),
  cień miękki, nazwa pod ikoną, jedno zdanie opisu, mała plakietka wersji:
  1. **ITIES Detect** (ikona: `assets/ities_logo_B.png` przycięta do kwadratu): „Detekcja amfetaminy z krzywych CV (ITIES)." → `/ities/`
  2. **PeakWise** (stała `HUB_TILE_2_NAME` w jednym miejscu, łatwa zmiana na „V-Peak"): ikona TYPOGRAFICZNA placeholder
     (kwadrat w kolorze akcentu z literami „PW" albo symbolem piku ∧ narysowanym w SVG), opis: „Piki anodowe i katodowe elektrod drukowanych 3D."
     Link nieaktywny z plakietką „wkrótce". Bez wymyślonych funkcji.
- Stopka: „Historia wersji" (→ `/ities/versions.html`), rok, nic więcej. Zero tekstu marketingowego, zero deklaracji typu „certyfikowane".

## 3. Aplikacja ITIES Detect (`static/ities/`), tryb Operate
### 3.1 Układ (macOS-podobny, bez udawania okna: żadnych sztucznych „świateł" okna)
- Trzy strefy: **pasek boczny** (lista plików/próbek), **pasek narzędzi** u góry treści, **treść**. Na szerokości < 900 px pasek boczny
  chowa się w panel wysuwany.
- Pasek narzędzi: przycisk „Dodaj pliki" (i strefa upuszczania na całej treści), „Analizuj wszystko", segment „Wersja algorytmu: 1.1 (domyślna) ▾",
  przełącznik „Tryb ekspercki", menu „Eksport ▾" (CSV sesji, Raport PDF przez druk), wskaźnik stanu silnika („Silnik gotowy" / pasek ładowania z etapami: pobieranie Pyodide, pakiety, algorytm).
- Pasek boczny: pliki pogrupowane po próbce (ID wyciągane z nazwy pliku regułą: obetnij `(N)`, `.txt`, końcówki `_TPrA`, `TRrACl_20uL`, objętości `\d+ ?ul`; ID edytowalne kliknięciem),
  przy każdym pliku chip werdyktu (kolor + słowo), przy próbce zwinięta suma „2 z 3 WYKRYTO". Filtry: wszystkie / do oceny / nie nadające się.
### 3.2 Treść, stan „wynik pliku" (to, co widać w 3 sekundy)
1. **Karta werdyktu** na górze: duże słowo werdyktu (patrz słownik 3.5), pod nim JEDNO zdanie uzasadnienia z liczbą, np. „ΔE_s = 0,351 V, 1 mV od wzorca 0,350 V",
   i JEDNO zdanie „co dalej". Obok: skala pozioma od −30 do +30 mV z zieloną strefą ±10, bursztynową do ±15 (wartości brane z załadowanego algorytmu:
   DETECTION_TOLERANCE_V, UNCERTAIN_TOLERANCE_V, nie z UI), znacznik odchyłki pliku. Dla statusów bez ΔE_s skala ukryta, w jej miejscu powód i naprawa.
2. **Wykres CV** (uPlot, wysokość ~360 px): forward `#64748B`, powrót `#7C9A86`, punkty 1 i 2 `#2563EB`, 3 i 4 `#DC2626` z etykietami 1–4,
   linie pionowe E5 i E6 (kreskowane), oś X „E / V (po kalibracji TPrA)" z możliwością przełączenia na surowe E, oś Y „I / µA".
   Przełącznik „Pokaż kandydatów" (puste kółka dla odrzuconych kandydatów, z `result['points']` i listy kandydatów, jeśli algorytm ją zwraca; jeśli nie, pominąć bez atrapy).
3. **Szczegóły** (rozwijane): Ip wzorca i analitu (µA, metoda: krzywa/styczne), stężenie i czystość z nazwą kalibracji i LOQ/LOD (z wyniku), shift, liczba cykli i użyty cykl,
   ostrzeżenia jako pełne zdania (z `warnings[].message`), SHA-256 pliku, wersja algorytmu + SHA, czas analizy, tryb (auto/ręczny).
### 3.3 Sesja i raport
- Widok tabeli (przełącznik w pasku narzędzi „Pliki / Tabela"): próbka, plik, status jakości, werdykt, ΔE_s, odchyłka mV, Ip analitu, wersja, tryb, ostrzeżenia (ikona z dymkiem).
  Sortowanie po kolumnach, filtry jak w pasku bocznym. Reguła agregacji per próbka wypisana JAWNIE nad tabelą: „Próbka = WYKRYTO, gdy co najmniej jeden plik WYKRYTO; inaczej DO OCENY, gdy co najmniej jeden DO OCENY; inaczej NIE STWIERDZONO, gdy co najmniej jeden pomiar był ważny; inaczej POMIARY NIE NADAJĄ SIĘ DO OCENY."
- Eksport CSV: dokładnie kolumny `result_row` z notebooka (pobrać z wyniku Pythona, nie wymyślać) + `file_sha256`, `algo_version`, `algo_sha256`, `analysed_at`, `mode`, `operator`.
- Raport PDF: arkusz stylów `@media print`; nagłówek: „ITIES Detect, raport sesji", data/godzina, operator (pole tekstowe w UI, opcjonalne), wersja i SHA algorytmu, progi
  (TPRA_TARGET_V, AMPHETAMINE_TARGET_DELTA_V, tolerancje, prominencja) odczytane z modułu; potem dla każdego pliku: nazwa, SHA-256, werdykt, zdanie uzasadnienia, wykres (render do PNG z canvasa uPlot), tabela punktów 1–4 (E surowe i po kalibracji, I), ostrzeżenia; tryb ręczny: wynik auto i ekspercki obok siebie.
  Ostatnia strona: zastrzeżenie: „NIE STWIERDZONO oznacza brak sygnału spełniającego kryterium w tym pomiarze, nie dowód nieobecności substancji. Czułość metody na danych laboratorium (16.09.2026): 121 z 293 plików pozytywnych; fałszywe wykrycia: 0 z 192 prób ślepych." Bez innych liczb.
### 3.4 Tryb ekspercki
- Na wykresie punkty 1–4 stają się przeciągalne; przyciąganie do gałęzi (1 i 3 na powrotnej, 2 i 4 na forward) przez ponowne wywołanie
  `analyze(nazwa, bajty, manual={"E1":..,"E2":..,"E3":..,"E4":..})` w workerze (algorytm sam robi `nearest_on_branch`). Wynik auto NIGDY nie znika: karta pokazuje dwa wiersze „Automatycznie" i „Ekspert (imię, godzina)".
- Pole „Powód korekty" (wymagane do zapisania). Przycisk „Zgłoś rozbieżność": pobiera JSON {plik (base64), sha256, wynik auto, wskazania eksperta, powód, wersja} jako przypadek walidacyjny.
### 3.5 Słownik statusów (jedyne dozwolone słowa w UI; kody techniczne tylko w „Szczegółach")
| status | słowo w UI | kolor | zdanie „co dalej" |
|---|---|---|---|
| detected | WYKRYTO | granat `--verdict-detected` | „Sygnał zgodny z kryterium amfetaminy. Pomiar przeszedł kontrolę jakości." |
| uncertain | DO OCENY EKSPERTA | bursztyn | „Sygnał w paśmie, które wymaga oka eksperta. Sprawdź wykres lub powtórz pomiar." |
| not_detected | NIE STWIERDZONO W TYM POMIARZE | szarozielony | „Nie znaleziono sygnału spełniającego kryterium. To nie jest dowód nieobecności substancji." |
| TPrA_ONLY | WZORZEC BEZ ANALITU | szary | „Wzorzec TPrA znaleziony, brak wiarygodnej pary analitu." |
| NO_VALID_ANALYTE_PAIR | PARA NIEPRAWIDŁOWA | szary | „Kandydaci istnieją, ale żadna para nie spełnia warunku E4 > E3." |
| MEASUREMENT_QUALITY_FAIL | POMIAR NIE NADAJE SIĘ DO OCENY | szary, ikona klucza | powód wg `internal_reason`: NO_TPRA_IN_WINDOWS → „Brak sygnału wzorca TPrA w oknie. Dodaj wzorzec i powtórz pomiar."; NO_CANDIDATES → „Brak pików na gałęziach."; NO_VALID_TPRA_PAIR → „Piki w oknie wzorca nie tworzą poprawnej pary." |
| too_few_points | PLIK NIEPEŁNY | szary | „Plik ma za mało punktów (artefakt zapisu). Sprawdź eksport z potencjostatu." |
| invalid | NIE ROZPOZNANO PLIKU | szary | „Nie rozpoznano kolumn E/I. Plik nie został zmieniony." |
Nigdy czerwieni alarmowej dla werdyktu; czerwień tylko dla punktów analitu na wykresie.

## 4. Świat wizualny (pinned przez właściciela: macOS-podobny, przyjazny)
- Font: stos systemowy `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`; liczby w tabelach `font-variant-numeric: tabular-nums`. Rozmiary: 13 px UI, 15 px treść, werdykt 28–34 px, waga 600.
- Tokeny w `static/shared/tokens.css` na `:root`, wersje ciemne pod `@media (prefers-color-scheme: dark)` z guardem `:root:not([data-theme="light"])` i pod `:root[data-theme="dark"]`; przełącznik motywu w stopce (system/jasny/ciemny).
- Powierzchnie: tło okna `#F5F5F7`/ciemne `#1C1C1E`; pasek boczny półprzezroczysty (`backdrop-filter: saturate(180%) blur(20px)` z fallbackiem pełnego koloru), karty białe/ciemnoszare z zaokrągleniem 12 px i cieniem 0 1px 2px + 0 8px 24px o niskiej alfie, separatory 1 px hairline.
- Kontrolki: segmented control, przyciski 28–32 px wysokości z zaokrągleniem 8 px, focus ring 2 px w kolorze akcentu (`#0A84FF`/`#007AFF`), stany hover/active/disabled zdefiniowane, każdy element klikalny ≥ 32 px.
- Kolory werdyktów: detected `#1E3A8A` (tekst na białym) / na ciemnym `#93C5FD`; uncertain `#B45309` / `#FCD34D`; not_detected `#3F6212` / `#BEF264`; quality `#6B7280` / `#9CA3AF`.
- Ruch: przejścia 150–200 ms ease-out na hover/rozwijaniu; brak animacji dekoracyjnych; `prefers-reduced-motion` respektowane.
- Dostępność: kontrast ≥ 4,5:1 dla tekstu, nawigacja klawiaturą po liście plików i tabeli, `aria-live` dla statusu silnika i wyników, etykiety formularzy, alt dla logo.
- Stany puste: przed dodaniem plików treść pokazuje strefę upuszczania z jednym zdaniem instrukcji i listą obsługiwanych formatów (TXT z NOVA; .nox nieobsługiwane, wyeksportuj do TXT). Stan błędu silnika: zdanie + przycisk „Spróbuj ponownie" + link do fallbacku CDN.

## 5. Silnik (worker.js)
- `loadPyodide({indexURL: '/pyodide/'})` z fallbackiem na `https://cdn.jsdelivr.net/pyodide/v<wersja>/full/` po błędzie; `loadPackage(['numpy','scipy','pandas'])`;
  źródło algorytmu pobrane z `/algo/<plik>`; przed `runPython` podmienić w STRINGU (nie w pliku) importy matplotlib na atrapy (jak w teście wykonalności), IPython już jest atrapą w pliku.
  Zweryfikować, że sha256 pobranego pliku = wpis w `versions.json` (obliczyć w JS przez `crypto.subtle`), inaczej odmówić analizy i pokazać błąd.
- Protokół wiadomości: `{type:'init', version}` → `{type:'ready', version, sha256, constants:{...}}`; `{type:'analyze', id, name, bytes, manual?}` → `{type:'result', id, result}` (JSON przez `json.dumps` z `default=str`, punkty i baseline_fits włącznie); `{type:'error', id, message}`.
- Kolejka analiz sekwencyjna w workerze; postęp `{type:'progress', done, total}`.
- Stałe do UI: TPRA_TARGET_V, AMPHETAMINE_TARGET_DELTA_V, DETECTION_TOLERANCE_V, UNCERTAIN_TOLERANCE_V, PEAK_PROMINENCE_A, KALIBRACJA_AKTYWNA, WEAK_PEAK_CANDIDATES (odczytane z modułu po wczytaniu).

## 6. Serwer (`server/`) i wdrożenie na Frog
- `app.py`: Flask; `/` → `static/index.html`; `/ities/` → `static/ities/index.html`; `/algo/<plik>` (z `Cache-Control: no-cache`); `/api/versions` (czyta `algo/versions.json`);
  statyki z obsługą `.br`/`.gz` (jeśli istnieje `plik.br` i klient akceptuje br, wysyłaj z `Content-Encoding: br`), MIME `application/wasm` dla `.wasm`, cache długi dla `/pyodide/` i `/vendor/`.
- `requirements.txt`: flask, gunicorn (tylko to). `start.sh`: watchdog jak w StudentSpot (pgrep gunicorn → start na 0.0.0.0:20412, log do `~/analizatory/app.log`).
- `deploy_frog.md`: kroki: (1) na Macu `tools/fetch_pyodide.sh` (pobiera z npm/jsdelivr do `static/pyodide/`, bez matplotlib, tylko potrzebne koła; potem `brotli`/`gzip -k` dla `.wasm`, `.whl`, `.js`, `.zip`); (2) rsync do `frog@frog01.mikr.us:~/analizatory/`; (3) `python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt`; (4) crontab: `@reboot` i `*/5 * * * *` → `start.sh`; (5) test `curl -s localhost:20412/api/versions`.
- Pamięć: gunicorn 1 worker 2 wątki, `--max-requests 200`; cel RSS < 60 MB. Zmierzyć lokalnie i wpisać do README.

## 7. Historia wersji (`versions.html`)
- Tabela z `versions.json`: wersja, data, SHA-256 (skrócony, pełny w tytule), zmiany (lista), zmierzone (czułość, fałszywe wykrycia z datą pomiaru), przycisk „Użyj tej wersji w sesji" (przeładowuje worker inną wersją; wyniki sesji policzone inną wersją dostają nową rewizję, stara zostaje w tabeli z oznaczeniem wersji).
- Sekcja „Wersje aplikacji" ręczna: `APP_VERSION` w `app.js` + lista zmian w `versions.html`.

## 8. Testy i odbiór
1. `tools/parity_test.mjs` (Node + pyodide z npm, `nice -n 10`): 485 plików, 0 różnic; czas; zapis do `RELEASE_CHECK.md`.
2. Test negatywny parytetu: podmień w pamięci `AMPHETAMINE_TARGET_DELTA_V` na 0.356 i pokaż, że parity test zgłasza różnice (test umie zawieść).
3. Serwer: `python -m pytest`-owy mini test albo skrypt: `/api/versions` zwraca JSON z domyślną wersją; `.wasm` ma poprawny MIME; `.br` serwowane z `Content-Encoding`.
4. Ręcznie: otwórz `static/ities/index.html` przez lokalny serwer, wrzuć 3 pliki referencyjne z `PRODUCT.md` (Evidence), sprawdź werdykty: 93P_300ul_TPra(1) → DO OCENY EKSPERTA z ΔE_s 0,3638; `BRB pH 7 CV 50uM codeine + 50uM TPrA.txt` → NIE STWIERDZONO (ΔE_s 0,3094); `132-1_blank(2).txt` → POMIAR NIE NADAJE SIĘ DO OCENY (brak wzorca).
5. Zrzuty ekranu desktop (1440×900) i mobile (390×844) dla huba, wyniku pliku, tabeli, trybu eksperckiego, historii wersji → `screenshots/`.
   Jeśli brak przeglądarki headless, opisać to wprost zamiast udawać.

## 9. Czego NIE robić
- Nie zmieniać niczego w `algo/*.py` ani w notebooku. Nie dodawać logowania, kont, bazy, analityki, cookies, zewnętrznych fontów, Google/CDN w runtime (poza fallbackiem Pyodide).
- Nie wymyślać liczb, certyfikatów, klientów, opinii. Nie pisać „policja" w UI (tylko w PRODUCT.md), UI jest dla laboratorium.
- Nie udawać okna macOS (żadnych sztucznych „świateł" ruchu, pasków tytułu z kółkami). Nie używać czerwieni alarmowej dla werdyktu.
- Nie commitować, nie publikować, nie wdrażać na serwer bez przeglądu właściciela.
