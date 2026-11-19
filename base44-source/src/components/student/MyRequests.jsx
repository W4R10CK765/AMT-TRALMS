import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import useNow from "@/hooks/useNow";
import { groupRequests, countdown, remainingMs, STATUS_TONE } from "@/lib/requests";
import { audit } from "@/lib/audit";

export default function MyRequests({ borrower }) {
  const qc = useQueryClient();
  const now = useNow(1000);
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-requests", borrower.id],
    queryFn: async () =>
      (await base44.entities.BorrowRequest.filter({ borrower_id: borrower.id }, { sort: "-requested_at", limit: 40 })).items,
  });

  const groups = groupRequests(data).reverse();

  const cancel = async (g) => {
    if (g.lines.every((l) => l.request_ref)) {
      await base44.entities.BorrowRequest.updateMany({ request_ref: g.ref }, { $set: { status: "Cancelled" } });
    } else {
      for (const l of g.lines) await base44.entities.BorrowRequest.update(l.id, { status: "Cancelled" });
    }
    await audit({
      action: "request_cancelled",
      ref: g.ref,
      entity: "BorrowRequest",
      detail: `Cancelled at the kiosk by ${borrower.full_name}`,
      actor: borrower.full_name,
    });
    toast.success("Request cancelled");
    qc.invalidateQueries({ queryKey: ["my-requests", borrower.id] });
    qc.invalidateQueries({ queryKey: ["counter-queue"] });
  };

  return (
    <section className="rounded-xl border bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-slate-900">My requests</h2>
        <span className="text-xs text-slate-500">{groups.length}</span>
      </header>
      <div className="max-h-96 divide-y overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {!isLoading && groups.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No requests yet. Pick a tool above and send it in.</p>
        )}
        {groups.map((g) => (
          <div key={g.ref} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-mono text-xs font-semibold text-[#14306b]">{g.ref}</div>
                <div className="text-xs text-slate-500">
                  sent {format(new Date(g.requested_at), "MMM d, h:mm a")}
                  {g.needed_until ? ` · until ${format(new Date(`${g.needed_until}T12:00`), "MMM d")}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_TONE[g.status] || ""}>
                  {g.status}
                </Badge>
                {g.status === "Pending Release" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(g)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {g.status === "Pending Release" && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Collect within {countdown(remainingMs(g, now))} or the request expires
              </p>
            )}
            {g.status === "In Progress" && (
              <p className="mt-1 text-xs text-blue-700">The tool room is preparing your tools.</p>
            )}
            {g.status === "Partially Released" && (
              <p className="mt-1 text-xs text-indigo-700">Partially released — the remaining tools are still pending.</p>
            )}

            <div className="mt-2 space-y-1 text-slate-700">
              {g.lines.map((l) => {
                const released = l.released_qty || 0;
                const pending = Math.max(0, (l.qty || 0) - released);
                return (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {l.item_name} <span className="font-mono text-xs text-slate-500">{l.asset_tag}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      requested {l.qty}
                      {released ? ` · released ${released}` : ""}
                      {released && pending ? ` · pending ${pending}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
