/**
 * Royal family life: marriages (the spouse's style, the wedding's effect on popularity), divorce fallout,
 * and raising children as the next generation of royals. Training carries across generations: a child who
 * inherits starts with the popularity, polish and patronages they were raised to have.
 */
import type { ActionResult, PlayerState, Relative, RoyalTraining, ServiceBranch } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { BRANCHES, PATRONAGE_BY_ID, TRAINING_SCHOOLS } from "@/data/court";
import { addLog, changeStat, clone, isRoyal } from "./state";
import { defaultTraining, isSovereign, trainingOf } from "./courtState";
import { addApproval, addHeat, book, info, slotsLeft, type Notices } from "./court";

const male = (g: string) => g === "Male";

/** The style a spouse takes on marriage into the royal family, if any (British rules: a wife takes her husband's rank; a husband of a princess takes none). */
export function spouseTitleFor(p: PlayerState, spouse: Relative): string | undefined {
  if (isSovereign(p)) return male(spouse.gender) ? "Prince Consort" : "Queen Consort";
  if (p.royal?.hrh && male(p.gender) && !male(spouse.gender)) return "Princess";
  if (p.royal?.peerage && male(p.gender) && !male(spouse.gender)) return "Lady";
  return undefined;
}

/** Called by events that marry the player into a royal match. */
export function styleSpouse(p: PlayerState) {
  const spouse = p.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus === "married");
  if (!spouse) return;
  const t = spouseTitleFor(p, spouse);
  if (t) spouse.royalTitle = t;
}

/** Marriage and divorce: effects on popularity, titles and money. Safe to run every year. */
function processMarriages(p: PlayerState, rng: Rng, notices: Notices) {
  for (const r of p.relatives) {
    if (r.relation !== "Partner") continue;
    const flagWed = `royal_wed:${r.id}`;
    const flagDiv = `royal_div:${r.id}`;
    if (r.alive && r.partnerStatus === "married" && !p.flags.includes(flagWed)) {
      p.flags.push(flagWed);
      const t = spouseTitleFor(p, r);
      if (t && !r.royalTitle) r.royalTitle = t;
      const commoner = r.incomeTier <= 3;
      addApproval(p, commoner ? 6 : 3);
      addHeat(p, 10);
      const body = `${r.name} married into the royal family${t ? ` and is now styled ${t}` : ""}. ${commoner ? "The public warmed to the 'commoner' bride or groom." : "A grand, traditional match."}`;
      addLog(p, body);
      notices.push(info("Royal Wedding", body, "good"));
    }
    if (r.partnerStatus === "ex" && p.flags.includes(flagWed) && !p.flags.includes(flagDiv)) {
      p.flags.push(flagDiv);
      const hadTitle = r.royalTitle;
      r.royalTitle = undefined;
      const popular = r.relationshipBar >= 50;
      addApproval(p, popular ? -5 : -3);
      addHeat(p, 15);
      if (isSovereign(p)) changeStat(p, "royalRespect", -5);
      const settlement = Math.round(Math.min(Math.max(0, p.bankBalance) * 0.2, 3_000_000));
      p.bankBalance -= settlement;
      const body = `The divorce from ${r.name} was finalised.${hadTitle ? ` They no longer use the style ${hadTitle}.` : ""} ${settlement > 0 ? `The settlement cost ${money(settlement)}. ` : ""}${popular ? "Public sympathy lay with them." : "The papers picked over every detail."}`;
      addLog(p, body);
      notices.push(info("Royal Divorce", body, "bad"));
    }
  }
}

export function royalChildren(p: PlayerState): Relative[] {
  return p.relatives.filter((r) => r.relation === "Child" && r.alive && !!r.royalTitle && r.age < 30);
}

function processChildren(p: PlayerState, rng: Rng, notices: Notices) {
  void notices;
  for (const k of royalChildren(p)) {
    if (k.age < 4) continue;
    const t = (k.royalTraining ??= defaultTraining());
    const school = TRAINING_SCHOOLS[t.school];
    if (k.age >= 4 && k.age < 18 && school.cost) p.bankBalance -= school.cost;
    if (t.school === "boarding" && k.age >= 8 && k.age < 18) { t.duty = clamp(t.duty + 2); t.polish = clamp(t.polish + 2); t.touch = clamp(t.touch - 1); }
    else if (t.school === "state" && k.age < 18) { t.touch = clamp(t.touch + 2); t.polish = clamp(t.polish - 1); }
    else if (k.age < 18) t.polish = clamp(t.polish + 1);
    if (t.school === "state") addHeat(p, 1);
    // An unprepared teenager in the public eye is a gamble.
    if (k.age >= 15 && k.age <= 24 && !p.queuedEvents.includes("crown_heir_trouble")) {
      const prep = (t.duty + t.polish) / 200;
      if (rng.chance(0.08 * (1.4 - prep))) p.queuedEvents.push("crown_heir_trouble");
    }
  }
}

export function processRoyalFamily(p: PlayerState, rng: Rng, notices: Notices) {
  if (!isRoyal(p)) return;
  processMarriages(p, rng, notices);
  processChildren(p, rng, notices);
}

// ---------------------------------------------------------------------------
// Bringing up an heir
// ---------------------------------------------------------------------------

export type TrainingKind = "engagement" | "ordinary" | "media" | "service" | "patron";

export function setSchool(p0: PlayerState, childId: string, school: RoyalTraining["school"]): ActionResult {
  const kid = p0.relatives.find((r) => r.id === childId);
  if (!kid || kid.relation !== "Child" || !kid.royalTitle) return { player: p0 };
  if (kid.age >= 18) return { player: p0, notices: [info("Not possible", "They are grown up now.", "bad")] };
  const p = clone(p0);
  const k = p.relatives.find((r) => r.id === childId)!;
  const t = (k.royalTraining ??= defaultTraining());
  if (t.school === school) return { player: p0 };
  t.school = school;
  if (school === "boarding" && k.age >= 8) k.relationshipBar = clamp(k.relationshipBar - 6);
  const body = `${k.name.split(" ")[0]} now has ${TRAINING_SCHOOLS[school].label.toLowerCase()}. ${TRAINING_SCHOOLS[school].blurb}`;
  addLog(p, body);
  return { player: p, notices: [info("Schooling", body, "neutral")] };
}

export function trainingBlocker(p: PlayerState, childId: string, kind: TrainingKind, arg?: string): string | null {
  const kid = p.relatives.find((r) => r.id === childId);
  if (!kid || !kid.alive || kid.relation !== "Child" || !kid.royalTitle) return "No such royal child.";
  if (p.court.booked[`train:${childId}`]) return "You've already spent time with them this year.";
  if (kind === "engagement") {
    if (kid.age < 6) return "Too young to come along.";
    if (slotsLeft(p) < 1) return "Your diary is full: no day left to take them along.";
  }
  if (kind === "media" && (kid.age < 8 || p.bankBalance < 15_000)) return kid.age < 8 ? "Too young for media training." : "Media training costs $15,000.";
  if (kind === "patron") {
    if (kid.age < 16) return "Too young to take a patronage.";
    if (!arg || !PATRONAGE_BY_ID[arg]) return "Pick a cause.";
  }
  if (kind === "service" && (kid.age < 18 || kid.age > 24)) return "Officer training is for 18 to 24.";
  return null;
}

export function trainChild(p0: PlayerState, rng: Rng, childId: string, kind: TrainingKind, arg?: string): ActionResult {
  const why = trainingBlocker(p0, childId, kind, arg);
  if (why) return { player: p0, notices: [info("Not possible", why, "bad")] };
  const p = clone(p0);
  const kid = p.relatives.find((r) => r.id === childId)!;
  const name = kid.name.split(" ")[0];
  const t = (kid.royalTraining ??= defaultTraining());
  p.court.booked[`train:${childId}`] = 1;
  let body = "";
  switch (kind) {
    case "engagement":
      book(p, `train-engagement:${childId}`, 1);
      t.duty = clamp(t.duty + 6);
      t.touch = clamp(t.touch + 2);
      kid.relationshipBar = clamp(kid.relationshipBar + 5);
      body = `You took ${name} along to an engagement. They watched you work the room and asked sensible questions on the way home.`;
      break;
    case "ordinary":
      t.touch = clamp(t.touch + 7);
      t.polish = clamp(t.polish - 1);
      kid.relationshipBar = clamp(kid.relationshipBar + 6);
      body = `${name} had a thoroughly ordinary week: a swimming pool, fish and chips, a queue. They loved every minute.`;
      if (rng.chance(0.15)) { addHeat(p, 5); body += " A fan's phone caught a photograph, and the papers called it charming."; addApproval(p, 1); }
      break;
    case "media":
      p.bankBalance -= 15_000;
      t.polish = clamp(t.polish + 8);
      kid.relationshipBar = clamp(kid.relationshipBar - 3);
      body = `${name} spent the summer on etiquette and media training. They are poised now, and slightly less fun.`;
      break;
    case "service":
      t.service = (arg as ServiceBranch) in BRANCHES ? (arg as ServiceBranch) : "army";
      t.duty = clamp(t.duty + 10);
      body = `You encouraged ${name} to take a commission in the ${BRANCHES[t.service].name}. They will begin when they come of age.`;
      break;
    case "patron":
      t.patron = arg;
      t.duty = clamp(t.duty + 5);
      body = `${name} has taken up the ${PATRONAGE_BY_ID[arg!].name} as their first patronage.`;
      break;
  }
  addLog(p, body);
  return { player: p, notices: [info("Raising an Heir", body, "good")] };
}

export { trainingOf };
