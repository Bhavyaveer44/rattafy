"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan, PlanItem } from "./api/plan/route";

const LOADING_LINES = [
  "Reading your syllabus so you don't have to…",
  "Calculating which chapters deserve to live…",
  "Asking last year's topper for the weightage…",
  "Sacrificing low-mark topics to the exam gods…",
  "Brewing your battle plan ☕",
];

const GOAL_OPTIONS = [
  { value: "pass", label: "Just pass 🙏", hint: "ruthless mode" },
  { value: "decent", label: "Decent score 😤", hint: "balanced" },
  { value: "top", label: "Top marks 👑", hint: "cover it all" },
] as const;

const PRIORITY_META = {
  study: { emoji: "⚡", title: "STUDY", sub: "do these properly", accent: "border-emerald-500/50 bg-emerald-500/10", chip: "bg-emerald-500/20 text-emerald-300" },
  skim: { emoji: "👀", title: "SKIM", sub: "one read, formulas only", accent: "border-amber-500/50 bg-amber-500/10", chip: "bg-amber-500/20 text-amber-300" },
  sacrifice: { emoji: "💀", title: "SACRIFICE", sub: "let them go. it's okay.", accent: "border-rose-500/40 bg-rose-500/5", chip: "bg-rose-500/20 text-rose-300" },
} as const;

function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function planToShareText(plan: Plan) {
  const lines = [`📚 My ${plan.subject} cram plan (via Rattafy):`, ""];
  for (const p of ["study", "skim", "sacrifice"] as const) {
    const items = plan.items.filter((i) => i.priority === p);
    if (!items.length) continue;
    lines.push(`${PRIORITY_META[p].emoji} ${PRIORITY_META[p].title}`);
    for (const i of items)
      lines.push(`• ${i.topic}${i.minutes ? ` — ${formatMinutes(i.minutes)}` : ""}`);
    lines.push("");
  }
  lines.push(`Make yours 👉 ${window.location.origin}`);
  return lines.join("\n");
}

export default function Home() {
  const [syllabus, setSyllabus] = useState("");
  const [hours, setHours] = useState(6);
  const [goal, setGoal] = useState<string>("pass");
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(
      () => setLoadingLine((n) => (n + 1) % LOADING_LINES.length),
      1800
    );
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (plan) resultRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [plan]);

  async function makePlan() {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus, hours, goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something broke. Try again.");
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something broke. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function share() {
    if (!plan) return;
    const text = planToShareText(plan);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const studied = plan?.items.filter((i) => i.priority !== "sacrifice") ?? [];
  const totalMinutes = studied.reduce((s, i) => s + i.minutes, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Rattafy<span className="text-emerald-400">.</span>
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Exam tonight? Get a ruthless study plan in 30 seconds.
        </p>
      </header>

      {/* Form */}
      <section className="mt-10 space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <div>
          <label htmlFor="syllabus" className="mb-2 block text-sm font-semibold text-zinc-300">
            📚 Paste your syllabus / unit list
          </label>
          <textarea
            id="syllabus"
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            rows={7}
            placeholder={"Unit 1: Introduction to DBMS…\nUnit 2: ER Model, Relational Model…\nUnit 3: SQL, Normalization…\n\n(copy-paste straight from the PDF, formatting doesn't matter)"}
            className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="hours" className="mb-2 block text-sm font-semibold text-zinc-300">
              ⏰ Hours left: <span className="text-emerald-400">{hours}h</span>
            </label>
            <input
              id="hours"
              type="range"
              min={1}
              max={24}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>1h (oh no)</span>
              <span>24h (luxury)</span>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-zinc-300">🎯 Goal</span>
            <div className="flex gap-2">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                    goal === g.value
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                      : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={makePlan}
          disabled={loading || syllabus.trim().length < 10}
          className="w-full rounded-xl bg-emerald-500 py-3.5 text-base font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? LOADING_LINES[loadingLine] : "MAKE MY PLAN ⚡"}
        </button>

        {error && (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </section>

      {/* Result */}
      {plan && (
        <section ref={resultRef} className="mt-10 space-y-6">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
            <h2 className="text-xl font-bold">
              {plan.subject} — {formatMinutes(totalMinutes)} of focused war 🪖
            </h2>
            <p className="mt-1 text-sm text-zinc-300">{plan.strategy}</p>
          </div>

          {(["study", "skim", "sacrifice"] as const).map((p) => {
            const items = plan.items.filter((i) => i.priority === p);
            if (!items.length) return null;
            const meta = PRIORITY_META[p];
            return (
              <div key={p}>
                <h3 className="mb-2 flex items-baseline gap-2 text-lg font-bold">
                  {meta.emoji} {meta.title}
                  <span className="text-xs font-normal text-zinc-500">{meta.sub}</span>
                </h3>
                <ul className="space-y-2">
                  {items.map((item: PlanItem, idx) => (
                    <li
                      key={idx}
                      className={`rounded-xl border p-3.5 ${meta.accent}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{item.topic}</span>
                        {item.minutes > 0 && (
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>
                            {formatMinutes(item.minutes)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{item.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
            <p className="text-sm italic text-zinc-300">“{plan.pep_talk}”</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={share}
                className="flex-1 rounded-xl bg-emerald-500 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400"
              >
                {copied ? "Copied! Paste it in the group 📋" : "Share with classmates 📤"}
              </button>
              <button
                onClick={() => {
                  setPlan(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex-1 rounded-xl border border-zinc-700 py-3 font-semibold text-zinc-300 transition hover:border-zinc-500"
              >
                New plan 🔁
              </button>
            </div>
          </div>
        </section>
      )}

      <footer className="mt-16 text-center text-xs text-zinc-600">
        Made at 2 AM, for people studying at 2 AM. 🌙
      </footer>
    </main>
  );
}
