import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";

export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await audit(admin.supabase, admin.user.id, "ADMIN_LOGIN", "session");
  return NextResponse.json({ ok: true });
}
