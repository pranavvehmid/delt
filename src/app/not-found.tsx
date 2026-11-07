import Link from "next/link";

// #229: a page that doesn't exist (an old link, a typo) gets DELT's own page with a way back.
export default function NotFound() {
  return (
    <main className="signin">
      <div className="signin-card">
        <span className="logo">
          <span>DELT</span>
          <i />
        </span>
        <h1>This page doesn&apos;t exist.</h1>
        <p className="fine">The link may be old, or mistyped.</p>
        <Link className="cta" href="/">
          Go to your inbox
        </Link>
      </div>
    </main>
  );
}
