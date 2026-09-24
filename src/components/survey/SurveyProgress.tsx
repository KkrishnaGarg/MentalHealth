type Props = { label: string; step: number; total: number };

/** Meaningful progress: names the current section and shows overall completion. */
export function SurveyProgress({ label, step, total }: Props) {
  const pct = Math.round((step / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          {label} · Step {step} of {total}
        </p>
        <p className="text-sm tabular-nums text-muted">{pct}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Survey progress: step ${step} of ${total}, ${label}`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
