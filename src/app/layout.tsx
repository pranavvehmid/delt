import type { Metadata, Viewport } from "next";
import { Doto, IBM_Plex_Sans, Space_Grotesk, Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./app.css";
import { PREPAINT } from "@/lib/prefs";

// Minimal uses one typeface, IBM Plex Sans, at light/regular/medium (Swiss style: weight, not bold).
// Glyph uses Doto dot-matrix + Space Grotesk.
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["300", "400", "500"] });
const dot = Doto({ variable: "--font-dot", subsets: ["latin"], axes: ["ROND"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "700"] });
const mono = Space_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "700"] });
// Grid (F1-inspired): Titillium Web (SIL Open Font Licence, see fonts/titillium/OFL.txt), shipped with
// the app so builds never depend on a font download. Only fetched by browsers when Grid is used.
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
