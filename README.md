# AMT-TRALMS

Prototype source and local editions of the AMT-TRALMS application.

## Contents

- `base44-source/` — original Base44 React/Vite prototype source.
- `offline-app/` — standalone browser edition and its `base44-data.json` imported records.
- `desktop-app/` — desktop edition and its SQLite data file.

## Data and privacy

The included records are real application data and may contain personal borrower information. Keep this repository **private**. Do not publish it publicly or share access with anyone who should not see those records.

The offline JSON export currently contains 2 borrower records and 1 loan record. The database files are included as copied from the local vault.

## Run the offline edition

See `offline-app/README.md` for its launch instructions.

## Run the desktop edition

On Windows, launch `desktop-app/Open AMT-TRALMS Desktop.bat`.

## Base44 prototype source

See `base44-source/README.md` for project setup information. The live Base44 service may require network access and credentials; the local offline edition is separate.
