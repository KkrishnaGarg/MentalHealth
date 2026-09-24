import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/Display";
import { SurveyShell } from "@/components/survey/SurveyShell";
import { getPublishedSurvey } from "@/lib/survey";

export const metadata: Metadata = { title: "Survey" };
export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  const survey = await getPublishedSurvey();

  if (!survey || survey.questions.length === 0) {
    return (
      <EmptyState title="The survey is not open right now">
        The survey is not currently accepting responses. Please check back later or contact the project team.
      </EmptyState>
    );
  }

  return <SurveyShell versionId={survey.version.id} questions={survey.questions} />;
}
