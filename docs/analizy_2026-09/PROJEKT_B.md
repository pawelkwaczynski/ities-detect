# PROJEKT B: wybor pary i decyzja (flagi B1, B2, B3), 16.09.2026

Metoda: zamrozony `ities_algo_base.py` (A) nietkniety. Implementacja referencyjna flag: `variant_b.py`
(`analyze_b`, `branch_peaks_v`, `branch_noise`), harness `run_b.py`, porownanie `analiza_b.py`, wyniki `run_b_<zbior>_<tag>.csv`,
logi `log_*.txt`, rysunki `kontrola_B_4pliki.png`. Parytet przy wszystkich flagach wylaczonych: 485 plikow, 0 zmian statusu,
0 rozjazdow dE_s wzgledem bazy; amfa (634 dopasowane) 0 zmian; CC 0 zmian. Wszystko przez `nice -n 10`, 16 s na przebieg.

| konfiguracja (etykiety 293/147/45) | WYKRYTO poz | NIEPEWNE poz | falszywe WYKRYTO | NIEPEWNE neg | amfa: neg z raportow WYKRYTO/NIEPEWNE |
|---|---|---|---|---|---|
| baza (prom 1,5e-7, krawedz 8 %) | 121 | 14 | 0 | 0 | 73-5 (znany konflikt) |
| B1 same okna | 121 | 14 | 0 | 0 | 73-5 |
| B1 + B2 prom + ambig 10 mV (baza prom) | 121 | 14 | 0 | 0 | 73-5 |
| prom 1,0e-7 (bez B) | 125 | 14 | 0 | 0 | 73-5 |
| prom 1,0e-7 + B1 + B2 prom | 125 | 14 | 0 | 0 | 73-5; poz +73-4 |
| prom 0,75e-7 (bez B) | 132 | 14 | 0 | 1 (BRB pH 6 kodeina 3, dE_s 0,363) | 73-5 |
| prom 0,75e-7 + B1 + B2 prom | 132 | 14 | 0 | 0 | 73-5; poz +73-4 |
| prom 0,5e-7 + B1 + B2 prom | 133 | 14 | 0 | 3 (BRB pH 12 kodeina, dE_s 0,360-0,362) | nie liczone |
| B3 savgol K=3 lub 5 (bez podlogi) | 129 | 14 | 0 | 3 (BRB pH 12) | nie liczone |
| B3 savgol K=5, podloga 1,0e-7 | 123 | 14 | 0 | 0 | nie liczone |

## B1. Fizyczne okno separacji pary (flaga `B1_SEP_WINDOW`, domyslnie False)
Hipoteza: prawdziwa para pikow (analit+ na forward, analit- na backward) ma separacje rzedu 60-150 mV; pary
"z tozsamosci arytmetycznej" (krawedz skanu + pik) maja separacje 270-650 mV. Okno odrzuca je PRZED wyborem pary.
Rozklad |E4-E3| (mV): 121 WYKRYTO: min 19,5 (jeden plik 4.74_1400ul), p1 40,0, p5 53,7, p25 73,2, med 87,9, p75 97,7,
p95 124,5, p99 143,6, max 161,1. 14 NIEPEWNE: 61-161. 26 negatywow z para: 63,5-105,1. CC (26 skanow kalibracyjnych,
amfetamina bez TPrA, para = najprominentniejszy pik fwd i bwd): min 74, p5 88, med 111, p95 149, max 151; separacja
rosnie ze stezeniem (10 uL: 88, 60 uL: 147-151), wiec gorna granica musi miec zapas nad 161.
Rozklad |E2-E1| TPrA (mV): 121 WYKRYTO: min 68,4, p5 80,6, med 102,5, p95 136,7, max 192,9. NIEPEWNE 100-188.
TPrA_ONLY (81 plikow) 73-190. 26 negatywow 59,5-107,4. W amfa dwa pliki z sepT 39,0 (213-1 NIEPEWNE, 160_2b(56) BRAK).
Okna: `SEP_A_MIN=0.015, SEP_A_MAX=0.200` (zapas 39 mV nad max), `SEP_T_MIN=0.030, SEP_T_MAX=0.230` (zapas 37 mV nad max;
artefakty krawedziowe mialy sepT 266-281, sepA 623-647, wiec sa odrzucane z zapasem ok. 36 mV i 420 mV).
Zmiana w kodzie (`analyze`, krok 7): po `if not (SHIFT_MIN <= sh <= SHIFT_MAX) or E2r <= E1r: continue` dodac
`if B1_SEP_WINDOW and not (SEP_T_MIN <= E2r - E1r <= SEP_T_MAX): continue`. Krok 9 i 9b: po `if E4c <= E3c: continue`
dodac `if B1_SEP_WINDOW and not (SEP_A_MIN <= E4c - E3c <= SEP_A_MAX): continue`. Gdy wszystkie pary odpadna, status
NO_VALID_ANALYTE_PAIR z dopiskiem "ani okna separacji" (licznik odrzuconych par w wyniku, do panelu).
Co odzyska: samo nic (121 -> 121, 0 zmian statusu WYKRYTO/NIEPEWNE, jedyna zmiana: 48-1_100ul BRAK -> sanity, sepA 212).
To straznik pod luzowanie innych parametrow: (a) przy prom 0,75e-7 usuwa NIEPEWNE na negatywie BRB pH 6 kodeina 3
(para sepA 273,7 mV, prom4 84 nA); (b) przy filtrze krawedzi 0 usuwa wszystkie 8 artefaktow z FAKTOW (4.12, 4.22, 4.39,
5.10 x2, 5.11, 5.1, 5.4) oraz 195-1D, ktore w FAKTACH uchodzi za prawdziwy zysk, a jest artefaktem: punkt 1 lezy na
krawedzi skanu 0,200 V, para analitu ma sepA 468,8 mV (rysunek `kontrola_B_4pliki.png`, prawy gorny).
Co moze zepsuc: (a) `SEP_A_MIN=0.030` traci 4.74_1400ul (sepA 19,5 mV; na rysunku oba piki realne, ale para nietypowo
waska, do oka eksperta); (b) `SEP_T_MIN=0.040` traci w amfa NIEPEWNE 213-1 i BRAK 160_2b(56) (sepT 39 mV, TPrA- o
prominencji 173 nA przy TPrA+ 3445 nA, czyli para watpliwa, ale to strata NIEPEWNE na pozytywie z raportu);
(c) B1 NIE naprawia zlej pary TPrA o wiarygodnej separacji: przy filtrze krawedzi 0 para (0,210 fwd, 0,100 bwd = krawedz)
ma sepT 110 mV i wygrywa prominencja, przez co 2.45, 90-2 i 4.74 spadaja do BRAK. Luzowanie krawedzi to temat A.
Jak zmierzyc: `run_b.py --dataset labels --set B1_SEP_WINDOW=True` (oczekiwane 121/0/0), test zdolny zawiesc:
`--set SEP_A_MIN=0.030` musi dac 120 (strata 4.74); `--set EDGE_FRAC=0 --set EDGE_MIN_PTS=0` bez B1 daje 3 sanity na
negatywach i 8 artefaktow WYKRYTO/TPrA_ONLY, z B1 zero artefaktow. Amfa: `--dataset amfa --set B1_SEP_WINDOW=True`
(94 WYKRYTO, 10 NIEPEWNE, 0 strat na pozytywach, tylko 239_1(16) BRAK -> sanity, sepA 222).
26 negatywow z dE_s: sepA 63,5-105,1 i sepT 59,5-107,4 leza w oknach, 0 zmian, najblizszy nadal 40,6 mV.

## B2. Wybor pary po prominencji i bramka niejednoznacznosci (`B2_PAIR_MODE`, `B2_AMBIG_MV`)
Fakt bazowy: w 202 plikach z para (121+14+39 poz, 26 neg, 2 sanity) kandydat analit+ jest ZAWSZE jeden (n_a_pos=1),
analit- jeden lub dwa, a par spelniajacych E4>E3 jest dokladnie jedna. Wybor "najblizej celu" nigdy nie wybiera
sposrod alternatyw, wiec przy prom 1,5e-7 B2 jest operacja pusta (przebieg base_B2p: 121/0/0, 0 flag). B2 nie moze
zwiekszyc liczby WYKRYTO: wybor po min |srodek - 0,259| jest wyborem o maksymalnej czulosci, kazdy inny tylko odejmuje.
Zmiana w kodzie (`analyze`, krok 9): zamiast petli z `best_score` zbudowac liste `pairs` (c3, c4, err, prom=c3.prom+c4.prom).
Tryb `target` = baza; `prom` = `max(pairs, key=prom)`, potem `decision` na jej dE_s; `hybrid` = wsrod par z err <= 15 mV
najbardziej prominentna, gdy brak takich jak `target`. Po `build_result`: jesli status detected i istnieje inna para
(rozna choc jednym pikiem) z err2 - err1 < B2_AMBIG_MV/1000, status -> uncertain, kod `b2_ambiguous_pair` (ostrzezenie 9b
`ambiguous_analyte_pair` zostaje bez zmian). Kolejnosc: najpierw B1 (okno), potem B2 (wybor).
Co odzyska: nic bezposrednio. Przy obnizonej prominencji dziala jak straznik: prom 0,75e-7 tryb `prom` zamienia
NIEPEWNE negatywu BRB pH 6 kodeina 3 na BRAK (para najprominentniejsza ma err 81 mV, para "przy celu" to pik 84 nA o
sepA 274), bez strat na pozytywach (132 -> 132). Tryb `hybrid` tego nie robi (jedyna para w pasmie jest ta sama).
Flaga ambig 10 mV: 0 flag w bazie, przy 1,0e-7 i 0,75e-7; 1 flaga przy 0,5e-7 hybrid (4.73_1300uL, druga para 8,2 mV).
Co moze zepsuc: przy nizszym progu, gdy pik-smiec jest prominentniejszy od analitu, tryb `prom` da BRAK zamiast WYKRYTO;
zmierzone 0 takich strat przy 1,0/0,75/0,5e-7. Tryb `prom` nie pomaga na negatywy z JEDNA para (BRB pH 12 przy 0,5e-7).
Jak zmierzyc: `--set PROM_A=0.75e-7 --set B2_PAIR_MODE=prom --set B2_AMBIG_MV=10` vs bez B2 (1 NIEPEWNE neg -> 0);
`--set B2_PAIR_MODE=prom` przy bazie musi dac identyczne 121/0/0 (parytet). 26 negatywow: n_pairs=1, 0 zmian.

## B3. Prog prominencji wzgledem szumu (`B3_ADAPTIVE_PROM`, `B3_K`, `B3_NOISE`, `B3_FLOOR_A`, `B3_CAP_A`)
Zmiana w kodzie (`branch_peaks`): `prominence=PEAK_PROMINENCE_A` -> `prominence=thr`, gdzie
`thr = clip(B3_K * sigma, B3_FLOOR_A, B3_CAP_A)`, sigma = SD(surowy - savgol) we wnetrzu galezi (bez krawedzi 8 %);
alternatywy zmierzone: SD reszt fitu liniowego na najplaskszym odcinku 80 mV (`flat_fit`, zawiera krzywizne tla) i MAD
roznic (`mad_diff`). Szum savgol (nA, fwd): pozytywy med 7,1 (p95 36), negatywy med 14,0 (p95 51), neutrale med 4,4;
prom4 WYKRYTO min 158 nA, p5 257; prom4/szum WYKRYTO min 6,4, p5 30, med 138.
Wynik: K=3 i K=5: 129 WYKRYTO (+9, strata 107-1A_200ul: szum bwd 877 nA daje prog 4,4 uA > prom3 1982 nA) i 3 NIEPEWNE
na negatywach BRB pH 12 kodeina (prom4 70-75 nA przy szumie 5-10 nA, czyli realny maly pik 7-15x nad szumem, nie szum).
K=8: 123 i 2 NIEPEWNE neg; K=12: 121 i 2 NIEPEWNE neg (prog rosnie u pozytywow, a u cichych negatywow dalej spada
do podlogi). Podloga 1,0e-7, K=5: 123 (+3, strata 107-1A), 0 NIEPEWNE neg. K=3, podloga 1,0e-7, sufit 1,5e-7: 124, 0 strat,
0 NIEPEWNE neg, czyli stala 1,0e-7 minus jeden plik (4.73). `mad_diff` K=5: 108 (-13). `flat_fit` K=3: 118 (-3).
Ocena: NIE jest bezpieczniej. Faza "falszywa para" u negatywow to male, ale realne piki kodeiny (BRB pH 12), ktorych
zaden mnoznik szumu nie odsiewa, a stala podloga tak: prom4 tych plikow 70-75 nA, najslabszy prawdziwy zysk przy 1,0e-7
ma prom4 118 nA (101_1). Stala 1,0e-7 siedzi 25 nA nad negatywami i 18 nA pod zyskiem; 0,75e-7 ma zapas 0-5 nA nad
negatywami (BRB pH 12 nr 2: 75 nA), za malo jak na narzedzie policyjne. Rekomendacja: B3 wylaczone na stale; jesli A
obniza prog, to do stalej 1,0e-7 (+4: 150_1200ul, 4.73, 101_1, 73_4; 0 FP, 0 NIEPEWNE neg; amfa +73-4, 0 nowych
konfliktow z raportami) pod straza B1 + B2 prom. 0,75e-7 (+11) dopiero po wyjasnieniu z Lukaszem serii BRB pH 12 i pH 6.
Jak zmierzyc: `--set B3_ADAPTIVE_PROM=True --set B3_K=5 --set B3_NOISE=savgol_resid [--set B3_FLOOR_A=1.0e-7]`.
26 negatywow: pary silne (prom4 >= 255 nA, prom3 >= 1837 nA), przy kazdym K te same pary, 0 zmian; przy 0,75e-7 trzy
pliki BRB pH 6 dostaja nowe pary z err 13-23 mV (jeden NIEPEWNE), B1 albo B2 prom przywracaja stan bazowy.

## Wniosek
1. B1 i B2 prom + ambig 10 mV wlaczyc razem jako straznik: przy bazie 0 zmian (121/14/0/0, amfa 94/10, 73-5 bez zmian).
2. Zysk czulosci nie siedzi w wyborze pary (zawsze jedna para), tylko w progu kandydatow (temat A): 1,0e-7 daje +4 bez
   kosztu; B1+B2 sa warunkiem, zeby ten prog nie produkowal par z krawedzi i pikow 80 nA.
3. Cztery z szesciu "prawdziwych zyskow" z FAKTOW (150_1200ul, 4.73, 101_1, 73_4) odzyskuje sam prog 1,0e-7 przy
   filtrze krawedzi 8 %; 195-1D to artefakt krawedzi; zostaje 183-3 (do sprawdzenia przez A).
4. Wykrycie bazowe 4.74_1400ul (sepA 19,5 mV) zostawiam (okno od 15 mV), ale oznaczam do oka eksperta.
