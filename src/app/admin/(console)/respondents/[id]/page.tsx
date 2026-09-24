import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CleaningForm } from "@/components/admin/CleaningForm";
import { Badge, StatCard } from "@/components/ui/Display";
import { FLAG_LABELS, qualityFlags } from "@/lib/analytics";
import { fetchDuplicateEmails, fetchResearchRows, fmtDuration } from "@/lib/adminData";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import type { QuestionOption } from "@/lib/types";

export const metadata = { title: "Respondent" };

const SECTION_LABEL: Record<string, string> = {
  pss10: "PSS-10",
  stressors: "Academic stressors",
  open_ended: "Open-ended",
  demographics: "Optional demographics",
};

export default async function RespondentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireAdmin();

  const { data: person } = await supabase
    .from("respondents")
    .select("id, name, roll_no, email, year, branch, consented_at")
    .eq("id", id)
    .maybeSingle();
  if (!person) notFound();

  const { data: response } = await supabase
    .from("responses")
    .select("id, submitted_at, total_time_s, pss_score, helplessness_score, self_efficacy_score, survey_versions(version)")
    .eq("respondent_id", id)
    .maybeSingle();

  await audit(supabase, user.id, "RESPONDENT_VIEWED", "respondent", id);

  const { data: answers } = response
    ? await supabase
        .from("answers")
        .select("value, questions(key, section, position, text, options)")
        .eq("response_id", response.id)
    : { data: [] };

  const [research, dup, { data: decisions }] = await Promise.all([
    fetchResearchRows(supabase),
    fetchDuplicateEmails(supabase),
    supabase.from("cleaning_decisions").select("id, flag_type, decision, reason, created_at").eq("respondent_id", id).order("created_at", { ascending: false }),
  ]);
  const row = research.find((r) => r.respondent_id === id);
  const flags = row ? qualityFlags(row, dup.has(id)) : [];

  type A = { value: unknown; questions: { key: string; section: string; position: number; text: string; options: QuestionOption[] | null } | null };
  const list = ((answers ?? []) as unknown as A[]).filter((a) => a.questions).sort((a, b) => a.questions!.position - b.questions!.position);
  const sections = ["pss10", "stressors", "demographics", "open_ended"];
  const version = (response?.survey_versions as unknown as { version: number } | null)?.version;

  const label = (a: A) => {
    const opts = a.questions!.options;
    if (Array.isArray(a.value)) return a.value.map((x) => opts?.find((o) => o.value === x)?.label ?? String(x)).join(", ");
    const opt = opts?.find((o) => o.value === a.value);
    return opt ? `${a.value} — ${opt.label}` : String(a.value);
  };

  return (
    <>
      <AdminHeader
        title="Respondent"
        description={`Submitted ${response ? new Date(response.submitted_at).toLocaleString() : "—"} · survey version ${version ?? "—"}`}
        actions={
          <Link href="/admin/respondents" className="text-sm text-primary underline underline-offset-2">
            ← Back to respondents
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-warning/40 bg-warning-tint p-5">
            <h2 className="text-lg font-semibold">Identity</h2>
            <p className="mb-3 text-sm text-muted">Confidential. Never shown publicly.</p>
            <dl className="space-y-1 text-[15px]">
              <Item k="Name" v={person.name} />
              <Item k="Roll number" v={person.roll_no} />
              <Item k="Email" v={person.email} />
              <Item k="Year" v={String(person.year)} />
              <Item k="Branch" v={person.branch} />
              <Item k="Consented" v={new Date(person.consented_at).toLocaleString()} />
              <Item k="Respondent ID" v={person.id} mono />
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Data quality</h2>
            {flags.length === 0 ? (
              <p className="text-muted">No flags.</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {flags.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[15px]">
                    <Badge tone="flag">{f.replace("_", " ")}</Badge>
                    {FLAG_LABELS[f]}
                  </li>
                ))}
              </ul>
            )}
            {response && <CleaningForm respondentId={id} responseId={response.id} flags={flags} />}
            {decisions && decisions.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="mb-2 text-sm font-semibold text-muted">Recorded decisions</h3>
                <ul className="space-y-2 text-sm">
                  {decisions.map((d) => (
                    <li key={d.id}>
                      <span className="font-medium">{d.decision}</span> ({d.flag_type.replace("_", " ")}) — {d.reason}
                      <span className="block text-muted">{new Date(d.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Research data</h2>
            {response ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="PSS-10 total" value={response.pss_score} hint="0–40" />
                <StatCard label="Perceived helplessness" value={response.helplessness_score} hint="0–24" />
                <StatCard label="Lack of self-efficacy" value={response.self_efficacy_score} hint="0–16" />
                <StatCard label="Completion time" value={fmtDuration(response.total_time_s)} />
              </div>
            ) : (
              <p className="text-muted">No response is linked to this respondent.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Answers</h2>
            <div className="space-y-5">
              {sections.map((s) => {
                const items = list.filter((a) => a.questions!.section === s);
                if (!items.length) return null;
                return (
                  <div key={s} className="rounded-lg border border-line bg-surface p-5">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{SECTION_LABEL[s]}</h3>
                    <ul className="divide-y divide-line">
                      {items.map((a) => (
                        <li key={a.questions!.key} className="py-2">
                          <p className="text-[15px] text-muted">{a.questions!.text}</p>
                          <p className="whitespace-pre-wrap text-ink">{label(a)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Item({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted">{k}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "break-words"}>{v}</dd>
    </div>
  );
}
