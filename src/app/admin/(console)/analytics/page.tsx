import { AdminHeader } from "@/components/admin/AdminHeader";
import { CorrelationChart, CountChart } from "@/components/admin/AnalyticsChart";
import { Badge, ChartCard, EmptyState, StatCard } from "@/components/ui/Display";
import { ASSOCIATION_NOTE, BANDS_DISCLAIMER, YEARS } from "@/lib/constants";
import {
  bandCounts,
  countBy,
  describe,
  factorDistributions,
  histogram,
  predefinedCorrelations,
} from "@/lib/analytics";
import { fetchResearchRows, fmt } from "@/lib/adminData";
import { requireAdmin } from "@/lib/auth";
import { mean } from "@/lib/stats";

export const metadata = { title: "Analytics" };

function fmtP(p: number | null) {
  if (p === null) return "—";
  return p < 0.001 ? "< .001" : p.toFixed(3);
}

export default async function AnalyticsPage() {
  const { supabase } = await requireAdmin();
  const rows = await fetchResearchRows(supabase);

  if (rows.length === 0) {
    return (
      <>
        <AdminHeader title="Analytics" />
        <EmptyState title="No data to analyse yet">Analyses appear once responses have been collected.</EmptyState>
      </>
    );
  }

  const pss = describe(rows.map((r) => r.pss_score));
  const help = describe(rows.map((r) => r.helplessness_score));
  const eff = describe(rows.map((r) => r.self_efficacy_score));
  const factors = factorDistributions(rows);
  const corr = predefinedCorrelations(rows);

  const chartData = factors.map((f) => ({
    factor: f.label,
    helplessness: corr.find((c) => c.factorKey === f.key && c.subscaleKey === "helplessness_score")?.r ?? null,
    selfEfficacy: corr.find((c) => c.factorKey === f.key && c.subscaleKey === "self_efficacy_score")?.r ?? null,
  }));

  const { data: openEnded } = await supabase
    .from("open_ended_responses")
    .select("respondent_id, submitted_at, question_key, question_text, response_text")
    .order("submitted_at", { ascending: false })
    .limit(60);

  const byBranch = countBy(rows, (r) => r.branch).map((b) => ({
    name: b.name,
    n: b.count,
    mean: mean(rows.filter((r) => r.branch === b.name).map((r) => r.pss_score)),
  }));
  const byYear = countBy(rows, (r) => r.year).map((y) => ({
    name: YEARS.find((v) => String(v.value) === y.name)?.label ?? y.name,
    n: y.count,
    mean: mean(rows.filter((r) => String(r.year) === y.name).map((r) => r.pss_score)),
  }));

  return (
    <>
      <AdminHeader
        title="Analytics"
        description="Follows the predefined analysis plan. Results describe associations in a cross-sectional, self-selected, single-institute sample; they do not establish causation."
      />

      <Section title="A. Sample overview">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total respondents" value={rows.length} />
          <StatCard label="Years represented" value={countBy(rows, (r) => r.year).length} />
          <StatCard label="Branches represented" value={countBy(rows, (r) => r.branch).length} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="By year">
            <CountChart data={countBy(rows, (r) => YEARS.find((y) => y.value === r.year)?.label ?? r.year)} />
          </ChartCard>
          <ChartCard title="By branch">
            <CountChart data={countBy(rows, (r) => r.branch)} color="sage" />
          </ChartCard>
        </div>
      </Section>

      <Section title="B. PSS-10 overview">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Mean" value={fmt(pss.mean, 2)} />
          <StatCard label="Median" value={fmt(pss.median, 1)} />
          <StatCard label="Standard deviation" value={fmt(pss.sd, 2)} />
          <StatCard label="Range observed" value={`${pss.min}–${pss.max}`} hint="possible 0–40" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Distribution of total PSS-10 score" description="The continuous score is the primary stress variable.">
            <CountChart data={histogram(rows.map((r) => r.pss_score), 0, 40, 5)} />
          </ChartCard>
          <ChartCard title="Conventional interpretive bands (secondary, descriptive)" note={BANDS_DISCLAIMER}>
            <CountChart
              data={bandCounts(rows.map((r) => r.pss_score)).map((b) => ({ name: b.label.replace(" perceived stress", ""), count: b.count }))}
              color="sage"
            />
          </ChartCard>
        </div>
      </Section>

      <Section title="C. PSS subscales">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Perceived helplessness (items 1, 2, 3, 6, 9, 10; range 0–24)">
            <p className="mb-3 text-[15px] text-muted">
              Mean {fmt(help.mean, 2)} · median {fmt(help.median, 1)} · SD {fmt(help.sd, 2)}
            </p>
            <CountChart data={histogram(rows.map((r) => r.helplessness_score), 0, 24, 3)} />
          </ChartCard>
          <ChartCard title="Lack of self-efficacy (items 4, 5, 7, 8 reverse-scored; range 0–16)">
            <p className="mb-3 text-[15px] text-muted">
              Mean {fmt(eff.mean, 2)} · median {fmt(eff.median, 1)} · SD {fmt(eff.sd, 2)}
            </p>
            <CountChart data={histogram(rows.map((r) => r.self_efficacy_score), 0, 16, 2)} color="sage" />
          </ChartCard>
        </div>
      </Section>

      <Section title="D. Stressor factors (1–5, separate from the PSS score)">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {factors.map((f) => (
            <ChartCard key={f.key} title={f.label}>
              <p className="mb-2 text-sm text-muted">
                n = {f.n} · mean {fmt(f.mean, 2)} · SD {fmt(f.sd, 2)}
              </p>
              <CountChart data={f.counts} height={150} />
            </ChartCard>
          ))}
        </div>
      </Section>

      <Section title="E. Predefined correlation analysis (7 factors × 2 PSS subscales = 14)">
        <ChartCard
          title="Pearson r between each stressor factor and each PSS subscale"
          description="Positive r: higher factor ratings go with higher helplessness / lower self-efficacy."
          note={ASSOCIATION_NOTE}
        >
          <CorrelationChart data={chartData} />
        </ChartCard>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface shadow-subtle">
          <table className="w-full text-left text-[15px]">
            <caption className="sr-only">Predefined factor by subscale correlations</caption>
            <thead className="bg-background text-sm text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Factor</th>
                <th className="px-4 py-2 font-medium">PSS subscale</th>
                <th className="px-4 py-2 font-medium">r</th>
                <th className="px-4 py-2 font-medium">p-value</th>
                <th className="px-4 py-2 font-medium">n</th>
              </tr>
            </thead>
            <tbody>
              {corr.map((c) => (
                <tr key={`${c.factorKey}-${c.subscaleKey}`} className="border-t border-line">
                  <td className="px-4 py-2">{c.factor}</td>
                  <td className="px-4 py-2">{c.subscale}</td>
                  <td className="px-4 py-2 tabular-nums">{c.r === null ? "—" : c.r.toFixed(3)}</td>
                  <td className="px-4 py-2 tabular-nums">{fmtP(c.p)}</td>
                  <td className="px-4 py-2 tabular-nums">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          {ASSOCIATION_NOTE} Fourteen tests are run; p-values are unadjusted. Consider a multiple-comparison correction
          (for example Bonferroni, α = 0.05 / 14 ≈ 0.0036) when interpreting them. “—” means the value is not computable
          (fewer than 3 complete pairs, or no variation in a variable).
        </p>
      </Section>

      <Section title="F. Open-ended responses (admin only)">
        <p className="mb-3 max-w-3xl text-[15px] text-muted">
          Raw text is sensitive and is never shown publicly. Use these for thematic coding; only the coded themes belong
          in the public results.
        </p>
        {!openEnded?.length ? (
          <EmptyState title="No open-ended responses yet">Optional written answers will appear here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {openEnded.map((o, i) => (
              <li key={`${o.respondent_id}-${o.question_key}-${i}`} className="rounded-md border border-line bg-surface p-4">
                <p className="text-xs text-muted">{o.question_text}</p>
                <p className="mt-1 whitespace-pre-wrap text-ink">{o.response_text}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Exploratory descriptives" badge="Exploratory / not part of predefined analysis">
        <p className="mb-3 max-w-3xl text-[15px] text-muted">
          Descriptive PSS means by group. These are not hypothesis tests and must not be mixed into the main results
          without being labelled exploratory.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <MeanTable title="Mean PSS-10 by year" rows={byYear} />
          <MeanTable title="Mean PSS-10 by branch" rows={byBranch} />
        </div>
      </Section>

      <p className="mt-10 text-sm text-muted">
        Limitations to report: self-selection bias, cross-sectional design, single-institute sample, modest sample size,
        possible response bias.
      </p>
    </>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {badge && <Badge tone="draft">{badge}</Badge>}
      </div>
      {children}
    </section>
  );
}

function MeanTable({ title, rows }: { title: string; rows: Array<{ name: string; n: number; mean: number | null }> }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-subtle">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <table className="w-full text-left text-[15px]">
        <thead className="text-sm text-muted">
          <tr>
            <th className="py-1 font-medium">Group</th>
            <th className="py-1 font-medium">n</th>
            <th className="py-1 font-medium">Mean</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-line">
              <td className="py-1.5">{r.name}</td>
              <td className="py-1.5 tabular-nums">{r.n}</td>
              <td className="py-1.5 tabular-nums">{fmt(r.mean, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
