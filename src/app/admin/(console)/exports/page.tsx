import { AdminHeader } from "@/components/admin/AdminHeader";
import { VersionTabs } from "@/components/admin/VersionTabs";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { requireAdmin } from "@/lib/auth";
import { resolveVersion } from "@/lib/versions";

export const metadata = { title: "Exports" };

const EXPORTS = [
  {
    type: "research",
    title: "Research dataset",
    label: "Export research dataset",
    identifying: false,
    text: "One row per respondent: random respondent ID, survey version, year, branch, PSS scores, the ten raw PSS item values, the seven stressor ratings, and optional demographics. No name, roll number or email.",
  },
  {
    type: "research_long",
    title: "Research answers (long format)",
    label: "Export research answers",
    identifying: false,
    text: "One row per answer, keyed by question. Includes every question you add, of any type (multiple choice, checkboxes, scales, numbers). Open-ended text and identity fields are excluded. Use this for versions with custom questions.",
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

export default async function ExportsPage({ searchParams }: { searchParams: Promise<{ v?: string; all?: string }> }) {
  const { v, all } = await searchParams;
  const { supabase } = await requireAdmin();
  const { versions, selected } = await resolveVersion(supabase, v);
  const allVersions = all === "1";
  const vq = allVersions || !selected ? "" : `&v=${selected.version}`;

  return (
    <>
      <AdminHeader
        title="Exports"
        description="Choose the survey version to export. Different versions can contain different questions, so they are exported separately by default. Every export is recorded in the audit log."
      />
      <VersionTabs versions={versions} selected={allVersions ? null : selected} basePath="/admin/exports" />
      <p className="-mt-2 mb-5 text-sm text-muted">
        {allVersions ? (
          <>Exporting <strong>all versions combined</strong>. </>
        ) : (
          <>Exporting <strong>Version {selected?.version}</strong> only. </>
        )}
        <a href={allVersions ? `/admin/exports${selected ? `?v=${selected.version}` : ""}` : "/admin/exports?all=1"} className="text-primary underline underline-offset-2">
          {allVersions ? "Export one version instead" : "Export all versions combined"}
        </a>
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {EXPORTS.map((e) => (
          <section key={e.type} className={`rounded-lg border p-5 shadow-subtle ${e.identifying ? "border-warning/40 bg-warning-tint" : "border-line bg-surface"}`}>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{e.title}</h2>
              {e.identifying ? <Badge tone="draft">Contains identifying information</Badge> : <Badge tone="published">No identity fields</Badge>}
            </div>
            <p className="mb-4 text-[15px] text-muted">{e.text}</p>
            <LinkButton href={`/api/admin/export?type=${e.type}${vq}`} external variant={e.identifying ? "secondary" : "primary"}>
              {e.label}
            </LinkButton>
          </section>
        ))}
      </div>
    </>
  );
}
