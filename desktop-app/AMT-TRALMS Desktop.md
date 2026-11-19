# AMT-TRALMS Desktop

AMT-TRALMS now has a native Windows desktop edition. It opens in a Tkinter application window and does not open a browser.

## Open the app

Double-click `Open AMT-TRALMS Desktop.bat` in this folder. You can also run `python app.py` from this folder. Python 3 with Tkinter is required.

## Local data

The desktop app stores its records in `amt_tralms_desktop.db` beside `app.py`. On the first launch it imports the Base44 snapshot from the sibling `Browser Offline/base44-data.json`; the import runs once. The older `tool_room.db` prototype is kept in `Archive` and left untouched. Use the app's **Back up data** button regularly.

## Included workflows

Inventory and borrower management, borrow requests, scanned release queue, loan returns, damage/loss handling, maintenance, calibration, CSV reports, audit history, database backup and restore.

The desktop app is a local single-computer system. It does not sync to Base44 or provide online sign-in. Asset tags can be entered with a keyboard-wedge USB scanner. Printed labels show the tag as text; this edition does not generate QR images.
