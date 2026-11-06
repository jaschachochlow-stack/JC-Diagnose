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
Berichte anderer Diagnosegeräte (Launch X431 getestet; Autel, Bosch, Foxwell u. a. über allgemeine Texterkennung) per PDF, TXT, CSV, HTML oder eingefügtem Text. Liest Fahrzeugdaten, Codes (auch mit Fehlerart-Suffix wie B16DF-15), Zustand und Beschreibung, zeigt das Gesamtbild und startet die geführte Diagnose. PDF-Lesen offline mit pdf.js. Fotos/Scans (OCR) noch nicht.
