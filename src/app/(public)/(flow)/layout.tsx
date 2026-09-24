import Link from "next/link";
import { STUDY_SHORT, SUPPORT } from "@/lib/constants";

/** Focused layout for consent → details → survey → thanks: no site navigation. */
export default function FlowLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-semibold text-primary">
            {STUDY_SHORT} <span className="font-normal text-muted">Stress Study</span>
          </Link>
          <span className="text-sm text-muted">Confidential</span>
        </div>
      </header>
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[820px] px-4 py-10 sm:px-6">{children}</div>
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-muted sm:px-6">
          <span>Not a clinical assessment.</span>
          <span className="flex gap-4">
            <a href={SUPPORT.counsellingHref} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              Need support?
            </a>
            <a href={SUPPORT.helplineHref} className="text-primary underline underline-offset-2">
              Helpline {SUPPORT.helplineNumber}
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
