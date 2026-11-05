// What only a full account may load: the list of applications, the hub tiles, the project
// history and the version notes. The server answers 404 here for an account limited to
// one application, so none of this reaches its browser.
import { extendDictionary, plPlural } from "./i18n.js";

// Single place to rename the second hub tile.
export const HUB_TILE_2_NAME = "PeakWise";

export const APPS = [
  { id: "ities", name: "ITIES Detect", href: "/ities/" },
  { id: "peakwise", name: HUB_TILE_2_NAME, href: "/peakwise/" },
];

const EN = {
  "hub.pageTitle": "CV Analysers",
  "hub.title": "CV Analysers",
  "hub.lead": "Laboratory tools for cyclic voltammetry analysis.",
  "hub.ities.desc": "Amphetamine detection from CV curves (ITIES).",
  "hub.peakwise.desc": "Anodic and cathodic peaks of 3D printed electrodes.",
  "hub.soon": "soon",
  "hub.openApp": "Open {app}",

  "history.title": "Project history",
  "history.1.date": "12-15.01.2025",
  "history.1.head": "First local prototype in Python",
  "history.1.text": "A Flask application called smartCCA (AIrON, AHE) with an electrochemical and a colorimetric model, and the idea of a device plus an application that detects a substance and its concentration.",
  "history.2.date": "19-20.05.2026",
  "history.2.head": "Where the ITIES method came from",
  "history.2.text": "Methodology and implementation decisions of prof. Poltorak: the TPrA+ internal standard, points 1 to 4, delta E_s = E6 - E5 of about 0.350 V for amphetamine; the MVP specifications and the decision to keep one notebook in Google Colab.",
  "history.3.date": "20-21.05.2026",
  "history.3.head": "First working MVP in Colab",
  "history.3.text": "A parser for NOVA TXT, the split into branches, find_peaks with a Savitzky-Golay filter, the DETECTED, UNCERTAIN or NONE decision, and a chart with points 1 to 6.",
  "history.4.date": "10.07.2026",
  "history.4.head": "The collision with 272 laboratory files",
  "history.4.text": "Four hard faults fixed: the parser, recording artefacts and the standard windows.",
  "history.5.date": "20.07.2026",
  "history.5.head": "Answers from prof. Poltorak",
  "history.5.text": "The last complete cycle, a baseline from the tangent before the signal and two Ip procedures, all implemented in the notebook.",
  "history.6.date": "27.07.2026",
  "history.6.head": "Calibration closed",
  "history.6.text": "The curve 0.1770 c - 0.924 uA with R2 0.9943, LOD 2.50 uM, LOQ 8.33 uM, and the first measured sensitivity on 293 positive files: 41 %.",
  "history.7.date": "12-19.08.2026",
  "history.7.head": "Threshold and calibration settled",
  "history.7.text": "Questions about the 0.350 V threshold, the 0.123 calibration settled, and the meeting of 18.08 that closed Ip.",
  "history.8.date": "20.08.2026",
  "history.8.head": "Algorithm 1.0",
  "history.8.text": "Ip by two procedures, in a file frozen from the notebook.",
  "history.9.date": "16.09.2026",
  "history.9.head": "Laboratory labels and algorithm 1.1",
  "history.9.text": "Negatives and lab labels (147 plus 45 plus 293 files), specificity with no false detections, algorithm 1.1 with LOD and LOQ from the active calibration and pair diagnostics, and the web application 1.0 to 1.2 (Pyodide in the browser, the hub, PeakWise).",
  "history.10.date": "17.09.2026",
  "history.10.head": "Application 1.3 and 1.4",
  "history.10.text": "Sessions, the progress window and pointing at the analyte pair in 1.3; sign-in, folders, tooltips, sessions written to a file and several files at once in 1.4.",
  "versions.pageTitle": "Version history · ITIES Detect",
  "versions.h1": "Version history",
  "versions.algo": "Algorithm",
  "versions.note":
    "Version and SHA-256 come from algo/versions.json. Measured on 16.09.2026: 121 of 293 positive files detected, 0 of 147 negative files and 0 of 45 neutral files falsely detected.",
  "versions.diff":
    "1.1 = 1.0 + diagnostics (LOD/LOQ from the active calibration, below_lod warning, pair selection diagnostics); identical verdicts, δΔE and Ip on 485 test files.",
  "versions.col.version": "Version",
  "versions.col.date": "Date",
  "versions.col.sha": "SHA-256",
  "versions.col.changes": "Changes",
  "versions.col.measured": "Measured",
  "versions.default": "(default)",
  "versions.use": "Use this version in the session",
  "versions.measured":
    "sensitivity {positives}; false detections on negatives {negatives}, on neutrals {neutrals} ({date})",
  "versions.app": "Application",
  "versions.appLine": "ITIES Detect application {version}",

  "app.changelog.1_0_0":
    "2026-09-16: first web version, Pyodide engine, parity with the notebook.",
  "app.changelog.1_1_0":
    "2026-09-16: EN and PL interface, theme switch in the toolbar, folder upload, analysis starts on its own after upload, Colab style chart.",
  "common.peakwise": "PeakWise",
  "tip.appSwitch": "Switches between ITIES Detect and PeakWise. Your files in this application stay where they are.",
  "hub.files": ({ n }) => `${n} ${n === 1 ? "file" : "files"} in the session`,
  "hub.noFiles": "no files",

  "app.changelog.1_4_5":
    "2026-10-25: the legend under the chart names points 1 to 4, E5 and E6 with the same symbols as the Peaks panel, on screen, in the multi-file cards and in the printed report.",
  "app.changelog.1_4_4":
    "2026-10-25: an account can open in a set language on its first visit; the journal reviewer account opens in English. A language the browser has already chosen is kept.",
  "app.changelog.1_4_3":
    "2026-10-25: a Guide button in the footer outlines the six parts of the screen with dashed frames and names them (cumulative results, file inventory, display options, data display, tolerance scale, numerical data), as in the manuscript figure. It opens once by itself at the first result shown in a browser; clicks pass through to the application and Escape closes it. Measurement parameters and analysis history come back in expert mode. In the dark theme the chart redraws in dark colours after a theme switch, curves and points are lighter, and the partner logos are light grey instead of sitting on a white strip.",
  "app.changelog.1_4_2":
    "2026-10-25: the distance between the two pair midpoints is called δΔE, as in the manuscript (formerly ΔE_s). On the chart it is typeset like a formula, with δ and E in italic. CSV column names do not change.",
  "app.changelog.1_4_1":
    "2026-10-25: the Peaks panel shows points 1 to 4, E5 and E6 in the notation of the papers of the Electrochemistry@Soft Interfaces Team (University of Lodz): E⁺ and E⁻ are the positive and negative peak potentials of TPrA⁺ and of the analyte cation A⁺, and Δ_org^aq Φ′ is the formal Galvani potential difference of the ion transfer. Pointing at a symbol explains it in words. Measurement parameters and analysis history are hidden from the result screen for now; file metadata stays, and exports and the report are unchanged.",
  "app.changelog.1_2_0":
    "2026-09-16: result screen rebuilt: file header with metadata, four KPI cards, a large annotated chart with zoom and full screen, a peaks panel, a folder and sample tree with status dots, and collapsible parameters, history and metadata. PeakWise 1.0 added to the hub.",
  "app.changelog.1_4_0":
    "2026-09-17: accessible explanations were added to expert and session controls. Session folders can be created, renamed, removed without deleting files, and used through drag and drop or the move menu, with persisted statistics and grouped exports. Engine startup and batch work now use one centred progress window with staged or exact percentages. The hub, ITIES Detect and PeakWise now share server-side sign-in with throttling and a 12-hour session. Partner logos sit in the footer, in grey until the pointer reaches them. Measurements are added in one place, the sidebar zone, with Cmd/Ctrl+O and Cmd/Ctrl+Shift+O. The algorithm picker explains the chosen version from the manifest. The server refuses indexing through robots.txt, a header and a meta tag. A home icon and an application switcher lead between the hub, ITIES Detect and PeakWise. Sessions are named, several can live side by side, and a whole session can be written to a JSON file with SHA-256 checksums and read back without recomputing. Addendum of 17.09: the toolbar keeps seven controls for work on the data, the file and verdict counters became the filter summary at the top of the list, language, theme, operator and the partner logos moved to the footer, clearing a session lives in the Session menu, the chart shows each point number once, a manual point below the peak threshold is named in the panel, the verdict, the table and the report, Next for review moves the highlight in the list, and several files can be selected with Cmd or Shift to read them as cards or as one comparison chart.",
  "app.changelog.1_3_0":
    "2026-09-17: the session can be cleared and files, samples or folders removed with an undo bar, and a file whose content is already loaded is skipped as a duplicate. Every import and recomputation opens a progress window with live verdict counters, a stop button and status filters that stay in the toolbar. The result screen shows the verdict once, on a verdict card with the tolerance scale and its legend, and the peaks panel always lists points 1 to 4 plus E5 and E6. A missing analyte pair or standard is added by pointing at the curve or by typing the potential, never seeded by the program. Analysis parameters can be changed for the session under expert mode, within hard limits, and every result computed that way is marked as outside the validation of 16.09.2026 in the interface, the CSV and the report.",
  "app.changelog.1_4_7":
    "2026-11-05: an account can be limited to ITIES Detect alone. Text for the other pages moved to its own file, and the Close guide button no longer covers the footer links.",
};

const PL = {
  "hub.pageTitle": "Analizatory CV",
  "hub.title": "Analizatory CV",
  "hub.lead": "Narzędzia laboratorium do analizy woltamperometrii cyklicznej.",
  "hub.ities.desc": "Detekcja amfetaminy z krzywych CV (ITIES).",
  "hub.peakwise.desc": "Piki anodowe i katodowe elektrod drukowanych 3D.",
  "hub.soon": "wkrótce",
  "hub.openApp": "Otwórz {app}",

  "history.title": "Historia projektu",
  "history.1.date": "12-15.01.2025",
  "history.1.head": "Pierwszy lokalny prototyp w Pythonie",
  "history.1.text": "Aplikacja Flask „smartCCA” (AIrON, AHE) z modelem elektrochemicznym i kolorymetrycznym oraz wizja urządzenia i aplikacji do wykrywania substancji ze stężeniem.",
  "history.2.date": "19-20.05.2026",
  "history.2.head": "Geneza metody ITIES",
  "history.2.text": "Metodyka i decyzje wykonawcze prof. Półtoraka: wzorzec wewnętrzny TPrA+, punkty 1 do 4, ΔE_s = E6 - E5 około 0,350 V dla amfetaminy; specyfikacje MVP i decyzja o jednym notatniku w Google Colab.",
  "history.3.date": "20-21.05.2026",
  "history.3.head": "Pierwszy działający MVP w Colab",
  "history.3.text": "Parser plików TXT z NOVA, podział na gałęzie, find_peaks z filtrem Savitzky-Golay, decyzja WYKRYTO, NIEPEWNE albo BRAK oraz wykres z punktami 1 do 6.",
  "history.4.date": "10.07.2026",
  "history.4.head": "Zderzenie z 272 plikami z laboratorium",
  "history.4.text": "Cztery twarde błędy naprawione: parser, artefakty zapisu i okna wzorca.",
  "history.5.date": "20.07.2026",
  "history.5.head": "Odpowiedzi prof. Półtoraka",
  "history.5.text": "Ostatni pełny cykl, linia bazowa ze stycznej przed sygnałem i dwie procedury Ip, wdrożone w notatniku.",
  "history.6.date": "27.07.2026",
  "history.6.head": "Kalibracja domknięta",
  "history.6.text": "Krzywa 0,1770 c - 0,924 µA przy R² 0,9943, LOD 2,50 µM, LOQ 8,33 µM oraz pierwsza zmierzona czułość na 293 plikach pozytywnych: 41 %.",
  "history.7.date": "12-19.08.2026",
  "history.7.head": "Próg i kalibracja rozstrzygnięte",
  "history.7.text": "Pytania o próg 0,350 V, rozstrzygnięta kalibracja 0,123 i spotkanie 18.08, które domknęło Ip.",
  "history.8.date": "20.08.2026",
  "history.8.head": "Algorytm 1.0",
  "history.8.text": "Ip dwiema procedurami, w pliku zamrożonym z notatnika.",
  "history.9.date": "16.09.2026",
  "history.9.head": "Etykiety laboratorium i algorytm 1.1",
  "history.9.text": "Negatywy i etykiety labu (147 plus 45 plus 293 pliki), swoistość bez fałszywych wykryć, algorytm 1.1 z LOD i LOQ z aktywnej kalibracji oraz diagnostyką pary, a także aplikacja web 1.0 do 1.2 (Pyodide w przeglądarce, hub, PeakWise).",
  "history.10.date": "17.09.2026",
  "history.10.head": "Aplikacja 1.3 i 1.4",
  "history.10.text": "Sesje, okno postępu i wskazywanie pary analitu w 1.3; logowanie, foldery, dymki, sesje do pliku i wiele plików naraz w 1.4.",
  "versions.pageTitle": "Historia wersji · ITIES Detect",
  "versions.h1": "Historia wersji",
  "versions.algo": "Algorytm",
  "versions.note":
    "Wersja i SHA-256 pochodzą z algo/versions.json. Liczby zmierzone 16.09.2026: wykryto 121 z 293 plików pozytywnych, fałszywie wykryto 0 ze 147 plików negatywnych i 0 z 45 neutralnych.",
  "versions.diff":
    "1.1 = 1.0 + diagnostyka (LOD/LOQ z aktywnej kalibracji, ostrzeżenie below_lod, diagnostyka wyboru pary); identyczne werdykty, δΔE i Ip na 485 plikach testowych.",
  "versions.col.version": "Wersja",
  "versions.col.date": "Data",
  "versions.col.sha": "SHA-256",
  "versions.col.changes": "Zmiany",
  "versions.col.measured": "Zmierzone",
  "versions.default": "(domyślna)",
  "versions.use": "Użyj tej wersji w sesji",
  "versions.measured":
    "czułość {positives}; fałszywe wykrycia na negatywach {negatives}, na neutralach {neutrals} ({date})",
  "versions.app": "Aplikacja",
  "versions.appLine": "ITIES Detect aplikacja {version}",

  "app.changelog.1_0_0": "2026-09-16: pierwsza wersja web, silnik Pyodide, parytet z notebookiem.",
  "app.changelog.1_1_0":
    "2026-09-16: interfejs EN i PL, przełącznik motywu w pasku narzędzi, wgrywanie folderów, analiza startuje sama po wgraniu, wykres w stylu Colab.",
  "common.peakwise": "PeakWise",
  "tip.appSwitch": "Przełącza między ITIES Detect i PeakWise. Twoje pliki w tej aplikacji zostają.",
  "hub.files": ({ n }) => `${n} ${plPlural(n, "plik", "pliki", "plików")} w sesji`,
  "hub.noFiles": "brak plików",

  "app.changelog.1_4_5":
    "2026-10-25: legenda pod wykresem nazywa punkty 1 do 4 oraz E5 i E6 tymi samymi symbolami co panel Piki, na ekranie, w kartach wielu plików i w raporcie do druku.",
  "app.changelog.1_4_4":
    "2026-10-25: konto może przy pierwszej wizycie otworzyć się w ustawionym języku; konto recenzenta czasopisma otwiera się po angielsku. Język wybrany już w przeglądarce zostaje.",
  "app.changelog.1_4_3":
    "2026-10-25: przycisk Przewodnik w stopce obrysowuje przerywaną ramką sześć części ekranu i je podpisuje (wyniki zbiorcze, spis plików, opcje wyświetlania, pole danych, skala tolerancji, dane liczbowe), jak na rysunku w manuskrypcie. Otwiera się sam raz, przy pierwszym wyniku pokazanym w danej przeglądarce; kliknięcia przechodzą do aplikacji, a Escape go zamyka. Parametry pomiaru i historia analizy wracają w trybie eksperckim. W motywie ciemnym wykres po przełączeniu motywu rysuje się od nowa w ciemnych kolorach, krzywe i punkty są jaśniejsze, a logotypy partnerów są jasnoszare zamiast leżeć na białym pasku.",
  "app.changelog.1_4_2":
    "2026-10-25: odległość między środkami dwóch par nazywa się δΔE, jak w manuskrypcie (wcześniej ΔE_s). Na wykresie jest złożona jak wzór, z δ i E kursywą. Nazwy kolumn w CSV się nie zmieniają.",
  "app.changelog.1_4_1":
    "2026-10-25: panel Piki pokazuje punkty 1 do 4 oraz E5 i E6 zapisem z publikacji zespołu Electrochemistry@Soft Interfaces (UŁ): E⁺ i E⁻ to potencjały piku dodatniego i ujemnego TPrA⁺ oraz kationu analitu A⁺, a Δ_org^aq Φ′ to formalna różnica potencjałów Galvaniego przejścia jonu. Najechanie na symbol objaśnia go słowami. Parametry pomiaru i historia analizy są na razie ukryte na ekranie wyniku; metadane pliku zostają, a eksporty i raport się nie zmieniają.",
  "app.changelog.1_2_0":
    "2026-09-16: przebudowany ekran wyniku: nagłówek pliku z metadanymi, cztery karty KPI, duży opisany wykres z zoomem i pełnym ekranem, panel pików, drzewo folderów i próbek z kropkami statusu, zwijane parametry, historia i metadane. PeakWise 1.0 dodany do huba.",
  "app.changelog.1_4_0":
    "2026-09-17: dodano dostępne objaśnienia do trybu eksperckiego i kontrolek sesji. Foldery sesji można tworzyć, zmieniać ich nazwy, usuwać bez kasowania plików oraz obsługiwać przeciąganiem albo menu przenoszenia, ze statystykami zapisanymi w sesji i grupowanym eksportem. Start silnika i praca serii używają teraz jednego wyśrodkowanego okna postępu z etapami albo dokładnym procentem. Hub, ITIES Detect i PeakWise mają wspólne logowanie po stronie serwera z ograniczeniem prób i sesją ważną 12 godzin. W stopce są logotypy partnerów, szare do czasu najechania. Pliki dodaje się w jednym miejscu, w strefie paska bocznego, skrótami Cmd/Ctrl+O i Cmd/Ctrl+Shift+O. Wybór wersji algorytmu objaśnia wybraną wersję danymi z manifestu. Serwer odmawia indeksowania przez robots.txt, nagłówek i znacznik meta. Ikona domu i przełącznik aplikacji prowadzą między hubem, ITIES Detect i PeakWise. Sesje są nazwane, może ich być wiele obok siebie, a całą sesję można zapisać do pliku JSON z sumami SHA-256 i wczytać bez ponownego liczenia. Addendum z 17.09: pasek narzędzi ma siedem kontrolek do pracy na danych, licznik plików i liczniki werdyktów stały się podsumowaniem z filtrami na górze listy, język, motyw, operator i logotypy partnerów zeszły do stopki, czyszczenie sesji żyje w menu Sesja, wykres pokazuje numer punktu raz, punkt ręczny poniżej progu piku jest nazwany w panelu, na werdykcie, w tabeli i w raporcie, „Następny do oceny” przesuwa zaznaczenie w liście, a wiele plików naraz wybiera się przez Cmd albo Shift i czyta jako karty albo jeden wykres porównawczy.",
  "app.changelog.1_3_0":
    "2026-09-17: sesję można wyczyścić, a pliki, próbki i foldery usunąć z paskiem cofnięcia, a plik o treści już wczytanej jest pomijany jako duplikat. Każdy import i przeliczenie otwiera okno postępu z licznikami werdyktów na żywo, przyciskiem Przerwij i filtrami statusu, które zostają w pasku narzędzi. Ekran wyniku pokazuje werdykt raz, na karcie werdyktu ze skalą tolerancji i legendą, a panel Piki zawsze wymienia punkty 1 do 4 oraz E5 i E6. Brakującą parę analitu albo wzorzec dodaje się wskazaniem na krzywej lub wpisaniem potencjału, nigdy zasiewem programu. Parametry analizy można zmienić na czas sesji pod trybem eksperckim, w twardych granicach, a każdy wynik z nich policzony jest oznaczony jako poza walidacją z 16.09.2026 w interfejsie, w CSV i w raporcie.",
  "app.changelog.1_4_7":
    "2026-11-05: konto może być ograniczone do samego ITIES Detect. Teksty pozostałych stron są w osobnym pliku, a przycisk zamknięcia przewodnika nie zasłania już linków w stopce.",
};

extendDictionary("en", EN);
extendDictionary("pl", PL);
