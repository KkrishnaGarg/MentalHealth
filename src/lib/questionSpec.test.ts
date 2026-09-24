import { describe, expect, it } from "vitest";
import { answerMatchesQuestion, questionSpecSchema, specToRow } from "./questionSpec";

const base = { section: "demographics" as const, text: "Q?", required: true, reverse_scored: false };
const opts = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
];

describe("questionSpecSchema", () => {
  it("accepts every question type", () => {
    expect(questionSpecSchema.safeParse({ ...base, type: "single", options: opts }).success).toBe(true);
    expect(questionSpecSchema.safeParse({ ...base, type: "multi", options: opts }).success).toBe(true);
    expect(questionSpecSchema.safeParse({ ...base, type: "likert", options: [{ value: 0, label: "x" }, { value: 1, label: "y" }] }).success).toBe(true);
    expect(questionSpecSchema.safeParse({ ...base, type: "scale", config: { min: 0, max: 10 } }).success).toBe(true);
    expect(questionSpecSchema.safeParse({ ...base, type: "number", config: { min: 0, max: 100 } }).success).toBe(true);
    expect(questionSpecSchema.safeParse({ ...base, type: "text", required: false }).success).toBe(true);
  });

  it("rejects malformed definitions", () => {
    expect(questionSpecSchema.safeParse({ ...base, type: "single" }).success).toBe(false); // no choices
    expect(questionSpecSchema.safeParse({ ...base, type: "single", options: [opts[0], opts[0]] }).success).toBe(false); // duplicate values
    expect(questionSpecSchema.safeParse({ ...base, type: "likert", options: opts }).success).toBe(false); // non-numeric
    expect(questionSpecSchema.safeParse({ ...base, type: "scale" }).success).toBe(false);
    expect(questionSpecSchema.safeParse({ ...base, type: "scale", config: { min: 1, max: 12 } }).success).toBe(false);
    expect(questionSpecSchema.safeParse({ ...base, type: "text", options: opts }).success).toBe(false);
    expect(questionSpecSchema.safeParse({ ...base, type: "text", subscale: "helplessness" }).success).toBe(false);
    expect(questionSpecSchema.safeParse({ ...base, type: "scale", config: { min: 1, max: 5 }, reverse_scored: true }).success).toBe(false);
    expect(questionSpecSchema.safeParse({ ...base, text: "   ", type: "text" }).success).toBe(false);
  });

  it("specToRow nulls fields the type does not use", () => {
    const spec = questionSpecSchema.parse({ ...base, type: "scale", config: { min: 1, max: 5 }, options: undefined });
    expect(specToRow(spec)).toMatchObject({ type: "scale", options: null, config: { min: 1, max: 5 } });
    const text = questionSpecSchema.parse({ ...base, type: "text", config: { min: 1 } });
    expect(specToRow(text)).toMatchObject({ options: null, config: null });
  });
});

describe("answerMatchesQuestion", () => {
  it("validates each type", () => {
    expect(answerMatchesQuestion({ type: "single", options: opts, config: null }, "a")).toBe(true);
    expect(answerMatchesQuestion({ type: "single", options: opts, config: null }, "z")).toBe(false);
    expect(answerMatchesQuestion({ type: "multi", options: opts, config: null }, ["a", "b"])).toBe(true);
    expect(answerMatchesQuestion({ type: "multi", options: opts, config: null }, ["a", "a"])).toBe(false);
    expect(answerMatchesQuestion({ type: "multi", options: opts, config: null }, "a")).toBe(false);
    const scale = { type: "scale" as const, options: null, config: { min: 0, max: 10 } };
    expect(answerMatchesQuestion(scale, 10)).toBe(true);
    expect(answerMatchesQuestion(scale, 11)).toBe(false);
    expect(answerMatchesQuestion(scale, 2.5)).toBe(false);
    const num = { type: "number" as const, options: null, config: { min: 0, max: 100 } };
    expect(answerMatchesQuestion(num, 42.5)).toBe(true);
    expect(answerMatchesQuestion(num, -1)).toBe(false);
    expect(answerMatchesQuestion({ type: "text", options: null, config: null }, "hi")).toBe(true);
    expect(answerMatchesQuestion({ type: "text", options: null, config: null }, 5)).toBe(false);
  });
});
