import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/**
 * Server-side admin check used by every admin page and API route
 * (defence in depth behind proxy.ts and RLS).
 */
export async function getAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return { supabase, user: data.user };
}

/** For pages: redirect to login when not an admin. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
