import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, UserRound } from "lucide-react";

const typeTone = {
  Student: "border-blue-200 bg-blue-50 text-blue-700",
  Instructor: "border-purple-200 bg-purple-50 text-purple-700",
};

export default function BorrowerTable({ borrowers = [], isLoading, onToggle, onShowQr }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-[#14306b] text-left text-white">
          <tr>
            {["Borrower", "ID no.", "Course", "Section", "Email", "Contact", "Status", ""].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={8} className="p-4 text-slate-500">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && borrowers.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4 text-slate-500">
                No borrowers yet.
              </td>
            </tr>
          )}
          {borrowers.map((b) => (
            <tr key={b.id} className="border-t align-top">
              <td className="px-3 py-2">
                <Link to={`/borrowers/${b.id}`} className="font-medium text-slate-900 hover:text-[#14306b] hover:underline">
                  {b.full_name}
                </Link>
                <span className="mt-1 block">
                  <Badge variant="outline" className={typeTone[b.borrower_type] || "border-slate-200 bg-slate-50 text-slate-600"}>
                    {b.borrower_type || "Student"}
                  </Badge>
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{b.id_number}</td>
              <td className="px-3 py-2">{b.course || "—"}</td>
              <td className="px-3 py-2">{b.section || "—"}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{b.email || "—"}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{b.contact || "—"}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className={b.status === "Active" ? "border-green-600 text-green-700" : "text-slate-500"}>
                  {b.status}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onShowQr(b)}>
                    <QrCode className="h-4 w-4" />
                    QR
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/borrowers/${b.id}`}>
                      <UserRound className="h-4 w-4" />
                      Profile
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onToggle(b)}>
                    {b.status === "Active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
