import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { dbError, forbidden, invalid } from "@/lib/adminApi";
import { getAdmin } from "@/lib/auth";
import { questionSpecSchema, specToRow } from "@/lib/questionSpec";

const createSchema = z.object({ survey_version_id: z.uuid(), question: questionSpecSchema });

/** Create a question of any type in any category. Only possible in a draft version (enforced by DB trigger). */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const { survey_version_id, question } = parsed.data;

  const { data: last } = await admin.supabase
    .from("questions")
    .select("position")
    .eq("survey_version_id", survey_version_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const key = `q_${question.section}_${randomBytes(3).toString("hex")}`;
  const { data, error } = await admin.supabase
    .from("questions")
    .insert({ survey_version_id, key, position: (last?.position ?? 0) + 1, ...specToRow(question) })
    .select("id")
    .single();
  if (error) return dbError(error);

  await audit(admin.supabase, admin.user.id, "QUESTION_CREATED", "question", data.id, { section: question.section, type: question.type });
  return NextResponse.json({ ok: true, id: data.id });
}
