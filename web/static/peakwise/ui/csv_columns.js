export function csvColumns(rows) {
  const keys = new Set();
  for (const file of rows) {
    for (const key of Object.keys(file.result.result_row)) keys.add(key);
  }
  return [...keys];
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

const EXTRA = ["elektroda", "file_sha256", "algo_version", "algo_sha256", "analysed_at", "operator"];

// Columns come from the notebook result, followed by provenance for each file.
export function csvText(files, { operator = "" } = {}) {
  const rows = files.filter((file) => file.result?.result_row);
  if (!rows.length) return null;
  const keys = csvColumns(rows);
  const lines = [keys.concat(EXTRA).join(",")];
  for (const file of rows) {
    const cells = keys.map((key) => csvEscape(file.result.result_row[key]));
    cells.push(
      csvEscape(file.electrode),
      csvEscape(file.sha256),
      csvEscape(file.algoVersion || file.result.algo_version),
      csvEscape(file.algoSha),
      csvEscape(file.analysedAt),
      csvEscape(operator)
    );
    lines.push(cells.join(","));
  }
  return lines.join("\n") + "\n";
}
