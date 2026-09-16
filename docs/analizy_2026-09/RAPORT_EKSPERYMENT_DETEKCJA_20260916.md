# Eksperyment: celowane poprawki detekcji kandydatów i wyboru pary (16.09.2026)

Przebieg: 2 projekty (A: detekcja kandydatów, B: wybór pary i bramka jakości) → implementacja jako flagi w `ities_algo_eksp.py`
(przy wszystkich flagach OFF wynik = notebook, 0 różnic na 485 + 1593 plikach) → ewaluacja 13 wariantów na 3 zbiorach → sceptyk 1
(liczby + 10 wykresów) ZAKOŃCZONY, sceptyk 2 (chemia, kontrprzykłady) PRZERWANY po 85 min z powodu limitu tokenów; synteza ta jest
napisana na podstawie artefaktów (`WYNIKI_WARIANTOW.md`, `wyniki_wariantow.json`, werdykt sceptyka 1 w journalu, `kontrola_sceptyk1/`).

## Wynik (wariant FULL = A1 odzysk TPrA⁻ przy krawędzi + A2 osłona okna rozpuszczalnika + A3 prominencja 1,0e-7 + A4 limit separacji pary + B1 + B2)
| zbiór | baza | FULL | zmiana |
|---|---|---|---|
| Etykiety, WYKRYTO na 293 pozytywach | 121 | 125 | +4 (0 strat) |
| Etykiety, fałszywe WYKRYTO na 147 neg + 45 neut | 0 | 0 | 0 |
| Etykiety, NIEPEWNE na negatywach | 0 | 0 | 0 |
| Raporty labu, WYKRYTO na 504 plikach pozytywnych | 94 | 96 | +2 |
| Raporty labu, fałszywe WYKRYTO na negatywach (bez 73-5) | 0 | 0 | 0 |
| Blanki amfa_probki (959), WYKRYTO / NIEPEWNE | 11 / 8 | 11 / 5 | 0 / −3 |

Sceptyk 1 (liczby i wykresy): `refuted = false`, 0 fałszywych WYKRYTO, 0 zysków-artefaktów na 10 obejrzanych (wszystkie 10 rekordów zysku
= 6 różnych przebiegów: 150_1200ul, 4.73_1300uL, Komercja_101_1(8), Komercja_73_4(2), Komercja_Sample(36), 18_25_4_200(8)); punkty 1–4 zawsze
wewnątrz skanu poza strefą 8 %, amplitudy 7,9–16,2 µA, separacje par 37–139 mV. Słabsze wizualnie: 4.73 (punkt 3 na płaskim odcinku, Ip 1,1 µA)
i 101_1(8) (separacja 37 mV, pik 4 jako ramię). Powtórzył ewaluację niezależnie: 0 różnic względem implementatora.

## Wniosek (zasada „mniej obiecujemy")
1. Zysk jest realny, ale mały: +4 pliki (+1,4 pkt proc.) przy 0 FP. Pojedyncze składniki: A3 (prominencja 1,0e-7) daje +4, A1 (odzysk TPrA⁻ przy
   krawędzi) +0 na etykietach i +1 w raportach, A2/A4/B1/B2 nie zmieniają statusów (działają jako osłony, nie jako źródło czułości).
2. To potwierdza wniosek z faktów: **rezerwa czułości nie siedzi w detekcji kandydatów**, tylko w 119 plikach bez pary, z czego 54 nie mają wzorca
   w oknie (NO_TPRA_IN_WINDOWS) i 57 mają wzorzec bez analitu. Tego nie naprawi algorytm; potrzebne są pliki z wzorcem dla tych próbek albo decyzja
   labu o innym oknie wzorca.
3. Rekomendacja: NIE wdrażać do notebooka jako domyślne. Wariant FULL trzymać jako flagę eksperymentalną (kod w `ities_algo_eksp.py`), z dwoma
   warunkami przed jakimkolwiek włączeniem: (a) sceptyk chemiczny (kontrprzykłady: negatywy z TPrA z oknem przyciętym do 0,10–0,90 V, pH 8 dla kodeiny),
   (b) decyzja Łukasza o teście tożsamości wzorca (fałszywy wzorzec w 15 negatywach), bo bez niego każde luzowanie prominencji podnosi ryzyko.
4. Co przenieść do notebooka od razu (bez zmiany liczb): tylko diagnostykę A2 (flaga `in_edge`/`from_end` w kandydatach), jako pole w wyniku, do CSV.
