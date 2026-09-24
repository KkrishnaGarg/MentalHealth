"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import {
  QUESTION_TYPE_LABELS,
  type AdminQuestion,
  type QuestionConfig,
  type QuestionOption,
  type QuestionSection,
  type QuestionType,
} from "@/lib/types";

export type Api = (url: string, method: string, body?: unknown) => Promise<boolean>;

export const SECTION_LABELS: Record<QuestionSection, string> = {
  pss10: "PSS-10 (stress scale)",
  stressors: "Academic stressors",
  open_ended: "Open-ended",
  demographics: "Demographics / other",
};

/** UI-level types: "tf" is a True/False template stored as a single-choice question. */
type UiType = QuestionType | "tf";

const UI_TYPE_LABELS: Record<UiType, string> = { ...QUESTION_TYPE_LABELS, tf: "True / False" };

type Draft = {
  section: QuestionSection;
  type: UiType;
  text: string;
  required: boolean;
  options: QuestionOption[];
  config: QuestionConfig;
  subscale: "" | "helplessness" | "self_efficacy";
  reverse_scored: boolean;
};

const TF_OPTIONS: QuestionOption[] = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
];

function isTrueFalse(o: QuestionOption[] | null) {
  return !!o && o.length === 2 && o[0].value === "true" && o[1].value === "false";
}

function fromQuestion(q: AdminQuestion): Draft {
  return {
    section: q.section,
    type: q.type === "single" && isTrueFalse(q.options) ? "tf" : q.type,
    text: q.text,
    required: q.required,
    options: q.options ?? [],
    config: q.config ?? (q.type === "scale" ? { min: 1, max: 5 } : {}),
    subscale: q.subscale ?? "",
    reverse_scored: q.reverse_scored,
  };
}

function blank(section: QuestionSection): Draft {
  return {
    section,
    type: section === "open_ended" ? "text" : section === "stressors" ? "scale" : "single",
    text: "",
    required: section === "stressors" || section === "pss10",
    options: [
      { value: "opt_1", label: "" },
      { value: "opt_2", label: "" },
    ],
    config: { min: 1, max: 5 },
    subscale: "",
    reverse_scored: false,
  };
}

/** Convert the form state into the API payload (only the fields the chosen type uses). */
function toSpec(d: Draft) {
  const type: QuestionType = d.type === "tf" ? "single" : d.type;
  const choice = type === "single" || type === "multi" || type === "likert";
  const options = d.type === "tf" ? TF_OPTIONS : d.options.map((o) => ({ value: o.value, label: o.label.trim() }));
  let config: QuestionConfig | null = null;
  if (type === "scale") {
    config = { min: d.config.min ?? 1, max: d.config.max ?? 5 };
    if (d.config.min_label?.trim()) config.min_label = d.config.min_label.trim();
    if (d.config.max_label?.trim()) config.max_label = d.config.max_label.trim();
  } else if (type === "number") {
    const c: QuestionConfig = {};
    if (typeof d.config.min === "number") c.min = d.config.min;
    if (typeof d.config.max === "number") c.max = d.config.max;
    config = Object.keys(c).length ? c : null;
  }
  const scorable = type === "likert" || type === "scale";
  return {
    section: d.section,
    type,
    text: d.text.trim(),
    required: d.required,
    options: choice ? options : null,
    config,
    subscale: scorable && d.subscale ? d.subscale : null,
    reverse_scored: scorable && d.subscale ? d.reverse_scored : false,
  };
}

function nextValue(options: QuestionOption[]) {
  let n = options.length + 1;
  const used = new Set(options.map((o) => String(o.value)));
  while (used.has(`opt_${n}`)) n++;
  return `opt_${n}`;
}

const sel = "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px] text-ink";

/** Google-Forms-style question editor: type, text, choices / scale, required, category, optional scoring. */
function QuestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (spec: ReturnType<typeof toSpec>) => Promise<boolean>;
  onCancel?: () => void;
  idPrefix: string;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  function changeType(t: UiType) {
    setD((x) => {
      const next = { ...x, type: t };
      if (t === "likert") next.options = x.options.map((o, i) => ({ value: i + 1, label: o.label }));
      else if ((t === "single" || t === "multi") && x.options.some((o) => typeof o.value === "number")) {
        next.options = x.options.map((o, i) => ({ value: `opt_${i + 1}`, label: o.label }));
      }
      if ((t === "single" || t === "multi" || t === "likert") && x.type === "tf") {
        next.options = t === "likert" ? [{ value: 1, label: "True" }, { value: 2, label: "False" }] : TF_OPTIONS.map((o) => ({ ...o }));
      }
      if (t === "scale" && (typeof x.config.min !== "number" || typeof x.config.max !== "number")) next.config = { ...x.config, min: 1, max: 5 };
      return next;
    });
  }

  const choice = d.type === "single" || d.type === "multi" || d.type === "likert";
  const scorable = d.type === "likert" || d.type === "scale";
  const optionsValid = !choice || d.type === "tf" || (d.options.length >= 2 && d.options.every((o) => o.label.trim()));
  const scaleValid = d.type !== "scale" || (typeof d.config.min === "number" && typeof d.config.max === "number" && d.config.max - d.config.min >= 1 && d.config.max - d.config.min <= 10);
  const valid = d.text.trim().length > 0 && optionsValid && scaleValid;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const ok = await onSubmit(toSpec(d));
    setBusy(false);
    if (ok && !onCancel) setD(blank(d.section));
  }

  const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));

  return (
    <form onSubmit={save} className="space-y-4">
      <Textarea id={`${idPrefix}-text`} label="Question" value={d.text} onChange={(e) => set("text", e.target.value)} maxLength={1000} className="min-h-20" required />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          Question type
          <select className={cn(sel, "mt-1")} value={d.type} onChange={(e) => changeType(e.target.value as UiType)}>
            {(Object.keys(UI_TYPE_LABELS) as UiType[]).map((t) => (
              <option key={t} value={t}>
                {UI_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted">
          Category
          <select className={cn(sel, "mt-1")} value={d.section} onChange={(e) => set("section", e.target.value as QuestionSection)}>
            {(Object.keys(SECTION_LABELS) as QuestionSection[]).map((s) => (
              <option key={s} value={s}>
                {SECTION_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {choice && d.type !== "tf" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[15px] font-medium">{d.type === "likert" ? "Scale points (numeric value, label)" : "Choices"}</legend>
          {d.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              {d.type === "likert" && (
                <input
                  aria-label={`Value for point ${i + 1}`}
                  type="number"
                  value={typeof o.value === "number" ? o.value : ""}
                  onChange={(e) => set("options", d.options.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)))}
                  className="min-h-11 w-20 rounded-md border border-line-strong bg-surface px-2 py-2 text-[15px]"
                />
              )}
              <input
                aria-label={`Choice ${i + 1}`}
                value={o.label}
                maxLength={200}
                placeholder={`Choice ${i + 1}`}
                onChange={(e) => set("options", d.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]"
              />
              <Button
                variant="ghost"
                aria-label={`Remove choice ${i + 1}`}
                disabled={d.options.length <= 2}
                onClick={() => set("options", d.options.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
          ))}
          {d.options.length < 20 && (
            <Button
              variant="secondary"
              onClick={() =>
                set("options", [
                  ...d.options,
                  d.type === "likert"
                    ? { value: Math.max(0, ...d.options.map((o) => (typeof o.value === "number" ? o.value : 0))) + 1, label: "" }
                    : { value: nextValue(d.options), label: "" },
                ])
              }
            >
              + Add {d.type === "likert" ? "point" : "choice"}
            </Button>
          )}
        </fieldset>
      )}

      {d.type === "tf" && <p className="text-sm text-muted">Respondents choose True or False.</p>}

      {d.type === "scale" && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-[15px] font-medium">Number scale</legend>
          <Input id={`${idPrefix}-min`} label="From" type="number" min={0} max={9} value={d.config.min ?? ""} onChange={(e) => set("config", { ...d.config, min: num(e.target.value) })} />
          <Input id={`${idPrefix}-max`} label="To" type="number" min={1} max={10} value={d.config.max ?? ""} onChange={(e) => set("config", { ...d.config, max: num(e.target.value) })} error={scaleValid ? undefined : "Use a range within 0–10 with at least 2 points."} />
          <Input id={`${idPrefix}-minl`} label="Label for the low end" optional value={d.config.min_label ?? ""} maxLength={80} onChange={(e) => set("config", { ...d.config, min_label: e.target.value })} />
          <Input id={`${idPrefix}-maxl`} label="Label for the high end" optional value={d.config.max_label ?? ""} maxLength={80} onChange={(e) => set("config", { ...d.config, max_label: e.target.value })} />
        </fieldset>
      )}

      {d.type === "number" && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-[15px] font-medium">Allowed range (optional)</legend>
          <Input id={`${idPrefix}-nmin`} label="Minimum" type="number" optional value={d.config.min ?? ""} onChange={(e) => set("config", { ...d.config, min: num(e.target.value) })} />
          <Input id={`${idPrefix}-nmax`} label="Maximum" type="number" optional value={d.config.max ?? ""} onChange={(e) => set("config", { ...d.config, max: num(e.target.value) })} />
        </fieldset>
      )}

      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" checked={d.required} onChange={(e) => set("required", e.target.checked)} className="size-5 accent-primary" />
        <span>
          <strong>Compulsory</strong> — respondents must answer this question
        </span>
      </label>

      {scorable && (
        <details className="rounded-md border border-line bg-background p-3" open={!!d.subscale}>
          <summary className="cursor-pointer text-[15px] font-medium">Scoring (advanced)</summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm text-muted">
              Count this question toward the stress score as
              <select className={cn(sel, "mt-1")} value={d.subscale} onChange={(e) => set("subscale", e.target.value as Draft["subscale"])}>
                <option value="">Not scored (a normal question)</option>
                <option value="helplessness">Perceived helplessness</option>
                <option value="self_efficacy">Lack of self-efficacy</option>
              </select>
            </label>
            {d.subscale && (
              <label className="flex items-center gap-3 text-[15px]">
                <input type="checkbox" checked={d.reverse_scored} onChange={(e) => set("reverse_scored", e.target.checked)} className="size-5 accent-primary" />
                Reverse-score (high answers count as low)
              </label>
            )}
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !valid}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function summary(q: AdminQuestion): string {
  if (q.type === "scale") return `${q.config?.min ?? "?"}–${q.config?.max ?? "?"}${q.config?.min_label ? ` (${q.config.min_label} → ${q.config.max_label ?? ""})` : ""}`;
  if (q.type === "number") return q.config ? `range ${q.config.min ?? "…"}–${q.config.max ?? "…"}` : "any number";
  if (q.options) return q.options.map((o) => o.label).join(" · ");
  return "";
}

type RowProps = {
  question: AdminQuestion;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  call: Api;
  onMove: (dir: -1 | 1) => void;
};

/** One question row: read-only summary in published/closed versions, full controls in a draft. */
export function QuestionEditor({ question: q, editable, isFirst, isLast, call, onMove }: RowProps) {
  const [editing, setEditing] = useState(false);
  const label = q.type === "single" && isTrueFalse(q.options) ? "True / False" : QUESTION_TYPE_LABELS[q.type];

  return (
    <li className={cn("rounded-lg border bg-surface p-4 shadow-subtle", q.active ? "border-line" : "border-dashed border-line-strong opacity-80")}>
      {editing ? (
        <QuestionForm
          idPrefix={`e-${q.id}`}
          initial={fromQuestion(q)}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (spec) => {
            const ok = await call(`/api/admin/questions/${q.id}`, "PATCH", spec);
            if (ok) setEditing(false);
            return ok;
          }}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">{q.key}</span>
              <Badge>{label}</Badge>
              <Badge tone={q.required ? "published" : "neutral"}>{q.required ? "Compulsory" : "Optional"}</Badge>
              {q.subscale && <Badge tone="locked">Scored: {q.subscale === "helplessness" ? "helplessness" : "self-efficacy"}{q.reverse_scored ? " (reversed)" : ""}</Badge>}
              {!q.active && <Badge tone="closed">Hidden from survey</Badge>}
            </div>
            <p className="text-ink">{q.text}</p>
            {summary(q) && <p className="mt-1 text-sm text-muted">{summary(q)}</p>}
          </div>

          {editable && (
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="ghost" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move question up">
                ↑ Up
              </Button>
              <Button variant="ghost" onClick={() => onMove(1)} disabled={isLast} aria-label="Move question down">
                ↓ Down
              </Button>
              <Button variant="ghost" onClick={() => call(`/api/admin/questions/${q.id}`, "PATCH", { active: !q.active })}>
                {q.active ? "Hide" : "Show"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Delete this question from the draft version?")) void call(`/api/admin/questions/${q.id}`, "DELETE");
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function NewQuestionForm({ versionId, section, call }: { versionId: string; section: QuestionSection; call: Api }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface p-4">
      <h3 className="mb-3 font-semibold">Add a question</h3>
      <QuestionForm
        key={section}
        idPrefix="new"
        initial={blank(section)}
        submitLabel="Add question"
        onSubmit={(spec) => call("/api/admin/questions", "POST", { survey_version_id: versionId, question: spec })}
      />
    </div>
  );
}
