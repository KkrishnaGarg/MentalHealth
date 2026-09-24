"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { RadioCard } from "@/components/ui/RadioCard";
import { BRANCHES, YEARS } from "@/lib/constants";
import { flow } from "@/lib/flowState";
import { useMounted } from "@/lib/useMounted";
import type { Details } from "@/lib/types";
import { respondentSchema } from "@/lib/validation";

type Errors = Partial<Record<keyof Details, string>>;

const EMPTY: Details = { name: "", roll_no: "", email: "", year: null, branch: "" };

export function DetailsForm() {
  // sessionStorage is client-only: render nothing until mounted.
  return useMounted() ? <DetailsFormInner /> : null;
}

function DetailsFormInner() {
  const router = useRouter();
  const hasConsent = flow.getConsent() !== null;
  const [values, setValues] = useState<Details>(() => flow.getDetails() ?? EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!hasConsent) router.replace("/consent");
  }, [hasConsent, router]);

  function set<K extends keyof Details>(key: K, value: Details[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = respondentSchema.safeParse({ ...values, year: values.year ?? undefined });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Details;
        next[key] ??= messageFor(key);
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      document.getElementById(first === "year" ? "year-group" : first)?.focus();
      return;
    }
    flow.setDetails({ ...values, ...parsed.data });
    flow.setStep(0);
    router.push("/survey");
  }

  if (!hasConsent) return null;

  return (
    <form onSubmit={submit} noValidate className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">A little about you</h1>
        <p className="mt-3 text-lg text-muted">
          This information helps us understand patterns across different student groups. Your identifying information
          is kept separate from your survey answers and is accessible only to authorized administrators.
        </p>
      </div>

      <section className="space-y-5 rounded-lg border border-line bg-surface p-6 shadow-subtle" aria-labelledby="identity-h">
        <h2 id="identity-h" className="text-xl font-semibold">
          Identity
        </h2>
        <Input id="name" label="Full name" autoComplete="name" value={values.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
        <Input id="roll_no" label="Roll number" autoComplete="off" value={values.roll_no} error={errors.roll_no} onChange={(e) => set("roll_no", e.target.value)} />
        <Input id="email" label="Email" type="email" autoComplete="email" value={values.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
      </section>

      <section className="space-y-5 rounded-lg border border-line bg-surface p-6 shadow-subtle" aria-labelledby="academic-h">
        <h2 id="academic-h" className="text-xl font-semibold">
          Academic information
        </h2>
        <fieldset aria-describedby={errors.year ? "year-error" : undefined}>
          <legend className="mb-2 text-[15px] font-medium">Year</legend>
          <div id="year-group" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">
            {YEARS.map((y) => (
              <RadioCard key={y.value} name="year" value={y.value} label={y.label} checked={values.year === y.value} onChange={() => set("year", y.value)} />
            ))}
          </div>
          {errors.year && (
            <p id="year-error" role="alert" className="mt-1.5 text-sm text-danger">
              {errors.year}
            </p>
          )}
        </fieldset>
        <Select id="branch" label="Branch" value={values.branch} error={errors.branch} onChange={(e) => set("branch", e.target.value)}>
          <option value="">Select your branch</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </section>

      <div className="rounded-md bg-sage-tint p-4 text-[15px]">
        <p className="font-medium text-ink">Your privacy matters</p>
        <p className="mt-1 text-muted">
          Your identity details are stored separately from your survey responses and are not displayed in public
          results.
        </p>
      </div>

      <Button type="submit" size="lg">
        Continue to stress questions
      </Button>
    </form>
  );
}

function messageFor(key: keyof Details): string {
  switch (key) {
    case "name":
      return "Please enter your full name.";
    case "roll_no":
      return "Please enter your roll number (letters, digits, - _ / only).";
    case "email":
      return "Please enter a valid email address.";
    case "year":
      return "Please select your year.";
    case "branch":
      return "Please select your branch.";
  }
}
