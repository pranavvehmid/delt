import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · DELT", description: "What DELT reads, keeps and shares, and how to delete it." };

// Issue #31. Plain words, kept short. If you change what DELT stores or sends anywhere,
// change this page in the same pull request.
const UPDATED = "6 November 2026";

export default function Privacy() {
  return (
    <main className="doc">
      <Link href="/" className="logo" aria-label="DELT home">
        <span>DELT</span>
        <i />
      </Link>
      <h1>Privacy</h1>
      <p className="muted">Last updated {UPDATED}. DELT is a free, open-source project run by VIT students. It isn&apos;t an official VIT service.</p>

      <h2>What DELT can do in your Gmail</h2>
      <p>
        When you sign in, you give DELT Google&apos;s <b>gmail.modify</b> permission. That lets an app read your mail, change labels, mark mail read or unread, and move mail to
        Trash. It does <b>not</b> allow deleting mail permanently.
      </p>
      <p>
        DELT only reads your mail, adds its four <i>MailSort</i> labels, and marks mail read or unread when you do. It never sends, moves to Trash or deletes mail.
      </p>

      <h2>What DELT keeps</h2>
      <ul>
        <li>Your email address and Google name. The register number in your name tells DELT your batch.</li>
        <li>For each mail: sender, subject, Gmail&apos;s one-line preview, the pile, a short summary, any due date, and whether it&apos;s read or done. Not the full mail or its attachments: those are fetched from Gmail when you open them and not saved.</li>
        <li>A Google sign-in token, so mail can be checked while the app is closed. It&apos;s stored encrypted.</li>
        <li>The senders you moved to another pile (your sorting rules).</li>
        <li>If you turn on notifications: your browser&apos;s push address. If you add your own Gemini key: that key, encrypted.</li>
        <li>In the installed app (not a browser tab): the newest 200 mails for up to 7 days, so DELT opens offline. Signing out removes them.</li>
      </ul>
      <p>
        Mail older than 6 months is deleted automatically, except mails you moved to another pile (they hold your sorting rules). Everything else stays until you delete it (
        Settings → Your data).
      </p>

      <h2>Who can see it</h2>
      <p>
        Only you, in the app. The data sits in a Supabase database run by DELT&apos;s maintainer, who could see it there; it isn&apos;t looked at except to fix a problem you
        reported. DELT has no ads, no analytics trackers, and never sells or shares your data.
      </p>

      <h2>AI sorting (only if you say yes)</h2>
      <p>
        Most mail is sorted by simple rules on DELT&apos;s server. If you allow it, mail the rules aren&apos;t sure about (sender, subject and the start of the text) is sent to
        Google&apos;s Gemini to double-check. DELT uses Gemini&apos;s <b>free tier</b>, and Google may use what is sent to it to improve its models. If you add your own
        Gemini key, your own Google account&apos;s terms apply.
      </p>
      <p>You choose the first time you open DELT, and can change it any time in Settings → AI sorting. &quot;Rules only&quot; sends nothing to Gemini.</p>

      <h2>Other services DELT uses</h2>
      <ul>
        <li>Google (sign-in, Gmail, and Gemini if you allow it)</li>
        <li>Vercel (runs the website and server, in Dublin)</li>
        <li>Supabase (the database, in Ireland)</li>
        <li>GitHub Actions (checks for new mail in the background) and your browser&apos;s push service (notifications)</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>
          <b>Delete everything:</b> Account menu → Delete my data. It removes all of the above, cancels DELT&apos;s access to your Gmail, and can remove the MailSort labels.
        </li>
        <li>
          <b>Cancel access only:</b> remove DELT at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
        </li>
        <li>
          <b>Questions or a problem:</b> open an issue at <a href="https://github.com/pranavvehmid/delt/issues">github.com/pranavvehmid/delt</a>. Don&apos;t paste mail content there:
          issues are public.
        </li>
      </ul>
      <p className="muted">
        The code is public, so anyone can check that this page matches what DELT does: <a href="https://github.com/pranavvehmid/delt">github.com/pranavvehmid/delt</a>.
      </p>
      <p>
        <Link href="/">← Back to DELT</Link>
      </p>
    </main>
  );
}
