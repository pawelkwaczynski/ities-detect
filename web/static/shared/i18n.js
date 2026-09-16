// Single source of UI text for the hub, the ITIES app and the version history page.
// PL is the lab's own wording, EN is the professional translation.
// Values are strings with {placeholders}, or functions of the parameter object
// when a language needs its own grammar (Polish plurals).

const STORAGE_KEY = "analizatory-lang";
const DEFAULT_LANG = "en";

export const LANGS = ["en", "pl"];

// 1 plik / 2 pliki / 5 plików
function plPlural(n, one, few, many) {
  const last = n % 10;
  const lastTwo = n % 100;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

const EN = {
  "lang.en": "EN",
  "lang.pl": "PL",
  "prefs.language": "Language",
  "prefs.theme": "Theme",
  "prefs.theme.system": "System",
  "prefs.theme.light": "Light",
  "prefs.theme.dark": "Dark",

  "common.none": "none",
  "common.versions": "Version history",
  "common.year": "2026",
  "common.analysers": "CV Analysers",
  "common.ities": "ITIES Detect",

  "hub.pageTitle": "CV Analysers",
  "hub.title": "CV Analysers",
  "hub.lead": "Laboratory tools for cyclic voltammetry analysis.",
  "hub.ities.desc": "Amphetamine detection from CV curves (ITIES).",
  "hub.peakwise.desc": "Anodic and cathodic peaks of 3D printed electrodes.",
  "hub.soon": "soon",

  "toolbar.addFiles": "Add files",
  "toolbar.addFolder": "Add folder",
  "toolbar.recompute": "Recompute all",
  "toolbar.algoVersion": "Algorithm version: {version}",
  "toolbar.algoVersionDefault": "Algorithm version: {version} (default)",
  "toolbar.algoVersionLabel": "Algorithm version",
  "toolbar.expert": "Expert mode",
  "toolbar.view": "View",
  "toolbar.viewFiles": "Files",
  "toolbar.viewTable": "Table",
  "toolbar.export": "Export",
  "toolbar.exportCsv": "Session CSV",
  "toolbar.exportPdf": "PDF report (print)",
  "toolbar.operator": "Operator",
  "toolbar.list": "List",
  "toolbar.count": ({ n }) => (n === 1 ? "1 file loaded" : `${n} files loaded`),
  "toolbar.skipped": ({ n, exts }) => `skipped ${n} (${exts})`,

  "engine.starting": "Starting the engine",
  "engine.stage.pyodide": "downloading Pyodide",
  "engine.stage.packages": "packages",
  "engine.stage.algorithm": "algorithm",
  "engine.ready": "Engine ready",
  "engine.readyWith": "Engine ready · v{version} {sha}",
  "engine.loadingAlgo": "Loading algorithm {version}",
  "engine.error": "Engine error",
  "engine.errorBody":
    "The engine did not start. Try again. If it keeps failing, use the Pyodide copy from the CDN.",
  "engine.retry": "Try again",
  "engine.useCdn": "Use CDN",
  "engine.analysing": "Analysing {done} of {total}",
  "engine.analysisError": "Analysis error: {message}",

  "empty.drop": "Drop NOVA TXT files here, or click Add files.",
  "empty.formats":
    "Supported: TXT (NOVA, semicolon or tab). The .nox files are not supported, export them to TXT.",
  "empty.pickFile": "Pick a file from the list.",
  "empty.noChart": "No chart yet. Run the analysis.",

  "files.noxSkipped": "{name}: .nox file is not supported, export it to TXT.",

  "sidebar.label": "File list",
  "sidebar.filters": "Filters",
  "sidebar.all": "All",
  "sidebar.review": "For review",
  "sidebar.unsuitable": "Not assessable",
  "sidebar.empty": "No files. Add TXT measurements.",
  "sidebar.emptyFilter": "No files in this filter.",
  "sidebar.renameHint": "Click to change the sample ID",
  "sidebar.renamePrompt": "Sample ID",
  "sidebar.folderToggle": "Show or hide the folder contents",

  "state.queued": "queued",
  "state.running": "computing…",
  "state.error": "error",


  "verdict.detected.word": "DETECTED",
  "verdict.detected.next":
    "Signal consistent with the amphetamine criterion. The measurement passed quality control.",
  "verdict.uncertain.word": "EXPERT REVIEW",
  "verdict.uncertain.next":
    "The signal sits in the band that needs an expert eye. Check the chart or repeat the measurement.",
  "verdict.not_detected.word": "NOT DETECTED IN THIS MEASUREMENT",
  "verdict.not_detected.next":
    "No signal met the criterion. This is not proof that the substance is absent.",
  "verdict.TPrA_ONLY.word": "STANDARD ONLY, NO ANALYTE",
  "verdict.TPrA_ONLY.next": "The TPrA standard was found, no reliable analyte pair.",
  "verdict.NO_VALID_ANALYTE_PAIR.word": "INVALID PAIR",
  "verdict.NO_VALID_ANALYTE_PAIR.next":
    "Candidates exist, but no pair satisfies the E4 > E3 condition.",
  "verdict.MEASUREMENT_QUALITY_FAIL.word": "MEASUREMENT NOT ASSESSABLE",
  "verdict.MEASUREMENT_QUALITY_FAIL.NO_TPRA_IN_WINDOWS":
    "No TPrA standard signal in the window. Add the standard and repeat the measurement.",
  "verdict.MEASUREMENT_QUALITY_FAIL.NO_CANDIDATES": "No peaks on the branches.",
  "verdict.MEASUREMENT_QUALITY_FAIL.NO_VALID_TPRA_PAIR":
    "The peaks in the standard window do not form a valid pair.",
  "verdict.MEASUREMENT_QUALITY_FAIL.fallback": "Repeat the measurement in the laboratory.",
  "verdict.too_few_points.word": "INCOMPLETE FILE",
  "verdict.too_few_points.next":
    "The file has too few points (a recording artefact). Check the export from the potentiostat.",
  "verdict.invalid.word": "FILE NOT RECOGNISED",
  "verdict.invalid.next": "The E/I columns were not recognised. The file was not modified.",

  "verdict.justification": "ΔE_s = {value} V, {mv} mV from the {target} V reference",
  "verdict.noDelta": "No ΔE_s for this result.",
  "verdict.auto": "Automatic",
  "verdict.expertWho": "Expert ({operator}, {time})",
  "verdict.expertNoName": "Expert ({time})",

  "scale.aria":
    "Deviation from the reference {dev}. Matching range up to {ok} mV, review range up to {warn} mV, scale from {min} to +{max} mV.",
  "scale.ok": "matching range ±{mv} mV",
  "scale.warn": "review range ±{mv} mV",
  "scale.out": "out of range",

  "chart.axisCal": "E / V (after TPrA calibration)",
  "chart.axisRaw": "E / V (raw)",
  "chart.axisI": "I / µA",
  "chart.toggleCal": "E after calibration",
  "chart.toggleRaw": "E raw",
  "chart.axisGroup": "Potential axis",
  "chart.legend.fwd": "Forward scan",
  "chart.legend.bwd": "Reverse scan",
  "chart.legend.p1": "1: TPrA−",
  "chart.legend.p2": "2: TPrA+",
  "chart.legend.p3": "3: Analyte−",
  "chart.legend.p4": "4: Analyte+",
  "chart.legend.e5": "E5 (TPrA)",
  "chart.legend.e6": "E6 (analyte)",
  "chart.legend.baseline": "Analyte baseline (fit)",
  "chart.delta": "ΔE_s = {value} V",
  "chart.aria": "Cyclic voltammetry chart for {name}, verdict {verdict}.",

  "details.summary": "Details",
  "details.ipTpraFwd": "TPrA standard Ip (fwd)",
  "details.ipTpraBwd": "TPrA standard Ip (bwd)",
  "details.ipAnalyteFwd": "Analyte Ip (fwd)",
  "details.ipAnalyteBwd": "Analyte Ip (bwd)",
  "details.ipWithMethod": "{value} µA, method: {method}",
  "details.method.curve": "curve",
  "details.method.peak_max": "maximum above baseline",
  "details.method.tangent_intersection": "tangent intersection",
  "details.method.peak_max_fallback": "maximum above baseline, tangents did not converge",
  "details.method.tangents": "tangents",
  "details.concentration": "Concentration",
  "details.concentrationValue": "{value} µM (calibration {calibration})",
  "details.purity": "Purity",
  "details.lodLoq": "LOD / LOQ",
  "details.shift": "Shift",
  "details.cycles": "Cycles",
  "details.cyclesValue": "{total} (used: {used})",
  "details.fileSha": "File SHA-256",
  "details.algo": "Algorithm",
  "details.algoSha": "Algorithm SHA",
  "details.analysedAt": "Analysis time",
  "details.mode": "Mode",
  "details.statusCode": "Status code",
  "mode.auto": "auto",
  "mode.manual": "manual",

  "table.sample": "Sample",
  "table.file": "File",
  "table.quality": "Quality",
  "table.verdict": "Verdict",
  "table.delta": "ΔE_s",
  "table.err": "Deviation mV",
  "table.ip": "Analyte Ip",
  "table.version": "Version",
  "table.mode": "Mode",
  "table.warn": "Warnings",
  "table.qualityOk": "OK",
  "table.aggregation":
    "A sample is DETECTED when at least one file is DETECTED; otherwise EXPERT REVIEW when at least one file needs review; otherwise NOT DETECTED when at least one measurement was valid; otherwise the measurements are NOT ASSESSABLE.",

  "expert.hint":
    "Drag points 1 to 4 on the chart. Points 1 and 3 sit on the reverse branch, 2 and 4 on the forward branch. The algorithm snaps to the nearest point of the branch.",
  "expert.reason": "Correction reason",
  "expert.save": "Save correction",
  "expert.report": "Report discrepancy",
  "expert.needReason": "Give a correction reason to save.",
  "expert.needReasonReport": "Give a reason to report a discrepancy.",
  "expert.needPoints": "Move the points on the chart first.",
  "expert.error": "Correction error: {message}",

  "print.title": "ITIES Detect, session report",
  "print.meta": "{datetime} · operator: {operator}",
  "print.noOperator": "not given",
  "print.algo": "Algorithm v{version} · SHA-256 {sha}",
  "print.thresholds": "Thresholds:",
  "print.fileSha": "File SHA-256: {sha}",
  "print.points.pt": "Pt",
  "print.points.eRaw": "E raw / V",
  "print.points.eCal": "E calibrated / V",
  "print.points.i": "I / µA",
  "print.auto": "Automatic",
  "print.expert": "Expert",
  "print.chartAlt": "CV chart {name}",
  "print.disclaimer":
    "NOT DETECTED means that no signal met the criterion in this measurement, not proof that the substance is absent. Method sensitivity on the laboratory data (16.09.2026): 121 of 293 positive files; false detections: 0 of 192 blanks.",

  "versions.pageTitle": "Version history · ITIES Detect",
  "versions.h1": "Version history",
  "versions.algo": "Algorithm",
  "versions.note":
    "Version and SHA-256 come from algo/versions.json. Measured on 16.09.2026: 121 of 293 positive files, 0 false detections on 192 blanks.",
  "versions.diff":
    "1.1 = 1.0 + diagnostics (LOD/LOQ from the active calibration, below_lod warning, pair selection diagnostics); identical verdicts, ΔE_s and Ip on 485 test files.",
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

  "algo.changelog.1_1.lod": "LOD/LOQ from the active calibration plus a below_lod warning",
  "algo.changelog.1_1.pair": "pair selection diagnostics (n_par_sanity, second_best_error_mV)",
  "algo.changelog.1_0.notebook":
    "notebook state of 20.08.2026: Ip by two procedures (maximum above baseline, tangent intersection)",

  "app.changelog.1_0_0":
    "2026-09-16: first web version, Pyodide engine, parity with the notebook.",
  "app.changelog.1_1_0":
    "2026-09-16: EN and PL interface, theme switch in the toolbar, folder upload, analysis starts on its own after upload, Colab style chart.",
  "app.name": "ITIES Detect",
  "app.tagline": "ITIES electrochemistry measurement analysis",
  "app.skipToContent": "Skip to the result",

  "toolbar.import": "Import measurements",
  "toolbar.analyseSeries": "Analyse series",
  "toolbar.algorithm": "Algorithm {version}",
  "toolbar.algorithmDefault": "Algorithm {version} (default)",

  "sidebar.searchLabel": "Search samples",
  "sidebar.searchPlaceholder": "Search samples",
  "sidebar.noMatch": "No sample matches this search.",
  "sidebar.dropTitle": "Drop measurement files",
  "sidebar.dropHint": "or use the buttons below",
  "sidebar.dropFormats": "TXT from NOVA, semicolon or tab",
  "sidebar.tree": "Samples and files",
  "sidebar.loose": "Single files",

  "breadcrumb.label": "Location of this file",

  "head.points": ({ n }) => (n === 1 ? "1 point" : `${n} points`),
  "head.pointsUsed": "{used} of {total} points",
  "head.cycle": "cycle {used} of {total}",
  "head.sample": "sample {id}",
  "head.noAnalysis": "not analysed yet",

  "kpi.delta": "ΔE_s",
  "kpi.reference": "Reference",
  "kpi.deviation": "Deviation",
  "kpi.status": "Status",
  "kpi.tolerance": "Tolerance (mV)",

  "chart.title": "Cyclic voltammogram",
  "chart.subtitleAuto": "Liquid-liquid interface · automatic analysis",
  "chart.subtitleExpert": "Liquid-liquid interface · expert correction",
  "chart.zoomIn": "Zoom in",
  "chart.zoomOut": "Zoom out",
  "chart.reset": "Reset view",
  "chart.fullscreen": "Full screen",
  "chart.markers": "Show markers",
  "chart.controls": "Chart controls",

  "peaks.title": "Peaks",
  "peaks.col.n": "#",
  "peaks.col.e": "E (V)",
  "peaks.col.i": "I (µA)",
  "peaks.col.type": "Type",
  "peaks.type.1": "standard−",
  "peaks.type.2": "standard+",
  "peaks.type.3": "analyte−",
  "peaks.type.4": "analyte+",
  "peaks.empty": "The algorithm marked no peaks in this measurement.",
  "peaks.redetect": "Detect again",
  "peaks.edit": "Edit peaks",
  "peaks.editOff": "Stop editing",

  "analysis.title": "ITIES analysis",
  "analysis.window": "Potential window",
  "analysis.reference": "Reference",
  "analysis.delta": "ΔE_s",
  "analysis.deviation": "Deviation",

  "section.params": "Measurement parameters",
  "section.history": "Analysis history",
  "section.metadata": "File metadata",

  "params.thresholds": "Thresholds of this algorithm version",
  "params.tpraTarget": "TPrA standard target",
  "params.amphTarget": "Amphetamine ΔE_s criterion",
  "params.tolerance": "Detection / review tolerance",
  "params.prominence": "Peak prominence",
  "params.weak": "Weak peak candidates",
  "params.calibration": "Active calibration",
  "params.points": "Points",
  "params.cycles": "Cycles",

  "history.auto": "Automatic analysis",
  "history.expert": "Expert correction",
  "history.none": "Only the current analysis. No earlier revision in this session.",
  "history.current": "current",

  "meta.fileName": "File name",
  "meta.folder": "Folder",
  "meta.size": "Size",
  "meta.modified": "File date",

  "statusbar.done": "Analysis finished",
  "statusbar.time": "time {seconds} s",
  "statusbar.pending": "Waiting for analysis",
  "statusbar.running": "Analysis running",
  "statusbar.idle": "No file selected",

  "common.yes": "yes",
  "common.no": "no",

  "app.changelog.1_2_0":
    "2026-09-16: result screen rebuilt: file header with metadata, four KPI cards, a large annotated chart with zoom and full screen, a peaks panel, a folder and sample tree with status dots, and collapsible parameters, history and metadata. PeakWise 1.0 added to the hub.",
};

const PL = {
  "lang.en": "EN",
  "lang.pl": "PL",
  "prefs.language": "Język",
  "prefs.theme": "Motyw",
  "prefs.theme.system": "System",
  "prefs.theme.light": "Jasny",
  "prefs.theme.dark": "Ciemny",

  "common.none": "brak",
  "common.versions": "Historia wersji",
  "common.year": "2026",
  "common.analysers": "Analizatory CV",
  "common.ities": "ITIES Detect",

  "hub.pageTitle": "Analizatory CV",
  "hub.title": "Analizatory CV",
  "hub.lead": "Narzędzia laboratorium do analizy woltamperometrii cyklicznej.",
  "hub.ities.desc": "Detekcja amfetaminy z krzywych CV (ITIES).",
  "hub.peakwise.desc": "Piki anodowe i katodowe elektrod drukowanych 3D.",
  "hub.soon": "wkrótce",

  "toolbar.addFiles": "Dodaj pliki",
  "toolbar.addFolder": "Dodaj folder",
  "toolbar.recompute": "Przelicz ponownie",
  "toolbar.algoVersion": "Wersja algorytmu: {version}",
  "toolbar.algoVersionDefault": "Wersja algorytmu: {version} (domyślna)",
  "toolbar.algoVersionLabel": "Wersja algorytmu",
  "toolbar.expert": "Tryb ekspercki",
  "toolbar.view": "Widok",
  "toolbar.viewFiles": "Pliki",
  "toolbar.viewTable": "Tabela",
  "toolbar.export": "Eksport",
  "toolbar.exportCsv": "CSV sesji",
  "toolbar.exportPdf": "Raport PDF (druk)",
  "toolbar.operator": "Operator",
  "toolbar.list": "Lista",
  "toolbar.count": ({ n }) => `Wgrano ${n} ${plPlural(n, "plik", "pliki", "plików")}`,
  "toolbar.skipped": ({ n, exts }) => `pominięto ${n} (${exts})`,

  "engine.starting": "Uruchamianie silnika",
  "engine.stage.pyodide": "pobieranie Pyodide",
  "engine.stage.packages": "pakiety",
  "engine.stage.algorithm": "algorytm",
  "engine.ready": "Silnik gotowy",
  "engine.readyWith": "Silnik gotowy · v{version} {sha}",
  "engine.loadingAlgo": "Ładowanie algorytmu {version}",
  "engine.error": "Błąd silnika",
  "engine.errorBody":
    "Silnik nie wystartował. Spróbuj ponownie. Jeśli to się powtarza, użyj kopii Pyodide z CDN.",
  "engine.retry": "Spróbuj ponownie",
  "engine.useCdn": "Użyj CDN",
  "engine.analysing": "Analiza {done} z {total}",
  "engine.analysisError": "Błąd analizy: {message}",

  "empty.drop": "Upuść tu pliki TXT z NOVA albo kliknij Dodaj pliki.",
  "empty.formats":
    "Obsługiwane: TXT (NOVA, średnik lub tabulator). Pliki .nox nie są obsługiwane, wyeksportuj je do TXT.",
  "empty.pickFile": "Wybierz plik z listy.",
  "empty.noChart": "Brak wykresu. Uruchom analizę.",

  "files.noxSkipped": "{name}: plik .nox nieobsługiwany, wyeksportuj do TXT.",

  "sidebar.label": "Lista plików",
  "sidebar.filters": "Filtry",
  "sidebar.all": "Wszystkie",
  "sidebar.review": "Do oceny",
  "sidebar.unsuitable": "Nie nadające się",
  "sidebar.empty": "Brak plików. Dodaj pomiary TXT.",
  "sidebar.emptyFilter": "Brak plików w tym filtrze.",
  "sidebar.renameHint": "Kliknij, żeby zmienić ID próbki",
  "sidebar.renamePrompt": "ID próbki",
  "sidebar.folderToggle": "Pokaż lub ukryj zawartość folderu",

  "state.queued": "w kolejce",
  "state.running": "liczę…",
  "state.error": "błąd",


  "verdict.detected.word": "WYKRYTO",
  "verdict.detected.next":
    "Sygnał zgodny z kryterium amfetaminy. Pomiar przeszedł kontrolę jakości.",
  "verdict.uncertain.word": "DO OCENY EKSPERTA",
  "verdict.uncertain.next":
    "Sygnał w paśmie, które wymaga oka eksperta. Sprawdź wykres lub powtórz pomiar.",
  "verdict.not_detected.word": "NIE STWIERDZONO W TYM POMIARZE",
  "verdict.not_detected.next":
    "Nie znaleziono sygnału spełniającego kryterium. To nie jest dowód nieobecności substancji.",
  "verdict.TPrA_ONLY.word": "WZORZEC BEZ ANALITU",
  "verdict.TPrA_ONLY.next": "Wzorzec TPrA znaleziony, brak wiarygodnej pary analitu.",
  "verdict.NO_VALID_ANALYTE_PAIR.word": "PARA NIEPRAWIDŁOWA",
  "verdict.NO_VALID_ANALYTE_PAIR.next":
    "Kandydaci istnieją, ale żadna para nie spełnia warunku E4 > E3.",
  "verdict.MEASUREMENT_QUALITY_FAIL.word": "POMIAR NIE NADAJE SIĘ DO OCENY",
  "verdict.MEASUREMENT_QUALITY_FAIL.NO_TPRA_IN_WINDOWS":
    "Brak sygnału wzorca TPrA w oknie. Dodaj wzorzec i powtórz pomiar.",
  "verdict.MEASUREMENT_QUALITY_FAIL.NO_CANDIDATES": "Brak pików na gałęziach.",
  "verdict.MEASUREMENT_QUALITY_FAIL.NO_VALID_TPRA_PAIR":
    "Piki w oknie wzorca nie tworzą poprawnej pary.",
  "verdict.MEASUREMENT_QUALITY_FAIL.fallback": "Powtórz pomiar w laboratorium.",
  "verdict.too_few_points.word": "PLIK NIEPEŁNY",
  "verdict.too_few_points.next":
    "Plik ma za mało punktów (artefakt zapisu). Sprawdź eksport z potencjostatu.",
  "verdict.invalid.word": "NIE ROZPOZNANO PLIKU",
  "verdict.invalid.next": "Nie rozpoznano kolumn E/I. Plik nie został zmieniony.",

  "verdict.justification": "ΔE_s = {value} V, {mv} mV od wzorca {target} V",
  "verdict.noDelta": "Brak ΔE_s dla tego wyniku.",
  "verdict.auto": "Automatycznie",
  "verdict.expertWho": "Ekspert ({operator}, {time})",
  "verdict.expertNoName": "Ekspert ({time})",

  "scale.aria":
    "Odchyłka od wzorca {dev}. Zakres zgodny do {ok} mV, zakres do oceny do {warn} mV, skala od {min} do +{max} mV.",
  "scale.ok": "zakres zgodny ±{mv} mV",
  "scale.warn": "zakres do oceny ±{mv} mV",
  "scale.out": "poza zakresem",

  "chart.axisCal": "E / V (po kalibracji TPrA)",
  "chart.axisRaw": "E / V (surowe)",
  "chart.axisI": "I / µA",
  "chart.toggleCal": "E po kalibracji",
  "chart.toggleRaw": "E surowe",
  "chart.axisGroup": "Oś potencjału",
  "chart.legend.fwd": "Skan w przód",
  "chart.legend.bwd": "Skan wstecz",
  "chart.legend.p1": "1: TPrA−",
  "chart.legend.p2": "2: TPrA+",
  "chart.legend.p3": "3: Analit−",
  "chart.legend.p4": "4: Analit+",
  "chart.legend.e5": "E5 (TPrA)",
  "chart.legend.e6": "E6 (analit)",
  "chart.legend.baseline": "Baseline analitu (fit)",
  "chart.delta": "ΔE_s = {value} V",
  "chart.aria": "Wykres woltamperometrii cyklicznej dla {name}, werdykt {verdict}.",

  "details.summary": "Szczegóły",
  "details.ipTpraFwd": "Ip wzorca TPrA (fwd)",
  "details.ipTpraBwd": "Ip wzorca TPrA (bwd)",
  "details.ipAnalyteFwd": "Ip analitu (fwd)",
  "details.ipAnalyteBwd": "Ip analitu (bwd)",
  "details.ipWithMethod": "{value} µA, metoda: {method}",
  "details.method.curve": "krzywa",
  "details.method.peak_max": "maksimum nad linią bazową",
  "details.method.tangent_intersection": "przecięcie stycznych",
  "details.method.peak_max_fallback": "maksimum nad linią bazową, styczne nie wyszły",
  "details.method.tangents": "styczne",
  "details.concentration": "Stężenie",
  "details.concentrationValue": "{value} µM (kalibracja {calibration})",
  "details.purity": "Czystość",
  "details.lodLoq": "LOD / LOQ",
  "details.shift": "Shift",
  "details.cycles": "Cykle",
  "details.cyclesValue": "{total} (użyty: {used})",
  "details.fileSha": "SHA-256 pliku",
  "details.algo": "Algorytm",
  "details.algoSha": "SHA algorytmu",
  "details.analysedAt": "Czas analizy",
  "details.mode": "Tryb",
  "details.statusCode": "Kod statusu",
  "mode.auto": "auto",
  "mode.manual": "ręczny",

  "table.sample": "Próbka",
  "table.file": "Plik",
  "table.quality": "Jakość",
  "table.verdict": "Werdykt",
  "table.delta": "ΔE_s",
  "table.err": "Odchyłka mV",
  "table.ip": "Ip analitu",
  "table.version": "Wersja",
  "table.mode": "Tryb",
  "table.warn": "Ostrzeżenia",
  "table.qualityOk": "OK",
  "table.aggregation":
    "Próbka = WYKRYTO, gdy co najmniej jeden plik WYKRYTO; inaczej DO OCENY, gdy co najmniej jeden DO OCENY; inaczej NIE STWIERDZONO, gdy co najmniej jeden pomiar był ważny; inaczej POMIARY NIE NADAJĄ SIĘ DO OCENY.",

  "expert.hint":
    "Przeciągnij punkty 1-4 na wykresie. 1 i 3 na powrocie, 2 i 4 na gałęzi forward. Algorytm przyciąga do najbliższego punktu gałęzi.",
  "expert.reason": "Powód korekty",
  "expert.save": "Zapisz korektę",
  "expert.report": "Zgłoś rozbieżność",
  "expert.needReason": "Podaj powód korekty, żeby zapisać.",
  "expert.needReasonReport": "Podaj powód, żeby zgłosić rozbieżność.",
  "expert.needPoints": "Najpierw przesuń punkty na wykresie.",
  "expert.error": "Błąd korekty: {message}",

  "print.title": "ITIES Detect, raport sesji",
  "print.meta": "{datetime} · operator: {operator}",
  "print.noOperator": "nie podano",
  "print.algo": "Algorytm v{version} · SHA-256 {sha}",
  "print.thresholds": "Progi:",
  "print.fileSha": "SHA-256 pliku: {sha}",
  "print.points.pt": "Pkt",
  "print.points.eRaw": "E surowe / V",
  "print.points.eCal": "E po kalibracji / V",
  "print.points.i": "I / µA",
  "print.auto": "Automatycznie",
  "print.expert": "Ekspert",
  "print.chartAlt": "Wykres CV {name}",
  "print.disclaimer":
    "NIE STWIERDZONO oznacza brak sygnału spełniającego kryterium w tym pomiarze, nie dowód nieobecności substancji. Czułość metody na danych laboratorium (16.09.2026): 121 z 293 plików pozytywnych; fałszywe wykrycia: 0 z 192 prób ślepych.",

  "versions.pageTitle": "Historia wersji · ITIES Detect",
  "versions.h1": "Historia wersji",
  "versions.algo": "Algorytm",
  "versions.note":
    "Wersja i SHA-256 pochodzą z algo/versions.json. Liczby zmierzone 16.09.2026: 121 z 293 plików pozytywnych, 0 fałszywych wykryć na 192 próbach ślepych.",
  "versions.diff":
    "1.1 = 1.0 + diagnostyka (LOD/LOQ z aktywnej kalibracji, ostrzeżenie below_lod, diagnostyka wyboru pary); identyczne werdykty, ΔE_s i Ip na 485 plikach testowych.",
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

  "algo.changelog.1_1.lod": "LOD/LOQ z aktywnej kalibracji plus ostrzeżenie below_lod",
  "algo.changelog.1_1.pair": "diagnostyka wyboru pary (n_par_sanity, second_best_error_mV)",
  "algo.changelog.1_0.notebook":
    "stan notebooka z 20.08.2026: Ip dwiema procedurami (maksimum nad linią bazową, przecięcie stycznych)",

  "app.changelog.1_0_0": "2026-09-16: pierwsza wersja web, silnik Pyodide, parytet z notebookiem.",
  "app.changelog.1_1_0":
    "2026-09-16: interfejs EN i PL, przełącznik motywu w pasku narzędzi, wgrywanie folderów, analiza startuje sama po wgraniu, wykres w stylu Colab.",
  "app.name": "ITIES Detect",
  "app.tagline": "Analiza pomiarów elektrochemicznych ITIES",
  "app.skipToContent": "Przejdź do wyniku",

  "toolbar.import": "Importuj pomiary",
  "toolbar.analyseSeries": "Analizuj serię",
  "toolbar.algorithm": "Algorytm {version}",
  "toolbar.algorithmDefault": "Algorytm {version} (domyślny)",

  "sidebar.searchLabel": "Szukaj próbek",
  "sidebar.searchPlaceholder": "Szukaj próbek",
  "sidebar.noMatch": "Żadna próbka nie pasuje do tego szukania.",
  "sidebar.dropTitle": "Przeciągnij pliki pomiarowe",
  "sidebar.dropHint": "albo użyj przycisków poniżej",
  "sidebar.dropFormats": "TXT z NOVA, średnik lub tabulator",
  "sidebar.tree": "Próbki i pliki",
  "sidebar.loose": "Pojedyncze pliki",

  "breadcrumb.label": "Położenie tego pliku",

  "head.points": ({ n }) => `${n} ${plPlural(n, "punkt", "punkty", "punktów")}`,
  "head.pointsUsed": "{used} z {total} punktów",
  "head.cycle": "cykl {used} z {total}",
  "head.sample": "próbka {id}",
  "head.noAnalysis": "jeszcze nie przeliczony",

  "kpi.delta": "ΔE_s",
  "kpi.reference": "Wzorzec",
  "kpi.deviation": "Różnica",
  "kpi.status": "Status",
  "kpi.tolerance": "Tolerancja (mV)",

  "chart.title": "Woltamperogram cykliczny",
  "chart.subtitleAuto": "Interfejs ciecz-ciecz · analiza automatyczna",
  "chart.subtitleExpert": "Interfejs ciecz-ciecz · korekta eksperta",
  "chart.zoomIn": "Przybliż",
  "chart.zoomOut": "Oddal",
  "chart.reset": "Reset widoku",
  "chart.fullscreen": "Pełny ekran",
  "chart.markers": "Pokaż znaczniki",
  "chart.controls": "Sterowanie wykresem",

  "peaks.title": "Piki",
  "peaks.col.n": "#",
  "peaks.col.e": "E (V)",
  "peaks.col.i": "I (µA)",
  "peaks.col.type": "Typ",
  "peaks.type.1": "wzorzec−",
  "peaks.type.2": "wzorzec+",
  "peaks.type.3": "analit−",
  "peaks.type.4": "analit+",
  "peaks.empty": "Algorytm nie wskazał pików w tym pomiarze.",
  "peaks.redetect": "Wykryj ponownie",
  "peaks.edit": "Edytuj piki",
  "peaks.editOff": "Zakończ edycję",

  "analysis.title": "Analiza ITIES",
  "analysis.window": "Okno potencjałowe",
  "analysis.reference": "Wzorzec",
  "analysis.delta": "ΔE_s",
  "analysis.deviation": "Różnica",

  "section.params": "Parametry pomiaru",
  "section.history": "Historia analizy",
  "section.metadata": "Metadane pliku",

  "params.thresholds": "Progi tej wersji algorytmu",
  "params.tpraTarget": "Okno wzorca TPrA",
  "params.amphTarget": "Kryterium ΔE_s dla amfetaminy",
  "params.tolerance": "Tolerancja wykrycia / do oceny",
  "params.prominence": "Prominencja piku",
  "params.weak": "Kandydaci słabych pików",
  "params.calibration": "Aktywna kalibracja",
  "params.points": "Punkty",
  "params.cycles": "Cykle",

  "history.auto": "Analiza automatyczna",
  "history.expert": "Korekta eksperta",
  "history.none": "Tylko bieżąca analiza. Brak wcześniejszej rewizji w tej sesji.",
  "history.current": "bieżąca",

  "meta.fileName": "Nazwa pliku",
  "meta.folder": "Folder",
  "meta.size": "Rozmiar",
  "meta.modified": "Data pliku",

  "statusbar.done": "Analiza zakończona",
  "statusbar.time": "czas {seconds} s",
  "statusbar.pending": "Czeka na analizę",
  "statusbar.running": "Analiza w toku",
  "statusbar.idle": "Nie wybrano pliku",

  "common.yes": "tak",
  "common.no": "nie",

  "app.changelog.1_2_0":
    "2026-09-16: przebudowany ekran wyniku: nagłówek pliku z metadanymi, cztery karty KPI, duży opisany wykres z zoomem i pełnym ekranem, panel pików, drzewo folderów i próbek z kropkami statusu, zwijane parametry, historia i metadane. PeakWise 1.0 dodany do huba.",
};

const DICT = { en: EN, pl: PL };

function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch (_) {
    /* private mode */
  }
  return DEFAULT_LANG;
}

let current = readLang();
const listeners = new Set();

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {
    /* private mode */
  }
  document.documentElement.lang = lang;
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function locale() {
  return current === "pl" ? "pl-PL" : "en-GB";
}

export function t(key, params) {
  const entry = DICT[current][key] ?? DICT[DEFAULT_LANG][key];
  if (entry == null) return key;
  if (typeof entry === "function") return entry(params || {});
  if (!params) return entry;
  return entry.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name])
  );
}

// Fills every [data-i18n] node in the tree. data-i18n sets textContent,
// data-i18n-aria sets aria-label, data-i18n-title sets the tooltip.
export function applyStatic(root = document) {
  document.documentElement.lang = current;
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-aria]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  }
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  }
  const title = root.querySelector("title[data-i18n-doc]");
  if (title) document.title = t(title.dataset.i18nDoc);
}
