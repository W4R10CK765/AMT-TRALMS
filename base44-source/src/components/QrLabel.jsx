import React from "react";
import { Button } from "@/components/ui/button";

export default function QrLabel({ item }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(item.asset_tag)}`;
  return (
    <div>
      <div id="label-print" className="mx-auto w-64 rounded border-2 border-[#14306b] p-3 text-center text-sm">
        <div className="font-bold text-[#14306b]">WCC ATC – AMT TOOL ROOM</div>
        <img src={url} alt={`QR ${item.asset_tag}`} className="mx-auto my-2 h-36 w-36" />
        <div>Asset Tag: <b>{item.asset_tag}</b></div>
        <div>Item: {item.name}</div>
        <div>Location: {item.location || "—"}</div>
      </div>
      <Button className="mt-4 w-full" onClick={() => window.print()}>Print</Button>
    </div>
  );
}
