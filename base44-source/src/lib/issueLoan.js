import { base44 } from "@/api/base44Client";

// Issues one line: decrements available stock, then records the loan.
export async function issueLoanLine({ borrower, line, purpose, dueIso, trans_no, request_ref, issued_by }) {
  const fresh = await base44.entities.Item.get(line.item.id);
  if (fresh.qty_available < line.qty) {
    throw new Error(`${fresh.name}: only ${fresh.qty_available} available`);
  }
  await base44.entities.Item.update(fresh.id, { qty_available: fresh.qty_available - line.qty });
  return base44.entities.Loan.create({
    trans_no,
    borrower_id: borrower.id,
    borrower_name: borrower.full_name,
    borrower_id_number: borrower.id_number,
    course_section: borrower.course_section,
    purpose,
    item_id: fresh.id,
    asset_tag: fresh.asset_tag,
    item_name: fresh.name,
    qty_issued: line.qty,
    qty_returned: 0,
    issued_condition: line.cond || fresh.condition || "Good",
    issued_at: new Date().toISOString(),
    expected_return_at: dueIso,
    request_ref: request_ref || "",
    issued_by: issued_by || "",
    status: "Open",
  });
}
