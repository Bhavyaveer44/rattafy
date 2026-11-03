"use client";

import { useCallback, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import Planner from "@/components/planner";

export function PlannerPage() {
  const [user, setUser] = useState<User | null>(null);
  const handleUserChange = useCallback((nextUser: User | null) => setUser(nextUser), []);

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-6 text-sm">
        <Link href="/" className="font-black tracking-tight">Rattafy<span className="text-emerald-400">.</span></Link>
        <div className="flex items-center gap-3">
          {user && <span className="hidden text-zinc-400 sm:inline">{user.email}</span>}
          <AuthPanel onUserChange={handleUserChange} compact />
        </div>
      </header>
      <Planner />
    </>
  );
}
