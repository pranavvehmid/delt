import { auth, signIn, signOut } from "@/auth";
import InboxApp from "./inbox-app";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <main className="signin">
        <div className="signin-card">
          <span className="logo">
            <span>DELT</span>
            <i />
          </span>
          <h1>Your VIT inbox, sorted. Nothing important missed.</h1>
          <ul>
            <li className="p-very_important"><i className="tagdot" /> Exams, registrations, fees and deadlines first</li>
            <li className="p-priority"><i className="tagdot" /> Hackathons, contests and notices next</li>
            <li className="p-later"><i className="tagdot" /> Events and achievements when you have time</li>
            <li className="p-noise"><i className="tagdot" /> Promotions kept out of the way</li>
          </ul>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button className="cta">Sign in with your VIT account</button>
          </form>
          <p className="fine">Free. Reads and labels your mail, never deletes it. Only @vitstudent.ac.in accounts.</p>
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
    />
  );
}
