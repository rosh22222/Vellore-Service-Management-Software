"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormHTMLAttributes } from "react";
import { submitWithFeedback } from "@/actions/form-feedback";
import { startLoading } from "@/lib/loading-feedback";
import { DismissibleErrorDialog } from "@/components/dismissible-error-dialog";

const ActionPending = createContext(false);
export function useActionPending() { return useContext(ActionPending); }

export function ActionForm({ action, children, successMessage, successDuration = 3000, resetOnSuccess, feedbackChannel, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (data: FormData) => Promise<unknown>;
  successMessage?: string;
  successDuration?: number;
  resetOnSuccess?: boolean;
  feedbackChannel?: string;
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
          const resolvedFeedback = result.ok && successMessage
            ? { ...result, message: successMessage }
            : result;
          if (result.ok && feedbackChannel) {
            window.dispatchEvent(new CustomEvent("action-feedback", {
              detail: { channel: feedbackChannel, message: resolvedFeedback.message },
            }));
            setFeedback(null);
          } else {
            setFeedback(resolvedFeedback);
          }
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
        {feedback?.ok && <div ref={messageRef} tabIndex={-1} role="status"
          className="col-span-full mt-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-medium text-[#166534]">
          {feedback.message}
        </div>}
        {feedback && !feedback.ok && (
          <DismissibleErrorDialog
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        )}
      </ActionPending.Provider>
    </form>
  );
}
