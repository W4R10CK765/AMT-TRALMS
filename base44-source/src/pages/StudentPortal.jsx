import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import ToolOrderMenu from "@/components/student/ToolOrderMenu";
import RequestReview from "@/components/student/RequestReview";
import MyRequests from "@/components/student/MyRequests";
import MyLoans from "@/components/student/MyLoans";
import ScanScreen from "@/components/student/ScanScreen";
import QrCamera from "@/components/student/QrCamera";

const KEY = "amt-student-session";

const readSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};

export default function StudentPortal() {
  const qc = useQueryClient();
  const [borrower, setBorrower] = useState(readSession);
  const [cart, setCart] = useState({});
  const [code, setCode] = useState("");
  const [review, setReview] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["available-items"],
    enabled: !!borrower,
    queryFn: async () =>
      (await base44.entities.Item.filter({ status: "Active", qty_available: { $gt: 0 } }, { sort: "name", limit: 300 })).items,
  });

  const identify = (b) => {
    sessionStorage.setItem(KEY, JSON.stringify(b));
    setBorrower(b);
  };
  const endSession = () => {
    sessionStorage.removeItem(KEY);
    setBorrower(null);
    setCart({});
    setReview(false);
  };

  const add = (item) =>
    setCart((c) => ({ ...c, [item.id]: Math.min((c[item.id] || 0) + 1, item.qty_available) }));
  const setQty = (id, q) => setCart((c) => ({ ...c, [id]: q }));
  const remove = (id) =>
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });

  const lines = items.filter((i) => cart[i.id]).map((i) => ({ item: i, qty: cart[i.id] }));
  const total = lines.reduce((s, l) => s + l.qty, 0);

  if (!borrower) return <ScanScreen onIdentified={identify} />;

  const addByTag = (raw) => {
    const tag = (raw || "").trim().toLowerCase();
    if (!tag) return;
    const hit = items.find((i) => (i.asset_tag || "").toLowerCase() === tag);
    if (!hit) return toast.error("That tool is not available right now");
    add(hit);
    toast.success(`${hit.name} added`);
  };

  const scanTool = (e) => {
    e.preventDefault();
    const typed = code;
    setCode("");
    addByTag(typed);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="h-7 w-1 rounded bg-red-600" />
          <div className="mr-auto leading-tight">
            <div className="text-sm font-semibold text-[#14306b]">Student Tool Room</div>
            <div className="text-[11px] text-slate-500">AMT-TRALMS · WCC ATC North Manila</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
            <BadgeCheck className="h-4 w-4 text-[#14306b]" />
            <span className="font-medium text-slate-900">{borrower.full_name}</span>
            <span className="font-mono text-slate-500">{borrower.id_number}</span>
          </div>
          <Button size="sm" variant="outline" onClick={endSession}>End session</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="rounded-xl border bg-white p-3">
          <div className="grid gap-3 md:grid-cols-[16rem_1fr] md:items-center">
            <QrCamera onScan={addByTag} paused={review} className="h-44" />
            <div className="space-y-2">
              <form onSubmit={scanTool} className="flex items-center gap-2 rounded-lg border bg-white p-1 pl-3">
                <ScanLine className="h-4 w-4 shrink-0 text-[#14306b]" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan a tool's QR label to add it to your request"
                  className="border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
                />
                <Button size="sm" variant="outline" type="submit">Add</Button>
              </form>
              <p className="text-xs text-slate-500">
                The camera stays on — hold a tool's QR label in front of it and the tool is added to your request automatically.
              </p>
            </div>
          </div>
        </div>

        <ToolOrderMenu items={items} qty={cart} total={total} onAdd={add} onReview={() => setReview(true)} />

        <div className="grid gap-4 lg:grid-cols-2">
          <MyRequests borrower={borrower} />
          <MyLoans borrower={borrower} />
        </div>
      </main>

      <RequestReview
        open={review}
        onOpenChange={setReview}
        borrower={borrower}
        lines={lines}
        setQty={setQty}
        onRemove={remove}
        onSubmitted={() => {
          setReview(false);
          setCart({});
          qc.invalidateQueries({ queryKey: ["my-requests", borrower.id] });
          qc.invalidateQueries({ queryKey: ["counter-queue"] });
        }}
      />
    </div>
  );
}
