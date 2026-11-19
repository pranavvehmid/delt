import type { Metadata } from "next";
import Link from "next/link";
import SharedDeadlineCard from "./shared-deadline-card";

export const metadata: Metadata = { title: "Shared deadline · DELT", robots: { index: false, follow: false } };

export default function SharedDeadlinePage() {
  return (
    <main className="doc">
      <Link href="/" className="logo" aria-label="DELT home"><span>DELT</span><i /></Link>
      <SharedDeadlineCard />
    </main>
  );
}
