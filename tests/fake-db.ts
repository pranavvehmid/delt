// A small in-memory stand-in for the parts of Supabase's query builder that DELT's server code uses.
// Enough to run syncUser in tests (#39). Not a full PostgREST.
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  calls: string[] = [];
  constructor(seed: Record<string, Row[]> = {}) {
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map((r) => ({ ...r }));
  }
  rows(t: string) {
    return (this.tables[t] ??= []);
  }
  from(table: string) {
    return new Query(this, table);
  }
  async rpc() {
    return { data: true, error: null };
  }
}

class Query implements PromiseLike<{ data: unknown; error: null | { message: string }; count?: number }> {
  private op: "select" | "update" | "upsert" | "delete" = "select";
  private vals: Row = {};
  private filters: Filter[] = [];
  private conflict: string[] = [];
  private sort: { col: string; asc: boolean } | null = null;
  private max = Infinity;
  private one: "single" | "maybe" | null = null;
  private returning = false;
  constructor(private db: FakeDb, private table: string) {}

  select() {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  update(v: Row) {
    this.op = "update";
    this.vals = v;
    return this;
  }
  upsert(v: Row, o?: { onConflict?: string }) {
    this.op = "upsert";
    this.vals = v;
    this.conflict = (o?.onConflict ?? "id").split(",");
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  gte(c: string, v: string) {
    this.filters.push((r) => String(r[c] ?? "") >= v);
    return this;
  }
  lt(c: string, v: string) {
    this.filters.push((r) => String(r[c] ?? "") < v);
    return this;
  }
  lte(c: string, v: string) {
    this.filters.push((r) => String(r[c] ?? "") <= v);
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) {
    this.sort = { col, asc: o?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.one = "single";
    return this;
  }
  maybeSingle() {
    this.one = "maybe";
    return this;
  }

  private run() {
    const all = this.db.rows(this.table);
    const match = all.filter((r) => this.filters.every((f) => f(r)));
    this.db.calls.push(`${this.op} ${this.table}`);
    if (this.op === "upsert") {
      const i = all.findIndex((r) => this.conflict.every((k) => r[k] === this.vals[k]));
      if (i >= 0) all[i] = { ...all[i], ...this.vals };
      else all.push({ ...this.vals });
      return { data: null, error: null };
    }
    if (this.op === "update") {
      match.forEach((r) => Object.assign(r, this.vals));
      return { data: this.returning ? match : null, error: null };
    }
    if (this.op === "delete") {
      this.db.tables[this.table] = all.filter((r) => !match.includes(r));
      return { data: null, error: null, count: match.length };
    }
    let rows = [...match];
    if (this.sort) {
      const { col, asc } = this.sort;
      rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
    }
    rows = rows.slice(0, this.max);
    if (this.one) {
      if (!rows.length) return this.one === "single" ? { data: null, error: { message: "no rows" } } : { data: null, error: null };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }
  then<A, B>(ok?: ((v: { data: unknown; error: null | { message: string }; count?: number }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }
}
