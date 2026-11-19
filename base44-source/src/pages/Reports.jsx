import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { format, differenceInCalendarDays } from "date-fns";

const d = (x) => (x ? format(new Date(x), "yyyy-MM-dd HH:mm") : "");

const REPORTS = [
  { code: "WCCATCNM-AMT-TR-LOG-001", title: "Daily Tool Issue & Return Log", cols: ["Time Issued", "Borrower", "ID No.", "Trans. No.", "Asset Tag", "Item", "Qty", "Condition", "Expected Return", "Returned", "Status"],
    load: async () => (await base44.entities.Loan.filter({}, { sort: "-issued_at", limit: 500 })).items.map((l) => [d(l.issued_at), l.borrower_name, l.borrower_id_number, l.trans_no, l.asset_tag, l.item_name, l.qty_issued, l.issued_condition, d(l.expected_return_at), d(l.returned_at), l.status]) },
  { code: "WCCATCNM-AMT-TR-RPT-002", title: "Overdue Tools & Equipment Report", cols: ["Borrower", "ID No.", "Trans. No.", "Asset Tag", "Item", "Qty Outstanding", "Issued", "Expected Return", "Days Overdue"],
    load: async () => (await base44.entities.Loan.filter({ status: { $in: ["Open", "Partial"] }, expected_return_at: { $lt: new Date().toISOString() } }, { limit: 500 })).items
      .map((l) => [l.borrower_name, l.borrower_id_number, l.trans_no, l.asset_tag, l.item_name, l.qty_issued - (l.qty_returned || 0), d(l.issued_at), d(l.expected_return_at), differenceInCalendarDays(new Date(), new Date(l.expected_return_at))])
      .sort((a, b) => b[8] - a[8]) },
  { code: "WCCATCNM-AMT-TR-RPT-003", title: "Inventory Masterlist", cols: ["Asset Tag", "Item", "Category", "Brand/Model", "Serial No.", "Total", "Available", "On Loan", "Status", "Location", "Calibration Due", "Unit Cost"],
    load: async () => (await base44.entities.Item.filter({}, { sort: "asset_tag", limit: 1000 })).items.map((i) => [i.asset_tag, i.name, i.category, i.brand_model, i.serial_no, i.qty_total, i.qty_available, i.qty_total - i.qty_available, i.status, i.location, i.calibration_due, i.unit_cost]) },
  { code: "WCCATCNM-AMT-TR-RPT-006", title: "Tool Damage / Loss Incident Report", cols: ["Trans. No.", "Asset Tag", "Item", "Borrower", "Issued", "Reported", "Type", "Notes"],
    load: async () => (await base44.entities.Loan.filter({ status: { $in: ["Damaged", "Lost"] } }, { limit: 500 })).items.map((l) => [l.trans_no, l.asset_tag, l.item_name, l.borrower_name, d(l.issued_at), d(l.returned_at), l.status, l.notes]) },
];

function csv(cols, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export default function Reports() {
  const [active, setActive] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const run = async (r) => { setActive(r); setLoading(true); setRows(await r.load()); setLoading(false); };
  const exportCsv = () => {
    const name = `${active.code}_${active.title.replace(/\W+/g, "")}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv(active.cols, rows)], { type: "text/csv" }));
    a.download = name; a.click();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900 print:hidden">Reports</h1>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {REPORTS.map((r) => (
          <button key={r.code} onClick={() => run(r)} className={`rounded-xl border p-4 text-left transition hover:border-[#14306b] ${active?.code === r.code ? "border-[#14306b] bg-blue-50" : "bg-white"}`}>
            <div className="font-medium text-slate-900">{r.title}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-500">{r.code}</div>
          </button>
        ))}
      </div>
      {active && (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs text-slate-600">WCC Aeronautical & Technological College – North Manila | Dept. of Aircraft Maintenance Technology</div>
              <div className="text-lg font-bold uppercase text-[#14306b]">{active.title}</div>
              <div className="text-xs text-slate-500">{active.code} · Issue 1 Rev 0 · Generated {format(new Date(), "yyyy-MM-dd HH:mm")}</div>
            </div>
            <div className="space-x-2 print:hidden">
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
              <Button size="sm" onClick={() => window.print()}>Print</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#14306b] text-left text-white"><tr>{active.cols.map((c) => <th key={c} className="px-2 py-1.5 font-medium">{c}</th>)}</tr></thead>
              <tbody>
                {loading && <tr><td colSpan={active.cols.length} className="p-3 text-slate-500">Loading…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={active.cols.length} className="p-3 text-slate-500">No records.</td></tr>}
                {rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-600">Total records: {rows.length} · AMT-TRALMS</div>
        </div>
      )}
    </div>
  );
}
