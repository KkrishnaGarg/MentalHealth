"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Input, Textarea } from "@/components/ui/Field";
import type { AdminQuestion } from "@/lib/types";

type Api = (url: string, method: string, body?: unknown) => Promise<boolean>;

type Props = {
  question: AdminQuestion;
  editable: boolean; // version is a draft
  isFirst: boolean;
  isLast: boolean;
  call: Api;
  onMove: (dir: -1 | 1) => void;
};

/** One custom question row. Locked (PSS-10) and published rows never render controls. */
export function QuestionEditor({ question: q, editable, isFirst, isLast, call, onMove }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [required, setRequired] = useState(q.required);
  const canEdit = editable && !q.locked;

  async function save() {
    if (await call(`/api/admin/questions/${q.id}`, "PATCH", { text, required })) setEditing(false);
  }

  return (
    <li className="rounded-lg border border-line bg-surface p-4 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{q.key}</span>
            {q.locked && <Badge tone="locked">🔒 Locked</Badge>}
            {!q.active && <Badge tone="closed">Inactive</Badge>}
            {!q.required && <Badge>Optional</Badge>}
          </div>
          {editing ? (
            <div className="space-y-3">
              <Textarea id={`t-${q.id}`} label="Question text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-24" />
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4 accent-primary" />
                Required
              </label>
              <div className="flex gap-2">
                <Button onClick={save} disabled={!text.trim()}>
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setText(q.text);
                    setRequired(q.required);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-ink">{q.text}</p>
          )}
        </div>

        {canEdit && !editing && (
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move question up">
              ↑ Up
            </Button>
            <Button variant="ghost" onClick={() => onMove(1)} disabled={isLast} aria-label="Move question down">
              ↓ Down
            </Button>
            <Button variant="ghost" onClick={() => call(`/api/admin/questions/${q.id}`, "PATCH", { active: !q.active })}>
              {q.active ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Delete this question from the draft version?")) call(`/api/admin/questions/${q.id}`, "DELETE");
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

const SECTIONS = [
  { value: "stressors", label: "Academic stressor (1–5 scale)" },
  { value: "open_ended", label: "Open-ended (optional text)" },
  { value: "demographics", label: "Optional demographic (choices)" },
] as const;

export function NewQuestionForm({ versionId, call }: { versionId: string; call: Api }) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["value"]>("stressors");
  const [text, setText] = useState("");
  const [choices, setChoices] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const options = choices
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((label, i) => ({ value: `opt_${i + 1}`, label }));
    const ok = await call("/api/admin/questions", "POST", {
      survey_version_id: versionId,
      section,
      text,
      required: section === "stressors",
      ...(section === "demographics" ? { options } : {}),
    });
    if (ok) {
      setText("");
      setChoices("");
    }
  }

  return (
    <form onSubmit={add} className="space-y-3 rounded-lg border border-dashed border-line-strong bg-surface p-4">
      <h3 className="font-semibold">Add a custom question to this draft</h3>
      <label className="block text-sm text-muted">
        Type
        <select value={section} onChange={(e) => setSection(e.target.value as typeof section)} className="mt-1 min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[15px] text-ink">
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <Input id="new-q-text" label="Question text" value={text} onChange={(e) => setText(e.target.value)} required maxLength={1000} />
      {section === "demographics" && (
        <Textarea id="new-q-choices" label="Answer choices" hint="One choice per line (at least two)." value={choices} onChange={(e) => setChoices(e.target.value)} className="min-h-24" />
      )}
      <Button type="submit" disabled={!text.trim()}>
        Add question
      </Button>
    </form>
  );
}
