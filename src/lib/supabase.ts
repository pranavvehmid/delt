import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client. Uses the service-role key, so never import this from
// a client component. Created on first use so builds work without env vars.
let client: SupabaseClient | null = null;
export const db = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    return Reflect.get(client, prop, client);
  },
});

export type Priority = "very_important" | "priority" | "later" | "noise";

export type EmailRow = {
  id: string;
  user_email: string;
  thread_id: string | null;
  from_name: string | null;
  from_address: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  priority: Priority;
  category: string;
  summary: string;
  deadline: string | null;
  reason: string | null;
  user_corrected: boolean;
  is_done: boolean;
  gmail_labeled: boolean;
  sorted_by: "rules" | "ai";
  unread: boolean;
  deadline_choice: "tracked" | "skipped" | null;
};

export type DeadlineRow = {
  id: string;
  user_email: string;
  title: string;
  due_at: string;
  email_id: string | null;
  note: string | null;
  done: boolean;
  created_at: string;
};
