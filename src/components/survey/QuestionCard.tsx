"use client";

import { Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { AnswerValue, Question } from "@/lib/types";
import { CheckboxCard, LikertScale, NumberScale } from "./LikertScale";

type Props = {
  question: Question;
  number?: number;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  error?: boolean;
};

export function QuestionCard({ question: q, number, value, onChange, error }: Props) {
  const errId = `q-${q.id}-error`;
  const heading = (
    <>
      {number !== undefined && <span className="mr-2 text-muted">{number}.</span>}
      {q.text}
      {q.required ? (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      ) : (
        <span className="ml-2 text-[15px] font-normal text-muted">(optional)</span>
      )}
    </>
  );
  const errorText = (
    <p id={errId} role="alert" className="mt-3 text-sm text-danger">
      {q.type === "number" && value !== undefined && value !== null ? "Please enter a valid number." : "This question is required."}
    </p>
  );

  return (
    <div
      id={`q-${q.id}`}
      tabIndex={-1}
      className={cn("rounded-lg border bg-surface p-5 shadow-subtle sm:p-6", error ? "border-danger" : "border-line")}
    >
      {q.type === "text" ? (
        <>
          <Textarea
            id={`field-${q.id}`}
            label={q.text}
            optional={!q.required}
            hint={!q.required ? "You can skip this question if you don't want to share." : undefined}
            value={typeof value === "string" ? value : ""}
            maxLength={2000}
            error={error ? "This question is required." : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
        </>
      ) : q.type === "number" ? (
        <Input
          id={`field-${q.id}`}
          label={q.text}
          type="number"
          inputMode="decimal"
          optional={!q.required}
          min={q.config?.min}
          max={q.config?.max}
          hint={
            q.config?.min !== undefined || q.config?.max !== undefined
              ? `Enter a number${q.config?.min !== undefined ? ` from ${q.config.min}` : ""}${q.config?.max !== undefined ? ` to ${q.config.max}` : ""}.`
              : undefined
          }
          value={typeof value === "number" ? value : ""}
          error={error ? "Please enter a valid number." : undefined}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : (
        <fieldset aria-describedby={error ? errId : undefined}>
          <legend className="mb-4 text-lg font-medium leading-snug text-ink">{heading}</legend>
          {q.type === "scale" ? (
            <NumberScale
              name={`q-${q.id}`}
              min={q.config?.min ?? 1}
              max={q.config?.max ?? 5}
              minLabel={q.config?.min_label}
              maxLabel={q.config?.max_label}
              value={typeof value === "number" ? value : undefined}
              onChange={onChange}
              describedBy={error ? errId : undefined}
            />
          ) : q.type === "multi" ? (
            <div className="grid gap-2.5">
              {(q.options ?? []).map((o) => {
                const list = Array.isArray(value) ? value : [];
                const checked = list.includes(o.value);
                return (
                  <CheckboxCard
                    key={String(o.value)}
                    label={o.label}
                    checked={checked}
                    onChange={() => onChange(checked ? list.filter((x) => x !== o.value) : [...list, o.value])}
                  />
                );
              })}
              <p className="text-sm text-muted">Select all that apply.</p>
            </div>
          ) : (
            <LikertScale
              name={`q-${q.id}`}
              options={q.options ?? []}
              value={value === undefined || Array.isArray(value) ? undefined : value}
              onChange={onChange}
              describedBy={error ? errId : undefined}
            />
          )}
          {error && errorText}
        </fieldset>
      )}
    </div>
  );
}
