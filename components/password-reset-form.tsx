"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("The passwords don't match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Password reset is not configured. Please contact the app owner.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(`Couldn't update your password: ${error.message}`);
      } else {
        setUpdated(true);
      }
    } catch {
      setMessage("Couldn't connect to the authentication service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/20 sm:p-6">
        <Link href="/signin" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Rattafy<span className="text-emerald-400">.</span></Link>
        <h1 className="mt-5 text-2xl font-black tracking-tight">Choose a new password</h1>
        {updated ? (
          <>
            <p role="status" className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">Your password has been updated.</p>
            <button onClick={() => { router.replace("/"); router.refresh(); }} className="mt-4 h-11 w-full rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400">Continue to Rattafy</button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">Use at least 6 characters for your new password.</p>
            <form onSubmit={submit} className="mt-5 grid gap-3">
              <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
                New password
                <input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
                Confirm new password
                <input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
              </label>
              <button disabled={busy} className="mt-1 h-11 w-full rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
            </form>
            {message && <p role="alert" className="mt-3 break-words rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{message}</p>}
          </>
        )}
      </section>
    </main>
  );
}
