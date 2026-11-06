import { NextResponse } from "next/server";
import { allow, rateLimitResponse } from "@/lib/ratelimit";
import { AIResponseError, callVisionAI, getAIErrorMessage } from "@/lib/ai-client";
import { cacheHelpers, hashContent } from "@/lib/cache";
import { requireUser } from "@/lib/supabase/require-user";
import { isJsonObject, readJsonBody } from "@/lib/request-body";
import { reportServerError } from "@/lib/observability";
const MAX_IMAGE_DATA_URL_CHARS = 3_500_000;
const MAX_IMAGE_BYTES = 2_500_000;

const PROMPTS = {
  pyq: "This is a page from a college exam question paper. Extract ALL the text on it, preserving question numbers and marks (e.g. '[10 marks]'). Output ONLY the extracted text - no commentary. If the page has no readable text, output exactly: EMPTY",
  syllabus:
    "This is a photo of a college syllabus / unit list. Extract ALL the text EXACTLY as written, preserving unit numbers, topic names, and any hierarchical structure. Be extremely accurate - do not summarize or paraphrase. Keep the original formatting with line breaks. Output ONLY the extracted text - no commentary. If there is no readable text, output exactly: EMPTY",
} as const;

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Rattafy." }, { status: 401 });

  const parsed = await readJsonBody(req, 3_600_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  if (!isJsonObject(parsed.value)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.value;

  const image = typeof body.image === "string" ? body.image : "";
  const prefix = "data:image/jpeg;base64,";
  const payload = image.startsWith(prefix) ? image.slice(prefix.length) : "";
  if (
    !payload ||
    image.length > MAX_IMAGE_DATA_URL_CHARS ||
    payload.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)
  ) {
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  }
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const decodedImageBytes = (payload.length / 4) * 3 - padding;
  if (decodedImageBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 2.5 MB or smaller." }, { status: 400 });
  }
  const kind = body.kind === undefined ? "pyq" : body.kind;
  if (kind !== "syllabus" && kind !== "pyq") {
    return NextResponse.json({ error: "Choose a valid OCR input type." }, { status: 400 });
  }
  const prompt = PROMPTS[kind];

  // Check cache first based on image content hash
  const imageHash = hashContent(image);
  const cachedText = cacheHelpers.ocr.get(user.id, imageHash);
  if (cachedText !== null) {
    return NextResponse.json({ text: cachedText });
  }

  const limit = await allow(req, "ocr", user.id, 60, 3600);
  if (limit !== "allowed") return rateLimitResponse(limit);

  try {
    const text = await callVisionAI(prompt, image);
    if (!text.trim()) throw new AIResponseError("The AI returned no OCR text.");
    const resultText = text.trim() === "EMPTY" ? "" : text.trim();
    // Cache the result
    cacheHelpers.ocr.set(user.id, imageHash, resultText);
    return NextResponse.json({ text: resultText });
  } catch (error) {
    reportServerError("ocr_failed", "/api/ocr", error);
    // Fallback to stale cache if available
    const staleText = cacheHelpers.ocr.getStale(user.id, imageHash);
    if (staleText !== null) {
      return NextResponse.json({ 
        text: staleText,
        _fallback: true,
        _warning: `${getAIErrorMessage(error, "read this image")} Showing previously extracted text instead.`
      });
    }
    return NextResponse.json({ error: getAIErrorMessage(error, "read this image") }, { status: 502 });
  }
}
