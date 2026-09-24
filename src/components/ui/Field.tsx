import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full min-h-11 rounded-md border bg-surface px-3 py-2 text-base text-ink placeholder:text-muted transition-colors duration-150 focus:border-primary";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
};

export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[15px] font-medium text-ink">
        {label}
        {optional && <span className="ml-2 font-normal text-muted">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return ids || undefined;
}

type BaseProps = { id: string; label: string; hint?: string; error?: string; optional?: boolean };

export function Input({ id, label, hint, error, optional, className, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, error ? "border-danger" : "border-line-strong", className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, error ? "border-danger" : "border-line-strong", className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function Textarea({
  id,
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, "min-h-36 resize-y leading-relaxed", error ? "border-danger" : "border-line-strong", className)}
        {...rest}
      />
    </FieldShell>
  );
}
