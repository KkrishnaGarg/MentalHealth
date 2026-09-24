import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, type AuditAction } from "@/lib/audit";
import { dbError, forbidden, invalid } from "@/lib/adminApi";
import { getAdmin } from "@/lib/auth";

const schema = z.object({ action: z.enum(["clone", "publish", "close"]), id: z.uuid() });

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const { action, id } = parsed.data;
  const { supabase, user } = admin;

  if (action === "clone") {
    const { data, error } = await supabase.rpc("clone_survey_version", { source_id: id });
    if (error) return dbError(error);
    await audit(supabase, user.id, "VERSION_CLONED", "survey_version", data as string, { source: id });
    return NextResponse.json({ ok: true, id: data });
  }

  const rpc = action === "publish" ? "publish_survey_version" : "close_survey_version";
  const { error } = await supabase.rpc(rpc, { version_id: id });
  if (error) return dbError(error);
  const act: AuditAction = action === "publish" ? "VERSION_PUBLISHED" : "VERSION_CLOSED";
  await audit(supabase, user.id, act, "survey_version", id);
  return NextResponse.json({ ok: true });
}
