import { AdminHeader } from "@/components/admin/AdminHeader";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Exports" };

const EXPORTS = [
  {
    type: "research",
    title: "Research dataset",
    label: "Export research dataset",
    identifying: false,
    text: "One row per respondent: random respondent ID, survey version, year, branch, PSS-10 total and subscale scores, the ten raw PSS item values, the seven stressor ratings, and optional demographics. No name, roll number or email.",
  },
  {
    type: "research_long",
    title: "Research answers (long format)",
    label: "Export research answers",
    identifying: false,
    text: "One row per answer, keyed by question (includes any custom questions added in later versions). Open-ended text and identity fields are excluded.",
  },
  {
    type: "open_ended",
    title: "Open-ended responses",
    label: "Export open-ended responses for coding",
    identifying: false,
    text: "Raw written answers keyed by random respondent ID, for thematic coding. Sensitive: keep it within the research team.",
  },
  {
    type: "administrative",
    title: "Administrative dataset",
    label: "Export administrative dataset",
    identifying: true,
    text: "Adds name, roll number and email to each response. Use only for administration (e.g. follow-up, verification); never for sharing or publication.",
  },
];

export default async function ExportsPage() {
  await requireAdmin();
  return (
    <>
      <AdminHeader title="Exports" description="Every export is recorded in the audit log." />
      <div className="grid gap-4 lg:grid-cols-2">
        {EXPORTS.map((e) => (
          <section key={e.type} className={`rounded-lg border p-5 shadow-subtle ${e.identifying ? "border-warning/40 bg-warning-tint" : "border-line bg-surface"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{e.title}</h2>
              {e.identifying ? <Badge tone="draft">Contains identifying information</Badge> : <Badge tone="published">No identity fields</Badge>}
            </div>
            <p className="mb-4 text-[15px] text-muted">{e.text}</p>
            <LinkButton href={`/api/admin/export?type=${e.type}`} external variant={e.identifying ? "secondary" : "primary"}>
              {e.label}
            </LinkButton>
          </section>
        ))}
      </div>
    </>
  );
}
