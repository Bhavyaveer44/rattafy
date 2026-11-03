"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";

export function AuthPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (user) router.replace("/");
  }, [router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mx-auto w-fit text-4xl font-black tracking-tight">Rattafy<span className="text-emerald-400">.</span></h1>
        <p className="mt-3 text-center text-sm text-zinc-400">Your exam-night study plan starts here.</p>
        <AuthPanel onUserChange={setUser} />
      </div>
    </main>
  );
}
