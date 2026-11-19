import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Clock, ListOrdered } from "lucide-react";
import { countdown, remainingMs, STATUS_TONE } from "@/lib/requests";

export default function ReleaseQueue({ groups = [], activeRef, now, onProcess }) {
  return (
    <section className="flex h-full flex-col rounded-xl border bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ListOrdered className="h-4 w-4 text-[#14306b]" /> Live borrow queue
          </h2>
          <p className="text-xs text-slate-500">Pre-borrow requests, oldest first</p>
        </div>
        <span className="rounded-full bg-[#e4ebf8] px-2.5 py-1 text-xs font-semibold text-[#14306b]">
          {groups.length}
        </span>
      </header>

      <div className="max-h-[36rem] flex-1 divide-y overflow-y-auto">
        {groups.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No active requests. Students submit them at the kiosk.</p>
        )}
        {groups.map((g) => {
          const pending = g.status === "Pending Release";
          const pct = g.requestedTotal ? Math.round((g.releasedTotal / g.requestedTotal) * 100) : 0;
          const active = g.ref === activeRef;
          return (
            <div key={g.ref} className={`p-4 text-sm ${active ? "bg-[#f4f7fd]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{g.borrower_name}</div>
                  <div className="font-mono text-xs text-slate-500">
                    {g.id_number}
                    {g.course_section ? ` · ${g.course_section}` : ""}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-400">{g.ref}</div>
                </div>
                <Badge variant="outline" className={STATUS_TONE[g.status] || ""}>
                  {g.status}
                </Badge>
              </div>

              <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                {g.lines.map((l) => (
                  <div key={l.id}>
                    {l.item_name} × {l.qty}
                    {l.released_qty ? <span className="text-slate-400"> ({l.released_qty} released)</span> : null}
                  </div>
                ))}
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#14306b]" style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  {pending ? (
                    <>
                      <Clock className="h-3 w-3" /> {countdown(remainingMs(g, now))} left
                    </>
                  ) : (
                    `${g.releasedTotal}/${g.requestedTotal} released`
                  )}
                </span>
                <Button
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={active ? "bg-[#14306b] hover:bg-[#0e2350]" : ""}
                  onClick={() => onProcess(g)}
                >
                  {pending ? "Start processing" : "Resume"}
                </Button>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Submitted {format(new Date(g.requested_at), "MMM d, h:mm a")}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
