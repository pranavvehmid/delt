import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./app.css";
import { PREPAINT } from "@/lib/prefs";

// Every font ships with the app (SIL Open Font Licence, see src/app/fonts/*/OFL.txt), so builds never
// depend on downloading fonts, and only the fonts a look uses are fetched by the browser.
// Minimal: IBM Plex Sans at light / regular / medium (Swiss style: weight, not bold).
const plex = localFont({
  variable: "--font-plex",
  display: "swap",
  src: [
    { path: "./fonts/plex/plex-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/plex/plex-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex/plex-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plex/plex-700-normal.woff2", weight: "700", style: "normal" }, // the DELT wordmark
  ],
});
// Glyph and Extra dark: Doto dot-matrix (variable, with a ROND axis).
const dot = localFont({ variable: "--font-dot", display: "swap", preload: false, src: [{ path: "./fonts/doto/doto-100-900-normal.woff2", weight: "100 900", style: "normal" }] });
// Glyph: Space Grotesk.
const grotesk = localFont({
  variable: "--font-grotesk",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/grotesk/grotesk-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/grotesk/grotesk-700-normal.woff2", weight: "700", style: "normal" },
  ],
});
// Extra dark labels: Space Mono.
const mono = localFont({
  variable: "--font-mono",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/mono/mono-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/mono/mono-700-normal.woff2", weight: "700", style: "normal" },
  ],
});
// Grid (F1-inspired): Titillium Web.
const race = localFont({
  variable: "--font-race",
  preload: false,
  display: "swap",
  src: [
    { path: "./fonts/titillium/titillium-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/titillium/titillium-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/titillium/titillium-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/titillium/titillium-900-normal.woff2", weight: "900", style: "normal" },
    { path: "./fonts/titillium/titillium-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/titillium/titillium-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/titillium/titillium-700-italic.woff2", weight: "700", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: "DELT",
  description: "Sorts your VIT mail so exams, registrations, fees and deadlines stay at the top.",
  appleWebApp: { capable: true, title: "DELT", statusBarStyle: "default" },
  icons: { apple: "/icons/192?v=2" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e13" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${plex.variable} ${dot.variable} ${grotesk.variable} ${mono.variable} ${race.variable}`}>
      <body className="antialiased">
        {/* Apply saved appearance (look, theme, accent, size, spacing) before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: PREPAINT,
          }}
        />
        {children}
      </body>
    </html>
  );
}
