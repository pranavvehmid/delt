import type { Metadata, Viewport } from "next";
import { Doto, Space_Grotesk, Space_Mono } from "next/font/google";
import "./app.css";

// Fonts for the Glyph look (Doto dot-matrix + Space Grotesk). Calm uses the phone's system font.
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
  themeColor: "#17112B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dot.variable} ${grotesk.variable} ${mono.variable} antialiased`}>
        {/* Apply the saved look (calm or glyph) and light/dark before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `var r=document.documentElement;r.dataset.look="calm";try{var t=localStorage.getItem("delt-theme"),k=localStorage.getItem("delt-look");if(t)r.dataset.theme=t;if(k)r.dataset.look=k}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
