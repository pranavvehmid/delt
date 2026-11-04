import type { Metadata, Viewport } from "next";
import { Doto, IBM_Plex_Sans, Space_Grotesk, Space_Mono } from "next/font/google";
import "./app.css";
import { PREPAINT } from "@/lib/prefs";

// Minimal uses one typeface, IBM Plex Sans, at light/regular/medium (Swiss style: weight, not bold).
// Glyph uses Doto dot-matrix + Space Grotesk.
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["300", "400", "500"] });
const dot = Doto({ variable: "--font-dot", subsets: ["latin"], axes: ["ROND"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "700"] });
const mono = Space_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "DELT",
  description: "DELT sorts your VIT inbox: exams, registrations and hackathons first, everything else later.",
  appleWebApp: { capable: true, title: "DELT", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/192" },
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
    <html lang="en" suppressHydrationWarning className={`${plex.variable} ${dot.variable} ${grotesk.variable} ${mono.variable}`}>
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
