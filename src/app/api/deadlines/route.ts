import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";

// Your own deadlines (typed in, or tracked from a mail).

async function currentUser() {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

export async function GET() {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data, error } = await db.from("deadlines").select("*").eq("user_email", email).order("due_at", { ascending: true }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deadlines: data });
}

const Create = z.object({
  title: z.string().trim().min(1).max(200),
  due_at: z.string().refine((s) => !isNaN(Date.parse(s)), "bad date"),
  email_id: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Create.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Give it a title and a valid date" }, { status: 400 });
  const { data, error } = await db
    .from("deadlines")
    .insert({ ...parsed.data, due_at: new Date(parsed.data.due_at).toISOString(), user_email: email })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (parsed.data.email_id) {
    await db.from("emails").update({ deadline_choice: "tracked" }).eq("id", parsed.data.email_id).eq("user_email", email);
  }
  return NextResponse.json({ deadline: data });
}

const Patch = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  due_at: z.string().refine((s) => !isNaN(Date.parse(s))).optional(),
  done: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { id, ...fields } = parsed.data;
  if (fields.due_at) fields.due_at = new Date(fields.due_at).toISOString();
  const { error } = await db.from("deadlines").update(fields).eq("id", id).eq("user_email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { data } = await db.from("deadlines").delete().eq("id", id).eq("user_email", email).select("email_id").maybeSingle();
  if (data?.email_id) await db.from("emails").update({ deadline_choice: null }).eq("id", data.email_id).eq("user_email", email);
  return NextResponse.json({ ok: true });
}
