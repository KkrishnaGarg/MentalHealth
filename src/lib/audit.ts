import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "ADMIN_LOGIN"
  | "QUESTION_CREATED"
  | "QUESTION_UPDATED"
  | "QUESTION_ACTIVATED"
  | "QUESTION_DEACTIVATED"
  | "QUESTION_REORDERED"
  | "QUESTION_DELETED"
  | "VERSION_CLONED"
  | "VERSION_PUBLISHED"
  | "VERSION_CLOSED"
  | "CSV_EXPORTED"
  | "RESPONDENT_VIEWED"
  | "CLEANING_DECISION_RECORDED";

/**
 * Append an audit row under the admin's own session (RLS: admin_id must equal
 * auth.uid()). Metadata must never contain answer content or identity fields.
 */
export async function audit(
  supabase: SupabaseClient,
  adminId: string,
  action: AuditAction,
  entity: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("audit_logs")
    .insert({ admin_id: adminId, action, entity, entity_id: entityId, metadata });
  if (error) console.error("audit log write failed", action, error.code);
}
