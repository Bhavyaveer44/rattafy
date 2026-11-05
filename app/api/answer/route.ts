import { NextResponse } from "next/server";
import { bump } from "@/lib/counter";
import { allow, rateLimitResponse } from "@/lib/ratelimit";
import { callTextAI } from "@/lib/ai-client";
import { cacheHelpers } from "@/lib/cache";
import { requireUser } from "@/lib/supabase/require-user";
import { isJsonObject, readJsonBody } from "@/lib/request-body";

export type ModelAnswer = {
  answer: string;
  examiner_tip: string;
};

const SYSTEM_PROMPT = `You are the topper of an Indian university writing model answers that examiners give full marks to.

Rules:
- Structure the answer exam-style: open with the definition/core statement, then clearly numbered points, then a formula/example/diagram description if relevant, then a one-line conclusion.
- Length proportional to marks: ~5 marks = 120-180 words, ~10 marks = 250-350 words. Never pad.
- Write in plain text with numbered points and line breaks. NO markdown symbols like #, *, or backticks.
- If a diagram would earn marks, include a line like "(Draw: labelled diagram of ...)" telling them exactly what to draw.
- "examiner_tip" is one insider line on how to maximise marks on this specific question (e.g. "Underline the keywords BCNF and lossless - examiners scan for them").
- Respond ONLY with JSON: {"answer": string, "examiner_tip": string}`;

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Rattafy." }, { status: 401 });

  const limit = await allow(req, "answer", user.id, 40, 3600);
  if (limit !== "allowed") return rateLimitResponse(limit);

  const parsed = await readJsonBody(req, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  if (!isJsonObject(parsed.value)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.value;

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const subject = body.subject === undefined ? "" : typeof body.subject === "string" ? body.subject.trim() : null;
  const marks = body.marks === undefined ? 10 : body.marks;

  if (question.length > 1000) return NextResponse.json({ error: "Question must be 1,000 characters or fewer." }, { status: 400 });
  if (subject === null || subject.length > 200) return NextResponse.json({ error: "Subject must be 200 characters or fewer." }, { status: 400 });
  if (typeof marks !== "number" || !Number.isInteger(marks) || marks < 1 || marks > 100) {
    return NextResponse.json({ error: "Marks must be a whole number from 1 to 100." }, { status: 400 });
  }

  if (question.length < 5) {
    return NextResponse.json({ error: "No question given." }, { status: 400 });
  }

  // Check cache first
  const cachedAnswer = cacheHelpers.answer.get(question, marks, subject);
  if (cachedAnswer) {
    return NextResponse.json(cachedAnswer);
  }

  try {
    const content = await callTextAI(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Subject: ${subject || "unknown"}\nQuestion (${marks} marks): ${question}`,
        },
      ],
      0.4,
      { type: "json_object" }
    );
    const result: ModelAnswer = JSON.parse(content);
    if (!result.answer) throw new Error("empty answer");
    // Cache the result
    cacheHelpers.answer.set(question, marks, subject, result);
    bump("answers");
    return NextResponse.json(result);
  } catch {
    // Fallback to stale cache if available
    const staleAnswer = cacheHelpers.answer.getStale(question, marks, subject);
    if (staleAnswer) {
      return NextResponse.json({
        ...staleAnswer,
        _fallback: true,
        _warning: "Using cached result due to API unavailability. Results may be outdated."
      });
    }
    return NextResponse.json(
      { error: "Got a confusing answer. Hit the button again." },
      { status: 502 }
    );
  }
}
