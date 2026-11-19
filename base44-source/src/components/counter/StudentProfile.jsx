import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserRound } from "lucide-react";

export default function StudentProfile({ student, openLoans = 0, pendingCount = 0, onClear }) {
  const inactive = student.status !== "Active";
  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e4ebf8] text-[#14306b]">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{student.full_name}</h2>
              <Badge
                variant="outline"
                className={inactive ? "border-slate-300 text-slate-500" : "border-green-600 text-green-700"}
              >
                {student.status}
              </Badge>
            </div>
            <p className="font-mono text-xs text-slate-500">
              {student.id_number}
              {student.rfid_tag ? ` · RFID ${student.rfid_tag}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              {student.course_section || "No course / section"}
              {student.contact ? ` · ${student.contact}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {openLoans} open loan{openLoans === 1 ? "" : "s"} · {pendingCount} request{pendingCount === 1 ? "" : "s"}
          </span>
          {onClear && (
            <Button size="sm" variant="outline" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {student.restrictions && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Restriction: {student.restrictions}
        </p>
      )}
      {inactive && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Inactive borrower — releases are blocked until the
          record is reactivated.
        </p>
      )}
    </section>
  );
}
