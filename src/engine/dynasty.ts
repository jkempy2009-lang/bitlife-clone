/**
 * The family across generations.
 *
 *  - Chronicle: every life that ends (or is handed over) is written into `p.dynasty.chronicle` with what it achieved
 *    and a score. The running total is the dynasty's standing.
 *  - Name clout: how strongly the surname carries in politics, business, sport, crime, the arts, royalty and
 *    scholarship. It fades by half each generation unless the next life keeps it alive.
 *  - Family trust: money moved out of your estate for good. It is not taxed at death, cannot be divided by a will
 *    or seized by creditors, and pays a yearly distribution to whoever carries the line.
 *  - Will: how your estate is divided (see estate.ts).
 *  - Grooming: one session a year to raise a child for a family path. It shapes the heir; push too hard and they rebel.
 */
import type { ActionResult, DynastyField, GenerationRecord, HeirGroom, PlayerState, Relative, WillPlan } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, clone, isRoyal, netWorth } from "./state";
import { isInducted, legacyScore, legacyTier } from "./athleteLegacy";
import { reputationOf } from "./generations";
import { hydrateDynasty } from "./dynastyState";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") => ({ kind: "info" as const, title, body, tone });

export const FIELDS: DynastyField[] = ["political", "business", "sport", "crime", "arts", "royal", "academic"];

export const FIELD_INFO: Record<DynastyField, { label: string; emoji: string; known: string }> = {
  political: { label: "Politics", emoji: "🏛️", known: "a political family" },
  business: { label: "Business", emoji: "💼", known: "a business dynasty" },
  sport: { label: "Sport", emoji: "🏅", known: "a sporting family" },
  crime: { label: "Crime", emoji: "🕶️", known: "a family with a reputation" },
  arts: { label: "The arts", emoji: "🎭", known: "an artistic family" },
  royal: { label: "Royalty", emoji: "👑", known: "a royal house" },
  academic: { label: "Scholarship", emoji: "🎓", known: "a family of scholars" },
};

// ---------------------------------------------------------------------------
// What a life amounted to
// ---------------------------------------------------------------------------

const isSovereign = (p: PlayerState) => p.royal?.crown === "self" || p.royalRank === "King" || p.royalRank === "Queen";
const heldOffice = (p: PlayerState) => p.statecraft.highestTier >= 0;

export function describeLife(p: PlayerState): { headline: string; honours: string[] } {
  const honours: string[] = [];
  const nw = Math.max(0, netWorth(p));
  const male = p.gender === "Male";
  let headline = p.stats.highestCareerTitle || "";

  if (isSovereign(p)) {
    headline = male ? "King" : "Queen";
    honours.push(`Reigned as ${headline}${p.court?.regnalName ? ` ${p.court.regnalName}` : ""}`);
  } else if (p.royal?.crown === "abdicated") {
    headline = "Abdicated sovereign";
    honours.push("Gave up the crown");
  } else if (isRoyal(p) || p.royal) {
    headline = p.royal?.hrh ? (male ? "Prince" : "Princess") : headline || "Member of the royal family";
    if (p.royal?.peerage) honours.push(p.royal.peerage);
  }
  const a = p.athlete;
  if (a.sport && a.record.seasons > 0) {
    const score = legacyScore(p);
    const [, tier] = legacyTier(score);
    if (!headline || score >= 30) headline = `${tier} in ${a.sport.toLowerCase()}`;
    if (isInducted(p)) honours.push(`${a.sport} Hall of Fame`);
    if (a.record.titles > 0) honours.push(`${a.record.titles} sporting title${a.record.titles === 1 ? "" : "s"}`);
  }
  if (heldOffice(p)) honours.push(`Held office${p.stats.highestCareerTitle ? ` (${p.stats.highestCareerTitle})` : ""}`);
  if (p.business) honours.push(`Built ${p.business.name}`);
  else if (p.flags.includes("business_owner")) honours.push("Ran a business");
  if (p.music.albums.length > 0) honours.push(`${p.music.albums.length} album${p.music.albums.length === 1 ? "" : "s"}`);
  if (p.acting.credits.length > 0) honours.push(`${p.acting.credits.length} film credit${p.acting.credits.length === 1 ? "" : "s"}`);
  const deg = p.education.degrees.find((d) => ["md", "jd", "phd", "masters"].includes(d));
  if (deg) honours.push(deg === "md" ? "Doctor" : deg === "jd" ? "Lawyer" : deg === "phd" ? "Doctorate" : "Master's degree");
  if (p.stats.yearsInPrison > 0) honours.push(`${p.stats.yearsInPrison} year${p.stats.yearsInPrison === 1 ? "" : "s"} in prison`);
  else if (p.criminalRecord.length > 0) honours.push("A criminal record");
  if (p.stats.kills > 0) honours.push("Blood on their hands");
  if (nw >= 100_000_000) honours.push("Fortune over $100 million");
  else if (nw >= 10_000_000) honours.push("Fortune over $10 million");
  else if (nw >= 1_000_000) honours.push("Millionaire");
  if (p.stats.childrenBorn >= 3) honours.push(`${p.stats.childrenBorn} children`);
  return { headline: headline || (nw > 0 ? "Private citizen" : "A quiet life"), honours: honours.slice(0, 7) };
}

/** What a life added to the family's standing, 0-100. */
export function lifeScore(p: PlayerState): number {
  const nw = Math.max(0, netWorth(p));
  let v = clamp((Math.log10(nw + 1) - 4) * 8, 0, 30);
  v += p.fame * 0.25;
  if (isSovereign(p)) v += 30;
  else if (p.royal?.hrh) v += 8;
  if (p.athlete.sport && p.athlete.record.seasons > 0) v += Math.min(30, legacyScore(p) * 0.3) + (isInducted(p) ? 10 : 0);
  if (heldOffice(p)) v += 8 + Math.min(20, p.statecraft.highestTier * 4);
  if (p.business) v += Math.min(15, Math.log10(Math.max(1, p.business.value)) * 2);
  if (p.music.albums.length > 0) v += Math.min(8, p.music.albums.length * 2);
  if (p.acting.credits.length > 0) v += Math.min(8, p.acting.credits.length * 1.5);
  if (p.education.degrees.some((d) => ["md", "jd", "phd"].includes(d))) v += 5;
  v += Math.min(6, p.stats.childrenBorn);
  v += (reputationOf(p) - 50) * 0.2;
  v -= Math.min(20, p.stats.crimesCommitted * 2 + p.stats.yearsInPrison * 2);
  return clamp(Math.round(v), 0, 100);
}

export const TIERS: [number, string, string][] = [
  [450, "A Great House", "A name that will be read out in history lessons."],
  [300, "A Notable House", "Strangers know the name and what it stands for."],
  [180, "An Established Family", "Three generations of making a mark."],
  [80, "A Rising Family", "The name is starting to mean something."],
  [0, "An Ordinary Family", "Every great house began somewhere."],
];
export const dynastyTier = (score: number) => TIERS.find(([m]) => score >= m) ?? TIERS[TIERS.length - 1];

/** The family's running standing: every finished life, plus the one being lived. */
export const dynastyScore = (p: PlayerState) => hydrateDynasty(p).chronicle.reduce((s, g) => s + g.score, 0) + lifeScore(p);

/** Everything the family holds right now: your net worth and the trust. */
export const familyFortune = (p: PlayerState) => netWorth(p) + (p.dynasty.trust?.balance ?? 0);

// ---------------------------------------------------------------------------
// Handing the family on
// ---------------------------------------------------------------------------

/** How strongly each field marked this one life, 0-100. */
export function cloutFrom(p: PlayerState): Record<DynastyField, number> {
  const crimes = p.stats.crimesCommitted + p.criminalRecord.length * 0.5;
  const biz = Math.max(p.business?.value ?? 0, p.business ? Math.max(0, ...p.business.history.map((h) => h.cash)) : 0);
  const degrees = p.education.degrees.filter((d) => ["masters", "md", "jd", "phd"].includes(d)).length;
  return {
    political: heldOffice(p) ? clamp(20 + p.statecraft.highestTier * 14 + p.politics.popularity * 0.2) : p.politics.yearsInOffice > 0 ? clamp(p.politics.popularity * 0.3, 0, 40) : 0,
    business: biz > 0 ? clamp((Math.log10(biz + 1) - 4.5) * 45) : p.flags.includes("business_owner") ? 15 : 0,
    sport: p.athlete.sport && p.athlete.record.seasons > 0 ? clamp(legacyScore(p) * 0.6) : 0,
    crime: clamp(crimes * 6 + p.stats.yearsInPrison * 5 + (p.stats.kills > 0 || p.flags.includes("killer") ? 30 : 0) + (p.flags.includes("made_man") ? 25 : 0)),
    arts: clamp(p.music.albums.length * 10 + p.acting.credits.length * 8 + (p.music.albums.length + p.acting.credits.length > 0 ? p.fame * 0.3 : 0)),
    royal: isSovereign(p) ? 100 : p.royal?.hrh ? 70 : p.royal ? 40 : 0,
    academic: clamp(degrees * 22 + (p.smarts >= 85 ? 12 : 0) + (p.education.degrees.some((d) => ["md", "jd", "phd"].includes(d)) ? 15 : 0)),
  };
}

/** Name clout for the next generation: half carries over, half is what this life added. */
export function nextClout(old: PlayerState): Partial<Record<DynastyField, number>> {
  const prev = hydrateDynasty(old).clout;
  const now = cloutFrom(old);
  const out: Partial<Record<DynastyField, number>> = {};
  for (const f of FIELDS) {
    const v = Math.round(Math.max(now[f], (prev[f] ?? 0) * 0.5 + now[f] * 0.5));
    // Fading: what was inherited loses half again if this life did nothing with it.
    const faded = now[f] === 0 ? Math.round((prev[f] ?? 0) * 0.45) : v;
    if (faded >= 5) out[f] = clamp(faded);
  }
  return out;
}

export function recordGeneration(old: PlayerState, living: boolean, epitaphText: string): GenerationRecord {
  const { headline, honours } = describeLife(old);
  return {
    generation: old.generation,
    name: `${old.firstName} ${old.lastName}`,
    gender: old.gender,
    born: old.birthYear,
    died: living ? null : old.deathYear ?? old.year,
    age: old.age,
    headline,
    honours,
    netWorth: netWorth(old),
    fame: Math.round(old.fame),
    children: old.stats.childrenBorn,
    reputation: reputationOf(old),
    score: lifeScore(old),
    epitaph: epitaphText,
    handedOver: living,
  };
}

/** Does the groomed path match what the family is known for, so the child starts with a head start. */
function applyGroom(next: PlayerState, g: HeirGroom, name: string, rng: Rng) {
  const f = g.level / 100;
  const first = name.split(" ")[0];
  switch (g.track) {
    case "business":
      next.talents.business = clamp(next.talents.business + Math.round(f * 14));
      next.smarts = clamp(next.smarts + Math.round(f * 4));
      break;
    case "political":
      next.skills.charisma = clamp(next.skills.charisma + Math.round(f * 18));
      next.talents.speaking = clamp(next.talents.speaking + Math.round(f * 12));
      next.statecraft.machine = Math.max(next.statecraft.machine, Math.round(f * 25));
      break;
    case "sport":
      next.skills.athletics = clamp(next.skills.athletics + Math.round(f * 25));
      next.health = clamp(next.health + Math.round(f * 4));
      break;
    case "arts":
      next.skills.music = clamp(next.skills.music + Math.round(f * 12));
      next.skills.acting = clamp(next.skills.acting + Math.round(f * 12));
      break;
    case "academic":
      next.smarts = clamp(next.smarts + Math.round(f * 8));
      break;
    case "crime":
      next.karma = clamp(next.karma - Math.round(f * 10));
      next.skills.charisma = clamp(next.skills.charisma + Math.round(f * 6));
      next.talents.cunning = clamp(next.talents.cunning + Math.round(f * 12));
      break;
    case "royal":
      break;
  }
  if (g.level >= 30) {
    next.dynasty.clout[g.track] = clamp(Math.max(next.dynasty.clout[g.track] ?? 0, Math.round(g.level * 0.6)));
    if (!next.flags.includes(`groomed_${g.track}`)) next.flags.push(`groomed_${g.track}`);
    addLog(next, `${first} spent years being raised for ${FIELD_INFO[g.track].label.toLowerCase()} (${g.level >= 70 ? "thoroughly" : "partly"} prepared).`);
  }
  void rng;
}

/** The heir's dynasty: chronicle, clout, trust, and what the family name does for them. Mutates `next`. */
export function inheritDynasty(next: PlayerState, old: PlayerState, child: Relative, living: boolean, epitaphText: string, rng: Rng) {
  const d = hydrateDynasty(old);
  const rec = recordGeneration(old, living, epitaphText);
  const clout = nextClout(old);
  const trust = d.trust ? { ...d.trust } : null;
  const fortune = netWorth(old) + (trust?.balance ?? 0);
  let sportLegacy = d.sportLegacy;
  if (old.athlete.sport && old.athlete.record.seasons >= 2 && legacyScore(old) >= 20) {
    const club = old.athlete.history.length ? old.athlete.history[old.athlete.history.length - 1].club : old.athlete.club;
    sportLegacy = { sport: old.athlete.sport, club: club || old.athlete.club, tier: legacyTier(legacyScore(old))[1], score: legacyScore(old), parent: `${old.firstName} ${old.lastName}` };
  } else if (sportLegacy && (clout.sport ?? 0) >= 15) sportLegacy = { ...sportLegacy, score: Math.round(sportLegacy.score * 0.6) };
  else sportLegacy = undefined;
  next.dynasty = {
    name: d.name,
    founded: d.founded,
    chronicle: [...d.chronicle, rec],
    clout,
    trust,
    will: { plan: "equal", chosenId: null },
    peakFortune: Math.max(d.peakFortune, fortune),
    ...(sportLegacy ? { sportLegacy } : {}),
  };

  // What the name does for an heir, immediately.
  const c = (f: DynastyField) => clout[f] ?? 0;
  if (c("political") >= 25) {
    next.statecraft.machine = Math.max(next.statecraft.machine, Math.round(c("political") * 0.45));
    next.politics.popularity = clamp(next.politics.popularity + Math.round(c("political") * 0.2));
    next.flags.push("clout_political");
  }
  if (c("business") >= 25) {
    next.creditScore = Math.min(850, next.creditScore + Math.round(c("business") * 0.5));
    next.flags.push("clout_business");
  }
  if (c("sport") >= 20) next.flags.push("clout_sport");
  if (c("crime") >= 25) {
    next.justice.heat = clamp(next.justice.heat + Math.round(c("crime") * 0.2));
    next.flags.push("clout_crime");
  }
  if (c("arts") >= 25) next.flags.push("clout_arts");
  if (c("academic") >= 25) {
    next.smarts = clamp(next.smarts + 2);
    next.flags.push("clout_academic");
  }
  if (c("royal") >= 40) next.flags.push("clout_royal");
  if (child.groom) applyGroom(next, child.groom, child.name, rng);

  const total = next.dynasty.chronicle.reduce((sum, g) => sum + g.score, 0); // the heir has not lived yet
  const [, tierName] = dynastyTier(total);
  const strong = FIELDS.filter((f) => c(f) >= 40).sort((a, b) => c(b) - c(a));
  addLog(next, `The ${d.name} family, generation ${next.generation}: ${tierName.toLowerCase()} (standing ${total}).${strong.length ? ` The name carries weight in ${strong.slice(0, 2).map((f) => FIELD_INFO[f].label.toLowerCase()).join(" and ")}.` : ""}`);
  if (trust && trust.balance > 0) addLog(next, `The family trust holds ${money(trust.balance)} and pays a distribution each year.`);
}

// ---------------------------------------------------------------------------
// Family trust and will
// ---------------------------------------------------------------------------

export const TRUST_MIN_AGE = 18;
export const TRUST_MIN_GIFT = 10_000;
/** Yearly distribution as a share of the trust. */
export const TRUST_PAYOUT = 0.04;

export function trustBlocker(p: PlayerState): string | null {
  if (!p.alive) return "Your story has ended.";
  if (p.age < TRUST_MIN_AGE) return "You must be 18 to settle a trust.";
  if (p.isInPrison) return "Trustees won't take instructions from a cell.";
  return null;
}

/** Moves cash into the family trust for good. Nothing comes back out except the yearly distribution. */
export function fundTrust(p0: PlayerState, amount: number): ActionResult {
  const why = trustBlocker(p0);
  if (why) return { player: p0, notices: [info("Not Possible", why, "bad")] };
  const gift = Math.floor(amount);
  if (gift < TRUST_MIN_GIFT) return { player: p0, notices: [info("Too Small", `The trustees want at least ${money(TRUST_MIN_GIFT)} to open a trust.`)] };
  if (gift > p0.bankBalance) return { player: p0, notices: [info("Insufficient Funds", `You only have ${money(p0.bankBalance)} in cash.`, "bad")] };
  const p = clone(p0);
  p.bankBalance -= gift;
  const t = p.dynasty.trust ?? { balance: 0, founded: p.year, paid: 0 };
  t.balance += gift;
  p.dynasty.trust = t;
  const body = `You settled ${money(gift)} on the family trust, now ${money(t.balance)}. It cannot be taxed at death, divided by a will or seized by creditors, and it pays the family ${Math.round(TRUST_PAYOUT * 100)}% a year. You cannot take it back.`;
  addLog(p, body);
  return { player: p, notices: [info("Family Trust", body, "good")] };
}

export function setWill(p0: PlayerState, plan: WillPlan, chosenId: string | null): ActionResult {
  const p = clone(p0);
  p.dynasty.will = { plan, chosenId: plan === "chosen" ? chosenId : null };
  return { player: p };
}

/** Yearly: the trust earns and pays out; grooming pressure eases. */
export function processDynasty(p: PlayerState, rng: Rng, notices: Notices) {
  const t = p.dynasty?.trust;
  if (t && t.balance > 0) {
    const payout = p.age >= TRUST_MIN_AGE ? Math.round(t.balance * TRUST_PAYOUT) : 0;
    t.balance -= payout;
    t.balance = Math.round(t.balance * (1.05 + rng.float(-0.035, 0.045)));
    if (payout > 0) {
      p.bankBalance += payout;
      t.paid += payout;
      addLog(p, `The family trust paid you ${money(payout)}.`);
      if (rng.chance(0.15)) notices.push(info("Trust Distribution", `The trustees sent ${money(payout)}. The trust stands at ${money(t.balance)}.`, "good"));
    }
  }
  for (const r of p.relatives) {
    if (r.groom && r.groom.lastYear < p.year) r.groom.pressure = Math.max(0, r.groom.pressure - 8);
  }
}

// ---------------------------------------------------------------------------
// Grooming an heir
// ---------------------------------------------------------------------------

export const GROOM_TRACKS: DynastyField[] = ["business", "political", "sport", "arts", "academic", "crime"];
export const GROOM_MIN_AGE = 6;
export const GROOM_MAX_AGE = 22;

export const GROOM_COST: Record<DynastyField, number> = { business: 2_500, political: 2_000, sport: 3_000, arts: 2_000, academic: 1_500, crime: 0, royal: 0 };

export const GROOM_BLURB: Record<DynastyField, string> = {
  business: "Sit in on the meetings, learn the ledgers.",
  political: "Dinners, handshakes and the campaign trail.",
  sport: "Early mornings, proper coaching, the family sport.",
  arts: "Lessons, rehearsals and a house full of instruments.",
  academic: "Private tuition and a library card for life.",
  crime: "Learn who to know and what not to say.",
  royal: "",
};

/** Why this parent cannot raise a child for this path (null = fine). */
export function groomPathBlocker(p: PlayerState, track: DynastyField): string | null {
  if (track === "business") return p.business || p.flags.includes("business_owner") || (p.dynasty.clout.business ?? 0) >= 25 ? null : "You'd need a business of your own, or a family one, to teach from.";
  if (track === "political") return heldOffice(p) || p.politics.yearsInOffice > 0 || (p.dynasty.clout.political ?? 0) >= 25 ? null : "You'd need a political career, or a political name, to open doors.";
  if (track === "sport") return p.athlete.sport || (p.dynasty.clout.sport ?? 0) >= 20 || p.skills.athletics >= 50 ? null : "You'd need a sporting background to coach from.";
  if (track === "arts") return p.skills.music >= 20 || p.skills.acting >= 20 || p.music.albums.length > 0 || (p.dynasty.clout.arts ?? 0) >= 25 ? null : "You'd need artistic skill, or a family of artists, to teach from.";
  if (track === "crime") return p.flags.includes("made_man") || p.criminalRecord.length >= 2 || (p.dynasty.clout.crime ?? 0) >= 25 ? null : "You'd need real underworld connections to teach from.";
  return null;
}

export function groomBlocker(p: PlayerState, kid: Relative, track: DynastyField): string | null {
  if (kid.relation !== "Child" || !kid.alive) return "Only your living children can be groomed.";
  if (kid.age < GROOM_MIN_AGE) return "Too young: let them be a child a few more years.";
  if (kid.age > GROOM_MAX_AGE) return "They are grown now, and choose their own path.";
  if (p.isInPrison) return "Hard to do from a cell.";
  if ((p.annual.groom ?? 0) >= 1) return "You've already given one child this year's attention.";
  if (p.bankBalance < GROOM_COST[track]) return `This costs ${money(GROOM_COST[track])} a year.`;
  return groomPathBlocker(p, track);
}

/** One session of grooming. Switching path throws away most of the progress; pushing too hard risks a rebellion. */
export function groomChild(p0: PlayerState, rng: Rng, kidId: string, track: DynastyField): ActionResult {
  const kid0 = p0.relatives.find((r) => r.id === kidId);
  if (!kid0) return { player: p0 };
  const why = groomBlocker(p0, kid0, track);
  if (why) return { player: p0, notices: [info("Can't Do That", why, "bad")] };
  const p = clone(p0);
  const kid = p.relatives.find((r) => r.id === kidId)!;
  const first = kid.name.split(" ")[0];
  p.bankBalance -= GROOM_COST[track];
  p.annual.groom = 1;
  const prev = kid.groom;
  const g: HeirGroom = prev ? { ...prev } : { track, level: 0, pressure: 0, lastYear: p.year };
  let switched = false;
  if (g.track !== track) {
    g.level = Math.floor(g.level * 0.4);
    g.track = track;
    switched = true;
  }
  const willing = (kid.traits ?? []).includes("Ambitious") ? 6 : (kid.traits ?? []).includes("Reserved") || (kid.traits ?? []).includes("Wild") ? -6 : 0;
  g.level = clamp(g.level + rng.int(10, 18) + (kid.interest && interestMatches(kid.interest, track) ? 6 : 0) + (willing > 0 ? 3 : 0));
  g.pressure = clamp(g.pressure + 14 - willing - (kid.relationshipBar >= 70 ? 4 : 0) + (switched ? 6 : 0));
  g.lastYear = p.year;
  kid.relationshipBar = clamp(kid.relationshipBar + (willing >= 0 ? 3 : -2));
  let body = `You gave ${first} a year of your attention for ${FIELD_INFO[track].label.toLowerCase()}. ${first} is ${g.level >= 70 ? "well prepared" : g.level >= 40 ? "coming along" : "just starting"} (${g.level}/100).`;
  let tone: "good" | "bad" | "neutral" = "good";
  if (g.pressure >= 60 && rng.chance(0.45)) {
    kid.groom = undefined;
    kid.relationshipBar = clamp(kid.relationshipBar - 25);
    kid.trouble = (kid.trouble ?? 0) + 1;
    body = `${first} has had enough of being raised for ${FIELD_INFO[track].label.toLowerCase()}. There was a scene at dinner, a slammed door and a very quiet week. You pushed too hard, and ${first} wants nothing to do with the family path now.`;
    tone = "bad";
    addLog(p, body);
    return { player: p, notices: [info("They Pushed Back", body, tone)] };
  }
  if (g.pressure >= 45) body += ` They are starting to resent the pressure (${g.pressure}/100).`;
  kid.groom = g;
  if (!kid.interest || kid.interest === "none") kid.interest = interestFor(track);
  addLog(p, body);
  return { player: p, notices: [info("Raising an Heir", body, tone)] };
}

const interestMatches = (i: NonNullable<Relative["interest"]>, track: DynastyField) =>
  (i === "sport" && track === "sport") || ((i === "music" || i === "art") && track === "arts") || (i === "science" && track === "academic");

function interestFor(track: DynastyField): Relative["interest"] | undefined {
  return track === "sport" ? "sport" : track === "arts" ? "music" : track === "academic" ? "science" : undefined;
}

/** A short line for the UI: how the family name is regarded in a field. */
export function cloutWord(v: number): string {
  if (v >= 75) return "legendary";
  if (v >= 50) return "famous";
  if (v >= 30) return "well known";
  return "a whisper";
}

/** Changes player's fame/flags in a small way when a field's name opens a door; used by events. */
export function nameOpensDoor(p: PlayerState, field: DynastyField): boolean {
  return (p.dynasty?.clout[field] ?? 0) >= 30;
}


/**
 * An heir who takes up the sport the family is known for starts with the family name: scouts know it, comparisons
 * follow. Called when committing to a sport. Returns a sentence for the log, or null if the name doesn't apply.
 */
export function applyFamilySport(p: PlayerState, sport: string): string | null {
  const legacy = p.dynasty?.sportLegacy;
  if (!legacy || legacy.sport !== sport || (p.dynasty.clout.sport ?? 0) < 15) return null;
  const a = p.athlete;
  a.exposure = clamp(a.exposure + Math.min(25, 8 + Math.round(legacy.score / 8)));
  a.image = clamp(a.image + 4);
  a.mental = clamp(a.mental - 5);
  if (!p.flags.includes("athlete_legacy_active")) p.flags.push("athlete_legacy_active");
  return `${legacy.parent}'s name as a ${legacy.tier.toLowerCase()} opens doors at ${legacy.club}: scouts already know the surname. So do the comparisons.`;
}
