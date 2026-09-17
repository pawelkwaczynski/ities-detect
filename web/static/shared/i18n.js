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
  "common.close": "Close",
  "common.info": "More information",
  "common.logout": "Log out",

  "login.pageTitle": "Sign in, CV Analysers",
  "login.title": "Sign in to CV Analysers",
  "login.username": "Login",
  "login.password": "Password",
  "login.submit": "Enter",
  "login.invalid": "Wrong login or password",
  "login.rateLimited": "Too many attempts. Try again in 60 seconds.",
  "login.by": "Built by",

  "hub.pageTitle": "CV Analysers",
  "hub.title": "CV Analysers",
  "hub.lead": "Laboratory tools for cyclic voltammetry analysis.",
  "hub.ities.desc": "Amphetamine detection from CV curves (ITIES).",
  "hub.peakwise.desc": "Anodic and cathodic peaks of 3D printed electrodes.",
  "hub.soon": "soon",
  "hub.openApp": "Open {app}",

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
  "toolbar.operator": "Operator",
  "toolbar.list": "List",
  "sidebar.shownOf": "{shown} of {total}",
  "toolbar.count": ({ n }) => (n === 1 ? "1 file loaded" : `${n} files loaded`),
  "toolbar.skipped": ({ n, exts }) => `skipped ${n} (${exts})`,
  "toolbar.files": ({ n }) => (n === 1 ? "1 file" : `${n} files`),
  "toolbar.duplicates": ({ n }) => `${n} duplicate${n === 1 ? "" : "s"} skipped`,
  "toolbar.otherFormats": ({ n }) => `${n} file${n === 1 ? "" : "s"} in another format`,
  "toolbar.unsupported": ({ n, details }) => `${n} skipped: ${details}`,

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
  "empty.pickFile": "Pick a file from the list.",
  "empty.noChart": "No chart yet. Run the analysis.",

  "files.noxSkipped": "{name}: .nox file is not supported, export it to TXT.",

  "session.clear": "Clear session",
  "session.clearTitle": "Clear session?",
  "session.clearMessage": "Remove all {n} files from this session? Results are not stored anywhere outside this browser.",
  "session.clearAccept": "Remove all",
  "session.keep": "Keep",
  "session.removeFile": "Remove from session",
  "session.removeSample": "Remove sample",
  "session.removeFolder": "Remove folder",
  "session.removeGroupTitle": "Remove files?",
  "session.removeGroupMessage": "Remove {n} files from {name}?",
  "session.removeGroupAccept": "Remove files",
  "session.removed": "Removed {name} ·",
  "session.removedMany": "Removed {n} files from {name} ·",
  "session.undo": "Undo",

  "folder.new": "New folder",
  "folder.name": "Folder name",
  "folder.exists": "A folder with this name already exists.",
  "folder.rename": "Rename folder",
  "folder.delete": "Delete folder",
  "folder.deleteTitle": "Delete folder?",
  "folder.deleteMessage": "Delete the folder {name}? Its {n} files will return outside folders and will not be deleted.",
  "folder.deleteAccept": "Delete folder",
  "folder.move": "Move to…",
  "folder.moveTitle": "Move {name}",
  "folder.outside": "Outside folders",
  "folder.stats": ({ n, size, detected, percent }) =>
    `${n} ${n === 1 ? "file" : "files"} · ${size} · ${detected} DETECTED (${percent} %)`,
  "folder.statsQueued": ({ n, size }) =>
    `${n} ${n === 1 ? "file" : "files"} · ${size} · queued`,
  "folder.printOutside": "Outside folders",

  "tip.expert": "Unlocks manual result correction: dragging points 1 to 4 on the chart, entering a potential in the Peaks panel, the Add analyte pair and Point to standard manually buttons, and the Analysis parameters section. Saving a correction requires a reason, and the automatic result remains beside the expert result.",
  "tip.redetect": "This file only. Moves the expert correction to the analysis history and computes the file again automatically. Use it when you want to return to the program result.",
  "tip.recompute": "The whole list. Computes every file again and shows the progress window. Use it after an algorithm version or analysis parameter change. A normal import starts analysis automatically.",
  "tip.addAnalyte": "Point to the analyte minimum on the reverse scan, point 3, then the maximum on the forward scan, point 4. The program snaps to the nearest point on the branch and calculates ΔE_s from your indications.",
  "tip.addStandard": "Point to the standard minimum on the reverse scan, point 1, the standard maximum on the forward scan, point 2, then the analyte points 3 and 4. The program snaps every indication to the nearest point on its branch.",
  "tip.analysisParams": "The default values were validated on 16.09.2026. Every change applies only in this session and marks the results as outside validation.",
  "tip.clearSession": "Removes all files, results and folders from this browser session after confirmation.",
  "tip.export": "Exports the analysed session to CSV or prepares a grouped PDF report for printing.",
  "tip.import": "Imports NOVA TXT measurements. Analysis starts automatically when the engine is ready.",
  "tip.addFolder": "Imports all supported NOVA TXT measurements from a folder on this computer.",
  "tip.newFolder": "Creates an empty session folder for organising measurements. It does not create a folder on disk.",
  "tip.sidebarFilter": "Limits the list to files in the selected verdict group. It does not remove or recompute files.",
  "tip.verdict.detected": "DETECTED: a signal met the amphetamine criterion and the measurement passed quality control.",
  "tip.verdict.uncertain": "EXPERT REVIEW: the signal is in the band that requires an expert check of the chart or a repeated measurement.",
  "tip.verdict.notDetected": "NOT DETECTED IN THIS MEASUREMENT: no signal met the criterion. This is not proof that the substance is absent.",
  "tip.verdict.unsuitable": "MEASUREMENT NOT ASSESSABLE: the measurement or file did not provide a result that can be interpreted with this method.",
  "tip.operator": "The name entered here is included in saved expert corrections and in the PDF report.",
  "tip.skipped": "Files in formats other than NOVA TXT are not loaded. Export them to TXT.",

  "progress.title": "Series analysis",
  "progress.done": "Done",
  "progress.files": ({ n }) => (n === 1 ? "1 file" : `${n} files`),
  "progress.allFiles": ({ n }) => (n === 1 ? "Recomputing 1 file" : `Recomputing ${n} files`),
  "progress.value": "{done} of {total}",
  "progress.noNewFiles": "No new files to analyse",
  "progress.unsuitable": "NOT ASSESSABLE",
  "progress.error": "ERROR",
  "progress.unsuitableShort": "not assessable",
  "progress.errorShort": "errors",
  "progress.skipped": "skipped: {duplicates} duplicates, {formats} files in another format ({exts})",
  "progress.engine": "Engine: {status}",
  "progress.parametersChanged": "Analysis with custom parameters",
  "progress.parametersReset": "Analysis with default parameters",
  "progress.algorithmChanged": "Algorithm {version}",
  "progress.startingEngine": "Starting analysis engine",
  "progress.stagePyodide": "Downloading Pyodide",
  "progress.stagePackages": "Packages numpy, scipy, pandas",
  "progress.stageAlgorithm": "Algorithm {version}",
  "progress.approximate": "approximate",
  "progress.percent": "{percent} %",
  "progress.engineReady": "Engine ready",

  "sidebar.label": "File list",
  "sidebar.filters": "Filters",
  "sidebar.filtersSection": "Filters",
  "sidebar.filesSection": "Files",
  "sidebar.all": "All",
  "sidebar.detected": "Detected",
  "sidebar.review": "For review",
  "sidebar.notDetected": "Not detected",
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
  "verdict.detected.short": "detected",
  "verdict.detected.next":
    "Signal consistent with the amphetamine criterion. The measurement passed quality control.",
  "verdict.uncertain.word": "EXPERT REVIEW",
  "verdict.uncertain.short": "for review",
  "verdict.uncertain.next":
    "The signal sits in the band that needs an expert eye. Check the chart or repeat the measurement.",
  "verdict.not_detected.word": "NOT DETECTED IN THIS MEASUREMENT",
  "verdict.not_detected.short": "not detected",
  "verdict.not_detected.next":
    "No signal met the criterion. This is not proof that the substance is absent.",
  "verdict.TPrA_ONLY.word": "STANDARD ONLY, NO ANALYTE",
  "verdict.TPrA_ONLY.next": "The TPrA standard was found, no reliable analyte pair.",
  "verdict.NO_VALID_ANALYTE_PAIR.word": "INVALID PAIR",
  "verdict.NO_VALID_ANALYTE_PAIR.next":
    "Candidates exist, but no pair satisfies the E4 > E3 condition.",
  "verdict.MEASUREMENT_QUALITY_FAIL.word": "MEASUREMENT NOT ASSESSABLE",
  "verdict.MEASUREMENT_QUALITY_FAIL.short": "faulty file",
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
  "table.params": "Parameters",
  "table.warn": "Warnings",
  "table.qualityOk": "OK",
  "table.aggregation":
    "A sample is DETECTED when at least one file is DETECTED; otherwise EXPERT REVIEW when at least one file needs review; otherwise NOT DETECTED when at least one measurement was valid; otherwise the measurements are NOT ASSESSABLE.",

  "expert.hint":
    "Drag points 1 to 4 on the chart, or type the potential in the Peaks panel (arrow keys step by 1 mV). Points 1 and 3 sit on the reverse branch, 2 and 4 on the forward branch. The algorithm snaps to the nearest point of the branch. A missing point is added with the button in the Peaks panel, by pointing at the curve.",
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
    "NOT DETECTED means that no signal met the criterion in this measurement, not proof that the substance is absent. Measured on the laboratory data on 16.09.2026: 121 of 293 positive files detected; 0 of 147 negative files and 0 of 45 neutral files falsely detected.",

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
  "app.tagline": "Amphetamine detection from CV",
  "app.taglineFull": "Analysis of cyclic voltammetry measurements at the liquid-liquid interface (ITIES).",
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
  "peaks.col.meaning": "Meaning",
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
  "peaks.meaning.1": "TPrA minimum (standard−)",
  "peaks.meaning.2": "TPrA maximum (standard+)",
  "peaks.meaning.3": "analyte minimum",
  "peaks.meaning.4": "analyte maximum",
  "peaks.meaning.5": "TPrA, pair midpoint",
  "peaks.meaning.6": "analyte, pair midpoint",
  "peaks.addAnalyte": "Add analyte pair",
  "peaks.addStandard": "Set standard manually",

  "analysis.window": "Potential window",

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
  "params.detectionMethod": "Detection method",
  "params.default": "default",
  "params.custom": "custom parameters",
  "params.outsideValidation": "Custom parameters, outside the validation of 16.09.2026.",

  "analysisParams.title": "Analysis parameters",
  "analysisParams.defaultState": "Defaults (validated 16.09.2026)",
  "analysisParams.customState": "Custom for this session (outside validation)",
  "analysisParams.detected": "DETECTED tolerance",
  "analysisParams.review": "EXPERT REVIEW tolerance",
  "analysisParams.target": "Amphetamine reference ΔE_s",
  "analysisParams.forward": "TPrA+ forward window",
  "analysisParams.reverse": "TPrA− reverse window",
  "analysisParams.from": "from",
  "analysisParams.to": "to",
  "analysisParams.apply": "Apply and recompute",
  "analysisParams.reset": "Restore defaults",
  "analysisParams.errorNumbers": "Enter a number in every field.",
  "analysisParams.errorWindows": "The start of each window must be lower than its end.",

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

  "verdict.nextReview": "Next for review",

  "scale.custom": "custom thresholds",

  "peaks.eInput": "Potential E of point {n}, volts",
  "peaks.pick.3": "Click the analyte minimum on the reverse scan (point 3).",
  "peaks.pick.4": "Click the analyte maximum on the forward scan (point 4).",
  "peaks.pick.1": "Click the TPrA minimum on the reverse scan (point 1).",
  "peaks.pick.2": "Click the TPrA maximum on the forward scan (point 2).",
  "peaks.pickEscape": "Escape cancels.",
  "peaks.pickCancelled": "Point picking cancelled.",
  "peaks.pickDone": "Point {n} set at {value} V.",

  "expert.needPicked":
    "Point {n} does not come from the algorithm. Point at it on the chart or type its potential first.",

  "analysisParams.errorDetectedRange": "The DETECTED tolerance has to be between 1 and 30 mV.",
  "analysisParams.errorReviewRange":
    "The EXPERT REVIEW tolerance has to be at least the DETECTED tolerance and at most 30 mV.",
  "analysisParams.errorTargetRange": "The reference ΔE_s has to be between 0.300 and 0.400 V.",
  "analysisParams.errorWindowRange": "Window limits have to be between -1.0 and 1.0 V.",
  "analysisParams.errorWindowWidth": "A window has to be at least 0.05 V wide.",

  "params.bar":
    "Custom parameters: tolerance {detected}/{review} mV, ΔE_s {target} V. Results outside the validation of 16.09.2026.",
  "params.barLabel": "Custom analysis parameters",

  "progress.abort": "Stop",
  "progress.aborted": ({ n }) => (n === 1 ? "Stopped, 1 file left in the queue" : `Stopped, ${n} files left in the queue`),
  "progress.waitingEngine": "Waiting for the engine: packages numpy, scipy, pandas",

  "export.pdfScope": "PDF report scope",
  "export.scopeAll": ({ n }) => (n === 1 ? "All files (1)" : `All files (${n})`),
  "export.scopeFiltered": ({ n }) => (n === 1 ? "Visible after the filter (1)" : `Visible after the filter (${n})`),
  "export.scopeSample": ({ n }) => (n === 1 ? "Selected sample (1)" : `Selected sample (${n})`),
  "export.backgroundHint":
    "Turn on background graphics in the print dialog, otherwise the charts will be pale.",
  "export.bigTitle": "Large report",
  "export.bigMessage":
    "The report covers {n} files, about {pages} pages. Printing may take a while.",
  "export.bigAccept": "Print anyway",
  "export.empty": "No analysed file in this scope.",

  "print.footer": "ITIES Detect, application {app}, algorithm {algo} (SHA-256 {sha})",
  "print.modeAuto": "Mode: automatic",
  "print.modeManual": "Mode: manual · operator {operator} · {time} · reason: {reason}",
  "print.mixed": "{n} of {total} files were computed with custom parameters.",
  "print.scopeLine": "Report scope: {scope}",

  "partner.ul": "University of Lodz, Faculty of Chemistry, group of prof. Poltorak",
  "partner.ahe": "University of Humanities and Economics in Lodz, Paweł Kwaczyński",
  "partner.airon": "AIrON, Student Computer Science Society of the University of Humanities and Economics in Lodz",

  "tip.home": "CV Analysers: choose an application.",
  "tip.homeLabel": "CV Analysers",
  "tip.filterAll": "Every file in this session. Clicking the active filter comes back here.",
  "tip.logoZoom": "Click to enlarge",
  "tip.versionsLink": "Opens the versions page. Your files stay in the session.",
  "tip.belowThreshold": ({ value, threshold }) =>
    `The algorithm would not call this place a peak (prominence ${value} µA, threshold ${threshold} µA). The manual result stays an expert result.`,
  "common.backTo": "Back to {app}",
  "common.peakwise": "PeakWise",
  "sidebar.summary": "Verdict filters",
  "sidebar.selectSample": "Select every file of the sample",
  "multi.selected": ({ n }) => (n === 1 ? "1 file selected" : `${n} files selected`),
  "multi.clear": "Clear the selection",
  "multi.compare": "Compare on one chart",
  "multi.cards": "Show separate cards",
  "multi.compareAria": "Comparison of {n} voltammograms",
  "multi.expertOne": "Manual correction works on one file. Select one.",
  "multi.noResult": "Not analysed yet.",
  "export.scopeSelected": ({ n }) => `Selected files (${n})`,
  "export.csvSelected": ({ n }) => `CSV of the selected files (${n})`,
  "peaks.col.prom": "Prom. (µA)",
  "peaks.belowThreshold": "below peak threshold",
  "verdict.belowThresholdNote": ({ points }) =>
    `(point${points.includes(",") ? "s" : ""} ${points} below the peak threshold)`,
  "expert.belowThresholdTitle": "Save the expert correction?",
  "expert.belowThresholdSave": ({ points, threshold }) =>
    `Point ${points}: the prominence is below the peak threshold of ${threshold} µA, so the algorithm would not read a peak there. The correction is saved as an expert decision with your reason.`,
  "expert.belowThresholdAccept": "Save anyway",
  "result.belowThresholdSentence": ({ points, threshold }) =>
    `Expert result: point ${points} is below the peak threshold of ${threshold} µA.`,
  "tip.appSwitch": "Switches between ITIES Detect and PeakWise. Your files in this application stay where they are.",
  "tip.session": "Named sessions in this browser: rename the current one, start a new one, open a saved one, or write the whole session to a file and read it back.",
  "tip.sidebarDrop": "Drop NOVA TXT files or a folder here, or use the buttons. Keyboard: Cmd/Ctrl+O for files, Cmd/Ctrl+Shift+O for a folder.",

  "algo.info.label": "About this algorithm version",
  "algo.info.version": "Algorithm {version} ({date})",
  "algo.info.measured": "Measured on lab data {date}: positives detected {positives}, false detections {negatives} on blanks and {neutrals} on neutrals.",
  "algo.info.sha": "File SHA-256 {sha}",

  "session.menu": "Session",
  "session.currentLabel": "Current session",
  "session.nameLabel": "Session name",
  "session.savedLabel": "Saved sessions",
  "session.new": "New session",
  "session.saveFile": "Save session to a file",
  "session.loadFile": "Load session from a file",
  "session.open": "Open",
  "session.current": "Current session",
  "session.rename": "Rename",
  "session.delete": "Delete",
  "session.deleteTitle": "Delete session",
  "session.deleteMessage": ({ name, n }) =>
    `Session ${name} holds ${n} ${n === 1 ? "file" : "files"}. Deleting it removes them from this browser.`,
  "session.deleteAccept": "Delete session",
  "session.rowStats": ({ n, size, when }) => `${n} ${n === 1 ? "file" : "files"} · ${size} · ${when}`,
  "session.savedAt": "Saved {time}",
  "session.fileWritten": "Session file written, {size}.",
  "session.bigTitle": "Large session file",
  "session.bigMessage": "The file will be about {size}. Saving may take a while.",
  "session.bigAccept": "Save anyway",
  "session.fileRefusedTitle": "Session file refused",
  "session.fileBadFormat": "This is not an ITIES session file (format read: {found}).",
  "session.fileBadSha": ({ n, names }) =>
    `${n} ${n === 1 ? "file does" : "files do"} not match the SHA-256 written next to ${n === 1 ? "it" : "them"}: ${names}. Nothing was loaded.`,
  "session.loadTitle": "Load session",
  "session.loadMessage": ({ name, n }) =>
    `${name}: ${n} ${n === 1 ? "file" : "files"} with results. Replace the current session or add it as a new one?`,
  "session.loadReplace": "Replace the current session",
  "session.loadAsNew": "Add as a new session",

  "hub.files": ({ n }) => `${n} ${n === 1 ? "file" : "files"} in the session`,
  "hub.noFiles": "no files",

  "print.session": "Session: {name}",

  "app.changelog.1_2_0":
    "2026-09-16: result screen rebuilt: file header with metadata, four KPI cards, a large annotated chart with zoom and full screen, a peaks panel, a folder and sample tree with status dots, and collapsible parameters, history and metadata. PeakWise 1.0 added to the hub.",
  "app.changelog.1_4_0":
    "2026-09-17: accessible explanations were added to expert and session controls. Session folders can be created, renamed, removed without deleting files, and used through drag and drop or the move menu, with persisted statistics and grouped exports. Engine startup and batch work now use one centred progress window with staged or exact percentages. The hub, ITIES Detect and PeakWise now share server-side sign-in with throttling and a 12-hour session. Partner logos sit in the footer, in grey until the pointer reaches them. Measurements are added in one place, the sidebar zone, with Cmd/Ctrl+O and Cmd/Ctrl+Shift+O. The algorithm picker explains the chosen version from the manifest. The server refuses indexing through robots.txt, a header and a meta tag. A home icon and an application switcher lead between the hub, ITIES Detect and PeakWise. Sessions are named, several can live side by side, and a whole session can be written to a JSON file with SHA-256 checksums and read back without recomputing. Addendum of 17.09: the toolbar keeps seven controls for work on the data, the file and verdict counters became the filter summary at the top of the list, language, theme, operator and the partner logos moved to the footer, clearing a session lives in the Session menu, the chart shows each point number once, a manual point below the peak threshold is named in the panel, the verdict, the table and the report, Next for review moves the highlight in the list, and several files can be selected with Cmd or Shift to read them as cards or as one comparison chart.",
  "app.changelog.1_3_0":
    "2026-09-17: the session can be cleared and files, samples or folders removed with an undo bar, and a file whose content is already loaded is skipped as a duplicate. Every import and recomputation opens a progress window with live verdict counters, a stop button and status filters that stay in the toolbar. The result screen shows the verdict once, on a verdict card with the tolerance scale and its legend, and the peaks panel always lists points 1 to 4 plus E5 and E6. A missing analyte pair or standard is added by pointing at the curve or by typing the potential, never seeded by the program. Analysis parameters can be changed for the session under expert mode, within hard limits, and every result computed that way is marked as outside the validation of 16.09.2026 in the interface, the CSV and the report.",
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
  "common.close": "Zamknij",
  "common.info": "Więcej informacji",
  "common.logout": "Wyloguj",

  "login.pageTitle": "Logowanie, Analizatory CV",
  "login.title": "Zaloguj się do Analizatorów CV",
  "login.username": "Login",
  "login.password": "Hasło",
  "login.submit": "Wejdź",
  "login.invalid": "Zły login albo hasło",
  "login.rateLimited": "Za dużo prób. Spróbuj ponownie za 60 sekund.",
  "login.by": "Wykonanie",

  "hub.pageTitle": "Analizatory CV",
  "hub.title": "Analizatory CV",
  "hub.lead": "Narzędzia laboratorium do analizy woltamperometrii cyklicznej.",
  "hub.ities.desc": "Detekcja amfetaminy z krzywych CV (ITIES).",
  "hub.peakwise.desc": "Piki anodowe i katodowe elektrod drukowanych 3D.",
  "hub.soon": "wkrótce",
  "hub.openApp": "Otwórz {app}",

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
  "toolbar.operator": "Operator",
  "toolbar.list": "Lista",
  "sidebar.shownOf": "{shown} z {total}",
  "toolbar.count": ({ n }) => `Wgrano ${n} ${plPlural(n, "plik", "pliki", "plików")}`,
  "toolbar.skipped": ({ n, exts }) => `pominięto ${n} (${exts})`,
  "toolbar.files": ({ n }) => `${n} ${plPlural(n, "plik", "pliki", "plików")}`,
  "toolbar.duplicates": ({ n }) => `${n} ${plPlural(n, "duplikat pominięty", "duplikaty pominięte", "duplikatów pominiętych")}`,
  "toolbar.otherFormats": ({ n }) => `${n} ${plPlural(n, "plik", "pliki", "plików")} w innym formacie`,
  "toolbar.unsupported": ({ n, details }) => `${n} pominięto: ${details}`,

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
  "empty.pickFile": "Wybierz plik z listy.",
  "empty.noChart": "Brak wykresu. Uruchom analizę.",

  "files.noxSkipped": "{name}: plik .nox nieobsługiwany, wyeksportuj do TXT.",

  "session.clear": "Wyczyść sesję",
  "session.clearTitle": "Wyczyścić sesję?",
  "session.clearMessage": "Usunąć wszystkie {n} plików z tej sesji? Wyniki nie są nigdzie zapisane poza tą przeglądarką.",
  "session.clearAccept": "Usuń wszystko",
  "session.keep": "Zostaw",
  "session.removeFile": "Usuń z sesji",
  "session.removeSample": "Usuń próbkę",
  "session.removeFolder": "Usuń folder",
  "session.removeGroupTitle": "Usunąć pliki?",
  "session.removeGroupMessage": "Usunąć {n} plików z {name}?",
  "session.removeGroupAccept": "Usuń pliki",
  "session.removed": "Usunięto {name} ·",
  "session.removedMany": "Usunięto {n} plików z {name} ·",
  "session.undo": "Cofnij",

  "folder.new": "Nowy folder",
  "folder.name": "Nazwa folderu",
  "folder.exists": "Folder o tej nazwie już istnieje.",
  "folder.rename": "Zmień nazwę folderu",
  "folder.delete": "Usuń folder",
  "folder.deleteTitle": "Usunąć folder?",
  "folder.deleteMessage": "Usunąć folder {name}? Jego {n} plików wróci poza folder i nie zostanie usuniętych.",
  "folder.deleteAccept": "Usuń folder",
  "folder.move": "Przenieś do…",
  "folder.moveTitle": "Przenieś {name}",
  "folder.outside": "Poza folder",
  "folder.stats": ({ n, size, detected, percent }) =>
    `${n} ${plPlural(n, "plik", "pliki", "plików")} · ${size} · ${detected} WYKRYTO (${percent} %)`,
  "folder.statsQueued": ({ n, size }) =>
    `${n} ${plPlural(n, "plik", "pliki", "plików")} · ${size} · w kolejce`,
  "folder.printOutside": "Poza folderem",

  "tip.expert": "Odblokowuje ręczną korektę wyniku: przeciąganie punktów 1 do 4 na wykresie, wpisywanie potencjału w panelu Piki, przyciski Dodaj parę analitu i Wskaż wzorzec ręcznie, sekcja Parametry analizy. Zapis korekty wymaga powodu, a wynik automatyczny zostaje obok wyniku eksperta.",
  "tip.redetect": "Tylko ten plik. Odkłada korektę eksperta do historii analizy i liczy plik od nowa automatycznie. Użyj, gdy chcesz wrócić do wyniku programu.",
  "tip.recompute": "Cała lista. Liczy wszystkie pliki od nowa i pokazuje okno postępu. Potrzebne po zmianie wersji algorytmu albo parametrów analizy; po zwykłym wgraniu plików analiza rusza sama.",
  "tip.addAnalyte": "Wskaż na wykresie minimum analitu na skanie wstecz, punkt 3, potem maksimum na skanie w przód, punkt 4. Program przyciąga do najbliższego punktu gałęzi i liczy ΔE_s z Twoich wskazań.",
  "tip.addStandard": "Wskaż na wykresie minimum wzorca na skanie wstecz, punkt 1, maksimum wzorca na skanie w przód, punkt 2, a potem punkty analitu 3 i 4. Program przyciąga każde wskazanie do najbliższego punktu właściwej gałęzi.",
  "tip.analysisParams": "Wartości domyślne są zwalidowane 16.09.2026. Każda zmiana działa tylko w tej sesji i oznacza wyniki jako poza walidacją.",
  "tip.clearSession": "Po potwierdzeniu usuwa wszystkie pliki, wyniki i foldery z tej sesji przeglądarki.",
  "tip.export": "Eksportuje przeanalizowaną sesję do CSV albo przygotowuje grupowany raport PDF do druku.",
  "tip.import": "Importuje pomiary TXT z NOVA. Analiza rusza automatycznie, gdy silnik jest gotowy.",
  "tip.addFolder": "Importuje z folderu na tym komputerze wszystkie obsługiwane pomiary TXT z NOVA.",
  "tip.newFolder": "Tworzy pusty folder w sesji do porządkowania pomiarów. Nie tworzy folderu na dysku.",
  "tip.sidebarFilter": "Ogranicza listę do plików z wybranej grupy werdyktów. Nie usuwa ani nie przelicza plików.",
  "tip.verdict.detected": "WYKRYTO: sygnał spełnił kryterium amfetaminy, a pomiar przeszedł kontrolę jakości.",
  "tip.verdict.uncertain": "DO OCENY EKSPERTA: sygnał jest w paśmie, które wymaga sprawdzenia wykresu przez eksperta albo powtórzenia pomiaru.",
  "tip.verdict.notDetected": "NIE STWIERDZONO W TYM POMIARZE: nie znaleziono sygnału spełniającego kryterium; to nie jest dowód nieobecności substancji.",
  "tip.verdict.unsuitable": "POMIAR NIE NADAJE SIĘ DO OCENY: pomiar albo plik nie dał wyniku, który można zinterpretować tą metodą.",
  "tip.operator": "Imię wpisane tu trafia do zapisu korekt eksperta i do raportu PDF.",
  "tip.skipped": "Pliki w innych formatach niż TXT z NOVA nie są wczytywane. Wyeksportuj je do TXT.",

  "progress.title": "Analiza serii",
  "progress.done": "Gotowe",
  "progress.files": ({ n }) => `${n} ${plPlural(n, "plik", "pliki", "plików")}`,
  "progress.allFiles": ({ n }) => `Przeliczanie ${n} ${plPlural(n, "pliku", "plików", "plików")}`,
  "progress.value": "{done} z {total}",
  "progress.noNewFiles": "Brak nowych plików do analizy",
  "progress.unsuitable": "NIE NADAJE SIĘ DO OCENY",
  "progress.error": "BŁĄD",
  "progress.unsuitableShort": "nie do oceny",
  "progress.errorShort": "błędy",
  "progress.skipped": "pominięto: {duplicates} duplikatów, {formats} plików w innym formacie ({exts})",
  "progress.engine": "Silnik: {status}",
  "progress.parametersChanged": "Analiza z parametrami własnymi",
  "progress.parametersReset": "Analiza z parametrami domyślnymi",
  "progress.algorithmChanged": "Algorytm {version}",
  "progress.startingEngine": "Uruchamianie silnika analizy",
  "progress.stagePyodide": "Pobieranie Pyodide",
  "progress.stagePackages": "Pakiety numpy, scipy, pandas",
  "progress.stageAlgorithm": "Algorytm {version}",
  "progress.approximate": "przybliżony",
  "progress.percent": "{percent} %",
  "progress.engineReady": "Silnik gotowy",

  "sidebar.label": "Lista plików",
  "sidebar.filters": "Filtry",
  "sidebar.filtersSection": "Filtry",
  "sidebar.filesSection": "Pliki",
  "sidebar.all": "Wszystkie",
  "sidebar.detected": "Wykryto",
  "sidebar.review": "Do oceny",
  "sidebar.notDetected": "Nie stwierdzono",
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
  "verdict.detected.short": "wykryto",
  "verdict.detected.next":
    "Sygnał zgodny z kryterium amfetaminy. Pomiar przeszedł kontrolę jakości.",
  "verdict.uncertain.word": "DO OCENY EKSPERTA",
  "verdict.uncertain.short": "do oceny",
  "verdict.uncertain.next":
    "Sygnał w paśmie, które wymaga oka eksperta. Sprawdź wykres lub powtórz pomiar.",
  "verdict.not_detected.word": "NIE STWIERDZONO W TYM POMIARZE",
  "verdict.not_detected.short": "nie stwierdzono",
  "verdict.not_detected.next":
    "Nie znaleziono sygnału spełniającego kryterium. To nie jest dowód nieobecności substancji.",
  "verdict.TPrA_ONLY.word": "WZORZEC BEZ ANALITU",
  "verdict.TPrA_ONLY.next": "Wzorzec TPrA znaleziony, brak wiarygodnej pary analitu.",
  "verdict.NO_VALID_ANALYTE_PAIR.word": "PARA NIEPRAWIDŁOWA",
  "verdict.NO_VALID_ANALYTE_PAIR.next":
    "Kandydaci istnieją, ale żadna para nie spełnia warunku E4 > E3.",
  "verdict.MEASUREMENT_QUALITY_FAIL.word": "POMIAR NIE NADAJE SIĘ DO OCENY",
  "verdict.MEASUREMENT_QUALITY_FAIL.short": "wadliwy plik",
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
  "table.params": "Parametry",
  "table.warn": "Ostrzeżenia",
  "table.qualityOk": "OK",
  "table.aggregation":
    "Próbka = WYKRYTO, gdy co najmniej jeden plik WYKRYTO; inaczej DO OCENY, gdy co najmniej jeden DO OCENY; inaczej NIE STWIERDZONO, gdy co najmniej jeden pomiar był ważny; inaczej POMIARY NIE NADAJĄ SIĘ DO OCENY.",

  "expert.hint":
    "Przeciągnij punkty 1-4 na wykresie albo wpisz potencjał w panelu Piki (strzałki zmieniają o 1 mV). 1 i 3 na powrocie, 2 i 4 na gałęzi forward. Algorytm przyciąga do najbliższego punktu gałęzi. Brakujący punkt dodasz przyciskiem w panelu Piki, wskazując go na krzywej.",
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
    "NIE STWIERDZONO oznacza brak sygnału spełniającego kryterium w tym pomiarze, nie dowód nieobecności substancji. Pomiar na danych laboratorium z 16.09.2026: wykryto 121 z 293 plików pozytywnych; fałszywie wykryto 0 ze 147 plików negatywnych i 0 z 45 neutralnych.",

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
  "app.tagline": "Detekcja amfetaminy z CV",
  "app.taglineFull": "Analiza pomiarów woltamperometrii cyklicznej na granicy faz ciecz-ciecz (ITIES).",
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
  "peaks.col.meaning": "Znaczenie",
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
  "peaks.meaning.1": "minimum TPrA (wzorzec−)",
  "peaks.meaning.2": "maksimum TPrA (wzorzec+)",
  "peaks.meaning.3": "minimum analitu",
  "peaks.meaning.4": "maksimum analitu",
  "peaks.meaning.5": "TPrA, środek pary",
  "peaks.meaning.6": "analit, środek pary",
  "peaks.addAnalyte": "Dodaj parę analitu",
  "peaks.addStandard": "Wskaż wzorzec ręcznie",

  "analysis.window": "Okno potencjałowe",

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
  "params.detectionMethod": "Metoda detekcji",
  "params.default": "domyślne",
  "params.custom": "parametry własne",
  "params.outsideValidation": "Parametry własne, poza walidacją z 16.09.2026.",

  "analysisParams.title": "Parametry analizy",
  "analysisParams.defaultState": "Domyślne (walidowane 16.09.2026)",
  "analysisParams.customState": "Własne w tej sesji (poza walidacją)",
  "analysisParams.detected": "Tolerancja WYKRYTO",
  "analysisParams.review": "Tolerancja DO OCENY",
  "analysisParams.target": "ΔE_s wzorca amfetaminy",
  "analysisParams.forward": "Okno TPrA+ na forward",
  "analysisParams.reverse": "Okno TPrA− na powrocie",
  "analysisParams.from": "od",
  "analysisParams.to": "do",
  "analysisParams.apply": "Zastosuj i przelicz",
  "analysisParams.reset": "Przywróć domyślne",
  "analysisParams.errorNumbers": "Wpisz liczbę w każdym polu.",
  "analysisParams.errorWindows": "Początek każdego okna musi być mniejszy niż koniec.",

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

  "verdict.nextReview": "Następny do oceny",

  "scale.custom": "progi własne",

  "peaks.eInput": "Potencjał E punktu {n}, wolty",
  "peaks.pick.3": "Kliknij minimum analitu na skanie wstecz (punkt 3).",
  "peaks.pick.4": "Kliknij maksimum analitu na skanie w przód (punkt 4).",
  "peaks.pick.1": "Kliknij minimum TPrA na skanie wstecz (punkt 1).",
  "peaks.pick.2": "Kliknij maksimum TPrA na skanie w przód (punkt 2).",
  "peaks.pickEscape": "Escape przerywa.",
  "peaks.pickCancelled": "Wskazywanie punktów przerwane.",
  "peaks.pickDone": "Punkt {n} ustawiony na {value} V.",

  "expert.needPicked":
    "Punkt {n} nie pochodzi z algorytmu. Najpierw wskaż go na wykresie albo wpisz jego potencjał.",

  "analysisParams.errorDetectedRange": "Tolerancja WYKRYTO musi mieścić się w zakresie 1 do 30 mV.",
  "analysisParams.errorReviewRange":
    "Tolerancja DO OCENY musi być nie mniejsza niż tolerancja WYKRYTO i nie większa niż 30 mV.",
  "analysisParams.errorTargetRange": "ΔE_s wzorca musi mieścić się w zakresie 0,300 do 0,400 V.",
  "analysisParams.errorWindowRange": "Granice okna muszą mieścić się w zakresie -1,0 do 1,0 V.",
  "analysisParams.errorWindowWidth": "Okno musi mieć szerokość co najmniej 0,05 V.",

  "params.bar":
    "Parametry własne: tolerancja {detected}/{review} mV, ΔE_s {target} V. Wyniki poza walidacją z 16.09.2026.",
  "params.barLabel": "Własne parametry analizy",

  "progress.abort": "Przerwij",
  "progress.aborted": ({ n }) =>
    `Przerwano, ${n} ${plPlural(n, "plik został", "pliki zostały", "plików zostało")} w kolejce`,
  "progress.waitingEngine": "Czekam na silnik: pakiety numpy, scipy, pandas",

  "export.pdfScope": "Zakres raportu PDF",
  "export.scopeAll": ({ n }) => `Wszystkie pliki (${n})`,
  "export.scopeFiltered": ({ n }) => `Widoczne po filtrze (${n})`,
  "export.scopeSample": ({ n }) => `Zaznaczona próbka (${n})`,
  "export.backgroundHint":
    "W oknie druku włącz grafikę tła, inaczej wykresy będą blade.",
  "export.bigTitle": "Duży raport",
  "export.bigMessage":
    "Raport obejmuje {n} plików, około {pages} stron. Druk może potrwać.",
  "export.bigAccept": "Drukuj mimo to",
  "export.empty": "Brak policzonego pliku w tym zakresie.",

  "print.footer": "ITIES Detect, aplikacja {app}, algorytm {algo} (SHA-256 {sha})",
  "print.modeAuto": "Tryb: automatyczny",
  "print.modeManual": "Tryb: ręczny · operator {operator} · {time} · powód: {reason}",
  "print.mixed": "{n} z {total} plików policzono na parametrach własnych.",
  "print.scopeLine": "Zakres raportu: {scope}",

  "partner.ul": "Uniwersytet Łódzki, Wydział Chemii, grupa prof. Półtoraka",
  "partner.ahe": "Akademia Humanistyczno-Ekonomiczna w Łodzi, Paweł Kwaczyński",
  "partner.airon": "AIrON, Studenckie Koło Naukowe Informatyki AHE w Łodzi",

  "tip.home": "Analizatory CV: wybór aplikacji.",
  "tip.homeLabel": "Analizatory CV",
  "tip.filterAll": "Wszystkie pliki tej sesji. Klik na aktywny filtr wraca tutaj.",
  "tip.logoZoom": "Kliknij, żeby powiększyć",
  "tip.versionsLink": "Otwiera stronę wersji; Twoje pliki zostają w sesji.",
  "tip.belowThreshold": ({ value, threshold }) =>
    `Algorytm nie uznałby tego miejsca za pik (prominencja ${value} µA, próg ${threshold} µA). Wynik ręczny pozostaje wynikiem eksperta.`,
  "common.backTo": "Wróć do {app}",
  "common.peakwise": "PeakWise",
  "sidebar.summary": "Filtry werdyktu",
  "sidebar.selectSample": "Zaznacz wszystkie pliki próbki",
  "multi.selected": ({ n }) =>
    `${n} ${plPlural(n, "plik zaznaczony", "pliki zaznaczone", "plików zaznaczonych")}`,
  "multi.clear": "Wyczyść zaznaczenie",
  "multi.compare": "Porównaj na jednym wykresie",
  "multi.cards": "Pokaż osobne karty",
  "multi.compareAria": "Porównanie {n} woltamperogramów",
  "multi.expertOne": "Korekta ręczna działa na jednym pliku. Zaznacz jeden.",
  "multi.noResult": "Jeszcze nie policzony.",
  "export.scopeSelected": ({ n }) => `Zaznaczone pliki (${n})`,
  "export.csvSelected": ({ n }) => `CSV zaznaczonych plików (${n})`,
  "peaks.col.prom": "Prom. (µA)",
  "peaks.belowThreshold": "poniżej progu piku",
  "verdict.belowThresholdNote": ({ points }) =>
    `(punkt${points.includes(",") ? "y" : ""} ${points} poniżej progu piku)`,
  "expert.belowThresholdTitle": "Zapisać korektę eksperta?",
  "expert.belowThresholdSave": ({ points, threshold }) =>
    `Punkt ${points}: prominencja jest poniżej progu piku ${threshold} µA, więc algorytm nie odczytałby tam piku. Korekta zapisuje się jako decyzja eksperta z Twoim powodem.`,
  "expert.belowThresholdAccept": "Zapisz mimo to",
  "result.belowThresholdSentence": ({ points, threshold }) =>
    `Wynik eksperta: punkt ${points} poniżej progu piku ${threshold} µA.`,
  "tip.appSwitch": "Przełącza między ITIES Detect i PeakWise. Twoje pliki w tej aplikacji zostają.",
  "tip.session": "Nazwane sesje w tej przeglądarce: zmiana nazwy bieżącej, nowa sesja, otwarcie zapisanej, zapis całej sesji do pliku i odczyt z pliku.",
  "tip.sidebarDrop": "Upuść tutaj pliki TXT z NOVA albo folder, albo użyj przycisków. Klawiatura: Cmd/Ctrl+O pliki, Cmd/Ctrl+Shift+O folder.",

  "algo.info.label": "O tej wersji algorytmu",
  "algo.info.version": "Algorytm {version} ({date})",
  "algo.info.measured": "Zmierzone na danych laboratorium {date}: wykryte pozytywy {positives}, fałszywe wykrycia {negatives} na próbach ślepych i {neutrals} na neutralach.",
  "algo.info.sha": "SHA-256 pliku {sha}",

  "session.menu": "Sesja",
  "session.currentLabel": "Sesja bieżąca",
  "session.nameLabel": "Nazwa sesji",
  "session.savedLabel": "Zapisane sesje",
  "session.new": "Nowa sesja",
  "session.saveFile": "Zapisz sesję do pliku",
  "session.loadFile": "Wczytaj sesję z pliku",
  "session.open": "Otwórz",
  "session.current": "Bieżąca sesja",
  "session.rename": "Zmień nazwę",
  "session.delete": "Usuń",
  "session.deleteTitle": "Usunąć sesję",
  "session.deleteMessage": ({ name, n }) =>
    `Sesja ${name} zawiera ${n} ${plPlural(n, "plik", "pliki", "plików")}. Usunięcie kasuje je z tej przeglądarki.`,
  "session.deleteAccept": "Usuń sesję",
  "session.rowStats": ({ n, size, when }) =>
    `${n} ${plPlural(n, "plik", "pliki", "plików")} · ${size} · ${when}`,
  "session.savedAt": "Zapisano {time}",
  "session.fileWritten": "Plik sesji zapisany, {size}.",
  "session.bigTitle": "Duży plik sesji",
  "session.bigMessage": "Plik będzie miał około {size}. Zapis może potrwać.",
  "session.bigAccept": "Zapisz mimo to",
  "session.fileRefusedTitle": "Plik sesji odrzucony",
  "session.fileBadFormat": "To nie jest plik sesji ITIES (odczytany format: {found}).",
  "session.fileBadSha": ({ n, names }) =>
    `${n} ${plPlural(n, "plik nie zgadza się", "pliki nie zgadzają się", "plików nie zgadza się")} z zapisaną obok sumą SHA-256: ${names}. Nic nie zostało wczytane.`,
  "session.loadTitle": "Wczytaj sesję",
  "session.loadMessage": ({ name, n }) =>
    `${name}: ${n} ${plPlural(n, "plik", "pliki", "plików")} z wynikami. Zastąpić bieżącą sesję czy dodać jako nową?`,
  "session.loadReplace": "Zastąp bieżącą sesję",
  "session.loadAsNew": "Dodaj jako nową sesję",

  "hub.files": ({ n }) => `${n} ${plPlural(n, "plik", "pliki", "plików")} w sesji`,
  "hub.noFiles": "brak plików",

  "print.session": "Sesja: {name}",

  "app.changelog.1_2_0":
    "2026-09-16: przebudowany ekran wyniku: nagłówek pliku z metadanymi, cztery karty KPI, duży opisany wykres z zoomem i pełnym ekranem, panel pików, drzewo folderów i próbek z kropkami statusu, zwijane parametry, historia i metadane. PeakWise 1.0 dodany do huba.",
  "app.changelog.1_4_0":
    "2026-09-17: dodano dostępne objaśnienia do trybu eksperckiego i kontrolek sesji. Foldery sesji można tworzyć, zmieniać ich nazwy, usuwać bez kasowania plików oraz obsługiwać przeciąganiem albo menu przenoszenia, ze statystykami zapisanymi w sesji i grupowanym eksportem. Start silnika i praca serii używają teraz jednego wyśrodkowanego okna postępu z etapami albo dokładnym procentem. Hub, ITIES Detect i PeakWise mają wspólne logowanie po stronie serwera z ograniczeniem prób i sesją ważną 12 godzin. W stopce są logotypy partnerów, szare do czasu najechania. Pliki dodaje się w jednym miejscu, w strefie paska bocznego, skrótami Cmd/Ctrl+O i Cmd/Ctrl+Shift+O. Wybór wersji algorytmu objaśnia wybraną wersję danymi z manifestu. Serwer odmawia indeksowania przez robots.txt, nagłówek i znacznik meta. Ikona domu i przełącznik aplikacji prowadzą między hubem, ITIES Detect i PeakWise. Sesje są nazwane, może ich być wiele obok siebie, a całą sesję można zapisać do pliku JSON z sumami SHA-256 i wczytać bez ponownego liczenia. Addendum z 17.09: pasek narzędzi ma siedem kontrolek do pracy na danych, licznik plików i liczniki werdyktów stały się podsumowaniem z filtrami na górze listy, język, motyw, operator i logotypy partnerów zeszły do stopki, czyszczenie sesji żyje w menu Sesja, wykres pokazuje numer punktu raz, punkt ręczny poniżej progu piku jest nazwany w panelu, na werdykcie, w tabeli i w raporcie, „Następny do oceny” przesuwa zaznaczenie w liście, a wiele plików naraz wybiera się przez Cmd albo Shift i czyta jako karty albo jeden wykres porównawczy.",
  "app.changelog.1_3_0":
    "2026-09-17: sesję można wyczyścić, a pliki, próbki i foldery usunąć z paskiem cofnięcia, a plik o treści już wczytanej jest pomijany jako duplikat. Każdy import i przeliczenie otwiera okno postępu z licznikami werdyktów na żywo, przyciskiem Przerwij i filtrami statusu, które zostają w pasku narzędzi. Ekran wyniku pokazuje werdykt raz, na karcie werdyktu ze skalą tolerancji i legendą, a panel Piki zawsze wymienia punkty 1 do 4 oraz E5 i E6. Brakującą parę analitu albo wzorzec dodaje się wskazaniem na krzywej lub wpisaniem potencjału, nigdy zasiewem programu. Parametry analizy można zmienić na czas sesji pod trybem eksperckim, w twardych granicach, a każdy wynik z nich policzony jest oznaczony jako poza walidacją z 16.09.2026 w interfejsie, w CSV i w raporcie.",
};

const DICT = { en: EN, pl: PL };

// The local choice comes first: it is the one the operator made in the application.
// The cookie is the hint the server needs for the login page, and it only decides when
// nothing was chosen here yet.
function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch (_) {
    /* private mode */
  }
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(STORAGE_KEY + "="));
  if (cookie) {
    const saved = decodeURIComponent(cookie.slice(STORAGE_KEY.length + 1));
    if (LANGS.includes(saved)) return saved;
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
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(lang)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = lang;
  for (const fn of listeners) fn(lang);
}

// PeakWise keeps its own dictionary and writes the same cookie. When it switches
// language this pulls the shared dictionary along, so the footer logos and the
// shared tooltips do not stay in the previous language until a reload.
export function syncLangFromStorage() {
  const next = readLang();
  if (next === current) return current;
  current = next;
  document.documentElement.lang = current;
  for (const fn of listeners) fn(current);
  return current;
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
