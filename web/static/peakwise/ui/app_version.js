// App version and its changelog. Kept in its own module so the version history page does
// not have to import the whole application (and with it Pyodide and the chart library).

export const APP_VERSION = "1.1.0";

export const APP_CHANGELOG = [
  {
    version: "1.1.0",
    date: "2026-09-17",
    en: [
      "the frame of ITIES Detect 1.4: toolbar with Session, Recompute, algorithm picker with an info button, Files or Table, language and theme, Export",
      "status bar under the toolbar with a pill per PeakWise status, each one a filter shared with the sidebar",
      "sidebar with a 64 px header, the mark, the application switcher, a FILTERS source list with counts and a drop zone at the bottom",
      "footer with the engine state, the operator, the partner logos, version history and the way out",
      "centred progress window with the percentage, tooltips on the controls, the mark opens large on a click",
      "renaming an electrode happens in the list, not in a browser prompt",
    ],
    pl: [
      "rama z ITIES Detect 1.4: pasek narzędzi z Sesją, Przelicz ponownie, wyborem wersji algorytmu z ⓘ, Pliki albo Tabela, język i motyw, Eksport",
      "belka stanu pod paskiem narzędzi, pastylka na każdy status PeakWise, każda jest filtrem wspólnym z paskiem bocznym",
      "pasek boczny z nagłówkiem 64 px, znakiem, przełącznikiem aplikacji, listą FILTRY z licznikami i strefą upuszczania na dole",
      "stopka ze stanem silnika, operatorem, logotypami partnerów, historią wersji i wyjściem",
      "wyśrodkowane okno postępu z procentem, dymki na kontrolkach, znak otwiera się w dużym rozmiarze po kliknięciu",
      "zmiana nazwy elektrody dzieje się na liście, nie w oknie przeglądarki",
    ],
  },
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
