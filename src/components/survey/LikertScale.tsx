"use client";

import { RadioCard } from "@/components/ui/RadioCard";
import { cn } from "@/lib/cn";
import type { AnswerValue, QuestionOption } from "@/lib/types";

type LikertProps = {
  name: string;
  options: QuestionOption[];
  value: AnswerValue | undefined;
  onChange: (v: string | number) => void;
  describedBy?: string;
};

/** Single choice: full-width option cards (mobile-first; no horizontal scrolling). */
export function LikertScale({ name, options, value, onChange, describedBy }: LikertProps) {
  return (
    <div className="grid gap-2.5">
      {options.map((o) => (
        <RadioCard
          key={String(o.value)}
          name={name}
          value={o.value}
          label={o.label}
          checked={value === o.value}
          onChange={() => onChange(o.value)}
          describedBy={describedBy}
        />
      ))}
    </div>
  );
}

type NumberScaleProps = {
  name: string;
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  value: number | undefined;
  onChange: (v: number) => void;
  describedBy?: string;
};

/** Custom numeric range (e.g. 1–5, 0–10) with optional end labels. */
export function NumberScale({ name, min, max, minLabel, maxLabel, value, onChange, describedBy }: NumberScaleProps) {
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  // 2-6 points fit one row on a phone; longer scales wrap to two rows.
  const cols = points.length <= 6 ? points.length : Math.ceil(points.length / 2);
  return (
    <div>
      <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {points.map((p) => {
          const checked = value === p;
          return (
            <label
              key={p}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-md border text-lg font-medium transition-colors duration-150",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink hover:border-primary",
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(p)}
                checked={checked}
                onChange={() => onChange(p)}
                aria-describedby={describedBy}
                aria-label={`${p}${p === min && minLabel ? ` — ${minLabel}` : p === max && maxLabel ? ` — ${maxLabel}` : ""}`}
                className="sr-only"
              />
              {p}
            </label>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="mt-2 flex justify-between gap-4 text-sm text-muted">
          <span>{minLabel}</span>
          <span className="text-right">{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

/** Checkbox styled as a selection card (multiple choice). */
export function CheckboxCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={cn(
        "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-150",
        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        checked ? "border-primary bg-primary-tint" : "border-line-strong bg-surface hover:border-primary",
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-sm border",
          checked ? "border-primary bg-primary text-white" : "border-line-strong bg-surface",
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-base text-ink">{label}</span>
    </label>
  );
}
