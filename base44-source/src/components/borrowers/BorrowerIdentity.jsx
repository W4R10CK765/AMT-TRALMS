import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const typeTone = {
  Student: "border-blue-200 bg-blue-50 text-blue-700",
  Instructor: "border-purple-200 bg-purple-50 text-purple-700",
};

export default function BorrowerIdentity({ borrower }) {
  const rows = [
    ["Name", borrower.full_name],
    [borrower.borrower_type === "Instructor" ? "Employee ID no." : "Student ID no.", borrower.id_number],
    ["Course", borrower.course || borrower.course_section || "—"],
    ["Section", borrower.section || "—"],
    ["Email", borrower.email || "—"],
    ["Contact", borrower.contact || "—"],
    ["RFID / card value", borrower.rfid_tag || "—"],
  ];

  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-lg font-semibold text-slate-900">{borrower.full_name}</h2>
        <Badge variant="outline" className={typeTone[borrower.borrower_type] || "border-slate-200 bg-slate-50 text-slate-600"}>
          {borrower.borrower_type || "Student"}
        </Badge>
        <Badge variant="outline" className={borrower.status === "Active" ? "border-green-600 text-green-700" : "text-slate-500"}>
          {borrower.status}
        </Badge>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-sm text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
      {borrower.restrictions && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Restriction: {borrower.restrictions}
        </p>
      )}
    </section>
  );
}
