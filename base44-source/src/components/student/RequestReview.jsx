import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { newRequestRef, QUEUE_WINDOW_MS } from "@/lib/requests";
import { audit } from "@/lib/audit";

export default function RequestReview({ open, onOpenChange, borrower, lines, setQty, onRemove, onSubmitted }) {
  const [purpose, setPurpose] = useState("");
  const [until, setUntil] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!purpose.trim()) return setErr("Please state what you will use the tools for.");
    setBusy(true);
    setErr("");
    try {
      const ref = newRequestRef();
      const now = new Date();
      const expires_at = new Date(now.getTime() + QUEUE_WINDOW_MS).toISOString();
      await base44.entities.BorrowRequest.bulkCreate(
        lines.map(({ item, qty }) => ({
          request_ref: ref,
          borrower_id: borrower.id,
          borrower_name: borrower.full_name,
          id_number: borrower.id_number,
          course_section: borrower.course_section,
          contact: borrower.contact,
          item_id: item.id,
          asset_tag: item.asset_tag,
          item_name: item.name,
          qty,
          released_qty: 0,
          purpose: purpose.trim(),
          needed_until: until,
          requested_at: now.toISOString(),
          expires_at,
          status: "Pending Release",
        }))
      );
      await audit({
        action: "request_submitted",
        ref,
        entity: "BorrowRequest",
        detail: lines.map((l) => `${l.item.name} × ${l.qty}`).join(", "),
        actor: borrower.full_name,
      });
      toast.success(`Request ${ref} sent — collect it at the counter within 5 minutes`);
      setPurpose("");
      onSubmitted(ref);
    } catch (e) {
      setErr(e.message || "Could not send the request. Please try again.");
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review your request</DialogTitle>
        </DialogHeader>

        <div className="divide-y rounded-lg border">
          {lines.length === 0 && <p className="p-3 text-sm text-slate-500">Nothing selected.</p>}
          {lines.map(({ item, qty }) => (
            <div key={item.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{item.name}</div>
                <div className="font-mono text-xs text-slate-500">
                  {item.asset_tag} · {item.qty_available} available
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.id, Math.max(1, qty - 1))} aria-label="Decrease">
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center font-mono">{qty}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(item.id, Math.min(item.qty_available, qty + 1))} aria-label="Increase">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Aircraft sheet metal lab, troubleshooting activity" />
          </div>
          <div>
            <Label htmlFor="until">Needed until</Label>
            <Input id="until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This is a pre-borrow request. Nothing is deducted yet — the toolkeeper releases the tools only after scanning
            each one at the counter. Collect it within 5 minutes or the request expires.
          </p>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button className="w-full bg-[#14306b] hover:bg-[#0e2350]" disabled={busy || lines.length === 0} onClick={submit}>
            {busy ? "Sending…" : "Send request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
