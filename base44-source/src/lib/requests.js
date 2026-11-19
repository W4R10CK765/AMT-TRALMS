import { addDays, format } from "date-fns";

export const QUEUE_WINDOW_MS = 5 * 60 * 1000;
export const OPEN_STATUSES = ["Pending Release", "In Progress", "Partially Released"];

export const STATUS_TONE = {
  "Pending Release": "border-amber-500 bg-amber-50 text-amber-700",
  "In Progress": "border-blue-500 bg-blue-50 text-blue-700",
  "Partially Released": "border-indigo-500 bg-indigo-50 text-indigo-700",
  Completed: "border-green-600 bg-green-50 text-green-700",
  Expired: "border-slate-300 bg-slate-50 text-slate-500",
  Cancelled: "border-slate-300 bg-slate-50 text-slate-500",
  Rejected: "border-red-500 bg-red-50 text-red-600",
};

const pad = (n) => String(n).padStart(2, "0");

export function newRequestRef() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `REQ-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// One queue entry = one request_ref with its requested lines.
export function groupRequests(rows) {
  const map = new Map();
  for (const r of rows) {
    const ref = r.request_ref || r.id;
    if (!map.has(ref)) {
      map.set(ref, {
        ref,
        borrower_id: r.borrower_id,
        borrower_name: r.borrower_name,
        id_number: r.id_number,
        course_section: r.course_section,
        contact: r.contact,
        purpose: r.purpose,
        needed_until: r.needed_until,
        status: r.status,
        requested_at: r.requested_at || r.created_date,
        expires_at: r.expires_at,
        started_at: r.started_at,
        lines: [],
      });
    }
    map.get(ref).lines.push(r);
  }
  const groups = [...map.values()].sort(
    (a, b) => new Date(a.requested_at || 0) - new Date(b.requested_at || 0)
  );
  groups.forEach((g) => {
    g.requestedTotal = g.lines.reduce((s, l) => s + (l.qty || 0), 0);
    g.releasedTotal = g.lines.reduce((s, l) => s + (l.released_qty || 0), 0);
  });
  return groups;
}

export function remainingMs(group, now = Date.now()) {
  if (!group || !group.expires_at) return 0;
  return new Date(group.expires_at).getTime() - now;
}

export function countdown(ms) {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function isExpired(group, now = Date.now()) {
  return (
    group.status === "Pending Release" && !!group.expires_at && new Date(group.expires_at).getTime() <= now
  );
}

export function defaultDueInput(group) {
  if (group && group.needed_until) return `${group.needed_until}T17:00`;
  return format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm");
}
