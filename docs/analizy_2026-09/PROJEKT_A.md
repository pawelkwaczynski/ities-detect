# PROJEKT A: detekcja kandydatow (flagi A1, A2, A3, dodatkowo A4), 16.09.2026

Kod: `ities_variant_A.py` (importuje zamrozony `ities_algo_base.py`, kroki 5-10 analyze() przepisane z hakami; przy
domyslnych flagach wynik identyczny z baza: 121/0/0 na etykietach, 161 WYKRYTO i tylko 73-5 na amfa, sprawdzone plik w plik).
Runner: `eval_variant_A.py --tag T [--amfa] --set FLAGA=WARTOSC` (etykiety 15 s, amfa 2503 plikow 40 s, `nice -n 10`).
Diagnostyka kandydatow bez filtra krawedzi: `diag_kandydaci_krawedz.py` -> `diag_kandydaci_krawedz.json` (2989 plikow).
Wyniki per konfiguracja: `eval_A_<tag>_summary.json` (+ `_etykiety.json`, `_amfa.json` z E1..E4 per plik).

## 0. Fakty z danych, na ktorych stoi projekt

- 121 wykryc bazowych (E surowe): E1 0,173-0,332 V, E1-E_min >= 58,6 mV; E4-E_max: min 112 mV, p5 149 mV.
  Rozstaw par: E2-E1 68-193 mV (med 103), E4-E3 20-161 mV (med 88). Krok skanu 2,44 mV, filtr 8 % = 21-29 pkt = 51-71 mV.
- Kandydaci `min` w strefie krawedziowej konca galezi powrotnej (poczatek skanu): 706 w calym zbiorze, 673 (95 %) lezy
  0-10 mV od E_min z from_end 6-7 pkt. To PUNKT ZAWROTU skanu (prad relaksuje przy zatrzymaniu potencjalu), nie pik.
  Prad "zawraca" po nim (raw_turn=True) i prominencja jest ogromna (5-14 µA), wiec warunek "prawdziwe lokalne ekstremum
  z prominencja >= progu" z tresci A1 NIE odroznia go od piku. Odroznia tylko odleglosc od E_min i liczba punktow za nim.
- Analogicznie kandydaci `max` przy E_max: 188 w etykietach, 183 w 0-10 mV od E_max, reszta <= 60 mV.
- "Prawdziwe zyski" z kontroli wizualnej po ponownym sprawdzeniu (grid prom x edge, strony 21-40 PDF, geometria par):
  - 150_1200ul, 4.73, Komercja_73_4(2), Komercja_101_1(8): zyski PROMINENCJI 1,0e-7 przy nietknietym filtrze 8 %
    (kandydat TPrA- 0,12-0,14 µA w 150_1200ul/4.73/73_4(2); analit+ 0,12 µA w 101_1(8)). Filtr krawedzi nie ma z nimi nic wspolnego.
  - 195-1D (okno 0,20-1,00) i komercja_183-3 (okno 0,25-1,00): ARTEFAKT jednokrawedziowy. E1 = E_min (punkt zawrotu,
    -10/-15 µA), a "para analitu" to E3 = prawdziwy TPrA- (0,354 / 0,411) z E4 = 0,823 / 0,863, rozstaw 469 / 452 mV
    (baza: max 161 mV). Woltamogram 195-1D jest przesuniety o ok. +0,12 V (TPrA 0,35/0,46, analit 0,73/0,83, dE_s = 0,370,
    czyli BRAK przy 10 mV; to temat tolerancji, nie krawedzi). PDF str. 22 i 40 potwierdzaja polozenie punktow.
  - 85-1(1), 87P(1), 92-1(2), 93P(1) (nieopisane w faktach): ta sama rodzina co 4.12 (krawedz 0,102 V + 0,898 V);
    w 87P/92-1/93P artefakt NADPISUJE poprawna pare z dE_s 0,331-0,372. Filtr krawedzi bez oslony = fałszywe WYKRYTO.

## A1. Odzysk TPrA- ze strefy krawedziowej (flaga `A1_TPRA_NEG_EDGE_RESCUE`, domyslnie False)

Zmiana w kodzie: `branch_peaks_v(..., keep_edge=True)` zwraca tez kandydatow ze strefy krawedziowej z polami `in_edge`,
`from_end`, `raw_drop` (spadek pradu surowego za pikiem do konca galezi). W analyze() po kroku 6, TYLKO gdy `t_neg` jest
puste (`A1_REQUIRE_FALLBACK=True`, jak zapas "ramie": nigdy nie konkuruje z regularnym TPrA-), kandydat z `in_edge=="end"`
galezi powrotnej przechodzi, gdy: lezy w WIN_TPRA_NEG_RAW, `prom >= PEAK_PROMINENCE_A` i `raw_drop >= PEAK_PROMINENCE_A`
(prad zawraca), `from_end >= A1_MIN_TAIL_PTS = 10` (nie punkt zawrotu: klaster ma 6-7), `E - E_min >= A1_MIN_FROM_EMIN_V = 0,015 V`
(klaster 0-10 mV). Odzyskany kandydat trafia WYLACZNIE do `t_neg` (nigdy do puli analitu), wynik dostaje ostrzezenie
`tpra_neg_edge_rescued` (severity medium, czyli review_required). Strefa krawedziowa dla analitu zostaje zamknieta.
- Hipoteza: skany zaczynajace sie przy 0,20-0,25 V ucinaja TPrA-; pik tuz nad krawedzia jest prawdziwy, punkt zawrotu nie.
- Odzyska: etykiety 0 plikow (wszystkie "krawedziowe" zyski z faktow to artefakty albo zyski prominencji, patrz p. 0).
  amfa: +1 `Komercja2/Komercja_TRrACl_20uL_18_25_4_200(8).txt` (raport: pozytyw 3,3 %, probka wymieniona w faktach jako
  "z TPrA bez wykrycia"; E1 31,7 mV nad E_min, from_end 13, E2-E1 71 mV, E4-E3 51 mV, amplituda 10,4 µA, dE_s 0,344).
- Bez oslon (E_min 0 mV, tail 0 pkt): etykiety +1 (195-1D, artefakt), amfa +6: 195-1D, `24032026/Blank(13..15)` (E1 = E_min,
  E2-E1 = 239 mV, tozsamosc arytmetyczna), 18_25_4(8) i `Komercja_TRrA_Sample_21_25_1_100(1)` (raport pozytyw; E1 17,1 mV
  nad E_min, from_end 7, prom 0,19 µA, rozstawy 105/98 mV: wyglada prawdziwie, ale siedzi na granicy klastra zawrotu).
- Moze zepsuc: kazdy negatyw z TPrA i skanem od 0,20-0,25 V dostaje "TPrA-" z punktu zawrotu; bez progu E_min jest to
  pewne (3 blanki). Przy 15 mV / 10 pkt na 147+45 etykietach i 68 negatywach z raportow: 0 FP. Utrata 21_25_1(1) to cena
  progu 10 pkt; wariant `A1_MIN_TAIL_PTS=7` z `A1_MIN_FROM_EMIN_V=0.015` do zmierzenia osobno (klaster ma 0-10 mV, wiec
  15 mV rozdziela, ale margines to 2 mV; nie wlaczac bez kontroli wizualnej 21_25_1(1) i 8 kandydatow z pasma 15-20 mV).
- Pomiar: `--set A1_TPRA_NEG_EDGE_RESCUE=True` (+`--amfa`); FP liczyc na 192 etykietach i kategoriach negatyw,
  negatyw_inna_substancja z raportow; zyski ogladac na wykresie (E1 musi byc dolina, nie koncem skanu).

## A2. Oslona okna rozpuszczalnika (flaga `A2_SOLVENT_GUARD`, domyslnie False)

Zmiana w kodzie: w analyze() po kroku 8 `a_pos` filtrowane przez `E_max - E >= A2_GUARD_EMAX_V = 0,060 V`, `a_neg` i `t_neg`
przez `E - E_min >= A2_GUARD_EMIN_V = 0,015 V`, oba dodatkowo `raw_drop >= A2_RAW_TURN_FRAC (0,5) * prom`.
- Dobor X: 121 wykryc ma E_max-E4 >= 112 mV, kandydaci krawedziowe przy E_max leza <= 10 mV (183/188), max 60 mV.
  X = 60 mV blokuje wszystkie 188 i zostawia 52 mV marginesu do najblizszego prawdziwego wykrycia. Po stronie E_min
  prog 15 mV (nie 40): 40 mV zabilby zysk A1 (18_25_4(8) ma 31,7 mV); klaster zawrotu ma <= 10 mV, wykrycia >= 58,6 mV.
- Warunek "monotoniczny odcinek wzrostu do konca skanu": pod find_peaks to pusty warunek (prominencja scipy wymaga spadku
  po OBU stronach, a punkt zawrotu ma raw_turn=True), zmierzone: 0 kandydatow odrzuconych przez ten czlon. Zostaje jako
  tania asekuracja, ale nie liczyc na niego.
- Odzyska nic (to bramka). Na bazie 0 zmian (redundantna z filtrem 8 % = 51-71 mV), rowniez na amfa 0 zmian.
  Sens: jawna oslona w mV, niezalezna od gestosci punktow, obowiazkowa przy KAZDYM poluzowaniu filtra krawedzi
  (bez niej edge=0 daje 12 artefaktow na etykietach; z A2 przy edge=0 kandydat 0,898 V i 0,102 V odpadaja).
- Moze zepsuc: skany z oknem 0,4-0,9 (1022 plikow amfa) maja krotsza galaz, 8 % = 40 mV < 60 mV, wiec A2 jest tam
  ostrzejsza niz filtr; zmierzone na amfa: 0 strat. Pomiar: `--set A2_SOLVENT_GUARD=True` z i bez `A3`, straty musza byc 0.

## A3. Prominencja 1,0e-7 A osobno dla analitu i osobno dla TPrA (`A3_ANALYTE_PROMINENCE_A`, `A3_TPRA_PROMINENCE_A`, domyslnie None)

Zmiana w kodzie: `branch_peaks_v` dostaje prominencje jako parametr; analyze() buduje dwie listy kandydatow (TPrA z
`prom_t`, analit z `prom_a`; przy rownych progach jedna lista). Okna, wybor pary po prominencji i po min |srodek-0,259| bez zmian.
- Analit 1,0e-7 (TPrA 1,5e-7): etykiety +1 (101_1(8): analit+ 0,12 µA), 0 FP; amfa +1 (ten sam plik), 0 nowych FP.
- TPrA 1,0e-7 (analit 1,5e-7): etykiety +2 (150_1200ul, 73_4(2)), amfa +2 (te same), 0 nowych FP; 110_2(16) z NIEPEWNE
  (probka "< 0,1 %", jej dwa inne pliki juz sa WYKRYTO, wiec zgodne).
- Oba 1,0e-7: etykiety 125/293 (+4: 150_1200ul, 4.73, 101_1(8), 73_4(2)), 0 FP na 192; amfa 166 (+5, doszlo
  `Komercja2/Komercja_Sample(36)`, niemapowane, geometria normalna: 90/78 mV, 7,9 µA), FP z raportow: tylko znany 73-5.
- Czy bezpieczne: grid z faktow daje 0 FP przy 1,0e-7 az do tolerancji 40 mV, a przy 0,75e-7 FP juz od 15 mV, wiec 1,0e-7
  to podloga, nie punkt startowy do dalszego luzowania. Koszt uboczny: wiecej kandydatow = czestsze `ambiguous_analyte_pair`
  (review_required, nie zmiana statusu). Wszystkie 4 zyski etykietowe maja rozstawy par w zakresie bazy i amplitude 10-16 µA.
- Pomiar: `--set A3_TPRA_PROMINENCE_A=1.0e-7 --set A3_ANALYTE_PROMINENCE_A=1.0e-7 --amfa`; dodatkowo grouped 5-fold CV
  po probkach z faktow z ta konfiguracja (nie robilem) i kontrola wizualna 6 zyskow (4 etykiety + Sample(36) + 18_25_4(8)).

## A4 (poza zleceniem, 1 warunek): sanity rozstawu pary (`A4_MAX_PAIR_SEP_V`, domyslnie None; proponowane 0,25 V)

W kroku 7 para TPrA z `E2-E1 > 0,25 V` i w kroku 9 para analitu z `E4-E3 > 0,25 V` sa pomijane (baza: max 193 / 161 mV;
artefakty krawedziowe: 279-620 mV). Zabija CALA rodzine tozsamosci arytmetycznej niezaleznie od filtra krawedzi (z A1 bez
oslon: 195-1D odpada). Na bazie i na amfa 0 zmian. Nie lapie blankow 24032026 (239 mV), od tego jest prog E_min w A1/A2.

## Wyniki (WYKRYTO na 293 pozytywach / FP na 192; amfa: WYKRYTO na 2503 / FP negatywy z raportow poza 73-5)

| konfiguracja | etykiety | amfa | zyski vs baza |
|---|---|---|---|
| V0 baza | 121 / 0 | 161 / 0 | odtworzone 1:1 |
| A1 bez oslon | 122 / 0 | 167 / 0 | 195-1D i 3 blanki = artefakty; 18_25_4(8), 21_25_1(1) prawdziwe |
| A1 (15 mV, 10 pkt) + A4 | 121 / 0 | 162 / 0 | 18_25_4(8) |
| A2 | 121 / 0 | 161 / 0 | brak (bramka) |
| A3 analit / A3 TPrA / oba | 122 / 123 / 125, 0 FP | 162 / 163 / 166, 0 FP | patrz A3 |
| FULL: A1(15/10) + A2(60/15) + A3 oba + A4 | 125 / 0 | 167 / 0 | 4 etykiety, 6 amfa, 0 strat |

## Rekomendacja

1. Wlaczyc A3 (oba progi 1,0e-7) razem z A2 i A4 jako bramkami: +4 etykiety, +5 amfa, 0 FP, 0 strat, bez ruszania tolerancji.
2. A1 tylko z oslonami (15 mV, 10 pkt, fallback, wylacznie do t_neg, ostrzezenie): +1 amfa z raportu, 0 FP. Bez oslon nie wlaczac.
3. 195-1D i 183-3 wykreslic z listy "prawdziwych zyskow krawedziowych" w faktach; to przesuniecie potencjalu (dE_s 0,37)
   i temat decyzji chemicznej o tolerancji, nie detekcji kandydatow.
4. Do zrobienia przed wdrozeniem: kontrola wizualna 7 zyskow FULL, grouped CV na FULL, decyzja o `A1_MIN_TAIL_PTS=7` po
   obejrzeniu 21_25_1(1). Konflikt 73-5 pozostaje nienaruszony przez zadna flage.
