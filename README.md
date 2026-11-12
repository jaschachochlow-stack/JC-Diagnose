# JC Diagnose

Kfz-Diagnose-Web-App (Deutsch / Русский) für den eigenen Gebrauch:
Nachschlagewerk, Fehlercodes, geführte Diagnose, OBD (ELM327 über Bluetooth LE / USB), Soll/Ist-Messprotokoll mit Fotos,
Berichte, Fahrzeugakte und Oszillogramm-Referenzen.

**App öffnen:** https://jaschachochlow-stack.github.io/JC-Diagnose/

- Läuft im Browser, installierbar als App (Chrome → Menü → „App installieren“), funktioniert offline.
- Bluetooth (OBD) nur in Chrome/Edge über https.
- Messungen, Berichte und Fotos bleiben lokal auf dem Gerät.

Richtwerte ohne Gewähr – Herstellerdaten gehen vor.


## Apps (0.10.0)
- **Android-App** (Capacitor): Bluetooth LE, klassisches Bluetooth (SPP) und WLAN-TCP für ELM327. Download: Release „apk“ → JC-Diagnose.apk.
- **Windows-App** (Electron, portable .exe): Bluetooth LE, COM-Port (USB oder in Windows gekoppeltes Bluetooth) und WLAN-TCP. Download: Release „windows“ → JC-Diagnose-Windows.exe.
- Web/PWA (GitHub Pages): Bluetooth LE und USB/COM in Chrome/Edge; kein klassisches Bluetooth, kein WLAN-TCP.

## Bericht-Import (0.11.0)
Berichte anderer Diagnosegeräte (Launch X431 getestet; Autel, Bosch, Foxwell u. a. über allgemeine Texterkennung) per PDF, TXT, CSV, HTML oder eingefügtem Text. Liest Fahrzeugdaten, Codes (auch mit Fehlerart-Suffix wie B16DF-15), Zustand und Beschreibung, zeigt das Gesamtbild und startet die geführte Diagnose. PDF-Lesen offline mit pdf.js. Fotos/Scans: siehe unten.

## Foto-/Scan-Erkennung (0.11.1)
Fotos (Kamera oder Galerie), Screenshots und eingescannte PDFs werden offline per Tesseract (WebAssembly, Sprachen deu/eng/rus, Ordner `ocr/`, ca. 15 MB) gelesen. Schräg fotografierte Berichte werden über die erkannten Zeilen geradegerechnet. Die Erkennung ist auf Bildern naturgemäß unsicherer als bei PDF mit Textebene: Codes, Zustand und Beschreibung immer mit dem Bild vergleichen (typische Verwechslungen 0/O, 1/I, 8/B, 5/S werden in Codes automatisch korrigiert). Windows-App lädt die Oberfläche jetzt über ein eigenes `app://`-Schema, damit Web-Worker und WebAssembly zuverlässig laufen. Android: Kamera-Berechtigung für die Fotoaufnahme.

## Berichte senden (0.14.0)
- „Senden“ öffnet ein Fenster: Teilen (PDF + Anhänge, alle Apps), WhatsApp (an die Kundennummer), E-Mail, SMS, Telegram, PDF, Bild (Screenshot des Berichts), Text kopieren, Textdatei, Drucken (am PC).
- Der Bericht wird als PDF/Bild selbst erzeugt (inkl. Diagramm der Live-Werte und Fotos), auch mit kyrillischer Schrift. Neues Kundenfeld „E-Mail“.
- Android nutzt dafür @capacitor/share und @capacitor/filesystem.

## Cockpit-Design und Vergleichsdiagramm (0.13.0)
- Neues Standard-Aussehen „Cockpit“: dunkel, Kacheln, Amber-Akzent; auf dem Handy schwebende Leiste unten (Start, OBD, Nachschlagewerk, Berichte, Mehr) statt doppelter Navigation. Alte Aussehen bleiben wählbar.
- Live-Daten: neuer Modus „Vergleich“ – alle gewählten Werte in einem farbigen Diagramm (je Linie auf 0–100 % normiert), Legendenkarten mit aktuellem Wert, Finger auf dem Diagramm zeigt alle Werte zum gleichen Zeitpunkt, Karte antippen blendet Linie aus, Fenster 30 s / 60 s / Alles. Das Vergleichsdiagramm steht auch im OBD-Bericht.

## Anhänge, Diagramme im Bericht, Zurück-Taste, Löschen (0.12.0)
- Live-Werte werden im OBD-Bericht als Diagramm gespeichert (mit min/max/Ø).
- Jeder Bericht (OBD und geführte Diagnose, auch archiviert) hat Notiz und Anhänge: Fotos, Screenshots, PDF. Teilen sendet die Dateien mit; Backup enthält sie.
- Zurück-Taste: vorheriges Fenster; an der Startseite zweimal drücken zum Beenden (Warnung DE/RU). Android über @capacitor/app, installierte PWA über Wächter-Eintrag.
- „Bericht löschen“ (zweistufig) entfernt Bericht samt Anhängen.

## OBD-Berichte, Ergebnisfenster, Live-Fenster (0.11.9)
- Jede OBD-Auslesung wird automatisch als Bericht im Archiv gespeichert: Fahrzeug, VIN, Kilometerstand, Adapter, Protokoll, Fehler (auch „keine Fehler“), gelöschter Fehlerspeicher und zuletzt gelesene Live-Werte. Fahrzeug- und Kundendaten sind im Bericht nachträglich editierbar.
- Bericht senden: Teilen-Dialog des Geräts (Mail, Messenger …), sonst E-Mail-Entwurf; außerdem Text kopieren und Drucken/PDF.
- Nach „Fehler lesen“ erscheint das Ergebnis sofort als Fenster von unten (Codes kompakt, Buttons: Geführte Diagnose, Bericht senden, Bericht öffnen).
- „Live-Daten“ öffnet ein eigenes Fenster: erst Werte wählen, dann Anzeige mit Umschalter Zahlen/Diagramme.
- Beschriftungen automatisch auf Überlauf geprüft (DE/RU, 360–1280 px).


## 0.15.2 – Namen für alle Marken

- Namenserkennung ohne Markentabelle: aus dem genormten OBD-Namen (Modus 09 PID 0A) und dem Systemnamen (UDS F197) erkennt die App Airbag, ABS/ESP, Getriebe, Motor, Kombiinstrument, Gateway, Lenkung, Klima, Fahrwerk, Tür, Sitz usw. bei jeder Marke.
- Zusätzliche Adresstabellen: Ford/Lincoln (7E0, 7E1, 760 ABS, 720 IPC, 726 BCM) und Hyundai/Kia/Genesis (7E0, 7E1, 7A0 BCM, 7D1 ABS/ESP); VAG und PSA wie bisher.
- Mehr Kennungen pro Steuergerät (Zulieferer, Software-/Hardware-Version).
- Grenzen: BMW/Mini (erweiterte Adressierung) und Hersteller mit 29-Bit-Adressen werden nicht gefunden.

## 0.15.1 – Alle Steuergeräte in einem Schritt

- Ein Knopf: sucht alle Steuergeräte, liest Kennungen und den kompletten Fehlerspeicher aller Steuergeräte und benennt sie automatisch (Motor, Getriebe, ABS/ESP, Airbag, Kombiinstrument, Fahrwerk, Klima, Lenkung, Türen …).
- Namenstabellen: VAG (VW, Audi, Seat, Škoda, Cupra, Porsche; ca. 80 Module, Quelle ODIS-IDs, github.com/ConnorHowell/vag-uds-ids) und Peugeot/Citroën/DS (Quelle github.com/ludwig-v/arduino-psa-diag). Marke automatisch aus der VIN oder von Hand gewählt; bei anderen Marken nur Standard-Namen (7E0 Motor, 7E1 Getriebe) plus eigene Namen.
- Optionale „Tiefe Suche" (0x500–0x6FF).

## 0.15.0 – Alle Steuergeräte

- Neuer Bereich OBD → „Alle Steuergeräte": sucht Steuergeräte am CAN-Bus (11 Bit, IDs 0x700–0x7E7), liest Kennungen (22 F1xx), liest und löscht den Fehlerspeicher jedes Steuergeräts (UDS 19 02 / 14, KWP-Rückfall 18).
- Rohwerte: beliebige Datenkennungen (22 xxxx) lesen, Bereich nach antwortenden Kennungen durchsuchen, Live-Liste mit Min/Max. Herstellerwerte sind nicht genormt und werden ohne Einheit angezeigt.
- Namen sind frei wählbar (nur 7E0 Motor, 7E1 Getriebe sind genormt). Ergebnisse landen im OBD-Bericht, im Text und in der Senden-Funktion.
- Grenzen: nur CAN 11 Bit/UDS, ELM327-Klone sind langsam, Herstellerprotokolle und gesperrte Gateways antworten evtl. nicht.

