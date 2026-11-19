import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const blank = { asset_tag: "", name: "", category: "", brand_model: "", serial_no: "", location: "", qty_total: 1, min_stock: 0, is_consumable: false, calibration_required: false, calibration_due: "" };

export default function ItemForm({ onSaved }) {
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const dup = await base44.entities.Item.filter({ asset_tag: f.asset_tag }, { limit: 1 });
    if (dup.items.length) { setErr("Asset tag already exists."); setBusy(false); return; }
    const qty = Number(f.qty_total) || 1;
    const data = { ...f, qty_total: qty, qty_available: qty, min_stock: Number(f.min_stock) || 0 };
    if (!data.calibration_due) delete data.calibration_due;
    await base44.entities.Item.create(data);
    setF(blank); setBusy(false); onSaved();
  };

  const field = (k, label, type = "text", req = false) => (
    <div><Label>{label}</Label><Input type={type} required={req} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {field("asset_tag", "Asset tag", "text", true)}
        {field("name", "Item name", "text", true)}
        {field("category", "Category")}
        {field("brand_model", "Brand / model")}
        {field("serial_no", "Serial no.")}
        {field("location", "Location")}
        {field("qty_total", "Quantity", "number")}
        {field("min_stock", "Min stock (consumables)", "number")}
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.is_consumable} onCheckedChange={(v) => set("is_consumable", !!v)} /> Consumable</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.calibration_required} onCheckedChange={(v) => set("calibration_required", !!v)} /> Calibration required</label>
      {f.calibration_required && field("calibration_due", "Calibration due", "date")}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button disabled={busy} className="w-full">{busy ? "Saving…" : "Register item"}</Button>
    </form>
  );
}
