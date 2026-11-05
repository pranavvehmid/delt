import "server-only";
import type { ParsedMessage } from "./gmail";
import type { StudentProfile } from "./profile";
import type { Classification, Category, Correction } from "./types";

// Free, offline sorter. Decides in a fixed order (first match wins):
//   your corrections > promotions > not-for-you > achievements > scholarships >
//   exams / interviews / registrations / fees (very important) >
//   hackathons & competitions > official notices > everything else.
// It also reports how sure it is, so unclear mails can go to the free AI.

const any = (res: RegExp[], text: string) => res.some((re) => re.test(text));

// NOTE: VIT subjects end in "- reg" meaning "regarding", so never match bare "reg".
const P = {
  exam: [
    /\b(cat|fat)[- ]?(i{1,2}|1|2)?\b/, /\bexam(ination)?s?\b/, /\bquiz(zes)?\b/, /\bcbt\b/, /\bcomputer[- ]based test\b/,
    /\b(online|mock|written|module|unit|class) test\b/, /\btest (today|tomorrow|on|schedule)\b/, /\bviva\b/, /\bhall ticket\b/,
    /\bseating (arrangement|plan)\b/, /\bre-?exam\b/, /\barrears?\b/, /\bmid[- ]?term\b/, /\bend[- ]?sem(ester)?\b/,
    /\blab (exam|test|assessment)\b/, /\bmissed (quiz|test|exam|assessment)/,
  ],
  registration: [
    /\bcourse registration\b/, /\bffcs\b/, /\bmock (course )?registration\b/, /\bwinter (semester )?registration\b/,
    /\bregistrations? (is |are )?(now )?(open|opens|closing|closes|close|ends?|deadline|link|form|portal|started)\b/,
    /\bregister (now|by|before|on or before|here|at|using|through)\b/, /\blast date\b/, /\bdeadline\b/,
    /\bapply (now|by|before|on or before)\b/, /\bapplications? (are )?(now )?(open|invited|close|closing|due)\b/,
    /\bcall for ([a-z]+ ){0,3}(applications|nominations|participants|proposals|volunteers|members|entries)\b/,
    /\b(fill|submit) (the|this|your) (google )?form\b/, /\bon or before\b/, /\bno later than\b/, /\bfinal call\b/, /\blast chance\b/,
    /\benrol(l)?(ment)? (now|by|before|closes)\b/,
    /\bsubmissions? (are |is )?(now )?(open|opens|closing|closes|close|due)\b/,
  ],
  interview: [/\binterviews?\b/, /\bshortlist(ed)?\b/, /\bselection (round|process|test)\b/, /\baptitude test\b/, /\bgroup discussion\b/, /\bassessment round\b/],
  fee: [/\bfee(s)? (payment|due|pay)\b/, /\bpay (the|your) fees?\b/, /\bpayment (due|deadline|link)\b/],
  attendance: [/\battendance (shortage|below|warning|requirement)\b/, /\bdebar/, /\bdetain/, /\b75 ?%/],
  hackathon: [/\bhackathon\b/, /\bideathon\b/, /\bcodeathon\b/, /\bbuildathon\b/, /\bdatathon\b/, /\bdesignathon\b/, /\bhack ?(fest|day|night)\b/, /\bdevpost\b/, /\bdevfolio\b/],
  competition: [
    /\bcompetitions?\b/, /\bcontest\b/, /\bchallenge\b/, /\bolympiad\b/, /\bcoding round\b/, /\bcase study (competition|challenge)\b/,
    /\bpaper presentation\b/, /\bprize pool\b/, /\bcash prize\b/, /\bunstop\b/, /\binnovation sprint\b/, /\bpitch(ing)? (competition|fest)\b/,
  ],
  announcement: [
    /\bcircular\b/, /\bnotice\b/, /\bannouncement\b/, /\btime ?table\b/, /\bholiday\b/, /\bvacation\b/, /\binstructional day\b/,
    /\bhostel\b/, /\bmess\b/, /\bresults?\b/, /\bacademic calendar\b/, /\bclass(es)? (cancelled|rescheduled|shifted|relocated)\b/,
    /\brelocation\b/, /\bbus (facility|service)\b/, /\btransport\b/,
  ],
  decision: [/\bhas been decided\b/, /\bis hereby\b/, /\bmandatory\b/, /\bcompulsory\b/, /\bpostponed\b/, /\brescheduled\b/, /\bwith immediate effect\b/],
  academic: [/\bassignment\b/, /\bdigital assignment\b/, /\bsyllabus\b/, /\bproctor\b/, /\bfaculty advisor\b/, /\bvtop\b/, /\bworkbook\b/, /\bcourse (page|material|enrol)/, /\bda ?\d{1,2}\b/, /\bwelcome to [a-z]{3,6}\d{3}/, /\b[a-z]{4,6}\d{3}[a-z]?\b/],
  account: [/\bsecurity alert\b/, /\b2-step verification\b/, /\bpassword (reset|expir)/, /\bsign-?in attempt\b/, /\baccount (access|suspended|locked)\b/],
  scholarship: [/\bscholarships?\b/, /\bfellowships?\b/, /\bstipend\b/, /\bfinancial (aid|assistance)\b/, /\bmerit[- ]cum[- ]means\b/],
  placement: [/\bplacements?\b/, /\binternships?\b/, /\brecruitment\b/, /\bhiring\b/, /\bpre[- ]placement\b/, /\bppo\b/, /\bjob (opening|offer)\b/],
  achievement: [/\bcongratulat/, /\bcongrats\b/, /\bachievements?\b/, /\bfelicitat/, /\bproud(ly)? (to )?(announce|share)/, /\bsecur(ed|ing) (first|second|third|\d)/, /\bbagged\b/, /\bwinners? (of|are|list|announced|declared)\b/, /\bresults? (are )?(announced|declared|out)\b/],
  club_event: [
    /\bclubs? (and|&) chapters\b/, /\bclub\b/, /\bchapter\b/, /\bworkshop\b/, /\bwebinar\b/, /\bseminar\b/, /\bguest lecture\b/,
    /\bmaster ?class(es)?\b/, /\btalk\b/, /\binaugura/, /\binvitation\b/, /\bscreening\b/, /\bsummer school\b/, /\bwinter school\b/,
    /\bimmersion\b/, /\bstudy abroad\b/, /\bsemester abroad\b/, /\b(2\+2|3\+1|4\+1)\b/, /\bexchange program/, /\bblood donation\b/,
    /\binformation session\b/, /\borientation session\b/, /\bexhibition\b/, /\bsymposium\b/, /\bconference\b/,
    /\bsummit\b/, /\bconfluence\b/, /\bconclave\b/,
  ],
  newsletter: [/\bnewsletter\b/, /\bdigest\b/, /\bmagazine\b/, /\bgratitude\b/, /\bthank you for (attending|participating)\b/],
  promotion: [/\b\d+ ?% off\b/, /\bdiscount\b/, /\bsale\b/, /\bmerch(andise)?\b/, /\bexclusive( [a-z]+)? offers?\b/, /\boffers? for (the )?vit\b/, /\bcoupon\b/, /\bbuy now\b/, /\bfree trial\b/, /\bsponsored\b/, /\blimited[- ]time\b/],
};

const PROGRAMME = /\bsummer school\b|\bwinter school\b|\bimmersion\b|\bnational university of\b|\buniversity of [a-z]+\b|\b(certificate|specialised|specialized) courses?\b|\bcourses? under\b|\b(programme|program) 20\d\d\b|\bai programme\b|\b[a-z]+ programme$/;
// Optional add-ons, even when the mail mentions FFCS: minors, honours, open electives.
const OPTIONAL_COURSE = /\b(minor|honou?rs)\s+(in|degree|programme|program)\b|\bopen elective\b/;
// Mail for international / NRI students only.
const INTERNATIONAL = /\b(oci|foreign nationals?|nri students?|international students?)\b/;
// Something you personally have to go and get.
const COLLECT = /\b(collect|pick up)\s+(your|the)\b/;
// A file or folder someone shared with you directly (Google Drive, Docs, Sheets).
const SHARED_WITH_YOU = /\bshared with you\b|\binvited you to (edit|view|comment)/;
const SENIOR =/\b(final|pre-?final|2nd|second|3rd|third|4th|fourth)[- ]years?\b|\b(m\.?tech|mba|mca|m\.?sc|ph\.?d|research scholars?|pg students|integrated m\.?tech)\b/;
const FOR_FIRST_YEARS = /\b(first|1st)[- ]years?\b|\bfreshers?\b|\bfreshman\b|\ball (the )?(students|years)\b|\bopen to all\b|\bug[- ]freshers\b/;

/** True when the mail is clearly aimed at other years or programmes. */
function notForYou(text: string, subject: string, profile: StudentProfile): string | null {
  if (INTERNATIONAL.test(subject)) return "Meant for international students";
  if (FOR_FIRST_YEARS.test(text)) return null;
  // Batch years mentioned near "batch"/"students"/"b.tech", none of them yours.
  const years = [...text.matchAll(/\b(20[1-3]\d)\s*(?:batch|admitted|students|-\s*20\d\d batch)|\b(?:batch|b\.?tech\.?\s*\(?)\s*(20[1-3]\d)/g)]
    .map((m) => Number(m[1] ?? m[2]));
  if (profile.batch && years.length && !years.includes(profile.batch)) return `For the ${years[0]} batch, not yours`;
  if (SENIOR.test(subject)) return "Meant for senior or PG students";
  if (/\b(only|exclusively) (for|to)\b/.test(text) && SENIOR.test(text)) return "Meant for senior or PG students";
  if (/\bmba\b|\bmca\b|\bm\.?tech admission/.test(subject)) return "Admissions for other programmes";
  return null;
}

// ---------- Dates ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpExecArray) => [number, number, number | null] }[] = [
  { re: /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g, parse: (m) => [+m[1], +m[2], +m[3]] },
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?,?\\s+${MONTH_RE},?\\s*(\\d{4})?`, "g"), parse: (m) => [+m[1], MONTHS.indexOf(m[2].slice(0, 3)) + 1, m[3] ? +m[3] : null] },
  // "November 15, 2026". The day must not run into more digits, so "November 2026" is not "November 20".
  { re: new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?\\s*(\\d{4})?`, "g"), parse: (m) => [+m[2], MONTHS.indexOf(m[1].slice(0, 3)) + 1, m[3] ? +m[3] : null] },
];

function istISO(y: number, mo: number, d: number, h = 23, mi = 59) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:00+05:30`;
}

function findTime(text: string): [number, number] | null {
  const m = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/.exec(text);
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3].startsWith("p")) h += 12;
  return [h, m[2] ? +m[2] : 0];
}

type FoundDate = { iso: string; ts: number; index: number };

function findDates(text: string, received: Date): FoundDate[] {
  const out: FoundDate[] = [];
  for (const { re, parse } of DATE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const [d, mo, yRaw] = parse(m);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      let y = yRaw ?? received.getFullYear();
      if (y < 100) y += 2000;
      // Real calendar days only: JavaScript would quietly turn "31 Feb" into 3 March.
      if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) continue;
      const time = findTime(text.slice(m.index, m.index + 60)) ?? [23, 59];
      let iso = istISO(y, mo, d, time[0], time[1]);
      if (!yRaw && Date.parse(iso) < received.getTime() - 30 * 86400_000) iso = istISO(y + 1, mo, d, time[0], time[1]);
      const ts = Date.parse(iso);
      if (!isNaN(ts)) out.push({ iso, ts, index: m.index });
    }
  }
  const rel = /\b(today|tonight|tomorrow)\b/.exec(text);
  if (rel) {
    const base = new Date(received.getTime() + 5.5 * 3600_000);
    if (rel[1] === "tomorrow") base.setUTCDate(base.getUTCDate() + 1);
    const time = findTime(text.slice(rel.index, rel.index + 60)) ?? [23, 59];
    const iso = istISO(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), time[0], time[1]);
    out.push({ iso, ts: Date.parse(iso), index: rel.index });
  }
  return out;
}

const DEADLINE_CUES = [
  /\blast date\b/, /\bdeadline\b/, /\bdue (date|on|by)\b/, /\bregist(er|ration)s? (by|before|closes?|ends?|on or before)\b/,
  /\bcloses? on\b/, /\blast day\b/, /\bsubmit(ted)? (by|before|on or before)\b/, /\bon or before\b/, /\bno later than\b/,
  /\bapply (by|before)\b/, /\bbefore\b/, /\bby\b/, /\btest\b/, /\bexam\b/, /\bquiz\b/, /\binterview\b/, /\bscheduled (on|for)\b/,
];

/** The date right after a deadline cue, else the earliest upcoming date when the mail asks for action. */
function findDeadline(text: string, received: Date, actionable: boolean): string | null {
  const dates = findDates(text, received).filter((d) => d.ts > received.getTime() - 86400_000);
  if (!dates.length) return null;
  let best: FoundDate | null = null;
  for (const cue of DEADLINE_CUES) {
    const re = new RegExp(cue.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const after = dates.filter((d) => d.index >= m!.index && d.index - m!.index < 120).sort((a, b) => a.index - b.index)[0];
      if (after && (!best || after.ts < best.ts)) best = after;
    }
  }
  if (!best && actionable) best = [...dates].sort((a, b) => a.ts - b.ts)[0];
  return best?.iso ?? null;
}

function firstSentence(body: string) {
  const clean = body
    .replace(/https?:\/\/\S+/g, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 25 && !/^(dear|hi|hello|greetings|respected|warm greetings)\b/i.test(l))[0];
  if (!clean) return "";
  const s = clean.split(/(?<=[.!?])\s/)[0];
  return s.length > 170 ? s.slice(0, 167) + "…" : s;
}

// ---------- Decision ----------

export type RuleResult = Classification & { confidence: number };

export function classifyByRules(
  msg: ParsedMessage,
  corrections: Correction[] = [],
  profile: StudentProfile = { regNo: null, batch: null, branchCode: null, branch: null, year: 1 },
  now: number = Date.now(),
): RuleResult {
  const subject = msg.subject.toLowerCase();
  const body = msg.body.slice(0, 6000).toLowerCase();
  const text = `${subject}\n${body}`;
  const inSubject = (k: keyof typeof P) => any(P[k], subject);
  const inText = (k: keyof typeof P) => any(P[k], text);
  const fromVit = /@(vit\.ac\.in|vitstudent\.ac\.in)$/.test(msg.fromAddress);
  const fromGoogle = /@(google\.com|accounts\.google\.com|googlemail\.com)$/.test(msg.fromAddress);

  const actionable = inSubject("exam") || inSubject("registration") || inSubject("interview") || inText("fee");
  const deadline = findDeadline(text, msg.receivedAt, actionable);
  const upcoming = !!deadline && Date.parse(deadline) > now;

  const lead = firstSentence(msg.body);
  const summary = (lead ? `${lead}` : msg.subject || msg.snippet).slice(0, 220);
  const out = (priority: Classification["priority"], category: Category, reason: string, confidence: number): RuleResult => ({
    priority, category, summary, deadline, reason, confidence,
  });

  // 1. Your own corrections for the same sender always win.
  const fix = corrections.find((c) => c.from === msg.fromAddress);
  if (fix) return out(fix.priority, "other", "You moved mail from this sender before", 0.95);

  // A file shared with you personally (Drive, Docs) is about your own work.
  if (SHARED_WITH_YOU.test(subject) && (fromGoogle || /@docs\.google\.com$/.test(msg.fromAddress))) {
    return out("very_important", "other", "Shared with you directly", 0.85);
  }

  // 2. Account security from Google: worth knowing, not urgent.
  if (inSubject("account") && (fromGoogle || fromVit)) return out("priority", "account", "Account security notice", 0.9);

  // 3. Promotions and sales.
  // An outside sender pushing a sale is noise even if it says "enroll by".
  if (inSubject("promotion") && (!actionable || !fromVit)) return out("noise", "promotion", "Promotion or sale", 0.9);

  // 4. Not meant for you (other batches, seniors, PG).
  const notYours = notForYou(text, subject, profile);
  if (notYours && !FOR_FIRST_YEARS.test(text)) return out("later", "other", notYours, 0.75);

  // 5. Achievements and congratulations (checked before competitions: "won first place at X hackathon").
  if (inSubject("achievement")) return out("later", "achievement", "Someone else's achievement", 0.95);

  // 6. Scholarships: eligibility is specific, so keep them out of the way.
  if (inSubject("scholarship")) return out("later", "scholarship", "Scholarship: check if you're eligible", 0.7);

  // Optional minors, honours and open electives: worth a look, not urgent.
  if (OPTIONAL_COURSE.test(subject)) return out("later", "academic", "Optional course or minor", 0.75);

  // 7. Things you must act on.
  if (inSubject("exam")) return out("very_important", "exam", "Exam, quiz or test", 0.85);
  if (inSubject("interview")) return out("very_important", "interview", "Interview or selection round", 0.85);
  // Paid programmes and certificate courses from other institutions: optional, so "later".
  if (PROGRAMME.test(subject) && !/\bffcs\b|\bcourse registration\b|\bvtop\b/.test(subject)) {
    return out("later", "club_event", "Optional programme", 0.75);
  }
  if (inText("fee") && (upcoming || inSubject("fee"))) return out("very_important", "deadline", "Fee payment", 0.85);
  if (inText("attendance") && fromVit) return out("very_important", "academic", "Attendance warning", 0.8);
  if (COLLECT.test(subject) && fromVit) return out("very_important", "academic", "Something to collect", 0.75);

  const isHack = inSubject("hackathon") || (inText("hackathon") && !inSubject("club_event"));
  const isEvent = inSubject("club_event");
  // A contest mentioned only inside an event invitation does not make the mail a contest.
  const isComp = inSubject("competition") || (inText("competition") && inText("registration") && !isEvent);

  // Hackathons and competitions: very important when you can still register.
  if (isHack || isComp) {
    const cat: Category = isHack ? "hackathon" : "competition";
    if (/\binaugura|\bvaledictory\b|\bresults?\b/.test(subject)) return out("later", cat, "Ceremony, not a registration", 0.7);
    if (upcoming || inText("registration")) return out("very_important", cat, "Registration open", 0.75);
    if (deadline && !upcoming) return out("later", cat, "Registration has closed", 0.7);
    return out("priority", cat, `Upcoming ${cat}`, 0.6);
  }

  // Registrations (course registration, FFCS, forms with deadlines).
  if (inSubject("registration") && !isEvent) return out("very_important", "registration", "Registration or application", 0.8);
  if (inSubject("registration") && isEvent) {
    return upcoming
      ? out("priority", "club_event", "Event with open registration", 0.6)
      : out("later", "club_event", "Event", 0.65);
  }
  if (inText("registration") && upcoming && fromVit && !isEvent) {
    return out("very_important", "registration", "Has a registration deadline", 0.65);
  }

  // Official notices.
  if (inSubject("decision")) return out("priority", "decision", "Official decision", 0.75);
  if (inSubject("announcement")) return out("priority", "announcement", "Official announcement", 0.7);
  if (inSubject("academic") && fromVit) {
    return upcoming && /\bsubmi(t|ssion)\b|\bdue\b|\bupload\b/.test(text)
      ? out("very_important", "academic", "Course work due", 0.75)
      : out("priority", "academic", "About your courses", 0.65);
  }

  // Everything else goes to later.
  if (isEvent) return out("later", "club_event", "Event, talk or program", 0.8);
  if (inSubject("placement")) return out("later", "placement", "Placement or internship", 0.7);
  if (inSubject("newsletter")) return out("later", "newsletter", "Newsletter", 0.85);
  if (inText("promotion") && !fromVit) return out("noise", "promotion", "Looks like a promotion", 0.7);
  return fromVit
    ? out("later", "other", "From VIT, no action found", 0.4)
    : out("noise", "other", "Not from VIT, no action found", 0.45);
}
