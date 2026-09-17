# Brief: runda 3 UI (inspiracje ChatGPT z 16.09 22:26–22:33, zrzut Pawła 22:03)
Pliki: inspiracja_1.png (jasny, pełny układ), inspiracja_2.png (jasny, KPI-karty), inspiracja_3.png (ciemny pasek boczny, zakładki), screen Pawła: obecny stan (za mały, nieopisany wykres).
Właściciel: "wykresy słabe, Colab lepiej rysował; sam pomysł, masz skille UX". Zainstalowany skill ~/.claude/skills/ui-ux-pro-max (użyj scripts/search.py dla domeny ux/chart/typography) + ~/.claude/skills/impeccable/reference/craft-floor.md.

## Co wziąć z makiet (wspólne dla wszystkich trzech)
1. Nagłówek pliku: nazwa pliku dużą czcionką + metadane (próbka, data pliku jeśli jest, liczba punktów, cykl użyty) + plakietka werdyktu po prawej.
2. Rząd 4 kart KPI: ΔE_s | Wzorzec (0,350 V) | Różnica (+14 mV, kolor werdyktu) | Status; obok pozioma skala tolerancji −30…+30 mV ze znacznikiem.
3. Wykres DUŻY (min 480 px wysokości, pełna szerokość kolumny), tytuł "Woltamperogram cykliczny", podtytuł, legenda "Skan w przód / Skan wstecz", punkty 1–4 jako wyraźne kółka z numerami (1,2 niebieskie; 3,4 czerwone), linie pionowe E5/E6 przerywane, delikatna siatka, osie "E / V" i "I / µA", przyciski zoom/reset/pełny ekran, przełącznik "Pokaż znaczniki".
4. Panel "Piki" obok wykresu: tabela # | E (V) | I (µA) | typ (wzorzec+/−, analit+/−) z kolorowymi kropkami, pod nią "Analiza ITIES": okno potencjałowe, wzorzec, ΔE_s, różnica; przyciski "Wykryj ponownie", "Edytuj piki" (= tryb ekspercki).
5. Pasek boczny: nagłówek z ikoną i nazwą aplikacji, wyszukiwarka próbek, drzewo Folder/Projekt → Próbka (licznik) → pliki z kropką statusu i podpisem daty; na dole strefa "Przeciągnij pliki / Importuj pomiary (TXT, CSV)".
6. Pasek narzędzi u góry: "Importuj pomiary" (główny), "Analizuj serię", dropdown "Algorytm 1.1", segment PL/EN, przełącznik motywu (ikony słońce/księżyc + system), "Tryb ekspercki" toggle, "Eksport".
7. Sekcje zwijane pod wykresem: "Parametry pomiaru", "Historia analizy", "Metadane pliku".
8. Stopka: wersja aplikacji, "Analiza zakończona, czas X s".
Nie kopiować z makiet: fałszywych danych (skan 50 mV/s, Ag/AgCl, projekt ITIES-24), zakładek bez treści, przycisków bez funkcji. Oś X to E po kalibracji TPrA (przełącznik E surowe zostaje). Wszystko dwujęzyczne, motywy jasny/ciemny.
