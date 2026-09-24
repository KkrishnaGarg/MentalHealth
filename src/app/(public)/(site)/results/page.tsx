import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/Display";

export const metadata: Metadata = { title: "Results" };

/**
 * Placeholder until the research team has completed the predefined analysis.
 * No live statistics are shown here: aggregates (incl. averages) would be
 * visible to participants while data collection is still open.
 * After analysis, populate this page with the final aggregate results,
 * themes, methodology and limitations.
 */
export default function ResultsPage() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Results</h1>
      <div className="mt-8">
        <EmptyState title="Analysis not available yet">
          Results will be published after data collection and analysis are complete. Only aggregate findings will be
          shown; no individual responses will ever be displayed.
        </EmptyState>
      </div>
    </div>
  );
}
