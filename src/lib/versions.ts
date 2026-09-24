import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SurveyVersion } from "./types";

/**
 * Lists survey versions and picks the one to show: the ?v= number if valid,
 * otherwise the published version, otherwise the newest. Responses are always
 * analysed per version, never mixed.
 */
export async function resolveVersion(supabase: SupabaseClient, requested?: string | string[]) {
  const { data } = await supabase.from("survey_versions").select("*").order("version", { ascending: false });
  const versions = (data ?? []) as SurveyVersion[];
  const want = Number(Array.isArray(requested) ? requested[0] : requested);
  const selected =
    versions.find((v) => v.version === want) ?? versions.find((v) => v.status === "published") ?? versions[0] ?? null;
  return { versions, selected };
}
