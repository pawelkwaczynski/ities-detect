// The four points behind a verdict, as rows for the printed report.
export function pointTable(result) {
  return ["1", "2", "3", "4"].map((k) => ({
    k,
    raw: result["E" + k + "_raw"],
    cal: result["E" + k],
    i: result.points?.[k]?.I != null ? result.points[k].I * 1e6 : null,
  }));
}
