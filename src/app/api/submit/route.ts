import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { answerMatchesQuestion } from "@/lib/questionSpec";
import { isAnswered, type Question } from "@/lib/types";
import { submitSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Pipeline: size cap → JSON → Zod → honeypot → published-version check →
 * per-question answer validation → submit_survey() RPC (single transaction:
 * respondent + response + answers + server-side scoring).
 *
 * No IP address, user agent or any request metadata is read, logged or stored.
 * Scores are never returned to the browser.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, "invalid");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, "invalid");
  }

  const parsed = submitSchema.safeParse(json);
  if (!parsed.success) return fail(422, "invalid");
  const payload = parsed.data;

  // Honeypot filled => bot. Pretend success so it learns nothing.
  if (payload.website) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  const { data: version, error: vErr } = await supabase
    .from("survey_versions")
    .select("id, status")
    .eq("id", payload.survey_version_id)
    .maybeSingle();
  if (vErr) return fail(500, "server");
  if (!version || version.status !== "published") return fail(409, "survey_not_open");

  const { data: rows, error: qErr } = await supabase
    .from("questions")
    .select("id, key, section, type, text, options, config, required, position")
    .eq("survey_version_id", version.id)
    .eq("active", true);
  if (qErr || !rows) return fail(500, "server");
  const questions = new Map((rows as Question[]).map((q) => [q.id, q]));

  const seen = new Set<string>();
  for (const a of payload.answers) {
    const q = questions.get(a.question_id);
    if (!q || seen.has(a.question_id)) return fail(422, "invalid");
    seen.add(a.question_id);
    if (isAnswered(a.value) && !answerMatchesQuestion(q, a.value)) return fail(422, "invalid");
  }
  for (const q of questions.values()) {
    if (!q.required) continue;
    const a = payload.answers.find((x) => x.question_id === q.id);
    if (!a || !isAnswered(a.value)) return fail(422, "invalid");
  }
  const rpcPayload = { ...payload, website: undefined };
  const { error } = await supabase.rpc("submit_survey", { payload: rpcPayload });

  if (error) {
    switch (error.message) {
      case "survey_not_open":
        return fail(409, "survey_not_open");
      case "duplicate_submission":
        return fail(409, "duplicate");
      case "consent_required":
      case "invalid_question":
      case "invalid_answer":
      case "missing_required":
      case "pss10_incomplete":
        return fail(422, "invalid");
      default:
        // Log only the error code — never the payload or database message.
        console.error("submit_survey failed", error.code);
        return fail(500, "server");
    }
  }

  return NextResponse.json({ ok: true });
}
