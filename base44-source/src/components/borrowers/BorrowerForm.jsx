import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPES = ["Student", "Instructor"];

export default function BorrowerForm({ value, setValue, onSubmit, busy, error }) {
  const set = (k) => (e) => setValue({ ...value, [k]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="mb-3 rounded-xl border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a borrower</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label htmlFor="b-name">Full name</Label>
          <Input id="b-name" required value={value.full_name} onChange={set("full_name")} placeholder="Adrian Nicolas Lim" />
        </div>
        <div>
          <Label>Borrower type</Label>
          <Select value={value.borrower_type} onValueChange={(v) => setValue({ ...value, borrower_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="b-id">Student / employee ID no.</Label>
          <Input id="b-id" required value={value.id_number} onChange={set("id_number")} placeholder="23-CC0461" />
        </div>
        <div>
          <Label htmlFor="b-course">Course</Label>
          <Input id="b-course" value={value.course} onChange={set("course")} placeholder="BSAMT" />
        </div>
        <div>
          <Label htmlFor="b-section">Section</Label>
          <Input id="b-section" value={value.section} onChange={set("section")} placeholder="4J" />
        </div>
        <div>
          <Label htmlFor="b-email">Email</Label>
          <Input id="b-email" type="email" value={value.email} onChange={set("email")} placeholder="name@wcc.edu.ph" />
        </div>
        <div>
          <Label htmlFor="b-contact">Contact number</Label>
          <Input id="b-contact" value={value.contact} onChange={set("contact")} placeholder="09xx xxx xxxx" />
        </div>
        <div className="flex items-end lg:col-span-4">
          <Button className="w-full bg-[#14306b] hover:bg-[#0e2350] sm:w-auto" disabled={busy}>
            {busy ? "Saving…" : "Add borrower"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
