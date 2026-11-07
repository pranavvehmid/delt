// "Delete my data" (issue #9). Removes everything DELT keeps about one student:
// their Google refresh token, mail previews, deadlines and phone subscriptions.
// Optionally removes the DELT labels from their Gmail, then revokes DELT's Google access.
// The database and Google calls are passed in, so tests can check it without a real database.

/** Every table holding a student's data, and the column naming them. Users goes last. */
export const STUDENT_TABLES = [
  ["push_subscriptions", "user_email"],
  ["deadlines", "user_email"],
  ["emails", "user_email"],
  ["users", "email"],
] as const;

type Result = PromiseLike<{ data?: unknown; error: { message: string } | null }>;
export type AccountDb = {
  from(table: string): {
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): Result } };
    delete(): { eq(col: string, val: string): Result };
  };
};
export type AccountGoogle = {
  accessToken(refreshToken: string): Promise<string>;
  removeLabels(accessToken: string): Promise<number>;
  revoke(token: string): Promise<boolean>;
};

export type DeleteReport = { labelsRemoved: number; googleRevoked: boolean; tables: string[]; notes: string[] };

// A table that was never created (an older database) has nothing to delete.
const missingTable = (msg: string) => /does not exist|could not find the table|schema cache/i.test(msg);

export async function deleteStudentData(email: string, db: AccountDb, google: AccountGoogle, opts: { removeLabels: boolean }): Promise<DeleteReport> {
  const report: DeleteReport = { labelsRemoved: 0, googleRevoked: false, tables: [], notes: [] };
  const { data } = await db.from("users").select("refresh_token").eq("email", email).maybeSingle();
  const refresh = (data as { refresh_token?: string } | null)?.refresh_token;

  if (refresh) {
    if (opts.removeLabels) {
      try {
        report.labelsRemoved = await google.removeLabels(await google.accessToken(refresh));
      } catch (e) {
        report.notes.push(`Gmail labels were left in place: ${(e as Error).message.slice(0, 120)}`);
      }
    }
    try {
      report.googleRevoked = await google.revoke(refresh);
    } catch {
      report.notes.push("Couldn't reach Google to cancel access. Remove DELT at myaccount.google.com/permissions.");
    }
  }

  for (const [table, col] of STUDENT_TABLES) {
    const { error } = await db.from(table).delete().eq(col, email);
    if (error && !missingTable(error.message)) throw new Error(`Deleting from ${table} failed: ${error.message}`);
    report.tables.push(table);
  }
  return report;
}
