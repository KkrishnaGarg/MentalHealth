import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function InfoCard({
  title,
  children,
  tone = "neutral",
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: "neutral" | "sage" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-surface",
    sage: "border-sage/40 bg-sage-tint",
    warning: "border-warning/40 bg-warning-tint",
  };
  return (
    <div className={cn("rounded-lg border p-6 shadow-subtle", tones[tone], className)}>
      {title && <h2 className="mb-3 text-xl font-semibold text-ink">{title}</h2>}
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "draft" | "published" | "closed" | "locked" | "flag";
}) {
  const tones = {
    neutral: "bg-line text-ink",
    draft: "bg-warning-tint text-warning",
    published: "bg-sage-tint text-primary",
    closed: "bg-line text-muted",
    locked: "bg-primary-tint text-primary",
    flag: "bg-danger-tint text-danger",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-muted">{children}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-skeleton rounded-md bg-line", className)} />;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-muted">
      <svg className="size-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 shadow-subtle">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  note,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-subtle">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
    </section>
  );
}
