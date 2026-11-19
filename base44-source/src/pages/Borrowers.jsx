import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import BorrowerForm from "@/components/borrowers/BorrowerForm";
import BorrowerTable from "@/components/borrowers/BorrowerTable";
import BorrowerQrDialog from "@/components/borrowers/BorrowerQrDialog";

const EMPTY = {
  full_name: "",
  borrower_type: "Student",
  id_number: "",
  course: "",
  section: "",
  email: "",
  contact: "",
};

const combined = (f) => [f.course.trim(), f.section.trim()].filter(Boolean).join(" - ");

export default function Borrowers() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["borrowers"],
    queryFn: async () => (await base44.entities.Borrower.filter({}, { sort: "full_name", limit: 300 })).items,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["borrowers"] });

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const dup = await base44.entities.Borrower.filter({ id_number: form.id_number.trim() }, { limit: 1 });
      if (dup.items.length) {
        setErr("ID number already registered.");
        setBusy(false);
        return;
      }
      await base44.entities.Borrower.create({
        full_name: form.full_name.trim(),
        borrower_type: form.borrower_type,
        id_number: form.id_number.trim(),
        course: form.course.trim(),
        section: form.section.trim(),
        course_section: combined(form),
        email: form.email.trim(),
        contact: form.contact.trim(),
        status: "Active",
      });
      setForm(EMPTY);
      refresh();
    } catch (e2) {
      setErr(e2.message || "Could not save this borrower.");
    }
    setBusy(false);
  };

  const toggle = async (b) => {
    await base44.entities.Borrower.update(b.id, { status: b.status === "Active" ? "Inactive" : "Active" });
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Borrowers</h1>
      <BorrowerForm value={form} setValue={setForm} onSubmit={add} busy={busy} error={err} />
      <BorrowerTable borrowers={data} isLoading={isLoading} onToggle={toggle} onShowQr={setQr} />
      <BorrowerQrDialog borrower={qr} onOpenChange={(open) => !open && setQr(null)} />
    </div>
  );
}
