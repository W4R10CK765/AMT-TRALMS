import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const fmt = (d) => (d ? format(new Date(d), "MMM d, yyyy h:mm a") : "—");
const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export default function Transactions() {
  const [status, setStatus] = useState("all");
  const { data = [], isLoading } = useQuery({ queryKey: ["loans", status], queryFn: async () => {
    const query = status === "all" ? {} : status === "Overdue" ? { status: { $in: ["Open", "Partial"] }, expected_return_at: { $lt: new Date().toISOString() } } : { status };
    return (await base44.entities.Loan.filter(query, { sort: "-issued_at", limit: 300 })).items;
  } });
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          {["all", "Open", "Partial", "Closed", "Overdue", "Damaged", "Lost"].map((s) => <option key={s} value={s}>{s === "all" ? "All" : s}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#14306b] text-left text-white"><tr>{["Trans. No.", "Borrower", "Item", "Qty out/ret", "Issued", "Due", "Status"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-slate-500">Loading…</td></tr>}
            {!isLoading && data.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">No transactions.</td></tr>}
            {data.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{l.trans_no}</td><td className="px-3 py-2">{l.borrower_name}</td>
                <td className="px-3 py-2">{l.item_name}</td><td className="px-3 py-2">{l.qty_issued} / {l.qty_returned || 0}</td>
                <td className="px-3 py-2">{fmt(l.issued_at)}</td><td className="px-3 py-2">{fmt(l.expected_return_at)}</td>
                <td className="px-3 py-2"><Badge variant="outline">{l.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
