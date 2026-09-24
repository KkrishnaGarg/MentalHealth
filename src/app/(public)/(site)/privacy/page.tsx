import type { Metadata } from "next";
import { SupportLinks } from "@/components/SupportLinks";

export const metadata: Metadata = { title: "Privacy & confidentiality" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy &amp; confidentiality</h1>
      <p className="mt-4 text-lg text-muted">
        This survey is <strong className="text-ink">confidential, not anonymous</strong>. Because you enter your name,
        roll number and email, your response can be linked to you by authorized administrators. Here is exactly how
        your information is handled.
      </p>

      <div className="mt-8 space-y-8 text-lg text-muted">
        <section>
          <h2 className="text-2xl font-semibold text-ink">How your data is stored</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Your identity details (name, roll number, email, year, branch) are stored in one table.</li>
            <li>Your survey answers are stored in separate tables, linked only by a random ID.</li>
            <li>Only authorized administrators can open the identity table. There is no public access.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-ink">What we do not collect</h2>
          <p className="mt-2">
            We do not intentionally collect or store your IP address, device fingerprint or browser fingerprint, and we
            use no advertising or analytics trackers. The site sets no non-essential cookies, so there is no cookie
            banner. (Hosting providers may keep standard server logs outside this project&rsquo;s control.)
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-ink">How results are used</h2>
          <p className="mt-2">
            Responses are used only for this HSS academic research project. Public results are aggregate statistics
            and themes. Names, roll numbers, emails, individual answers and raw open-ended text are never published.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-ink">Your choices</h2>
          <p className="mt-2">
            Participation is voluntary. You can leave at any time before submitting and nothing will be recorded. This
            is an academic survey, not a clinical assessment.
          </p>
        </section>
      </div>

      <div className="mt-10 rounded-lg border border-sage/40 bg-sage-tint p-6">
        <h2 className="mb-3 text-xl font-semibold text-ink">Need support?</h2>
        <SupportLinks />
      </div>
    </div>
  );
}
