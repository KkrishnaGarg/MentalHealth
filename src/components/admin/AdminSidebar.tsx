"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/respondents", label: "Respondents" },
  { href: "/admin/exports", label: "Exports" },
  { href: "/admin/audit", label: "Audit Log" },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <aside className="border-b border-line bg-surface md:w-56 md:shrink-0 md:border-b-0 md:border-r">
      <div className="px-4 py-4 md:py-6">
        <p className="font-semibold text-primary">HSS Stress Study</p>
        <p className="text-sm text-muted">Research console</p>
      </div>
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors",
                active ? "bg-primary-tint font-medium text-primary" : "text-ink hover:bg-background",
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-line p-4 md:mt-6 md:block">
        <p className="truncate text-sm text-muted" title={email}>
          {email}
        </p>
        <button type="button" onClick={signOut} className="mt-1 text-sm text-primary underline underline-offset-2">
          Sign out
        </button>
      </div>
    </aside>
  );
}
