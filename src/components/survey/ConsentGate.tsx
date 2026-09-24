"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { InfoCard } from "@/components/ui/Display";
import { SupportLinks } from "@/components/SupportLinks";
import { flow } from "@/lib/flowState";

const POINTS = [
  "Participation is voluntary.",
  "You can leave the survey at any time before submitting; nothing is recorded if you do.",
  "Your responses are confidential.",
  "Your identifying information (name, roll number, email) is stored separately from your survey answers.",
  "Only authorized administrators can access identifying information.",
  "We do not intentionally collect IP addresses or device fingerprints.",
  "Responses are used for the LNMIIT HSS academic research project.",
];

export function ConsentGate() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  function proceed() {
    if (!agreed) return;
    flow.setConsent();
    router.push("/details");
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Before you begin</h1>
        <p className="mt-3 text-lg text-muted">
          Your participation is voluntary. This survey is part of an academic study on academic stress among college
          students.
        </p>
      </div>

      <InfoCard title="What you should know">
        <ul className="space-y-3">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden="true" className="mt-1 text-sage">
                ✓
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[15px] text-muted">
          This survey is <strong className="text-ink">confidential, not anonymous</strong>, because your identity
          details are collected so that authorized administrators can link them to your response.
        </p>
      </InfoCard>

      <InfoCard title="Important" tone="warning">
        <p>This survey is for academic research. It is not a clinical diagnosis or a mental-health assessment.</p>
      </InfoCard>

      <InfoCard title="Need support?" tone="sage">
        <p className="mb-4">If any question makes you uncomfortable, or you would like support, you can contact:</p>
        <SupportLinks />
      </InfoCard>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-surface p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <span>I have read the information above and voluntarily consent to participate.</span>
      </label>

      <div>
        <Button size="lg" onClick={proceed} disabled={!agreed}>
          Continue to your details
        </Button>
      </div>
    </div>
  );
}
