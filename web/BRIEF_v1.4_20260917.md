# ITIES Detect 1.4.0: brief (17.09.2026, po południu)

Właściciel: Paweł Kwaczyński. Wykonawca: Codex (zamknięty pakiet, praca w tym katalogu). Odbiór: Claude (testy, Chrome), potem Paweł.
Obowiązuje `SPEC_APLIKACJI.md` (sekcje 0, 3.5, 4, 9), `BRIEF_v1.3_UX_20260917.md` i `BRIEF_v1.3_ADDENDUM_20260917.md`. Ten brief tylko DODAJE. Kod, nazwy, komentarze po angielsku; teksty UI w EN i PL w `static/shared/i18n.js`; zero długich myślników w tekstach i dokumentach (przecinek albo kropka).
Stan wejściowy: 1.3.0 wdrożona, testy zielone (`RELEASE_CHECK.md`, `BUILD_REPORT.md`). Kopia 1.3 przed zmianami zrób sam: `cp -R static ../_backup_static_1.3.0_$(date +%H%M)` przed pierwszą edycją.

## Zgłoszenia właściciela (17.09, 15:40)
1. „Trzeba w dymkach dać" opisy: co daje Tryb ekspercki, co robi Wykryj ponownie, co robi Przelicz ponownie.
2. „Fajnie jakby dało się zakładać swoje foldery i pokazywało ile miejsca, ile plików, także %."
3. „Jak się liczy na początku, popup jest na środku i pokazuje przesuwający się niebieski pasek postępu z licznikiem %."
4. „Login i hasło zanim się wejdzie w program, to samo na jeden i drugi program" (ITIES Detect i PeakWise).

## A. Dymki (tooltips) i objaśnienia
- Lekki komponent dymka bez bibliotek: pokazuje się po 300 ms najechania i od razu po fokusie klawiaturą, znika po zjechaniu/blur/Escape, `role="tooltip"` + `aria-describedby`, pozycja pod elementem, nie wychodzi poza viewport. Styl z tokenów (ciemne tło w jasnym motywie, jasne w ciemnym, 13 px, max 320 px szerokości, wiele linii dozwolone).
- Dymki obowiązkowe (teksty EN i PL, treść PL poniżej, EN równoważne):
  - Przełącznik „Tryb ekspercki": „Odblokowuje ręczną korektę wyniku: przeciąganie punktów 1 do 4 na wykresie, wpisywanie potencjału w panelu Piki, przyciski Dodaj parę analitu i Wskaż wzorzec ręcznie, sekcja Parametry analizy. Zapis korekty wymaga powodu, a wynik automatyczny zostaje obok wyniku eksperta."
  - „Wykryj ponownie" (panel Piki): „Tylko ten plik. Odkłada korektę eksperta do historii analizy i liczy plik od nowa automatycznie. Użyj, gdy chcesz wrócić do wyniku programu."
  - „Przelicz ponownie" (pasek narzędzi): „Cała lista. Liczy wszystkie pliki od nowa i pokazuje okno postępu. Potrzebne po zmianie wersji algorytmu albo parametrów analizy; po zwykłym wgraniu plików analiza rusza sama."
  - „Dodaj parę analitu": „Wskaż na wykresie minimum analitu na skanie wstecz (punkt 3), potem maksimum na skanie w przód (punkt 4). Program przyciąga do najbliższego punktu gałęzi i liczy ΔE_s z Twoich wskazań."
  - „Wskaż wzorzec ręcznie": analogicznie dla punktów 1 do 4.
  - „Parametry analizy" (nagłówek sekcji): „Wartości domyślne są zwalidowane 16.09.2026. Każda zmiana działa tylko w tej sesji i oznacza wyniki jako poza walidacją."
  - „Wyczyść sesję", „Eksport", „Importuj pomiary", „Dodaj folder", filtr paska bocznego, plakietki liczników w pasku narzędzi (klik = filtr), pole „Operator" („Imię wpisane tu trafia do zapisu korekt eksperta i do raportu PDF.").
- Obok przełącznika „Tryb ekspercki" mała ikona „i" (SVG, 16 px, nie emoji) otwierająca ten sam tekst jako popover klikalny (dla myszy bez najechania i dla ekranów dotykowych).
- Wszystkie teksty dymków przez `t("tip.…")`; `tools/i18n_check.mjs` ma je łapać.

## B. Własne foldery w pasku bocznym
- Przycisk „Nowy folder" w nagłówku listy (obok filtra). Nazwa wpisywana inline (jak zmiana ID próbki), unikalna w sesji, Enter zapisuje, Escape anuluje.
- Przenoszenie plików: (1) przeciągnięcie wiersza pliku albo całej próbki na nagłówek folderu (HTML5 drag and drop wewnątrz paska, wskaźnik upuszczenia na folderze), (2) w menu kontekstowym pliku/próbki „Przenieś do…" z listą folderów i „poza folder" (dla klawiatury i dotyku). Folder wgrany z dysku i folder własny to ten sam byt (`state.folders`), różnica tylko w pochodzeniu (`origin: "import" | "user"`).
- Zmiana nazwy folderu (ołówek jak przy próbce) i usunięcie folderu (pliki wracają poza folder, bez kasowania plików; dialog potwierdzenia jak przy czyszczeniu sesji).
- Wiersz statystyk pod nazwą folderu, zawsze widoczny: „12 plików · 0,9 MB · 7 WYKRYTO (58 %)". Procent = udział plików WYKRYTO wśród plików folderu z wynikiem; gdy nic nie policzone: „w kolejce". Rozmiar z `sizeBytes` (KB poniżej 1 MB, MB z jednym miejscem po przecinku, po polsku przecinek). Chipy werdyktów per folder zostają jak dziś.
- Wszystko zapisuje się w sesji (IndexedDB) i wraca po odświeżeniu. Eksport CSV dostaje kolumnę `folder`; raport PDF grupuje pliki folderami z nagłówkiem folderu i tym samym wierszem statystyk.

## C. Okno postępu na środku z paskiem i procentem
- Jedno okno (`#batch-progress`) wyśrodkowane (`position: fixed; inset: 0; margin: auto`), nie w rogu. Szerokość 560 px, na telefonie pełna szerokość minus 16 px.
- Pasek postępu: niebieski (`--accent`), wypełnienie płynne (`transition: width 200 ms`), a gdy postęp jest nieznany, animowany pasek przesuwający się w prawo (indeterminate), z `prefers-reduced-motion` bez animacji. Nad paskiem procent dużą cyfrą (tabular-nums), np. „37 %", obok „137 z 477".
- Faza startu silnika ma własne etapy z procentem szacowanym: Pyodide 0 do 60 % (indeterminate w trakcie pobierania, bo przeglądarka nie zna rozmiaru), pakiety numpy/scipy/pandas 60 do 90 % (po każdym pakiecie skok), algorytm 90 do 100 %. Etykieta etapu pod paskiem („Pobieranie Pyodide", „Pakiety numpy, scipy, pandas", „Algorytm 1.1"). Szacunek nazwać w podpisie „przybliżony" (nie udawać dokładności).
- Okno startowe pokazuje się przy wejściu na stronę, gdy silnik jeszcze nie jest gotowy, i zamyka się samo po gotowości (2,5 s, chyba że użytkownik je dotknął, jak dziś). Gdy silnik pada, okno zostaje z komunikatem i przyciskami „Spróbuj ponownie" / „Użyj CDN" (dziś są na ekranie treści, przenieść do okna).
- Liczniki werdyktów w oknie zostają; próg samozamykania i Przerwij bez zmian. Escape zamyka okno, analiza trwa.

## D. Logowanie (serwer, wspólne dla huba, ITIES Detect i PeakWise)
- Flask: strona `/login` (GET formularz, POST sprawdzenie), sesja w podpisanym ciasteczku (`SECRET_KEY` z `server/auth.local.json`), `/logout`. Chronione: `/`, `/ities/*`, `/peakwise/*`, `/algo/*`, `/api/*`, `/shared/*`, `/assets/*`, `/vendor/*`, `/pyodide/*`; wyjątki: `/login`, `/logout`, minimalny CSS/logo dla strony logowania (`/shared/tokens.css`, `/shared/ui.css`, `/assets/ities_icon_256.png`) i `/healthz` (200 bez treści, dla watchdoga).
- Dane logowania w `server/auth.local.json` (już istnieje lokalnie, w `.gitignore`, NIE czytać hasła z czatu, NIE wpisywać hasła w kod, testy ani dokumenty): `{"users": {"<login>": "<hash werkzeug>"}, "secret_key": "<hex>"}`. Sprawdzenie przez `werkzeug.security.check_password_hash`. Brak pliku = serwer odmawia startu z jasnym komunikatem w logu (nie „otwarty dla wszystkich").
- Strona logowania w stylu aplikacji (tokeny, karta 360 px na środku, logo, pola „Login" i „Hasło", przycisk „Wejdź", komunikat błędu pod formularzem „Zły login albo hasło", bez podpowiedzi, które z nich). PL/EN wg tego samego mechanizmu co reszta (`?lang` z ciasteczka lub Accept-Language, domyślnie PL na tej stronie). Bez linków „zapomniałem hasła" (nie ma takiej funkcji).
- Ochrona przed zgadywaniem: po 5 nieudanych próbach z jednego adresu 60 s przerwy (licznik w pamięci procesu, wystarczy przy 1 workerze). Log nieudanych prób do `app.log` bez hasła.
- Ciasteczko: `HttpOnly`, `SameSite=Lax`, `Secure` gdy `X-Forwarded-Proto: https` (za Cloudflare), ważność 12 h przesuwana przy aktywności.
- W stopce aplikacji i huba przycisk „Wyloguj". Worker i `fetch` w aplikacji działają bez zmian, bo ciasteczko idzie automatycznie do tego samego hosta.
- `tools/test_server.py` rozszerzyć: bez sesji `/ities/` → 302 na `/login`; złe hasło → 200 z błędem i brak ciasteczka; dobre → 302 na `/`; po 5 błędach → 429; `/healthz` → 200 bez logowania. Test używa własnego tymczasowego `auth.local.json` z hasłem testowym generowanym w teście, nie prawdziwego.
- `tools/ui_smoke.mjs`, `tools/screenshots.mjs`, `tools/parity_test.mjs` muszą nadal działać: smoke i screenshoty logują się przez POST `/login` w CDP (hasło testowe z tymczasowego pliku auth wskazywanego zmienną `ITIES_AUTH_FILE`), parytet nie dotyka serwera.
- `server/deploy_frog.md` i `deploy/start.sh`: `ITIES_AUTH_FILE=/home/frog/analizatory/server/auth.local.json`; instrukcja, że plik trzeba wgrać osobno (nie jest w pakiecie ani w repo); `tools/build_deploy_bundle.sh` wyklucza `server/auth.local.json` z tarballa.

## E. Drobiazgi
- Wersja 1.4.0: `APP_VERSION`, klucz `app.changelog.1_4_0` (EN i PL, po jednym zdaniu na A–D), wpis w `versions.html`. PeakWise: tylko logowanie i „Wyloguj" w stopce, reszta bez zmian.
- Dwuczłonowa linia werdyktu ręcznego (auto · ekspert): drugi człon w osobnym wierszu pod pierwszym, mniejszy (18 px), z etykietą „Ekspert (imię, godzina):" w kolorze tekstu drugorzędnego; pierwszy wiersz „Automatycznie:" zostaje w pełnym rozmiarze.

## F. Testy (Codex uruchamia po kolei przez `nice -n 10`, nigdy równolegle; liczby do `RELEASE_CHECK.md` sekcja 1.4.0)
1. `node tools/i18n_check.mjs`: 0 braków (w tym klucze `tip.*` i strony logowania).
2. `python3 tools/test_server.py`: przypadki z D.
3. `node tools/parity_test.mjs`: 485 plików, 0 różnic.
4. `node tools/ui_smoke.mjs` z nowymi krokami: (l) dymek przełącznika eksperta pojawia się po fokusie i zawiera „Odblokowuje"; (m) „Nowy folder" + przeniesienie pliku przez menu „Przenieś do…" + wiersz statystyk zawiera „1 plik" i rozmiar; po `reload` folder i przypisanie zostają; (n) okno startowe jest wyśrodkowane (środek prostokąta okna w ±40 px od środka viewportu) i zamyka się samo po gotowości silnika; (o) bez sesji `/ities/` przekierowuje na `/login`, po zalogowaniu wchodzi.
5. `node tools/screenshots.mjs`: dodać stronę logowania, okno startowe, folder własny ze statystykami, dymek.
6. `node ~/.claude/skills/impeccable/scripts/detect.mjs --json static/` na koniec.
Każdą kontrolę sprawdź, że umie zawieść (jak w 1.3), wpisz jak.

## G. Czego NIE robić
- Nie wpisywać hasła ani skrótu hasła nigdzie poza `server/auth.local.json`. Nie logować hasła. Nie robić logowania w JavaScript po stronie klienta.
- Nie zmieniać `algo/*.py`, `algo/versions.json`, notebooka. Nie dodawać zależności poza tym, co jest (Flask ma `werkzeug` i `itsdangerous` w sobie, to wystarczy). Nie dodawać bazy, kont użytkowników, rejestracji, e-maili.
- Nie używać `window.alert/confirm/prompt`, nie używać emoji jako ikon, nie ładować niczego z CDN w runtime (poza fallbackiem Pyodide).
- Nie commitować, nie wdrażać, nie używać Chrome przez MCP (headless przez CDP w skryptach jest w porządku).
- Pracę dziel na dwa etapy z zapisem stanu: (1) kod A–E, `node --check` na wszystkich modułach, krótka notatka „ETAP 1 GOTOWY" w `BUILD_REPORT.md`; (2) testy F i raport. Jeśli limit urwie pracę, etap 1 musi być spójny sam w sobie.

## H. Na koniec
`BUILD_REPORT.md` sekcja „1.4.0": zmienione pliki, co zrobione, czego nie i dlaczego, wyniki testów z liczbami, instrukcja wgrania `auth.local.json` na serwer. Pakiet: `tools/build_deploy_bundle.sh`.

## I. Plakietki liczników i teksty informacyjne (zgłoszenie właściciela 17.09 15:50: „te kolory też popraw, info mi się nie podoba, całkowicie zły UX/UI")
Co jest źle dziś: cztery wypełnione pastelowe plakietki z długimi napisami wielkimi literami (WYKRYTO / DO OCENY EKSPERTA / NIE STWIERDZONO W TYM POMIARZE / NIE NADAJE SIĘ DO OCENY) zajmują cały pasek, krzyczą kolorem i czytają się jak ostrzeżenia; w pasku bocznym pod folderem „10 DO OCENY EKSPERTA · pominięto 59 (?)" nie tłumaczy, co pominięto i dlaczego, a „(?)" jest zagadką.
Wymagany wygląd:
- Liczniki w pasku narzędzi jako JEDNA cicha linia podsumowania, bez wypełnionych tła: kropka w kolorze werdyktu (8 px, jak kropki w pasku bocznym) + liczba pogrubiona (tabular-nums, 15 px) + etykieta zwykłym pismem, zdaniowa wielkość liter, krótka forma: „89 wykryto · 10 do oceny · 33 nie stwierdzono · 102 nie do oceny". Separator: kropka środkowa w kolorze tekstu drugorzędnego. Każdy człon klikalny (filtr), aktywny filtr ma podkreślenie 2 px w kolorze werdyktu i pełny kolor tekstu, nieaktywne w kolorze tekstu drugorzędnego. Dymek na każdym członie z pełnym słowem ze słownika 3.5 (np. „NIE STWIERDZONO W TYM POMIARZE: nie znaleziono sygnału spełniającego kryterium; to nie jest dowód nieobecności substancji").
- Słownik 3.5 nadal obowiązuje jako treść: pełne słowa na karcie werdyktu, w tabeli i w PDF. W licznikach i chipach paska bocznego wolno użyć formy krótkiej zdaniowej podanej wyżej, bo pełna forma nie mieści się fizycznie; mapowanie krótkich form trzymać w jednym miejscu (`verdictInfo(...).short`).
- Kolory werdyktów tylko z tokenów (`--verdict-detected`, `--verdict-uncertain`, `--verdict-not-detected`, `--verdict-quality`) i tylko na kropkach, liczbach i podkreśleniu; żadnych wypełnionych pastelowych prostokątów w pasku narzędzi. Kontrast liczb ≥ 4,5:1 w obu motywach (sprawdzić w ciemnym: dzisiejsze jasne tła plakietek w ciemnym motywie gasną).
- Pasek boczny, wiersz pod folderem/próbką: te same kropki z liczbami w formie krótkiej („7 wykryto · 3 do oceny"), a zamiast „pominięto 59 (?)": „59 pominięto: .nox nieobsługiwane" (lista rozszerzeń z liczbami, np. „57 .nox, 2 .xlsx"), z dymkiem „Pliki w innych formatach niż TXT z NOVA nie są wczytywane. Wyeksportuj je do TXT." Bez znaku zapytania jako przycisku. Ten sam wiersz w oknie postępu i w liczniku paska narzędzi („477 plików · 59 pominięto: .nox").
- Linia „Parametry analizy · Domyślne (walidowane 16.09.2026)" zostaje jako cicha linia (13 px, tekst drugorzędny) tylko w trybie eksperckim; poza nim nie ma jej wcale (dziś potrafi zostać po wyłączeniu trybu, sprawdzić).
- Filtry paska bocznego (Wszystkie / Wykryto / Do oceny / Nie stwierdzono / Nie nadające się): jedna kontrolka segmentowa w jednym wierszu, jeśli się mieści (≥ 300 px), inaczej dwa wiersze równej wysokości; aktywny segment biały z cieniem jak dziś, nieaktywne bez tła.
- Zrzuty przed/po do `screenshots/` (pasek narzędzi jasny i ciemny, pasek boczny z folderem). Test G.3: w `#file-count`/pasku podsumowania nie ma elementu z `background-color` innym niż przezroczyste dla klas `.tone-*` (sprawdzić `getComputedStyle`), a tekst „(?)" nie występuje nigdzie w `#sidebar`.
