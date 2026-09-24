"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import type { FlagType } from "@/lib/analytics";

const DECISIONS = [
  { value: "keep", label: "Keep in analysis" },
  { value: "exclude", label: "Exclude from analysis" },
  { value: "needs_review", label: "Needs further review" },
];

/** Records a data-cleaning decision. The response itself is never modified or deleted. */
export function CleaningForm({ respondentId, responseId, flags }: { respondentId: string; responseId: string; flags: FlagType[] }) {
  const router = useRouter();
  const [flag, setFlag] = useState<string>(flags[0] ?? "other");
  const [decision, setDecision] = useState("keep");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/cleaning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respondent_id: respondentId, response_id: responseId, flag_type: flag, decision, reason }),
    });
    setBusy(false);
    if (res.ok) {
      setReason("");
      setMsg("Saved");
      router.refresh();
    } else setMsg("Could not save the decision.");
  }

  const sel = "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px]";
  return (
    <form onSubmit={save} className="space-y-3 border-t border-line pt-3">
      <h3 className="text-sm font-semibold text-muted">Record a cleaning decision</h3>
      <label className="block text-sm text-muted">
        Regarding
        <select value={flag} onChange={(e) => setFlag(e.target.value)} className={sel}>
          {[...new Set([...flags, "other"])].map((f) => (
            <option key={f} value={f}>
              {f.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-muted">
        Decision
        <select value={decision} onChange={(e) => setDecision(e.target.value)} className={sel}>
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <Textarea id="reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={1000} className="min-h-24" />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !reason.trim()}>
          Save decision
        </Button>
        {msg && (
          <span role="status" className="text-sm text-muted">
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
