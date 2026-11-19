import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import BorrowerIdentity from "@/components/borrowers/BorrowerIdentity";
import BorrowerQr from "@/components/borrowers/BorrowerQr";
import BorrowerHistory from "@/components/borrowers/BorrowerHistory";

export default function BorrowerProfile() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["borrower", id],
    queryFn: async () => {
      const borrower = await base44.entities.Borrower.get(id).catch(() => null);
      if (!borrower) return null;
      const [loans, requests] = await Promise.all([
        base44.entities.Loan.filter({ borrower_id: id }, { sort: "-issued_at", limit: 50 }),
        base44.entities.BorrowRequest.filter({ borrower_id: id }, { sort: "-requested_at", limit: 30 }),
      ]);
      return { borrower, loans: loans.items, requests: requests.items };
    },
  });

  const missing = !isLoading && !data;

  useEffect(() => {
    if (!missing) return;
    const meta = document.createElement("meta");
    meta.name = "prerender-status-code";
    meta.content = "404";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [missing]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading borrower…</p>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <h1 className="text-xl font-semibold text-slate-900">Borrower not found</h1>
        <p className="text-sm text-slate-600">This borrower record no longer exists.</p>
        <Button variant="outline" asChild>
          <Link to="/borrowers">
            <ArrowLeft className="h-4 w-4" />
            Back to borrowers
          </Link>
        </Button>
      </div>
    );
  }

  const openLoans = data.loans.filter((l) => l.status === "Open" || l.status === "Partial").length;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/borrowers">
            <ArrowLeft className="h-4 w-4" />
            Borrowers
          </Link>
        </Button>
        <div className="flex gap-2 text-xs text-slate-600">
          <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">{openLoans} open loan{openLoans === 1 ? "" : "s"}</span>
          <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">{data.requests.length} request{data.requests.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BorrowerIdentity borrower={data.borrower} />
        </div>
        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 font-heading text-sm font-semibold text-slate-900">Borrower QR code</h2>
          <BorrowerQr borrower={data.borrower} />
        </section>
      </div>

      <BorrowerHistory loans={data.loans} requests={data.requests} isLoading={isLoading} />
    </div>
  );
}
