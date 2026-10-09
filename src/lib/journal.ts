/** Turns the flat life log ("## Age 12 · 2038" headers followed by lines) into something searchable and filterable. */

export type JournalFilter = "all" | "milestones" | "money" | "people" | "health";

export interface JournalEntry {
  text: string;
  milestone: boolean;
  tags: Exclude<JournalFilter, "all" | "milestones">[];
}

export interface JournalYear {
  header: string;
  entries: JournalEntry[];
}

const MILESTONE =
  /🏆|you were born|was born into|you started (school|high school)|you graduated|you are now an adult|you are now (dating|married|engaged)|\bmarried\b|\bdivorce|\bproposed\b|engaged to|got hired|you were hired|new job|promoted|you retired|retire[sd]?\b|passed away|you died|was diagnosed|you were diagnosed|arrested|convicted|sentenced|released from|elected|inherit|you moved|emigrat|you bought|you sold|founded|you started a (business|company)|won the|crowned|coronat|abdicat|first word|driver'?s licence|you were fired|you lost your job/i;
const MONEY = /^finances:|\$\s?[\d,]{3,}|\bsalary\b|\bloan\b|\bmortgage\b|\binherit|\bbankrupt|\bbought\b|\bsold\b|\btaxes?\b/i;
const PEOPLE = /\bfriend\b|\bdating\b|\bpartner\b|\bmarried\b|\bdivorc|\bchild\b|\bbaby\b|\bsibling\b|\bparent\b|\bgrandparent\b|passed away|\bwedding\b|\bbreak ?up\b|\bbreakup\b|\bborn into your family\b/i;
const HEALTH = /\bdiagnosed\b|\brecovered\b|\bsurgery\b|\bdoctor\b|\bdisease\b|\billness\b|\brehab\b|\bhospital\b|\btherapy\b|\baddict/i;

export function classify(text: string): JournalEntry {
  const tags: JournalEntry["tags"] = [];
  if (MONEY.test(text)) tags.push("money");
  if (PEOPLE.test(text)) tags.push("people");
  if (HEALTH.test(text)) tags.push("health");
  // Yearly finance summaries and market news are context, not milestones.
  const milestone = !/^finances:|^📰/i.test(text) && MILESTONE.test(text);
  return { text, milestone, tags };
}

/** Newest year first. Lines before the first header are kept under "Prologue". */
export function groupJournal(log: string[]): JournalYear[] {
  const years: JournalYear[] = [];
  for (const line of log) {
    if (line.startsWith("## ")) years.push({ header: line.slice(3), entries: [] });
    else {
      if (years.length === 0) years.push({ header: "Prologue", entries: [] });
      years[years.length - 1].entries.push(classify(line));
    }
  }
  return years.reverse();
}

export function filterJournal(years: JournalYear[], query: string, filter: JournalFilter): JournalYear[] {
  const q = query.trim().toLowerCase();
  if (!q && filter === "all") return years;
  const out: JournalYear[] = [];
  for (const y of years) {
    const headerHit = q.length > 0 && y.header.toLowerCase().includes(q);
    const entries = y.entries.filter((e) => {
      const byFilter = filter === "all" || (filter === "milestones" ? e.milestone : e.tags.includes(filter));
      if (!byFilter) return false;
      return !q || headerHit || e.text.toLowerCase().includes(q);
    });
    if (entries.length > 0) out.push({ header: y.header, entries });
  }
  return out;
}

export const countEntries = (years: JournalYear[]) => years.reduce((n, y) => n + y.entries.length, 0);
