import { NextResponse } from "next/server";
import { bump } from "@/lib/counter";
import { allow, LIMIT_MESSAGE } from "@/lib/ratelimit";
import { callTextAI } from "@/lib/ai-client";

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
- "examiner_tip" is one insider line on how to maximise marks on this specific question (e.g. "Underline the keywords BCNF and lossless — examiners scan for them").
- Respond ONLY with JSON: {"answer": string, "examiner_tip": string}`;

export async function POST(req: Request) {

  if (!(await allow(req, "answer", 40, 3600))) {
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  let body: { question?: string; marks?: number; subject?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const question = (body.question ?? "").trim().slice(0, 1000);
  const subject = (body.subject ?? "").trim().slice(0, 200);
  const marks = Number(body.marks) || 10;

  if (question.length < 5) {
    return NextResponse.json({ error: "No question given." }, { status: 400 });
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
    bump("answers");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Got a confusing answer. Hit the button again." },
      { status: 502 }
    );
  }
}
