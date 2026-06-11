import { NextResponse } from "next/server";
import { bump } from "@/lib/counter";
import { allow, LIMIT_MESSAGE } from "@/lib/ratelimit";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export type PredictedQuestion = {
  q: string;
  topic: string;
  marks: number;
  likelihood: "hot" | "likely" | "wildcard";
  evidence: string;
};

export type Prediction = {
  subject: string;
  questions: PredictedQuestion[];
  disclaimer: string;
};

const SYSTEM_PROMPT = `You are a veteran Indian college professor who has set question papers for 20 years. Given a syllabus and (ideally) previous year question papers, predict the most likely questions in the upcoming exam.

Rules:
- Predict 8-12 questions, ordered most likely first.
- "likelihood": "hot" = appears in PYQs repeatedly or is a guaranteed classic; "likely" = strong pattern match; "wildcard" = plausible surprise worth a look.
- If PYQs are provided, base predictions on ACTUAL repetition patterns: questions that repeat across years, standard numericals, favourite derivations. Cite this in "evidence" (e.g. "appeared in 3 of 4 papers, usually 10 marks").
- If no PYQs are provided, use classic exam patterns for the subject and say so in evidence (e.g. "classic 12-mark question in every university").
- "q" is the full question as it would appear in the paper. "marks" is your best guess.
- "disclaimer" is one funny line reminding them this is prediction, not leak.
- Respond ONLY with JSON: {"subject": string, "questions": [{"q": string, "topic": string, "marks": number, "likelihood": "hot"|"likely"|"wildcard", "evidence": string}], "disclaimer": string}`;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its GROQ_API_KEY." }, { status: 500 });
  }

  if (!(await allow(req, "questions", 15, 3600))) {
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  let body: { syllabus?: string; pyq?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const syllabus = (body.syllabus ?? "").trim().slice(0, 6000);
  const pyq = (body.pyq ?? "").trim().slice(0, 24000);

  if (syllabus.length < 10) {
    return NextResponse.json({ error: "Need the syllabus first." }, { status: 400 });
  }

  const userPrompt =
    `Syllabus:\n${syllabus}` +
    (pyq
      ? `\n\nPrevious year question papers:\n${pyq}`
      : "\n\n(No PYQs provided — predict from classic patterns.)");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (res.status === 429) {
    return NextResponse.json(
      { error: "Too many students predicting right now. Try again in a minute." },
      { status: 429 }
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: "The professor is unavailable. Try again." }, { status: 502 });
  }

  try {
    const data = await res.json();
    const prediction: Prediction = JSON.parse(data.choices[0].message.content);
    if (!Array.isArray(prediction.questions) || prediction.questions.length === 0)
      throw new Error("empty prediction");
    bump("predictions");
    return NextResponse.json(prediction);
  } catch {
    return NextResponse.json(
      { error: "Got a confusing answer from the professor. Try again." },
      { status: 502 }
    );
  }
}
