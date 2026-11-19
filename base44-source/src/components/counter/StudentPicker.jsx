import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";

export default function StudentPicker({ borrowers, onPick, title, hint }) {
  const [q, setQ] = useState("");
  const list = borrowers
    .filter((b) =>
      !q
        ? true
        : [b.full_name, b.id_number, b.rfid_tag, b.course_section].some((v) =>
            (v || "").toLowerCase().includes(q.toLowerCase())
          )
    )
    .slice(0, 8);

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#14306b]" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title || "No student identified yet"}</h2>
          <p className="text-xs text-slate-500">
            {hint || "Scan the student's RFID card or QR code above, or find them in the list."}
          </p>
        </div>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, student ID, or section" />
      <div className="mt-2 max-h-60 divide-y overflow-y-auto rounded-lg border">
        {list.length === 0 && <p className="p-3 text-sm text-slate-500">No matching student.</p>}
        {list.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="font-medium text-slate-900">{b.full_name}</span>
              <span className="ml-2 font-mono text-xs text-slate-500">{b.id_number}</span>
              <span className="block text-xs text-slate-500">{b.course_section || "No section"}</span>
            </span>
            <span className="text-xs font-medium text-[#14306b]">Select</span>
          </button>
        ))}
      </div>
    </section>
  );
}
