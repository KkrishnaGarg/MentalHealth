export type AuditRow = {
  id: string;
  admin_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-subtle">
      <table className="w-full text-left text-[15px]">
        <caption className="sr-only">Administrative audit log, newest first</caption>
        <thead className="bg-background text-sm text-muted">
          <tr>
            {["When", "Action", "Entity", "Admin", "Details"].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="whitespace-nowrap px-4 py-2">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-4 py-2">
                {r.entity}
                {r.entity_id && <span className="ml-1 font-mono text-xs text-muted">{r.entity_id.slice(0, 8)}</span>}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-muted">{r.admin_id?.slice(0, 8) ?? "—"}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
