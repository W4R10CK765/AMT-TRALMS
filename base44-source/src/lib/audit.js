import { base44 } from "@/api/base44Client";

// Writes one audit entry. Failures never block counter operations.
export async function audit({ action, ref = "", entity = "", entity_id = "", detail = "", actor = "", outcome = "ok" }) {
  try {
    await base44.entities.AuditLog.create({
      at: new Date().toISOString(),
      action,
      request_ref: ref,
      entity_type: entity,
      entity_id: entity_id || "",
      detail,
      actor: actor || "",
      outcome,
    });
  } catch {
    /* audit is best-effort; the counter keeps working */
  }
}
