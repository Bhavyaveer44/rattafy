// Extracts text from PYQ PDFs entirely in the browser.
// Text-based PDFs: pdf.js text layer (free, instant).
// Scanned PDFs: page rendered to JPEG → /api/ocr → Groq vision model reads it.

export type PdfProgress = {
  file: string;
  page: number;
  pages: number;
  mode: "text" | "ocr";
};

const MAX_OCR_PAGES = 8; // keep the free vision tier happy
const MAX_TOTAL_CHARS = 48000;

export async function extractPdfText(
  files: File[],
  onProgress: (p: PdfProgress) => void
): Promise<{
  text: string;
  ocrPages: number;
  skippedOcr: number;
  ocrErrors: string[];
  ocrLimitReached: boolean;
  textTruncated: boolean;
}> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  let out = "";
  let ocrPages = 0;
  let ocrAttempts = 0;
  let skippedOcr = 0;
  const ocrErrors: string[] = [];
  let ocrLimitReached = false;
  let textTruncated = false;

  for (const file of files) {
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;
    out += `\n\n===== Question paper: ${file.name} =====`;
    for (let p = 1; p <= doc.numPages; p++) {
      if (out.length > MAX_TOTAL_CHARS) {
        textTruncated = true;
        break;
      }
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 80) {
        // Real text layer - use it directly
        onProgress({ file: file.name, page: p, pages: doc.numPages, mode: "text" });
        out += `\n[Page ${p}] ${text}`;
      } else if (ocrAttempts < MAX_OCR_PAGES) {
        // Scanned page - render to image and ask the vision model
        ocrAttempts++;
        onProgress({ file: file.name, page: p, pages: doc.numPages, mode: "ocr" });
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const image = canvas.toDataURL("image/jpeg", 0.75);
        try {
          const res = await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image }),
          });
          const data: unknown = await res.json().catch(() => null);
          if (
            typeof data === "object" && data !== null && "_warning" in data && typeof data._warning === "string" &&
            !ocrErrors.includes(data._warning)
          ) {
            ocrErrors.push(data._warning);
          }
          if (!res.ok) {
            const message =
              typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
                ? data.error
                : `OCR failed (HTTP ${res.status}).`;
            if (!ocrErrors.includes(message)) ocrErrors.push(message);
            skippedOcr++;
          } else if (
            typeof data === "object" && data !== null && "text" in data && typeof data.text === "string" && data.text.trim()
          ) {
            out += `\n[Page ${p} (scanned)] ${data.text.trim()}`;
            ocrPages++;
          } else {
            skippedOcr++;
            if (!ocrErrors.includes("OCR found no readable text on one or more scanned pages.")) {
              ocrErrors.push("OCR found no readable text on one or more scanned pages.");
            }
          }
        } catch {
          skippedOcr++;
          if (!ocrErrors.includes("Could not connect to the OCR service. Check your connection and try again.")) {
            ocrErrors.push("Could not connect to the OCR service. Check your connection and try again.");
          }
        }
      } else {
        skippedOcr++;
        ocrLimitReached = true;
      }
    }
    await task.destroy();
    if (textTruncated) break;
  }

  return {
    text: out.trim().slice(0, MAX_TOTAL_CHARS),
    ocrPages,
    skippedOcr,
    ocrErrors,
    ocrLimitReached,
    textTruncated,
  };
}
