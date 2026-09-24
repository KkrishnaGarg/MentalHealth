import type { ReactNode } from "react";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
