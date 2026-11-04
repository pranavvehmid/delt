import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// PNG app icons, drawn on request: a gold tile with a dot-matrix "D" and the red glyph dot.
// /icons/192, /icons/512, and /icons/512?m=1 (maskable: extra safe-zone padding).

// 5x7 dot pattern for the letter D.
const D = ["1110", "1001", "1001", "1001", "1001", "1001", "1110"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "192" ? 192 : 512;
  const maskable = req.nextUrl.searchParams.get("m") === "1";
  const pad = maskable ? size * 0.2 : size * 0.06;
  const tile = size - pad * 2;
  const dot = tile * 0.085;
  const gap = tile * 0.035;
  const gridW = 4 * dot + 3 * gap;
  const gridH = 7 * dot + 6 * gap;

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#f5c842" : "transparent" }}>
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: maskable ? 0 : tile * 0.22,
            background: "#f5c842",
            border: maskable ? "none" : `${Math.max(4, tile * 0.04)}px solid #0b0716`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap, width: gridW, height: gridH, marginRight: dot }}>
            {D.map((row, r) => (
              <div key={r} style={{ display: "flex", gap }}>
                {row.split("").map((c, i) => (
                  <div key={i} style={{ width: dot, height: dot, borderRadius: dot, background: c === "1" ? "#1b1238" : "transparent" }} />
                ))}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", right: tile * 0.15, bottom: tile * 0.1, width: dot * 1.25, height: dot * 1.25, borderRadius: dot, background: "#d71921" }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
