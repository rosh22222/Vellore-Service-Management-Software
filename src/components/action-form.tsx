"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormHTMLAttributes } from "react";
import { submitWithFeedback } from "@/actions/form-feedback";
import { startLoading } from "@/lib/loading-feedback";

const ActionPending = createContext(false);
export function useActionPending() { return useContext(ActionPending); }

export function ActionForm({ action, children, successMessage, successDuration, resetOnSuccess, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (data: FormData) => Promise<unknown>;
  successMessage?: string;
  successDuration?: number;
  resetOnSuccess?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const submitting = useRef(false);
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!feedback?.ok || !successDuration) return;
    const timer = setTimeout(() => setFeedback(null), successDuration);
    return () => clearTimeout(timer);
  }, [feedback, successDuration]);
  return (
    <form {...props} aria-busy={pending} onSubmit={(event) => {
      event.preventDefault();
      if (submitting.current) return;
      submitting.current = true;
      const form = event.currentTarget;
      const data = new FormData(form);
      const stopLoading = startLoading();
      setFeedback(null);
      startTransition(async () => {
        try {
          const result = await submitWithFeedback(action, data);
          setFeedback(result.ok && successMessage ? { ...result, message: successMessage } : result);
          if (result.ok && resetOnSuccess) form.reset();
          requestAnimationFrame(() => messageRef.current?.focus());
        } catch (error) {
          // Redirects are handled by Next.js. Network failures keep entered values.
          if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
          setFeedback({ ok: false, message: "Connection interrupted. Check whether your change was saved before trying again." });
        } finally {
          submitting.current = false;
          stopLoading();
        }
      });
    }}>
      <ActionPending.Provider value={pending}>
        {children}
        {feedback && <div ref={messageRef} tabIndex={-1} role={feedback.ok ? "status" : "alert"}
          className={`col-span-full mt-3 rounded-lg border px-4 py-3 text-sm font-medium ${feedback.ok ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"}`}>
          {feedback.message}
        </div>}
      </ActionPending.Provider>
    </form>
  );
}
