"""AMT-TRALMS native offline desktop app.

Run: python app.py
Uses only Python's standard library and a local SQLite database.
"""
from __future__ import annotations

import csv
import json
import sqlite3
import tkinter as tk
from datetime import date, datetime, timedelta
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from uuid import uuid4

APP_DIR = Path(__file__).resolve().parent
DB_PATH = APP_DIR / "amt_tralms_desktop.db"
MIGRATION_PATH = APP_DIR.parent / "Browser Offline" / "base44-data.json"
NOW = lambda: datetime.now().astimezone().isoformat(timespec="seconds")
TODAY = lambda: date.today().isoformat()

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, asset_tag TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 category TEXT DEFAULT '', brand_model TEXT DEFAULT '', serial_no TEXT DEFAULT '',
 location TEXT DEFAULT '', unit_cost REAL DEFAULT 0, condition TEXT DEFAULT 'Good',
 status TEXT DEFAULT 'Active', is_consumable INTEGER DEFAULT 0, min_stock REAL DEFAULT 0,
 qty_total REAL DEFAULT 1, qty_available REAL DEFAULT 1,
 calibration_required INTEGER DEFAULT 0, calibration_due TEXT, created_date TEXT, updated_date TEXT
);
CREATE TABLE IF NOT EXISTS borrowers (
 id TEXT PRIMARY KEY, full_name TEXT NOT NULL, borrower_type TEXT DEFAULT 'Student',
 id_number TEXT NOT NULL UNIQUE, rfid_tag TEXT, course TEXT, section TEXT,
 course_section TEXT, email TEXT, contact TEXT, restrictions TEXT,
 status TEXT DEFAULT 'Active', created_date TEXT, updated_date TEXT
);
CREATE TABLE IF NOT EXISTS requests (
 id TEXT PRIMARY KEY, request_ref TEXT NOT NULL, borrower_id TEXT NOT NULL,
 borrower_name TEXT, id_number TEXT, course_section TEXT, contact TEXT, item_id TEXT NOT NULL,
 asset_tag TEXT, item_name TEXT, qty REAL NOT NULL, released_qty REAL DEFAULT 0,
 purpose TEXT, needed_until TEXT, requested_at TEXT, expires_at TEXT, started_at TEXT,
 released_at TEXT, toolkeeper TEXT, status TEXT DEFAULT 'Pending Release', staff_note TEXT,
 created_date TEXT, updated_date TEXT
);
CREATE TABLE IF NOT EXISTS loans (
 id TEXT PRIMARY KEY, trans_no TEXT, request_ref TEXT, borrower_id TEXT, borrower_name TEXT,
 borrower_id_number TEXT, course_section TEXT, purpose TEXT, item_id TEXT, asset_tag TEXT,
 item_name TEXT, qty_issued REAL NOT NULL, qty_returned REAL DEFAULT 0,
 issued_condition TEXT, returned_condition TEXT, issued_at TEXT, expected_return_at TEXT,
 returned_at TEXT, issued_by TEXT, returned_by TEXT, return_requested INTEGER DEFAULT 0,
 notes TEXT, status TEXT DEFAULT 'Open', created_date TEXT, updated_date TEXT
);
CREATE TABLE IF NOT EXISTS maintenance_logs (
 id TEXT PRIMARY KEY, item_id TEXT, asset_tag TEXT, item_name TEXT, type TEXT DEFAULT 'Maintenance',
 start_date TEXT, findings TEXT, action_taken TEXT, cost REAL DEFAULT 0, status TEXT DEFAULT 'Open',
 created_date TEXT, updated_date TEXT
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, at TEXT, action TEXT, request_ref TEXT, entity_type TEXT, entity_id TEXT,
 detail TEXT, actor TEXT, outcome TEXT DEFAULT 'ok', created_date TEXT, updated_date TEXT
);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS idx_requests_ref ON requests(request_ref);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
"""

class AMTTralmsApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("AMT-TRALMS | WCC ATC North Manila")
        self.geometry("1360x820")
        self.minsize(1050, 680)
        self.configure(bg="#f3f6fa")
        self.db = sqlite3.connect(DB_PATH)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.commit()
        self._seed_base44_once()
        self._style()
        self._build()
        self.expire_requests()
        self.refresh_all()
        self.after(1000,self.refresh_queue_clock)
        self.protocol("WM_DELETE_WINDOW", self.close)

    def _seed_base44_once(self):
        exists = self.db.execute("SELECT value FROM app_meta WHERE key='base44_import_v1'").fetchone()
        if exists:
            return
        try:
            data = json.loads(MIGRATION_PATH.read_text(encoding="utf-8"))["data"]
        except (OSError, ValueError, KeyError, TypeError):
            data = {}
        mapping = {
            "Item": "items", "Borrower": "borrowers", "BorrowRequest": "requests",
            "Loan": "loans", "MaintenanceLog": "maintenance_logs", "AuditLog": "audit_logs",
        }
        with self.db:
            for source, table in mapping.items():
                for record in data.get(source, []):
                    self._insert_record(table, record)
            self.db.execute("INSERT OR REPLACE INTO app_meta(key,value) VALUES('base44_import_v1','done')")

    @staticmethod
    def _insert_record(table, record):
        allowed = {
            "items": {"id","asset_tag","name","category","brand_model","serial_no","location","unit_cost","condition","status","is_consumable","min_stock","qty_total","qty_available","calibration_required","calibration_due","created_date","updated_date"},
            "borrowers": {"id","full_name","borrower_type","id_number","rfid_tag","course","section","course_section","email","contact","restrictions","status","created_date","updated_date"},
            "requests": {"id","request_ref","borrower_id","borrower_name","id_number","course_section","contact","item_id","asset_tag","item_name","qty","released_qty","purpose","needed_until","requested_at","expires_at","started_at","released_at","toolkeeper","status","staff_note","created_date","updated_date"},
            "loans": {"id","trans_no","request_ref","borrower_id","borrower_name","borrower_id_number","course_section","purpose","item_id","asset_tag","item_name","qty_issued","qty_returned","issued_condition","returned_condition","issued_at","expected_return_at","returned_at","issued_by","returned_by","return_requested","notes","status","created_date","updated_date"},
            "maintenance_logs": {"id","item_id","asset_tag","item_name","type","start_date","findings","action_taken","cost","status","created_date","updated_date"},
            "audit_logs": {"id","at","action","request_ref","entity_type","entity_id","detail","actor","outcome","created_date","updated_date"},
        }[table]
        values = {k: v for k, v in record.items() if k in allowed}
        values.setdefault("id", str(uuid4()))
        columns = list(values)
        placeholders = ",".join("?" for _ in columns)
        names = ",".join('"' + c + '"' for c in columns)
        conn = sqlite3.connect(DB_PATH)
        conn.execute(f'INSERT OR IGNORE INTO "{table}" ({names}) VALUES ({placeholders})', [values[c] for c in columns])
        conn.commit()
        conn.close()

    def _style(self):
        style = ttk.Style(self)
        try: style.theme_use("clam")
        except tk.TclError: pass
        style.configure("TFrame", background="#f3f6fa")
        style.configure("Panel.TFrame", background="white")
        style.configure("TLabel", background="#f3f6fa", foreground="#1c2c45", font=("Segoe UI", 10))
        style.configure("Title.TLabel", font=("Segoe UI", 21, "bold"), foreground="#14306b")
        style.configure("Sub.TLabel", foreground="#66768d")
        style.configure("TButton", font=("Segoe UI", 9), padding=(10, 7))
        style.configure("Accent.TButton", background="#14306b", foreground="white", font=("Segoe UI", 9, "bold"))
        style.map("Accent.TButton", background=[("active", "#0f2553")])
        style.configure("Treeview", rowheight=27, font=("Segoe UI", 9), background="white", fieldbackground="white")
        style.configure("Treeview.Heading", font=("Segoe UI", 9, "bold"), background="#14306b", foreground="white")
        style.map("Treeview", background=[("selected", "#dce8fa")], foreground=[("selected", "#14284a")])
        style.configure("TNotebook", background="#f3f6fa", borderwidth=0)
        style.configure("TNotebook.Tab", padding=(15, 9), font=("Segoe UI", 9, "bold"))

    def _build(self):
        header = tk.Frame(self, bg="#14306b", padx=22, pady=13)
        header.pack(fill="x")
        tk.Label(header, text="AMT-TRALMS", bg="#14306b", fg="white", font=("Segoe UI", 17, "bold")).pack(side="left")
        tk.Label(header, text="WCC ATC North Manila · Aircraft Maintenance Technology", bg="#14306b", fg="#dce7fa", font=("Segoe UI", 10)).pack(side="left", padx=18, pady=(5,0))
        tk.Label(header, text="OFFLINE DESKTOP", bg="#244477", fg="white", padx=10, pady=5, font=("Segoe UI", 8, "bold")).pack(side="right")
        self.tabs = ttk.Notebook(self)
        self.tabs.pack(fill="both", expand=True, padx=16, pady=13)
        self.pages = {}
        for key, label in [
            ("dashboard","Dashboard"), ("inventory","Inventory"), ("borrowers","Borrowers"),
            ("requests","Borrow Requests"), ("counter","Release & Return"),
            ("maintenance","Maintenance & Calibration"), ("reports","Reports & Audit"),
        ]:
            frame = ttk.Frame(self.tabs, padding=13)
            self.tabs.add(frame, text=label)
            self.pages[key] = frame
        self._build_dashboard()
        self._build_inventory()
        self._build_borrowers()
        self._build_requests()
        self._build_counter()
        self._build_maintenance()
        self._build_reports()
        footer = tk.Frame(self, bg="#e8edf4", padx=14, pady=6)
        footer.pack(fill="x")
        tk.Label(footer, text=f"Local data: {DB_PATH.name} · No Base44 account or internet required", bg="#e8edf4", fg="#53637a", font=("Segoe UI", 8)).pack(side="left")
        ttk.Button(footer, text="Back up data", command=self.backup).pack(side="right", padx=3)
        ttk.Button(footer, text="Restore backup", command=self.restore).pack(side="right", padx=3)

    def _page_title(self, parent, title, subtitle=""):
        bar = ttk.Frame(parent)
        bar.pack(fill="x", pady=(0, 12))
        ttk.Label(bar, text=title, style="Title.TLabel").pack(side="left")
        if subtitle: ttk.Label(bar, text=subtitle, style="Sub.TLabel").pack(side="left", padx=13, pady=(8,0))

    def _tree(self, parent, columns, headings, widths=None, height=15):
        wrap = ttk.Frame(parent)
        wrap.pack(fill="both", expand=True, pady=(6,0))
        tree = ttk.Treeview(wrap, columns=columns, show="headings", selectmode="browse", height=height)
        for i, (col, heading) in enumerate(zip(columns, headings)):
            tree.heading(col, text=heading)
            tree.column(col, width=widths[i] if widths else 130, minwidth=65, anchor="w")
        sy = ttk.Scrollbar(wrap, orient="vertical", command=tree.yview)
        sx = ttk.Scrollbar(wrap, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=sy.set, xscrollcommand=sx.set)
        wrap.rowconfigure(0, weight=1); wrap.columnconfigure(0, weight=1)
        tree.grid(row=0,column=0,sticky="nsew"); sy.grid(row=0,column=1,sticky="ns"); sx.grid(row=1,column=0,sticky="ew")
        return tree

    def _toolbar(self, parent, title, actions):
        bar = ttk.Frame(parent)
        bar.pack(fill="x")
        ttk.Label(bar, text=title, style="Title.TLabel").pack(side="left")
        for label, command in reversed(actions):
            ttk.Button(bar, text=label, command=command, style="Accent.TButton" if label.startswith("＋") else "TButton").pack(side="right", padx=3)

    def _build_dashboard(self):
        p = self.pages["dashboard"]
        self._page_title(p, "Tool room overview", "A local snapshot of inventory and circulation")
        self.cards = ttk.Frame(p); self.cards.pack(fill="x", pady=8)
        ttk.Label(p, text="Open loans", font=("Segoe UI", 12, "bold")).pack(anchor="w", pady=(12,0))
        self.open_tree = self._tree(p, ("tag","item","borrower","issued","due","status"),
            ("Asset tag","Tool","Borrower","Issued","Due","Status"), (130,220,220,170,170,110), 12)

    def _build_inventory(self):
        p = self.pages["inventory"]
        self._toolbar(p, "Inventory", [("＋ Add item", self.add_item),("Edit selected", self.edit_item),("Record condition", self.record_condition),("Retire", self.retire_item),("Print label", self.label_item)])
        search = ttk.Frame(p); search.pack(fill="x", pady=8)
        ttk.Label(search, text="Search").pack(side="left")
        self.item_search = tk.StringVar()
        entry = ttk.Entry(search, textvariable=self.item_search, width=38); entry.pack(side="left", padx=7)
        entry.bind("<KeyRelease>", lambda _e: self.refresh_items())
        self.item_tree = self._tree(p, ("tag","name","category","location","avail","condition","status","calibration"),
            ("Asset tag","Item","Category","Location","Available / Total","Condition","Status","Calibration due"), (125,220,130,130,110,125,140,140), 18)
        self.item_tree.bind("<Double-1>", lambda _e: self.edit_item())

    def _build_borrowers(self):
        p = self.pages["borrowers"]
        self._toolbar(p, "Borrowers", [("＋ Add borrower", self.add_borrower),("Edit selected", self.edit_borrower),("Toggle active", self.toggle_borrower)])
        self.borrower_search = tk.StringVar()
        bar = ttk.Frame(p); bar.pack(fill="x", pady=8)
        ttk.Label(bar,text="Search").pack(side="left")
        entry=ttk.Entry(bar,textvariable=self.borrower_search,width=38);entry.pack(side="left",padx=7)
        entry.bind("<KeyRelease>",lambda _e:self.refresh_borrowers())
        self.borrower_tree=self._tree(p,("name","type","idno","course","contact","status"),
            ("Name","Type","ID number","Course / Section","Contact","Status"),(230,120,130,170,160,100),18)
        self.borrower_tree.bind("<Double-1>",lambda _e:self.edit_borrower())

    def _build_requests(self):
        p=self.pages["requests"]
        self._toolbar(p,"Borrow requests",[("＋ New request",self.new_request),("Cancel request",self.cancel_request)])
        ttk.Label(p,text="A request is a five-minute pre-borrow queue entry. Stock changes only after a toolkeeper confirms the physical release.",style="Sub.TLabel").pack(anchor="w",pady=(4,8))
        self.request_tree=self._tree(p,("ref","requested","borrower","idno","items","purpose","status","expires"),
            ("Request ref","Requested","Borrower","ID number","Requested items","Purpose","Status","Expires"),(150,155,190,130,240,180,150,155),18)

    def _build_counter(self):
        p=self.pages["counter"]
        self._page_title(p,"Tool release and return counter","Type or scan asset tags; USB keyboard-wedge scanners work offline")
        split=ttk.Panedwindow(p,orient="horizontal");split.pack(fill="both",expand=True)
        left=ttk.Frame(split);right=ttk.Frame(split,padding=(12,0,0,0))
        split.add(left,weight=3);split.add(right,weight=2)
        ttk.Label(left,text="Open request queue",font=("Segoe UI",12,"bold")).pack(anchor="w")
        self.queue_tree=self._tree(left,("ref","borrower","idno","items","status","expires"),
            ("Request","Borrower","ID","Items","Status","Time left"),(145,165,100,200,140,100),12)
        self.queue_tree.bind("<<TreeviewSelect>>",lambda _e:self.load_request())
        ttk.Label(right,text="Selected request",font=("Segoe UI",13,"bold")).pack(anchor="w")
        self.counter_info=ttk.Label(right,text="Choose a request from the queue.",justify="left",style="Sub.TLabel")
        self.counter_info.pack(fill="x",pady=8)
        scan=ttk.Frame(right);scan.pack(fill="x",pady=5)
        ttk.Label(scan,text="Scan asset tag").pack(anchor="w")
        self.scan_var=tk.StringVar()
        scan_entry=ttk.Entry(scan,textvariable=self.scan_var);scan_entry.pack(side="left",fill="x",expand=True)
        scan_entry.bind("<Return>",lambda _e:self.stage_scan())
        ttk.Button(scan,text="Add",command=self.stage_scan).pack(side="left",padx=4)
        ttk.Label(right,text="Staged physical scans",font=("Segoe UI",11,"bold")).pack(anchor="w",pady=(9,0))
        self.staged_tree=self._tree(right,("tag","name","line"),("Asset tag","Item","Request line"),(120,180,70),7)
        actions=ttk.Frame(right);actions.pack(fill="x",pady=8)
        ttk.Button(actions,text="Remove scan",command=self.remove_scan).pack(side="left")
        ttk.Button(actions,text="Clear",command=self.clear_scans).pack(side="left",padx=4)
        ttk.Button(actions,text="Confirm release & print slip",command=self.commit_release,style="Accent.TButton").pack(side="right")
        self.due_var=tk.StringVar(value=(date.today()+timedelta(days=1)).isoformat()+"T17:00")
        due=ttk.Frame(right);due.pack(fill="x",pady=5)
        ttk.Label(due,text="Due date/time (YYYY-MM-DDTHH:MM)").pack(anchor="w")
        ttk.Entry(due,textvariable=self.due_var).pack(fill="x")
        ttk.Label(p,text="Returns can be recorded from the Transactions tab in Reports & Audit.",style="Sub.TLabel").pack(anchor="w",pady=(8,0))

    def _build_maintenance(self):
        p=self.pages["maintenance"]
        self._toolbar(p,"Maintenance & calibration",[("＋ Log work",self.log_maintenance),("Complete selected",self.complete_maintenance),("Record calibration",self.record_calibration)])
        self.maint_tree=self._tree(p,("tag","item","type","date","findings","status"),
            ("Asset tag","Item","Work type","Start date","Findings","Status"),(130,220,130,130,350,110),11)
        ttk.Label(p,text="Calibration schedule",font=("Segoe UI",12,"bold")).pack(anchor="w",pady=(12,0))
        self.cal_tree=self._tree(p,("tag","item","due","state"),("Asset tag","Item","Due date","Calibration status"),(150,250,180,180),8)

    def _build_reports(self):
        p=self.pages["reports"]
        self._toolbar(p,"Transactions and audit trail",[("Export loans CSV",self.export_loans),("Export inventory CSV",self.export_inventory),("Return selected loan",self.return_loan)])
        self.loan_tree=self._tree(p,("trans","borrower","idno","tag","item","qty","issued","due","returned","status"),
            ("Trans. no.","Borrower","ID No.","Asset tag","Item","Issued / returned","Issued","Due","Returned","Status"),(150,180,110,120,190,105,165,165,165,100),12)
        ttk.Label(p,text="Recent audit activity",font=("Segoe UI",12,"bold")).pack(anchor="w",pady=(12,0))
        self.audit_tree=self._tree(p,("at","action","actor","ref","detail","outcome"),
            ("At","Action","Actor","Request","Detail","Outcome"),(165,150,150,145,420,90),7)


    def _form_dialog(self, title, fields, initial=None, width=470):
        initial = initial or {}
        win = tk.Toplevel(self)
        win.title(title); win.transient(self); win.grab_set(); win.resizable(False, False)
        body = ttk.Frame(win, padding=18); body.pack(fill="both", expand=True)
        variables = {}
        for row, spec in enumerate(fields):
            key, label = spec[0], spec[1]
            kind = spec[2] if len(spec)>2 else "text"
            choices = spec[3] if len(spec)>3 else ()
            ttk.Label(body,text=label).grid(row=row,column=0,sticky="w",padx=(0,12),pady=6)
            if kind == "check":
                var=tk.BooleanVar(value=bool(initial.get(key,False)))
                widget=ttk.Checkbutton(body,variable=var)
            elif kind == "choice":
                var=tk.StringVar(value=str(initial.get(key,"") or (choices[0] if choices else "")))
                widget=ttk.Combobox(body,textvariable=var,values=choices,state="readonly",width=36)
            elif kind == "memo":
                var=tk.StringVar(value=str(initial.get(key,"") or ""))
                widget=tk.Text(body,width=38,height=4,wrap="word")
                widget.insert("1.0",var.get())
            else:
                var=tk.StringVar(value=str(initial.get(key,"") if initial.get(key) is not None else ""))
                widget=ttk.Entry(body,textvariable=var,width=39)
            widget.grid(row=row,column=1,sticky="ew",pady=6)
            variables[key]=(kind,var,widget)
        result={}
        def save():
            for key,(kind,var,widget) in variables.items():
                result[key] = widget.get("1.0","end-1c").strip() if kind=="memo" else (var.get() if kind!="check" else int(var.get()))
            win.destroy()
        buttons=ttk.Frame(body);buttons.grid(row=len(fields),column=0,columnspan=2,sticky="e",pady=(12,0))
        ttk.Button(buttons,text="Cancel",command=win.destroy).pack(side="right",padx=(6,0))
        ttk.Button(buttons,text="Save",command=save,style="Accent.TButton").pack(side="right")
        body.columnconfigure(1,weight=1)
        win.update_idletasks()
        win.geometry(f"{max(width,win.winfo_reqwidth())}x{win.winfo_reqheight()}+{self.winfo_rootx()+80}+{self.winfo_rooty()+60}")
        self.wait_window(win)
        return result or None

    def _rows(self, sql, params=()):
        return self.db.execute(sql,params).fetchall()

    def _insert(self, table, values):
        now=NOW()
        record={**values}
        record.setdefault("id",str(uuid4()))
        record.setdefault("created_date",now)
        record["updated_date"]=now
        cols=list(record)
        q=",".join("?" for _ in cols)
        names=",".join('"'+c+'"' for c in cols)
        self.db.execute(f'INSERT INTO "{table}" ({names}) VALUES ({q})',[record[c] for c in cols])
        return record["id"]

    def _update(self, table, record_id, values):
        data={**values,"updated_date":NOW()}
        cols=list(data)
        self.db.execute(f'UPDATE "{table}" SET '+",".join('"'+c+'"=?' for c in cols)+' WHERE id=?',[data[c] for c in cols]+[record_id])

    def audit(self, action, actor="Offline administrator", ref="", entity="", entity_id="", detail="", outcome="ok"):
        try:
            with self.db:
                self._insert("audit_logs",{"at":NOW(),"action":action,"actor":actor,"request_ref":ref,
                    "entity_type":entity,"entity_id":entity_id,"detail":detail,"outcome":outcome})
        except sqlite3.Error:
            pass

    @staticmethod
    def _fill(tree, records, values):
        tree.delete(*tree.get_children())
        for record in records:
            tree.insert("", "end", iid=str(record["id"]), values=values(record))

    def refresh_all(self):
        self.expire_requests()
        self.refresh_dashboard(); self.refresh_items(); self.refresh_borrowers()
        self.refresh_requests(); self.refresh_counter(); self.refresh_maintenance()
        self.refresh_loans(); self.refresh_audit()

    def expire_requests(self):
        stale=self._rows("SELECT DISTINCT request_ref FROM requests WHERE status='Pending Release' AND expires_at IS NOT NULL AND expires_at<=?",(NOW(),))
        for row in stale:
            with self.db:
                self.db.execute("UPDATE requests SET status='Expired',updated_date=? WHERE request_ref=?",(NOW(),row["request_ref"]))
            self.audit("request_expired",actor="Counter timer",ref=row["request_ref"],entity="BorrowRequest",detail="Passed five-minute pickup window")

    def refresh_dashboard(self):
        for child in self.cards.winfo_children(): child.destroy()
        total=self.db.execute("SELECT COALESCE(SUM(qty_total),0) FROM items WHERE status!='Retired'").fetchone()[0]
        avail=self.db.execute("SELECT COALESCE(SUM(qty_available),0) FROM items WHERE status='Active'").fetchone()[0]
        open_n=self.db.execute("SELECT COUNT(*) FROM loans WHERE status IN ('Open','Partial')").fetchone()[0]
        open_qty=self.db.execute("SELECT COALESCE(SUM(qty_issued-COALESCE(qty_returned,0)),0) FROM loans WHERE status IN ('Open','Partial')").fetchone()[0]
        overdue=self.db.execute("SELECT COUNT(*) FROM loans WHERE status IN ('Open','Partial') AND expected_return_at<?",(NOW(),)).fetchone()[0]
        due=(date.today()+timedelta(days=30)).isoformat()
        calib=self.db.execute("SELECT COUNT(*) FROM items WHERE calibration_required=1 AND calibration_due<=? AND status!='Retired'",(due,)).fetchone()[0]
        maint=self.db.execute("SELECT COUNT(*) FROM items WHERE status='Under Maintenance'").fetchone()[0]
        low=self.db.execute("SELECT COUNT(*) FROM items WHERE is_consumable=1 AND qty_available<=min_stock").fetchone()[0]
        metrics=[("Available units",avail),("Registered units",total),("Open loans",f"{open_qty} · {open_n} lines"),
                 ("Overdue loans",overdue),("Calibration due ≤30 days",calib),("Under maintenance",maint),("Low stock",low)]
        for i,(label,value) in enumerate(metrics):
            card=tk.Frame(self.cards,bg="white",highlightbackground="#e0e6ee",highlightthickness=1,padx=14,pady=11)
            card.grid(row=0,column=i,sticky="ew",padx=(0,8),pady=4)
            tk.Label(card,text=label,bg="white",fg="#62728a",font=("Segoe UI",9)).pack(anchor="w")
            tk.Label(card,text=str(value),bg="white",fg="#14306b",font=("Segoe UI",18,"bold")).pack(anchor="w",pady=(4,0))
            self.cards.columnconfigure(i,weight=1)
        rows=self._rows("""SELECT l.*,i.asset_tag,i.name,b.full_name FROM loans l
            LEFT JOIN items i ON i.id=l.item_id LEFT JOIN borrowers b ON b.id=l.borrower_id
            WHERE l.status IN ('Open','Partial') ORDER BY l.issued_at DESC""")
        self._fill(self.open_tree,rows,lambda r:(r["asset_tag"] or r["asset_tag"],r["item_name"] or r["name"],r["borrower_name"] or r["full_name"],self._short_date(r["issued_at"]),self._short_date(r["expected_return_at"]),self._loan_status(r)))

    @staticmethod
    def _short_date(value):
        if not value:return "—"
        try:return datetime.fromisoformat(value.replace("Z","+00:00")).astimezone().strftime("%b %d, %Y %I:%M %p")
        except (ValueError,TypeError):return value

    @staticmethod
    def _loan_status(row):
        if row["status"] in ("Open","Partial") and row["expected_return_at"] and row["expected_return_at"]<NOW():return "Overdue"
        return row["status"]

    def refresh_items(self):
        term=self.item_search.get().strip() if hasattr(self,"item_search") else ""
        pattern="%"+term+"%"
        rows=self._rows("""SELECT i.*,CASE WHEN i.qty_available<=0 THEN 'Unavailable' ELSE 'Available' END AS availability
            FROM items i WHERE ?='' OR asset_tag LIKE ? OR name LIKE ? OR category LIKE ? OR serial_no LIKE ?
            ORDER BY asset_tag""",(term,pattern,pattern,pattern,pattern))
        self._fill(self.item_tree,rows,lambda r:(r["asset_tag"],r["name"],r["category"] or "",r["location"] or "",
            f'{r["qty_available"]:g} / {r["qty_total"]:g}',r["condition"],r["status"],r["calibration_due"] or "—"))

    def refresh_borrowers(self):
        term=self.borrower_search.get().strip() if hasattr(self,"borrower_search") else ""
        pattern="%"+term+"%"
        rows=self._rows("""SELECT * FROM borrowers WHERE ?='' OR full_name LIKE ? OR id_number LIKE ? OR rfid_tag LIKE ? OR course_section LIKE ? ORDER BY full_name""",
            (term,pattern,pattern,pattern,pattern))
        self._fill(self.borrower_tree,rows,lambda r:(r["full_name"],r["borrower_type"],r["id_number"],r["course_section"] or "",r["contact"] or "",r["status"]))

    def refresh_requests(self):
        rows=self._rows("SELECT * FROM requests ORDER BY requested_at DESC")
        groups={}
        for r in rows:
            g=groups.setdefault(r["request_ref"],{"id":r["request_ref"],"requested_at":r["requested_at"],"borrower_name":r["borrower_name"],"id_number":r["id_number"],"purpose":r["purpose"],"status":r["status"],"expires_at":r["expires_at"],"lines":[]})
            g["lines"].append(r)
        self._fill(self.request_tree,list(groups.values()),lambda g:(g["id"],self._short_date(g["requested_at"]),g["borrower_name"],g["id_number"],
            ", ".join(f'{l["item_name"]} × {l["qty"]:g}' for l in g["lines"]),g["purpose"] or "",g["status"],self._short_date(g["expires_at"])))

    def refresh_counter(self):
        if not hasattr(self,"queue_tree"):return
        rows=self._rows("SELECT * FROM requests WHERE status IN ('Pending Release','In Progress','Partially Released') ORDER BY requested_at")
        groups={}
        for r in rows:
            g=groups.setdefault(r["request_ref"],{"id":r["request_ref"],"borrower_name":r["borrower_name"],"id_number":r["id_number"],"status":r["status"],"expires_at":r["expires_at"],"lines":[]})
            g["lines"].append(r)
        self._queue_refs={g["id"]:g for g in groups.values()}
        self._fill(self.queue_tree,list(groups.values()),lambda g:(g["id"],g["borrower_name"],g["id_number"],
            ", ".join(f'{l["item_name"]} × {l["qty"]-l["released_qty"]:g}' for l in g["lines"]),g["status"],
            self._countdown(g["expires_at"]) if g["status"]=="Pending Release" else "—"))

    def refresh_queue_clock(self):
        if not self.winfo_exists():return
        for ref,g in getattr(self,"_queue_refs",{}).items():
            if self.queue_tree.exists(ref):
                self.queue_tree.set(ref,"expires",self._countdown(g["expires_at"]) if g["status"]=="Pending Release" else "—")
        self.after(1000,self.refresh_queue_clock)

    @staticmethod
    def _countdown(value):
        if not value:return "—"
        try:
            seconds=max(0,int((datetime.fromisoformat(value.replace("Z","+00:00"))-datetime.now().astimezone()).total_seconds()))
            return f"{seconds//60:02d}:{seconds%60:02d}"
        except (ValueError,TypeError):return "—"

    def refresh_maintenance(self):
        logs=self._rows("SELECT * FROM maintenance_logs ORDER BY start_date DESC")
        self._fill(self.maint_tree,logs,lambda r:(r["asset_tag"],r["item_name"],r["type"],r["start_date"],r["findings"] or "",r["status"]))
        rows=self._rows("SELECT * FROM items WHERE calibration_required=1 AND status!='Retired' ORDER BY calibration_due")
        def state(r):
            d=r["calibration_due"]
            return "Date missing" if not d else "OVERDUE" if d<TODAY() else "Due soon" if d<=(date.today()+timedelta(days=30)).isoformat() else "Current"
        self._fill(self.cal_tree,rows,lambda r:(r["asset_tag"],r["name"],r["calibration_due"] or "—",state(r)))

    def refresh_loans(self):
        rows=self._rows("""SELECT l.*,b.full_name FROM loans l LEFT JOIN borrowers b ON b.id=l.borrower_id ORDER BY l.issued_at DESC""")
        self._fill(self.loan_tree,rows,lambda r:(r["trans_no"] or "",r["borrower_name"] or r["full_name"] or "",r["borrower_id_number"] or "",
            r["asset_tag"] or "",r["item_name"] or "",f'{r["qty_issued"]:g} / {r["qty_returned"]:g}',
            self._short_date(r["issued_at"]),self._short_date(r["expected_return_at"]),self._short_date(r["returned_at"]),self._loan_status(r)))

    def refresh_audit(self):
        rows=self._rows("SELECT * FROM audit_logs ORDER BY at DESC LIMIT 300")
        self._fill(self.audit_tree,rows,lambda r:(self._short_date(r["at"]),r["action"],r["actor"],r["request_ref"] or "",r["detail"] or "",r["outcome"]))


    def _selected(self, tree, entity, label):
        chosen=tree.selection()
        if not chosen:
            messagebox.showinfo("Select a record",f"Choose a {label} first.",parent=self);return None
        return self.db.execute(f'SELECT * FROM "{entity}" WHERE id=?',(chosen[0],)).fetchone()

    def add_item(self):
        fields=[("asset_tag","Asset tag *"),("name","Item name *"),("category","Category"),("brand_model","Brand / model"),("serial_no","Serial no."),("location","Location"),("unit_cost","Unit cost"),("condition","Condition","choice",("Good","Fair","Poor")),("status","Status","choice",("Active","Under Maintenance","Retired")),("is_consumable","Consumable","check"),("min_stock","Minimum stock"),("qty_total","Total quantity"),("qty_available","Available quantity"),("calibration_required","Calibration required","check"),("calibration_due","Calibration due (YYYY-MM-DD)")]
        data=self._form_dialog("Register inventory item",fields,{"condition":"Good","status":"Active","qty_total":"1","qty_available":"1"})
        if not data:return
        try:
            if not data["asset_tag"].strip() or not data["name"].strip():raise ValueError("Asset tag and item name are required.")
            total=float(data.get("qty_total") or 1);available=float(data.get("qty_available") or 0);cost=float(data.get("unit_cost") or 0)
            minimum=float(data.get("min_stock") or 0)
            if available<0 or total<0 or available>total:raise ValueError("Available quantity must be between zero and total quantity.")
            if cost<0 or minimum<0:raise ValueError("Cost and minimum stock cannot be negative.")
            if data.get("calibration_due"):date.fromisoformat(data["calibration_due"])
            values={**data,"asset_tag":data["asset_tag"].strip(),"name":data["name"].strip(),"unit_cost":cost,"min_stock":minimum,"qty_total":total,"qty_available":available}
            with self.db:self._insert("items",values)
            self.audit("item_created",entity="Item",detail=values["asset_tag"]+" · "+values["name"])
            self.refresh_all()
        except (ValueError,sqlite3.IntegrityError) as e:messagebox.showerror("Could not save item",str(e),parent=self)

    def edit_item(self):
        item=self._selected(self.item_tree,"items","item")
        if not item:return
        fields=[("asset_tag","Asset tag *"),("name","Item name *"),("category","Category"),("brand_model","Brand / model"),("serial_no","Serial no."),("location","Location"),("unit_cost","Unit cost"),("condition","Condition","choice",("Good","Fair","Poor")),("status","Status","choice",("Active","Under Maintenance","Retired")),("is_consumable","Consumable","check"),("min_stock","Minimum stock"),("qty_total","Total quantity"),("qty_available","Available quantity"),("calibration_required","Calibration required","check"),("calibration_due","Calibration due (YYYY-MM-DD)")]
        data=self._form_dialog("Edit inventory item",fields,dict(item))
        if not data:return
        try:
            if not data["asset_tag"].strip() or not data["name"].strip():raise ValueError("Asset tag and item name are required.")
            total=float(data.get("qty_total") or 0);available=float(data.get("qty_available") or 0)
            if available<0 or total<0 or available>total:raise ValueError("Available quantity must be between zero and total quantity.")
            data.update(unit_cost=float(data.get("unit_cost") or 0),min_stock=float(data.get("min_stock") or 0),qty_total=total,qty_available=available)
            with self.db:self._update("items",item["id"],data)
            self.audit("item_updated",entity="Item",entity_id=item["id"],detail=data["asset_tag"])
            self.refresh_all()
        except (ValueError,sqlite3.IntegrityError) as e:messagebox.showerror("Could not update item",str(e),parent=self)

    def retire_item(self):
        item=self._selected(self.item_tree,"items","item")
        if not item:return
        if messagebox.askyesno("Retire item",f"Retire {item['name']} ({item['asset_tag']})?",parent=self):
            with self.db:self._update("items",item["id"],{"status":"Retired"})
            self.audit("item_retired",entity="Item",entity_id=item["id"],detail=item["asset_tag"])
            self.refresh_all()

    def record_condition(self):
        item=self._selected(self.item_tree,"items","item")
        if not item:return
        data=self._form_dialog("Record item condition",[("condition","Condition","choice",("Good","Fair","Poor")),("detail","Inspection note","memo")],{"condition":item["condition"]})
        if not data:return
        with self.db:self._update("items",item["id"],{"condition":data["condition"]})
        self.audit("condition_recorded",entity="Item",entity_id=item["id"],detail=item["asset_tag"]+" · "+data["condition"]+" · "+data["detail"])
        self.refresh_all()

    def label_item(self):
        item=self._selected(self.item_tree,"items","item")
        if not item:return
        messagebox.showinfo("Asset label",f"WCC ATC · AMT TOOL ROOM\\n\\n{item['name']}\\nAsset tag: {item['asset_tag']}\\nLocation: {item['location'] or '—'}\\n\\nPrint this text and use the tag with a keyboard-wedge scanner.",parent=self)

    def add_borrower(self):
        fields=[("full_name","Full name *"),("borrower_type","Type","choice",("Student","Instructor")),("id_number","Student / employee ID *"),("rfid_tag","RFID tag"),("course","Course"),("section","Section"),("course_section","Course / section"),("email","Email"),("contact","Contact number"),("restrictions","Restrictions","memo"),("status","Status","choice",("Active","Inactive"))]
        data=self._form_dialog("Register borrower",fields,{"borrower_type":"Student","status":"Active"})
        if not data:return
        try:
            if not data["full_name"].strip() or not data["id_number"].strip():raise ValueError("Name and ID number are required.")
            data["course_section"]=data["course_section"].strip() or " - ".join(x for x in (data["course"].strip(),data["section"].strip()) if x)
            with self.db:self._insert("borrowers",data)
            self.audit("borrower_created",entity="Borrower",detail=data["full_name"]+" · "+data["id_number"])
            self.refresh_all()
        except (ValueError,sqlite3.IntegrityError) as e:messagebox.showerror("Could not save borrower",str(e),parent=self)

    def edit_borrower(self):
        borrower=self._selected(self.borrower_tree,"borrowers","borrower")
        if not borrower:return
        fields=[("full_name","Full name *"),("borrower_type","Type","choice",("Student","Instructor")),("id_number","Student / employee ID *"),("rfid_tag","RFID tag"),("course","Course"),("section","Section"),("course_section","Course / section"),("email","Email"),("contact","Contact number"),("restrictions","Restrictions","memo"),("status","Status","choice",("Active","Inactive"))]
        data=self._form_dialog("Edit borrower",fields,dict(borrower))
        if not data:return
        try:
            if not data["full_name"].strip() or not data["id_number"].strip():raise ValueError("Name and ID number are required.")
            data["course_section"]=data["course_section"].strip() or " - ".join(x for x in (data["course"].strip(),data["section"].strip()) if x)
            with self.db:self._update("borrowers",borrower["id"],data)
            self.audit("borrower_updated",entity="Borrower",entity_id=borrower["id"],detail=data["full_name"])
            self.refresh_all()
        except (ValueError,sqlite3.IntegrityError) as e:messagebox.showerror("Could not update borrower",str(e),parent=self)

    def toggle_borrower(self):
        borrower=self._selected(self.borrower_tree,"borrowers","borrower")
        if not borrower:return
        status="Inactive" if borrower["status"]=="Active" else "Active"
        with self.db:self._update("borrowers",borrower["id"],{"status":status})
        self.audit("borrower_status_changed",entity="Borrower",entity_id=borrower["id"],detail=status)
        self.refresh_all()

    def new_request(self):
        borrowers=self._rows("SELECT * FROM borrowers WHERE status='Active' ORDER BY full_name")
        items=self._rows("SELECT * FROM items WHERE status='Active' AND qty_available>0 ORDER BY name")
        if not borrowers:messagebox.showinfo("No borrowers","Register an active borrower before creating a request.",parent=self);return
        if not items:messagebox.showinfo("No available items","Add inventory with available quantity first.",parent=self);return
        bchoices=[f'{b["id_number"]} — {b["full_name"]}' for b in borrowers]
        ichoices=[f'{i["asset_tag"]} — {i["name"]} ({i["qty_available"]:g} available)' for i in items]
        data=self._form_dialog("Create borrow request",[("borrower","Borrower","choice",bchoices),("item","Item","choice",ichoices),("qty","Quantity"),("purpose","Purpose"),("needed_until","Needed until (YYYY-MM-DD)")],{"borrower":bchoices[0],"item":ichoices[0],"qty":"1","needed_until":(date.today()+timedelta(days=1)).isoformat()})
        if not data:return
        try:
            b=borrowers[bchoices.index(data["borrower"])];item=items[ichoices.index(data["item"])]
            qty=float(data["qty"])
            if qty<=0 or qty>item["qty_available"]:raise ValueError(f"Quantity must be between 1 and {item['qty_available']:g}.")
            if not data["purpose"].strip():raise ValueError("Enter the purpose for borrowing.")
            date.fromisoformat(data["needed_until"])
            ts=NOW();ref="REQ-"+date.today().strftime("%y%m%d")+"-"+uuid4().hex[:4].upper()
            with self.db:
                self._insert("requests",{"request_ref":ref,"borrower_id":b["id"],"borrower_name":b["full_name"],"id_number":b["id_number"],
                    "course_section":b["course_section"],"contact":b["contact"],"item_id":item["id"],"asset_tag":item["asset_tag"],"item_name":item["name"],
                    "qty":qty,"released_qty":0,"purpose":data["purpose"].strip(),"needed_until":data["needed_until"],
                    "requested_at":ts,"expires_at":(datetime.fromisoformat(ts)+timedelta(minutes=5)).isoformat(timespec="seconds"),"status":"Pending Release"})
            self.audit("request_submitted",actor=b["full_name"],ref=ref,entity="BorrowRequest",detail=f'{item["name"]} × {qty:g}')
            self.refresh_all()
        except (ValueError,IndexError) as e:messagebox.showerror("Could not create request",str(e),parent=self)

    def cancel_request(self):
        chosen=self.request_tree.selection()
        if not chosen:messagebox.showinfo("Select request","Choose a request first.",parent=self);return
        ref=chosen[0]
        status=self.db.execute("SELECT status FROM requests WHERE request_ref=? LIMIT 1",(ref,)).fetchone()
        if not status:return
        if status["status"] not in ("Pending Release","In Progress","Partially Released"):return
        if messagebox.askyesno("Cancel request",f"Cancel request {ref}?",parent=self):
            with self.db:self.db.execute("UPDATE requests SET status='Cancelled',updated_date=? WHERE request_ref=?",(NOW(),ref))
            self.audit("cancelled",ref=ref,entity="BorrowRequest",detail="Cancelled from desktop app")
            self.refresh_all()

    def load_request(self):
        chosen=self.queue_tree.selection()
        if not chosen:return
        ref=chosen[0];group=self._queue_refs.get(ref)
        if not group:return
        self.active_ref=ref;self.staged=[]
        lines=self._rows("SELECT * FROM requests WHERE request_ref=?",(ref,))
        self.active_lines={r["id"]:dict(r) for r in lines}
        text=[f'Request: {ref}',f'Borrower: {group["borrower_name"]} ({group["id_number"]})',f'Status: {group["status"]}']
        text.extend(f'  {r["item_name"]}: {r["released_qty"]:g}/{r["qty"]:g} released' for r in lines)
        self.counter_info.config(text="\\n".join(text))
        self.refresh_staged()

    def stage_scan(self):
        ref=getattr(self,"active_ref","")
        if not ref:messagebox.showinfo("Choose a request","Select a request from the queue first.",parent=self);return
        raw=self.scan_var.get().strip()
        if not raw:return
        item=self.db.execute("SELECT * FROM items WHERE lower(asset_tag)=lower(?)",(raw,)).fetchone()
        if not item:messagebox.showerror("Asset not found",f"No inventory item has tag {raw}.",parent=self);self.scan_var.set("");return
        line=next((r for r in self.active_lines.values() if r["item_id"]==item["id"]),None)
        if not line:messagebox.showerror("Not requested",f'{item["name"]} is not on request {ref}.',parent=self);self.scan_var.set("");return
        staged=sum(1 for s in self.staged if s["line_id"]==line["id"])
        if staged+(line["released_qty"] or 0)>=(line["qty"] or 0):messagebox.showerror("Quantity reached","Requested quantity has already been released or scanned.",parent=self);self.scan_var.set("");return
        if (item["qty_available"] or 0)-staged<1:messagebox.showerror("No stock",f'Only {item["qty_available"]:g} units are available.',parent=self);self.scan_var.set("");return
        restriction=""
        if item["status"]=="Retired":restriction="Asset is retired"
        elif item["status"]=="Under Maintenance":restriction="Asset is under maintenance"
        elif item["status"]!="Active":restriction=f'Asset status is {item["status"]}'
        elif item["condition"]=="Poor":restriction="Asset condition is poor"
        elif item["calibration_required"] and item["calibration_due"] and item["calibration_due"]<TODAY():restriction="Calibration is overdue"
        override=""
        if restriction:
            reason=simpledialog.askstring("Restricted asset",f'{restriction}.\nType an override reason to proceed:',parent=self)
            if not reason or not reason.strip():
                self.audit("scan_rejected",ref=ref,entity="Item",entity_id=item["id"],detail=restriction,outcome="rejected")
                self.scan_var.set("");return
            override=f"OVERRIDE: {reason.strip()}"
            self.audit("override_recorded",ref=ref,entity="Item",entity_id=item["id"],detail=override)
        self.staged.append({"item_id":item["id"],"tag":item["asset_tag"],"name":item["name"],"line_id":line["id"],"override":override})
        self.audit("tool_scanned",ref=ref,entity="Item",entity_id=item["id"],detail=item["asset_tag"])
        self.scan_var.set("");self.refresh_staged()

    def refresh_staged(self):
        if not hasattr(self,"staged_tree"):return
        self.staged_tree.delete(*self.staged_tree.get_children())
        for i,scan in enumerate(self.staged):
            self.staged_tree.insert("","end",iid=str(i),values=(scan["tag"],scan["name"],"Override" if scan["override"] else "OK"))

    def remove_scan(self):
        selection=self.staged_tree.selection()
        if selection:
            del self.staged[int(selection[0])]
            self.refresh_staged()

    def clear_scans(self):
        self.staged=[]
        self.refresh_staged()

    def commit_release(self):
        ref=getattr(self,"active_ref","")
        if not ref or not self.staged:messagebox.showinfo("Nothing to release","Choose a request and scan at least one asset.",parent=self);return
        due_text=self.due_var.get().strip()
        try:
            due=datetime.fromisoformat(due_text)
        except ValueError:
            messagebox.showerror("Due date","Use YYYY-MM-DDTHH:MM.",parent=self);return
        lines=self._rows("SELECT * FROM requests WHERE request_ref=?",(ref,))
        borrower=self.db.execute("SELECT * FROM borrowers WHERE id=?",(lines[0]["borrower_id"],)).fetchone() if lines else None
        by_line={}
        for scan in self.staged:by_line[scan["line_id"]]=by_line.get(scan["line_id"],0)+1
        ts=NOW();trans="TR-"+datetime.now().strftime("%Y%m%d-%H%M%S")
        try:
            with self.db:
                release_summary=[]
                for line_id,qty in by_line.items():
                    line=self.db.execute("SELECT * FROM requests WHERE id=?",(line_id,)).fetchone()
                    item=self.db.execute("SELECT * FROM items WHERE id=?",(line["item_id"],)).fetchone()
                    if not item or item["qty_available"]<qty:raise ValueError(f'{item["name"] if item else "Item"}: stock changed; release cancelled.')
                    self._update("items",item["id"],{"qty_available":item["qty_available"]-qty})
                    self._insert("loans",{"trans_no":trans,"request_ref":ref,"borrower_id":borrower["id"] if borrower else line["borrower_id"],
                        "borrower_name":borrower["full_name"] if borrower else line["borrower_name"],"borrower_id_number":borrower["id_number"] if borrower else line["id_number"],
                        "course_section":line["course_section"],"purpose":line["purpose"],"item_id":item["id"],"asset_tag":item["asset_tag"],"item_name":item["name"],
                        "qty_issued":qty,"qty_returned":0,"issued_condition":item["condition"],"issued_at":ts,"expected_return_at":due.isoformat(),"issued_by":"Offline administrator","status":"Open"})
                    self._update("requests",line_id,{"released_qty":line["released_qty"]+qty,"released_at":ts,"toolkeeper":"Offline administrator"})
                    release_summary.append((item,qty))
                refreshed=self._rows("SELECT * FROM requests WHERE request_ref=?",(ref,))
                status="Completed" if all(r["released_qty"]>=r["qty"] for r in refreshed) else "Partially Released"
                self.db.execute("UPDATE requests SET status=?,updated_date=? WHERE request_ref=?",(status,NOW(),ref))
            self.audit("release_completed" if status=="Completed" else "release_partial",ref=ref,entity="BorrowRequest",detail=", ".join(f"{i['name']} × {q:g}" for i,q in release_summary))
            overrides=[s["override"] for s in self.staged if s["override"]]
            self.staged=[];self.active_ref=""
            self.refresh_all()
            self._show_slip(trans,ref,borrower,release_summary,due,ts,status,overrides)
        except (ValueError,sqlite3.Error) as e:messagebox.showerror("Release not completed",str(e),parent=self)

    def _show_slip(self, trans, ref, borrower, items, due, issued, status, overrides):
        name=borrower["full_name"] if borrower else "Unknown borrower"
        idno=borrower["id_number"] if borrower else ""
        lines=[f"WCC ATC NORTH MANILA — AMT TOOL ROOM","",f"BORROW SLIP · {status.upper()} RELEASE",
            f"Borrower: {name}",f"Student ID: {idno}",f"Request: {ref}",f"Transaction: {trans}",
            f"Issued: {self._short_date(issued)}",f"Due: {due.strftime('%b %d, %Y %I:%M %p')}","",
            "ASSET TAG          ITEM                                QTY"]
        for item,qty in items:lines.append(f'{item["asset_tag"]:<18} {item["name"]:<34} {qty:g}')
        if overrides:lines += ["","OVERRIDES:"]+overrides
        lines += ["","Only the assets listed above were physically scanned and released.","","Released by: ____________________    Received by: ____________________"]
        win=tk.Toplevel(self);win.title("Borrow slip");win.transient(self);win.geometry("660x520")
        text=tk.Text(win,wrap="none",font=("Consolas",10),padx=15,pady=15)
        text.pack(fill="both",expand=True);text.insert("1.0","\\n".join(lines));text.configure(state="disabled")
        ttk.Button(win,text="Save slip as text…",command=lambda:self._save_slip(lines)).pack(anchor="e",padx=12,pady=10)

    def _save_slip(self, lines):
        path=filedialog.asksaveasfilename(parent=self,defaultextension=".txt",initialfile="AMT_Borrow_Slip.txt",filetypes=[("Text file","*.txt")])
        if path:
            Path(path).write_text("\\n".join(lines),encoding="utf-8")
            messagebox.showinfo("Slip saved",f"Saved to:\\n{path}",parent=self)
    def return_loan(self):
        loan=self._selected(self.loan_tree,"loans","loan")
        if not loan:return
        outstanding=(loan["qty_issued"] or 0)-(loan["qty_returned"] or 0)
        if outstanding<=0 or loan["status"] not in ("Open","Partial"):
            messagebox.showinfo("Closed loan","This loan has no outstanding quantity.",parent=self);return
        qty=simpledialog.askfloat("Return quantity",f'{loan["item_name"]} — {outstanding:g} still outstanding\nQuantity physically returned or lost:',parent=self,minvalue=0.01,maxvalue=outstanding,initialvalue=outstanding)
        if qty is None:return
        condition=simpledialog.askstring("Return condition","Enter Good, Fair, Damaged, or Lost:",parent=self,initialvalue="Good")
        if not condition:return
        condition=condition.strip().title()
        if condition not in ("Good","Fair","Damaged","Lost"):
            messagebox.showerror("Condition","Choose Good, Fair, Damaged, or Lost.",parent=self);return
        notes=simpledialog.askstring("Return notes","Notes (a reason is required for a loss):",parent=self) or ""
        if condition=="Lost" and not notes.strip():
            messagebox.showerror("Notes required","Explain the loss.",parent=self);return
        item=self.db.execute("SELECT * FROM items WHERE id=?",(loan["item_id"],)).fetchone()
        if not item:
            messagebox.showerror("Item missing","The linked inventory item is missing; return was not recorded.",parent=self);return
        new_returned=(loan["qty_returned"] or 0)+(0 if condition=="Lost" else qty)
        status="Lost" if condition=="Lost" else "Closed" if new_returned>=loan["qty_issued"] else "Partial"
        try:
            with self.db:
                if condition=="Lost":
                    self._update("items",item["id"],{"qty_total":max(0,(item["qty_total"] or 0)-qty)})
                elif condition=="Damaged":
                    self._update("items",item["id"],{"status":"Under Maintenance","qty_available":(item["qty_available"] or 0)+qty})
                else:
                    self._update("items",item["id"],{"qty_available":(item["qty_available"] or 0)+qty,"condition":condition})
                self._update("loans",loan["id"],{"qty_returned":new_returned,"returned_condition":condition,"returned_at":NOW(),
                    "returned_by":"Offline administrator","notes":notes.strip(),"status":status})
                if condition=="Damaged":
                    self._insert("maintenance_logs",{"item_id":item["id"],"asset_tag":item["asset_tag"],"item_name":item["name"],"type":"Repair",
                        "start_date":TODAY(),"findings":notes.strip() or "Returned damaged at counter","status":"Open"})
            self.audit("loss_reported" if condition=="Lost" else "damage_reported" if condition=="Damaged" else "return_confirmed",
                ref=loan["request_ref"] or "",entity="Loan",entity_id=loan["id"],detail=f'{item["asset_tag"]} × {qty:g} · {condition} · {notes}')
            self.refresh_all()
        except (ValueError,sqlite3.Error) as e:
            messagebox.showerror("Return not recorded",str(e),parent=self)

    def log_maintenance(self):
        items=self._rows("SELECT * FROM items WHERE status!='Retired' ORDER BY asset_tag")
        if not items:
            messagebox.showinfo("No inventory","Add an item before logging maintenance.",parent=self);return
        choices=[f'{i["asset_tag"]} — {i["name"]}' for i in items]
        data=self._form_dialog("Log maintenance",[("item","Item","choice",choices),("type","Work type","choice",("Maintenance","Calibration","Repair")),("findings","Findings","memo"),("action_taken","Action taken","memo"),("cost","Cost")],{"item":choices[0],"type":"Maintenance","cost":"0"})
        if not data:return
        item=items[choices.index(data["item"])]
        try:
            cost=float(data.get("cost") or 0)
            with self.db:
                self._insert("maintenance_logs",{"item_id":item["id"],"asset_tag":item["asset_tag"],"item_name":item["name"],
                    "type":data["type"],"start_date":TODAY(),"findings":data["findings"],"action_taken":data["action_taken"],"cost":cost,"status":"Open"})
                self._update("items",item["id"],{"status":"Under Maintenance"})
            self.audit("maintenance_started",entity="MaintenanceLog",detail=item["asset_tag"]+" · "+data["type"])
            self.refresh_all()
        except (ValueError,sqlite3.Error) as e:
            messagebox.showerror("Could not log maintenance",str(e),parent=self)

    def complete_maintenance(self):
        log=self._selected(self.maint_tree,"maintenance_logs","maintenance record")
        if not log:return
        if log["status"]!="Open":return
        with self.db:
            self._update("maintenance_logs",log["id"],{"status":"Completed"})
            item=self.db.execute("SELECT * FROM items WHERE id=?",(log["item_id"],)).fetchone()
            if item and item["status"]=="Under Maintenance":self._update("items",item["id"],{"status":"Active"})
        self.audit("maintenance_completed",entity="MaintenanceLog",entity_id=log["id"],detail=log["asset_tag"])
        self.refresh_all()

    def record_calibration(self):
        item=self._selected(self.cal_tree,"items","calibration-controlled item")
        if not item:return
        default_due=(date.today()+timedelta(days=365)).isoformat()
        data=self._form_dialog("Record calibration",[("calibrated_on","Calibration date (YYYY-MM-DD)"),("calibration_due","Next due date (YYYY-MM-DD)"),("provider","Provider / lab"),("certificate","Certificate reference"),("notes","Notes","memo")],
            {"calibrated_on":TODAY(),"calibration_due":default_due})
        if not data:return
        try:
            date.fromisoformat(data["calibrated_on"]);date.fromisoformat(data["calibration_due"])
            with self.db:
                self._update("items",item["id"],{"calibration_required":1,"calibration_due":data["calibration_due"]})
                self._insert("maintenance_logs",{"item_id":item["id"],"asset_tag":item["asset_tag"],"item_name":item["name"],"type":"Calibration",
                    "start_date":data["calibrated_on"],"findings":data["notes"],"action_taken":data["provider"]+" · "+data["certificate"],"status":"Completed"})
            self.audit("calibration_recorded",entity="Item",entity_id=item["id"],detail=item["asset_tag"]+" · due "+data["calibration_due"])
            self.refresh_all()
        except ValueError as e:
            messagebox.showerror("Date format","Dates must use YYYY-MM-DD. "+str(e),parent=self)

    def _write_csv(self, path, headers, rows):
        with open(path,"w",newline="",encoding="utf-8-sig") as handle:
            writer=csv.writer(handle);writer.writerow(headers);writer.writerows(rows)

    def export_inventory(self):
        path=filedialog.asksaveasfilename(parent=self,defaultextension=".csv",initialfile="AMT_Inventory.csv",filetypes=[("CSV file","*.csv")])
        if not path:return
        rows=self._rows("SELECT * FROM items ORDER BY asset_tag")
        headers=("Asset tag","Item","Category","Brand / model","Serial no.","Total","Available","On loan","Condition","Status","Location","Calibration due","Unit cost")
        values=[(r["asset_tag"],r["name"],r["category"],r["brand_model"],r["serial_no"],r["qty_total"],r["qty_available"],
            (r["qty_total"] or 0)-(r["qty_available"] or 0),r["condition"],r["status"],r["location"],r["calibration_due"],r["unit_cost"]) for r in rows]
        self._write_csv(path,headers,values)
        messagebox.showinfo("Export complete",f"Inventory exported to:\n{path}",parent=self)

    def export_loans(self):
        path=filedialog.asksaveasfilename(parent=self,defaultextension=".csv",initialfile="AMT_Transactions.csv",filetypes=[("CSV file","*.csv")])
        if not path:return
        rows=self._rows("SELECT * FROM loans ORDER BY issued_at DESC")
        headers=("Transaction","Request ref","Borrower","ID No.","Asset tag","Item","Qty issued","Qty returned","Issued","Due","Returned","Status","Notes")
        values=[(r["trans_no"],r["request_ref"],r["borrower_name"],r["borrower_id_number"],r["asset_tag"],r["item_name"],
            r["qty_issued"],r["qty_returned"],r["issued_at"],r["expected_return_at"],r["returned_at"],r["status"],r["notes"]) for r in rows]
        self._write_csv(path,headers,values)
        messagebox.showinfo("Export complete",f"Transactions exported to:\n{path}",parent=self)

    def backup(self):
        path=filedialog.asksaveasfilename(parent=self,defaultextension=".json",initialfile="AMT-TRALMS-backup-"+TODAY()+".json",filetypes=[("AMT-TRALMS JSON backup","*.json")])
        if not path:return
        mapping={"Item":"items","Borrower":"borrowers","BorrowRequest":"requests","Loan":"loans","MaintenanceLog":"maintenance_logs","AuditLog":"audit_logs"}
        data={key:[dict(r) for r in self._rows(f'SELECT * FROM "{table}"')] for key,table in mapping.items()}
        Path(path).write_text(json.dumps({"format":"AMT-TRALMS local backup","version":1,"createdAt":NOW(),"data":data},ensure_ascii=False,indent=2),encoding="utf-8")
        messagebox.showinfo("Backup saved",f"Local data backup saved to:\n{path}",parent=self)

    def restore(self):
        path=filedialog.askopenfilename(parent=self,filetypes=[("AMT-TRALMS JSON backup","*.json"),("All files","*.*")])
        if not path:return
        try:
            payload=json.loads(Path(path).read_text(encoding="utf-8"));data=payload.get("data",payload)
            mapping={"Item":"items","Borrower":"borrowers","BorrowRequest":"requests","Loan":"loans","MaintenanceLog":"maintenance_logs","AuditLog":"audit_logs"}
            if not all(isinstance(data.get(k),list) for k in mapping):raise ValueError("This file is not a valid AMT-TRALMS backup.")
            if not messagebox.askyesno("Replace local data","Restore replaces all records in this desktop database. Continue?",parent=self):return
            with self.db:
                for key,table in mapping.items():
                    self.db.execute(f'DELETE FROM "{table}"')
                    for r in data[key]:self._insert(table,r)
            self.refresh_all();messagebox.showinfo("Restore complete","Backup restored.",parent=self)
        except (OSError,ValueError,sqlite3.Error) as e:
            messagebox.showerror("Restore failed",str(e),parent=self)

    def close(self):
        try:self.db.close()
        finally:self.destroy()


if __name__ == "__main__":
    AMTTralmsApp().mainloop()




