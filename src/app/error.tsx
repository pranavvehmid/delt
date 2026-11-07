"use client";

// #228: if any screen crashes, show what happened and a way out instead of a blank page.
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="signin">
      <div className="signin-card">
        <span className="logo">
          <span>DELT</span>
          <i />
        </span>
        <h1>Something went wrong on this screen.</h1>
        <p className="fine">Your mail is safe in Gmail. Reloading usually fixes it.</p>
        <button className="cta" onClick={() => reset()}>
          Try again
        </button>
        <Link className="getapp" href="/">
          Back to the inbox
        </Link>
        <a className="getapp" href="https://github.com/pranavvehmid/delt/issues/new" target="_blank" rel="noreferrer">
          Report the problem ↗
        </a>
        {error.digest && <p className="fine">Error code: {error.digest}</p>}
      </div>
    </main>
  );
}
