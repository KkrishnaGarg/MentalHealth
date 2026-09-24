import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, type AuditAction } from "@/lib/audit";
import { dbError, forbidden, invalid } from "@/lib/adminApi";
import { getAdmin } from "@/lib/auth";
import { questionSpecSchema, specToRow } from "@/lib/questionSpec";

type Ctx = { params: Promise<{ id: string }> };

const activeSchema = z.object({ active: z.boolean() }).strict();

/** Either toggles `active`, or replaces the whole question definition (text, type, choices, required, scoring). */
export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const body = await request.json().catch(() => null);

  const toggle = activeSchema.safeParse(body);
  const spec = toggle.success ? null : questionSpecSchema.safeParse(body);
  if (!toggle.success && !spec?.success) return invalid();

  // The DB trigger rejects any change unless the question's version is a draft.
  const patch = toggle.success ? { active: toggle.data.active } : specToRow(spec!.data!);
  const { error } = await admin.supabase.from("questions").update(patch).eq("id", id);
  if (error) return dbError(error);

  const action: AuditAction = toggle.success ? (toggle.data.active ? "QUESTION_ACTIVATED" : "QUESTION_DEACTIVATED") : "QUESTION_UPDATED";
  await audit(admin.supabase, admin.user.id, action, "question", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();

  const { error } = await admin.supabase.from("questions").delete().eq("id", id);
  if (error) return dbError(error);
  await audit(admin.supabase, admin.user.id, "QUESTION_DELETED", "question", id);
  return NextResponse.json({ ok: true });
}
