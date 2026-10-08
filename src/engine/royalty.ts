/**
 * Royal succession and titles, modelled on the British system (absolute primogeniture).
 *  - The sovereign's children and the children of the sovereign's children are Princes/Princesses (HRH).
 *  - When a sibling is crowned instead of you, you stay a Prince/Princess and are given a dukedom.
 *  - Your own children are only HRH if they're grandchildren of the *reigning* sovereign. If your sibling reigns,
 *    they are the monarch's nephews and nieces: no HRH, but they keep a courtesy title (Lord/Lady) and may inherit a dukedom.
 */
import type { ActionResult, PlayerState, Relative, RoyalLife } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { getCountry } from "@/data/countries";
import { addLog, changeStat, makeRelativeBase, randomName, royalRankFor } from "./state";
import { beginMourning, beginReign } from "./courtState";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

const isSovereignTitle = (t?: string) => t === "King" || t === "Queen";
const male = (g: string) => g === "Male";

export const sovereignOf = (p: PlayerState): Relative | undefined =>
  p.relatives.find((r) => r.alive && isSovereignTitle(r.royalTitle));

/** Place name for a new dukedom, from the player's country. */
function dukedomFor(p: PlayerState, gender: string, rng: Rng, taken: string[]): string {
  const cities = getCountry(p.birthCountry).cities.filter((c) => !taken.some((t) => t.endsWith(c)));
  const place = cities.length ? rng.pick(cities) : "Windermere";
  return `${male(gender) ? "Duke" : "Duchess"} of ${place}`;
}

/** The style a baby born to this player receives at birth. */
export function royalStyleForChild(p: PlayerState, gender: string): string | undefined {
  const r = p.royal;
  if (!r) return undefined;
  // Children of a sovereign, and grandchildren of the reigning sovereign, are Princes and Princesses.
  if (r.crown === "self" || r.crown === "parent") return male(gender) ? "Prince" : "Princess";
  // Otherwise they're the monarch's nephews, nieces or cousins: courtesy styles only, and only if you hold a title.
  if (r.peerage) return male(gender) ? "Lord" : "Lady";
  return undefined;
}

/** What to call someone, e.g. "HRH Prince · Duke of Kent". */
export function royalStyleText(p: PlayerState): string {
  const r = p.royal;
  if (!r) return "";
  if (r.crown === "self") return `${male(p.gender) ? "King" : "Queen"}${p.court?.regnalName ? ` ${p.court.regnalName}` : ""}`;
  const base = r.hrh ? `HRH ${male(p.gender) ? "Prince" : "Princess"}` : r.peerage ? (male(p.gender) ? "Lord" : "Lady") : "";
  const heir = r.line === 1 && r.hrh ? (male(p.gender) ? "Crown Prince" : "Crown Princess") : base;
  return [heir, r.peerage].filter(Boolean).join(" · ");
}

/** Initial royal state for someone born into the monarchy as the eldest ("heir") or a younger child. */
export function newRoyalLife(olderSiblings: number): RoyalLife {
  return { crown: "parent", hrh: true, peerage: null, line: olderSiblings + 1 };
}

/** Grants a dukedom when a sibling takes the throne. */
function grantDukedom(p: PlayerState, rng: Rng) {
  if (!p.royal || p.royal.peerage) return;
  p.royal.peerage = dukedomFor(p, p.gender, rng, p.relatives.map((r) => r.royalTitle ?? ""));
}


// ---------------------------------------------------------------------------
// Line of succession (absolute primogeniture)
// ---------------------------------------------------------------------------

/** Age as of `year`, including relatives who have died (their stored age stops at death). */
const ageIn = (r: Relative, year: number) => (r.alive ? r.age : r.age + Math.max(0, year - (r.deathYear ?? year)));

/**
 * A sovereign's children in birth order, each followed by their own children (eldest first) before the next child.
 * So an elder sibling's baby stands in front of every younger sibling, and still does if the elder sibling has died.
 */
export function successionOrder(children: Relative[], grandkids: Relative[], year: number): Relative[] {
  const out: Relative[] = [];
  for (const c of [...children].sort((a, b) => ageIn(b, year) - ageIn(a, year))) {
    out.push(c, ...grandkids.filter((g) => g.parentId === c.id).sort((a, b) => ageIn(b, year) - ageIn(a, year)));
  }
  return out;
}

/** How many living people stand ahead of `child` in a sovereign's family (older siblings and their children). */
export function claimantsAhead(children: Relative[], grandkids: Relative[], childId: string, year: number): number {
  const order = successionOrder(children, grandkids, year);
  const i = order.findIndex((r) => r.id === childId);
  return order.slice(0, i < 0 ? order.length : i).filter((r) => r.alive).length;
}

/** The player's own place among the sovereign's children: living older siblings plus their children, wherever the crown sits. */
export function claimantsAheadOfMe(p: PlayerState): number {
  const sibs = p.relatives.filter((s) => s.relation === "Sibling" && s.royalTitle);
  const kids = p.relatives.filter((r) => r.relation === "Nephew" && r.parentId);
  const me: Relative = { id: "__me", relation: "Sibling", name: p.firstName, age: p.age, relationshipBar: 0, health: 0, alive: true, incomeTier: 0, gender: p.gender, smarts: 0, looks: 0 };
  return claimantsAhead([me, ...sibs], kids, "__me", p.year);
}


/** Royal ancestors (your parent, and above) who stand between you and the throne, living or dead. */
export const royalChain = (p: PlayerState): Relative[] =>
  p.relatives.filter((r) => (r.relation === "Parent" || r.relation === "Grandparent") && r.royalLine !== undefined && !isSovereignTitle(r.royalTitle));

/**
 * Recomputes your place in line from the people who are really there: royal ancestors still alive, your older
 * siblings and their children. Only for people whose ancestors are tracked (e.g. after a parent handed you their life).
 */
export function syncLine(p: PlayerState) {
  const r = p.royal;
  if (!r || (r.crown !== "grandparent" && r.crown !== "parent")) return;
  const chain = royalChain(p);
  if (chain.length === 0) {
    if (r.crown === "parent") r.line = 1 + claimantsAheadOfMe(p); // your parent reigns: only older siblings and their children are ahead
    return;
  }
  const base = Math.min(...chain.map((c) => c.royalLine!)) - 1; // people ahead of the topmost tracked ancestor
  r.line = base + 1 + chain.filter((c) => c.alive).length + claimantsAheadOfMe(p);
}

/** The sovereign has died and one of your tracked ancestors is next in line (or an untracked relative is). Returns true if handled. */
function crownFromChain(p: PlayerState, rng: Rng, notices: Notices): boolean {
  const r = p.royal!;
  const chain = royalChain(p);
  if (chain.length === 0) return false;
  const base = Math.min(...chain.map((c) => c.royalLine!)) - 1;
  const alive = chain.filter((c) => c.alive).sort((a, b) => a.royalLine! - b.royalLine!);
  if (base > 0) {
    // The throne passes to someone in an elder branch you don't track: an aunt or uncle, say.
    r.crown = "other";
    r.line = Math.max(2, syncedLine(p) - 1);
    grantDukedom(p, rng);
    beginMourning(p);
    const body = "The sovereign has died and the crown has passed to another branch of the family. You keep your style and titles.";
    addLog(p, body);
    notices.push(info("A New Reign", body, "neutral"));
    return true;
  }
  if (alive.length === 0) return false; // everyone in between has gone: you or an elder sibling's line is next
  const king = alive[0];
  king.royalTitle = male(king.gender) ? "King" : "Queen";
  for (const c of chain) if (c.id !== king.id && c.royalLine! > king.royalLine!) c.royalLine! -= 1;
  king.royalLine = undefined;
  r.crown = king.relation === "Parent" ? "parent" : "grandparent";
  syncLine(p);
  beginMourning(p);
  const first = king.name.split(" ")[0];
  const body = `The sovereign has died. Your ${king.relation === "Parent" ? (male(king.gender) ? "father" : "mother") : male(king.gender) ? "grandfather" : "grandmother"}, ${first}, was next in line and is crowned ${king.royalTitle}. ${r.line === 1 ? "You are now heir to the throne." : `You are number ${r.line} in line.`}`;
  addLog(p, body);
  notices.push(info("The Crown Passes", body, "jackpot"));
  return true;
}

/** Line as it would be computed now, without writing it. */
function syncedLine(p: PlayerState): number {
  const was = p.royal!.line;
  syncLine(p);
  const now = p.royal!.line;
  p.royal!.line = was;
  return now;
}

/** Yearly: royal siblings have children, who stand ahead of you in line if their parent is older than you. */
export function processRoyalFamily(p: PlayerState, rng: Rng, notices: Notices) {
  const r = p.royal;
  if (!r || !p.alive || r.crown === "self" || r.crown === "abdicated") return;
  const reigning = sovereignOf(p);
  for (const sib of p.relatives.filter((s) => s.relation === "Sibling" && s.alive && s.royalTitle && s.age >= 22 && s.age <= 45)) {
    const kids = p.relatives.filter((k) => k.relation === "Nephew" && k.parentId === sib.id);
    if (kids.length >= 3 || !rng.chance(0.09 - kids.length * 0.02)) continue;
    const gender = rng.chance(0.5) ? "Male" : "Female";
    const surname = sib.name.split(" ").slice(1).join(" ") || p.lastName;
    const kid = makeRelativeBase(rng, "Nephew", `${randomName(p.birthCountry, gender, rng).first} ${surname}`, 0, gender, 4, rng.int(60, 95));
    kid.parentId = sib.id;
    // The sovereign's grandchildren are HRH; later generations are not.
    const sovChild = isSovereignTitle(sib.royalTitle) || (!!reigning && r.crown === "parent");
    if (sovChild) kid.royalTitle = male(gender) ? "Prince" : "Princess";
    p.relatives.push(kid);
    const olderThanMe = ageIn(sib, p.year) > p.age || isSovereignTitle(sib.royalTitle);
    let tail = "";
    if (olderThanMe && (r.crown === "parent" || r.crown === "sibling")) {
      r.line = 1 + claimantsAheadOfMe(p);
      tail = ` The baby is now ahead of you in the line of succession: you are number ${r.line}.`;
    }
    const body = `${sib.name.split(" ")[0]} had a baby: your ${male(gender) ? "nephew" : "niece"} ${kid.name.split(" ")[0]}.${tail}`;
    addLog(p, body);
    notices.push(info("A Royal Baby", body, "good"));
  }
}

/** Your sibling reigned and has died: their eldest child is crowned, otherwise the next sibling in line, otherwise you. */
function nextAfterSiblingReign(p: PlayerState, rng: Rng, notices: Notices) {
  const r = p.royal!;
  const late = p.relatives.find((s) => s.relation === "Sibling" && !s.alive && isSovereignTitle(s.royalTitle));
  if (!late) return;
  late.royalTitle = male(late.gender) ? "Prince" : "Princess"; // no longer reigning
  const sibs = p.relatives.filter((s) => s.relation === "Sibling" && s.royalTitle && s.id !== late.id && ageIn(s, p.year) > p.age);
  const kids = p.relatives.filter((k) => k.relation === "Nephew" && k.parentId);
  const next = successionOrder([late, ...sibs], kids, p.year).find((x) => x.alive && x.id !== late.id);
  if (!next) {
    p.royalRank = royalRankFor(p.gender, true);
    p.specialCareerPath = "royalty";
    r.crown = "self";
    r.line = 0;
    r.hrh = true;
    r.peerage = null;
    changeStat(p, "royalRespect", 10);
    beginReign(p, rng);
    const body = `Your sibling's reign has ended with no heir of their own and the crown passes to you. Long live the ${p.royalRank}!`;
    addLog(p, body);
    notices.push(info("Long Live the Crown!", body, "jackpot"));
    return;
  }
  next.royalTitle = male(next.gender) ? "King" : "Queen";
  r.crown = next.relation === "Nephew" ? "other" : "sibling";
  r.line = 1 + claimantsAheadOfMe(p);
  beginMourning(p);
  const body = `${late.name.split(" ")[0]}'s reign has ended. ${next.name.split(" ")[0]} was crowned ${next.royalTitle}${next.relation === "Nephew" ? `, as ${male(late.gender) ? "his" : "her"} eldest child, ahead of you` : ""}.`;
  addLog(p, body);
  notices.push(info("The Crown Passes", body, "neutral"));
}

/** Run yearly: if the reigning monarch has gone, work out who is crowned. */
export function ensureSuccession(p: PlayerState, rng: Rng, notices: Notices) {
  const r = p.royal;
  if (!r || !p.alive) return;
  if (r.crown === "sibling" && !sovereignOf(p)) return nextAfterSiblingReign(p, rng, notices);
  if (r.crown !== "parent" && r.crown !== "grandparent") return;
  if (sovereignOf(p)) {
    syncLine(p); // ancestors may have died since last year
    return;
  }
  if (r.crown === "grandparent" && crownFromChain(p, rng, notices)) return;

  let crowned = false;
  const fromSiblings = r.crown === "parent" || (r.crown === "grandparent" && royalChain(p).length > 0);
  if (fromSiblings) {
    // Children of the late sovereign: the eldest living is crowned, but a dead elder sibling's children come first (absolute primogeniture).
    const sibs = p.relatives.filter((s) => s.relation === "Sibling" && s.royalTitle && ageIn(s, p.year) > p.age);
    const kids = p.relatives.filter((k) => k.relation === "Nephew" && k.parentId);
    const next = successionOrder(sibs, kids, p.year).find((x) => x.alive);
    if (!next) crowned = true;
    else {
      next.royalTitle = male(next.gender) ? "King" : "Queen";
      const nephew = next.relation === "Nephew";
      r.crown = nephew ? "other" : "sibling";
      r.line = 1 + claimantsAheadOfMe(p);
      grantDukedom(p, rng);
      beginMourning(p);
      const first = next.name.split(" ")[0];
      const body = nephew
        ? `The sovereign has died. Your late elder sibling's child, ${first}, was crowned ${next.royalTitle}: the crown passes down your elder sibling's line before it reaches you. You remain ${male(p.gender) ? "a Prince" : "a Princess"} and were created ${p.royal?.peerage}.`
        : `The sovereign has died. Your ${male(next.gender) ? "brother" : "sister"}, ${first}, was crowned ${next.royalTitle}. You remain a ${male(p.gender) ? "Prince" : "Princess"} and the new ${next.royalTitle === "King" ? "king" : "queen"} created you ${p.royal?.peerage}.`;
      addLog(p, body);
      notices.push(info("The Crown Passes", body, "neutral"));
      return;
    }
  } else if (r.line === 1) {
    crowned = true; // heir of the late heir
  }
  if (crowned) {
    p.royalRank = royalRankFor(p.gender, true);
    p.specialCareerPath = "royalty";
    r.crown = "self";
    r.line = 0;
    r.hrh = true;
    r.peerage = null;
    changeStat(p, "royalRespect", 10);
    beginReign(p, rng);
    const body = `The sovereign has died and the crown passes to you. Long live the ${p.royalRank}!`;
    addLog(p, body);
    notices.push(info("Long Live the Crown!", body, "jackpot"));
    return;
  }
  // Someone else (an uncle or aunt, say) takes the throne. Your style stays, but your children will have lesser ones.
  r.crown = "other";
  r.line = Math.max(2, r.line);
  grantDukedom(p, rng);
  beginMourning(p);
  const body = "The sovereign has died and the crown has passed to another branch of the family. You keep your style and titles.";
  addLog(p, body);
  notices.push(info("A New Reign", body, "neutral"));
}

/**
 * When continuing as your child: works out their royal standing. Sovereign's children are Princes/Princesses
 * (the eldest is crowned); grandchildren of the reigning sovereign are too; everyone else loses HRH and keeps
 * a courtesy style, with the eldest son inheriting a dukedom.
 */
export function inheritRoyalty(old: PlayerState, child: Relative, siblingsAfter: Relative[], rng: Rng, living = false): { royal: RoyalLife; rank: "none" | "Prince" | "Princess" | "King" | "Queen"; log: string } | null {
  const o = old.royal;
  if (!o) return null;
  const gender = child.gender;
  const livingKids = [child, ...siblingsAfter].sort((a, b) => b.age - a.age);
  const eldest = livingKids[0];
  const eldestSon = livingKids.filter((k) => male(k.gender))[0];
  // Absolute primogeniture counts every child you had, living or dead, and their children: an elder sibling's baby stands ahead of you.
  const allKids = old.relatives.filter((r) => r.relation === "Child");
  const grand = old.relatives.filter((r) => r.relation === "Grandchild" && r.parentId);
  const order = successionOrder(allKids, grand, old.year);
  const ahead = claimantsAhead(allKids, grand, child.id, old.year);
  const hereLine = (base: number) => base + ahead + (living ? 1 : 0);

  if (o.crown === "self" && living) {
    // Handing over is not abdication: the sovereign keeps reigning and the crown still follows birth order.
    const girl = !male(gender);
    const nephews = grand.filter((g) => g.alive && order.indexOf(g) < order.findIndex((r) => r.id === child.id)).length;
    const line = 1 + ahead;
    return {
      royal: newRoyalLife(ahead),
      rank: girl ? "Princess" : "Prince",
      log: line === 1
        ? `${old.firstName} still reigns. As their eldest child you are heir to the throne.`
        : `${old.firstName} still reigns. You are ${girl ? "a Princess" : "a Prince"}, number ${line} in the line of succession: ${ahead - nephews} elder sibling${ahead - nephews === 1 ? "" : "s"}${nephews > 0 ? ` and ${nephews} of their children` : ""} stand ahead of you, and the crown goes to the eldest, whoever you play.`,
    };
  }
  if (o.crown === "self" || o.crown === "abdicated") {
    // After an abdication the crown already sits on a living child's head; otherwise the first living claimant in birth order is crowned.
    const sitting = o.crown === "abdicated" ? order.find((k) => k.alive && isSovereignTitle(k.royalTitle)) : undefined;
    const reigning = sitting ?? order.find((k) => k.alive) ?? eldest;
    if (reigning.id === child.id) {
      return { royal: { crown: "self", hrh: true, peerage: null, line: 0 }, rank: royalRankFor(gender, true), log: `The crown passes to you. Long live the ${royalRankFor(gender, true)}!` };
    }
    const taken = [reigning.royalTitle ?? ""];
    const peerage = dukedomFor(old, gender, rng, taken);
    const nephew = reigning.relation === "Grandchild";
    const line = 1 + ahead;
    return {
      royal: { crown: nephew ? "other" : "sibling", hrh: true, peerage, line },
      rank: male(gender) ? "Prince" : "Princess",
      log: nephew
        ? `${reigning.name.split(" ")[0]}, the child of your late elder sibling, inherits the crown ahead of you: it passes down the elder line first. You remain ${male(gender) ? "a Prince" : "a Princess"} and are created ${peerage}.`
        : `Your ${reigning.age >= child.age ? "elder " : ""}sibling ${reigning.name.split(" ")[0]} ${o.crown === "abdicated" ? "wears" : "inherits"} the crown. You remain ${male(gender) ? "a Prince" : "a Princess"} and are created ${peerage}.`,
    };
  }
  const sov = old.relatives.find((r) => r.alive && r.relation === "Parent" && isSovereignTitle(r.royalTitle));
  if (o.crown === "parent" && sov) {
    // Your grandparent still reigns: you are their grandchild, so still HRH and in the line.
    return { royal: { crown: "grandparent", hrh: true, peerage: null, line: hereLine(o.line) }, rank: male(gender) ? "Prince" : "Princess", log: `As a grandchild of the reigning sovereign you are ${male(gender) ? "a Prince" : "a Princess"}, ${hereLine(o.line) === 1 ? "first" : `number ${hereLine(o.line)}`} in line to the throne.` };
  }
  if (o.crown === "grandparent" && old.royal?.line === 1 && !sovereignOf(old)) {
    return { royal: { crown: "grandparent", hrh: true, peerage: null, line: hereLine(1) }, rank: male(gender) ? "Prince" : "Princess", log: hereLine(1) === 1 ? "You are heir to the throne." : `You are number ${hereLine(1)} in line to the throne.` };
  }
  if (o.crown === "grandparent" && sovereignOf(old)) {
    // A great-grandchild of the reigning sovereign: not styled HRH, but still in the line of succession through your tracked ancestors.
    return { royal: { crown: "grandparent", hrh: false, peerage: null, line: hereLine(o.line) }, rank: "none", log: `You are a great-grandchild of the reigning sovereign: not styled His or Her Royal Highness, but number ${hereLine(o.line)} in line to the throne.` };
  }
  // Nephew, niece or cousin of the sovereign: no HRH. A dukedom passes to the eldest son; others get courtesy styles.
  let peerage: string | null = null;
  let note = `You are no longer styled His or Her Royal Highness, because you aren't a grandchild of the reigning sovereign. You keep the style of ${male(gender) ? "Lord" : "Lady"} ${child.name.split(" ")[0]}.`;
  if (o.peerage && eldestSon && eldestSon.id === child.id && o.peerage.startsWith("Duke")) {
    peerage = o.peerage;
    note = `Your parent's dukedom passes to you: you are now the ${peerage}. You are not styled HRH, because you aren't a grandchild of the reigning sovereign.`;
  } else if (o.peerage && !eldestSon && eldest.id === child.id) {
    note += " The dukedom dies out with no male heir.";
  }
  const lord = peerage ?? o.peerage?.replace(/^(Duke|Duchess)/, "Earl") ?? null;
  return { royal: { crown: "other", hrh: false, peerage: peerage ?? (o.peerage ? lord : null), line: Math.min(30, Math.max(2, o.line + 1) + ahead) }, rank: "none", log: note };
}
