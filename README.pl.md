# ITIES Detect

<p align="center">
  <a href="README.md">🇬🇧 In English</a> ·
  <a href="#co-to-robi">Co to robi</a> ·
  <a href="#jak-uruchomic">Jak uruchomić</a> ·
  <a href="#czego-to-nie-robi">Czego nie robi</a>
</p>

Notatnik Colab do wykrywania amfetaminy w woltamperogramach cyklicznych rejestrowanych na granicy
faz ciecz-ciecz (ITIES), z wewnętrznym wzorcem TPrA+. Program znajduje pik wzorca i pik analitu,
sprawdza rozstaw pików wobec wartości oczekiwanej, odczytuje prąd piku z linią bazową dopasowaną
przed sygnałem (przecięcie stycznych przy słabych pikach) i przelicza prąd na stężenie
z krzywej kalibracyjnej.

Historia zmian algorytmu: `WERSJE_ALGORYTMU.md`.

## Co to robi

- **Znajduje piki**: wzorzec wewnętrzny TPrA+ i analit, z kontrolą rozstawu.
- **Prowadzi linię bazową** tak, jak robi to analityk w Origin: prostą najmniejszych kwadratów
  przez płaski odcinek pojemnościowy tuż przed narastaniem sygnału faradajowskiego.
- **Odczytuje prąd piku na trzy sposoby**: w maksimum, na krzywej w punkcie przecięcia stycznych
  i w samym punkcie przecięcia.
- **Przelicza na stężenie** z krzywej kalibracyjnej i liczy czystość próbki.

## Skrypty towarzyszące

| plik | do czego |
|---|---|
| `kalibracja_cc.py` | dopasowanie krzywej kalibracyjnej |
| `ilosciowka.py` | oznaczenie ilościowe i czystość |
| `analiza_replikatow.py` | analiza replikatów |
| `eval_etykiety.py`, `eval_katalog.py` | ocena wobec katalogu oznaczonego w laboratorium |
| `grid_etykiety.py` | przeszukiwanie siatki progów detekcji |
| `kontrola_wizualna_20260916.py` | PDF do ręcznego sprawdzenia przypadków granicznych |
| `test_ities_local.py` | test od końca do końca, bez przeglądarki |
| `test_end2end_czystosc.py` | test od końca do końca dla czystości |

Więcej narzędzi diagnostycznych w katalogu `tools/`.

## Jak uruchomić

Notatnik `ITIES_Detect.ipynb` otwiera się w Google Colab i działa bez instalowania czegokolwiek.

Katalog `web/` to ta sama metoda w przeglądarce: Pyodide uruchamia zamrożony plik `algo/*.py`
bez zmian w Web Workerze, a mały serwer Flask tylko serwuje pliki statyczne i manifest wersji.
Szczegóły: `web/README.md`.

## Ocena metody

Katalog `docs/analizy_2026-09/` zawiera wrześniową ocenę wobec zbioru oznaczonego w laboratorium:
czułość i swoistość, przegląd progów, sprawdzenie wobec literatury.

## Czego to nie robi

- **Nie zawiera danych pomiarowych ani laboratoryjnych stałych kalibracyjnych.** One nie są częścią
  tego repozytorium i nie zostaną tu dodane.
- Nie zastępuje analityka. Przypadki graniczne mają trafić do ręcznej kontroli, od tego jest
  `kontrola_wizualna`.
- Nie jest wyrobem medycznym ani narzędziem dowodowym.

## Status

Praca w toku, prowadzona we współpracy z grupą Electrochemistry@Soft Interfaces
na Uniwersytecie Łódzkim.

## Licencja

MIT. Copyright 2026 Paweł Kwaczyński.
