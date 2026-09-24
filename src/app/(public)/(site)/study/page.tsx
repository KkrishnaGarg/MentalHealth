import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "About the study" };

export default function StudyPage() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">About the study</h1>
      <div className="mt-6 space-y-8 text-lg text-muted">
        <section>
          <h2 className="text-2xl font-semibold text-ink">Purpose</h2>
          <p className="mt-2">
            This is an LNMIIT Humanities and Social Sciences (HSS) mini project on academic stress among college
            students. It looks at how perceived stress is associated with workload, examinations, CGPA and career
            prospects, family financial condition, placement pressure, sleep, and personal life.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-ink">Method</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              Perceived stress is measured with the 10-item Perceived Stress Scale (PSS-10), a validated, peer-reviewed
              instrument.
            </li>
            <li>Seven short questions ask how much each academic factor contributes to your stress.</li>
            <li>One or two optional open-ended questions capture your own framing, later grouped into themes.</li>
            <li>The analysis plan is fixed before data collection to avoid searching the data for convenient results.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-ink">What the results can and cannot say</h2>
          <p className="mt-2">
            Data are collected once, at a single point in time, from students at one institute who chose to take part.
            The study can describe <em>associations</em> between factors, but it cannot show that one thing causes
            another, and students who are more stressed may be more (or less) likely to respond. These limitations will
            be stated in the final report.
          </p>
        </section>
      </div>
      <div className="mt-10">
        <LinkButton href="/consent" size="lg">
          Take the Survey
        </LinkButton>
      </div>
    </div>
  );
}
