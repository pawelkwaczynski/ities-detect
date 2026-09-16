# ITIES: raport z sesji 16.09.2026 (kroki 1–4)

Autor: Paweł. Wszystkie liczby policzone skryptami w `01_AKTYWNY_notebook/` na danych z `07_etykiety_lab_20260916/`,
`amfa_probki` (Desktop) i `08_amfa_probki_raporty_20260916/`. Pełne fakty z korektami: `FAKTY_ETYKIETY_I_AMFA_20260916.md`.
Panel trzech niezależnych recenzji + krytyk + synteza: `panel_20260916/SYNTEZA_PANEL_20260916.md`.

## 1. Najkrócej
1. **Negatywy są i program ich nie myli z amfetaminą.** 0 fałszywych WYKRYTO na 147 negatywach i 45 neutralach. Uczciwe zastrzeżenie: tylko 26 negatywów
   (kodeina+TPrA, mefedron+TPrA) doszło do kryterium ΔE_s, reszta odpada wcześniej z braku wzorca; górna granica błędu (95 %) dla 0/26 to ok. 13 %.
2. **Czułość bez zmian: 41,3 % per plik (121/293)**, ale per próbka z wzorcem 58,9 % (73/124), a na próbkach z raportów labu z wzorcem 94 % (48/51).
   Rezerwa nie siedzi w progu ΔE_s (max +29 plików), tylko w 119 plikach bez pary pików.
3. **Naukowcy nie zawsze wskazali amfetaminę.** Raporty labu mówią, że 4 próbki z folderu „Pozytywne" (239-1, 239-3, 77-1, 77-2; 19 plików) to „brak amfetaminy"
   albo „nie wykryto". Algorytm daje im BRAK, czyli ma rację. Jeden konflikt w drugą stronę: 73-5.
4. **Program dopracowany bezpiecznie (v1.1):** LOD/LOQ z aktywnej kalibracji, diagnostyka wyboru pary, bramka w generatorze, testy, które umieją zawieść.
   0 różnic w liczbach na 485 + 272 plikach (sprawdzone dwiema metodami).
5. **ML: nie jako detektor. SR: nie na tych krzywych.** Zgoda trzech mózgów. Najbliższy sensowny wzór z danych na dysku: ΔE_s kodeiny w funkcji pH.
6. **Aplikacja:** algorytm działa 1:1 w przeglądarce (Pyodide), Frog tylko serwuje pliki; StudentSpot zarchiwizowany (41 MB, SHA zapisane); budowa huba i ITIES Detect trwa.

## 2. Krok 1: zbiór z etykietami (folder „PAWEŁ!!!!")
| klasa | pliki | próbki | wynik programu (v1.0 = v1.1) |
|---|---|---|---|
| Pozytywne | 293 (= paczka 27.07 co do bajtu) | 154 | WYKRYTO 121 (41,3 %), NIEPEWNE 14, BRAK 39, TPrA_ONLY 57, MQ_FAIL 60, sanity 2 |
| Negatywy | 147 | 48 | WYKRYTO 0, NIEPEWNE 0, BRAK 26 (ΔE_s policzone), TPrA_ONLY 24, MQ_FAIL 97 |
| Neutrale (blank) | 45 | 44 | MQ_FAIL 45 (brak wzorca, zgodnie z projektem) |

- Najbliższy negatyw: kodeina+TPrA pH 7, 40,6 mV od celu. Mefedron+TPrA: ok. 100 mV od celu. **Ale** kodeina+TPrA przy pH 9 leży 57,6 mV PO DRUGIEJ stronie celu,
  więc między pH 7 a 9 przechodzi przez 0,350 V. Pytanie o pH robocze procedury jest pierwsze na liście do Łukasza.
- Krzywa tolerancji (ten sam wybór pary): 10 mV 121, 15 mV 135, 20 mV 138, 25 mV 145, 30 mV 150 (0 FP do 40 mV; 50 mV daje 3 FP). Grouped CV po próbkach: 51,2 % przy 0 FP.
  **Decyzja: progi w produkcie zostają ±10/15 mV.** Poszerzenie pasma NIEPEWNE do 30 mV jest policzalne, ale zależy od chemii (pH, czy 0,32–0,38 V to nadal amfetamina), nie od danych.
- Zapas „ramię": 4 fałszywe WYKRYTO + 1 NIEPEWNE (seria BRB pH 12) → zostaje wyłączony.
- Siatka prominencja × filtr krawędzi × tolerancja (80 konfiguracji): prominencja poniżej 1,0e-7 daje FP; **filtr krawędzi = 0 daje pozorne +37 plików, obalone wizualnie**:
  para „krawędź 0,10 V + wzorzec" i „wzorzec + krawędź 0,90 V" daje ΔE_s ≈ 0,35 V przez arytmetykę okna skanu. Filtr zostaje. Prawdziwy zysk: 6 plików, gdzie TPrA⁻ leży przy początku skanu.
- Nowe tryby błędu: (a) **fałszywy wzorzec**: 15 negatywów bez TPrA dostało „TPrA znaleziony" (kodeina pH 11–12, blank pH 12 i 5, TEA) → potrzebny test tożsamości wzorca;
  (b) 2 pliki WYKRYTO mają ujemne Ip wzorca (błąd bazowej lub pary) → do kontroli wizualnej.
- Kontrola wizualna 48 stron: `kontrola_wizualna_20260916.pdf`.

## 3. Krok 2: amfa_probki
- 3952 plików: 1406 `.nox` (binarny NOVA, nieczytelny; do Methods: wymagany eksport TXT), 2503 TXT (2164 nowe, 313 = etykiety), 39 PDF raportów labu, 1 xlsx, 1 pptx, 1 zip (2023, AMF+MET, Ola Mikołajczyk).
- Przebieg 2503 TXT: 41 s, 0 crashy: MQ_FAIL 2090, WYKRYTO 161, TPrA_ONLY 89, too_few 68 (artefakty 82–84 B), BRAK 63, NIEPEWNE 24, sanity 7, invalid 1.
- 959 plików „blank" z nazwy: 19 WYKRYTO/NIEPEWNE to pełne sygnały 10–37 µA (autonumeracja NOVA po dodaniu próbki). **Nazwa pliku nie jest etykietą.**
- Raporty labu (2024–2026): 201 wierszy (178 pozytyw + 13 „nie wykryto/nie stwierdzono" + 4 „inna substancja" + 4 niekonkluzywne + 2 „< 0,1 %"), czyli 193 różne ID, bo 7 ID powtarza się w kilku raportach. 7 ID ma sprzeczne wiersze
  między datami (238-1: 0,3 % / nie stwierdzono / 1,3 %), więc ID bez daty nie identyfikuje próbki.
- Dopasowanie 634 plików do 108 próbek: negatywy z raportów → 21 plików 239-x BRAK (ΔE_s 0,266–0,33 V), 77-2 BRAK (silny sygnał innej substancji), **73-5 WYKRYTO** (ΔE_s 0,3515 V, 29,7 µA; carry-over
  z 73-4 obalony czasem zapisu plików). 110-2 („< 0,1 %"): WYKRYTO przy 1500 µL próbki, zgodne (jakościowo tak, ilościowo pod LOQ).

## 4. Co mieliśmy jeszcze robić i HURNY
Pełna tabela 15 pozycji z backlogu i 4 rzeczy, które przenoszą się do HURNY: `BACKLOG_I_HURNY_20260916.md`. Skrót: bloker P0 (negatywy) zamknięty;
paczka bezpiecznych poprawek wdrożona (v1.1); Patch 4 etap 2 liczony jako flaga w eksperymencie; sweep literatury o konkurencji, drafty do Bartka/Łukasza/NAVOICA i telefon nadal otwarte.
Do HURNY przechodzi metoda (zbiór ślepych prób, test tożsamości piku, strażnik krawędzi = Patch 5 etap 1, etykieta z nazwy = hipoteza), nie dane (inna chemia).

## 5. Panel: ML, SR, etykiety (trzy recenzje, krytyk, synteza)
- ML: nie jako główny detektor (trzy zgodne opinie); ewentualnie bramka jakości pomiaru i ranking par, dopiero po tabeli pochodzenia etykiet; sufit każdej reguły na obecnych kandydatach = 150–154 z 293 plików.
- SR: nie na obecnych krzywych CV; kandydat z danych na dysku: sigmoida ΔE_s(pH) kodeiny (23 pliki, pH 2–9); Cottrell tylko jeśli w .nox są chronoamperometrie (do sprawdzenia `strings`).
- Etykiety: tabela pochodzenia (raport z datą > folder > nazwa), klasa „inna substancja" osobno, kieszeń SPÓR (tprl1, 73-5, 238-1), czułość S0/S1 per próbka z bootstrapem.
- Plan 2 tygodni i 5 pytań do Łukasza: w syntezie, sekcje 4 i 5.
- Rozbieżność z moją decyzją: synteza woli analizę na serwerze (Pyodide jako plan B), zakładając, że Pyodide wymaga przepisania scipy. Test wykonalności pokazał, że NIE wymaga:
  ten sam plik `.py`, scipy w Pyodide, wyniki identyczne do 1e-9. Przy 256 MB RAM zostaję przy przeglądarce, z testem parytetu 485 plików jako bramką wydania (wpisany do specyfikacji).

## 6. Eksperyment celowanych poprawek detekcji (w toku)
Projekt A (odzysk TPrA⁻ przy krawędzi, osłona okna rozpuszczalnika, prominencja analitu), projekt B (separacja pary, wybór po prominencji, bramka jakości),
implementacja jako flagi w `eksperyment_20260916/ities_algo_eksp.py`, ewaluacja na 3 zbiorach, dwóch sceptyków. Raport: `eksperyment_20260916/RAPORT_EKSPERYMENT_DETEKCJA_20260916.md`.
WYNIK: wariant FULL daje +4 WYKRYTO na 293 pozytywach (121 → 125), 0 fałszywych WYKRYTO na 192 próbach ślepych i na negatywach z raportów,
+2 na plikach z raportów, 0 zysków-artefaktów w kontroli wizualnej (sceptyk 1, 10 wykresów). Sceptyk 2 (chemia) przerwany po 85 min (limit tokenów).
Wniosek: rezerwa czułości nie siedzi w detekcji kandydatów (119 plików bez pary to brak wzorca w oknie albo brak analitu), więc FULL zostaje flagą
eksperymentalną OFF; przed włączeniem: kontrprzykłady chemiczne + test tożsamości wzorca. Szczegóły: `eksperyment_20260916/RAPORT_EKSPERYMENT_DETEKCJA_20260916.md`.

## 7. Krok 4: aplikacja i Frog
- Decyzja architektury: Pyodide w Web Workerze (algorytm 1:1, pierwsze pobranie ~34 MB, start ~5 s, 0,03–0,16 s na plik), serwer Frog = Flask + gunicorn serwujący statyki i manifest wersji.
- Frog (f1412, Alpine 3.23, Python 3.12, 256 MB, 2,4 GB wolne): StudentSpot działa na 20412; **archiwum zrobione** `/home/frog/backups/studentspot_20260916.tgz` (41 MB,
  SHA-256 c0a3e5c9…6661013, plus crontab i skrypty startowe), kopia ściągana lokalnie do archiwum (`pawel_studentspot/backup_frog_20260916/`).
- Nazwa drugiego kafelka: **PeakWise** (decyzja Pawła 18:45; „V-Peak" odrzucone przez kolizję z „VApeak" AMEL). Ikony i makieta z ChatGPT w `assets/`.
- Specyfikacja: `09_aplikacja_web_20260916/SPEC_APLIKACJI.md` + `PRODUCT.md`. **Budowa ZROBIONA** (zbudowane, potem doszlifowane): hub z dwoma kafelkami
  (ITIES Detect + PeakWise „wkrótce"), aplikacja ITIES Detect (analiza, karta werdyktu ze skalą mV, wykres z punktami 1–4, szczegóły, tabela sesji,
  eksport CSV/PDF, tryb ekspercki, historia wersji, motyw jasny/ciemny), serwer Flask+gunicorn (RSS 68 MB). **Bramka wydania: test parytetu 485 plików
  Pyodide vs CPython = 0 różnic** (i 27 różnic po celowym zepsuciu progu, czyli test umie paść); detektor rzemiosła UI: 0 znalezisk; 12 zrzutów ekranu.
  Pakiet wdrożeniowy: `deploy/analizatory_bundle.tar.gz` (0,57 MB) + skrypt pobierający Pyodide na serwerze (17 plików z jsdelivr, sumy sprawdzone).
  **Wdrożenie na Frog ZROBIONE 19:30: https://frog01-20412.wykr.es/** (hub) i `/ities/` (aplikacja). Sprawdzone z zewnątrz: strony 200, SHA algorytmu na serwerze = lokalny,
  wasm z poprawnym MIME i gzip, ikony, uPlot. StudentSpot zatrzymany (archiwum 41 MB w dwóch miejscach, SHA zgodne), watchdog w crontab, RAM serwera 46 MB zajęte, dysk 386 MB.
  **Test end-to-end w Chrome na żywym serwerze:** silnik załadowany z Froga (ok. 40 s), plik 93P → DO OCENY EKSPERTA, ΔE_s = 0,364 V, 14 mV od wzorca, dokładnie jak referencja CPython.
- Do wygenerowania graficznie (prompt dla Pawła): ikona V-Peak/PeakWise, patrz sekcja 9.

## 8. Co dalej (kolejność)
1. Dokończyć eksperyment i wpisać wynik do sekcji 6; jeśli przetrwa sceptyków: flaga OFF w notebooku v1.2 + walidacja CC.
2. Mail do Łukasza (5 pytań z syntezy + 73-5 + 11 wykresów ramion + rotacja hasła z klatek nagrania). Tekst przygotuję, Paweł wysyła.
3. Tabela pochodzenia etykiet (485 wierszy) i czułość S0/S1 per próbka z przedziałami.
4. Aplikacja: odbiór budowy (parity test 0 różnic), przegląd wizualny, wdrożenie na Frog, zdjęcie StudentSpot, kafelki.
5. Obsidian, HISTORIA/ARTYKUL (zrobione dla kroków 1–3), STAN_ROZMOWY (zrobione).

## 9. Prompt na ikonę drugiego kafelka (do wklejenia w generator obrazów)
„Flat app icon, macOS style rounded square (22 % corner radius), soft top light, deep teal to blue vertical gradient background,
a single crisp white line drawing of a cyclic voltammogram loop with one sharp anodic peak marked by a small circle, minimal, no text,
no glow, centered, vector look, 1024x1024 px, transparent margins." Wariant z literami: dodać „small white letters PW bottom right".

## 10. Niezależne detektory (trzy przebiegi) na tej samej paczce danych
Trzy modele napisały algorytm od zera na tych samych 485 plikach z poprawionymi etykietami. Wynik: 115–119 wykryć na 271 pozytywach przy 0 (raz 1) fałszywych,
wobec naszych 120/271 przy 0. Nikt nas nie pobił, wszyscy wylądowali w tym samym miejscu, czyli sufit czułości siedzi w plikach bez użytecznego wzorca lub pary, nie w kodzie.
Do przeniesienia od nich: tożsamość TPrA jako para z ΔE_p 40–280 mV, margines krawędzi w mV, statusy rozdzielające jakość pomiaru od chemii. Szczegóły: FAKTY sekcja 9.
