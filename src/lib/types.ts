export type QuestionOption = { value: string | number; label: string };

/**
 * single  = choose one (also used for True/False)
 * multi   = choose any number (checkboxes)
 * likert  = choose one labelled point, numeric values (used by PSS-10)
 * scale   = pick a number on a custom range with end labels
 * number  = type a number (optional min/max)
 * text    = free text
 */
export type QuestionType = "single" | "multi" | "likert" | "scale" | "number" | "text";
export type QuestionSection = "pss10" | "stressors" | "open_ended" | "demographics";

export type QuestionConfig = {
  min?: number;
  max?: number;
  min_label?: string;
  max_label?: string;
};

/** Question as shown to respondents (public columns only). */
export type Question = {
  id: string;
  key: string;
  section: QuestionSection;
  type: QuestionType;
  text: string;
  options: QuestionOption[] | null;
  config: QuestionConfig | null;
  required: boolean;
  position: number;
};

/** Full row as seen by admins. */
export type AdminQuestion = Question & {
  survey_version_id: string;
  reverse_scored: boolean;
  subscale: "helplessness" | "self_efficacy" | null;
  active: boolean;
};

export type SurveyVersion = {
  id: string;
  version: number;
  status: "draft" | "published" | "closed";
  created_at: string;
  published_at: string | null;
  closed_at: string | null;
};

export type AnswerValue = string | number | Array<string | number> | null;
export type AnswerMap = Record<string, AnswerValue>;

export type Details = {
  name: string;
  roll_no: string;
  email: string;
  year: number | null;
  branch: string;
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "Multiple choice (pick one)",
  multi: "Checkboxes (pick several)",
  likert: "Labelled scale (e.g. Never … Very often)",
  scale: "Number scale (custom range)",
  number: "Number entry",
  text: "Text answer",
};

/** Whether a stored answer counts as "answered". */
export function isAnswered(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
