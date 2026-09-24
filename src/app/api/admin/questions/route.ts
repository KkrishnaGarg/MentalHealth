import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { dbError, forbidden, invalid } from "@/lib/adminApi";
import { getAdmin } from "@/lib/auth";
import { questionCreateSchema } from "@/lib/validation";

const STRESSOR_SCALE = [
  { value: 1, label: "Very low contribution" },
  { value: 2, label: "Low" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "High" },
  { value: 5, label: "Very high contribution" },
];

/** Create a custom question. Only possible in a draft version (enforced by DB trigger). */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return forbidden();
  const parsed = questionCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const q = parsed.data;

  const type = q.section === "stressors" ? "likert" : q.section === "open_ended" ? "text" : "single";
  const options = q.section === "stressors" ? STRESSOR_SCALE : q.section === "demographics" ? q.options : undefined;
  if (type === "single" && (!options || options.length < 2)) return invalid();

  const { data: last } = await admin.supabase
    .from("questions")
    .select("position")
    .eq("survey_version_id", q.survey_version_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const key = `custom_${q.section}_${randomBytes(3).toString("hex")}`;
  const { data, error } = await admin.supabase
    .from("questions")
    .insert({
      survey_version_id: q.survey_version_id,
      key,
      section: q.section,
      type,
      text: q.text,
      options: options ?? null,
      required: q.section === "open_ended" || q.section === "demographics" ? false : q.required,
      position: (last?.position ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return dbError(error);

  await audit(admin.supabase, admin.user.id, "QUESTION_CREATED", "question", data.id, { section: q.section, key });
  return NextResponse.json({ ok: true, id: data.id });
}
