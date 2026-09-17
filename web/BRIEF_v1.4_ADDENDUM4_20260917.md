# ITIES Detect 1.4: addendum 4 (17.09.2026, 22:50): podsumowanie jako pasek pod paskiem, filtry z powrotem w pasku bocznym

Decyzja właściciela po użyciu 1.4 na Frogu. Zmienia punkt R z addendum 2. Reszta bez zmian.

## CC. Pasek podsumowania pod paskiem narzędzi (nowy element, nie część `header.toolbar`)
- Osobny element `<div class="summary-bar">` bezpośrednio pod paskiem narzędzi, na całą szerokość treści, wysokość 36 px, tło o pół tonu ciemniejsze od okna (`--bg-sunken` albo istniejący token tła paska bocznego), hairline 1 px u góry i u dołu, jak pasek ścieżki w Finderze. Bez cieni, bez kart.
- Treść od lewej: „234 pliki" (liczba pogrubiona tabular-nums 13 px, słowo zwykłe), separator kropka środkowa, potem cztery człony: kropka 8 px w kolorze werdyktu + liczba pogrubiona 15 px w kolorze werdyktu + etykieta 13 px w kolorze tekstu drugorzędnego („wykryto", „do oceny", „nie stwierdzono", „nie do oceny"). Po prawej, jeśli dotyczy: „59 pominięto (.nox)" w kolorze drugorzędnym z dymkiem jak dotąd.
- Każdy człon to przycisk-filtr (`aria-pressed`): aktywny ma tło o ton jaśniejsze (biała pastylka 24 px z hairline, jak aktywny segment) i pełny kolor, klik na aktywny wraca do „wszystkie". Ten sam stan co kontrolka filtrów w pasku bocznym (punkt DD), obie zawsze zgodne.
- Na ekranie poniżej 900 px człony zawijają się do dwóch wierszy (grid 2 kolumny), pasek rośnie do 64 px. Na 390 px etykiety skracają się do samych liczb z kropką, pełna nazwa w dymku.
- Pasek nie przewija się z treścią (siedzi pod paskiem narzędzi, poza `main`).

## DD. Kontrolka filtrów w pasku bocznym wraca (redesign, nie kopia)
- Pod wyszukiwarką i „Nowy folder": kontrolka segmentowa z pięcioma opcjami w DWÓCH wierszach równej wysokości (grid 3 + 2, każdy segment 32 px wysokości, pełna szerokość paska), tło kontrolki `--bg-input`, promień 10 px, wewnętrzne odstępy 3 px, aktywny segment biały (w ciemnym motywie o ton jaśniejszy) z cieniem 0 1px 2px i promieniem 8 px, tekst 13 px, nieaktywne w kolorze tekstu drugorzędnego; przejście 150 ms. Etykiety: „Wszystkie", „Wykryto", „Do oceny", „Nie stwierdzono", „Nie do oceny" (krótkie formy z `verdictInfo(...).short`, pierwsza litera wielka). Klawiatura: strzałki lewo/prawo między segmentami, `role="radiogroup"`.
- Podsumowanie z licznikami ZNIKA z paska bocznego (przenosi się do CC). Pasek boczny ma znów: nagłówek, wyszukiwarka + Nowy folder, filtry, lista.
- Filtr wybrany w jednym miejscu podświetla się w drugim (jedno źródło stanu `state.filter`).

## EE. Testy i wydanie
- smoke: (w) pasek narzędzi nadal bez liczników, ale `.summary-bar` istnieje pod nim, ma dokładnie 5 członów (pliki + 4 werdykty) i jest poza `main`; (x) klik członu w summary-bar filtruje listę i zaznacza ten sam segment w pasku bocznym, klik segmentu w pasku bocznym podświetla człon w summary-bar; (dd) kontrolka filtrów ma 5 segmentów w 2 wierszach na 1440 px (rect.top różne dla 2 grup) i jeden aktywny.
- screenshots: pasek + summary-bar (1440 i 390 px), pasek boczny z filtrami, jasny i ciemny.
- i18n_check 0 braków, pełny smoke raz, pakiet od nowa. Port 20412 nietykalny, testy na 20413.
