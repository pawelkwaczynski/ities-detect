# ITIES Detect 1.4.0: addendum 2 (17.09.2026, 19:35): pasek narzędzi podzielony według celu

Zgłoszenie właściciela po obejrzeniu 1.4 lokalnie: „nadal za dużo się dzieje" (pasek: Przelicz ponownie, licznik plików, 4 liczniki werdyktów, wybór algorytmu z ikoną i, Pliki/Tabela, EN/PL, motyw, Tryb ekspercki z ikoną i, Eksport, Sesja, Wyczyść sesję = 12 elementów w dwóch wierszach). Właściciel zaakceptował poniższy podział. Obowiązuje wszystko z briefu 1.4 i addendum 1; ten plik ZMIENIA układ paska, paska bocznego i stopki.

## Q. Pasek narzędzi: tylko akcje na danych, jeden wiersz
Od lewej: ikona domu (⌂, już jest w nagłówku paska bocznego; w pasku narzędzi tylko na wąskim ekranie), menu „Sesja ▾" (Nowa · Otwórz… · Zmień nazwę · Zapisz do pliku · Wczytaj z pliku · separator · Wyczyść sesję), „Przelicz ponownie", „Algorytm 1.1 ▾" z ikoną ⓘ, kontrolka „Pliki | Tabela". Po prawej: przełącznik „Tryb ekspercki" z ikoną ⓘ, „Eksport ▾". Nic więcej. Razem 7 elementów w jednym wierszu; przy szerokości poniżej 1100 px prawa grupa schodzi do drugiego wiersza, przy poniżej 900 px zostaje ikona listy i menu.
- „Wyczyść sesję" znika z paska jako osobny przycisk, żyje tylko w menu Sesja (dialog potwierdzenia bez zmian).
- Licznik „234 pliki" i cztery liczniki werdyktów ZNIKAJĄ z paska narzędzi (idą do paska bocznego, punkt R).

## R. Pasek boczny: podsumowanie listy zamiast przycisków filtrów
Pod nagłówkiem aplikacji, nad wyszukiwarką:
```
234 pliki · 59 pominięto (.nox)
● 89 wykryto   ● 10 do oceny
● 33 nie stwierdzono   ● 102 nie do oceny
```
- Każdy człon to przycisk-filtr (`aria-pressed`), aktywny ma podkreślenie 2 px w kolorze werdyktu i pełny kolor, nieaktywne w kolorze tekstu drugorzędnego; klik na aktywny wraca do „wszystkie". Człon „234 pliki" = filtr „wszystkie". Dymki z pełnymi słowami słownika 3.5 jak w addendum I.
- Dotychczasowa kontrolka segmentowa filtrów (Wszystkie / Wykryto / Do oceny / Nie stwierdzono / Nie nadające się) ZNIKA; jej rolę przejmuje podsumowanie. Klawiatura: człony w kolejności tab, Enter/Spacja przełącza.
- Układ: dwie kolumny po dwa człony (grid), liczby pogrubione tabular-nums 15 px, etykiety 13 px; na wąskim ekranie jedna kolumna. Kropki 8 px z tokenów werdyktów. Zero wypełnionych tła.
- „Nowy folder" zostaje obok wyszukiwarki.

## S. Stopka: ustawienia rzadkie
Lewa strona bez zmian (kropka stanu, „Silnik gotowy · v1.1 …", status analizy, „Zapisano 18:12"). Prawa strona od lewej: przełącznik języka EN | PL, motyw System | Jasny | Ciemny, pole „Operator", logotypy partnerów (już są), „Historia wersji", „Wyloguj", numer wersji. Wysokość stopki może urosnąć do 40 px; na wąskim ekranie dwa wiersze. Komponent `mountPrefs` przenieść z paska do stopki, nie kopiować.

## T. Testy i odbiór
- `tools/ui_smoke.mjs`: (v) pasek narzędzi ma dokładnie 7 elementów interaktywnych najwyższego poziomu na 1440 px (policzyć bezpośrednie dzieci `header.toolbar` z rolą przycisku, menu, select lub przełącznika; wypisać ich etykiety w raporcie); (w) w pasku nie ma tekstu „wykryto" ani „pliki" (podsumowanie żyje w `#sidebar`); (x) klik członu „do oceny" w podsumowaniu filtruje listę (liczba `.file-item` = liczba plików uncertain) i drugi klik wraca do wszystkich; (y) w stopce są przełącznik języka i motywu, w pasku ich nie ma; (z) „Wyczyść sesję" osiągalne z menu Sesja i działa jak dotąd (test d nadal przechodzi).
- `tools/screenshots.mjs`: pasek po zmianie (1440 i 390 px), pasek boczny z podsumowaniem, stopka.
- i18n_check 0 braków, parytet bez powtórki (bez zmian w workerze i stubie), smoke komplet, detect.mjs.
- PORT TESTOWY: właściciel klika w tej chwili w lokalny serwer na 127.0.0.1:20412. NIE zatrzymywać niczego na 20412 i nie uruchamiać tam testów. Skrypty testowe (`ui_smoke.mjs`, `screenshots.mjs`, `test_server_boot.mjs`) mają brać port ze zmiennej `ITIES_TEST_PORT` (domyślnie 20413) i tam stawiać własny serwer; `lsof` na 20413, nigdy `pkill -f gunicorn` bez portu.
- Przed budową pakietu usunąć `static/_probe/` (katalog testowy odbierającego, pliki labu, nie może trafić do paczki) i sprawdzić `tar -tzf` na brak `_probe` i `auth.local.json`.

## U. Czego nie robić
Nie zmieniać treści dymków, słów werdyktów, logiki filtrów ani kolorów tokenów. Nie dodawać nowych elementów do paska. Nie ruszać algo/, nie commitować, nie wdrażać, nie używać Chrome przez MCP.
