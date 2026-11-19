import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BorrowerQr from "@/components/borrowers/BorrowerQr";

export default function BorrowerQrDialog({ borrower, onOpenChange }) {
  return (
    <Dialog open={!!borrower} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{borrower?.full_name}</DialogTitle>
        </DialogHeader>
        {borrower && <BorrowerQr borrower={borrower} />}
      </DialogContent>
    </Dialog>
  );
}
