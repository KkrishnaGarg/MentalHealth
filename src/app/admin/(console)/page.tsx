import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CountChart } from "@/components/admin/AnalyticsChart";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { Badge, ChartCard, EmptyState, StatCard } from "@/components/ui/Display";
import { BANDS_DISCLAIMER, YEARS } from "@/lib/constants";
import { bandCounts, scores, completionTime, countBy, describe, FLAG_LABELS, histogram, qualityFlags, type FlagType } from "@/lib/analytics";
import { fetchDuplicateEmails, fetchResearchRows, fmt, fmtDuration } from "@/lib/adminData";
import { requireAdmin } from "@/lib/auth";
import { resolveVersion } from "@/lib/versions";
import { VersionTabs } from "@/components/admin/VersionTabs";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const { supabase } = await requireAdmin();
  const { versions, selected } = await resolveVersion(supabase, v);
  const [rows, dupEmails] = await Promise.all([fetchResearchRows(supabase, selected?.version), fetchDuplicateEmails(supabase)]);

  const pss = describe(scores(rows, "pss_score"));
  const time = completionTime(rows);
  const yearData = countBy(rows, (r) => YEARS.find((y) => y.value === r.year)?.label ?? r.year);
  const branchData = countBy(rows, (r) => r.branch);

  const flagTotals = new Map<FlagType, number>();
  for (const r of rows) for (const f of qualityFlags(r, dupEmails.has(r.respondent_id))) flagTotals.set(f, (flagTotals.get(f) ?? 0) + 1);
  const flaggedRows = rows.filter((r) => qualityFlags(r, dupEmails.has(r.respondent_id)).length > 0).length;

  return (
    <>
      <AdminHeader
        title="Dashboard"
        description="Data-collection overview. Analysis follows the predefined plan on the Analytics page."
        actions={<LiveRefresh />}
      />

      <VersionTabs versions={versions} selected={selected} basePath="/admin" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total responses" value={rows.length} />
        <StatCard label="Mean PSS-10 score" value={fmt(pss.mean)} hint={pss.sd !== null ? `SD ${fmt(pss.sd)} · continuous 0–40 score` : "continuous 0–40 score"} />
        <StatCard label="Median completion time" value={fmtDuration(time.median)} />
        <StatCard label="Showing survey" value={selected ? `Version ${selected.version}` : "None"} hint={selected?.status} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No responses yet">Responses will appear here once students begin submitting the survey.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Respondents by year">
              <CountChart data={yearData} />
            </ChartCard>
            <ChartCard title="Respondents by branch">
              <CountChart data={branchData} color="sage" />
            </ChartCard>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="PSS-10 score distribution" description="Continuous total score (0–40) is the primary stress variable.">
              <CountChart data={histogram(scores(rows, "pss_score"), 0, 40, 5)} />
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {bandCounts(scores(rows, "pss_score")).map((b) => (
                  <li key={b.key} className="flex justify-between">
                    <span>{b.label}</span>
                    <span className="tabular-nums">
                      {b.count} ({fmt(b.pct, 0)}%)
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">{BANDS_DISCLAIMER}</p>
            </ChartCard>

            <ChartCard title="Data-quality indicators" description="Flags are for researcher review. Nothing is deleted automatically.">
              {flaggedRows === 0 ? (
                <p className="text-muted">No responses are currently flagged.</p>
              ) : (
                <ul className="space-y-2">
                  {[...flagTotals.entries()].map(([f, n]) => (
                    <li key={f} className="flex items-center justify-between gap-3 text-[15px]">
                      <span>{FLAG_LABELS[f]}</span>
                      <Badge tone="flag">{n}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/admin/respondents?flagged=1${selected ? `&v=${selected.version}` : ""}`} prefetch={false} className="mt-4 inline-block text-sm text-primary underline underline-offset-2">
                Review flagged responses
              </Link>
            </ChartCard>
          </div>

          <section className="mt-4 rounded-lg border border-line bg-surface p-5 shadow-subtle">
            <h2 className="mb-3 text-lg font-semibold">Recent submissions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead className="text-sm text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Submitted</th>
                    <th className="py-2 pr-4 font-medium">Year</th>
                    <th className="py-2 pr-4 font-medium">Branch</th>
                    <th className="py-2 pr-4 font-medium">PSS-10</th>
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r) => (
                    <tr key={r.respondent_id} className="border-t border-line">
                      <td className="py-2 pr-4">{new Date(r.submitted_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{r.year}</td>
                      <td className="py-2 pr-4">{r.branch}</td>
                      <td className="py-2 pr-4 tabular-nums">{r.pss_score ?? "—"}</td>
                      <td className="py-2 pr-4">{fmtDuration(r.total_time_s)}</td>
                      <td className="py-2">
                        <Link href={`/admin/respondents/${r.respondent_id}`} prefetch={false} className="text-primary underline underline-offset-2">
                          View response
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
