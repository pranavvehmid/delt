import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { DOT, INK, PAPER, RED, WORDMARK } from "@/lib/logo";

// PNG app icons, drawn on request: the DELT wordmark with the red dot, on paper.
// /icons/192, /icons/512, and /icons/512?m=1 (maskable: full-bleed, extra safe-zone padding).

export async function GET(req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  // Small white "D" on transparent, for the Android status bar (the full wordmark is unreadable at 24dp).
  if (raw === "badge") {
    return new ImageResponse(
      (
        <div style={{ width: 96, height: 96, display: "flex" }}>
          <svg width={96} height={96} viewBox="20 24 72 60">
            <path fill="#ffffff" fillRule="evenodd" d="M28 32H49A22 22 0 0 1 49 76H28Z M38 42H48A12 12 0 0 1 48 66H38Z" />
            <circle cx="79" cy="71" r="5" fill="#ffffff" />
          </svg>
        </div>
      ),
      { width: 96, height: 96, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
    );
  }
  const size = raw === "192" ? 192 : 512;
  const maskable = req.nextUrl.searchParams.get("m") === "1";
  const pad = maskable ? 0 : size * 0.04;
  const tile = size - pad * 2;
  // maskable icons get cropped to a circle, so they show the whole 108 box (wordmark inside the safe zone);
  // normal icons zoom in so the letters are bigger
  const box = maskable ? "0 0 108 108" : "19 19 70 70";

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: maskable ? 0 : tile * 0.18,
            background: PAPER,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={tile} height={tile} viewBox={box}>
            <path fill={INK} fillRule="evenodd" d={WORDMARK} />
            <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={RED} />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
