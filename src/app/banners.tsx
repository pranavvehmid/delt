"use client";

// The notices above the list: app update, the AI question, offline, and lost Gmail access.
import { useEffect, useState } from "react";
import { ago } from "@/lib/inbox";
import { APK_URL, checkAppUpdate, snoozeAppUpdate } from "@/lib/app-update";

type Props = {
  aiConsent: boolean | null | undefined;
  onAnswerAi: (consent: boolean) => void;
  offline: boolean;
  savedAt: number | null;
  now: number;
  reauth: boolean;
  signInAction?: () => Promise<void>;
};

export default function Banners({ aiConsent, onAnswerAi, offline, savedAt, now, reauth, signInAction }: Props) {
  // Android app: a newer build is on GitHub (see lib/app-update.ts)
  const [appUpdate, setAppUpdate] = useState<{ installed: number; latest: number } | null>(null);
  useEffect(() => {
    checkAppUpdate().then(setAppUpdate);
  }, []);

  return (
    <>
      {appUpdate && (
        <section className="banner update" aria-labelledby="app-update">
          <span>
            <b id="app-update">A new version of the DELT app is ready.</b> Tap Update, then Install when Android asks. You stay signed in.
          </span>
          <span className="ask-btns">
            <a className="pillbtn on" href={APK_URL} onClick={() => setTimeout(() => setAppUpdate(null), 500)}>
              Update
            </a>
            <button
              className="pillbtn"
              onClick={() => {
                snoozeAppUpdate();
                setAppUpdate(null);
              }}
            >
              Later
            </button>
          </span>
        </section>
      )}
      {aiConsent === null && !offline && (
        <section className="banner ask" aria-labelledby="ai-ask">
          <span>
            <b id="ai-ask">Let AI double-check unclear mail?</b> DELT sorts with simple rules. For mail they aren&apos;t sure about, it can ask Google&apos;s Gemini (free
            tier), which may use what it&apos;s sent to improve its models.{" "}
            <a className="link" href="/privacy" target="_blank">
              Privacy
            </a>
          </span>
          <span className="ask-btns">
            {/* #44: a consent question gets two equal answers, no nudge; the one that shares nothing comes first */}
            <button className="pillbtn" onClick={() => onAnswerAi(false)}>
              Rules only
            </button>
            <button className="pillbtn" onClick={() => onAnswerAi(true)}>
              Allow AI
            </button>
          </span>
        </section>
      )}
      {offline && (
        <div className="banner offline" role="status">
          <span>
            <b>You&apos;re offline.</b> {savedAt ? `Showing your inbox from ${ago(savedAt, now)}.` : "Nothing saved on this phone yet."} Changes are paused until you&apos;re back online.
          </span>
        </div>
      )}
      {reauth && (
        <div className="banner" role="alert">
          <span>
            <b>DELT can&apos;t reach your Gmail.</b> Its access was removed in your Google account, so new mail won&apos;t show up. Sign in again to fix it.
          </span>
          {signInAction && (
            <form action={signInAction}>
              <button className="pillbtn on">Sign in again</button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
