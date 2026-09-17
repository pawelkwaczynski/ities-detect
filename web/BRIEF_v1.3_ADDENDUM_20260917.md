# ITIES Detect 1.3.0: addendum do briefu (runda 2, 17.09.2026)

Źródło: niezależna krytyka UX briefu (agent recenzent, tryb Operate, heurystyki Nielsena i WCAG 2.2) plus decyzje właściciela. Ten plik NADPISUJE brief tam, gdzie się różni. Reszta briefu obowiązuje. Wszystkie zakazy z sekcji H briefu obowiązują.

## 1. Ręczna para analitu: ZERO zasiewu w wartości kryterium (zamienia sekcję D briefu)
Powód: zasiew E3 = E1 + 0,350 V i E4 = E2 + 0,350 V stawia punkty dokładnie tam, gdzie ΔE_s równa się kryterium. Jeden klik na pliku „wzorzec bez analitu" produkuje WYKRYTO na żądanie. Tego nie wolno.
- Jeśli wynik zawiera listę odrzuconych kandydatów algorytmu (sprawdź, co zwraca `analyze`; jeśli w wyniku nie ma listy kandydatów, nie dorabiaj jej w JS ani w Pythonie), zasiewaj 3 i 4 z najbliższego kandydata na właściwej gałęzi.
- Gdy listy kandydatów nie ma: przycisk „Dodaj parę analitu" wchodzi w tryb wskazywania: kursor celownika nad wykresem, podpowiedź „Kliknij minimum analitu na skanie wstecz (punkt 3)", potem „Kliknij maksimum analitu na skanie w przód (punkt 4)". Dopiero po obu kliknięciach idzie `analyze(manual)` i pojawiają się uchwyty. Escape przerywa.
- To samo dla „Wskaż wzorzec ręcznie": cztery kliknięcia w kolejności 1, 2, 3, 4, bez zasiewu.
- Zapis wyniku ręcznego zablokowany, dopóki komplet E1–E4 nie pochodzi z kliknięć albo przeciągnięć technika (nigdy z liczby wpisanej przez program).
- Alternatywa dla przeciągania (WCAG 2.2 `dragging-alternative`): w tabeli „Piki" każdy wiersz 1–4 ma pole liczbowe E (V) ze strzałkami góra i dół (krok 1 mV), aktywne w trybie eksperckim; zmiana pola wywołuje `analyze(manual)`, uchwyt na wykresie tylko odzwierciedla wartość.
- Linia werdyktu przy wyniku ręcznym ma DWA człony i nigdy sam ekspert: „Automatycznie: WZORZEC BEZ ANALITU · Ekspert (Anna, 11:20): DO OCENY EKSPERTA". Zgodne ze spec 3.4.

## 2. Werdykt pokazany raz: zostaje karta z wersji 1.0, znika rząd KPI (zamienia sekcję C briefu)
- Karta werdyktu jak w 1.0: słowo 28–34 px waga 600 w kolorze tonu, pod nim jedno zdanie z liczbą („ΔE_s = 0,349 V, 1 mV od wzorca 0,350 V"), jedno zdanie „co dalej", po prawej skala tolerancji Z LEGENDĄ. Nie kurczyć werdyktu do jednej linii.
- Rząd czterech kart KPI (ΔE_s, Wzorzec, Różnica, Status) USUNĄĆ w całości. Blok „Analiza ITIES" USUNĄĆ. Plakietkę werdyktu z nagłówka pliku USUNĄĆ (zostaje w pasku bocznym i w tabeli).
- Panel „Piki" z sześcioma wierszami (1–4, E5, E6) zostaje jak w briefie; brakujące wiersze z „—".
- Efekt do sprawdzenia testem G.3(e): słowo werdyktu występuje w `#content` dokładnie raz (dla wyniku auto) albo dokładnie dwa razy w jednej linii (auto i ekspert).

## 3. Parametry analizy: pod trybem eksperckim, z granicami, nie do zgubienia (uzupełnia sekcję E briefu)
- Sekcja „Parametry analizy" jest widoczna TYLKO przy włączonym „Tryb ekspercki". W zwykłym trybie nie ma jej w pasku narzędzi.
- Twarde granice z komunikatem w polu: tolerancja WYKRYTO 1–30 mV, tolerancja DO OCENY ≥ WYKRYTO i ≤ 30 mV, ΔE_s wzorca 0,300–0,400 V, okna TPrA w zakresie −1,0…1,0 V, szerokość okna ≥ 0,05 V, „od" < „do". Wartość spoza granic = przycisk „Zastosuj" nieaktywny i powód pod polem.
- Gdy nadpisanie jest aktywne: stały pasek nad treścią (nie znika przy przewijaniu) „Parametry własne: tolerancja 15/20 mV, ΔE_s 0,350 V. Wyniki poza walidacją z 16.09.2026." z przyciskiem „Przywróć domyślne".
- Skala tolerancji przy nadpisaniu: pasma kreskowane (nie pełna zieleń ani bursztyn) i etykieta „progi własne" nad skalą. Czysta zieleń tylko dla domyślnych.
- Nadpisanie NIE jest pamiętane po odświeżeniu strony: po `reload` aktywne parametry wracają do domyślnych, a wyniki policzone wcześniej na własnych parametrach zachowują swoją plakietkę i wartości w `file.paramsOverride`. Sesja w IndexedDB zapisuje `paramsOverride` per plik, nie „aktywne nadpisanie".
- PDF i CSV: kolumna `params_override` w CSV ZAWSZE obecna (pusta dla domyślnych); w PDF przy każdym wyniku na własnych parametrach pełna lista wartości i zdanie „Parametry własne, poza walidacją z 16.09.2026"; w nagłówku raportu przy sesji mieszanej „N z M plików policzono na parametrach własnych".

## 4. Raport PDF: co musi być, żeby nikt nie nadużył wyniku
- Stopka na KAŻDEJ stronie (`@page` + powtarzany element): „ITIES Detect, aplikacja 1.3.0, algorytm 1.1 (SHA-256 skrócony), strona X z Y". Jeśli numeracja stron w czystym CSS nie działa w Chrome, dać stopkę bez „z Y", ale z resztą.
- Przy KAŻDYM wyniku: tryb (automatyczna albo ręczna), a przy ręcznej operator, godzina i POWÓD korekty; SHA-256 pliku; wersja algorytmu.
- Przy każdym NIE STWIERDZONO powtórzone zdanie ze słownika 3.5 (brak sygnału spełniającego kryterium w tym pomiarze, nie dowód nieobecności substancji).
- Liczby walidacji dokładnie jak w PRODUCT.md, rozbite: 121 z 293 plików pozytywnych wykrytych; 0 ze 147 negatywnych i 0 z 45 neutralnych fałszywie wykrytych; pomiar 16.09.2026. Nie sumować do 192.
- Menu „Eksport" dostaje wybór zakresu dla PDF: wszystkie / widoczne po filtrze / zaznaczona próbka, z liczbą plików i ostrzeżeniem powyżej 50 plików („Raport będzie miał około N stron, druk może potrwać"). Plus jedno zdanie: „W oknie druku włącz grafikę tła, inaczej wykresy będą blade" oraz style druku, które nie zależą od tła (linie i punkty w kolorach z `print-color-adjust: exact`).

## 5. Okno postępu i przepływ serii (uzupełnia sekcję B briefu)
- Przycisk „Przerwij" w oknie postępu: zatrzymuje kolejkę po bieżącym pliku, reszta zostaje „w kolejce", liczniki pokazują, co policzono. „Przelicz wszystko" wznawia.
- Gdy folder wpada przed gotowością silnika: w oknie wiersz „Czekam na silnik: pakiety numpy, scipy, pandas", kolejka rusza sama (dziś tak działa `pump`, ma to być widoczne).
- Nawigacja po ocenie: strzałki góra i dół na liście (już są) plus przycisk „Następny do oceny" w karcie werdyktu, gdy filtr „do oceny" ma więcej plików; skrót `J`/`K` nie jest wymagany.
- Pojedynczy plik w trakcie liczenia: szkielet karty werdyktu i wykresu (szare bloki, `aria-busy`), nie pusta karta.

## 6. Usuwanie i Cofnij (zamienia F w briefie)
- `Delete` usuwa zaznaczony plik tylko, gdy fokus jest na liście plików albo w treści wyniku (nie w polach tekstowych). `Backspace` NIE usuwa.
- Pasek „Usunięto X · Cofnij" nie znika po czasie: zostaje do następnej akcji użytkownika (klik, import, zmiana pliku), maksymalnie 60 s.

## 7. Klucze i18n: obowiązkowa kontrola
- Każde `t("...")` w `static/ities/**` i `static/shared/**` musi mieć klucz w EN i PL. Dodać skrypt `tools/i18n_check.mjs`, który wyciąga wszystkie wywołania `t("klucz")` i `data-i18n="klucz"` i oblewa, gdy klucza brakuje w którymś języku. Uruchomić i wpisać wynik do `RELEASE_CHECK.md`. Znane braki w trakcie budowy: `params.custom`, `params.outsideValidation` (wywoływane w `session.js`).

## 8. Testy dodatkowe (dopisać do G)
- G.3(h): na pliku TPrA_ONLY „Dodaj parę analitu" NIE wywołuje `analyze` przed dwoma kliknięciami; po dwóch kliknięciach wynik ma tryb manual, a przycisk „Zapisz" jest aktywny dopiero po podaniu powodu.
- G.3(i): przy aktywnym nadpisaniu widać pasek „Parametry własne", po `location.reload()` paska nie ma, a plik policzony wcześniej ma plakietkę „parametry własne".
- G.3(j): eksport PDF z filtrem „do oceny" tworzy raport tylko z tych plików (policzyć sekcje w `#print-root`).
- G.3(k): „Przerwij" w trakcie serii 3 plików zostawia co najmniej 1 plik w kolejce, „Przelicz wszystko" domyka.
- `tools/i18n_check.mjs`: 0 braków.

## 9. Odłożone (nie robić w 1.3, wpisać do BUILD_REPORT jako backlog)
Znacznik „sprawdzone" przy pliku z licznikiem; tabela jako ekran startowy po serii; lista duplikatów z „Dodaj mimo to"; eksport i wczytanie całej sesji jako plik; wiersz sumy per folder w tabeli.
