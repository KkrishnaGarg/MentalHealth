import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/analytics";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const EXPORTS = {
  // Research dataset: NO name / roll number / email.
  research: {
    view: "research_dataset",
    order: "submitted_at",
    columns: [
      "respondent_id", "survey_version", "year", "branch", "pss_score", "helplessness_score", "self_efficacy_score",
      "total_time_s", "submitted_at",
      "pss_1", "pss_2", "pss_3", "pss_4", "pss_5", "pss_6", "pss_7", "pss_8", "pss_9", "pss_10",
      "stressor_workload", "stressor_exams", "stressor_cgpa", "stressor_finance", "stressor_placement", "stressor_sleep", "stressor_personal",
      "residence", "family_income_bracket",
    ],
    file: "research_dataset",
  },
  research_long: {
    view: "research_answers_long",
    order: "respondent_id",
    columns: ["respondent_id", "survey_version", "question_key", "section", "question_text", "value"],
    file: "research_answers_long",
  },
  // Administrative dataset: contains identity. Same admin gate, audit-logged.
  administrative: {
    view: "admin_dataset",
    order: "submitted_at",
    columns: [
      "respondent_id", "name", "roll_no", "email", "year", "branch", "survey_version",
      "pss_score", "helplessness_score", "self_efficacy_score", "total_time_s", "submitted_at",
    ],
    file: "administrative_dataset",
  },
  // Raw open-ended text for thematic coding (identity-free, sensitive).
  open_ended: {
    view: "open_ended_responses",
    order: "submitted_at",
    columns: ["respondent_id", "survey_version", "question_key", "question_text", "response_text", "submitted_at"],
    file: "open_ended_responses",
  },
} as const;

type ExportType = keyof typeof EXPORTS;

export async function GET(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const type = request.nextUrl.searchParams.get("type") as ExportType | null;
  if (!type || !(type in EXPORTS)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const spec = EXPORTS[type];

  const versionParam = Number(request.nextUrl.searchParams.get("v")) || null;
  let query = admin.supabase.from(spec.view).select(spec.columns.join(",")).order(spec.order, { ascending: true }).range(0, 49999);
  if (versionParam) query = query.eq("survey_version", versionParam);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "server" }, { status: 500 });

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  await audit(admin.supabase, admin.user.id, "CSV_EXPORTED", "export", null, { type, version: versionParam, rows: rows.length });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows, [...spec.columns]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${spec.file}${versionParam ? `_v${versionParam}` : "_all_versions"}_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
