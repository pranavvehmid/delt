// Works out who the student is from their VIT Google name, e.g.
// "A B STUDENT NAME 26BCE0001" -> 2026 batch, BCE (B.Tech CSE), 1st year.

const BRANCHES: Record<string, string> = {
  BCE: "B.Tech Computer Science and Engineering",
  BAI: "B.Tech CSE (AI & ML)",
  BDS: "B.Tech CSE (Data Science)",
  BCI: "B.Tech CSE (Information Security)",
  BCT: "B.Tech CSE (IoT)",
  BKT: "B.Tech CSE (Blockchain)",
  BIT: "B.Tech Information Technology",
  BEC: "B.Tech Electronics and Communication",
  BEE: "B.Tech Electrical and Electronics",
  BEI: "B.Tech Electronics and Instrumentation",
  BME: "B.Tech Mechanical Engineering",
  BCL: "B.Tech Civil Engineering",
  BCH: "B.Tech Chemical Engineering",
  BBT: "B.Tech Biotechnology",
  BCB: "B.Tech Computer Science and Business Systems",
};

export type StudentProfile = {
  regNo: string | null;
  batch: number | null; // e.g. 2026
  branchCode: string | null;
  branch: string | null;
  year: number | null; // 1 = first year
};

export function profileFromName(name: string | null | undefined, now = new Date()): StudentProfile {
  const m = /\b(\d{2})([A-Z]{3})(\d{4})\b/.exec((name ?? "").toUpperCase());
  if (!m) return { regNo: null, batch: null, branchCode: null, branch: null, year: null };
  const batch = 2000 + Number(m[1]);
  // The academic year starts in July.
  const academicStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    regNo: m[0],
    batch,
    branchCode: m[2],
    branch: BRANCHES[m[2]] ?? `Programme code ${m[2]}`,
    year: Math.max(1, academicStart - batch + 1),
  };
}

/** How the AI is told who the student is. #87: an unreadable register number means "unknown",
 *  not "first-year B.Tech". #81: the register number itself is never sent, only year and programme. */
export function describeProfile(p: StudentProfile) {
  if (!p.batch) return "a student at VIT Vellore, India, whose year and programme are unknown (don't assume either)";
  const ord = ["first", "second", "third", "fourth", "fifth"][(p.year ?? 1) - 1] ?? `${p.year}th`;
  return `a ${ord}-year ${p.branch} student (${p.batch} batch) at VIT Vellore, India`;
}
