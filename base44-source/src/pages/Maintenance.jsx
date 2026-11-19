import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";

const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export default function Maintenance() {
  const qc = useQueryClient();
  const [tag, setTag] = useState("");
  const [type, setType] = useState("Maintenance");
  const [findings, setFindings] = useState("");
  const { data: logs = [] } = useQuery({ queryKey: ["maint"], queryFn: async () => (await base44.entities.MaintenanceLog.filter({}, { sort: "-created_date", limit: 100 })).items });
  const { data: calib = [] } = useQuery({ queryKey: ["calib"], queryFn: async () => (await base44.entities.Item.filter({ calibration_required: true, status: { $ne: "Retired" } }, { sort: "calibration_due", limit: 100 })).items });
  const refresh = () => qc.invalidateQueries();

  const create = async (e) => {
    e.preventDefault();
    const item = (await base44.entities.Item.filter({ asset_tag: tag.trim() }, { limit: 1 })).items[0];
    if (!item) return toast.error("Asset tag not found");
    await base44.entities.MaintenanceLog.create({ item_id: item.id, asset_tag: item.asset_tag, item_name: item.name, type, findings, start_date: format(new Date(), "yyyy-MM-dd"), status: "Open" });
    await base44.entities.Item.update(item.id, { status: "Under Maintenance" });
    setTag(""); setFindings(""); refresh();
  };
  const complete = async (m) => {
    await base44.entities.MaintenanceLog.update(m.id, { status: "Completed" });
    await base44.entities.Item.update(m.item_id, { status: "Active" });
    refresh();
  };
  const recalibrate = async (it) => {
    await base44.entities.Item.update(it.id, { calibration_due: format(new Date(Date.now() + 365 * 864e5), "yyyy-MM-dd") });
    toast.success("Calibration renewed for 1 year"); refresh();
  };
  const tone = (d) => (d < 0 ? "OVERDUE" : d <= 30 ? "DUE SOON" : "OK");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Maintenance & Calibration</h1>
      <form onSubmit={create} className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-5">
        <Input required placeholder="Asset tag" value={tag} onChange={(e) => setTag(e.target.value)} />
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>{["Maintenance", "Calibration", "Repair"].map((x) => <option key={x}>{x}</option>)}</select>
        <Input className="sm:col-span-2" placeholder="Findings" value={findings} onChange={(e) => setFindings(e.target.value)} />
        <Button>Log work</Button>
      </form>
      <section>
        <h2 className="mb-2 font-semibold">Maintenance records</h2>
        <div className="divide-y rounded-xl border bg-white">
          {logs.length === 0 && <p className="p-4 text-sm text-slate-500">No records.</p>}
          {logs.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><b>{m.item_name}</b> <span className="font-mono text-xs text-slate-500">{m.asset_tag}</span> · {m.type} · {m.findings}</span>
              {m.status === "Open" ? <Button size="sm" variant="outline" onClick={() => complete(m)}>Mark complete</Button> : <Badge variant="outline">Completed</Badge>}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Calibration schedule</h2>
        <div className="divide-y rounded-xl border bg-white">
          {calib.length === 0 && <p className="p-4 text-sm text-slate-500">No calibration-controlled items.</p>}
          {calib.map((it) => {
            const d = it.calibration_due ? differenceInCalendarDays(new Date(it.calibration_due), new Date()) : null;
            return (
              <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><b>{it.name}</b> <span className="font-mono text-xs text-slate-500">{it.asset_tag}</span></span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={d !== null && d < 0 ? "border-red-600 text-red-700" : d !== null && d <= 30 ? "border-amber-600 text-amber-700" : "border-green-700 text-green-800"}>
                    {d === null ? "No date" : `${tone(d)} · ${d < 0 ? `${-d}d overdue` : `${d}d left`}`}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => recalibrate(it)}>Calibrated today</Button>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
