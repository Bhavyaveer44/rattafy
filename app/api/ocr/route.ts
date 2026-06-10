import { NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_IMAGE_BYTES = 3_500_000; // stay under Groq's base64 image limit

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its GROQ_API_KEY." }, { status: 500 });
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const image = body.image ?? "";
  if (!image.startsWith("data:image/jpeg;base64,") || image.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a page from a college exam question paper. Extract ALL the text on it, preserving question numbers and marks (e.g. '[10 marks]'). Output ONLY the extracted text — no commentary. If the page has no readable text, output exactly: EMPTY",
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "OCR failed." }, { status: 502 });
  }

  try {
    const data = await res.json();
    const text: string = (data.choices[0].message.content ?? "").trim();
    return NextResponse.json({ text: text === "EMPTY" ? "" : text });
  } catch {
    return NextResponse.json({ error: "OCR failed." }, { status: 502 });
  }
}
