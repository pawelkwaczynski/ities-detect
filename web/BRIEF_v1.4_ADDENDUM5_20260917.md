# ITIES Detect 1.4: addendum 5 (17.09.2026, 23:15): REDESIGN belki podsumowania i filtrów, wzorce macOS

Właściciel po obejrzeniu addendum 4 na żywo: „tragicznie, nieprofesjonalnie" (obcięte etykiety „Nie do oce…", belka jak zwykły tekst z jedną białą pastylką, ściśnięty nagłówek). Ten plik ZASTĘPUJE punkty CC i DD z addendum 4 dokładnym projektem. Wartości poniżej są wiążące; nie interpretować, wdrożyć.

## HH. Belka stanu pod paskiem narzędzi (wzór: pasek stanu Findera i Xcode)
- Element `.summary-bar`, wysokość 36 px, tło `--bg-sunken` (jasny: #F2F2F5, ciemny: #1F1F22; dodać token, jeśli nie ma), hairline 1 px u dołu (`--hairline`), bez cienia, bez zaokrągleń, przylega do paska narzędzi.
- Zawartość wyśrodkowana pionowo, lewy margines 20 px, odstępy między elementami 18 px.
- Po lewej: „234 pliki" (liczba 13 px waga 600 kolor tekstu, słowo 13 px kolor drugorzędny). Bez separatorów z kropki środkowej.
- Cztery „stat pills": każda to przycisk o wysokości 26 px, promień 7 px, padding 0 10px, tło przezroczyste, zawartość: kropka 7 px w kolorze werdyktu, liczba 13 px waga 600 w kolorze werdyktu, etykieta 13 px w kolorze drugorzędnym (odstęp 6 px). Hover: tło `rgba(0,0,0,0.05)` (ciemny: `rgba(255,255,255,0.06)`). Aktywna (= bieżący filtr): tło `--bg-card` (biała), hairline 1 px `--hairline`, cień `0 1px 1px rgba(0,0,0,0.06)`, etykieta w kolorze tekstu. Przejścia 150 ms.
- Po prawej (margines 20 px): „59 pominięto · .nox" 12 px kolor drugorzędny z dymkiem; gdy nic nie pominięto, pusto.
- Klawiatura: pastylki w tab-order, `aria-pressed`. Poniżej 900 px: pastylki bez etykiet (kropka + liczba), etykieta w dymku; belka nadal 36 px.

## II. Filtry w pasku bocznym jako lista źródeł (wzór: pasek boczny Findera i Mail), nie segmenty
Kontrolka segmentowa ZNIKA (nie mieści pięciu etykiet bez obcinania). Zamiast niej sekcja listy:
```
FILTRY                       (nagłówek sekcji 11 px, wielkie litery, tracking 0.06em, kolor drugorzędny, margines 16 px 12 px 6 px)
   Wszystkie            234
 ● Wykryto               89
 ● Do oceny              10
 ● Nie stwierdzono       33
 ● Nie do oceny         102
```
- Każdy wiersz 28 px wysokości, promień 6 px, padding 0 10px, tekst 13 px; kropka 8 px w kolorze werdyktu (wiersz „Wszystkie" bez kropki, z ikoną SVG „lista" 14 px w kolorze drugorzędnym); liczba po prawej 12 px tabular-nums w kolorze drugorzędnym. Hover: tło `rgba(0,0,0,0.04)`. Zaznaczony (bieżący filtr): tło `--accent` z alfą 0.12 (jasny) / 0.22 (ciemny), tekst w kolorze tekstu, liczba w kolorze tekstu. Odstęp między wierszami 2 px. `role="listbox"` z `aria-selected`, strzałki góra/dół.
- Sekcja siedzi pod wyszukiwarką i „Nowy folder", nad listą plików; lista plików dostaje nagłówek sekcji „PLIKI" w tym samym stylu (11 px, wielkie litery), żeby dwie listy się nie zlewały.
- Liczby w tej sekcji i w belce HH to te same wartości z `bucketCounts`, jedno źródło; filtr = `state.filter`, oba widoki podświetlają to samo.

## JJ. Nagłówek paska bocznego (ściśnięty po powiększeniu ikony)
- Ikona 48 px (nie 56) z pliku 1024 przez srcset, promień 22 %, po prawej kolumna tekstu: „ITIES Detect" 15 px waga 600, pod nią podpis 12 px w jednej linii: PL „Detekcja amfetaminy z CV", EN „Amphetamine detection from CV" (klucz app.tagline; pełne zdanie w dymku). Ikona domu 18 px w tej samej linii co nazwa, po lewej nazwy, odstęp 8 px. Wysokość nagłówka 64 px, padding 12 px 16 px. Nic nie może się obcinać przy szerokości paska 300 px; sprawdzić `scrollWidth` nagłówka.

## KK. Testy
- smoke: belka ma dokładnie 4 pastylki + licznik plików; aktywna pastylka i zaznaczony wiersz listy wskazują ten sam filtr po kliknięciu w jedno i w drugie; żadna etykieta w pasku bocznym nie jest obcięta (dla każdego `.filter-row` `scrollWidth <= clientWidth`); nagłówek paska bocznego bez obcięcia; kontrolki segmentowej filtrów nie ma w DOM.
- screenshots: pasek boczny z sekcjami FILTRY i PLIKI, belka, jasny i ciemny, 1440 i 390 px.
