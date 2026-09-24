export type QuestionOption = { value: string | number; label: string };

export type QuestionType = "likert" | "single" | "text" | "number";
export type QuestionSection = "pss10" | "stressors" | "open_ended" | "demographics";

/** Question as shown to respondents (public columns only). */
export type Question = {
  id: string;
  key: string;
  section: QuestionSection;
  type: QuestionType;
  text: string;
  options: QuestionOption[] | null;
  required: boolean;
  position: number;
};

/** Full row as seen by admins. */
export type AdminQuestion = Question & {
  survey_version_id: string;
  reverse_scored: boolean;
  subscale: "helplessness" | "self_efficacy" | null;
  locked: boolean;
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

export type AnswerValue = string | number | null;
export type AnswerMap = Record<string, AnswerValue>;

export type Details = {
  name: string;
  roll_no: string;
  email: string;
  year: number | null;
  branch: string;
};
