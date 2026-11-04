import type { CSSProperties } from "react";
import { auth, signIn, signOut } from "@/auth";
import Dashboard from "./dashboard";

const SPARK = "M29 0c1.6 15 6.4 22.4 29 29-22.6 7-27.4 14.4-29 29-1.6-14.6-6.4-22-29-29C22.6 22.4 27.4 15 29 0z";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <main className="wrap" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <section className="top" style={{ gridTemplateColumns: "1fr", maxWidth: 720, width: "100%" }}>
          <header className="block hero">
            <div className="eyebrow">VIT VELLORE · FOR EVERY VITIAN</div>
            <h1 className="dot" aria-label="DELT">
              {"DELT".split("").map((ch, i) => (
                <span key={i} className="ltr" style={{ ["--n"]: i } as CSSProperties} aria-hidden="true">
                  {ch}
                </span>
              ))}
              <i />
            </h1>
            <div className="tagline">DON&apos;T JUST READ MAIL. DELT WITH IT.</div>
            <div className="chips">
              {["Exams first", "Registrations", "Hackathons", "Free forever"].map((c, i) => (
                <span key={c} className="chip" style={{ ["--n"]: i } as CSSProperties}>
                  {c}
                </span>
              ))}
            </div>
            <svg className="spark" style={{ right: 28, top: 20 }} width="54" height="54" viewBox="0 0 58 58" aria-hidden="true">
              <path d={SPARK} fill="var(--on)" />
            </svg>
            <svg className="spark b" style={{ right: 98, top: 74 }} width="26" height="26" viewBox="0 0 58 58" aria-hidden="true">
              <path d={SPARK} fill="var(--on)" />
            </svg>
          </header>
          <div className="block next" style={{ alignItems: "flex-start" }}>
            <span className="lbl" style={{ width: "100%" }}>
              <span>SIGN IN</span>
              <span>VIT GOOGLE ACCOUNT</span>
            </span>
            <span className="what">Your inbox, sorted into Urgent, Chances, Notices and Later. Reads and labels mail, never deletes.</span>
            <form
              action={async () => {
                "use server";
                await signIn("google");
              }}
            >
              <button className="btn gold">→ Sign in with VIT</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  // "A B STUDENT NAME 26BCE0001" -> "Student": first real word, no initials or register number.
  const first = (session.user.name ?? "").split(/\s+/).find((w) => w.length > 1 && !/\d/.test(w)) ?? "there";
  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  return (
    <Dashboard
      email={session.user.email}
      name={name}
      signOutAction={async () => {
        "use server";
        await signOut();
      }}
    />
  );
}
