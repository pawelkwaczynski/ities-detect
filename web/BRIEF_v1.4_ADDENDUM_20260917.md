# ITIES Detect 1.4.0: addendum (runda 2, 17.09.2026, 16:10)

Zgłoszenia właściciela po starcie rundy 1. Obowiązuje wszystko z `BRIEF_v1.4_20260917.md` (w tym sekcje G i I). Ten plik DODAJE.

## J. Stopka: logotypy partnerów
- W stopce huba, ITIES Detect i PeakWise, po lewej od statusu silnika (albo w osobnym wierszu na wąskim ekranie), trzy logotypy w skali szarości z pełnym kolorem po najechaniu, wysokość 22 px, odstęp 16 px, `alt` z pełną nazwą, bez linków wychodzących (nie ma zgody na linkowanie na zewnątrz, to narzędzie labu): Uniwersytet Łódzki (Wydział Chemii, grupa prof. Półtoraka), AHE w Łodzi, AIrON (Studenckie Koło Naukowe Informatyki AHE w Łodzi; plik `airon-logo.png` jest w `assets/partners/`, przycięty z białych marginesów). Pliki w `assets/partners/`: `ahe-logo-pl.png` już jest; `ul-logo.png` (1200×585, od właściciela 17.09) i `airon-logo.png` są już w `assets/partners/` (do tego czasu zostaw w kodzie miejsce i wyświetlaj tylko te pliki, które istnieją, bez pustych ramek i bez wymyślonych znaków). Serwer: `/assets/partners/<plik>` z długim buforem jak inne assets. Nie przerabiać logotypów (proporcje, kolory) poza skalą szarości przez CSS `filter`.
- Dymek na każdym logo z pełną nazwą instytucji (PL i EN).

## K. Jedno miejsce dodawania plików, nie trzy
- Usunąć z paska narzędzi przyciski „Importuj pomiary" i „Dodaj folder" (zostają: „Przelicz ponownie", wybór algorytmu, Pliki/Tabela, po prawej język, motyw, Tryb ekspercki z ikoną „i", Eksport, Wyczyść sesję). Dodawanie plików zostaje w dwóch miejscach, które się nie dublują na ekranie: strefa w dole paska bocznego (zawsze) i karta stanu pustego (tylko gdy lista pusta). Upuszczanie na całą treść zostaje.
- Skróty: `Cmd/Ctrl+O` otwiera wybór plików, `Cmd/Ctrl+Shift+O` folder; w dymku strefy paska bocznego wypisać skróty.
- Stan pusty: jedno zdanie i dwa przyciski jak dziś, ale bez powtarzania tekstu ze strefy paska bocznego (skrócić kartę do „Upuść pliki TXT z NOVA tutaj" + przyciski; opis formatów tylko w strefie paska).

## L. Algorytm 1.0 i 1.1: czym się różnią, widoczne od razu
- Przy wyborze wersji algorytmu ikona „i" (SVG) i dymek/popover z treścią z `algo/versions.json` dla wybranej wersji: data, lista zmian (changelog), liczby zmierzone (czułość, fałszywe wykrycia, data pomiaru) i skrócony SHA-256, plus link „Historia wersji". Teksty changelogu przez klucze `algo.changelog.*` w i18n (już istnieją dla 1.1, dopisać dla 1.0), liczby z manifestu, nie z UI.
- Po zmianie wersji w oknie postępu wiersz „Algorytm 1.0 (2026-08-20): ..." z pierwszą linią changelogu, żeby użytkownik wiedział, co właśnie przeliczył.
- W tabeli i w PDF wersja algorytmu jest już przy każdym pliku; zostaje.

## M. Bez indeksowania
- `/robots.txt` (`User-agent: *` / `Disallow: /`), nagłówek `X-Robots-Tag: noindex, nofollow, noarchive` na każdej odpowiedzi serwera (także `/login`), `<meta name="robots" content="noindex, nofollow">` w każdym HTML (hub, ITIES, PeakWise, versions, login). Test w `tools/test_server.py`: robots.txt 200 z `Disallow: /`, nagłówek obecny na `/login` i `/ities/`.
- Nie dodawać sitemap, nie dodawać nic do Google. To narzędzie labu za hasłem.

## N. Testy dodatkowe (do F)
- smoke (p): w pasku narzędzi nie ma przycisku importu; strefa w pasku bocznym istnieje; `Cmd/Ctrl+O` otwiera input (sprawdzić przez nasłuch `click` na `#file-input`).
- smoke (q): dymek wersji algorytmu zawiera datę i pierwszą linię changelogu z manifestu; po przełączeniu na 1.0 treść się zmienia.
- test_server: robots i nagłówek jak w M.
- screenshots: stopka z logotypami (jasny i ciemny), dymek wersji algorytmu.

## O. Przełączanie między aplikacjami (zgłoszenie 16:20: „łatwy switch pomiędzy aplikacjami, jak button ikonka home")
- W nagłówku paska bocznego (obok logo i nazwy aplikacji) ikona „dom" (SVG 18 px, nie emoji) prowadząca do huba `/`, z dymkiem „Analizatory CV: wybór aplikacji". Ta sama ikona w PeakWise.
- Obok niej przełącznik aplikacji: klik na nazwę aplikacji rozwija małą listę „ITIES Detect · PeakWise" (menu jak Eksport), bieżąca zaznaczona, druga prowadzi do `/peakwise/` albo `/ities/`. Sesja plików każdej aplikacji zostaje w jej IndexedDB, więc przejście nic nie kasuje; dymek to mówi: „Twoje pliki w tej aplikacji zostają."
- Skrót: `Cmd/Ctrl+Shift+H` do huba. Na wąskim ekranie ikona domu w pasku narzędzi obok przycisku „Lista".
- Hub: kafelki jak dziś, plus przy każdym kafelku liczba plików w sesji danej aplikacji (odczyt z IndexedDB tej aplikacji, jeśli jest; brak sesji = „brak plików"), żeby było widać, gdzie coś zostało.
- smoke (r): klik ikony domu z `/ities/` prowadzi na `/` (po zalogowaniu), a z huba kafelek na `/ities/` wraca z tą samą listą plików.

## P. Sesje: nazwane, wiele, do pliku (zgłoszenie 16:35: „ogarnij co z zapisywaniem sesji")
Dziś: jedna bezimienna sesja w IndexedDB tej przeglądarki, autozapis, powrót po odświeżeniu, „Wyczyść sesję" kasuje wszystko. Ma być:
- **Nazwane sesje w przeglądarce.** Menu „Sesja" w pasku narzędzi (obok Eksport): nazwa bieżącej sesji (domyślnie data i godzina utworzenia, edytowalna inline), lista zapisanych sesji z liczbą plików, rozmiarem i datą ostatniej zmiany, akcje: „Nowa sesja" (bieżąca zostaje zapisana), „Otwórz", „Zmień nazwę", „Usuń" (dialog jak przy czyszczeniu). IndexedDB: store `sessions` z kluczem id, bieżąca wskazana w `meta`. Autozapis jak dziś, plus w stopce napis „Zapisano 15:42" po każdym zapisie (aria-live).
- **Sesja do pliku i z pliku.** „Zapisz sesję do pliku" tworzy JEDEN plik `.ities-session.zip`? Nie: bez nowych bibliotek nie ma zip. Zamiast tego jeden plik JSON `nazwa.ities.json` (pliki źródłowe jako base64 razem z sumami SHA-256, wyniki auto i eksperta, rewizje, foldery, operator, parametry własne, wersja aplikacji i algorytmu, znacznik czasu), pobrany przez `Blob`. „Wczytaj sesję z pliku" czyta taki JSON, sprawdza sumy SHA-256 każdego pliku (niezgodność = odmowa z listą plików), pyta, czy zastąpić bieżącą sesję czy dodać jako nową, i odtwarza wszystko bez ponownego liczenia (wyniki są w pliku; przycisk „Przelicz ponownie" dostępny jak zawsze). Limit ostrzegawczy: powyżej 200 MB komunikat, że plik będzie duży.
- **Bezpieczeństwo treści.** Plik sesji nie zawiera hasła ani niczego z serwera. W nagłówku JSON pole `format: "ities-session/1"`; nieznany format = czytelna odmowa.
- Eksport CSV i PDF działają na bieżącej sesji jak dziś; w nagłówku PDF nazwa sesji.
- Testy: smoke (s) nowa sesja → wgranie 1 pliku → zapis do pliku → „Wyczyść sesję" → wczytanie z pliku → ten sam werdykt i ta sama suma SHA, bez wywołania `analyze`; (t) przełączenie między dwiema nazwanymi sesjami zachowuje listy plików obu; (u) plik z podmienionym bajtem w base64 → odmowa z nazwą pliku.
