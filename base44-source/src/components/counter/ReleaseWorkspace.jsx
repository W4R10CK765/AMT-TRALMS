import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { AlertTriangle, Clock, ScanLine, X } from "lucide-react";
import StudentProfile from "@/components/counter/StudentProfile";
import { countdown, remainingMs, STATUS_TONE } from "@/lib/requests";

function LineRow({ line }) {
  const released = line.released_qty || 0;
  const remaining = Math.max(0, (line.qty || 0) - released);
  const pct = line.qty ? Math.round((released / line.qty) * 100) : 0;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-900">{line.item_name}</div>
        <div className="font-mono text-[11px] text-slate-500">{line.asset_tag}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right text-xs">
        <div className="text-slate-500">
          requested <b className="text-slate-800">{line.qty}</b>
        </div>
        <div className="text-green-700">released {released}</div>
        <div className={remaining ? "text-amber-700" : "text-slate-400"}>remaining {remaining}</div>
      </div>
    </div>
  );
}

export default function ReleaseWorkspace({
  student,
  openLoans = [],
  requests = [],
  activeGroup,
  staged = [],
  due,
  setDue,
  now,
  onSelect,
  onRemoveStaged,
  onCommit,
  busy,
  override,
  onOverrideReason,
  onOverrideConfirm,
  onOverrideCancel,
  onClear,
}) {
  return (
    <div className="space-y-4">
      <StudentProfile
        student={student}
        openLoans={openLoans.length}
        pendingCount={requests.length}
        onClear={onClear}
      />

      {openLoans.length > 0 && (
        <section className="rounded-xl border bg-white p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Currently on loan</h3>
          <div className="space-y-1 text-sm text-slate-700">
            {openLoans.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {l.item_name} <span className="font-mono text-xs text-slate-500">{l.asset_tag}</span>
                </span>
                <span className="text-xs text-slate-500">
                  ×{l.qty_issued - (l.qty_returned || 0)} · due{" "}
                  {l.expected_return_at ? format(new Date(l.expected_return_at), "MMM d, h:mm a") : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Request release</h2>
          {requests.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {requests.map((g) => (
                <button
                  key={g.ref}
                  onClick={() => onSelect(g.ref)}
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
                    g.ref === activeGroup?.ref
                      ? "border-[#14306b] bg-[#14306b] text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {g.ref}
                </button>
              ))}
            </div>
          )}
        </header>

        {!activeGroup ? (
          <p className="p-4 text-sm text-slate-500">
            No open request for this student. Ask them to submit one at the kiosk — scanning a tool alone never creates a
            loan.
          </p>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[#14306b]">{activeGroup.ref}</span>
                  <Badge variant="outline" className={STATUS_TONE[activeGroup.status] || ""}>
                    {activeGroup.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {activeGroup.purpose || "No purpose given"}
                  {activeGroup.needed_until
                    ? ` · needed until ${format(new Date(`${activeGroup.needed_until}T12:00`), "MMM d")}`
                    : ""}
                  {` · submitted ${format(new Date(activeGroup.requested_at), "MMM d, h:mm a")}`}
                </div>
              </div>
              {activeGroup.status === "Pending Release" ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" /> {countdown(remainingMs(activeGroup, now))} to start
                </span>
              ) : (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Timer stopped
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="due">Due back</Label>
                <Input
                  id="due"
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-56"
                />
              </div>
              <p className="flex items-center gap-1.5 pb-2 text-xs text-slate-500">
                <ScanLine className="h-3.5 w-3.5" /> Only physically scanned tools are released.
              </p>
            </div>

            <div className="divide-y rounded-lg border">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Requested tools · {activeGroup.releasedTotal}/{activeGroup.requestedTotal} released
              </div>
              {activeGroup.lines.map((l) => (
                <LineRow key={l.id} line={l} />
              ))}
            </div>

            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Scanned this session ({staged.length})
              </div>
              {staged.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">No tools scanned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {staged.map((s, i) => (
                    <span
                      key={`${s.item.id}-${i}`}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                        s.override
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-green-200 bg-green-50 text-green-800"
                      }`}
                    >
                      {s.item.name}
                      <span className="font-mono text-[10px] opacity-70">{s.item.asset_tag}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveStaged(i)}
                        aria-label="Remove scan"
                        className="rounded p-0.5 hover:bg-white/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {override && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" /> Override restriction — {override.item.name} (
                  {override.item.asset_tag})
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    value={override.reason}
                    onChange={(e) => onOverrideReason(e.target.value)}
                    placeholder="Reason for the override (recorded in the audit log)"
                    className="min-w-[12rem] flex-1 bg-white"
                  />
                  <Button size="sm" onClick={onOverrideConfirm} className="bg-amber-600 hover:bg-amber-700">
                    Record override &amp; stage
                  </Button>
                  <Button size="sm" variant="outline" onClick={onOverrideCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-xs text-slate-500">
                Releasing {staged.length} of {activeGroup.requestedTotal} requested. Anything not released stays pending on
                this request.
              </p>
              <Button
                disabled={busy || staged.length === 0}
                onClick={onCommit}
                className="bg-[#14306b] hover:bg-[#0e2350]"
              >
                {busy ? "Releasing…" : staged.length ? `Release ${staged.length} scanned tool(s)` : "Release scanned tools"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
