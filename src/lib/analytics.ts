import { FAST_SUBMISSION_SECONDS, PSS_BANDS } from "./constants";
import { mean, median, pearson, sd, type Correlation } from "./stats";

/** Row of the admin-only `research_dataset` view. */
export type ResearchRow = {
  respondent_id: string;
  survey_version: number;
  year: number;
  branch: string;
  pss_score: number;
  helplessness_score: number;
  self_efficacy_score: number;
  total_time_s: number | null;
  submitted_at: string;
  residence: string | null;
  family_income_bracket: string | null;
} & Record<`pss_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`, number | null> &
  Record<FactorKey, number | null>;

export const FACTORS = [
  { key: "stressor_workload", label: "Workload" },
  { key: "stressor_exams", label: "Examinations" },
  { key: "stressor_cgpa", label: "CGPA / career prospects" },
  { key: "stressor_finance", label: "Family financial condition" },
  { key: "stressor_placement", label: "Placement pressure" },
  { key: "stressor_sleep", label: "Sleep" },
  { key: "stressor_personal", label: "Personal life" },
] as const;

export type FactorKey = (typeof FACTORS)[number]["key"];

export const SUBSCALES = [
  { key: "helplessness_score", label: "Perceived helplessness" },
  { key: "self_efficacy_score", label: "Lack of self-efficacy" },
] as const;

// ---- A. Sample overview -----------------------------------------------------

export function countBy<T>(rows: T[], keyFn: (r: T) => string | number): Array<{ name: string; count: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(keyFn(r));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function completionTime(rows: ResearchRow[]) {
  const t = rows.map((r) => r.total_time_s).filter((x): x is number => typeof x === "number");
  return { median: median(t), mean: mean(t), min: t.length ? Math.min(...t) : null, max: t.length ? Math.max(...t) : null, n: t.length };
}

// ---- B/C. PSS overview and subscales ---------------------------------------

export function describe(xs: number[]) {
  return { n: xs.length, mean: mean(xs), median: median(xs), sd: sd(xs), min: xs.length ? Math.min(...xs) : null, max: xs.length ? Math.max(...xs) : null };
}

export function histogram(xs: number[], lo: number, hi: number, width: number) {
  const bins: Array<{ name: string; count: number }> = [];
  for (let start = lo; start <= hi; start += width) {
    const end = Math.min(start + width - 1, hi);
    bins.push({ name: start === end ? `${start}` : `${start}–${end}`, count: xs.filter((x) => x >= start && x <= end).length });
  }
  return bins;
}

export function bandCounts(scores: number[]) {
  return PSS_BANDS.map((b) => {
    const count = scores.filter((s) => s >= b.min && s <= b.max).length;
    return { key: b.key, label: `${b.label} (${b.min}–${b.max})`, count, pct: scores.length ? (count / scores.length) * 100 : 0 };
  });
}

// ---- D. Stressor factors ----------------------------------------------------

export function factorDistributions(rows: ResearchRow[]) {
  return FACTORS.map((f) => {
    const vals = rows.map((r) => r[f.key]).filter((x): x is number => typeof x === "number");
    return {
      ...f,
      ...describe(vals),
      counts: [1, 2, 3, 4, 5].map((v) => ({ name: String(v), count: vals.filter((x) => x === v).length })),
    };
  });
}

// ---- E. Predefined analysis: 7 factors x 2 subscales = 14 correlations ------

export type CorrelationRow = Correlation & {
  factor: string;
  factorKey: FactorKey;
  subscale: string;
  subscaleKey: (typeof SUBSCALES)[number]["key"];
};

export function predefinedCorrelations(rows: ResearchRow[]): CorrelationRow[] {
  const out: CorrelationRow[] = [];
  for (const f of FACTORS) {
    for (const s of SUBSCALES) {
      out.push({
        factor: f.label,
        factorKey: f.key,
        subscale: s.label,
        subscaleKey: s.key,
        ...pearson(rows.map((r) => r[f.key]), rows.map((r) => r[s.key])),
      });
    }
  }
  return out;
}

// ---- Data quality (flag only; never auto-delete) ----------------------------

export type FlagType = "fast" | "incomplete" | "duplicate_email" | "straightline";

export const FLAG_LABELS: Record<FlagType, string> = {
  fast: `Completed in under ${FAST_SUBMISSION_SECONDS}s`,
  incomplete: "Missing stressor ratings",
  duplicate_email: "Email used by more than one respondent",
  straightline: "Identical answer to all 10 PSS items",
};

export function qualityFlags(row: ResearchRow, duplicateEmail = false): FlagType[] {
  const flags: FlagType[] = [];
  if (typeof row.total_time_s === "number" && row.total_time_s < FAST_SUBMISSION_SECONDS) flags.push("fast");
  if (FACTORS.some((f) => row[f.key] === null || row[f.key] === undefined)) flags.push("incomplete");
  if (duplicateEmail) flags.push("duplicate_email");
  const pss = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((n) => row[`pss_${n}`]);
  if (pss.every((v) => typeof v === "number") && new Set(pss).size === 1) flags.push("straightline");
  return flags;
}

// ---- CSV --------------------------------------------------------------------

/** RFC 4180 CSV with spreadsheet formula-injection protection. */
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
