import { NextResponse } from "next/server";
import { bump } from "@/lib/counter";
import { allow, rateLimitResponse } from "@/lib/ratelimit";
import { AIResponseError, callTextAI, getAIErrorMessage } from "@/lib/ai-client";
import { cacheHelpers } from "@/lib/cache";
import { requireUser } from "@/lib/supabase/require-user";
import { isJsonObject, readJsonBody } from "@/lib/request-body";
import { reportServerError } from "@/lib/observability";

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
  pass: "just pass the exam (~40% marks). Be absolutely ruthless - sacrifice aggressively, keep only the highest-yield topics.",
  decent: "get a decent score (~60-70% marks). Balance coverage and depth, sacrifice only genuinely low-yield topics.",
  top: "score top marks (85%+). Cover almost everything, sacrifice only if time makes it physically impossible.",
};

const SYSTEM_PROMPT = `You are a ruthless but caring senior who has topped every exam in an Indian college by studying smart the night before. A junior gives you their syllabus, how many hours they have left, and their goal. You make them a battle plan.

Rules:
- Split topics into exactly three priorities: "study" (do properly, likely high weightage), "skim" (read once, formulas/definitions only), "sacrifice" (skip entirely, accept the loss).
- Allocate minutes ONLY to study and skim items. Total allocated minutes must be at most 85% of the available time (the rest is breaks and buffer - students always overrun).
- Judge weightage like a real exam: numericals, derivations and frequently-asked units beat intro/history chapters.
- "reason" is one short punchy line (max 12 words) telling them WHY, e.g. "12-mark question guaranteed, comes every year" or "2 marks max, not worth your night".
- If previous year question papers (PYQs) are provided, they OVERRIDE your general intuition: count how often each topic actually appears, weight priorities by real frequency and marks, and cite the evidence in "reason" (e.g. "asked in every paper, 10 marks each time" or "never appeared in any PYQ - skip").
- "strategy" is one sentence summarizing the night's approach.
- "pep_talk" is 1-2 sentences, funny and motivating, desi-senior energy. No cringe. No em dashes. No emojis. No hashtags. No cliches. No generic platitudes. Be specific to the subject and syllabus.
- "subject" is your best guess at the subject name from the syllabus.
- Respond ONLY with JSON: {"subject": string, "strategy": string, "items": [{"topic": string, "priority": "study"|"skim"|"sacrifice", "minutes": number, "reason": string}], "pep_talk": string}. Sacrifice items get "minutes": 0. Order items: study first (most important first), then skim, then sacrifice.`;

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Rattafy." }, { status: 401 });

  const parsed = await readJsonBody(req, 128 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  if (!isJsonObject(parsed.value)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.value;

  const syllabus = typeof body.syllabus === "string" ? body.syllabus.trim() : "";
  const pyq = body.pyq === undefined ? "" : typeof body.pyq === "string" ? body.pyq.trim() : null;
  const hours = Number(body.hours);
  const goalValue = body.goal === undefined ? "pass" : body.goal;
  const goal = typeof goalValue === "string" && Object.hasOwn(GOALS, goalValue) ? goalValue : null;

  if (!goal) return NextResponse.json({ error: "Choose a valid study goal." }, { status: 400 });
  if (pyq === null || pyq.length > 24000) return NextResponse.json({ error: "Past-paper text must be 24,000 characters or fewer." }, { status: 400 });
  if (syllabus.length > 6000) return NextResponse.json({ error: "Syllabus text must be 6,000 characters or fewer." }, { status: 400 });

  if (syllabus.length < 10) {
    return NextResponse.json(
      { error: "Paste a bit more of your syllabus - at least a few topics." },
      { status: 400 }
    );
  }
  if (typeof body.hours !== "number" || !Number.isFinite(hours) || hours < 1 || hours > 48) {
    return NextResponse.json(
      { error: "Hours left must be between 1 and 48." },
      { status: 400 }
    );
  }

  // Check cache first
  const cachedPlan = cacheHelpers.plan.get(user.id, syllabus, hours, goal, pyq);
  if (cachedPlan) {
    return NextResponse.json(cachedPlan);
  }

  const limit = await allow(req, "plan", user.id, 15, 3600);
  if (limit !== "allowed") return rateLimitResponse(limit);

  const userPrompt =
    `Syllabus:\n${syllabus}\n\nHours left before the exam: ${hours}\nGoal: ${GOALS[goal]}` +
    (pyq
      ? `\n\nPrevious year question papers (use these to weight topics by what ACTUALLY gets asked):\n${pyq}`
      : "");

  try {
    const content = await callTextAI(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      0.6,
      { type: "json_object" }
    );
    const plan: Plan = JSON.parse(content);
    if (!Array.isArray(plan.items) || plan.items.length === 0) {
      throw new AIResponseError("The AI returned an empty study plan.");
    }
    // The model is sloppy at arithmetic and often under-allocates, so
    // rescale minutes here to actually hit the promised 85% budget.
    const target = Math.round(hours * 60 * 0.85);
    for (const i of plan.items) if (i.priority === "sacrifice") i.minutes = 0;
    const active = plan.items.filter((i) => i.priority !== "sacrifice");
    const total = active.reduce((s, i) => s + (Number(i.minutes) || 0), 0);
    if (total > 0 && Math.abs(total - target) > target * 0.05) {
      const scale = target / total;
      for (const i of active) {
        i.minutes = Math.max(5, Math.round(((Number(i.minutes) || 0) * scale) / 5) * 5);
      }
    }
    // Cache the result
    cacheHelpers.plan.set(user.id, syllabus, hours, goal, pyq, plan);
    bump("plans");
    return NextResponse.json(plan);
  } catch (error) {
    reportServerError("ai_generation_failed", "/api/plan", error);
    // Fallback to stale cache if available
    const stalePlan = cacheHelpers.plan.getStale(user.id, syllabus, hours, goal, pyq);
    if (stalePlan) {
      return NextResponse.json({
        ...stalePlan,
        _fallback: true,
        _warning: `${getAIErrorMessage(error, "generate a new study plan")} Showing your saved plan instead.`
      });
    }
    return NextResponse.json(
      { error: getAIErrorMessage(error, "generate a study plan") },
      { status: 502 }
    );
  }
}
