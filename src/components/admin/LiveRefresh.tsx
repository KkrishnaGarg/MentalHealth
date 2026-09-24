"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to INSERTs on `responses` (Supabase Realtime, authorised by the
 * admin's session + RLS) and re-renders the server-computed dashboard.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel("admin-responses")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "responses" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "live" : "offline"));
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const label = status === "live" ? "Live" : status === "connecting" ? "Connecting…" : "Offline — reload to retry";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted" role="status">
      <span aria-hidden="true" className={status === "live" ? "size-2 rounded-full bg-sage" : "size-2 rounded-full bg-line-strong"} />
      {label}
    </span>
  );
}
