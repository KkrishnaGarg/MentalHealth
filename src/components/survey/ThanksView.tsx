"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SupportLinks } from "@/components/SupportLinks";
import { InfoCard } from "@/components/ui/Display";
import { flow } from "@/lib/flowState";
import { useMounted } from "@/lib/useMounted";

const NEXT = ["Your response", "Data analysis", "Research findings", "Aggregate results"];

export function ThanksView() {
  const router = useRouter();
  const mounted = useMounted();
  const ok = mounted && flow.wasSubmitted();

  useEffect(() => {
    if (mounted && !ok) router.replace("/");
  }, [mounted, ok, router]);

  if (!ok) return null;

  return (
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage-tint text-sage">
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">Thank you for participating</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
          Your response has been successfully recorded and will contribute to our academic research on student
          experiences of academic stress.
        </p>
      </div>

      <InfoCard title="What happens next?">
        <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {NEXT.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="rounded-md bg-primary-tint px-3 py-1.5 text-[15px] text-primary">{s}</span>
              {i < NEXT.length - 1 && (
                <span aria-hidden="true" className="text-muted">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-muted">No individual responses will be displayed publicly.</p>
      </InfoCard>

      <InfoCard title="Need support?" tone="sage">
        <p className="mb-4">If this survey brought up concerns or you would like someone to talk to:</p>
        <SupportLinks />
      </InfoCard>
    </div>
  );
}
