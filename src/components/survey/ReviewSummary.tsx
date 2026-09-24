import { YEARS } from "@/lib/constants";
import type { AnswerMap, Details, Question } from "@/lib/types";

export type ReviewSection = { label: string; questions: Question[] };

function isAnswered(v: unknown) {
  return v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
}

/**
 * Completion status only. Deliberately shows no scores, bands or totals:
 * participants must never see a derived stress score.
 */
export function ReviewSummary({ details, sections, answers }: { details: Details; sections: ReviewSection[]; answers: AnswerMap }) {
  const year = YEARS.find((y) => y.value === details.year)?.label ?? "—";
  return (
    <div className="space-y-4">
      <Block title="Your details">
        <Row k="Year" v={year} />
        <Row k="Branch" v={details.branch || "—"} />
      </Block>
      {sections.map((s) => {
        const done = s.questions.filter((q) => isAnswered(answers[q.id])).length;
        const total = s.questions.length;
        const optionalOnly = s.questions.every((q) => !q.required);
        const status = optionalOnly
          ? `${done} answered, ${total - done} skipped`
          : done === total
            ? "Completed"
            : `${done} of ${total} answered`;
        return (
          <Block key={s.label} title={s.label}>
            <p>{status}</p>
          </Block>
        );
      })}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-subtle">
      <h3 className="mb-2 border-b border-line pb-2 text-base font-semibold text-ink">{title}</h3>
      <div className="text-muted">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="inline-block w-20 text-muted">{k}:</span>
      <span className="text-ink">{v}</span>
    </p>
  );
}
