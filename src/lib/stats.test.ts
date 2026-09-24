import { describe, expect, it } from "vitest";
import { mean, median, pearson, sd, tTwoSidedP } from "./stats";

describe("descriptives", () => {
  it("mean / median / sample sd", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    // sample sd of [2,4,4,4,5,5,7,9] = sqrt(32/7)
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(sd([1])).toBeNull();
  });
});

describe("t distribution", () => {
  it("matches known two-sided p-values", () => {
    // t = 2.228, df = 10  -> p ~ 0.05
    expect(tTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    // t = 2.0, df = 30 -> p ~ 0.0546
    expect(tTwoSidedP(2.0, 30)).toBeCloseTo(0.0546, 3);
    // t = 0 -> p = 1
    expect(tTwoSidedP(0, 12)).toBeCloseTo(1, 10);
  });
});

describe("pearson", () => {
  it("perfect positive and negative correlation", () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toEqual({ r: 1, p: 0, n: 5 });
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]).r).toBe(-1);
  });

  it("hand-computed example", () => {
    // x = 1..5, y = [2,1,4,3,5]; r = 0.8; n=5 -> t = 0.8*sqrt(3)/0.6 = 2.3094, df=3 -> p ~ 0.104
    const c = pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]);
    expect(c.r).toBeCloseTo(0.8, 10);
    expect(c.n).toBe(5);
    expect(c.p).toBeCloseTo(0.104, 3);
  });

  it("uses complete pairs only and refuses degenerate input", () => {
    expect(pearson([1, 2, null, 4], [2, 4, 6, undefined]).n).toBe(2);
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toEqual({ r: null, p: null, n: 4 });
    expect(pearson([1, 2], [3, 4]).r).toBeNull();
  });
});
