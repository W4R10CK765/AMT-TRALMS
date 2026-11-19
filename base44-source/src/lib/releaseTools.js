import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { issueLoanLine } from "@/lib/issueLoan";

const today = () => format(new Date(), "yyyy-MM-dd");

// Exact tag first, then an upper-case retry (scanners differ on case).
export async function findAsset(code) {
  const raw = (code || "").trim();
  if (!raw) return null;
  const exact = (await base44.entities.Item.filter({ asset_tag: raw }, { limit: 1 })).items[0];
  if (exact) return exact;
  const upper = raw.toUpperCase();
  if (upper === raw) return null;
  return (await base44.entities.Item.filter({ asset_tag: upper }, { limit: 1 })).items[0] || null;
}

// Decides whether one scanned asset can be released against a requested line.
export function assessAsset({ item, line, stagedCount }) {
  const remaining = (line.qty || 0) - (line.released_qty || 0);
  if (remaining <= 0) return { ok: false, reason: "already released in full" };
  if (stagedCount >= remaining) return { ok: false, reason: "all requested units are already scanned" };
  if (item.status === "Retired") return { ok: false, restricted: true, reason: "asset is retired" };
  if (item.status === "Under Maintenance") return { ok: false, restricted: true, reason: "asset is under maintenance" };
  if (item.status !== "Active") return { ok: false, restricted: true, reason: `asset status is ${item.status}` };
  if (item.condition === "Poor") return { ok: false, restricted: true, reason: "asset condition is poor / damaged" };
  if (item.calibration_required && item.calibration_due && item.calibration_due < today())
    return { ok: false, restricted: true, reason: "calibration is overdue" };
  if ((item.qty_available || 0) - stagedCount < 1) return { ok: false, reason: "no available units in stock" };
  return { ok: true };
}

// Commits only the physically scanned tools: stock down, loan lines created, request progress up.
export async function commitRelease({ group, borrower, staged, dueIso, toolkeeper }) {
  const byItem = new Map();
  for (const s of staged) {
    const entry = byItem.get(s.item.id) || { item: s.item, line: s.line, qty: 0 };
    entry.qty += 1;
    byItem.set(s.item.id, entry);
  }
  for (const g of byItem.values()) {
    const fresh = await base44.entities.Item.get(g.item.id);
    if ((fresh.qty_available || 0) < g.qty) {
      throw new Error(`${fresh.name}: only ${fresh.qty_available || 0} available`);
    }
  }

  const trans_no = `TR-${format(new Date(), "yyyyMMdd-HHmmss")}`;
  const issuedAt = new Date().toISOString();
  const loans = [];

  for (const g of byItem.values()) {
    await issueLoanLine({
      borrower,
      line: { item: g.item, qty: g.qty, cond: g.item.condition || "Good" },
      purpose: group.purpose || "",
      dueIso,
      trans_no,
      request_ref: group.ref,
      issued_by: toolkeeper,
    });
    await base44.entities.BorrowRequest.update(g.line.id, {
      released_qty: (g.line.released_qty || 0) + g.qty,
      released_at: issuedAt,
      toolkeeper,
    });
    loans.push({
      name: g.item.name,
      asset_tag: g.item.asset_tag,
      qty: g.qty,
      condition: g.item.condition || "Good",
    });
  }

  const rows = (await base44.entities.BorrowRequest.filter({ request_ref: group.ref }, { limit: 200 })).items;
  const complete = rows.length > 0 && rows.every((r) => (r.released_qty || 0) >= r.qty);
  const status = complete ? "Completed" : "Partially Released";
  await base44.entities.BorrowRequest.updateMany({ request_ref: group.ref }, { $set: { status } });

  return { trans_no, status, loans, issuedAt, borrower, group, dueIso, toolkeeper };
}
