import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import StudentProfile from "@/components/counter/StudentProfile";

export default function ReturnsPanel({ student, loans = [], selected, onSelect, onConfirm, busy, onClear }) {
  const [qty, setQty] = useState(1);
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");
  const selectedId = selected ? selected.id : null;
  const outstanding = selected ? (selected.qty_issued || 0) - (selected.qty_returned || 0) : 0;

  useEffect(() => {
    if (!selectedId) return;
    setQty((selected.qty_issued || 0) - (selected.qty_returned || 0));
    setCondition("Good");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <StudentProfile student={student} openLoans={loans.length} pendingCount={0} onClear={onClear} />

      <section className="rounded-xl border bg-white">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Tools on loan</h2>
          <p className="text-xs text-slate-500">Scan the tool's QR/barcode above, or pick the loan below.</p>
        </header>
        <div className="divide-y">
          {loans.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing outstanding for this student.</p>}
          {loans.map((l) => {
            const out = (l.qty_issued || 0) - (l.qty_returned || 0);
            const overdue = l.expected_return_at && new Date(l.expected_return_at) < new Date();
            return (
              <div
                key={l.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${
                  selected?.id === l.id ? "bg-[#f4f7fd]" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">
                    {l.item_name} × {out}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {l.asset_tag} · {l.request_ref || l.trans_no}
                  </div>
                  <div className="text-xs text-slate-500">
                    due {l.expected_return_at ? format(new Date(l.expected_return_at), "MMM d, h:mm a") : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {l.return_requested && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700">
                      student asked to return
                    </Badge>
                  )}
                  {overdue && (
                    <Badge variant="outline" className="border-red-500 text-red-600">
                      Overdue
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant={selected?.id === l.id ? "default" : "outline"}
                    className={selected?.id === l.id ? "bg-[#14306b] hover:bg-[#0e2350]" : ""}
                    onClick={() => onSelect(l)}
                  >
                    Select
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Confirm return — {selected.item_name}</h2>
          <p className="mb-3 font-mono text-xs text-slate-500">
            {selected.asset_tag} · {outstanding} outstanding
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="rqty">Quantity returned</Label>
              <Input
                id="rqty"
                type="number"
                min={1}
                max={outstanding}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="rcond">Condition</Label>
              <select
                id="rcond"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {["Good", "Fair", "Damaged", "Lost"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rnotes">Notes {condition === "Lost" ? "(required)" : ""}</Label>
              <Input
                id="rnotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={condition === "Lost" ? "Explain the loss" : "Optional"}
              />
            </div>
          </div>
          {condition === "Damaged" && (
            <p className="mt-2 text-xs text-amber-700">
              Damaged tools go under maintenance and stay unavailable until repaired.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {qty < outstanding ? `${outstanding - qty} will stay on loan.` : "This closes the loan line."}
            </p>
            <Button
              disabled={busy || (condition === "Lost" && !notes.trim())}
              onClick={() => onConfirm({ qty, condition, notes })}
              className="bg-[#14306b] hover:bg-[#0e2350]"
            >
              {busy ? "Recording…" : "Confirm return"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
