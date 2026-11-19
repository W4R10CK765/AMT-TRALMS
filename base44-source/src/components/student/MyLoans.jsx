import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export default function MyLoans({ borrower }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-loans", borrower.id],
    queryFn: async () => (await base44.entities.Loan.filter({ borrower_id: borrower.id, status: { $in: ["Open", "Partial"] } }, { sort: "expected_return_at", limit: 30 })).items,
  });

  const requestReturn = async (loan) => {
    await base44.entities.Loan.update(loan.id, { return_requested: true });
    toast.success("Tool room notified — bring the item to the counter");
    qc.invalidateQueries({ queryKey: ["my-loans", borrower.id] });
    qc.invalidateQueries({ queryKey: ["open-loans"] });
  };

  return (
    <section className="rounded-xl border bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-slate-900">Tools to return</h2>
        <span className="text-xs text-slate-500">{data.length}</span>
      </header>
      <div className="divide-y">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {!isLoading && data.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing outstanding — you have no tools on loan.</p>}
        {data.map((l) => {
          const out = l.qty_issued - (l.qty_returned || 0);
          const overdue = l.expected_return_at && new Date(l.expected_return_at) < new Date();
          return (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{l.item_name} × {out}</div>
                <div className="text-xs text-slate-500">
                  {l.asset_tag} · due {l.expected_return_at ? format(new Date(l.expected_return_at), "MMM d, h:mm a") : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {overdue && <Badge variant="outline" className="border-red-500 text-red-600">Overdue</Badge>}
                {l.return_requested ? (
                  <Badge variant="outline" className="border-green-600 text-green-700">Staff notified</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => requestReturn(l)}>Request return</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
