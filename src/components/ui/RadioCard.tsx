import { cn } from "@/lib/cn";

type RadioCardProps = {
  name: string;
  value: string | number;
  label: string;
  checked: boolean;
  onChange: () => void;
  describedBy?: string;
};

/** Accessible selection card: a real radio input, visually a card with a check mark. */
export function RadioCard({ name, value, label, checked, onChange, describedBy }: RadioCardProps) {
  return (
    <label
      className={cn(
        "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-150",
        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        checked ? "border-primary bg-primary-tint" : "border-line-strong bg-surface hover:border-primary",
      )}
    >
      <input
        type="radio"
        name={name}
        value={String(value)}
        checked={checked}
        onChange={onChange}
        aria-describedby={describedBy}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
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
