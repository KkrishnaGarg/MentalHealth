import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";
import { cleaningDecisionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = cleaningDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });

  const { error } = await admin.supabase.from("cleaning_decisions").insert({ ...parsed.data, admin_id: admin.user.id });
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });

  // Audit metadata carries the decision type only — never the free-text reason.
  await audit(admin.supabase, admin.user.id, "CLEANING_DECISION_RECORDED", "response", parsed.data.response_id, {
    flag_type: parsed.data.flag_type,
    decision: parsed.data.decision,
  });
  return NextResponse.json({ ok: true });
}
