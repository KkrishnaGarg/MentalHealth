import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Admin gate (Next.js 16 "proxy", formerly middleware):
 *   authenticated session? -> profile exists? -> role = admin? -> allow
 * Otherwise page requests redirect to /admin/login and API requests get 401/403.
 * This is an optimistic first layer; every admin page/route re-checks with
 * requireAdmin(), and RLS enforces the rule in the database.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/admin");

  if (pathname === "/admin/login") return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const deny = (status: 401 | 403) =>
    isApi
      ? NextResponse.json({ error: status === 401 ? "unauthenticated" : "forbidden" }, { status })
      : NextResponse.redirect(new URL("/admin/login", request.url));

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return deny(401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return deny(403);

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
