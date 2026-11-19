import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { printBorrowSlip } from "@/lib/printSlip";

export default function BorrowSlipDialog({ slip, onClose }) {
  return (
    <Dialog open={!!slip} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Borrow slip — {slip?.trans_no}</DialogTitle>
        </DialogHeader>
        {slip && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="font-semibold text-slate-900">{slip.borrower.full_name}</div>
              <div className="font-mono text-xs text-slate-500">
                {slip.borrower.id_number} · {slip.borrower.course_section || "—"}
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-500">
                {slip.group.ref} · {format(new Date(slip.issuedAt), "MMM d, h:mm a")}
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {slip.loans.map((l) => (
                <div key={l.asset_tag} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <b>{l.name}</b> <span className="font-mono text-xs text-slate-500">{l.asset_tag}</span>
                  </span>
                  <span className="text-xs text-slate-600">
                    ×{l.qty} · {l.condition}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Due {format(new Date(slip.dueIso), "MMM d, h:mm a")} · Released by {slip.toolkeeper} ·{" "}
              {slip.status === "Completed" ? "Request completed" : "Partial release — remaining tools stay pending"}
            </p>
            {slip.overrideNotes && slip.overrideNotes.length > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                {slip.overrideNotes.join(" · ")}
              </p>
            )}
            <Button onClick={() => printBorrowSlip(slip)} className="w-full bg-[#14306b] hover:bg-[#0e2350]">
              <Printer className="mr-2 h-4 w-4" /> Print slip
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
