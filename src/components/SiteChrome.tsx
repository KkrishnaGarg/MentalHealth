import Link from "next/link";
import { STUDY_SHORT, SUPPORT } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-primary">
          {STUDY_SHORT} <span className="font-normal text-muted">Stress Study</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-5 text-[15px]">
          <Link href="/study" className="text-ink hover:text-primary">
            Study
          </Link>
          <Link href="/privacy" className="text-ink hover:text-primary">
            Privacy
          </Link>
          <Link href="/results" className="text-ink hover:text-primary">
            Results
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-6 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>
          An LNMIIT HSS academic research project. Confidential — not anonymous. Not a clinical assessment.
        </p>
        <p className="flex flex-wrap gap-x-4">
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy &amp; confidentiality
          </Link>
          <a href={SUPPORT.counsellingHref} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
            Need support? {SUPPORT.counsellingLabel}
          </a>
          <a href={SUPPORT.helplineHref} className="text-primary underline underline-offset-2">
            Helpline {SUPPORT.helplineNumber}
          </a>
        </p>
      </div>
    </footer>
  );
}
