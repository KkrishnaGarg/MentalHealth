import { AdminHeader } from "@/components/admin/AdminHeader";
import { QuestionManager } from "@/components/admin/QuestionManager";
import { EmptyState } from "@/components/ui/Display";
import { requireAdmin } from "@/lib/auth";
import type { AdminQuestion, SurveyVersion } from "@/lib/types";

export const metadata = { title: "Questions" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: versions } = await supabase.from("survey_versions").select("*").order("version", { ascending: false });
  if (!versions?.length) {
    return (
      <>
        <AdminHeader title="Questions" />
        <EmptyState title="No survey versions">Run supabase/seed.sql to create Version 1.</EmptyState>
      </>
    );
  }

  const list = versions as SurveyVersion[];
  const selected =
    list.find((x) => x.id === v) ?? list.find((x) => x.status === "draft") ?? list.find((x) => x.status === "published") ?? list[0];

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("survey_version_id", selected.id)
    .order("position");

  return (
    <>
      <AdminHeader
        title="Questions"
        description="Survey versions protect research integrity: once a version is published its instrument is frozen, and changes require a new version."
      />
      <QuestionManager versions={list} selectedId={selected.id} questions={(questions ?? []) as AdminQuestion[]} />
    </>
  );
}
