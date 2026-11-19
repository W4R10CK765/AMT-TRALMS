import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const fmt = (v) => (v ? format(new Date(v), "MMM d, yyyy") : "—");
const tone = (s) =>
  ({
    Open: "border-blue-600 text-blue-700",
    Partial: "border-indigo-600 text-indigo-700",
    Closed: "border-green-600 text-green-700",
    Damaged: "border-red-600 text-red-700",
    Lost: "border-purple-600 text-purple-700",
  }[s] || "text-slate-600");

export default function BorrowerHistory({ loans = [], requests = [], isLoading }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-slate-900">Loan history</h2>
          <span className="text-xs text-slate-500">{loans.length} record{loans.length === 1 ? "" : "s"}</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Slip no.", "Tool", "Qty", "Issued", "Due", "Returned", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && loans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-slate-500">
                    No loans recorded yet.
                  </td>
                </tr>
              )}
              {loans.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{l.trans_no || "—"}</td>
                  <td className="px-4 py-2">
                    {l.item_name}
                    <span className="ml-1 font-mono text-xs text-slate-500">{l.asset_tag}</span>
                  </td>
                  <td className="px-4 py-2">
                    {l.qty_issued}
                    {l.qty_returned ? <span className="text-xs text-slate-500"> · ret {l.qty_returned}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{fmt(l.issued_at)}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{fmt(l.expected_return_at)}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{fmt(l.returned_at)}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={tone(l.status)}>
                      {l.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-white">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-slate-900">Borrow requests</h2>
          <span className="text-xs text-slate-500">{requests.length}</span>
        </header>
        <div className="divide-y">
          {!isLoading && requests.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No requests submitted yet.</p>}
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-mono text-xs text-[#14306b]">{r.request_ref}</div>
                <div className="text-slate-800">
                  {r.item_name} <span className="text-xs text-slate-500">× {r.qty}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{fmt(r.requested_at)}</span>
                <Badge variant="outline">{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
