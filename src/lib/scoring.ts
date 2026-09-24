import { PSS_BANDS } from "./constants";

/**
 * PSS-10 scoring driven by stored question metadata (reverse_scored, subscale) —
 * never by question position or id. This mirrors the SQL in submit_survey(),
 * which is the authoritative implementation; this copy is used for tests and
 * for cross-checking stored scores.
 */
export type PssItem = {
  key: string;
  reverse_scored: boolean;
  subscale: "helplessness" | "self_efficacy";
};

export type PssScores = {
  pss: number;
  helplessness: number;
  selfEfficacy: number;
};

export function scoreItem(value: number, reverse: boolean): number {
  if (!Number.isInteger(value) || value < 0 || value > 4) {
    throw new RangeError(`PSS value out of range: ${value}`);
  }
  return reverse ? 4 - value : value;
}

export function scorePss(items: PssItem[], answers: Record<string, number>): PssScores {
  if (items.length !== 10) throw new Error("PSS-10 requires exactly 10 items");
  let helplessness = 0;
  let selfEfficacy = 0;
  for (const item of items) {
    const raw = answers[item.key];
    if (raw === undefined) throw new Error(`Missing PSS answer: ${item.key}`);
    const scored = scoreItem(raw, item.reverse_scored);
    if (item.subscale === "helplessness") helplessness += scored;
    else selfEfficacy += scored;
  }
  return { pss: helplessness + selfEfficacy, helplessness, selfEfficacy };
}

/** Conventional, informal descriptive band. NOT a clinical threshold. */
export function pssBand(score: number) {
  return PSS_BANDS.find((b) => score >= b.min && score <= b.max) ?? null;
}
