import Link from "next/link";
import { Badge } from "@/components/ui/Display";
import { FLAG_LABELS, type FlagType } from "@/lib/analytics";
import { fmtDuration } from "@/lib/adminData";

export type RespondentRow = {
  respondent_id: string;
  name: string;
  roll_no: string;
  email: string;
  year: number;
  branch: string;
  submitted_at: string;
  pss_score: number | null;
  total_time_s: number | null;
  flags: FlagType[];
};

/** Identifying columns — this table is only ever rendered inside the admin console. */
export function RespondentTable({ rows }: { rows: RespondentRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-subtle">
      <table className="w-full text-left text-[15px]">
        <caption className="sr-only">Respondents (identifying information — administrators only)</caption>
        <thead className="bg-background text-sm text-muted">
          <tr>
            {["Respondent ID", "Name", "Roll number", "Email", "Year", "Branch", "Submitted", "PSS-10", "Time", "Flags"].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                {h}
              </th>
            ))}
            <th scope="col" className="px-4 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.respondent_id} className="border-t border-line align-top">
              <td className="px-4 py-2 font-mono text-xs text-muted">{r.respondent_id.slice(0, 8)}</td>
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-4 py-2">{r.roll_no}</td>
              <td className="px-4 py-2">{r.email}</td>
              <td className="px-4 py-2">{r.year}</td>
              <td className="px-4 py-2">{r.branch}</td>
              <td className="whitespace-nowrap px-4 py-2">{new Date(r.submitted_at).toLocaleDateString()}</td>
              <td className="px-4 py-2 tabular-nums">{r.pss_score ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2">{fmtDuration(r.total_time_s)}</td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.flags.map((f) => (
                    <span key={f} title={FLAG_LABELS[f]}>
                      <Badge tone="flag">{f.replace("_", " ")}</Badge>
                    </span>
                  ))}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-2">
                <Link href={`/admin/respondents/${r.respondent_id}`} prefetch={false} className="text-primary underline underline-offset-2">
                  View response
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
