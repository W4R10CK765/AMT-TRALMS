import React, { useEffect, useRef, useState } from "react";
import QrCamera from "@/components/student/QrCamera";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ScanLine } from "lucide-react";

const CAM = {
  live: { label: "CAMERA ACTIVE", cls: "border-green-200 bg-green-50 text-green-700" },
  starting: { label: "CAMERA STARTING", cls: "border-slate-200 bg-slate-50 text-slate-600" },
  "no-decoder": { label: "CAMERA ON · DECODER UNAVAILABLE", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  blocked: { label: "PERMISSION REQUIRED", cls: "border-red-200 bg-red-50 text-red-700" },
  unavailable: { label: "CAMERA UNAVAILABLE", cls: "border-red-200 bg-red-50 text-red-700" },
};

export default function ScannerBar({ onScan, onCameraStatus, lastError }) {
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [cam, setCam] = useState("starting");
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refocus = () => setTimeout(() => inputRef.current?.focus(), 30);

  const submit = async (e) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setValue("");
    await onScan(v);
    refocus();
  };

  const chip = CAM[cam] || CAM.starting;

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="grid gap-3 md:grid-cols-[15rem_1fr] md:items-center">
        <QrCamera
          className="h-36"
          onScan={async (v) => {
            await onScan(v);
            refocus();
          }}
          onStatusChange={(s) => {
            setCam(s);
            onCameraStatus?.(s);
          }}
        />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                armed ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {armed ? "SCANNER READY" : "SCANNER STANDBY"}
            </span>
            {lastError && (
              <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                <AlertTriangle className="h-3 w-3" /> SCAN ERROR
              </span>
            )}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border bg-white p-1 pl-3">
            <ScanLine className="h-4 w-4 shrink-0 text-[#14306b]" />
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setArmed(true)}
              onBlur={() => setArmed(false)}
              placeholder="Scan a student card or tool tag (USB reader), or type it and press Enter"
              className="border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
            />
            <Button size="sm" variant="outline" type="submit">Enter</Button>
          </form>
          <p className={`text-xs ${lastError ? "text-red-600" : "text-slate-500"}`}>
            {lastError || "The camera scans on its own. RFID readers and USB barcode scanners type into the box — it re-arms after every scan."}
          </p>
        </div>
      </div>
    </div>
  );
}
