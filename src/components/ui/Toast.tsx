"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

export type ToastState = { message: string; tone: "success" | "error" } | null;

export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {toast && (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          className={cn(
            "animate-fade-in pointer-events-auto rounded-md px-4 py-2.5 text-[15px] shadow-medium",
            toast.tone === "error" ? "bg-danger text-white" : "bg-ink text-white",
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
