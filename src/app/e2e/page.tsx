import { notFound } from "next/navigation";
import InboxApp from "../inbox-app";

// Browser tests only (issue #12): the real app with a pretend student and no Google sign-in.
// The tests answer every /api call themselves (e2e/mock.ts), so this page never touches real data.
// Returns 404 unless the server was started with DELT_E2E=1, which production never sets.
export const dynamic = "force-dynamic";

export default function E2E() {
  if (process.env.DELT_E2E !== "1" || process.env.VERCEL) notFound();
  return (
    <InboxApp
      email="test.student2026@vitstudent.ac.in"
      name="Test"
      signOutAction={async () => {
        "use server";
      }}
      signInAction={async () => {
        "use server";
      }}
    />
  );
}
