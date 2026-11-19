import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

// Records a confirmed physical return against one open loan line.
export async function commitReturn({ loan, qty, condition, notes, toolkeeper }) {
  const outstanding = (loan.qty_issued || 0) - (loan.qty_returned || 0);
  if (!qty || qty < 1) throw new Error("Enter the quantity actually returned");
  if (qty > outstanding) throw new Error(`Only ${outstanding} still on loan for this asset`);
  if (condition === "Lost" && !notes.trim()) throw new Error("Explain the loss in the notes");

  const item = await base44.entities.Item.get(loan.item_id);
  const returnedTotal = (loan.qty_returned || 0) + (condition === "Lost" ? 0 : qty);
  const patch = {};
  if (condition === "Lost") {
    patch.qty_total = Math.max(0, (item.qty_total || 0) - qty);
  } else if (condition === "Damaged") {
    // Held out of circulation until maintenance closes the repair.
    patch.status = "Under Maintenance";
    patch.qty_available = (item.qty_available || 0) + qty;
  } else {
    patch.qty_available = (item.qty_available || 0) + qty;
    if (condition !== item.condition) patch.condition = condition;
  }
  await base44.entities.Item.update(item.id, patch);

  const status =
    condition === "Lost" ? "Lost" : returnedTotal >= (loan.qty_issued || 0) ? "Closed" : "Partial";

  await base44.entities.Loan.update(loan.id, {
    qty_returned: returnedTotal,
    returned_condition: condition,
    returned_at: new Date().toISOString(),
    returned_by: toolkeeper || "",
    notes: notes.trim(),
    status,
  });

  if (condition === "Damaged") {
    await base44.entities.MaintenanceLog.create({
      item_id: item.id,
      asset_tag: item.asset_tag,
      item_name: item.name,
      type: "Repair",
      start_date: format(new Date(), "yyyy-MM-dd"),
      findings: notes.trim() || "Returned damaged at the counter",
      status: "Open",
    });
  }

  return { status, returnedTotal, item, outstanding: outstanding - (condition === "Lost" ? outstanding : qty) };
}
