"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Toast, type ToastState } from "@/components/ui/Toast";
import type { AdminQuestion, QuestionSection, SurveyVersion } from "@/lib/types";
import { NewQuestionForm, QuestionEditor } from "./QuestionEditor";

const TABS: Array<{ id: QuestionSection; label: string }> = [
  { id: "pss10", label: "PSS-10" },
  { id: "stressors", label: "Stressors" },
  { id: "open_ended", label: "Open-ended" },
  { id: "demographics", label: "Demographics" },
];

const STATUS_TONE = { draft: "draft", published: "published", closed: "closed" } as const;

type Props = { versions: SurveyVersion[]; selectedId: string; questions: AdminQuestion[] };

export function QuestionManager({ versions, selectedId, questions }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<QuestionSection>("pss10");
  const [toast, setToast] = useState<ToastState>(null);
  const selected = versions.find((v) => v.id === selectedId)!;
  const editable = selected.status === "draft";
  const hasDraft = versions.some((v) => v.status === "draft");

  async function call(url: string, method: string, body?: unknown) {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
      if (!res.ok) {
        setToast({ tone: "error", message: data.message ?? "That change could not be saved." });
        return false;
      }
      setToast({ tone: "success", message: "Saved" });
      router.refresh();
      return true;
    } catch {
      setToast({ tone: "error", message: "Network error. Please try again." });
      return false;
    }
  }

  async function cloneVersion() {
    const res = await fetch("/api/admin/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clone", id: selected.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok && data.id) router.push(`/admin/questions?v=${data.id}`);
    else setToast({ tone: "error", message: data.message ?? "Could not create a new version." });
  }

  function move(list: AdminQuestion[], index: number, dir: -1 | 1) {
    const ids = list.map((q) => q.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void call("/api/admin/questions/reorder", "POST", { survey_version_id: selected.id, ordered_ids: ids });
  }

  const inTab = questions.filter((q) => q.section === tab).sort((a, b) => a.position - b.position);
  const movable = inTab.filter((q) => !q.locked);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => router.push(`/admin/questions?v=${v.id}`)}
            aria-current={v.id === selectedId ? "true" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-[15px] ${v.id === selectedId ? "border-primary bg-primary-tint" : "border-line-strong bg-surface hover:border-primary"}`}
          >
            Version {v.version} <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
          </button>
        ))}
        {!hasDraft && (
          <Button variant="secondary" onClick={cloneVersion}>
            Create new version from Version {selected.version}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        {editable ? (
          <p className="text-[15px]">
            <strong>Draft</strong> — custom questions can be edited. The PSS-10 stays locked. Once published, this version can no longer be edited.
          </p>
        ) : (
          <p className="text-[15px]">
            🔒 <strong>{selected.status === "published" ? "Published" : "Closed"}</strong> — editing disabled. To change the instrument, create a new version.
          </p>
        )}
        {editable && (
          <Button
            onClick={() => {
              if (window.confirm(`Publish Version ${selected.version}? The current published version will be closed and this one will start collecting responses. It cannot be edited afterwards.`))
                void call("/api/admin/versions", "POST", { action: "publish", id: selected.id });
            }}
          >
            Publish Version {selected.version}
          </Button>
        )}
        {selected.status === "published" && (
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm("Close this version? The survey will stop accepting responses until another version is published."))
                void call("/api/admin/versions", "POST", { action: "close", id: selected.id });
            }}
          >
            Close data collection
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Question sections" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-t-md px-4 py-2 text-[15px] ${tab === t.id ? "border-b-2 border-primary font-medium text-primary" : "text-muted hover:text-ink"}`}
          >
            {t.label} ({questions.filter((q) => q.section === t.id).length})
          </button>
        ))}
      </div>

      {tab === "pss10" && (
        <div className="rounded-lg border border-primary/30 bg-primary-tint p-5">
          <p className="font-semibold text-primary">🔒 Locked core instrument</p>
          <p className="mt-1 text-[15px]">
            PSS-10 — standardized questionnaire (Cohen, Kamarck &amp; Mermelstein, 1983). Wording, scoring and order are fixed. Editing is disabled.
          </p>
        </div>
      )}

      {inTab.length === 0 ? (
        <p className="text-muted">No questions in this section.</p>
      ) : (
        <ol className="space-y-3">
          {inTab.map((q) => {
            const mi = movable.findIndex((m) => m.id === q.id);
            return (
              <QuestionEditor
                key={q.id}
                question={q}
                editable={editable}
                isFirst={mi <= 0}
                isLast={mi === movable.length - 1}
                call={call}
                onMove={(dir) => move(movable, mi, dir)}
              />
            );
          })}
        </ol>
      )}

      {editable && tab !== "pss10" && <NewQuestionForm versionId={selected.id} call={call} />}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
