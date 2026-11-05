import { auth, signIn, signOut } from "@/auth";
import InboxApp from "./inbox-app";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await auth();
  const { deleted } = await searchParams;

  if (!session?.user?.email) {
    return (
      <main className="signin">
        <div className="signin-card">
          {deleted && (
            <p className="note" role="status">
              Your DELT data is deleted and its access to your Gmail is cancelled.
            </p>
          )}
          <span className="logo">
            <span>DELT</span>
            <i />
          </span>
          <h1>Your college mail, sorted by what needs you first.</h1>
          <ul>
            <li className="p-very_important"><i className="tagdot" /> Urgent: exams, registrations, fees</li>
            <li className="p-priority"><i className="tagdot" /> Priority: hackathons, notices</li>
            <li className="p-later"><i className="tagdot" /> Later: events, club mail</li>
            <li className="p-noise"><i className="tagdot" /> Noise: promotions</li>
          </ul>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button className="cta">Sign in with Google</button>
          </form>
          <p className="fine">For @vitstudent.ac.in accounts. DELT reads and labels your mail. It can&apos;t delete anything.</p>
        </div>
      </main>
    );
  }

  // "A B STUDENT NAME 26BCE0001" -> "Student": first real word, no initials or register number.
  const first = (session.user.name ?? "").split(/\s+/).find((w) => w.length > 1 && !/\d/.test(w)) ?? "there";
  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  return (
    <InboxApp
      email={session.user.email}
      name={name}
      signOutAction={async () => {
        "use server";
        await signOut();
      }}
      signInAction={async () => {
        "use server";
        await signIn("google");
      }}
    />
  );
}
