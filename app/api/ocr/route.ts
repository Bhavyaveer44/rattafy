import { NextResponse } from "next/server";
import { allow, LIMIT_MESSAGE } from "@/lib/ratelimit";
import { callVisionAI } from "@/lib/ai-client";
import { cacheHelpers, hashContent } from "@/lib/cache";
const MAX_IMAGE_BYTES = 3_500_000; // stay under Groq's base64 image limit

const PROMPTS = {
  pyq: "This is a page from a college exam question paper. Extract ALL the text on it, preserving question numbers and marks (e.g. '[10 marks]'). Output ONLY the extracted text — no commentary. If the page has no readable text, output exactly: EMPTY",
  syllabus:
    "This is a photo of a college syllabus / unit list. Extract ALL the text on it, preserving unit numbers and topic names. Output ONLY the extracted text — no commentary. If there is no readable text, output exactly: EMPTY",
} as const;

export async function POST(req: Request) {

  if (!(await allow(req, "ocr", 60, 3600))) {
    return NextResponse.json({ error: LIMIT_MESSAGE }, { status: 429 });
  }

  let body: { image?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const image = body.image ?? "";
  if (!image.startsWith("data:image/jpeg;base64,") || image.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  }
  const prompt = PROMPTS[body.kind === "syllabus" ? "syllabus" : "pyq"];

  // Check cache first based on image content hash
  const imageHash = hashContent(image);
  const cachedText = cacheHelpers.ocr.get(imageHash);
  if (cachedText !== null) {
    return NextResponse.json({ text: cachedText });
  }

  try {
    const text = await callVisionAI(prompt, image);
    const resultText = text === "EMPTY" ? "" : text;
    // Cache the result
    cacheHelpers.ocr.set(imageHash, resultText);
    return NextResponse.json({ text: resultText });
  } catch {
    return NextResponse.json({ error: "OCR failed." }, { status: 502 });
  }
}
