import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { dbError, forbidden, invalid } from "@/lib/adminApi";
import { getAdmin } from "@/lib/auth";
import { reorderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();

  const { error } = await admin.supabase.rpc("reorder_questions", { ordered_ids: parsed.data.ordered_ids });
  if (error) return dbError(error);
  await audit(admin.supabase, admin.user.id, "QUESTION_REORDERED", "survey_version", parsed.data.survey_version_id, {
    count: parsed.data.ordered_ids.length,
  });
  return NextResponse.json({ ok: true });
}
