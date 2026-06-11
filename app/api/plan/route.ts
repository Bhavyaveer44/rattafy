import { NextResponse } from "next/server";
import { bump } from "@/lib/counter";
import { allow, LIMIT_MESSAGE } from "@/lib/ratelimit";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export type PlanItem = {
  topic: string;
  priority: "study" | "skim" | "sacrifice";
  minutes: number;
  reason: string;
};

export type Plan = {
  subject: string;
  strategy: string;
  items: PlanItem[];
  pep_talk: string;
};

const GOALS: Record<string, string> = {
  pass: "just pass the exam (~40% marks). Be absolutely ruthless — sacrifice aggressively, keep only the highest-yield topics.",
  decent: "get a decent score (~60-70% marks). Balance coverage and depth, sacrifice only genuinely low-yield topics.",
  top: "score top marks (85%+). Cover almost everything, sacrifice only if time makes it physically impossible.",
};

const SYSTEM_PROMPT = `You are a ruthless but caring senior who has topped every exam in an Indian college by studying smart the night before. A junior gives you their syllabus, how many hours they have left, and their goal. You make them a battle plan.

Rules:
- Split topics into exactly three priorities: "study" (do properly, likely high weightage), "skim" (read once, formulas/definitions only), "sacrifice" (skip entirely, accept the loss).
- Allocate minutes ONLY to study and skim items. Total allocated minutes must be at most 85% of the available time (the rest is breaks and buffer — students always overrun).
- Judge weightage like a real exam: numericals, derivations and frequently-asked units beat intro/history chapters.
- "reason" is one short punchy line (max 12 words) telling them WHY, e.g. "12-mark question guaranteed, comes every year" or "2 marks max, not worth your night".
- If previous year question papers (PYQs) are provided, they OVERRIDE your general intuition: count how often each topic actually appears, weight priorities by real frequency and marks, and cite the evidence in "reason" (e.g. "asked in every paper, 10 marks each time" or "never appeared in any PYQ — skip").
- "strategy" is one sentence summarizing the night's approach.
- "pep_talk" is 1-2 sentences, funny and motivating, desi-senior energy. No cringe.
- "subject" is your best guess at the subject name from the syllabus.
- Respond ONLY with JSON: {"subject": string, "strategy": string, "items": [{"topic": string, "priority": "study"|"skim"|"sacrifice", "minutes": number, "reason": string}], "pep_talk": string}. Sacrifice items get "minutes": 0. Order items: study first (most important first), then skim, then sacrifice.`;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing its GROQ_API_KEY." },
      { status: 500 }
    );
  }

  if (!(await allow(req, "plan", 15, 3600))) {
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  let body: { syllabus?: string; hours?: number; goal?: string; pyq?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const syllabus = (body.syllabus ?? "").trim().slice(0, 6000);
  const pyq = (body.pyq ?? "").trim().slice(0, 24000);
  const hours = Number(body.hours);
  const goal = GOALS[body.goal ?? ""] ? body.goal! : "pass";

  if (syllabus.length < 10) {
    return NextResponse.json(
      { error: "Paste a bit more of your syllabus — at least a few topics." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(hours) || hours < 1 || hours > 48) {
    return NextResponse.json(
      { error: "Hours left must be between 1 and 48." },
      { status: 400 }
    );
  }

  const userPrompt =
    `Syllabus:\n${syllabus}\n\nHours left before the exam: ${hours}\nGoal: ${GOALS[goal]}` +
    (pyq
      ? `\n\nPrevious year question papers (use these to weight topics by what ACTUALLY gets asked):\n${pyq}`
      : "");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (res.status === 429) {
    return NextResponse.json(
      { error: "Too many students cramming right now. Try again in a minute." },
      { status: 429 }
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: "The AI senior is unavailable. Try again." },
      { status: 502 }
    );
  }

  try {
    const data = await res.json();
    const plan: Plan = JSON.parse(data.choices[0].message.content);
    if (!Array.isArray(plan.items) || plan.items.length === 0) throw new Error("empty plan");
    bump("plans");
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      { error: "Got a confusing answer from the AI. Hit the button again." },
      { status: 502 }
    );
  }
}
