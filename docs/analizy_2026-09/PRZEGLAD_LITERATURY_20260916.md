# Przegląd literatury: automatyczna analiza CV i elektrochemiczna detekcja narkotyków

Data: 16.09.2026, 22:20 do 22:45 CEST. Metoda: przegląd literatury i źródeł internetowych (bez Chrome, bez publikowania).
Budżet: 25 zapytań sieciowych (13 wyszukiwań, 12 pobrań stron), wykorzystany w całości.
Zakres czasowy celu: 2024 do września 2026. Kilka pozycji starszych zostawiłem, bo są kanoniczne dla metody i nowsze prace się na nie powołują.

## 0. Jak czytać ten raport (ograniczenia, mniej obiecujemy)

Wydawcy ACS, Wiley, Elsevier i Springer zwracają HTTP 403 na automatyczne pobranie, a PMC podstawia captcha.
Dlatego dla części pozycji mam wyłącznie metadane i abstrakt, nie pełny tekst. Rozróżniam to jawnie:

- **[PEŁNY]** czytałem tekst artykułu (co najmniej sekcje metod i danych).
- **[ABSTRAKT]** czytałem tylko rekord bibliograficzny lub abstrakt z PubMed.
- **[SNIPPET]** widziałem wyłącznie tytuł, źródło i fragment z wyników wyszukiwarki. Tego NIE traktować jako sprawdzone.

Nie weryfikowałem żadnej pozycji drugim źródłem. Liczby podane niżej to liczby ze źródła, nie moje przeliczenia.
Żadnej pozycji nie oceniam jako „lepszej od nas", bo żadna nie mierzy tego, co my (czułość per plik przy zerze fałszywych alarmów na realnych próbkach amfetaminy).

---

## 1. Tabela pozycji

| # | Rok | Autorzy / źródło | Co robią | Dane | Metoda | Wniosek dla nas | Status |
|---|-----|------------------|----------|------|--------|-----------------|--------|
| 1 | 2025 | Rosser D.A., Leonard K.C. *ACS Electrochem.* 1, 1038-1043. DOI 10.1021/acselectrochem.5c00012 | Regresja stałej szybkości k0 i współczynnika przejścia alfa wprost z kształtu CV | 2515 CV **symulowanych w COMSOL** (geometria i dyfuzja wzorowane na ferrocenometanolu); walidacja na eksperymentalnym CV ferrocenu w DMSO | Obraz CV 500x500 px czarno-biały, CNN + MLP w TensorFlow; 30 klas (k0 w półrzędach od 5e-1 do 1e-5 cm/s, alfa 0,3 / 0,5 / 0,7); 80/20 + 5-fold CV | Ich trik jest dla nas bezpośrednio użyteczny: **skalują i centrują CV na maksimum piku utleniania**, żeby model był niezależny od powierzchni elektrody i stężenia. To dokładnie to, co my robimy wzorcem TPrA+, tylko oni robią to geometrycznie na obrazie. Uwaga: uczą na symulacjach, testują na jednym układzie. Nie mierzą fałszywych alarmów | **[PEŁNY]** |
| 2 | 2026 | Macedo D.S., Rodopoulos T., Vepsäläinen M., Bajaj S., Jayarathne H., Hogan C.F. *Anal. Chem.* 98(8), 6217-6225. DOI 10.1021/acs.analchem.5c07228, PMID 41701935 | Otwarte narzędzie do dekonwolucji nakładających się sygnałów CV i odjęcia tła | **Eksperyment**, trzy układy: heksaaminaruten z nakładającą się redukcją tlenu, kompleks bipirydylowy rutenu z nakładającymi się redukcjami ligandów, oznaczanie SO2 zasłonięte redukcją tlenu | Analiza semipochodnej + dopasowanie rozkładami Pearson IV do kształtu piku faradajowskiego + **odcinkowa funkcja na prąd pojemnościowy i tło elektrolizy**. Program z GUI i kod źródłowy w Pythonie, udostępnione | **Najważniejsza pozycja dla naszego problemu numer 1 (pliki bez pary pików)**. Nasze „słabe piki" to dokładnie ich przypadek: pik faradajowski utopiony w tle. Semipochodna zamienia sigmoidalny/skośny pik ITIES w symetryczny, łatwiejszy do zlokalizowania. Liczby o dokładności E_p nie widziałem, bo nie mam pełnego tekstu | **[ABSTRAKT]** |
| 3 | 2026 | Sunindyo W.D., Anshori I., Wiguna K.A. i in. *PLOS ONE*. DOI 10.1371/journal.pone.0348348 | Algorytmiczna (nie ML) interpretacja CV i DPV dla troponiny sercowej | **Eksperyment**, liczba woltamogramów NIE podana w pracy. Dane na figshare: DOI 10.6084/m9.figshare.29553506 | CV: korekta linii bazowej **wielomianem 2. stopnia** na obszarach bez aktywności, potem lokalne maksima/minima. DPV: linia bazowa metodą **asymetrycznych najmniejszych kwadratów (ALS)**. Cechy: E_p i I_p względem bazy | Potwierdza, że publikowalne jest podejście **deterministyczne i interpretowalne** („deterministic signal-processing procedures rather than inferential statistical modeling"), a nie tylko sieć neuronowa. To jest dokładnie nasza pozycja retoryczna w artykule. Minus dla nich: nie podają n, nie podają czułości ani swoistości, kodu nie wypuścili. My mamy n i mamy 0 FP, więc jesteśmy mocniejsi w liczbach | **[PEŁNY]** |
| 4 | 2026 | Love D., Page E. *Forensic Sci. Int.: Synergy* 13, 100701. DOI 10.1016/j.fsisyn.2026.100701 | Przegląd Interpolu: chemia sądowa narkotyków 2022-2025 | Przegląd, setki cytowań | Systematyczny przegląd | **Kluczowy fakt negatywny: w całym przeglądzie Interpolu za 2022-2025 jedyną odnotowaną pracą ITIES w kontekście narkotyków jest heroina w kropli na druku 3D (poz. 429, czyli Poltorak).** Amfetamina + ITIES nie występuje. ML w screeningu narkotyków dotyczy SERS, EC-SERS, FET i biosensorów optycznych, nie ITIES | **[PEŁNY]** |
| 5 | 2025 | (tytuł) *Redox-Detecting Deep Learning for Mechanism Discernment in Cyclic Voltammograms of Multiple Redox Events*. *ACS Electrochem.* 1(1), 52. PMID 39878149. Preprint ChemRxiv 2023 (6568fd7829a13c4d475f6f11) | EchemNet: wykrywa okna napięciowe i przypisuje klasę mechanizmu w CV z wieloma zdarzeniami redoks | Nie zweryfikowałem (403 na ChemRxiv i ACS) | Architektura **Faster R-CNN** (detekcja obiektów) zaadaptowana do CV | Idea „detekcji obiektów na woltamogramie" jest dla nas alternatywą do rozważenia: zamiast szukać pary pików regułami, można wykrywać je jako obiekty z pudełkiem i pewnością. Ale: to czarna skrzynka, wymaga dużego zbioru uczącego, a my mamy 485 plików. Odradzam jako ścieżkę główną, warto zacytować jako „droga, której nie wybraliśmy i dlaczego" | **[SNIPPET]** |
| 6 | 2022 | (tytuł) *Electrochemical Mechanistic Analysis from Cyclic Voltammograms Based on Deep Learning*. *ACS Meas. Sci. Au* 2(6), 595. DOI 10.1021/acsmeasuresciau.2c00045, PMID 36573074 | Automatyczne przypisanie jednego z pięciu typowych mechanizmów molekularnych na podstawie CV | Nie zweryfikowałem | ResNet / CNN | Praca kanoniczna dla nurtu „CNN na obrazie CV". Poza naszym oknem czasowym, ale nowsze prace (poz. 1, 5) się z niej wywodzą. Dla nas: dowód, że nurt jest zajęty przez klasyfikację mechanizmu, a nie przez detekcję analitu | **[SNIPPET]** |
| 7 | 2025 | (tytuł) *Choosing the Correct Internal Reference Redox Species for Overcoming Reference Electrode Drift in Voltammetric pH Measurements*. *ACS Electrochem.* DOI 10.1021/acselectrochem.5c00138, PMID 40799487, PMC12337080 | Jak wybrać wewnętrzny wzorzec redoks (IREF), żeby zniwelować dryf elektrody odniesienia | Nie zweryfikowałem | Pomiar **różnicy potencjałów piku analitu i piku IREF** zamiast potencjału bezwzględnego | **Bezpośrednio o naszym kryterium delta E_s.** Ze streszczenia wyszukiwarki: wymagają **minimalnej separacji na osi potencjału między pikiem IREF a pikiem analitu**, oraz uwzględnienia odległości piku od ściany elektrolizy wody. To jest nasz problem „fałszywy wzorzec przy wysokim pH" i „kodeina przy pH 7,7" nazwany ich językiem. Konkretnych liczb w mV nie widziałem, trzeba dociągnąć pełny tekst (open access w PMC) | **[SNIPPET]** |
| 8 | 2022 | (tytuł) *Voltammetry Peak Tracking for Longer-Lasting and Reference-Electrode-Free Electrochemical Biosensors*. PMC9599936 | Śledzenie piku bez elektrody odniesienia | Nie zweryfikowałem | Lokalizacja E_p przez **punkty przegięcia rosnącego i opadającego zbocza**, nie przez maksimum | Tania, deterministyczna alternatywa dla naszego szukania maksimum z progiem prominencji. Punkt przegięcia jest odporniejszy na płaski, szeroki pik niż argmax. Warto przetestować jako drugi detektor na plikach, które dziś odpadają | **[SNIPPET]** |
| 9 | 2024 | Ribeiro J.A. i in. *ChemElectroChem*. DOI 10.1002/celc.202400134 | Przegląd: zastosowania elektrochemii na ITIES w odkrywaniu i rozwoju leków | Przegląd | Przegląd | Najświeższy przegląd ITIES + leki w naszym oknie. NIE udało się pobrać (403), więc nie potwierdzam, czy w ogóle wspomina amfetaminę, TPrA+ jako wzorzec ani automatyczną analizę danych. **Do przeczytania ręcznie, to jedyna pozycja, która mogłaby zawierać niespodziankę** | **[SNIPPET]** |
| 10 | 2025 | (tytuł) *Selective screening of synthetic cathinones, amphetamines, piperazines, and phenethylamines using voltammetry with oxygen plasma-treated graphite electrodes*. *Electrochim. Acta*, S0013468625007558 | Screening amfetamin i katynonów metodą woltamperometryczną | Nie zweryfikowałem | DPV na grafitowej elektrodzie traktowanej plazmą tlenową, **elektroda stała, nie ITIES** | Konkurencja dla amfetaminy, ale na innej fizyce: utlenianie na elektrodzie stałej, nie transfer jonu. Nasza przewaga argumentacyjna: transfer jonu nie wymaga, żeby analit był elektroaktywny. Ich przewaga: prostszy sprzęt. Nie widziałem, czy robią automatyczną analizę sygnału | **[SNIPPET]** |
| 11 | 2025 | Khizar S. i in. *Electroanalysis*. DOI 10.1002/elan.12034 | Przegląd: czujniki elektrochemiczne do szybkiej detekcji narkotyków | Przegląd | Przegląd | Mapa konkurencji sprzętowej. Do cytowania we wstępie artykułu jako „stan czujników", nie jako metoda | **[SNIPPET]** |
| 12 | 2025/2026 | (tytuł) *Machine Learning for Neurotransmitter Monitoring by Fast Voltammetry: Current and Future Prospects*. PMID 41371616 | Przegląd ML w szybkiej woltamperometrii (FSCV, neuroprzekaźniki) | Przegląd | Przegląd modeli; w streszczeniu wyszukiwarki wskazano LSTM i FCN jako najlepsze do klasyfikacji woltamogramów | Rok podany w wyszukiwarce niejednoznacznie (link ScienceDirect sugeruje 2025, PMID sugeruje 2026), **nie ustaliłem**. Wartość dla nas: gotowy argument, że w FSCV nurt ML jest dojrzały, a w ITIES nie istnieje | **[SNIPPET]** |
| 13 | 2022 | (tytuł) *A Deep Learning Approach to Organic Pollutants Classification Using Voltammetry*. *Sensors* 22(20), 8032. PMC9608622 | Klasyfikacja zanieczyszczeń organicznych z CV | Nie zweryfikowałem; elektrody sitodrukowane, tanie | Konwersja przebiegu na obraz RGB metodą **Gramian angular fields**, potem CNN | Technika przenoszenia szeregu czasowego na obraz. Ciekawa, ale dla nas to strzelanie z armaty do wróbla przy 485 plikach i wymogu interpretowalności | **[SNIPPET]** |
| 14 | 2022 | (tytuł) *Opportunities and challenges in applying machine learning to voltammetric mechanistic studies*. *Curr. Opin. Electrochem.*, S2451910322000746 | Przegląd krytyczny ML w woltamperometrii | Przegląd | Omawia preprocessing: PCA, ekstrakcja cech, transformata falkowa przed siecią | Przydatne do sekcji Discussion: pokazuje, że społeczność sama zgłasza problem braku danych eksperymentalnych i przewagę cech ręcznych nad surowym sygnałem przy małych zbiorach. To broni naszego podejścia | **[SNIPPET]** |
| 15 | 2019 | (tytuł) *Machine Learning Techniques for Chemical Identification Using Cyclic Square Wave Voltammetry*. *Sensors* 19(10), 2392. PMC6567068 | Identyfikacja związków (materiały wybuchowe, pestycydy, metale ciężkie) | Nie zweryfikowałem | Klasyczne ML na CSWV | Stara, ale to najbliższy precedens „ML identyfikuje substancję z woltamogramu". Poza oknem czasowym | **[SNIPPET]** |
| 16 | 2022 | Poltorak Ł. i in. *Sci. Rep.* 12. DOI 10.1038/s41598-022-21689-0, PMC9633610 | Detekcja heroiny w kropli na podporze z druku 3D, zminiaturyzowany ITIES | Eksperyment | ITV / CV na miniaturowym ITIES | **To jest praca naszego laboratorium i jedyna praca ITIES odnotowana w przeglądzie Interpolu (poz. 4).** Punkt wyjścia i punkt odniesienia dla artykułu | **[SNIPPET]** |
| 17 | 2023/2024 | Poltorak Ł. i in. *Microchim. Acta*. DOI 10.1007/s00604-023-05739-6 | Nitrazepam i 7-aminonitrazepam na makro- i mikroskopowym ITIES | Eksperyment | ITV | Ten sam schemat metodyczny co u nas, inny analit. Do cytowania jako ciągłość linii badawczej | **[SNIPPET]** |
| 18 | 2024 | Poltorak Ł. i in. (ResearchGate 380218223) | Metabolity kokainy (benzoiloekgonina, ekgonina) na zminiaturyzowanym ITIES | Eksperyment | ITV | Jak wyżej. Pokazuje, że grupa systematycznie przechodzi przez kolejne anality ręcznie. **Automatyzacja analizy plików jest wolnym polem wewnątrz samego laboratorium** | **[SNIPPET]** |
| 19 | 2025 | (tytuł) *Comprehensive Profiling of Illicit Amphetamines Seized in Poland*. *Molecules* 30(3), 579 | Profilowanie amfetaminy z polskich zabezpieczeń | GC-MS, próbki zabezpieczone | GC-MS + chemometria | Kontekst krajowy i argument „po co nam szybki screening": referencyjna metoda to GC-MS, droga i laboratoryjna | **[SNIPPET]** |
| 20 | 2025 | arXiv 2503.14758, *Cyclic Voltammetry of Ion-Coupled Electron Transfer Reactions for Diagnosing Energy Storage Materials* | Diagnostyka materiałów z CV przy transferze sprzężonym z jonem | Nie zweryfikowałem | Analityczno-numeryczna | Wyszło w zapytaniu o regresję symboliczną, ale **to nie jest regresja symboliczna**. Odnotowuję, żeby nie wrócić do tego tropu | **[SNIPPET]** |

---

## 2. Czy ktoś nas wyprzedza

Tylko fakty, które widziałem w źródle. Brak trafienia w wyszukiwarce NIE jest dowodem nieistnienia pracy.

**Fakt 1. Nikt nie połączył ML/automatycznej analizy sygnału z ITIES.**
Przegląd Interpolu za lata 2022-2025 (poz. 4, czytany w pełni) wymienia sekcję ML w screeningu narkotyków i osobno wymienia ITIES. W sekcji ML nie ma ani jednej pracy ITIES. W całym przeglądzie jedyną pracą ITIES dotyczącą narkotyków jest heroina w kropli na druku 3D, czyli praca laboratorium prof. Półtoraka. **Wniosek: przecięcie „ITIES + automatyczna analiza krzywej" jest puste w przeglądzie o zasięgu Interpolu.**

**Fakt 2. Nurt ML na CV istnieje, ale rozwiązuje inny problem.**
Wszystkie znalezione prace ML na CV (poz. 1, 5, 6, 12, 13, 15) robią jedno z dwóch: klasyfikują **mechanizm reakcji** albo regresują **parametry kinetyczne**. Żadna nie robi tego, co my, czyli decyzji „czy w tym pliku jest analit, tak czy nie, przy zerze fałszywych alarmów". Najbliżej jest poz. 3 (troponina), i to nie jest ML, tylko deterministyczny pipeline.

**Fakt 3. Prace ML na CV uczą się głównie na symulacjach.**
Potwierdzone w pełnym tekście dla poz. 1: 2515 woltamogramów z COMSOL, eksperyment tylko jako sprawdzenie końcowe, na jednym układzie (ferrocen w DMSO). **Nasze 485 realnych plików laboratoryjnych to inna kategoria dowodu.** To jest nasz najmocniejszy argument w artykule i trzeba go postawić wprost.

**Fakt 4. Konkurencja „zespół z UK, ML na obrazach CV drinków" nie potwierdzona.**
Trzy zapytania (ML + CV + drink spiking + CNN + UK, ML + ITIES + klasyfikacja leków, oraz ogólne ML + voltammetry) nie zwróciły żadnej pracy o wykrywaniu narkotyków w napojach metodą ML na obrazach CV. **Nie twierdzę, że taka praca nie istnieje.** Twierdzę, że nie znalazłem jej w 25 zapytaniach i że nie ma jej w przeglądzie Interpolu. Żeby to domknąć, potrzebne są nazwiska (Bala? Olga?) albo afiliacja, bo bez nich wyszukiwarka nie ma za co złapać.

**Fakt 5. Regresja symboliczna na CV: nie znalazłem ŻADNEJ nowej pracy.**
Dedykowane zapytanie o regresję symboliczną w elektrochemii zwróciło wyłącznie prace o sieciach neuronowych i klasyczne materiały dydaktyczne o CV. Nie znalazłem drugiej pracy obok tej, którą już mamy (Sun 2020, symulacje). **To jest nisza i po 6 latach nadal jest pusta.**

**Fakt 6. Nasz problem z wzorcem jest problemem nazwanym w literaturze, poza ITIES.**
Poz. 7 (2025) zajmuje się dokładnie tym: dryf elektrody odniesienia korygowany różnicą potencjałów do wzorca wewnętrznego, z warunkiem minimalnej separacji pików i odległości od ściany elektrolizy. To znaczy, że nasze „fałszywy wzorzec przy wysokim pH" i „kodeina interferuje przy pH 7,7" da się opisać ich językiem i zacytować, zamiast opisywać jako nasz lokalny kłopot.

---

## 3. Trzy rzeczy do wzięcia od razu

### 3.1. Semipochodna plus Pearson IV zamiast szukania maksimum (poz. 2)

**Co.** Przed detekcją piku policzyć semipochodną (pochodna ułamkowa rzędu 1/2) sygnału, a tło pojemnościowe odjąć funkcją odcinkową, nie prostą.
**Dlaczego.** Nasz problem numer 1 to pliki bez pary pików, czyli pik za słaby, żeby przebić próg prominencji. Semipochodna zamienia skośny, rozmyty pik dyfuzyjny w symetryczny i węższy, przez co stosunek pik do tła rośnie bez zmiany danych wejściowych. Praca z 2026 pokazuje to na trzech układach, w których pik był zasłonięty redukcją tlenu, czyli w sytuacji analogicznej do naszej.
**Koszt.** Pobrać ich kod i policzyć semipochodną na naszych 485 plikach: pół dnia na implementację, pół dnia na ewaluację skryptem `eval_katalog.py`. **Bramka sukcesu: liczba plików z wykrytą parą pików rośnie, a fałszywe alarmy zostają na 0.** Jeśli FP wyjdzie powyżej 0, wyrzucamy.
**Ryzyko.** Ich metoda jest wyprowadzona dla dyfuzji liniowej na elektrodzie płaskiej. ITIES to inna geometria. Trzeba to sprawdzić, nie założyć.

### 3.2. Punkt przegięcia zamiast argmax jako drugi detektor (poz. 8)

**Co.** Dla plików, które dziś odpadają, lokalizować E_p jako przecięcie stycznych w punktach przegięcia rosnącego i opadającego zbocza, a nie jako maksimum prądu.
**Dlaczego.** Przy słabym, szerokim piku argmax jest niestabilny (przesuwa się o dziesiątki mV przy szumie), a punkt przegięcia jest własnością zbocza i jest odporniejszy. To jest tanie i w pełni interpretowalne, czyli zgodne z linią artykułu.
**Koszt.** Jeden dzień. Implementacja to druga pochodna wygładzona filtrem Savitzky-Golay plus miejsca zerowe. Wdrażać jako **flagę OFF**, tak jak flagi z eksperymentu z 16.09, i mierzyć osobno.
**Ryzyko.** Może przesunąć E_s o kilka mV wobec obecnej definicji, co ruszy kryterium 0,350 V. Trzeba to wyliczyć na plikach już wykrywanych, zanim się cokolwiek włączy. Jeśli na obecnym zbiorze różnica przekracza nasz margines 10/15 mV, metoda odpada.

### 3.3. Przepisać nasz problem ze wzorcem na język IREF (poz. 7)

**Co.** Nie tylko przeczytać tę pracę w całości (jest open access w PMC12337080), ale wprowadzić do artykułu jej ramę pojęciową: wzorzec wewnętrzny, wymagana minimalna separacja pików, odległość od ściany elektrolizy jako warunek ważności pomiaru.
**Dlaczego.** To zamienia trzy nasze „problemy" w trzy **warunki stosowalności metody**, czyli z wady robi zdefiniowany zakres. „Fałszywy wzorzec przy wysokim pH" to naruszenie warunku separacji. „Kodeina przy pH 7,7" to naruszenie warunku selektywności okna. Recenzent czyta to inaczej niż listę awarii.
**Koszt.** Dwie do trzech godzin: przeczytać pełny tekst, wypisać ich warunki, sprawdzić na naszych danych, które pliki je łamią, i policzyć ile ich jest. Zero kodu.
**Ryzyko.** Nie widziałem pełnego tekstu, tylko streszczenie wyszukiwarki. Może się okazać, że ich warunki są sformułowane wyłącznie dla pomiaru pH i nie przenoszą się na transfer jonu. Wtedy zostaje sama analogia, bez cytowania jako podstawy.

---

## 4. Czego nie znaleziono (luki, czyli nasza nisza)

Lista rzeczy, których szukałem i nie znalazłem. Każda z nich to potencjalne zdanie „first report" w artykule, ale **żadnego z nich nie wolno napisać bez dociągnięcia pełnego przeglądu ITIES (poz. 9)**, bo tam może siedzieć kontrprzykład.

1. **Automatyczna, bezobsługowa analiza woltamogramów ITIES.** Zero trafień. Prace ITIES z laboratorium prof. Półtoraka (poz. 16, 17, 18) opisują analizę ręczną, artefakt po artefakcie.
2. **Amfetamina na ITIES z kryterium decyzyjnym opartym na wzorcu wewnętrznym.** Znalazłem efedrynę (prekursor) i kokainę, heroinę, nitrazepam, metabolity kokainy. Amfetaminy na ITIES z automatycznym kryterium nie znalazłem.
3. **Regresja symboliczna na krzywych CV na danych eksperymentalnych.** Nadal jedna praca (Sun 2020) i to na symulacjach. Sześć lat i nikt nie powtórzył na realnym pomiarze.
4. **Raportowanie czułości elektrochemicznej metody screeningowej per plik przy zerze fałszywych alarmów.** Żadna z 20 pozycji nie podaje takiej pary liczb. Poz. 3 (troponina) w ogóle nie podaje czułości ani swoistości. To jest metryka, którą możemy wprowadzić.
5. **Publiczny, otwarty zbiór woltamogramów ITIES.** Nie znalazłem żadnego. Prace ML na CV uczą się na symulacjach COMSOL (potwierdzone dla poz. 1), bo nie ma czego innego użyć. **Nasze 485 plików jako otwarty zbiór to osobny, samodzielny wkład, niezależny od algorytmu.**
6. **Benchmark porównujący metody korekcji linii bazowej na tych samych woltamogramach.** Widziałem wielomian (poz. 3, CV), ALS (poz. 3, DPV), funkcję odcinkową (poz. 2), airPLS wspomniany w wynikach wyszukiwania. Nikt ich nie porównał na wspólnych danych elektrochemicznych z jedną metryką.
7. **Wpływ pH na niezawodność wzorca wewnętrznego w transferze jonu.** Poz. 7 robi to dla pomiaru pH na elektrodzie stałej, nie dla ITIES.

---

## 5. Otwarte narzędzia

Licencje podaję tylko tam, gdzie je widziałem. Gdzie nie widziałem, piszę „nie sprawdzone" i **nie wolno tego zakładać przed użyciem w kodzie** (patrz skill `compliance`).

| Narzędzie | Co daje | Gdzie | Licencja | Status weryfikacji |
|-----------|---------|-------|----------|--------------------|
| Narzędzie do dekonwolucji CV (Macedo i in. 2026) | Semipochodna, dopasowanie Pearson IV, odcinkowe tło, GUI + kod Python | Supporting Information do DOI 10.1021/acs.analchem.5c07228; abstrakt mówi „freely available" | **Nie sprawdzona.** Nie widziałem repozytorium ani pliku licencji | Do pobrania ręcznie, to jest priorytet 1 |
| Kod CNN do regresji k0 i alfa (Rosser, Leonard 2025) | Pipeline TensorFlow: CV do obrazu 500x500, CNN + MLP, 5-fold CV | „All machine learning code can be found in a link provided in the Supporting Information" (cytat z pełnego tekstu) | **Nie sprawdzona** | Link jest w SI, którego nie pobierałem |
| PyECSim | Symulacja elektrochemiczna w Pythonie | https://pypi.org/project/pyecsim/ | Nie sprawdzona | Widziane tylko w wyniku wyszukiwania |
| slawekj/Deconvolution | Prosty program do dekonwolucji pików z sygnału, GUI | https://github.com/slawekj/Deconvolution | Nie sprawdzona | Widziane tylko w wyniku wyszukiwania. Generyczny, nie elektrochemiczny |
| MOCCA | Pipeline chromatograficzny: linia bazowa, peak picking, czystość piku, dekonwolucja nakładających się pików | Open source wg PMC9951288 | Nie sprawdzona | Chromatografia, nie woltamperometria. Wzorzec architektury, nie gotowe narzędzie |
| Dane do poz. 3 (troponina) | Surowe CV i DPV | DOI 10.6084/m9.figshare.29553506 | Nie sprawdzona (figshare zwykle CC BY, ale nie potwierdziłem) | Jedyny publiczny zbiór woltamogramów, na jaki trafiłem |
| `baseline` (R, CRAN) | Implementacja ALS i pokrewnych | CRAN, pakiet `baseline` | Nie sprawdzona | R, nie Python. Dla nas referencja algorytmu, nie zależność |
| GitHub topic `cyclic-voltammetry` | Lista repozytoriów | https://github.com/topics/cyclic-voltammetry | Nie dotyczy | Nie przeglądałem zawartości, zabrakło budżetu |

---

## 6. Co zrobić dalej, gdyby był budżet

Rzeczy, których nie zdążyłem, uszeregowane po wartości:

1. **Pełny tekst przeglądu Ribeiro 2024 o ITIES w lekach (poz. 9).** Jedyne miejsce, gdzie może siedzieć kontrprzykład do naszych twierdzeń „first". Pobrać ręcznie z dostępu uczelnianego AHE albo poprosić prof. Półtoraka.
2. **Pełny tekst poz. 7 (IREF, PMC12337080).** Open access, tylko captcha blokuje automat. Dwa kliknięcia w przeglądarce.
3. **Pobrać Supporting Information do poz. 2 i uruchomić ich kod na 5 naszych plikach** (pilot na trzech do pięciu, zgodnie z zasadą pilota).
4. **Domknąć wątek konkurencji z UK.** Bez nazwisk wyszukiwarka nie ma szans. Potrzebne: pełne nazwisko albo uczelnia, albo tytuł pracy.
5. **Przeszukać Google Scholar po cytowaniach pracy o heroinie (poz. 16).** Kto ją cytuje, ten pracuje w tej samej niszy. To jedno zapytanie, a daje listę realnej konkurencji.
