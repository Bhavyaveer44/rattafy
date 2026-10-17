import { ImageResponse } from "next/og";

export const alt =
  "Rattafy - exam tonight? Get a ruthless AI study plan in 30 seconds.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHIPS = [
  { label: "⚡ STUDY", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)" },
  { label: "👀 SKIM", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)" },
  { label: "💀 SACRIFICE", color: "#fb7185", bg: "rgba(251, 113, 133, 0.1)" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(52, 211, 153, 0.15), transparent 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 110,
            fontWeight: 900,
            color: "#fafafa",
            letterSpacing: "-4px",
          }}
        >
          Rattafy<span style={{ color: "#34d399" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: "#a1a1aa",
            marginTop: 18,
            textAlign: "center",
          }}
        >
          Exam tonight? Get a ruthless AI study plan in 30 seconds.
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 56 }}>
          {CHIPS.map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                padding: "14px 32px",
                borderRadius: 999,
                border: `2px solid ${c.color}`,
                background: c.bg,
                color: c.color,
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 64,
            fontSize: 26,
            color: "#71717a",
          }}
        >
          rattafy.vercel.app - free · works with your PYQ PDFs 📜
        </div>
      </div>
    ),
    size
  );
}
