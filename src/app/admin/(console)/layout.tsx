import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AdminSidebar email={user.email ?? ""} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
