import { LinkButton } from "@/components/ui/Button";
import { InfoCard } from "@/components/ui/Display";
import { SupportLinks } from "@/components/SupportLinks";

const TOPICS = ["Academic workload", "Examinations", "CGPA and career prospects", "Family financial condition", "Placement pressure", "Sleep", "Personal life"];

function TrustItem({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="text-xl leading-7">
        {icon}
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="text-[15px] text-muted">{text}</p>
      </div>
    </li>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-14 sm:px-6 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-[1.3fr_1fr]">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
              Understanding Academic Stress Among College Students
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              A short academic study exploring how workload, examinations, career pressure, finances, sleep and
              personal life relate to students&rsquo; experiences of stress.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/consent" size="lg">
                Take the Survey
              </LinkButton>
              <LinkButton href="/study" size="lg" variant="secondary">
                Learn About the Study
              </LinkButton>
            </div>
            <ul className="mt-10 grid gap-5 sm:grid-cols-3">
              <TrustItem icon="🔒" title="Confidential" text="Identifying details are restricted to authorized administrators." />
              <TrustItem icon="⏱" title="Short survey" text="Complete it at your own pace." />
              <TrustItem icon="🎓" title="Academic research" text="Conducted as part of an LNMIIT HSS project." />
            </ul>
          </div>

          {/* Abstract, non-clinical illustration: overlapping shapes = several pressures held in balance. */}
          <div aria-hidden="true" className="hidden justify-center md:flex">
            <svg viewBox="0 0 320 300" className="w-full max-w-sm" fill="none">
              <rect x="30" y="170" width="260" height="14" rx="7" className="fill-line" />
              <circle cx="160" cy="150" r="52" className="fill-primary-tint stroke-primary" strokeWidth="2" />
              <rect x="52" y="86" width="70" height="86" rx="10" className="fill-sage-tint stroke-sage" strokeWidth="2" />
              <rect x="198" y="100" width="70" height="72" rx="10" className="fill-surface stroke-line-strong" strokeWidth="2" />
              <path d="M62 112h50M62 128h38M62 144h44" className="stroke-sage" strokeWidth="3" strokeLinecap="round" />
              <path d="M210 118h46M210 134h30" className="stroke-line-strong" strokeWidth="3" strokeLinecap="round" />
              <circle cx="160" cy="150" r="14" className="fill-primary" />
              <circle cx="232" cy="60" r="22" className="fill-sage-tint stroke-sage" strokeWidth="2" />
              <circle cx="96" cy="50" r="14" className="fill-primary-tint stroke-primary" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </section>

      <div className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
          <section>
            <h2 className="text-2xl font-semibold text-ink">What is this study?</h2>
            <p className="mt-3 text-muted">
              Many students describe academic life as demanding, but we know little about which pressures matter most
              on our own campus. This survey collects students&rsquo; own reports so the research team can look for
              patterns and suggest practical, evidence-based ideas for the college.
            </p>
            <p className="mt-3 text-muted">
              It measures perceived stress with a widely used, peer-reviewed questionnaire (the Perceived Stress
              Scale) alongside seven possible sources of academic pressure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-ink">What you&rsquo;ll be asked</h2>
            <ul className="mt-3 grid list-disc gap-x-8 gap-y-1 pl-5 text-muted sm:grid-cols-2">
              {TOPICS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-3 text-muted">Plus a few short, optional questions in your own words.</p>
          </section>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-14 sm:px-6 md:grid-cols-2">
        <InfoCard title="Privacy & confidentiality">
          <p className="text-muted">
            This survey is <strong className="text-ink">confidential, not anonymous</strong>. You will enter your name,
            roll number and email. These are stored separately from your answers and only authorized administrators
            can see them. Results are only ever published in aggregate.
          </p>
        </InfoCard>
        <InfoCard title="Need support?" tone="sage">
          <p className="mb-4 text-muted">
            If you would like to talk to someone about how you are feeling, these services are available:
          </p>
          <SupportLinks />
        </InfoCard>
      </div>
    </>
  );
}
