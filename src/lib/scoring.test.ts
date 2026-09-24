import { describe, expect, it } from "vitest";
import { pssBand, scoreItem, scorePss, type PssItem } from "./scoring";

// Metadata exactly as seeded: items 4, 5, 7, 8 reversed = self-efficacy.
const ITEMS: PssItem[] = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  const reversed = [4, 5, 7, 8].includes(n);
  return { key: `pss_${n}`, reverse_scored: reversed, subscale: reversed ? "self_efficacy" : "helplessness" };
});

const answers = (vals: number[]) => Object.fromEntries(vals.map((v, i) => [`pss_${i + 1}`, v]));

describe("PSS-10 scoring", () => {
  it("scores all-zero answers: helplessness 0, self-efficacy 16 (reversed), total 16", () => {
    const s = scorePss(ITEMS, answers(Array(10).fill(0)));
    expect(s).toEqual({ pss: 16, helplessness: 0, selfEfficacy: 16 });
  });

  it("scores all-four answers: helplessness 24, self-efficacy 0, total 24", () => {
    const s = scorePss(ITEMS, answers(Array(10).fill(4)));
    expect(s).toEqual({ pss: 24, helplessness: 24, selfEfficacy: 0 });
  });

  it("reaches the maximum 40 and minimum 0", () => {
    // max stress: non-reversed items 4, reversed items 0
    expect(scorePss(ITEMS, answers([4, 4, 4, 0, 0, 4, 0, 0, 4, 4])).pss).toBe(40);
    // min stress: non-reversed items 0, reversed items 4
    expect(scorePss(ITEMS, answers([0, 0, 0, 4, 4, 0, 4, 4, 0, 0])).pss).toBe(0);
  });

  it("hand-checked mixed case", () => {
    // items:      1  2  3  4  5  6  7  8  9  10
    const a = [2, 3, 1, 3, 2, 4, 1, 0, 2, 3];
    // helplessness = 2+3+1+4+2+3 = 15
    // self-efficacy = (4-3)+(4-2)+(4-1)+(4-0) = 1+2+3+4 = 10
    expect(scorePss(ITEMS, answers(a))).toEqual({ pss: 25, helplessness: 15, selfEfficacy: 10 });
  });

  it("reverse-scores using metadata, not position", () => {
    const shuffled = [...ITEMS].reverse();
    expect(scorePss(shuffled, answers([2, 3, 1, 3, 2, 4, 1, 0, 2, 3])).pss).toBe(25);
  });

  it("rejects out-of-range values and missing answers", () => {
    expect(() => scoreItem(5, false)).toThrow();
    expect(() => scoreItem(-1, true)).toThrow();
    expect(() => scoreItem(1.5, false)).toThrow();
    expect(() => scorePss(ITEMS, { pss_1: 1 })).toThrow();
  });
});

describe("PSS bands (informal, non-clinical)", () => {
  it("maps boundaries", () => {
    expect(pssBand(0)?.key).toBe("low");
    expect(pssBand(13)?.key).toBe("low");
    expect(pssBand(14)?.key).toBe("moderate");
    expect(pssBand(26)?.key).toBe("moderate");
    expect(pssBand(27)?.key).toBe("high");
    expect(pssBand(40)?.key).toBe("high");
    expect(pssBand(41)).toBeNull();
  });
});
