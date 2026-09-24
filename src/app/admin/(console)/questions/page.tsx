import { AdminHeader } from "@/components/admin/AdminHeader";
import { QuestionManager } from "@/components/admin/QuestionManager";
import { EmptyState } from "@/components/ui/Display";
import { requireAdmin } from "@/lib/auth";
import type { AdminQuestion } from "@/lib/types";
import { resolveVersion } from "@/lib/versions";

export const metadata = { title: "Questions" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const { supabase } = await requireAdmin();
  const { versions, selected: resolved } = await resolveVersion(supabase, v);

  if (!versions.length || !resolved) {
    return (
      <>
        <AdminHeader title="Questions" />
        <EmptyState title="No survey versions">Run supabase/seed.sql to create Version 1.</EmptyState>
      </>
    );
  }

  // With no ?v=, open the draft if one exists (that is where editing happens).
  const draft = versions.find((x) => x.status === "draft");
  const selected = v ? resolved : (draft ?? resolved);

  const [{ data: questions }, { data: counts }] = await Promise.all([
    supabase.from("questions").select("*").eq("survey_version_id", selected.id).order("position"),
    supabase.from("responses").select("survey_version_id").range(0, 9999),
  ]);

  const responseCounts: Record<string, number> = {};
  for (const r of counts ?? []) responseCounts[r.survey_version_id] = (responseCounts[r.survey_version_id] ?? 0) + 1;

  return (
    <>
      <AdminHeader
        title="Questions"
        description="Build the survey like a form. Every change happens in a draft; publishing it creates a new version, and each version's responses are kept and analysed separately."
      />
      <QuestionManager versions={versions} selectedId={selected.id} questions={(questions ?? []) as AdminQuestion[]} responseCounts={responseCounts} />
    </>
  );
}
