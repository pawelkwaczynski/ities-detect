// UI dictionary. English is the default, Polish is the second language.
// Keys are grouped by screen. Anything that comes out of the algorithm (method labels,
// baseline rules, warning codes) is translated here, never rewritten in the module.

const EN = {
  "common.logout": "Log out",
  "common.year": "2026",
  "common.backTo": "Back to {app}",
  "app.name": "PeakWise",
  "app.tagline": "Anodic and cathodic peaks of 3D printed electrodes.",
  "app.version": "app {v}",

  "toolbar.add": "Add files",
  "toolbar.addFolder": "Add folder",
  "toolbar.analyze": "Analyse all",
  "toolbar.algoVersion": "Algorithm version",
  "toolbar.algoVersionOption": "Algorithm version: {v}",
  "toolbar.algoVersionDefault": "Algorithm version: {v} (default)",
  "toolbar.viewFiles": "Files",
  "toolbar.viewTable": "Table",
  "toolbar.export": "Export",
  "toolbar.exportCsv": "Session CSV",
  "toolbar.exportPrint": "Report (print)",
  "toolbar.operator": "Operator",
  "toolbar.list": "List",
  "toolbar.language": "Language",
  "toolbar.theme": "Theme",
  "theme.system": "system",
  "theme.light": "light",
  "theme.dark": "dark",

  "engine.starting": "Starting the engine",
  "engine.pyodide": "downloading Pyodide",
  "engine.pyodideCdn": "downloading Pyodide (CDN)",
  "engine.packages": "packages numpy, scipy, pandas",
  "engine.algorithm": "algorithm {v}",
  "engine.ready": "Engine ready",
  "engine.readyWith": "Engine ready, v{v} {sha}",
  "engine.error": "Engine error",
  "engine.errorLead": "The engine did not start. Try again. If it keeps failing, use the Pyodide copy from the CDN.",
  "engine.retry": "Try again",
  "engine.useCdn": "Use CDN",
  "engine.analysing": "Analysing {done} of {total}",
  "engine.loadingAlgo": "Loading algorithm {v}",

  "empty.title": "Drop CV files here, or use Add files.",
  "empty.body": "Supported: TXT exported from NOVA (semicolon or tab). One folder is treated as one electrode.",
  "empty.pick": "Pick a file from the list.",

  "sidebar.all": "All",
  "sidebar.withPair": "Peak pair",
  "sidebar.incomplete": "Incomplete",
  "sidebar.emptyFiltered": "No files match this filter.",
  "sidebar.empty": "No files yet. Add TXT measurements.",
  "sidebar.renameTitle": "Click to rename the electrode",
  "sidebar.renamePrompt": "Electrode name",
  "sidebar.summary": "{count} of {total} {word}",

  "status.ok": "PEAK PAIR",
  "status.anodic_only": "ANODIC ONLY",
  "status.cathodic_only": "CATHODIC ONLY",
  "status.no_peaks": "NO PEAKS",
  "status.too_few_points": "FILE TOO SHORT",
  "status.invalid": "FILE NOT RECOGNISED",
  "status.error": "ANALYSIS FAILED",

  "status.next.ok": "Both peaks were found and both currents are read against their own baseline.",
  "status.next.anodic_only": "Only the anodic peak was found. There is no cathodic reading, so no peak separation.",
  "status.next.cathodic_only": "Only the cathodic peak was found. There is no anodic reading, so no peak separation.",
  "status.next.no_peaks": "No peak was found on either branch. Check the potential window and the scan.",
  "status.next.too_few_points": "The file has fewer than 20 usable rows. Check the export from the potentiostat.",
  "status.next.invalid": "The E and I columns were not recognised. The file was not changed.",
  "status.next.error": "The file was read but the analysis stopped. The message is in the details.",

  "metric.Ip_a": "Ip anodic",
  "metric.Ip_c": "Ip cathodic",
  "metric.Ep_a": "Ep anodic",
  "metric.Ep_c": "Ep cathodic",
  "metric.dEp": "ΔEp",
  "metric.ratio": "|Ip a / Ip c|",
  "metric.none": "none",

  "read.title": "How the current was read",
  "read.anodic": "Anodic",
  "read.cathodic": "Cathodic",
  "read.method": "method",
  "read.shape": "peak shape",
  "read.baseline": "baseline",
  "read.cycle": "cycle used",

  "method.maximum": "peak maximum minus baseline",
  "method.curve_at_intersection": "curve at the tangent intersection",
  "method.tangents": "tangent intersection minus baseline",
  "method.tangents_weak": "tangent intersection (weak peak)",
  "method.plateau_fallback": "plateau fallback, curve at the intersection",
  "method.other": "other",

  "shape.clear": "clear maximum",
  "shape.weak": "shoulder without a maximum",

  "baseline.onset_fit": "least squares over [onset-0.35; onset-0.05] V",
  "baseline.foot_fit": "fallback, least squares below Ep-0.35 V",
  "baseline.tail_over_zero_crossing": "fallback, diffusion tail above the zero crossing",
  "baseline.other": "other",
  "baseline.window": "window {from} to {to} V, {width} V wide",
  "baseline.noWindow": "no window recorded, two anchor points were used",
  "baseline.quality.good": "fitted before the onset",
  "baseline.quality.fallback": "fallback rule",

  "cycle.ostatni": "last cycle of the file",
  "cycle.pierwszy": "first cycle of the file",
  "cycle.count": "{n} cycle(s) in the file",

  "chart.title": "Cyclic voltammogram",
  "chart.axisE": "E / V",
  "chart.axisI": "I / nA",
  "chart.forward": "forward",
  "chart.reverseDown": "reverse",
  "chart.reverseUp": "return",
  "chart.baselineA": "anodic baseline",
  "chart.baselineC": "cathodic baseline",
  "chart.peakA": "anodic peak",
  "chart.peakC": "cathodic peak",
  "chart.tangentA": "anodic tangent intersection",
  "chart.tangentC": "cathodic tangent intersection",
  "chart.none": "No curve. Run the analysis.",
  "chart.showTangents": "Show tangent intersections",

  "details.title": "Details",
  "details.readings": "Three readings of Ip",
  "details.maximum": "maximum minus baseline",
  "details.curveAtX": "curve at the intersection",
  "details.tangents": "tangent intersection",
  "details.reported": "reported",
  "details.dropRatio": "drop behind the maximum, as a fraction of the rise",
  "details.onset": "signal onset",
  "details.baselineAtPeak": "baseline at Ep",
  "details.eTangents": "E of the tangent intersection",
  "details.points": "points in the selected cycle",
  "details.cycles": "cycles in the file",
  "details.fileSha": "file SHA-256",
  "details.algo": "algorithm",
  "details.algoSha": "algorithm SHA-256",
  "details.cellSha": "notebook cell SHA-256",
  "details.analysedAt": "analysed at",
  "details.warnings": "Notes",

  "warn.multi_cycle": "The file holds {n} cycles. The analysis uses the {cycle}.",
  "warn.no_anodic_peak": "No anodic peak in the search window.",
  "warn.no_cathodic_peak": "No cathodic peak below the anodic one.",
  "warn.weak_peak": "{branch} peak has no clear maximum, the current comes from the tangent intersection.",
  "warn.plateau_fallback": "{branch} branch has no local minimum, the plateau fallback was used.",
  "warn.baseline_fallback": "{branch} baseline could not be fitted before the onset, a fallback rule was used.",
  "warn.baseline_window_missing": "{branch} baseline has no fitted window, two anchor points were used.",
  "warn.too_few_points": "The file has too few rows.",
  "warn.unreadable_file": "The file could not be read.",
  "warn.analysis_failed": "The analysis stopped on this file.",
  "warn.branch.anodic": "The anodic",
  "warn.branch.cathodic": "The cathodic",

  "table.title": "Session",
  "table.rule": "One row is one file. An electrode is the folder the file came from, or the name with the scan marker removed. It can be renamed in the list.",
  "table.electrode": "Electrode",
  "table.file": "File",
  "table.status": "Result",
  "table.Ip_a": "Ip a / µA",
  "table.Ip_c": "Ip c / µA",
  "table.Ep_a": "Ep a / V",
  "table.Ep_c": "Ep c / V",
  "table.dEp": "ΔEp / mV",
  "table.methodA": "Ip a method",
  "table.methodC": "Ip c method",
  "table.version": "Version",
  "table.notes": "Notes",
  "table.empty": "Nothing analysed yet.",

  "report.title": "PeakWise, session report",
  "report.operator": "operator",
  "report.notGiven": "not given",
  "report.thresholds": "Settings read from the algorithm module",
  "report.file": "File",
  "report.validation":
    "Measured on 2026-09-16 against the manual reference table of 45 electrodes (last scan of each): mean relative error of Ip anodic 1.1 % over 45 of 45 electrodes, Ip cathodic 3.2 % over 43 of 43 electrodes with a reference value. Two electrodes have no cathodic value in that table and are outside the denominator.",

  "versions.title": "Version history",
  "versions.algo": "Algorithm versions",
  "versions.app": "App versions",
  "versions.version": "Version",
  "versions.date": "Date",
  "versions.sha": "SHA-256",
  "versions.changes": "Changes",
  "versions.measured": "Measured",
  "versions.meanError": "mean error",
  "versions.against": "against",
  "versions.notebookState": "notebook state {d}",
  "versions.use": "Use this version",
  "versions.back": "Back to PeakWise",
  "versions.hub": "CV analysers",

  "common.yes": "yes",
  "common.no": "no",
  "common.none": "none",

  // --- shell of version 1.1, built to the ITIES Detect 1.4 frame ---
  "common.close": "Close",
  "toolbar.recompute": "Recompute all",
  "toolbar.view": "View",
  "toolbar.import": "Add files",
  "sidebar.label": "Electrode list",
  "sidebar.filters": "Status filters",
  "sidebar.filtersSection": "Filters",
  "sidebar.filesSection": "Files",
  "sidebar.dropTitle": "Drop files here",
  "sidebar.dropHint": "A whole folder is read as one electrode.",
  "sidebar.dropFormats": "TXT exported from NOVA, semicolon or tab",
  "summary.files": "files",
  "bucket.pair": "peak pair",
  "bucket.partial": "one branch",
  "bucket.none": "no peak",
  "bucket.unreadable": "unreadable",
  "session.menu": "Session",
  "session.currentLabel": "Current session",
  "session.nameLabel": "Session name",
  "session.new": "New session",
  "session.saveFile": "Save session to a file",
  "session.loadFile": "Load session from a file",
  "session.clear": "Clear session",
  "session.keep": "Keep",
  "session.clearTitle": "Clear the session?",
  "session.clearBody": "{n} files and their results leave this browser. The files on disk are not touched.",
  "session.clearConfirm": "Clear",
  "session.saved": "Saved {time}",
  "session.loadFailed": "That file is not a PeakWise session.",
  "status.analysed": "{done} of {total} analysed",
  "progress.title": "Series analysis",
  "progress.approximate": "approximate",
  "progress.abort": "Stop",
  "progress.of": "{done} of {total}",
  "export.backgroundHint": "Turn on background graphics in the print dialog, otherwise the charts will be pale.",
  "algo.info.label": "About this algorithm version",
  "algo.info.text": "Algorithm {v}, SHA-256 {sha}. Every result on screen was computed by this version.",
  "tip.home": "Back to the CV Analysers hub. The files stay in this browser.",
  "tip.homeLabel": "CV Analysers",
  "tip.session": "Name, save, load or clear the current set of files.",
  "tip.recompute": "Run the current algorithm version over every file again.",
  "tip.export": "Session CSV with the notebook columns, or a report for printing.",
  "tip.operator": "The name that goes into the CSV and the printed report.",
  "tip.versionsLink": "Algorithm and application versions, with their measured error.",
  "tip.logoZoom": "Show the PeakWise mark large.",
  "tip.sidebarDrop": "Drop TXT files or a folder here. A folder is read as one electrode.",
  "tip.import": "Pick TXT files from disk.",
  "tip.addFolder": "Pick a folder, read as one electrode.",
  "tip.appSwitch": "Switch between the analysers. Each keeps its own files.",
  "partner.ul": "University of Lodz",
  "partner.ahe": "Academy of Humanities and Economics in Lodz",

};

const PL = {
  "common.logout": "Wyloguj",
  "common.year": "2026",
  "common.backTo": "Wróć do {app}",
  "app.name": "PeakWise",
  "app.tagline": "Piki anodowe i katodowe elektrod drukowanych 3D.",
  "app.version": "aplikacja {v}",

  "toolbar.add": "Dodaj pliki",
  "toolbar.addFolder": "Dodaj folder",
  "toolbar.analyze": "Analizuj wszystko",
  "toolbar.algoVersion": "Wersja algorytmu",
  "toolbar.algoVersionOption": "Wersja algorytmu: {v}",
  "toolbar.algoVersionDefault": "Wersja algorytmu: {v} (domyślna)",
  "toolbar.viewFiles": "Pliki",
  "toolbar.viewTable": "Tabela",
  "toolbar.export": "Eksport",
  "toolbar.exportCsv": "CSV sesji",
  "toolbar.exportPrint": "Raport (druk)",
  "toolbar.operator": "Operator",
  "toolbar.list": "Lista",
  "toolbar.language": "Język",
  "toolbar.theme": "Motyw",
  "theme.system": "systemowy",
  "theme.light": "jasny",
  "theme.dark": "ciemny",

  "engine.starting": "Uruchamianie silnika",
  "engine.pyodide": "pobieranie Pyodide",
  "engine.pyodideCdn": "pobieranie Pyodide (CDN)",
  "engine.packages": "pakiety numpy, scipy, pandas",
  "engine.algorithm": "algorytm {v}",
  "engine.ready": "Silnik gotowy",
  "engine.readyWith": "Silnik gotowy, v{v} {sha}",
  "engine.error": "Błąd silnika",
  "engine.errorLead": "Silnik nie wystartował. Spróbuj ponownie. Jeśli to się powtarza, użyj kopii Pyodide z CDN.",
  "engine.retry": "Spróbuj ponownie",
  "engine.useCdn": "Użyj CDN",
  "engine.analysing": "Analiza {done} z {total}",
  "engine.loadingAlgo": "Ładowanie algorytmu {v}",

  "empty.title": "Upuść tu pliki CV albo kliknij Dodaj pliki.",
  "empty.body": "Obsługiwane: TXT z NOVA (średnik albo tabulator). Jeden folder to jedna elektroda.",
  "empty.pick": "Wybierz plik z listy.",

  "sidebar.all": "Wszystkie",
  "sidebar.withPair": "Para pików",
  "sidebar.incomplete": "Niepełne",
  "sidebar.emptyFiltered": "Brak plików w tym filtrze.",
  "sidebar.empty": "Brak plików. Dodaj pomiary TXT.",
  "sidebar.renameTitle": "Kliknij, żeby zmienić nazwę elektrody",
  "sidebar.renamePrompt": "Nazwa elektrody",
  "sidebar.summary": "{count} z {total} {word}",

  "status.ok": "PARA PIKÓW",
  "status.anodic_only": "TYLKO ANODOWY",
  "status.cathodic_only": "TYLKO KATODOWY",
  "status.no_peaks": "BRAK PIKÓW",
  "status.too_few_points": "PLIK ZA KRÓTKI",
  "status.invalid": "NIE ROZPOZNANO PLIKU",
  "status.error": "ANALIZA PRZERWANA",

  "status.next.ok": "Oba piki znalezione, każdy prąd odczytany względem własnej linii bazowej.",
  "status.next.anodic_only": "Znaleziony tylko pik anodowy. Bez odczytu katodowego nie ma rozdziału pików.",
  "status.next.cathodic_only": "Znaleziony tylko pik katodowy. Bez odczytu anodowego nie ma rozdziału pików.",
  "status.next.no_peaks": "Na żadnej gałęzi nie ma piku. Sprawdź okno potencjału i skan.",
  "status.next.too_few_points": "Plik ma mniej niż 20 wierszy z danymi. Sprawdź eksport z potencjostatu.",
  "status.next.invalid": "Nie rozpoznano kolumn E oraz I. Plik nie został zmieniony.",
  "status.next.error": "Plik został wczytany, ale analiza się zatrzymała. Komunikat jest w szczegółach.",

  "metric.Ip_a": "Ip anodowe",
  "metric.Ip_c": "Ip katodowe",
  "metric.Ep_a": "Ep anodowe",
  "metric.Ep_c": "Ep katodowe",
  "metric.dEp": "ΔEp",
  "metric.ratio": "|Ip a / Ip c|",
  "metric.none": "brak",

  "read.title": "Jak odczytano prąd",
  "read.anodic": "Anodowy",
  "read.cathodic": "Katodowy",
  "read.method": "metoda",
  "read.shape": "kształt piku",
  "read.baseline": "linia bazowa",
  "read.cycle": "użyty cykl",

  "method.maximum": "maksimum piku minus bazowa",
  "method.curve_at_intersection": "krzywa przy przecięciu stycznych",
  "method.tangents": "przecięcie stycznych minus bazowa",
  "method.tangents_weak": "przecięcie stycznych (pik słaby)",
  "method.plateau_fallback": "fallback plateau, krzywa przy przecięciu",
  "method.other": "inna",

  "shape.clear": "wyraźne maksimum",
  "shape.weak": "ramię bez maksimum",

  "baseline.onset_fit": "MNK po odcinku [onset-0,35; onset-0,05] V",
  "baseline.foot_fit": "zapas, MNK poniżej Ep-0,35 V",
  "baseline.tail_over_zero_crossing": "zapas, ogon dyfuzyjny nad przejściem przez zero",
  "baseline.other": "inna",
  "baseline.window": "okno {from} do {to} V, szerokość {width} V",
  "baseline.noWindow": "bez okna, użyto dwóch kotwic",
  "baseline.quality.good": "dopasowana przed onsetem",
  "baseline.quality.fallback": "reguła zapasowa",

  "cycle.ostatni": "ostatni cykl pliku",
  "cycle.pierwszy": "pierwszy cykl pliku",
  "cycle.count": "cykli w pliku: {n}",

  "chart.title": "Woltamperogram cykliczny",
  "chart.axisE": "E / V",
  "chart.axisI": "I / nA",
  "chart.forward": "w przód",
  "chart.reverseDown": "powrót",
  "chart.reverseUp": "domknięcie",
  "chart.baselineA": "bazowa anodowa",
  "chart.baselineC": "bazowa katodowa",
  "chart.peakA": "pik anodowy",
  "chart.peakC": "pik katodowy",
  "chart.tangentA": "przecięcie stycznych, anodowe",
  "chart.tangentC": "przecięcie stycznych, katodowe",
  "chart.none": "Brak wykresu. Uruchom analizę.",
  "chart.showTangents": "Pokaż przecięcia stycznych",

  "details.title": "Szczegóły",
  "details.readings": "Trzy odczyty Ip",
  "details.maximum": "maksimum minus bazowa",
  "details.curveAtX": "krzywa przy przecięciu",
  "details.tangents": "przecięcie stycznych",
  "details.reported": "raportowane",
  "details.dropRatio": "spadek za maksimum, ułamek wzrostu",
  "details.onset": "onset sygnału",
  "details.baselineAtPeak": "bazowa przy Ep",
  "details.eTangents": "E przecięcia stycznych",
  "details.points": "punkty w wybranym cyklu",
  "details.cycles": "cykle w pliku",
  "details.fileSha": "SHA-256 pliku",
  "details.algo": "algorytm",
  "details.algoSha": "SHA-256 algorytmu",
  "details.cellSha": "SHA-256 komórki notebooka",
  "details.analysedAt": "czas analizy",
  "details.warnings": "Uwagi",

  "warn.multi_cycle": "Plik ma {n} cykli. Analiza używa: {cycle}.",
  "warn.no_anodic_peak": "Brak piku anodowego w oknie wyszukiwania.",
  "warn.no_cathodic_peak": "Brak piku katodowego poniżej anodowego.",
  "warn.weak_peak": "{branch} pik nie ma wyraźnego maksimum, prąd pochodzi z przecięcia stycznych.",
  "warn.plateau_fallback": "{branch} gałąź nie ma lokalnego minimum, użyto fallbacku plateau.",
  "warn.baseline_fallback": "{branch} bazowej nie udało się dopasować przed onsetem, użyto reguły zapasowej.",
  "warn.baseline_window_missing": "{branch} bazowa nie ma dopasowanego okna, użyto dwóch kotwic.",
  "warn.too_few_points": "Plik ma za mało wierszy.",
  "warn.unreadable_file": "Nie udało się wczytać pliku.",
  "warn.analysis_failed": "Analiza zatrzymała się na tym pliku.",
  "warn.branch.anodic": "Anodowy",
  "warn.branch.cathodic": "Katodowy",

  "table.title": "Sesja",
  "table.rule": "Jeden wiersz to jeden plik. Elektroda to folder, z którego przyszedł plik, albo nazwa bez znacznika skanu. Można ją zmienić na liście.",
  "table.electrode": "Elektroda",
  "table.file": "Plik",
  "table.status": "Wynik",
  "table.Ip_a": "Ip a / µA",
  "table.Ip_c": "Ip c / µA",
  "table.Ep_a": "Ep a / V",
  "table.Ep_c": "Ep c / V",
  "table.dEp": "ΔEp / mV",
  "table.methodA": "Metoda Ip a",
  "table.methodC": "Metoda Ip c",
  "table.version": "Wersja",
  "table.notes": "Uwagi",
  "table.empty": "Nic jeszcze nie policzono.",

  "report.title": "PeakWise, raport sesji",
  "report.operator": "operator",
  "report.notGiven": "nie podano",
  "report.thresholds": "Ustawienia odczytane z modułu algorytmu",
  "report.file": "Plik",
  "report.validation":
    "Zmierzone 16.09.2026 wobec ręcznej tabeli 45 elektrod (ostatni skan każdej): średni błąd względny Ip anodowego 1,1 % na 45 z 45 elektrod, Ip katodowego 3,2 % na 43 z 43 elektrod z wartością odniesienia. Dwie elektrody nie mają wartości katodowej w tej tabeli i są poza mianownikiem.",

  "versions.title": "Historia wersji",
  "versions.algo": "Wersje algorytmu",
  "versions.app": "Wersje aplikacji",
  "versions.version": "Wersja",
  "versions.date": "Data",
  "versions.sha": "SHA-256",
  "versions.changes": "Zmiany",
  "versions.measured": "Zmierzone",
  "versions.meanError": "średni błąd",
  "versions.against": "wobec",
  "versions.notebookState": "stan notebooka {d}",
  "versions.use": "Użyj tej wersji",
  "versions.back": "Wróć do PeakWise",
  "versions.hub": "Analizatory CV",

  "common.yes": "tak",
  "common.no": "nie",
  "common.none": "brak",

  // --- powłoka wersji 1.1, ta sama rama co ITIES Detect 1.4 ---
  "common.close": "Zamknij",
  "toolbar.recompute": "Przelicz ponownie",
  "toolbar.view": "Widok",
  "toolbar.import": "Dodaj pliki",
  "sidebar.label": "Lista elektrod",
  "sidebar.filters": "Filtry statusu",
  "sidebar.filtersSection": "Filtry",
  "sidebar.filesSection": "Pliki",
  "sidebar.dropTitle": "Upuść pliki tutaj",
  "sidebar.dropHint": "Cały folder czytamy jako jedną elektrodę.",
  "sidebar.dropFormats": "TXT z programu NOVA, średnik albo tabulator",
  "summary.files": "plików",
  "bucket.pair": "para pików",
  "bucket.partial": "jedna gałąź",
  "bucket.none": "brak piku",
  "bucket.unreadable": "nie do odczytu",
  "session.menu": "Sesja",
  "session.currentLabel": "Bieżąca sesja",
  "session.nameLabel": "Nazwa sesji",
  "session.new": "Nowa sesja",
  "session.saveFile": "Zapisz sesję do pliku",
  "session.loadFile": "Wczytaj sesję z pliku",
  "session.clear": "Wyczyść sesję",
  "session.keep": "Zostaw",
  "session.clearTitle": "Wyczyścić sesję?",
  "session.clearBody": "{n} plików i ich wyniki znikną z tej przeglądarki. Plików na dysku to nie dotyka.",
  "session.clearConfirm": "Wyczyść",
  "session.saved": "Zapisano {time}",
  "session.loadFailed": "To nie jest plik sesji PeakWise.",
  "status.analysed": "przeanalizowano {done} z {total}",
  "progress.title": "Analiza serii",
  "progress.approximate": "orientacyjnie",
  "progress.abort": "Przerwij",
  "progress.of": "{done} z {total}",
  "export.backgroundHint": "W oknie drukowania włącz grafikę tła, inaczej wykresy wyjdą blade.",
  "algo.info.label": "O tej wersji algorytmu",
  "algo.info.text": "Algorytm {v}, SHA-256 {sha}. Każdy wynik na ekranie policzyła ta wersja.",
  "tip.home": "Powrót do huba Analizatory CV. Pliki zostają w tej przeglądarce.",
  "tip.homeLabel": "Analizatory CV",
  "tip.session": "Nazwij, zapisz, wczytaj albo wyczyść bieżący zestaw plików.",
  "tip.recompute": "Policz wszystkie pliki jeszcze raz bieżącą wersją algorytmu.",
  "tip.export": "CSV sesji w kolumnach notebooka albo raport do druku.",
  "tip.operator": "Nazwisko, które trafia do CSV i do raportu.",
  "tip.versionsLink": "Wersje algorytmu i aplikacji razem ze zmierzonym błędem.",
  "tip.logoZoom": "Pokaż znak PeakWise w dużym rozmiarze.",
  "tip.sidebarDrop": "Upuść tutaj pliki TXT albo folder. Folder czytamy jako jedną elektrodę.",
  "tip.import": "Wybierz pliki TXT z dysku.",
  "tip.addFolder": "Wybierz folder, czytany jako jedną elektrodę.",
  "tip.appSwitch": "Przełącz się między analizatorami. Każdy trzyma swoje pliki.",
  "partner.ul": "Uniwersytet Łódzki",
  "partner.ahe": "Akademia Humanistyczno-Ekonomiczna w Łodzi",

};

const DICTS = { en: EN, pl: PL };
export const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "pl", label: "PL" },
];
// The hub and ITIES Detect store the interface language under this key
// (static/shared/i18n.js in 09_aplikacja_web_20260916). PeakWise keeps its own
// dictionary, because its wording is its own, but shares the choice.
const STORAGE_KEY = "analizatory-lang";

let current = "en";

// The local choice comes first, the cookie is the server hint for the login page.
export function initLang() {
  let chosen = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) chosen = saved;
  } catch (_) {
    /* private mode, keep the default */
  }
  if (!chosen) {
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(STORAGE_KEY + "="));
    if (cookie) {
      const saved = decodeURIComponent(cookie.slice(STORAGE_KEY.length + 1));
      if (DICTS[saved]) chosen = saved;
    }
  }
  if (chosen) current = chosen;
  document.documentElement.lang = current;
  return current;
}

export function getLang() {
  return current;
}

export function setLang(code) {
  if (!DICTS[code]) return current;
  current = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch (_) {
    /* nothing to do, the choice just will not survive a reload */
  }
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return current;
}

export function t(key, params) {
  const dict = DICTS[current] || EN;
  let text = dict[key];
  if (text === undefined) text = EN[key];
  if (text === undefined) return key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) =>
    params[name] === undefined ? m : String(params[name])
  );
}

// Locale used for number formatting. Polish uses a comma as the decimal mark.
export function locale() {
  return current === "pl" ? "pl-PL" : "en-GB";
}

export function applyStaticText(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nLabel));
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  }
}
