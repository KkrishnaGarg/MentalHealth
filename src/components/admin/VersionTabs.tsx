import Link from "next/link";
import { Badge } from "@/components/ui/Display";
import { cn } from "@/lib/cn";
import type { SurveyVersion } from "@/lib/types";

const TONE = { draft: "draft", published: "published", closed: "closed" } as const;

/** Version switcher for pages that analyse responses. Each version's responses are shown separately. */
export function VersionTabs({
  versions,
  selected,
  basePath,
  extraParams,
}: {
  versions: SurveyVersion[];
  selected: SurveyVersion | null;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  const shown = versions.filter((v) => v.status !== "draft");
  if (shown.length === 0) return null;
  return (
    <nav aria-label="Survey version" className="mb-5 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Survey version:</span>
      {shown.map((v) => {
        const p = new URLSearchParams(extraParams);
        p.set("v", String(v.version));
        const active = selected?.id === v.id;
        return (
          <Link
            key={v.id}
            href={`${basePath}?${p.toString()}`}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-[15px]",
              active ? "border-primary bg-primary-tint" : "border-line-strong bg-surface hover:border-primary",
            )}
          >
            Version {v.version} <Badge tone={TONE[v.status]}>{v.status}</Badge>
          </Link>
        );
      })}
    </nav>
  );
}
