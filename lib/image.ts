// Compresses a photo (e.g. of a syllabus page) into a JPEG data URL
// small enough for /api/ocr's 3.5MB limit.

const MAX_DIM = 1600;
const MAX_DATA_URL_CHARS = 3_400_000;

export async function imageToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.8, 0.6, 0.4]) {
    const out = canvas.toDataURL("image/jpeg", quality);
    if (out.length <= MAX_DATA_URL_CHARS) return out;
  }
  throw new Error("That photo is too detailed to compress — try a closer, simpler shot.");
}
