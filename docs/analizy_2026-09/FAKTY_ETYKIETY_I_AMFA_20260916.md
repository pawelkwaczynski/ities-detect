# FAKTY z 16.09.2026: etykiety labu + amfa_probki (do panelu i raportu)

Wszystko policzone tym samym algorytmem co notebook `ITIES_Detect_Colab_MVP.ipynb` (stan 20.08.2026),
headless przez `01_AKTYWNY_notebook/eval_etykiety.py`, `eval_katalog.py`, `grid_etykiety.py`.
Pliki wynikowe: `eval_etykiety_20260916_baseline.csv/json`, `amfa_probki_20260916/przebieg_amfa_probki_baseline.csv`,
`grid_20260916/`, `kontrola_wizualna_20260916.pdf`, `../08_amfa_probki_raporty_20260916/raporty_AMP_stezenia.csv`.

## 1. Zbiór z etykietami (folder „PAWEŁ!!!!", skopiowany do `07_etykiety_lab_20260916/`)
- Pozytywne 293 plików (156 próbek; identyczne bajt w bajt z paczką 27.07), Negatywy 147, Neutrale 45 (wszystkie 45 to `*_blank(N).txt`).
- Negatywy wg treści nazwy: kodeina+TPrA 35, kodeina 33, blank BRB 33, mefedron 9 (w tym 3 z TPrA), HODE 7, zasada 6, Brilliant Blue 6, psylocybina 4, PCE 4, TEA 4, amfetamina BEZ TPrA 3, TMA 3.
- Dwa formaty plików: NOVA średnik/przecinek dziesiętny z kolumnami Scan/Index (141 neg + 37 poz) i tab/kropka 2 kolumny (reszta). Parser obsługuje oba, 0 crashy na 485 plikach, 15 s.

## 2. Wynik bazowy (obecne progi ±10/15 mV, prominencja 1,5e-7 A, filtr krawędzi 8 %)
| klasa | n | WYKRYTO | NIEPEWNE | reszta |
|---|---|---|---|---|
| Pozytywne | 293 | 121 (41,3 %) | 14 (46,1 % łącznie) | MQ_FAIL 60, TPrA_ONLY 57, BRAK 39, sanity 2 |
| Negatywy | 147 | 0 | 0 | MQ_FAIL 97, BRAK 26, TPrA_ONLY 24 |
| Neutrale | 45 | 0 | 0 | MQ_FAIL 45 (brak TPrA) |
- Swoistość na negatywach i neutralach: 100 % (0/192). Najbliższy negatyw z policzonym ΔE_s: kodeina+TPrA pH 7, |błąd| = 40,6 mV. Mefedron+TPrA (pH 3): ΔE_s 0,249–0,251 V (≈100 mV od celu).
- Per PRÓBKA (156): WYKRYTO w którymkolwiek pliku 67 (42,9 %), +NIEPEWNE 73 (46,8 %); wśród 124 próbek, gdzie w jakimkolwiek pliku znaleziono TPrA: 73/124 = 58,9 %.
- Sufit czułości bez zmiany progów: 119/293 plików nie ma pary pików (57 TPrA_ONLY, 54 NO_TPRA_IN_WINDOWS, 5 NO_VALID_TPRA_PAIR, 2 sanity, 1 NO_CANDIDATES).
- Histogram |ΔE_s − 0,350| dla 174 pozytywów z parą: ≤10 mV 121, 10–15 mV 14, 15–20 mV 3, 20–30 mV 12, 30–40 mV 2, 40–60 mV 2, 60–100 mV 20 (to klaster 0,266 V = próbki 239_x).

## 3. Siatka parametrów (prominencja × filtr krawędzi × tolerancja), FP = fałszywe WYKRYTO na 192 neg+neut
- Sama tolerancja (reszta bez zmian): 10 mV 121, 15 mV 135, 20 mV 138, 25 mV 145, 30 mV 150 (51,2 %), 40 mV 152, 50 mV 154 z 3 FP. Do 40 mV włącznie 0 FP.
- Prominencja 1,0e-7 (filtr 8 %): 125 @10 mV, 155 @30 mV, 0 FP. 0,75e-7: 132 @10 mV (0 FP), ale 1–4 FP przy ≥15 mV. 0,5e-7: 4–9 FP przy ≥15 mV.
- Zapas „ramię" (WEAK_PEAK_CANDIDATES=True): 132 WYKRYTO na pozytywach, ale 4 fałszywe WYKRYTO + 1 NIEPEWNE na negatywach, WSZYSTKIE z serii „BRB pH 12" (kodeina i blank), ΔE_s 0,344–0,361, amplituda ~7,8 µA. Zapas zostaje WYŁĄCZONY.
- Filtr krawędzi = 0 (brak): pozornie +37 plików przy prom 1e-7/tol 10 (158), 0 FP na tym zbiorze. KONTROLA WIZUALNA OBALA część zysku: przy oknie skanu 0,10–0,90 V i TPrA przy 0,26/0,38 V para „krawędź 0,10 V + TPrA+" i para „TPrA− + krawędź 0,90 V" daje ΔE_s ≈ 0,345–0,350 przez tożsamość arytmetyczną, nie przez chemię (pliki 4.12, 4.22, 4.39, 5.10, 5.11, 5.1, 5.4, 6.15; „amplituda analitu" 41–83 µA to okno rozpuszczalnika). Ten sam mechanizm da fałszywe WYKRYTO na każdym negatywie z TPrA i takim oknem. Filtr krawędzi ZOSTAJE. Prawdziwe zyski z tej próby: TPrA− przy początku skanu (150_1200ul, 195-1D, 4.73, Komercja_73_4, komercja_183-3, 101_1) — temat do celowanej poprawki, nie do globalnego parametru.
- Grouped 5-fold CV po próbkach (wybór konfiguracji na train przy FP=0, ocena na test): tylko tolerancja → 150/293 = 51,2 %, 0 FP na 192; pełna siatka → 170/293 (58 %) 0 FP, ale wybiera filtr=0, czyli konfigurację obaloną wizualnie. Wniosek: negatywy z labu są „łatwe" dla kryterium ΔE_s (nic w promieniu 40 mV), więc CV nie ogranicza tolerancji; ogranicza ją chemia (decyzja Łukasza).

## 4. amfa_probki (Desktop): 3952 plików, w tym 1406 .nox (binarne NOVA, nieczytelne), 2503 txt/bez rozszerzenia, 39 PDF raportów labu, 1 xlsx, 1 pptx, 1 zip (Ola Mikołajczyk, amfetamina+metamfetamina 2023)
- 313 z 2477 unikalnych txt pokrywa się bajt w bajt ze zbiorem etykiet; 2164 to nowe, nieetykietowane pliki.
- Przebieg 2503 plików, 41 s, 0 crashy: MQ_FAIL 2090, WYKRYTO 161, TPrA_ONLY 89, too_few_points 68 (artefakty zapisu 82–84 B, głównie komercja_21112024), BRAK 63, NIEPEWNE 24, sanity 7, invalid 1.
- 959 plików z „blank" w nazwie: 875 MQ_FAIL, 56 too_few, 11 WYKRYTO + 8 NIEPEWNE. Kontrola wizualna: te 19 to PEŁNE sygnały (TPrA + para analitu, 10–37 µA); „blank(N)" to autonumeracja NOVA po dodaniu próbki, nie etykieta. Nazwa pliku NIE jest prawdą odniesienia.
- Raporty labu (39 PDF, tabele „Nazwa próbki / Stężenie %"): 201 wierszy, 193 próbek: 178 pozytyw (% > 0), 13 „nie wykryto/nie stwierdzono", 4 „brak amfetaminy, obecność innej substancji psychotropowej" (239-1, 239-3, Ł-1, Ł-2), 4 niekonkluzywne (239-2, 37_2_16, 37_3, 67_2), 2 „< 0,1 %" (110-1, 110-2).
- Dopasowanie nazw plików do próbek z raportów (ścisłe, bez plików blank): 634 pliki, 108 próbek.
  - 239-1 i 239-3 (raport 19.12.2024: brak amfetaminy, inna substancja): 21 plików BRAK z ΔE_s 0,266–0,33, 0 WYKRYTO. Algorytm ma rację; w zbiorze „Pozytywne" z 27.07 te pliki liczą się jako fałszywe negatywy. Etykieta pozytywów jest zaszumiona (potwierdzenie hipotezy Łukasza z 12.08).
  - Negatywy wg raportu z policzonym ΔE_s: 77-2 (3 pliki, ΔE_s 0,265–0,298, amplituda 43–47 µA: silny sygnał innej substancji), 77-1 BRAK 0,2685. JEDEN konflikt: **73-5** (raport 11.04.2025 „nie wykryto"), plik `Komercja 10.04/73-5_500ul_20ul_TPrA.txt` → WYKRYTO ΔE_s 0,3515, amplituda 29,7 µA; wykres wygląda jak pełny sygnał amfetaminy. Do wyjaśnienia z Łukaszem (carry-over? inna próbka pod tą nazwą? inna substancja o tym samym ΔE_s?).
  - 110-2 („< 0,1 %"): 2 pliki WYKRYTO, amplituda 40 µA przy 1500 µL próbki (jakościowo tak, ilościowo poniżej LOQ; zgodne).
  - Pozytywy wg raportu: 96 próbek dopasowanych; 51 ma jakikolwiek plik z TPrA; z nich 48 (94 %) dało WYKRYTO/NIEPEWNE. Pozostałe 45 próbek mają w amfa_probki tylko pliki bez TPrA (pomiar przed dodaniem wzorca) → MQ_FAIL zgodnie z projektem. 3 próbki z TPrA bez wykrycia: 66_1 (12,0 %!), 200-1D (2,7 %), 18/25/4 (3,3 %).

## 5. Co z tego wynika (moja ocena, do sprawdzenia przez panel)
1. Progi ±10/15 mV nie generują fałszywych WYKRYTO na 192 próbach ślepych ani na negatywach z raportów (poza 73-5, do wyjaśnienia). Dotychczasowy zakaz strojenia progów traci uzasadnienie „brak negatywów", ale zostaje uzasadnienie chemiczne: czy ΔE_s 0,32–0,38 to nadal amfetamina.
2. Główna rezerwa czułości nie siedzi w tolerancji (max +29 plików), tylko w 119 plikach bez pary: TPrA− przy krawędzi skanu i słabe piki. To wymaga celowanej zmiany detekcji kandydatów, z osłoną przed oknem rozpuszczalnika, nie globalnego luzowania.
3. Etykiety pozytywów z 27.07 zawierają co najmniej 20 plików bez amfetaminy (239_x). Czułość na oczyszczonym zbiorze do przeliczenia po decyzji, co z nimi zrobić (przenieść do negatywów „inna substancja").
4. Zapas „ramię" ma zmierzoną swoistość 97,3 % (4/147 FP) i to jest za mało dla narzędzia policyjnego; zostaje wyłączony.

## 6. KOREKTY po krytyce panelu (17:30, sprawdzone ponownie na danych)
1. **Szum etykiet to 4 próbki, nie 2.** Klaster 60–100 mV w Pozytywnych = 20 plików: 16 × 239_x (8 × 239_1, 8 × 239_3_5),
   3 × 77-x (`77-1_30ul_20ul_TPrA.txt`, `Komercja_77_2_40uL_TRrACl_20uL.txt` i `(2)`), 1 × `tprl1.txt` (nieznana próbka).
   Raporty labu: 239-1 i 239-3 „brak amfetaminy, inna substancja", 77-1 i 77-2 „nie wykryto" (11.04.2025). Wszystkie cztery
   leżą w folderze Pozytywne. Czyli co najmniej 19 plików z 4 próbek to nie amfetamina, plus 1 plik niewiadomy.
2. **Swoistość „0/192" ma mały mianownik dla kryterium ΔE_s.** Tylko 26 negatywów w ogóle dostało ΔE_s: 23 × kodeina+TPrA
   (pH 2–9) i 3 × mefedron+TPrA (pH 3). To DWIE substancje, nie dwanaście. 24 negatywy = TPrA_ONLY, 97 = MQ_FAIL, 45 neutrali = MQ_FAIL.
   Górna granica 95 % (Wilson) dla 0/26 to ok. 13 %, dla 0/50 ok. 7 %, dla 0/192 ok. 2 %. Uczciwe zdanie: „0 fałszywych WYKRYTO
   na 192 plikach, z czego 26 z dwóch substancji przeszło do kryterium ΔE_s". Dodatkowo 3 „negatywy" `10 mM NaCl amf 200` to
   amfetamina bez wzorca (chemicznie pozytyw); w mianowniku są jako negatywy, bo bez TPrA algorytm nie ma prawa wykryć.
3. **Fałszywy wzorzec (nowy tryb błędu).** 15 negatywów BEZ TPrA w nazwie dostało status „TPrA znaleziony" (TPrA_ONLY/BRAK):
   kodeina pH 11–12 (5), blank BRB pH 12 (3) i pH 5 (3), TEA 200 (4), amplituda „TPrA" 4,4–14,4 µA. Albo nazwy kłamią, albo w oknie
   TPrA (0,20–0,45 V fwd / 0,05–0,35 V bwd) siedzi inny pik. To tłumaczy 4 fałszywe WYKRYTO zapasu „ramię" w serii pH 12:
   fałszywy wzorzec + ramię = fałszywa amfetamina. Detektor wzorca nie ma dziś żadnego testu tożsamości TPrA poza oknem potencjału.
4. **Dwa WYKRYTO mają ujemne Ip wzorca** (`komercja_20uLTPrA_100uL_7-25-2.txt` −1,42 µA, `komercja_500_20ultpra_46-1.txt` −1,22 µA):
   błąd linii bazowej albo pary; do kontroli wizualnej.
5. **Blanki w amfa_probki**: 959 = 875 MQ_FAIL + 56 too_few + 11 WYKRYTO + 8 NIEPEWNE + 6 TPrA_ONLY + 2 BRAK + 1 sanity (w pkt 4 brakowało 9).
6. **Raporty: 201 wierszy to nie 193 próbki.** 7 ID ma więcej niż 1 wiersz, w tym 238-1: 0,3 % (19.12.2024), „nie stwierdzono" (20.11.2025),
   1,3 % (21.11.2025). ID próbki bez daty raportu nie identyfikuje próbki. Dopasowanie plik→raport wymaga daty (folder amfa_probki ma daty).
7. Liczba próbek: pozytywy 154 wg klucza `probka` w CSV (156 w tekście z 27.07 to inny klucz), negatywy 48 ID, neutrale 44 ID.
8. `shift` (kalibracja osi po TPrA) na 283 plikach: −0,478…−0,293 V, mediana −0,413. 185 mV rozrzutu = gotowa cecha dryfu aparatury,
   nikt jej dotąd nie skorelował z datą, serią ani statusem.

## 7. Dwa tanie sprawdzenia z planu panelu (18:15, bez modeli)
1. **Procedury w 1406 plikach .nox** (`strings`): 1404 „Cyclic voltammetry potentiostatic", 2 „Chrono amperometry". Cottrell do artykułu #2 wymaga NOWYCH pomiarów
   chronoamperometrycznych; w archiwum praktycznie ich nie ma.
2. **Kodeina + TPrA, ΔE_s w funkcji pH** (23 pliki, pH 2–9): plateau 0,266 V (pH 2–5), wzrost od pH 6, 0,307 V przy pH 7, 0,41 V przy pH 9.
   Sigmoida: lo 0,266 V, hi 0,422 V, pozorne pKa 7,58, RMSE 4,0 mV. **Kodeina trafia w 0,350 V przy pH ≈ 7,67** (pasmo ±10 mV: pH 7,52–7,81).
   Wniosek: przy pH bliskim fizjologicznemu kodeina z TPrA jest nieodróżnialna od amfetaminy kryterium ΔE_s. pH robocze procedury to pytanie nr 1 do Łukasza.

## 8. Czysta amfetamina (pytanie Pawła, 19:55)
- Wzorce kalibracyjne CC (27 plików, 28–169 µM): skan 0,40–0,85 V, BEZ wzorca TPrA (okno wzorca leży poza skanem) → algorytm daje MQ_FAIL zgodnie z projektem;
  kalibracja liczona osobno z piku amfetaminy przy 0,71 V (`kalibracja_cc.py`). Jedyny plik CC z wzorcem: `CC_60uL_MI 40uL_Scan3.txt` (168,5 µM) → WYKRYTO, ΔE_s 0,3589 V (+8,9 mV), shift −0,401 V.
- amfa_probki/AMF (118 plików: AMF w pH 2, AMF + kofeina, „sama AMF", 2023): wszystkie bez TPrA → 116 MQ_FAIL, 1 BRAK, 1 sanity. Etykiety: `10 mM NaCl amf 200` ×3 bez TPrA → MQ_FAIL.
- Wniosek: w całym archiwum jest DOKŁADNIE JEDEN pomiar czystej amfetaminy z wzorcem wewnętrznym. Seria wzorców z TPrA (5–8 stężeń × 3 powtórzenia) to brakujący
  pomiar nr 1: bez niej nie da się zmierzyć czułości na czystym analicie ani sprawdzić hipotezy „ΔE_s rośnie ze stężeniem" (jedyny punkt: +8,9 mV przy 169 µM).

## 9. Trzy NIEZALEŻNE implementacje detektora na tej samej paczce danych, 16.09 23:00
Etykiety poprawione (`labels.csv`, label_S1): 271 pozytywów, negatywy+neutrale wg każdej z prac różnie liczone (195–211), 3 SPOR, 13 konfliktów.
| implementacja | WYKRYTO na 271 pozytywach | fałszywe WYKRYTO | walidacja |
|---|---|---|---|
| nasz v1.1 (eksport bazowy) | 120 (44,3 %, Wilson 38,5–50,2) | 0/211 (i 0/195, 0/200 wg mianownika) | reguła bez strojenia |
| Model A (przebieg 1, detector.py, nested CV 5-fold po próbkach, 37 testów) | 115 (42,4 %) | 1/211 (seria HODE, silnie zakłócona krzywa) | out-of-fold, 56 negatywów doszło do ΔE_s |
| Model A (przebieg 2, my_algorithm.py, 5-fold grupowane) | 119 (43,9 %), +11 NIEPEWNE | 0/200; 12/200 doszło do ΔE_s | out-of-fold |
| Model B (my_algorithm.py, stałe z protokołu, bez strojenia) | 119 (43,9 %), +9 NIEPEWNE | 0/195; 29/195 doszło do ΔE_s | GroupKFold jako kontrola |
Wniosek: cztery niezależne detektory (nasz + 3 od zera) zbiegają się do 42–44 % per plik przy 0 (raz 1) fałszywych. Sufit siedzi w danych (pliki bez użytecznego
wzorca albo bez pary), nie w algorytmie. Elementy wspólne trzech nowych implementacji, warte przeniesienia: test tożsamości TPrA jako PARY (forward + reverse, ΔE_p 40–280 mV),
margines krawędzi w mV (28–40 mV) zamiast w % punktów, rozdzielenie „jakość pomiaru" od „chemia" w statusach, mianownik „ile doszło do ΔE_s" raportowany obok.
Przebieg 1 przerwany limitem (edycje detector.py/reporting.py/run_eval.py niedokończone); stan sprawdzany testami (pytest + run_eval --skip-plots) w tle.

## 10. Zip 2023–24 (Ola Mikołajczyk): czysta amfetamina 25 µM vs pH, bez wzorca (`zip2023_20260916/RAPORT_ZIP2023_AMF_pH.md`)
- 322 pliki: 250 CV + 49 DPV (te 49 to „invalid" w naszym parserze, bo kolumna prądu to delta.Current; DPV nie wchodzi do tabel) + blanki; 17 wartości pH 2–11
  (poprzedni szybki przebieg mylił pH z nazwy folderu). `_spw` = ten sam skan obcięty do okna 0,40–0,80 V.
- Po odjęciu uśrednionego blanku pik amfetaminy (okno 0,45–0,85 V): E_pik 0,678 V (pH 2) → 0,72 V (pH 3–5) → 0,67–0,70 V (pH 6–8) → 0,749 V (pH 9) → 0,757 V (pH 9,25);
  przy pH ≥ 9,67 pik ucieka poza okno 0,85 V (cenzurowanie). I_pik 2,4–6,2 µA przy 25 µM. Sigmoida: pozorne pKa 8,8 ± 0,25 (R² 0,50), zaniżone przez cenzurowanie (literatura 9,9–10,1).
- AMF+MET (25+25 µM) vs AMF: prąd wyższy o ~3,0 µA (12/12 pH), pik szerszy o ~24 mV (11/12), przesunięcie E ~−14 mV: obraz nakładania dwóch pików, nie przesuwania.
- Pod SR: 12–14 czystych punktów pH, szum E_pik kilka mV, monotoniczna zależność typu Nernst/Henderson–Hasselbalch, ale do sensownego dopasowania trzeba pomiarów > pH 9,5
  w szerszym oknie E i z wzorcem TPrA. Bez tego to materiał ilustracyjny, nie wynik.

## 11. PeakWise zbudowany (`10_peakwise_web_20260916/BUILD_REPORT.md`)
- Algorytm z notebooka (komórka SETUP, 609 linii) zamrożony 1:1; 7/7 wierszy `cv_wyniki_zbiorcze.csv` odtworzone co do znaku (20 kolumn).
- Walidacja vs tabela Bartka, 45 elektrod, ostatni skan: Ip_a 1,1 % (n 45/45/0), Ip_c 3,2 % (n 43/43/0; 2,81 % z 20.08 = to samo przy n=42, bez elektrody odzyskanej fallbackiem plateau).
  Odstające: `2 mm b` +18,4 %, `13,39 B` +49,2 % (znany błąd tabeli).
- Parytet Pyodide vs CPython: 187/188 identyczne co do pola; 1 plik w granicy remisu (Savitzky–Golay w WASM różni się na ostatnich bitach, find_peaks wybiera sąsiedni punkt:
  Ep_c 2,44 mV, Ip_c 0,025 %); bramka przepuszcza tylko ≤ 5 mV / ≤ 0,1 % / ten sam status. Test umie zawieść (156/188 różnic po podmianie definicji Ip).
- UI: lista elektrod, karta Ip/Ep/ΔEp z metodą odczytu i jakością bazowej, wykres jak w notebooku (3 gałęzie, bazowe, styczne), CSV = kolumny notebooka, raport do druku,
  EN/PL, motywy, wgrywanie folderu, auto-analiza. Brak: ręczna korekta Ep (komórka 12 notebooka). Wpięcie do huba: `HUB_INTEGRATION.md` (3 kopie + 1 diff kafelka).
