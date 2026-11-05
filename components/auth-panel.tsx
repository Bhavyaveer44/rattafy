"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthPanel({
  onUserChange,
  compact = false,
  initialMessage = "",
  initialConfirmationPending = false,
}: {
  onUserChange?: (user: User | null) => void;
  compact?: boolean;
  initialMessage?: string;
  initialConfirmationPending?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(supabase === null);
  const [configured] = useState(supabase !== null);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMessage ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [confirmationPending, setConfirmationPending] = useState(initialConfirmationPending);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthChecked(true);
      onUserChange?.(data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthChecked(true);
      onUserChange?.(nextUser);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase, onUserChange]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/recovery-callback`,
        });
        setMessage(error
          ? `Couldn't send a reset link: ${error.message}`
          : "If an account with that email exists, we sent a password reset link.");
        return;
      }

      const result = mode === "signup"
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) {
        const needsConfirmation = mode === "signin" && /email not confirmed|not confirmed/i.test(result.error.message);
        setConfirmationPending(needsConfirmation);
        setMessage(needsConfirmation
          ? "Confirm your email before signing in. You can send a fresh confirmation link below."
          : result.error.message);
      } else if (mode === "signup" && !result.data.session) {
        setConfirmationPending(true);
        setMessage("Check your email to confirm your account before signing in.");
      } else {
        setConfirmationPending(false);
        setUser(result.data.user);
        setMessage(mode === "signup" ? "Account created. You’re signed in!" : "Signed in.");
      }
    } catch {
      setMessage("Couldn't connect to the authentication service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const supabase = createClient();
    if (!supabase) return;
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setMessage(error
        ? `Couldn't resend confirmation: ${error.message}`
        : "If this account needs confirmation, a fresh email is on its way.");
    } catch {
      setMessage("Couldn't connect to the authentication service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    if (!supabase) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSigningOut(false);
      setMessage(`Could not sign out: ${error.message}`);
      return;
    }
    setUser(null);
    onUserChange?.(null);
    if (compact) {
      router.replace("/signin");
      router.refresh();
    } else {
      setMessage("Signed out.");
      setSigningOut(false);
    }
  }

  if (compact) {
    if (!configured) return null;
    return !authChecked ? (
      <span aria-label="Checking account" className="h-9 w-20 animate-pulse rounded-lg bg-zinc-800" />
    ) : user ? (
      <button onClick={signOut} disabled={signingOut} className="rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-wait disabled:opacity-60">{signingOut ? "Signing out…" : "Sign out"}</button>
    ) : (
      <Link href="/signin" className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-bold text-zinc-950 hover:bg-emerald-400">Sign in</Link>
    );
  }

  return (
    <section className="mx-auto mt-7 w-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 sm:p-6">
      {!configured ? (
        <p className="text-sm text-zinc-400">
          Sign-in is almost ready. Add <code className="text-emerald-300">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-emerald-300">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to your environment.
        </p>
      ) : user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">Signed in as <span className="font-semibold text-emerald-300">{user.email}</span></p>
          <button onClick={signOut} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500">Sign out</button>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{mode === "signup" ? "Save your spot and get started with Rattafy." : mode === "forgot" ? "We’ll email you a secure reset link." : "Sign in to continue to your study planner."}</p>
            </div>
            {mode === "forgot" ? (
              <button type="button" onClick={() => { setMode("signin"); setMessage(""); }} className="shrink-0 text-xs font-semibold text-emerald-300 hover:text-emerald-200">← Back to sign in</button>
            ) : (
              <div aria-label="Account access" className="flex shrink-0 rounded-xl border border-zinc-700/80 bg-zinc-950/70 p-1 text-xs">
                <button type="button" aria-pressed={mode === "signup"} onClick={() => { setMode("signup"); setMessage(""); setConfirmationPending(false); }} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "signup" ? "bg-emerald-500 text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-100"}`}>Sign up</button>
                <button type="button" aria-pressed={mode === "signin"} onClick={() => { setMode("signin"); setMessage(""); setConfirmationPending(false); }} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "signin" ? "bg-emerald-500 text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-100"}`}>Sign in</button>
              </div>
            )}
          </div>
          <form onSubmit={submit} className="grid min-w-0 grid-cols-1 gap-3">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-zinc-400">
              Email address
              <input aria-label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-11 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            {mode !== "forgot" && <label className="grid min-w-0 gap-1.5 text-xs font-medium text-zinc-400">
              Password
              <input aria-label="Password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} className="h-11 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </label>}
            <button disabled={busy} className="mt-1 flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-wait disabled:opacity-60">{busy ? "One sec…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</button>
          </form>
          {confirmationPending && <button type="button" disabled={busy} onClick={resendConfirmation} className="mt-3 w-full text-sm font-semibold text-emerald-300 underline decoration-emerald-500/40 underline-offset-4 hover:text-emerald-200 disabled:opacity-50">{busy ? "Sending…" : "Resend confirmation email"}</button>}
          {mode === "signin" && !confirmationPending && <button type="button" onClick={() => { setMode("forgot"); setMessage(""); }} className="mt-3 w-full text-center text-sm font-medium text-zinc-400 transition hover:text-emerald-300">Forgot password?</button>}
        </>
      )}
      {message && <p aria-live="polite" className={`mt-3 break-words rounded-lg px-3 py-2 text-sm ${/error|invalid|already|weak|failed/i.test(message) ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>{message}</p>}
      {!user && configured && <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500">Review our <Link href="/privacy" className="text-emerald-300 underline decoration-emerald-500/40 underline-offset-4 hover:text-emerald-200">Privacy Notice</Link> to see how account and study data is handled.</p>}
    </section>
  );
}
