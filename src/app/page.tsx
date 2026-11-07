import { auth, signIn, signOut } from "@/auth";
import InboxApp from "./inbox-app";
import { db } from "@/lib/supabase";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string; error?: string }> }) {
  const session = await auth();
  const { deleted, error } = await searchParams;
  // #130: signed in on this device, but the account was deleted on another one: start again
  let gone = false;
  if (session?.user?.email) {
    const { data, error: dbError } = await db.from("users").select("email").eq("email", session.user.email.toLowerCase()).maybeSingle();
    gone = !dbError && !data;
  }

  if (!session?.user?.email || gone) {
    return (
      <main className="signin">
        <div className="signin-card">
          {error && (
            <p className="note" role="alert">
              {error === "AccessDenied" ? "DELT is for VIT accounts. Sign in with your @vitstudent.ac.in address." : "Sign-in didn't finish. Please try again."}
            </p>
          )}
          {gone && !deleted && (
            <p className="note" role="status">
              Your DELT data was deleted (maybe on another device). Sign in to start again.
            </p>
          )}
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
          {/* #58: show what DELT looks like, not four grey dots */}
          <ol className="preview" aria-label="An example of a sorted inbox">
            <li className="pv urgent">
              <small>Urgent</small>
              <b>CAT-1 exam schedule released</b>
              <span>Exams start 18 Nov. Check your slot.</span>
            </li>
            <li className="pv priority">
              <small>Priority</small>
              <b>Revised timetable from Monday</b>
            </li>
            <li className="pv later">
              <small>Later</small>
              <b>Photography club meetup this weekend</b>
            </li>
            <li className="pv noise">
              <small>Noise</small>
              <b>50% off on online courses</b>
            </li>
          </ol>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            {/* Google's sign-in button, as its branding guidelines ask */}
            <button className="gsi">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </form>
          <a className="getapp" href="https://github.com/pranavvehmid/delt/releases/download/app-latest/DELT.apk">
            Get the Android app
          </a>
          <p className="fine">
            For @vitstudent.ac.in accounts. DELT reads your mail and adds labels. It never sends, trashes or deletes mail. AI sorting is off until you say yes.{" "}
            <a href="/privacy">Privacy</a>
          </p>
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
