# AMT-TRALMS Offline

A local browser app for inventory, borrowers, student requests, scanned releases, returns, maintenance/calibration, transactions, reports, printing, and local backups. It runs without Base44, an account, an internet connection, npm, or downloaded libraries.

## Start

1. Keep the `AMT-TRALMS Offline` folder on the computer.
2. Double-click `start.bat`.
3. The app opens at `http://127.0.0.1:4178`. Keep the black server window open while using it; close that window to stop the app.

Node.js is required to run the small built-in local web server. It serves only this folder and listens on this device's loopback address. No outside network service is contacted.

## Local data

Records are stored in this browser profile's IndexedDB database (`amt-tralms-offline`). On its first run, an empty local database is populated from `base44-data.json`, a one-time export of the current Base44 records. This export contains borrower details, so keep the folder on a device you trust. The older `tool_room.db` prototype is not imported. Use **Export local backup** regularly to save a JSON backup. **Import backup** replaces the current local records with the selected AMT-TRALMS backup.

Browser storage is local to this computer and browser profile. Clearing browser site data can erase it, so keep backups somewhere safe. Multiple devices or browser profiles do not share records.

## Offline feature notes

- Keyboard-wedge USB scanners work by typing their scanned tag into the focused field. Camera QR scanning uses the browser's built-in `BarcodeDetector` where available; unsupported browsers can use a scanner or type the code.
- Asset labels print the asset tag as text. This version does not generate QR images; borrower QR payload text can be copied for use with an offline label tool.
- The local copy starts with a local administrator profile and has no password or multi-user sign-in. Anyone with access to this computer/browser profile can use its records.
- The implementation preserves the Base44 app's entity fields and main workflows, but it is an independent local edition. Changes made here never sync back to Base44.

## Files

- `index.html`, `app.js`, `styles.css`: offline browser interface and workflows.
- `db.js`: local IndexedDB persistence and backup support.
- `server.cjs`, `start.bat`: built-in loopback-only launch server.
