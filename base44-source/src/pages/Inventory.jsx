import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import ItemForm from "@/components/ItemForm";
import QRCode from "@/components/QrLabel";

export default function Inventory() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["items", q], queryFn: async () => {
    const rx = q ? { $regex: q, $options: "i" } : null;
    const query = rx ? { $or: [{ name: rx }, { asset_tag: rx }, { category: rx }, { serial_no: rx }] } : {};
    return (await base44.entities.Item.filter(query, { sort: "asset_tag", limit: 200 })).items;
  } });
  const retire = async (it) => { await base44.entities.Item.update(it.id, { status: "Retired" }); qc.invalidateQueries({ queryKey: ["items"] }); };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add item</Button>
      </div>
      <Input placeholder="Search tag, name, category, serial…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md" />
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#14306b] text-left text-white"><tr>{["Asset tag", "Item", "Category", "Location", "Avail / Total", "Status", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-slate-500">Loading…</td></tr>}
            {data?.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">No items yet. Add your first item.</td></tr>}
            {data?.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{it.asset_tag}</td>
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2">{it.category}</td>
                <td className="px-3 py-2">{it.location}</td>
                <td className="px-3 py-2">{it.qty_available} / {it.qty_total}</td>
                <td className="px-3 py-2"><Badge variant="outline">{it.status}</Badge></td>
                <td className="space-x-1 px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setLabel(it)}>Label</Button>
                  {it.status !== "Retired" && <Button size="sm" variant="ghost" onClick={() => retire(it)}>Retire</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Register item</DialogTitle></DialogHeader>
          <ItemForm onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["items"] }); }} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!label} onOpenChange={() => setLabel(null)}>
        <DialogContent><DialogHeader><DialogTitle>Asset label</DialogTitle></DialogHeader>{label && <QRCode item={label} />}</DialogContent>
      </Dialog>
    </div>
  );
}
