# ITIES Detect: addendum 3 (runda następna, zgłoszenie właściciela 17.09 21:10)

## BB. Wiele plików naraz: wybór z listy i wyniki jeden pod drugim
- Zaznaczanie w pasku bocznym: Cmd/Ctrl+klik dodaje lub zdejmuje plik, Shift+klik zaznacza zakres w widocznej liście, klik bez modyfikatora zaznacza jeden (jak dziś). Na grupie próbki w menu kontekstowym „Zaznacz wszystkie pliki próbki". Zaznaczone wiersze mają stan `aria-selected`, licznik w nagłówku treści „3 pliki zaznaczone · Wyczyść zaznaczenie".
- Treść przy wielu zaznaczonych: karty wyników jedna pod drugą, każda kompaktowa (nagłówek z nazwą i werdyktem, zdanie z ΔE_s, wykres 280 px wysokości, panel Piki zwinięty za przyciskiem), w kolejności listy. Przycisk „Porównaj na jednym wykresie" nakłada krzywe (skan w przód pełną linią, wstecz przerywaną, każdy plik innym kolorem z palety 6 kolorów dostępnych dla daltonistów), legenda z nazwą i werdyktem, punkty 1 do 4 tylko dla pliku aktywnego (klik na legendę).
- Tryb ekspercki i wskazywanie punktów działają tylko przy jednym zaznaczonym pliku; przy wielu pokazać zdanie „Korekta ręczna działa na jednym pliku. Zaznacz jeden." i wyłączyć uchwyty.
- Eksport PDF „Zaznaczone" i CSV „Zaznaczone" używają tego zaznaczenia. Strzałki góra i dół przesuwają aktywny plik w obrębie zaznaczenia, gdy jest wiele.
- Stan zaznaczenia nie jest zapisywany w sesji (po odświeżeniu jeden plik jak dziś).
- Testy smoke: Cmd+klik dwóch plików daje dwie karty w `#content` w kolejności listy; Shift+klik zakresu 3 plików daje 3; „Porównaj na jednym wykresie" rysuje jeden wykres z 3 seriami forward; przy 2 zaznaczonych przełącznik trybu eksperckiego pokazuje zdanie o jednym pliku i zero uchwytów.
