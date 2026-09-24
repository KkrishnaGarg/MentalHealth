import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { RespondentTable, type RespondentRow } from "@/components/admin/RespondentTable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Display";
import { qualityFlags } from "@/lib/analytics";
import { fetchDuplicateEmails, fetchResearchRows } from "@/lib/adminData";
import { requireAdmin } from "@/lib/auth";
import { BRANCHES, YEARS } from "@/lib/constants";

export const metadata = { title: "Respondents" };

const PAGE_SIZE = 25;

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function RespondentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 80);
  const year = Number(first(sp.year)) || null;
  const branch = first(sp.branch);
  const from = first(sp.from);
  const flaggedOnly = first(sp.flagged) === "1";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const { supabase } = await requireAdmin();

  let query = supabase
    .from("admin_dataset")
    .select("respondent_id, name, roll_no, email, year, branch, submitted_at, pss_score, total_time_s")
    .order("submitted_at", { ascending: false })
    .range(0, 9999);
  if (q) {
    // Strip characters that have meaning in PostgREST filter syntax.
    const safe = q.replace(/[%*,()\\]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,roll_no.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  if (year) query = query.eq("year", year);
  if (branch) query = query.eq("branch", branch);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("submitted_at", from);

  const [{ data: people }, research, dup] = await Promise.all([query, fetchResearchRows(supabase), fetchDuplicateEmails(supabase)]);
  const researchById = new Map(research.map((r) => [r.respondent_id, r]));

  let rows: RespondentRow[] = (people ?? []).map((p) => {
    const r = researchById.get(p.respondent_id);
    return { ...p, flags: r ? qualityFlags(r, dup.has(p.respondent_id)) : [] } as RespondentRow;
  });
  if (flaggedOnly) rows = rows.filter((r) => r.flags.length > 0);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (year) p.set("year", String(year));
    if (branch) p.set("branch", branch);
    if (from) p.set("from", from);
    if (flaggedOnly) p.set("flagged", "1");
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    return `/admin/respondents?${p.toString()}`;
  };

  const field = "min-h-11 rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]";

  return (
    <>
      <AdminHeader
        title="Respondents"
        description="Identifying information. Restricted to administrators; opening a response is recorded in the audit log."
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Search name, roll number or email
          <input name="q" defaultValue={q} className={`${field} w-64`} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Year
          <select name="year" defaultValue={year ?? ""} className={field}>
            <option value="">All</option>
            {YEARS.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Branch
          <select name="branch" defaultValue={branch} className={field}>
            <option value="">All</option>
            {BRANCHES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Submitted on or after
          <input type="date" name="from" defaultValue={from} className={field} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" name="flagged" value="1" defaultChecked={flaggedOnly} className="size-4 accent-primary" />
          Flagged only
        </label>
        <Button type="submit">Apply filters</Button>
        <Link href="/admin/respondents" className="min-h-11 self-center text-sm text-primary underline underline-offset-2">
          Reset
        </Link>
      </form>

      {visible.length === 0 ? (
        <EmptyState title="No respondents found">Adjust the filters, or wait for students to submit the survey.</EmptyState>
      ) : (
        <>
          <RespondentTable rows={visible} />
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              {rows.length} respondent{rows.length === 1 ? "" : "s"} · page {current} of {pages}
            </span>
            <span className="flex gap-4">
              {current > 1 && (
                <Link href={params({ page: String(current - 1) })} className="text-primary underline underline-offset-2">
                  ← Previous page
                </Link>
              )}
              {current < pages && (
                <Link href={params({ page: String(current + 1) })} className="text-primary underline underline-offset-2">
                  Next page →
                </Link>
              )}
            </span>
          </div>
        </>
      )}
    </>
  );
}
