"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Toast, type ToastState } from "@/components/ui/Toast";
import type { AdminQuestion, QuestionSection, SurveyVersion } from "@/lib/types";
import { NewQuestionForm, QuestionEditor, SECTION_LABELS } from "./QuestionEditor";

const TABS: QuestionSection[] = ["pss10", "stressors", "open_ended", "demographics"];
const TAB_LABEL: Record<QuestionSection, string> = { pss10: "PSS-10", stressors: "Stressors", open_ended: "Open-ended", demographics: "Demographics" };
const STATUS_TONE = { draft: "draft", published: "published", closed: "closed" } as const;

type Props = { versions: SurveyVersion[]; selectedId: string; questions: AdminQuestion[]; responseCounts: Record<string, number> };

export function QuestionManager({ versions, selectedId, questions, responseCounts }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<QuestionSection>("pss10");
  const [toast, setToast] = useState<ToastState>(null);
  const [busy, setBusy] = useState(false);
  const selected = versions.find((v) => v.id === selectedId)!;
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const editable = selected.status === "draft";
  const nextNumber = Math.max(...versions.map((v) => v.version)) + 1;

  async function call(url: string, method: string, body?: unknown) {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
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

  async function versionAction(action: "clone" | "publish" | "close" | "discard", id: string, then?: (newId?: string) => void) {
    setBusy(true);
    const res = await fetch("/api/admin/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { id?: string; message?: string } | undefined;
    setBusy(false);
    if (res?.ok) {
      then?.(data?.id);
      router.refresh();
    } else setToast({ tone: "error", message: data?.message ?? "That action failed. Please try again." });
  }

  function move(list: AdminQuestion[], index: number, dir: -1 | 1) {
    const ids = list.map((q) => q.id);
    const j = index + dir;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void call("/api/admin/questions/reorder", "POST", { survey_version_id: selected.id, ordered_ids: ids });
  }

  const inTab = questions.filter((q) => q.section === tab).sort((a, b) => a.position - b.position);
  const n = responseCounts[selected.id] ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => router.push(`/admin/questions?v=${v.version}`)}
            aria-current={v.id === selectedId ? "true" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-[15px] ${v.id === selectedId ? "border-primary bg-primary-tint" : "border-line-strong bg-surface hover:border-primary"}`}
          >
            Version {v.version} <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
            <span className="text-sm text-muted">· {responseCounts[v.id] ?? 0} responses</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        {editable ? (
          <p className="max-w-2xl text-[15px]">
            <strong>Draft — Version {selected.version}.</strong> Add, edit, retype, reorder or delete any question. Nothing you change here affects respondents until you
            publish. Publishing makes this the live survey; new responses are stored under Version {selected.version}, separate from earlier versions.
          </p>
        ) : (
          <p className="max-w-2xl text-[15px]">
            🔒 <strong>Version {selected.version} is {selected.status}</strong> and has {n} response{n === 1 ? "" : "s"}. It is frozen so its responses stay
            comparable. To change any question, start a new draft version.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Publish Version ${selected.version}? It becomes the live survey and the current published version is closed. It can't be edited afterwards.`))
                    void versionAction("publish", selected.id);
                }}
              >
                Publish Version {selected.version}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Discard the draft Version ${selected.version}? Your unpublished edits will be lost. Published versions are not affected.`))
                    void versionAction("discard", selected.id, () => router.push("/admin/questions"));
                }}
              >
                Discard draft
              </Button>
            </>
          )}
          {!editable && !draft && (
            <Button disabled={busy} onClick={() => void versionAction("clone", selected.id, (id) => id && router.push(`/admin/questions`))}>
              Edit questions → new draft (Version {nextNumber})
            </Button>
          )}
          {!editable && draft && (
            <Button onClick={() => router.push(`/admin/questions?v=${draft.version}`)}>Continue editing draft (Version {draft.version})</Button>
          )}
          {selected.status === "published" && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Close this version? The survey stops accepting responses until a version is published."))
                  void versionAction("close", selected.id);
              }}
            >
              Close data collection
            </Button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Question categories" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-t-md px-4 py-2 text-[15px] ${tab === t ? "border-b-2 border-primary font-medium text-primary" : "text-muted hover:text-ink"}`}
          >
            {TAB_LABEL[t]} ({questions.filter((q) => q.section === t).length})
          </button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-muted">{SECTION_LABELS[tab]}</p>

      {inTab.length === 0 ? (
        <p className="text-muted">No questions in this category.</p>
      ) : (
        <ol className="space-y-3">
          {inTab.map((q, i) => (
            <QuestionEditor
              key={q.id + q.text + q.type}
              question={q}
              editable={editable}
              isFirst={i === 0}
              isLast={i === inTab.length - 1}
              call={call}
              onMove={(dir) => move(inTab, i, dir)}
            />
          ))}
        </ol>
      )}

      {editable && <NewQuestionForm versionId={selected.id} section={tab} call={call} />}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
