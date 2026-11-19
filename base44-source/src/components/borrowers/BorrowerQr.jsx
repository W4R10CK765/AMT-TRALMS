import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { qrImageUrl, downloadQr } from "@/lib/qrCode";
import { printBorrowerQr } from "@/lib/printBorrowerQr";
import { buildBorrowerQr } from "@/lib/borrowerQr";

export default function BorrowerQr({ borrower }) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await downloadQr(borrower.id_number, `QR-${borrower.id_number}.png`);
      toast.success("QR code downloaded");
    } catch (e) {
      toast.error(e.message || "Could not download the QR code.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src={qrImageUrl(buildBorrowerQr(borrower), 320)}
        alt={`QR code for ${borrower.full_name}`}
        className="h-40 w-40 rounded-lg border bg-white object-contain p-1.5"
      />
      <div className="text-center">
        <p className="font-mono text-sm font-semibold text-slate-900">{borrower.id_number}</p>
        <p className="text-xs text-slate-500">Scan at the kiosk or counter</p>
      </div>
      <div className="flex w-full gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => printBorrowerQr(borrower)}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={save}>
          <Download className="h-3.5 w-3.5" />
          {busy ? "Saving…" : "Download"}
        </Button>
      </div>
    </div>
  );
}
