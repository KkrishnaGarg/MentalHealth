import { z } from "zod";
import type { AnswerValue, Question } from "./types";

const optionSchema = z.object({
  value: z.union([z.string().min(1).max(60), z.number().finite()]),
  label: z.string().trim().min(1).max(200),
});

const configSchema = z.object({
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  min_label: z.string().trim().max(80).optional(),
  max_label: z.string().trim().max(80).optional(),
});

/** Everything an admin can set on a question. Validated identically on create and update. */
export const questionSpecSchema = z
  .object({
    section: z.enum(["pss10", "stressors", "open_ended", "demographics"]),
    type: z.enum(["single", "multi", "likert", "scale", "number", "text"]),
    text: z.string().trim().min(1).max(1000),
    required: z.boolean(),
    options: z.array(optionSchema).min(2).max(20).nullish(),
    config: configSchema.nullish(),
    reverse_scored: z.boolean().default(false),
    subscale: z.enum(["helplessness", "self_efficacy"]).nullish(),
  })
  .superRefine((q, ctx) => {
    const bad = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });

    if (q.type === "single" || q.type === "multi" || q.type === "likert") {
      if (!q.options) return bad("Choices are required", "options");
      const values = q.options.map((o) => String(o.value));
      if (new Set(values).size !== values.length) bad("Choice values must be unique", "options");
      if (q.type === "likert" && q.options.some((o) => typeof o.value !== "number")) bad("Scale points need numeric values", "options");
    } else if (q.options) {
      bad("This question type has no choices", "options");
    }

    if (q.type === "scale") {
      const c = q.config;
      if (!c || typeof c.min !== "number" || typeof c.max !== "number") return bad("Scale needs a minimum and maximum", "config");
      if (c.min < 0 || c.max > 10 || c.max - c.min < 1 || c.max - c.min > 10) bad("Scale must be within 0–10 and have at least 2 points", "config");
    }
    if (q.type === "number" && q.config) {
      const { min, max } = q.config;
      if (typeof min === "number" && typeof max === "number" && min > max) bad("Minimum is above maximum", "config");
    }
    if (q.subscale && q.type !== "likert" && q.type !== "scale") bad("Only scale-type questions can be scored", "subscale");
    if (q.reverse_scored && !q.subscale) bad("Reverse scoring needs a scoring subscale", "reverse_scored");
  });

export type QuestionSpec = z.infer<typeof questionSpecSchema>;

/** Row values for insert/update (options/config nulled where the type does not use them). */
export function specToRow(q: QuestionSpec) {
  const usesOptions = q.type === "single" || q.type === "multi" || q.type === "likert";
  const usesConfig = q.type === "scale" || (q.type === "number" && q.config && (q.config.min !== undefined || q.config.max !== undefined));
  return {
    section: q.section,
    type: q.type,
    text: q.text,
    required: q.required,
    options: usesOptions ? q.options : null,
    config: usesConfig ? q.config : null,
    reverse_scored: q.subscale ? q.reverse_scored : false,
    subscale: q.subscale ?? null,
  };
}

/**
 * Server-side check of one answer against the question definition
 * (mirrors submit_survey(), which is authoritative). Returns false when invalid.
 * Blank values must be handled by the caller.
 */
export function answerMatchesQuestion(q: Pick<Question, "type" | "options" | "config">, v: AnswerValue): boolean {
  const optionValues = new Set((q.options ?? []).map((o) => o.value));
  switch (q.type) {
    case "single":
    case "likert":
      return (typeof v === "string" || typeof v === "number") && optionValues.has(v);
    case "multi":
      return (
        Array.isArray(v) &&
        v.length <= optionValues.size &&
        new Set(v).size === v.length &&
        v.every((x) => optionValues.has(x))
      );
    case "scale":
      return (
        typeof v === "number" &&
        Number.isInteger(v) &&
        v >= (q.config?.min ?? 0) &&
        v <= (q.config?.max ?? 0)
      );
    case "number":
      return (
        typeof v === "number" &&
        Number.isFinite(v) &&
        (q.config?.min === undefined || v >= q.config.min) &&
        (q.config?.max === undefined || v <= q.config.max)
      );
    case "text":
      return typeof v === "string" && v.length <= 2000;
  }
}
