# Wersje algorytmu ITIES Detect (komórka `def analyze` notebooka)

Identyfikacja wersji: SHA-256 (pierwsze 16 znaków) źródła komórki kodu zawierającej `def analyze`
w `ITIES_Detect_Colab_MVP.ipynb`. Każda zmiana kodu = nowy wpis tutaj + backup `*.BACKUP_YYYYMMDD.ipynb`.
Ta lista jest źródłem dla strony „Historia wersji" w aplikacji webowej.

| Wersja | Data | SHA-256 komórki | Plik | Co zmieniono | Wpływ na liczby |
|---|---|---|---|---|---|
| 0.9 | 2026-07-27 | (backup 20260820: a6a4a3ffe74f2e4c) | `ITIES_Detect_Colab_MVP.BACKUP_20260820.ipynb` | stan po paczce 27.07: ostatni cykl, baseline `_flattest_segment`, ilościówka, kalibracja 0,123 domyślna | czułość 41,3 % (121/293), 0 crashy |
| 1.0 | 2026-08-20 | 6441a50259121dce | `ITIES_Detect_Colab_MVP.BACKUP_20260916.ipynb` (= stan 20.08) | Ip dwiema procedurami (bramka kształtu, `tangent_intersection`), zapas „ramię" jako flaga OFF | 0 zmian statusu na 565 plikach, CC −0,5 % vs lab |
| 1.1 | 2026-09-16 | f987de43c21bafe6 | `ITIES_Detect_Colab_MVP.ipynb` (aktywny) | LOD/LOQ z aktywnej kalibracji + `below_lod`; diagnostyka wyboru pary (`pair_selection_diag`, `n_par_sanity`, `second_best_error_mV`); bramka w generatorze notebooka; testy z twardym kodem wyjścia | 0 różnic w status/ΔE_s/Ip/review_required na 485 plikach z etykietami i na 272 plikach regresyjnych; tylko nowe ostrzeżenia i kolumny |

Zmierzone na v1.0 = v1.1 (16.09.2026, zbiór z etykietami labu): pozytywy 121/293 WYKRYTO, 14 NIEPEWNE;
negatywy 0/147 fałszywych WYKRYTO; neutrale 0/45. Szczegóły: `../wyniki_analizy/FAKTY_ETYKIETY_I_AMFA_20260916.md`.

Warianty eksperymentalne (flagi, poza notebookiem): `../wyniki_analizy/eksperyment_20260916/`.
