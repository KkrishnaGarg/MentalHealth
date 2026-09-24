import { AdminHeader } from "@/components/admin/AdminHeader";
import { AuditTable, type AuditRow } from "@/components/admin/AuditTable";
import { EmptyState } from "@/components/ui/Display";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, admin_id, action, entity, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <>
      <AdminHeader
        title="Audit log"
        description="Sensitive administrative actions. Entries are append-only; answer content and identity fields are never written here."
      />
      {!data?.length ? (
        <EmptyState title="No audit entries yet">Administrative actions will be recorded here.</EmptyState>
      ) : (
        <AuditTable rows={data as AuditRow[]} />
      )}
    </>
  );
}
