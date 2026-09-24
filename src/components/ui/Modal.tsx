"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Native <dialog>: focus trap, Escape and inert background come from the browser. */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,28rem)] rounded-lg border border-line bg-surface p-6 text-ink shadow-medium backdrop:bg-ink/40"
    >
      <h2 id="modal-title" className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}
