import { z } from "zod";
import { BRANCHES } from "./constants";

const text = (max: number) => z.string().trim().min(1).max(max);

export const respondentSchema = z.object({
  name: text(200),
  roll_no: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9\-_/]+$/, "Roll number may contain letters, digits, - _ /"),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  year: z.number().int().min(1).max(4),
  branch: z.enum(BRANCHES),
});

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const submitSchema = z.object({
  survey_version_id: uuid,
  consented: z.literal(true),
  respondent: respondentSchema,
  // Fine-grained per-question validation (allowed options, types, required
  // items) happens against the stored question metadata in the API route and
  // again inside the submit_survey() database function.
  answers: z
    .array(
      z.object({
        question_id: uuid,
        value: z.union([z.string().max(2000), z.number().finite(), z.null()]),
      }),
    )
    .max(100),
  total_time_s: z.number().int().min(0).max(86400).optional(),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(0).optional(),
});

export type SubmitPayload = z.infer<typeof submitSchema>;

export const questionCreateSchema = z.object({
  survey_version_id: uuid,
  section: z.enum(["stressors", "open_ended", "demographics"]),
  text: text(1000),
  required: z.boolean().default(true),
  options: z
    .array(z.object({ value: z.union([z.string(), z.number()]), label: text(200) }))
    .min(2)
    .max(12)
    .optional(),
});

export const questionUpdateSchema = z.object({
  text: text(1000).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
  options: z
    .array(z.object({ value: z.union([z.string(), z.number()]), label: text(200) }))
    .min(2)
    .max(12)
    .optional(),
});

export const reorderSchema = z.object({
  survey_version_id: uuid,
  ordered_ids: z.array(uuid).min(1).max(100),
});

export const cleaningDecisionSchema = z.object({
  respondent_id: uuid,
  response_id: uuid,
  flag_type: z.enum(["fast", "incomplete", "duplicate_email", "straightline", "other"]),
  decision: z.enum(["keep", "exclude", "needs_review"]),
  reason: text(1000),
});
