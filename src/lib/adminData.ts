import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchRow } from "./analytics";

/** All rows of the admin-only research view (RLS applies via the admin's session). */
export async function fetchResearchRows(supabase: SupabaseClient, version?: number | null): Promise<ResearchRow[]> {
  let query = supabase.from("research_dataset").select("*").order("submitted_at", { ascending: false }).range(0, 9999);
  if (version) query = query.eq("survey_version", version);
  const { data, error } = await query;
  if (error) throw new Error("Could not load research data");
  return (data ?? []) as ResearchRow[];
}

export async function fetchDuplicateEmails(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("admin_dataset").select("respondent_id, email").range(0, 9999);
  const byEmail = new Map<string, string[]>();
  for (const r of data ?? []) {
    const list = byEmail.get(r.email) ?? [];
    list.push(r.respondent_id);
    byEmail.set(r.email, list);
  }
  const dup = new Set<string>();
  for (const ids of byEmail.values()) if (ids.length > 1) ids.forEach((i) => dup.add(i));
  return dup;
}

export function fmt(n: number | null | undefined, digits = 1) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export function fmtDuration(s: number | null | undefined) {
  if (typeof s !== "number") return "—";
  return s < 90 ? `${Math.round(s)} s` : `${(s / 60).toFixed(1)} min`;
}
