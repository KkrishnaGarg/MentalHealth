"use client";

import { Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { AnswerValue, Question } from "@/lib/types";
import { LikertScale } from "./LikertScale";

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
      {!q.required && <span className="ml-2 text-[15px] font-normal text-muted">(optional)</span>}
    </>
  );

  return (
    <div
      id={`q-${q.id}`}
      tabIndex={-1}
      className={cn(
        "rounded-lg border bg-surface p-5 shadow-subtle sm:p-6",
        error ? "border-danger" : "border-line",
      )}
    >
      {q.type === "text" ? (
        <Textarea
          id={`field-${q.id}`}
          label={q.text}
          optional={!q.required}
          hint={!q.required ? "You can skip this question if you don't want to share." : undefined}
          value={typeof value === "string" ? value : ""}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : q.type === "number" ? (
        <Input
          id={`field-${q.id}`}
          label={q.text}
          type="number"
          optional={!q.required}
          value={typeof value === "number" ? value : ""}
          error={error ? "Please enter a number." : undefined}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : (
        <fieldset aria-describedby={error ? errId : undefined}>
          <legend className="mb-4 text-lg font-medium leading-snug text-ink">{heading}</legend>
          <LikertScale
            name={`q-${q.id}`}
            options={q.options ?? []}
            value={value}
            onChange={onChange}
            layout={q.section === "stressors" ? "scale" : "stack"}
            describedBy={error ? errId : undefined}
          />
          {error && (
            <p id={errId} role="alert" className="mt-3 text-sm text-danger">
              Please choose an answer to continue.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
