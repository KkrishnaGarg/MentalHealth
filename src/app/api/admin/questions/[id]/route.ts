import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, type AuditAction } from "@/lib/audit";
import { dbError, forbidden, invalid } from "@/lib/adminApi";
import { getAdmin } from "@/lib/auth";
import { questionUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalid();
  const parsed = questionUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return invalid();

  // The DB trigger rejects changes to locked (PSS-10) rows and to published/closed versions.
  const { error } = await admin.supabase.from("questions").update(parsed.data).eq("id", id);
  if (error) return dbError(error);

  const action: AuditAction =
    parsed.data.active === true ? "QUESTION_ACTIVATED" : parsed.data.active === false ? "QUESTION_DEACTIVATED" : "QUESTION_UPDATED";
  await audit(admin.supabase, admin.user.id, action, "question", id, { fields: Object.keys(parsed.data) });
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
