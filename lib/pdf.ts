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
const MAX_TOTAL_CHARS = 24000;

export async function extractPdfText(
  files: File[],
  onProgress: (p: PdfProgress) => void
): Promise<{ text: string; ocrPages: number; skippedOcr: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  let out = "";
  let ocrPages = 0;
  let skippedOcr = 0;

  for (const file of files) {
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;
    out += `\n\n===== Question paper: ${file.name} =====`;
    for (let p = 1; p <= doc.numPages; p++) {
      if (out.length > MAX_TOTAL_CHARS) break;
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
      } else if (ocrPages < MAX_OCR_PAGES) {
        // Scanned page - render to image and ask the vision model
        onProgress({ file: file.name, page: p, pages: doc.numPages, mode: "ocr" });
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const image = canvas.toDataURL("image/jpeg", 0.75);
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            out += `\n[Page ${p} (scanned)] ${data.text}`;
            ocrPages++;
          }
        } else {
          skippedOcr++;
        }
      } else {
        skippedOcr++;
      }
    }
    await task.destroy();
  }

  return { text: out.trim().slice(0, MAX_TOTAL_CHARS), ocrPages, skippedOcr };
}
