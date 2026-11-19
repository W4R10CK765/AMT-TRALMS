import { base44 } from "@/api/base44Client";

const HEADER = "AMT-BORROWER|1";

const FIELDS = [
  "id_number",
  "full_name",
  "borrower_type",
  "course",
  "section",
  "course_section",
  "email",
  "contact",
  "rfid_tag",
  "status",
  "restrictions",
];

const clean = (v) =>
  String(v == null ? "" : v)
    .replace(/[|\r\n]+/g, "/")
    .trim();

export function buildBorrowerQr(borrower) {
  return [HEADER, ...FIELDS.map((field) => clean(borrower[field]))].join("|");
}

export function parseBorrowerQr(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("AMT-BORROWER|")) return null;
  const parts = text.split("|");
  const data = {};
  FIELDS.forEach((field, i) => {
    data[field] = (parts[i + 2] || "").trim();
  });
  return data.id_number || data.rfid_tag ? data : null;
}

const codesOf = (raw) => {
  const parsed = parseBorrowerQr(raw);
  if (!parsed) return [(raw || "").trim()].filter(Boolean);
  return [parsed.id_number, parsed.rfid_tag].filter(Boolean);
};

export async function findBorrowerByCode(raw) {
  const codes = codesOf(raw);
  if (!codes.length) return null;
  const query = { $or: codes.flatMap((code) => [{ id_number: code }, { rfid_tag: code }]) };
  const res = await base44.entities.Borrower.filter(query, { limit: 1 });
  return res.items[0] || null;
}
