"use client";
import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, UserRound } from "lucide-react";
import { Input } from "@/components/ui/form";
import { LoginPasswordInput } from "@/components/login-password-input";
import { DismissibleErrorDialog } from "@/components/dismissible-error-dialog";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const invalidCredentialsMessage = "Invalid email/username or password.";
  const invalidCredentials = error === invalidCredentialsMessage;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    let navigating = false;
    try {
      const result = await signIn("credentials", {
        username: fd.get("username"),
        password: fd.get("password"),
        redirect: false,
      });
      if (!result?.ok || result.error) {
        setError(result?.error === "CredentialsSignin" ? invalidCredentialsMessage : "Sign-in is unavailable. Please try again shortly.");
        return;
      }
      router.replace("/");
      router.refresh();
      navigating = true;
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      if (!navigating) {
        setLoading(false);
        submitting.current = false;
      }
    }
  }
  return (
    <form onSubmit={submit} aria-busy={loading} className="space-y-6">
      <div>
        <label htmlFor="login-username" className="mb-3 block text-sm font-semibold text-brand-ink">
          Email or Username <span aria-hidden="true" className="text-rose-600">*</span>
        </label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[14px] bg-brand-faint text-brand-primary"><UserRound size={20} strokeWidth={1.8} /></span>
          <Input
            name="username"
            id="login-username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={loading}
            aria-invalid={invalidCredentials}
            placeholder="Enter your email or username"
            className="login-input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="login-password" className="mb-3 block text-sm font-semibold text-brand-ink">
          Password <span aria-hidden="true" className="text-rose-600">*</span>
        </label>
        <LoginPasswordInput
          name="password"
          id="login-password"
          autoComplete="current-password"
          required
          disabled={loading}
          aria-invalid={invalidCredentials}
          placeholder="Enter your password"
        />
      </div>
      {error && (
        <DismissibleErrorDialog
          title="Sign-in unsuccessful"
          message={error}
          onClose={() => setError("")}
        />
      )}
      <button type="submit" disabled={loading} aria-busy={loading} className="login-submit inline-flex w-full items-center justify-center gap-3 border border-brand-primary bg-brand-primary px-5 py-4 font-bold text-white transition-colors hover:bg-brand-primary-hover disabled:cursor-wait disabled:opacity-70">
        {loading ? <><LoaderCircle aria-hidden="true" size={21} className="animate-spin" /> Signing in…</> : <>Login <ArrowRight aria-hidden="true" size={21} /></>}
      </button>
    </form>
  );
}
