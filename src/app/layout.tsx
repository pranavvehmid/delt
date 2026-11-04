import type { Metadata, Viewport } from "next";
import { Doto, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import "./shell.css";

// Same type system as the vit-timetable page: Doto (Nothing-style dot matrix)
// for headings and numbers, Space Grotesk for text, Space Mono for labels.
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
        {/* Apply the saved light/dark choice before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("delt-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
