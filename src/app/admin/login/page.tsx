"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setBusy(false);
      setError("Sign-in failed. Check your email and password.");
      return;
    }
    // The server confirms the admin role and writes the ADMIN_LOGIN audit entry.
    const res = await fetch("/api/admin/login-audit", { method: "POST" });
    if (!res.ok) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("This account does not have administrator access.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-lg border border-line bg-surface p-6 shadow-medium">
        <div>
          <h1 className="text-2xl font-semibold">Administrator sign-in</h1>
          <p className="mt-1 text-sm text-muted">LNMIIT HSS Stress Study — research console</p>
        </div>
        <Input id="email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
