// #82: the database answers at most 1,000 rows per request, so a plain select of every student
// silently stops at 1,000. This pages through until a short page comes back.

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** `query(from, to)` must return rows from..to inclusive, in a stable order. */
export async function allRows<T>(query: (from: number, to: number) => Page<T>, pageSize = 1000, maxPages = 200): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await query(p * pageSize, (p + 1) * pageSize - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return { data: out, error: null };
}
