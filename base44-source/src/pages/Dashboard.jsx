import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import StatCard from "@/components/StatCard";

async function loadStats() {
  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const open = { status: { $in: ["Open", "Partial"] } };
  const [avail, openAgg, overdue, calib, maint, consumables, recent] = await Promise.all([
    base44.entities.Item.aggregate({ query: { status: "Active" }, sum: ["qty_available", "qty_total"] }),
    base44.entities.Loan.aggregate({ query: open, sum: ["qty_issued", "qty_returned"] }),
    base44.entities.Loan.count({ ...open, expected_return_at: { $lt: now } }),
    base44.entities.Item.count({ calibration_required: true, calibration_due: { $lte: soon }, status: { $ne: "Retired" } }),
    base44.entities.Item.count({ status: "Under Maintenance" }),
    base44.entities.Item.filter({ is_consumable: true }, { limit: 500 }),
    base44.entities.Loan.filter({}, { sort: "-created_date", limit: 6 }),
  ]);
  const a = avail.rows?.[0] || {};
  const o = openAgg.rows?.[0] || {};
  return {
    available: a.sum_qty_available || 0,
    total: a.sum_qty_total || 0,
    onLoan: (o.sum_qty_issued || 0) - (o.sum_qty_returned || 0),
    openLines: o.count || 0,
    overdue, calib, maint,
    low: consumables.items.filter((i) => i.qty_available <= (i.min_stock || 0)).length,
    recent: recent.items,
  };
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: loadStats });
  const d = data || {};
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-600">Tool room status at a glance.</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard loading={isLoading} title="Available Items" value={d.available || 0} tone="green" details={[{ label: "Total units", value: d.total || 0 }]} />
        <StatCard loading={isLoading} title="On Loan" value={d.onLoan || 0} details={[{ label: "Open lines", value: d.openLines || 0 }]} />
        <StatCard loading={isLoading} title="Overdue" value={d.overdue || 0} tone="red" details={[{ label: "As of", value: format(new Date(), "MMM d") }]} />
        <StatCard loading={isLoading} title="Calibration Due" value={d.calib || 0} tone="amber" details={[{ label: "Window", value: "30 days" }]} />
        <StatCard loading={isLoading} title="Under Maintenance" value={d.maint || 0} tone="amber" />
        <StatCard loading={isLoading} title="Low Stock" value={d.low || 0} tone="red" details={[{ label: "Type", value: "Consumables" }]} />
      </div>
      <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">Recent activity</h2>
      <div className="divide-y rounded-xl border bg-white">
        {(d.recent || []).length === 0 && <p className="p-4 text-sm text-slate-500">No transactions yet.</p>}
        {(d.recent || []).map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><b>{l.borrower_name}</b> · {l.item_name} × {l.qty_issued}</span>
            <span className="text-slate-500">{l.trans_no} · {l.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
