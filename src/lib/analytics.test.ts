import { describe, expect, it } from "vitest";
import { bandCounts, histogram, predefinedCorrelations, qualityFlags, toCsv, type ResearchRow } from "./analytics";

function row(over: Partial<ResearchRow> = {}): ResearchRow {
  const base = {
    respondent_id: "r1",
    survey_version: 1,
    year: 2,
    branch: "CCE",
    pss_score: 20,
    helplessness_score: 12,
    self_efficacy_score: 8,
    total_time_s: 300,
    submitted_at: "2026-01-01T00:00:00Z",
    residence: null,
    family_income_bracket: null,
    stressor_workload: 3,
    stressor_exams: 3,
    stressor_cgpa: 3,
    stressor_finance: 3,
    stressor_placement: 3,
    stressor_sleep: 3,
    stressor_personal: 3,
    pss_1: 1, pss_2: 2, pss_3: 3, pss_4: 1, pss_5: 2, pss_6: 3, pss_7: 1, pss_8: 2, pss_9: 3, pss_10: 1,
  } as ResearchRow;
  return { ...base, ...over };
}

describe("predefined correlations", () => {
  it("produces exactly 14 (7 factors x 2 subscales)", () => {
    const rows = [1, 2, 3, 4, 5].map((v) => row({ stressor_workload: v, helplessness_score: v * 2, self_efficacy_score: 10 - v }));
    const out = predefinedCorrelations(rows);
    expect(out).toHaveLength(14);
    const w = out.filter((o) => o.factorKey === "stressor_workload");
    expect(w.find((o) => o.subscaleKey === "helplessness_score")?.r).toBeCloseTo(1, 10);
    expect(w.find((o) => o.subscaleKey === "self_efficacy_score")?.r).toBeCloseTo(-1, 10);
    // other factors are constant => undefined correlation, reported as null (not 0)
    expect(out.find((o) => o.factorKey === "stressor_sleep")?.r).toBeNull();
  });
});

describe("descriptives helpers", () => {
  it("bands and histogram", () => {
    const b = bandCounts([0, 13, 14, 26, 27, 40]);
    expect(b.map((x) => x.count)).toEqual([2, 2, 2]);
    const h = histogram([0, 3, 4, 40], 0, 40, 5);
    expect(h[0].count).toBe(3); // 0–4
    expect(h[8].count).toBe(1); // 40–40
  });
});

describe("quality flags", () => {
  it("flags fast, straight-lining, incomplete, duplicate email; passes a clean row", () => {
    expect(qualityFlags(row())).toEqual([]);
    expect(qualityFlags(row({ total_time_s: 20 }))).toContain("fast");
    expect(qualityFlags(row({ stressor_sleep: null }))).toContain("incomplete");
    expect(qualityFlags(row(), true)).toContain("duplicate_email");
    expect(qualityFlags(row({ pss_1: 2, pss_2: 2, pss_3: 2, pss_4: 2, pss_5: 2, pss_6: 2, pss_7: 2, pss_8: 2, pss_9: 2, pss_10: 2 }))).toContain("straightline");
  });
});

describe("csv", () => {
  it("escapes quotes/commas/newlines and neutralises formulas", () => {
    const csv = toCsv([{ a: 'he said "hi", ok', b: "=SUM(A1)", c: -5, d: null }]);
    expect(csv).toBe('a,b,c,d\r\n"he said ""hi"", ok",\'=SUM(A1),-5,\r\n');
  });
});
