# AMT-TRALMS

Private project archive for the AMT-TRALMS prototype.

Download `AMT-TRALMS-source-and-data.zip` and extract it to access:

- `base44-source/` — original Base44 React/Vite prototype source.
- `offline-app/` — standalone browser edition and its `base44-data.json` imported records.
- `desktop-app/` — desktop edition and its SQLite data file.

## Data and privacy

This bundle includes real application data and may contain personal borrower information. Keep this repository **private** and only share it with people authorized to see those records.

The offline JSON export contains 2 borrower records and 1 loan record. The local SQLite database copies are included in the bundle.

## Run the apps

See `offline-app/README.md` for the offline browser edition. On Windows, run `desktop-app/Open AMT-TRALMS Desktop.bat` for the desktop edition after extracting the archive.

The Base44 source may require network access and credentials to connect to the live Base44 service. The offline edition runs separately.
