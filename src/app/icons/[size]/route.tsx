import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// PNG app icons, drawn on request: a heavy "D" with the red DELT dot on paper.
// /icons/192, /icons/512, and /icons/512?m=1 (maskable: full-bleed, extra safe-zone padding).

export async function GET(req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "192" ? 192 : 512;
  const maskable = req.nextUrl.searchParams.get("m") === "1";
  const pad = maskable ? 0 : size * 0.04;
  const tile = size - pad * 2;
  // maskable icons get cropped to a circle, so draw the mark smaller
  const mark = maskable ? size * 0.78 : tile;

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: maskable ? 0 : tile * 0.18,
            background: "#fafaf9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={mark} height={mark} viewBox="0 0 108 108">
            <path fill="#1c1917" fillRule="evenodd" d="M28 32H49A22 22 0 0 1 49 76H28Z M38 42H48A12 12 0 0 1 48 66H38Z" />
            <circle cx="79" cy="71" r="5" fill="#c8102e" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
