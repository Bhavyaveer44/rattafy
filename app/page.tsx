"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan, PlanItem } from "./api/plan/route";
import type { Prediction } from "./api/questions/route";
import type { ModelAnswer } from "./api/answer/route";
import { extractPdfText } from "@/lib/pdf";
import { imageToJpegDataUrl } from "@/lib/image";

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

const LIKELIHOOD_META = {
  hot: { emoji: "🔥", label: "HOT", chip: "bg-rose-500/20 text-rose-300" },
  likely: { emoji: "✅", label: "LIKELY", chip: "bg-emerald-500/20 text-emerald-300" },
  wildcard: { emoji: "🎲", label: "WILDCARD", chip: "bg-amber-500/20 text-amber-300" },
} as const;

const SITE_URL = "https://rattafy.vercel.app";

export default function Home() {
  const [syllabus, setSyllabus] = useState("");
  const [hours, setHours] = useState(6);
  const [goal, setGoal] = useState<string>("pass");
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [plannedHours, setPlannedHours] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pyqText, setPyqText] = useState("");
  const [pyqNames, setPyqNames] = useState<string[]>([]);
  const [pyqStatus, setPyqStatus] = useState<string | null>(null);
  const [pyqError, setPyqError] = useState<string | null>(null);
  const [planUsedPyq, setPlanUsedPyq] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ plans: number; predictions: number } | null>(null);
  const [answers, setAnswers] = useState<Record<number, ModelAnswer>>({});
  const [answerLoading, setAnswerLoading] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.plans > 0) setStats(d);
      })
      .catch(() => {});
  }, []);

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
    setPrediction(null);
    setPlanUsedPyq(Boolean(pyqText));
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus, hours, goal, pyq: pyqText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something broke. Try again.");
      setPlan(data);
      setPlannedHours(hours);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something broke. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(SITE_URL);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handlePyqFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, 5);
    setPyqError(null);
    setPyqStatus("opening PDFs…");
    try {
      const { text, ocrPages } = await extractPdfText(files, (p) =>
        setPyqStatus(
          `${p.mode === "ocr" ? "🔍 reading scanned" : "📖 reading"} ${p.file} - page ${p.page}/${p.pages}`
        )
      );
      if (text.length < 100) {
        setPyqError("Couldn't read anything useful from those PDFs. Try different files.");
        setPyqStatus(null);
        return;
      }
      setPyqText(text);
      setPyqNames(files.map((f) => f.name));
      setPyqStatus(null);
      if (ocrPages > 0) setPyqError(null);
    } catch {
      setPyqError("Couldn't read those PDFs. Make sure they're valid question papers.");
      setPyqStatus(null);
    }
  }

  async function handleSyllabusPhotos(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, 5);
    setPhotoError(null);
    let added = "";
    try {
      for (let i = 0; i < files.length; i++) {
        setPhotoStatus(`📷 reading photo ${i + 1}/${files.length}…`);
        const image = await imageToJpegDataUrl(files[i]);
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, kind: "syllabus" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't read that photo.");
        if (data.text) added += (added ? "\n" : "") + data.text;
      }
      if (!added) {
        setPhotoError("Couldn't read any text in those photos. Try a clearer shot.");
      } else {
        setSyllabus((s) => (s.trim() ? s.trimEnd() + "\n" + added : added));
      }
    } catch (e) {
      setPhotoError(
        e instanceof Error ? e.message : "Couldn't read those photos. Try again."
      );
    } finally {
      setPhotoStatus(null);
    }
  }

  function clearPyq() {
    setPyqText("");
    setPyqNames([]);
    setPyqError(null);
  }

  async function getAnswer(i: number, question: string, marks: number) {
    if (answers[i] || answerLoading !== null) return;
    setAnswerLoading(i);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, marks, subject: prediction?.subject ?? plan?.subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something broke. Try again.");
      setAnswers((a) => ({ ...a, [i]: data }));
    } catch (e) {
      setAnswers((a) => ({
        ...a,
        [i]: {
          answer: e instanceof Error ? `⚠️ ${e.message}` : "⚠️ Something broke. Try again.",
          examiner_tip: "",
        },
      }));
    } finally {
      setAnswerLoading(null);
    }
  }

  async function predict() {
    setPredicting(true);
    setPredictError(null);
    setAnswers({});
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus, pyq: pyqText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something broke. Try again.");
      setPrediction(data);
    } catch (e) {
      setPredictError(e instanceof Error ? e.message : "Something broke. Try again.");
    } finally {
      setPredicting(false);
    }
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
        {stats && (
          <p className="mt-2 text-xs font-bold text-emerald-400/80">
            🔥 {stats.plans.toLocaleString()} plan{stats.plans === 1 ? "" : "s"} made
            {stats.predictions > 0 &&
              ` · ${stats.predictions.toLocaleString()} paper${stats.predictions === 1 ? "" : "s"} predicted`}
          </p>
        )}
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
          {photoStatus ? (
            <p className="mt-1.5 animate-pulse text-xs text-amber-300">{photoStatus}</p>
          ) : (
            <label className="mt-1.5 inline-block cursor-pointer text-xs font-semibold text-zinc-500 transition hover:text-emerald-300">
              📷 too lazy to type? snap a photo of the syllabus page instead
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleSyllabusPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {photoError && <p className="mt-1.5 text-xs text-rose-300">{photoError}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-300">
            📜 Previous year papers{" "}
            <span className="font-normal text-zinc-500">
              - optional, makes the plan scary-accurate
            </span>
          </label>
          {pyqText ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/50 bg-violet-500/10 p-3 text-sm">
              <span className="truncate text-violet-200">
                📜 {pyqNames.join(", ")} - loaded ✅
              </span>
              <button
                onClick={clearPyq}
                className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-bold text-zinc-400 hover:text-zinc-200"
              >
                ✕ remove
              </button>
            </div>
          ) : pyqStatus ? (
            <div className="animate-pulse rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-amber-300">
              {pyqStatus}
            </div>
          ) : (
            <label className="block cursor-pointer rounded-xl border border-dashed border-zinc-600 bg-zinc-950 p-4 text-center text-sm text-zinc-400 transition hover:border-violet-400 hover:text-zinc-200">
              tap to upload PYQ PDFs (up to 5) - even scanned papers work 📸
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  handlePyqFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {pyqError && <p className="mt-1.5 text-xs text-rose-300">{pyqError}</p>}
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
              {plan.subject} - {formatMinutes(totalMinutes)} of focused war 🪖
            </h2>
            {plannedHours * 60 > totalMinutes && (
              <p className="mt-1 text-xs text-zinc-400">
                ☕ {formatMinutes(plannedHours * 60 - totalMinutes)} of your{" "}
                {plannedHours}h kept aside for breaks, food and panic-buffer -
                nobody studies non-stop, plan for the real you
              </p>
            )}
            {planUsedPyq && (
              <p className="mt-1 text-xs font-bold text-violet-300">
                📜 weighted by your actual question papers, not vibes
              </p>
            )}
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

          {/* Question paper predictor */}
          <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-5">
            {!prediction ? (
              <>
                <h3 className="text-lg font-bold">🔮 Predict the question paper</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {planUsedPyq
                    ? "Your PYQs are loaded - predictions will follow the actual repetition patterns."
                    : "Works best with PYQ PDFs uploaded above. Without them, it predicts from classic patterns."}
                </p>
                <button
                  onClick={predict}
                  disabled={predicting}
                  className="mt-3 w-full rounded-xl bg-violet-500 py-3 font-bold text-zinc-950 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {predicting ? "Channeling the paper-setter's mind… 🧙" : "PREDICT MY PAPER 🔮"}
                </button>
                {predictError && (
                  <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
                    {predictError}
                  </p>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold">
                  🔮 Most likely questions - {prediction.subject}
                </h3>
                <ul className="mt-3 space-y-2">
                  {prediction.questions.map((q, i) => {
                    const meta = LIKELIHOOD_META[q.likelihood] ?? LIKELIHOOD_META.likely;
                    return (
                      <li key={i} className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-semibold">
                            {i + 1}. {q.q}
                          </span>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>
                            {meta.emoji} {q.marks}m
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {meta.label} · {q.evidence}
                        </p>
                        {answers[i] ? (
                          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                            <p className="whitespace-pre-wrap text-sm text-zinc-300">
                              {answers[i].answer}
                            </p>
                            {answers[i].examiner_tip && (
                              <p className="mt-2 border-t border-zinc-800 pt-2 text-xs font-semibold text-amber-300">
                                💡 {answers[i].examiner_tip}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => getAnswer(i, q.q, q.marks)}
                            disabled={answerLoading !== null}
                            className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {answerLoading === i ? "topper is writing… ✍️" : "✍️ model answer"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-center text-xs italic text-zinc-500">{prediction.disclaimer}</p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
            <p className="text-sm italic text-zinc-300">“{plan.pep_talk}”</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={copyLink}
                className="flex-1 rounded-xl bg-emerald-500 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400"
              >
                {linkCopied ? "Link copied! Paste it anywhere 🔗" : "Copy link 🔗"}
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
