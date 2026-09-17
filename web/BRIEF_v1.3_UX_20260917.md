# ITIES Detect 1.3.0: brief UX (17.09.2026)

Właściciel: Paweł Kwaczyński. Wykonawca: Codex (zamknięty pakiet, praca w tym katalogu). Odbiór: Claude (parytet, smoke test, Chrome), potem Paweł.
Obowiązuje wszystko z `SPEC_APLIKACJI.md` (zwłaszcza sekcje 0, 3.5, 4, 9). Ten brief tylko DODAJE. Kod, nazwy, komentarze po angielsku; teksty UI w `static/shared/i18n.js` w OBU językach (EN i PL), bez długich myślników.

## Skąd ten brief (zgłoszenia właściciela z 17.09, po użyciu wersji 1.2 na 477 plikach)
1. „Wykryto widać podwójnie, zły design." Werdykt pojawia się 4 razy na jednym ekranie: plakietka przy nazwie pliku, karta KPI „Status", karta „Tolerancja" powtarza zdanie „co dalej", blok „Analiza ITIES" powtarza ΔE_s, wzorzec, różnicę i oba zdania.
2. „Mam pierwsze 2 piki, chcę dodać parę 3 i 4 ręcznie, nie widzę opcji." Tryb ekspercki pokazuje uchwyty tylko dla punktów, które algorytm znalazł. Przy WZORZEC BEZ ANALITU nie ma czego przeciągać.
3. „Nie widzę resetu, wyczyszczenia." Lista plików tylko rośnie, sesja zapisuje się w IndexedDB, odświeżenie nic nie czyści. Ten sam folder wgrany dwa razy daje duplikaty (sesja właściciela: 477 plików, z tego 243 duplikaty po SHA-256).
4. „Klikam Analizuj serię, nic się nie dzieje, nie wiem czy gotowe." Analiza rusza sama przy wgraniu, przycisk tylko przelicza to samo od nowa, a postęp widać wyłącznie w pasku stanu na dole (13 px, szary).
5. Oczekiwany przepływ: „daję cały folder albo plik, program pokazuje okno z paskiem postępu i liczbą WYKRYTO / DO OCENY / NIE STWIERDZONO / NIE NADAJE SIĘ / BŁĄD i zamyka się sam."
6. „Tolerancja i zakres też do edycji."
7. Kolab pokazywał wynik czytelniej: jedna linia `Plik | WYKRYTO | ΔE_s = 0,3479 V | błąd = 2,10 mV`, tabela 6 wierszy (punkty 1–4 oraz E5, E6), wykres z dużymi numerami. Wykres w aplikacji już to ma; nagłówek i tabela nie.

## A. Sesja: czyszczenie, usuwanie, duplikaty
- Przycisk „Wyczyść sesję" w pasku narzędzi (po prawej, obok Eksport). Klik pokazuje potwierdzenie WEWNĄTRZ strony (element `<dialog>`, nigdy `window.confirm`): „Usunąć wszystkie N plików z tej sesji? Wyniki nie są nigdzie zapisane poza tą przeglądarką." Przyciski: „Usuń wszystko" (destrukcyjny, ale bez czerwieni alarmowej na tekście werdyktu; czerwień dozwolona na tym jednym przycisku) i „Zostaw". Po potwierdzeniu: `state.files = []`, foldery, pominięte, zaznaczenie, filtr do zera, IndexedDB `session/current` skasowane (`deleteSession()` w `ui/session.js`), ekran pusty jak przy pierwszym uruchomieniu.
- Usuwanie pojedynczego pliku: w nagłówku wyniku (`fileHead`) ikona kosza z etykietą „Usuń z sesji"; w pasku bocznym przy wierszu pliku ta sama akcja pod prawym przyciskiem lub przyciskiem „×" widocznym na hover i przy focusie (klawiatura: `Delete` albo `Backspace` na zaznaczonym pliku, gdy fokus nie jest w polu tekstowym). Bez potwierdzenia dla jednego pliku, za to pasek informacyjny na 6 s: „Usunięto 93P_300ul_TPra(1).txt · Cofnij". Cofnięcie przywraca plik razem z wynikiem.
- Usuwanie próbki (grupy) i folderu: ta sama akcja na nagłówku grupy i folderu, z potwierdzeniem w `<dialog>` gdy dotyczy więcej niż 1 pliku.
- Duplikaty przy imporcie: plik o tym samym SHA-256 co plik już w sesji nie jest dodawany drugi raz. Licznik „pominięto duplikaty: N" w oknie postępu i w liczniku paska narzędzi (`toolbar.skipped` dostaje osobny człon). Ten sam plik w innym folderze też jest duplikatem (decyduje treść, nie nazwa).
- Po usunięciu zaznaczonego pliku zaznaczenie przechodzi na sąsiada (`siblingFileId`), a gdy lista pusta, na ekran pusty.

## B. Import i okno postępu
- Przepływ: każde wgranie (pliki, folder, upuszczenie) otwiera okno postępu (`<dialog>` bez `showModal` blokującego klawiaturę Escape; Escape zamyka okno, analiza trwa dalej). Treść okna:
  - tytuł „Analiza serii", pod nim nazwa źródła (nazwa folderu albo „N plików"),
  - pasek postępu z liczbą „137 z 477" i `aria-valuenow`,
  - pięć liczników odświeżanych na żywo, w kolejności i słowach słownika 3.5: WYKRYTO, DO OCENY EKSPERTA, NIE STWIERDZONO W TYM POMIARZE, NIE NADAJE SIĘ DO OCENY (suma statusów jakości: TPrA_ONLY, NO_VALID_ANALYTE_PAIR, MEASUREMENT_QUALITY_FAIL, too_few_points, invalid), BŁĄD (wyjątek silnika),
  - wiersz „pominięto: N duplikatów, M plików w innym formacie (.nox)" gdy dotyczy,
  - stan silnika, gdy jeszcze się ładuje („Silnik: pakiety numpy, scipy, pandas"), żeby nikt nie myślał, że nic się nie dzieje.
- Po zakończeniu: pasek 100 %, tytuł „Gotowe", okno zamyka się samo po 2,5 s, chyba że kursor jest nad oknem albo okno ma fokus (wtedy zostaje, z przyciskiem „Zamknij"). Po zamknięciu te same liczniki zostają w pasku narzędzi jako klikalne plakietki (klik = filtr paska bocznego: „wykryto", „do oceny", „nie stwierdzono", „nie nadające się"; filtry paska bocznego rozszerzyć o te cztery, zachowując „Wszystkie").
- Przycisk „Analizuj serię" zmienia nazwę na „Przelicz wszystko", jest aktywny tylko gdy są pliki i silnik gotowy, otwiera to samo okno postępu. Gdy nic nie jest w kolejce i wersja algorytmu bez zmian, okno pokazuje od razu podsumowanie (0 z 0 do przeliczenia nie istnieje: zawsze przelicza wszystkie, jak dziś `requeueAll`).
- Ekran pusty: dwa duże przyciski „Dodaj pliki" i „Dodaj folder" w strefie upuszczania, żeby wgranie folderu było widoczne bez szukania w pasku narzędzi.
- Wskaźnik „w kolejce" w pasku bocznym zostaje.

## C. Werdykt pokazany raz (ekran wyniku)
- Nagłówek pliku: nazwa pliku (h1), pod nią JEDNA linia werdyktu w kolorze tonu i wadze 600, 22–26 px: `WYKRYTO · ΔE_s = 0,348 V · 2 mV od wzorca 0,350 V` (dla statusów bez ΔE_s: samo słowo i zdanie „co dalej"). To jedyne miejsce ze słowem werdyktu na ekranie wyniku. Plakietkę `verdictBadge` z nagłówka usunąć (zostaje w pasku bocznym i w tabeli).
- Rząd KPI: cztery karty: ΔE_s, Wzorzec, Różnica (mV, z tonem), Tolerancja (sama linijka `deviationScale`, bez zdania). Kartę „Status" usunąć. Dla statusów bez ΔE_s w miejscu linijki jedno zdanie „co dalej" (jak dziś), ale wtedy nie powtarzać go nigdzie indziej.
- Panel „Piki": tabela sześciu wierszy jak w Colabie: 1 minimum TPrA (wzorzec−), 2 maksimum TPrA (wzorzec+), 3 minimum analitu, 4 maksimum analitu, E5 TPrA (środek pary wzorca), E6 analit (środek pary analitu). Kolumny: #, znaczenie, E (V), I (µA); E5/E6 bez prądu. Wiersze brakujących punktów pokazywać z „—" zamiast chować, żeby było widać, czego brakuje (to jest miejsce, gdzie właściciel szuka pary 3 i 4).
- Blok „Analiza ITIES" usunąć. „Okno potencjałowe" i metodę detekcji przenieść do rozwijanej sekcji „Parametry pomiaru" (już istnieje).
- Zdanie „co dalej" (`nextSentence`) pojawia się raz: pod linią werdyktu w nagłówku, szare, 15 px.

## D. Ręczna para analitu (tryb ekspercki)
- W panelu „Piki", gdy brakuje punktów 3 i 4 (status TPrA_ONLY, NO_VALID_ANALYTE_PAIR, not_detected bez pary), przycisk „Dodaj parę analitu". Działanie: włącza tryb ekspercki (jeśli wyłączony), zasiewa `E3 = E1_raw + AMPHETAMINE_TARGET_DELTA_V`, `E4 = E2_raw + AMPHETAMINE_TARGET_DELTA_V` (obie stałe z `engine.constants`), wywołuje `analyze(..., manual={E1,E2,E3,E4})` przez istniejące `onManual`, po czym uchwyty 3 i 4 pojawiają się na wykresie i dają się przeciągać jak dziś. Algorytm sam robi `nearest_on_branch`, więc zasiew trafia w najbliższy punkt gałęzi.
- Gdy brakuje punktów 1 i 2 (MEASUREMENT_QUALITY_FAIL z NO_TPRA_IN_WINDOWS albo NO_VALID_TPRA_PAIR): przycisk „Wskaż wzorzec ręcznie": zasiew E1 = środek `WIN_TPRA_NEG_RAW`, E2 = środek `WIN_TPRA_POS_RAW` (stałe są w `engine.constants`), E3/E4 jak wyżej względem zasiewu. Wykres dla tych statusów musi się rysować (krzywa `result.curve` jest dołączana do każdego wyniku przez `attach_curve`, sprawdzić, że `renderResult` nie ukrywa jej dla MQ fail).
- Wynik ręczny działa jak dziś: auto nigdy nie znika, zapis wymaga powodu, historia rewizji zostaje. Uchwyty w trybie eksperckim rysować dla wszystkich czterech punktów zawsze, gdy istnieje `state.previewExpert` z kompletem E1–E4.
- Podpowiedź w trybie eksperckim uzupełnić: „Brakujący punkt dodasz przyciskiem w panelu Piki."

## E. Parametry analizy do edycji (sesyjne, jawnie oznaczone)
- Nowa rozwijana sekcja w pasku narzędzi albo nad treścią: „Parametry analizy" z polami: tolerancja WYKRYTO (mV, domyślnie z `DETECTION_TOLERANCE_V`), tolerancja DO OCENY (mV, `UNCERTAIN_TOLERANCE_V`), ΔE_s wzorca amfetaminy (V, `AMPHETAMINE_TARGET_DELTA_V`), okno TPrA+ na forward (V od, V do, `WIN_TPRA_POS_RAW`), okno TPrA− na powrocie (`WIN_TPRA_NEG_RAW`). Przyciski „Zastosuj i przelicz" oraz „Przywróć domyślne". Walidacja: liczby, tolerancja WYKRYTO ≤ DO OCENY, okna „od" < „do".
- Mechanizm: worker dostaje wiadomość `{type:'params', overrides}`; w Pyodide `runPython` ustawia te globalne w module algorytmu (`DETECTION_TOLERANCE_V = ...` itd., krotki dla okien). Plik `algo/*.py` NIE jest zmieniany, zmienia się tylko stan modułu w pamięci. `overrides = null` przywraca wartości z manifestu stałych zapisanych przy ładowaniu (worker zapamiętuje oryginały z `algo_constants()`). Po zmianie: `requeueAll` i okno postępu.
- Każdy wynik policzony z nadpisaniem dostaje `file.paramsOverride = {...}` (kopia) i jest oznaczony wszędzie: w nagłówku wyniku plakietka „parametry własne" z tooltipem listy wartości, w tabeli kolumna „Parametry" (domyślne / własne), w CSV kolumny `params_override` (JSON albo puste) oraz `detection_tolerance_mV`, `uncertain_tolerance_mV`, `target_delta_V`, w raporcie PDF wiersz w nagłówku z listą wartości, gdy różnią się od domyślnych. Wyniki z parametrami własnymi NIE mogą być podane jako zwalidowane: w oknie postępu i w PDF przy takich wynikach zdanie „Parametry własne, poza walidacją z 16.09.2026."
- Sekcja startuje zwinięta, z linią „Domyślne (walidowane 16.09.2026)". Zmiana parametrów nie zapisuje się między sesjami (odświeżenie = domyślne), ale bieżące wartości zapisują się w sesji IndexedDB razem z plikami, żeby wyniki i parametry były spójne po odświeżeniu.

## F. Drobiazgi, które wchodzą przy okazji
- Skrót klawiszowy: `Delete`/`Backspace` usuwa zaznaczony plik (z Cofnij), `Escape` zamyka okno postępu i menu.
- Licznik w pasku narzędzi: „477 plików · 243 duplikaty pominięte · 59 w innym formacie" zamiast dwóch osobnych napisów.
- Wersja aplikacji 1.3.0: `APP_VERSION`, klucz `app.changelog.1_3_0` (EN i PL, po jednym zdaniu na punkt A–E), wpis w `versions.html`.

## G. Testy (Codex uruchamia i wkleja wyniki do `RELEASE_CHECK.md`, sekcja „1.3.0")
1. `nice -n 10 node tools/parity_test.mjs`: 485 plików, 0 różnic (algorytm nietknięty, parametry domyślne).
2. Test negatywny parametrów: skrypt `tools/params_override_test.mjs` (Node + pyodide jak parity): dla pliku `07_etykiety_lab_20260916/Pozytywne/93P_300ul_TPra(1).txt` domyślne dają `uncertain` (ΔE_s 0,3638), a z `DETECTION_TOLERANCE_V = 0.015` dają `detected`; potem `overrides = null` i znowu `uncertain`. Test ma zawieść, gdy nadpisanie nie działa albo nie cofa się.
3. `tools/ui_smoke.mjs` (headless Chrome przez CDP, jak `tools/screenshots.mjs`, `nice -n 10`): (a) wgranie folderu 3 plików referencyjnych z `PRODUCT.md` otwiera okno postępu, po zakończeniu liczniki sumują się do 3 i zgadzają z werdyktami z sekcji 8.4 spec; (b) drugie wgranie tych samych plików daje „pominięto 3 duplikaty" i lista nadal ma 3; (c) usunięcie jednego pliku, Cofnij, lista ma 3; (d) „Wyczyść sesję" + potwierdzenie: lista pusta, po `location.reload()` nadal pusta; (e) na pliku `BRB pH 7 CV 50uM codeine + 50uM TPrA.txt` (status z parą) nagłówek zawiera słowo werdyktu dokładnie raz w całym `#content` (policzyć wystąpienia `NIE STWIERDZONO W TYM POMIARZE` w `textContent`); (f) na pliku ze statusem TPrA_ONLY (wybrać z `Negatywy/`, wypisać nazwę w raporcie) przycisk „Dodaj parę analitu" tworzy 4 uchwyty; (g) parametry: ustawienie tolerancji 15 mV i „Zastosuj" zmienia werdykt 93P na WYKRYTO z plakietką „parametry własne", „Przywróć domyślne" wraca do DO OCENY EKSPERTA. Każdy krok wypisuje PASS/FAIL, skrypt kończy się kodem 1 przy dowolnym FAIL, a błędy konsoli przeglądarki są wypisywane i też oblewają test.
4. `node tools/screenshots.mjs` uzupełnić o: okno postępu w trakcie, ekran wyniku po zmianie C, panel „Piki" z przyciskiem „Dodaj parę analitu", sekcję „Parametry analizy" rozwiniętą, dialog „Wyczyść sesję". Oba języki, oba motywy jak dotąd.
5. `node ~/.claude/skills/impeccable/scripts/detect.mjs --json static/` na koniec; mechaniczne poprawić, resztę wypisać.
6. `python3 tools/test_server.py` bez zmian ma przechodzić.

## H. Czego NIE robić
- Nie zmieniać `algo/*.py`, `algo/versions.json` ani notebooka. Nie dodawać zależności, frameworków, kroku budowania, zewnętrznych fontów, CDN w runtime.
- Nie używać `window.alert`, `window.confirm`, `window.prompt` (blokują przeglądarkę pod automatyzacją i wyglądają obco). Tylko `<dialog>` i paski informacyjne w stronie.
- Nie ruszać PeakWise (`static/peakwise/`) poza tym, co wymusza wspólny `i18n.js` (nowe klucze dopisywać, istniejących nie zmieniać).
- Nie commitować, nie publikować, nie wdrażać na serwer, nie używać Chrome przez MCP (headless Chrome przez CDP w skryptach jest w porządku).
- Nie pisać w UI o policji, certyfikatach, klientach. Nie wymyślać liczb; jedyne liczby walidacji to te z `versions.json` i spec 3.3.
- Nie zmieniać znaczenia słów werdyktów ze słownika 3.5.

## I. Na koniec
- `BUILD_REPORT.md`: dopisać sekcję „1.3.0" z listą zmienionych plików, wynikami testów G.1–G.6 (liczby, nie „ok"), oraz listą rzeczy, których nie udało się zrobić i dlaczego.
- Zbudować pakiet wdrożeniowy: `tools/build_deploy_bundle.sh` (bez commitów).
