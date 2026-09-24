"use client";

import { RadioCard } from "@/components/ui/RadioCard";
import { cn } from "@/lib/cn";
import type { AnswerValue, QuestionOption } from "@/lib/types";

type Props = {
  name: string;
  options: QuestionOption[];
  value: AnswerValue | undefined;
  onChange: (v: string | number) => void;
  describedBy?: string;
  /** "stack": full-width option cards (default, mobile-first). "scale": compact numeric row with end anchors. */
  layout?: "stack" | "scale";
};

export function LikertScale({ name, options, value, onChange, describedBy, layout = "stack" }: Props) {
  if (layout === "stack") {
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

  const first = options[0];
  const last = options[options.length - 1];
  return (
    <div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={String(o.value)}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-md border text-lg font-medium transition-colors duration-150",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink hover:border-primary",
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={checked}
                onChange={() => onChange(o.value)}
                aria-describedby={describedBy}
                aria-label={`${o.value} — ${o.label}`}
                className="sr-only"
              />
              {String(o.value)}
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-4 text-sm text-muted">
        <span>{first.label}</span>
        <span className="text-right">{last.label}</span>
      </div>
    </div>
  );
}
