# Nutzer-Durchgang WeddaApp – 21.10.2026

Stand `main` eca15af, Zweig `durchgang-wedda`. Geprüft wie ein Nutzer mit Playwright/WebKit (Safari-Motor) in 390 × 844 (iPhone) und 1280 × 800 (Mac), hell und dunkel. Open-Meteo kam aus der Attrappe `tests/fixtures/open-meteo-mannheim.json` (Daten vom 20.10., daher steht bei „Heute“ der 20.10. und „Stand 10:30 Uhr“), Bright Sky „nicht gefunden“, Kartenkacheln und RainViewer gesperrt (Karten zeigen deshalb nur blaue Fläche und „Radar nicht erreichbar“ – das ist die Attrappe, nicht die App). Die WeddaApp hat keine Warn- und Luftqualitäts-Kacheln und keinen Seitenleisten-Aufbau am Mac (das sind Eigenheiten der Camera App).

Bildschirmfotos: `/private/tmp/claude-501/-Users-stephanhandel-KI-Projekte/f6383d02-b902-4603-adb1-44563a289b95/scratchpad/durchgang-wedda/` (Zwischenspeicher der Sitzung, nicht im Git; Namen `390-…`, `1280-…`, `390d-…` dunkel, `390g-…` 130 %).

Konsole: in allen Durchgängen keine Fehler; einzige Meldung ist „Service Worker registration blocked by Playwright“ (Prüfwerkzeug, nicht die App).

---

## 1. Was ein Nutzer sieht

**Start (iPhone)** – `390-01-start.png`, dunkel `390d-01-start.png`
Kopf mit Ort „Mannheim“, links Orte-Knopf, rechts Suche und Teilen. Aktuell-Kachel (Symbol, 8°, „Heiter“, Gefühlt, Wind, Böen, Regen, Feuchte, Windrose, „Stand 10:30 Uhr“), drei Stundenspalten, 8-Tage-Liste, Regenradar-Kachel mit „Trocken bis …“, „Karte öffnen“ und Regen der nächsten 2 Stunden, dann die Quellenzeile. Verständlich, Reihenfolge wie in `CLAUDE.md`. Gemessen: kein seitliches Scrollen, keine Tippfläche unter 44 px, keine Schrift unter 12 px. Die Aktuell-Kachel ist nicht antippbar (gewollt, kein Blatt). Dunkelmodus gleichwertig lesbar.

**Ortswechsel** – `390-03-suche.png`, `390-04-neuer-ort.png`
Such-Symbol oben führt in den Reiter Mehr, Fokus steht schon im Suchfeld. „Heidelberg“ tippen → Treffer mit Region und Land → Antippen wechselt zum Wetter-Reiter, Kopf zeigt „Heidelberg“, der Ort steht danach unter „Orte und Favoriten“ (mit „Aktueller Ort“ und „entfernen“-Knopf 44 × 44). Rund.

**Favoriten-Stern** – `390-05-stern.png`
Stern 44 × 44, Name wechselt zwischen „… als Favorit markieren“ und „… ist Favorit“ (`aria-pressed`), Favoriten rücken nach oben. Gut.

**Regenradar-Kachel** – Antippen der Karte und „Karte öffnen“ führen beide zum Reiter Rad/Sat. Gut.

**Graphs** – `390-02-graphs.png`, Mac `1280-02-graphs.png`
Meteogramm mit Kopf „21.10. · 22:46 jetzt | bedeckt“, vier Zeilen, Jetzt-Linie, darunter Zoom (−, Lupe, +), Knopfleiste (Neu laden, Kontrast, ‹ Jetzt ›, ⤢, Liste) und Hilfetext. Die Zoom-Knöpfe liegen hier unter dem Diagramm (nichts verdeckt). Zwei Schönheitsfehler im Baustein: Sonnenzeiten 10,5 px und 2,2:1 hell (Fund 1), Wert-Marke 2,5:1 hell (Fund 2).

**Rad/Sat und Karten** – `390-02-radsat.png`, `390-06-karte-voll.png`, `390-06b-karte-voll-karten.png`
Umschalter „Radar & Satellit | Karten“, Ebenenleiste mit 44-px-Knöpfen, Abspielen, Zeit-Regler. Der Regler ist nur 28 px hoch (Fund 3).

**Vollbild und „immer im Vollbild“** – `390-05-graphs-voll.png`, `390-07-immer-graphs.png`
⤢ legt das Meteogramm als Blatt über alles, „Fertig“ oben rechts, Esc schließt, Fokus kehrt auf ⤢ zurück. Das Karten-Blatt hat oben den Umschalter und „Fertig“. Mit dem Schalter unter Mehr öffnen Graphs und Rad/Sat sofort als Blatt, „Fertig“ und Esc führen zum vorherigen Reiter (Mehr). Alle Knöpfe im Blatt 44 px, nichts ragt seitlich. Rund (die Vollbild-Tests sind zusätzlich 253/253 grün).

**Mehr** – `390-02-mehr-voll.png`, Mac `1280-02-mehr.png`
Nur 1868 px hoch (iPhone), fünf Gruppen: Orte und Favoriten, Darstellung (Wind-Einheit, Vollbild-Schalter), Wetterfoto (Platz des Kamera-Knopfs, Aussehen), Quellen. Kurz und übersichtlich; klappt nicht ein, muss es bei dieser Länge auch nicht. Die Schalter „Wo sitzt der Wetterfoto-Knopf?“, „Platz“ und „Aussehen“ brechen in zwei Reihen um (Fund 6).

**Wetterfoto-Studio** – leer `390-10-studio-leer.png`, mit Foto `390-11-studio-foto.png`, Mac `1280-20-foto.png`
Runder Kamera-Knopf öffnet gleich die Dateiauswahl mit Kamera (im Test mit Beispielfoto beantwortet), Teilen-Symbol oben öffnet das Studio ohne Kamera (Startkarte „Wetterfoto gestalten“, Foto aufnehmen / wählen / Einfügen / Live-Sucher, Hinweis „In Fotos: Motiv lange drücken …“). Mit Foto: Vorschau mit Wetterkarte, „Automatisch verbessert: dunkler, wärmer“, „Meine Wetterfotos“, Vorlagen (Empfohlen, Band, Story, Quadrat, Analog, Schwarz-Weiß, Sofortbild), großes „Teilen“, „Teilen-Optionen“, Zahnrad. Der Umschalter „Einfach | Profi“ im Kopf funktioniert: Profi zeigt Regler (Licht, Kontrast, Wärme …), Werkzeugleiste (Zuschnitt, Anpassen, Filter, Wetter, Text, Format) und „Original“ (`390-21-profi.png`). Blatt „Bearbeiten“ (Text, Wetterdaten, Format, Automatisch verbessert, „Motiv aus Fotos wählen“, „Alle Werkzeuge (Profi)“), Blatt „Teilen-Optionen“ (JPEG/PNG/PDF, Größe, Dateiname mit Ort und Zeit, Teilen/Sichern/Kopieren, „GPS-Standort und Gerätedaten werden aus dem Bild entfernt“, Bildbeschreibung), Zahnrad-Blatt „Einstellungen“, Wetterkarten-Werkzeug (Kleiner/Größer/Daten/Pfeile), Galerie „Meine Wetterfotos“ → Originalfoto mit „Neu gestalten“, „Alle Fotos“, „Löschen“ (`390-31-weiter.png`). Alle Tippflächen im Studio ≥ 44 px, nichts schmaler als der Bildschirm, hell und dunkel in Ordnung.

**130 % Schrift** – `390g-01-start.png`, `390g-02-mehr-voll.png`, `390g-03-studio.png`
Alles bricht um, kein seitliches Scrollen, nichts abgeschnitten, kleinste Schrift in der App ≥ 12 px; im Meteogramm 11 px (nach der Korrektur, siehe Fund 1: vorher waren Marken, Sonnenzeiten und Tagesinfo dort nur 10,5 px gezeichnet).

**Tastatur** (Wahltaste+Tab, WebKit)
Start: Orte, Suche, Teilen, Radar-Kachel, „Karte öffnen“, Reiter (Wetter, Graphs, Kamera, Rad/Sat, Mehr); Fokusring 2 px. Studio: Fertig → Anderes Foto → Bearbeiten → Einfach → Profi → Wetterkarte → Galerie → Vorlagen → Teilen → Zahnrad → Teilen-Optionen; im Blatt kreist der Fokus (ausgabe … Fertig, dann wieder von vorn), Esc schließt erst das Blatt (Fokus auf „Teilen-Optionen“), dann das Studio (Fokus auf dem Kamera-Knopf). Ausnahme: Fund 4; nach Ortswahl und „Karte öffnen“ Fund 10.

---

## 2. Funde (App-Einbindung)

Schwere: **schwer** = Nutzer kommt nicht weiter oder versteht etwas falsch · **stört** = fällt auf, kostet Zeit oder Vertrauen · **klein** = Schönheitsfehler.

| Nr. | Wo | Was | Schwere | Beleg | Vorschlag | Stand |
|---|---|---|---|---|---|---|
| 1 | Graphs, Beschriftungen im Meteogramm | Marken („↑ 13°“, `.mg-mark`), Sonnenzeiten (`.mg-sonne`) und Tagesinfo („07:55 – 18:26“, `.mg-tagesinfo`) werden mit 10,5 px gezeichnet (Grenze „kein Text unter 11 px“); Sonnenzeiten hell zudem nur 2,2:1 (Ocker auf Weiß). In meinem ersten Durchgang war die Größe fälschlich als 11 px berichtet, die Tagesinfo und Marken fehlten | schwer | gemessen als Schriftgröße × SVG-Skalierung in allen 8 Fällen (hell/dunkel × 390/1280 × normal/Vollbild); `meteogramm.css:288–290` | In `app.css` alle drei auf 11 px, Sonnenzeiten in Zweittextfarbe (Baustein bleibt unverändert); Tagesinfo läuft bei 11 px nicht in die Jetzt-Linie (geprüft 390 und 1280) | behoben im Folgecommit (siehe Git-Verlauf) |
| 2 | Graphs, Wert-Marke am linken Achsenrand (z. B. „11“) | Reihenfarbe (Orange) auf Weiß, hell 2,5:1 | klein | `meteogramm.js:714` | Nur im Hellmodus und nur die Schrift in Textfarbe (`-webkit-text-fill-color`), Rahmen bleibt in Kurvenfarbe; dunkel unverändert (war 6,85:1). Die erste Fassung mit `!important` färbte auch Rahmen und Dunkelmodus um | behoben im Folgecommit |
| 3 | Rad/Sat, Zeit-Regler | Nur 28 px hoch, Grenze 44 px | stört | `wpkarte.css:37`; Messung `wk-range 196x28` | Höhe 44 px in `app.css` | behoben in 477aab9 |
| 4 | Wetterfoto per Tastatur | Nach Enter auf dem Kamera-Knopf und nach dem Laden des Fotos liegt der Fokus auf der Seite (`BODY`); erst der nächste Tab landet auf „Fertig“ | stört | `app.js` `studioAuf` (Fokus erst nach `neuesFoto()` gesetzt, fiel beim Neuzeichnen weg) | Fokus auf „Fertig“ setzen und nach dem Neuzeichnen zurückholen | behoben in 477aab9 |
| 5 | Mehr, Darstellung | Hinweis „Hell und Dunkel folgen deinem iPhone.“ steht auch am Mac | klein | `app.js` renderMehr | „deinem Gerät“ | behoben in 477aab9 |
| 6 | Mehr, Wetterfoto | Die Auswahlschalter „Wo sitzt der Wetterfoto-Knopf?“ (5 Möglichkeiten), „Platz“ (5) und „Aussehen“ (3) brechen in zwei Reihen um, die letzte steht mittig und wirkt verrutscht | klein | `390-02-mehr-voll.png` | Auswahl als Liste mit Haken oder zwei saubere Reihen | offen: Umbau über den Fund hinaus, braucht eine Gestaltungsentscheidung |
| 7 | Mehr, „Meteogramm und Karten immer im Vollbild“ | Der Schalter sieht aus wie ein Kästchen, die Schalter im Studio sind grün und rund. Versuch mit dem Safari-Attribut `switch` ließ sich im Prüfwerkzeug nicht beurteilen (zeichnet dort kein iOS-Aussehen) und wurde zurückgenommen | klein | `390-40-nach-schalter.png` | Auf dem iPhone ausprobieren oder eigenen Schalter in CSS bauen | offen: nur auf dem iPhone beurteilbar |
| 8 | Mac, Start | Aktuell-Kachel und 8-Tage-Liste laufen über 1060 px; zwischen „Tag“ und „Max / Min“ klaffen 300 px Leere | klein | `1280-01-start.png` | Inhalt der großen Kacheln auf lesbare Breite begrenzen | offen: Mac ist Nebensache, Layout-Entscheidung |
| 9 | Kopf und Mehr | „WeddaApp“ steht doppelt untereinander (Kopfzeile und Titel der Seite) | klein | `390-02-mehr.png` | Vorgabe aus `CLAUDE.md` („oben der App-Name als Titel“); hinnehmen | offen: so gewollt |
| 10 | Nach Ortswahl in der Suche und nach „Karte öffnen“ / Radar-Kachel | Der gedrückte Knopf verschwindet mit seinem Reiter, der Fokus liegt auf der Seite (`BODY`); der nächste Tab springt in die Tab-Leiste und überspringt den neuen Inhalt. (Beim Wechsel über die Reiter-Knöpfe selbst bleibt der Fokus richtig.) | stört | `app.js` `ortWaehlen`, Radar-Klick; Test 5 | Fokus auf den neuen Reiter setzen (`tabindex="-1"`, `focus({preventScroll:true})`) | behoben im Folgecommit |

Zählung: schwer 1 (1) · stört 3 (3, 4, 10) · klein 6 (2, 5, 6, 7, 8, 9). Behoben: 6 (1–5, 10), offen: 4 (6–9, alle klein, Gründe in der Tabelle). Der Test prüft jetzt jeden Text im Meteogramm (gezeichnete Größe, in allen 8 Fällen) und den Kontrast gegen den echten Pixel-Untergrund (Proben je Klasse, 390 px hell/dunkel, normal/Vollbild).

### Studio-Funde (für die Quelle `Kamera Konfigurator/src/`)

Hier nicht behoben, `lib/kamera-studio/` bleibt unverändert.

| Nr. | Wo | Was | Schwere | Beleg | Vorschlag |
|---|---|---|---|---|---|
| S1 | Galerie-Hinweis | „Nur auf diesem iPhone gespeichert.“ steht auch am Mac | klein | `lib/kamera-studio/ks-studio.js:121` | „auf diesem Gerät“ |
| S2 | Speicher-Hinweis in den Einstellungen | „… mehr Speicher auf diesem iPhone“ (gleiche Frage) | klein | `ks-studio.js:1856` | „auf diesem Gerät“ |
| S3 | Mac, Vorlagen-Spalte | Die Vorlagen-Reihen sind unten abgeschnitten (nur zweireihig sichtbar, dritte Reihe halb); nichts zeigt, dass man scrollen kann | klein | `1280-20-foto.png` | Rest-Rand lassen oder Spalte als Raster mit sichtbarem Scroll-Hinweis |
| S4 | Teilen-Namen | Knopf „Teilen“ (groß), Link „Teilen-Optionen“ und im Blatt wieder „Teilen“ – dreimal das Wort für zwei Wege (Teilen sofort / Dateiart und Größe) | klein | `390-11-studio-foto.png`, `390-23-senden.png` | „Teilen-Optionen“ in „Dateiart und Größe“ umbenennen |

---

## 3. Was gut ist

- Start, Graphs, Rad/Sat und Mehr in 390 px und 1280 px ohne seitliches Scrollen, ohne Tippfläche unter 44 px (außer Fund 3), hell wie dunkel.
- Ortswechsel: ein Tipp, sofort neuer Ort, automatisch in „Meine Orte“; Fokus steht beim Suchen schon im Feld.
- Sterne mit klaren Namen („ist Favorit“) und Favoriten oben.
- Vollbild: Blatt über allem, Esc/„Fertig“/Zurück, Fokus kehrt zurück; „immer im Vollbild“ führt über „Fertig“ zum vorherigen Reiter.
- Studio: Einfach | Profi umschaltbar, Blätter erklären sich (Dateiart, Größe, Dateiname mit Ort und Zeit, „GPS-Standort … entfernt“), Esc stufenweise, Fokus kreist im Blatt, Fokus kehrt zum Kamera-Knopf zurück.
- 130 % Schrift: alles bricht um, nichts abgeschnitten.
- Keine Konsolenfehler.

---

## 4. Nicht geprüft

- Echte Kamera (Aufnahme, Live-Sucher), System-Teilen-Blatt, „Sichern“ in Fotos, „Kopieren“ in die Zwischenablage, „Einfügen“ aus Zwischenablage, Freistellen in Apple Fotos.
- Glas der Tab-Leiste (70 % Weiß mit Weichzeichner): im Prüfwerkzeug scheint der Inhalt darunter scharf durch (z. B. Fußzeile unter der Leiste, `390-02-graphs.png`); ob Safari auf dem iPhone den Inhalt wirklich weichzeichnet und die Beschriftung lesbar bleibt, nur auf dem iPhone prüfbar.
- Beschriftungen auf den Kartenbildern (Datum „Mi. 21.10. 22:00“, Quelle, Hinweis): liegen auf Kartenkacheln, die hier gesperrt waren; Kontrast dort nicht messbar (wirkt wegen Schatten lesbar).
- Haptik, Geräte-Schriftgröße (nur CSS-Zoom 130 %), Querformat, Safe Areas auf echtem iPhone, Offline-Zustand, Mein Standort (GPS), Radar-Abspielen mit echten Bildern, Tastatur in Chromium/Firefox.
- Meteogramm-Tastatur und Wischen/Zoomen wurden nur angesehen, nicht bedient.
