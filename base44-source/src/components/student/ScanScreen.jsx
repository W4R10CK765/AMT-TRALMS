import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScanLine, CreditCard, UserPlus, ShieldCheck } from "lucide-react";
import QrCamera from "@/components/student/QrCamera";
import { findBorrowerByCode, parseBorrowerQr } from "@/lib/borrowerQr";

const findBorrower = (value) => findBorrowerByCode(value);

export default function ScanScreen({ onIdentified }) {
  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [form, setForm] = useState({ full_name: "", course: "", section: "", email: "", contact: "" });

  const refocus = () => setTimeout(() => inputRef.current && inputRef.current.focus(), 50);

  const scanValue = async (raw) => {
    const value = (raw || "").trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      const found = await findBorrower(value);
      if (found && found.status !== "Active") {
        setError("This borrower account is inactive. Please see the tool room staff.");
        setCode("");
        refocus();
      } else if (found) {
        onIdentified(found);
      } else {
        const payload = parseBorrowerQr(value);
        setPending({ code: payload ? payload.id_number || value : value, payload });
        setForm(
          payload
            ? {
                full_name: payload.full_name,
                course: payload.course,
                section: payload.section,
                email: payload.email,
                contact: payload.contact,
              }
            : { full_name: "", course: "", section: "", email: "", contact: "" }
        );
      }
    } catch (err) {
      setError(err.message || "Could not read that card. Please try again.");
      refocus();
    }
    setBusy(false);
  };

  const register = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const existing = await findBorrower(pending.code);
      if (existing) return onIdentified(existing);
      const created = await base44.entities.Borrower.create({
        full_name: form.full_name.trim(),
        id_number: pending.code,
        rfid_tag: pending.payload?.rfid_tag || pending.code,
        borrower_type: pending.payload?.borrower_type || "Student",
        course: form.course.trim(),
        section: form.section.trim(),
        course_section: [form.course.trim(), form.section.trim()].filter(Boolean).join(" - "),
        email: form.email.trim(),
        contact: form.contact.trim(),
        status: "Active",
      });
      onIdentified(created);
    } catch (err) {
      setError(err.message || "Could not save your profile. Please ask the tool room staff for help.");
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#14306b]">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-3 text-white">
          <div className="h-9 w-1.5 rounded bg-red-500" />
          <div>
            <div className="text-lg font-semibold">AMT-TRALMS</div>
            <div className="text-xs text-blue-100">WCC ATC North Manila · Dept. of Aircraft Maintenance Technology</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          {!pending ? (
            <>
              <div className="mb-6 flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e4ebf8] text-[#14306b]">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="font-heading text-xl font-semibold text-slate-900">Scan to start</h1>
                  <p className="text-sm text-slate-600">
                    Hold your student QR code in front of the camera below, or tap your RFID card on the reader.
                  </p>
                </div>
              </div>

              <QrCamera onScan={scanValue} className="mb-5 h-56 md:h-64" />

              <form onSubmit={(e) => { e.preventDefault(); scanValue(code); }} className="space-y-3">
                <div>
                  <Label htmlFor="scan">Card or QR value</Label>
                  <Input
                    id="scan"
                    ref={inputRef}
                    autoFocus
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Waiting for a scan…"
                    className="h-12 font-mono text-base"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" size="lg" className="w-full bg-[#14306b] hover:bg-[#0e2350]" disabled={busy || !code.trim()}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  {busy ? "Checking…" : "Continue"}
                </Button>
              </form>

              <p className="mt-5 flex items-start gap-2 text-xs text-slate-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                First time here? Scanning registers your profile automatically — the tool room confirms it before releasing anything.
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e4ebf8] text-[#14306b]">
                  <UserPlus className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="font-heading text-xl font-semibold text-slate-900">New borrower</h1>
                  <p className="text-sm text-slate-600">This card is not on file yet. Fill in your details to register.</p>
                </div>
              </div>

              <form onSubmit={register} className="space-y-3">
                <div>
                  <Label>Card / QR value</Label>
                  <p className="rounded-md border bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">{pending.code}</p>
                </div>
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="course">Course</Label>
                    <Input id="course" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="BSAMT" />
                  </div>
                  <div>
                    <Label htmlFor="section">Section</Label>
                    <Input id="section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="2-B" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@wcc.edu.ph" />
                  </div>
                  <div>
                    <Label htmlFor="contact">Contact number</Label>
                    <Input id="contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => { setPending(null); setError(""); refocus(); }}>Back</Button>
                  <Button type="submit" className="flex-1 bg-[#14306b] hover:bg-[#0e2350]" disabled={busy || !form.full_name.trim()}>
                    {busy ? "Registering…" : "Register and continue"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-blue-100">
          Having trouble scanning? Ask the tool room staff to look up your record.
        </p>
      </div>
    </div>
  );
}
