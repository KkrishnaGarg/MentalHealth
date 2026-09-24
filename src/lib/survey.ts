import "server-only";
import { createClient } from "./supabase/server";
import type { Question } from "./types";

/**
 * Loads the currently published survey version and its active questions.
 * Runs under the visitor's role, so RLS decides what is visible
 * (anon: only active questions of the published version).
 */
export async function getPublishedSurvey() {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("survey_versions")
    .select("id, version")
    .eq("status", "published")
    .maybeSingle();
  if (!version) return null;

  const { data: questions } = await supabase
    .from("questions")
    .select("id, key, section, type, text, options, required, position")
    .eq("survey_version_id", version.id)
    .eq("active", true)
    .order("position");

  return { version, questions: (questions ?? []) as Question[] };
}
