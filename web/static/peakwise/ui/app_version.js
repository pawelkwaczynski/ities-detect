// App version and its changelog. Kept in its own module so the version history page does
// not have to import the whole application (and with it Pyodide and the chart library).

export const APP_VERSION = "1.0.0";

export const APP_CHANGELOG = [
  {
    version: "1.0.0",
    date: "2026-09-16",
    en: [
      "first web version, the notebook algorithm frozen and run in the browser through Pyodide",
      "electrode list, result card, CV chart with baselines and tangent intersections",
      "session table, CSV export with the notebook columns, printable report",
      "English and Polish interface, system, light and dark theme",
    ],
    pl: [
      "pierwsza wersja web, algorytm z notebooka zamrożony i liczony w przeglądarce przez Pyodide",
      "lista elektrod, karta wyniku, wykres CV z bazowymi i przecięciami stycznych",
      "tabela sesji, eksport CSV w kolumnach notebooka, raport do druku",
      "interfejs po angielsku i po polsku, motyw systemowy, jasny i ciemny",
    ],
  },
];
