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
import { addLog, changeStat, royalRankFor } from "./state";
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

/** Run yearly: if the reigning monarch has gone, work out who is crowned. */
export function ensureSuccession(p: PlayerState, rng: Rng, notices: Notices) {
  const r = p.royal;
  if (!r || !p.alive) return;
  if (r.crown !== "parent" && r.crown !== "grandparent") return;
  if (sovereignOf(p)) return;

  const siblings = p.relatives.filter((s) => s.relation === "Sibling" && s.alive && s.royalTitle);
  let crowned = false;
  if (r.crown === "parent") {
    // Children of the late sovereign: the eldest living is crowned (absolute primogeniture).
    const older = siblings.filter((s) => s.age > p.age);
    if (older.length === 0) crowned = true;
    else {
      const heir = older.sort((a, b) => b.age - a.age)[0];
      heir.royalTitle = male(heir.gender) ? "King" : "Queen";
      r.crown = "sibling";
      r.line = Math.max(2, older.length);
      grantDukedom(p, rng);
      beginMourning(p);
      const body = `The sovereign has died. Your ${male(heir.gender) ? "brother" : "sister"}, ${heir.name.split(" ")[0]}, was crowned ${heir.royalTitle}. You remain a ${male(p.gender) ? "Prince" : "Princess"} and the new ${heir.royalTitle === "King" ? "king" : "queen"} created you ${p.royal?.peerage}.`;
      addLog(p, body);
      notices.push(info("The Crown Passes", body, "neutral"));
      return;
    }
  } else if (r.line === 1) {
    crowned = true; // heir of the late heir
  }
  if (crowned) {
    p.royalRank = royalRankFor(p.gender, true);
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
export function inheritRoyalty(old: PlayerState, child: Relative, siblingsAfter: Relative[], rng: Rng): { royal: RoyalLife; rank: "none" | "Prince" | "Princess" | "King" | "Queen"; log: string } | null {
  const o = old.royal;
  if (!o) return null;
  const gender = child.gender;
  const livingKids = [child, ...siblingsAfter].sort((a, b) => b.age - a.age);
  const eldest = livingKids[0];
  const eldestSon = livingKids.filter((k) => male(k.gender))[0];

  if (o.crown === "self" || o.crown === "abdicated") {
    // After an abdication the crown already sits on a living child's head; otherwise the eldest is crowned.
    const reigning = o.crown === "abdicated" ? livingKids.find((k) => isSovereignTitle(k.royalTitle)) ?? eldest : eldest;
    if (reigning.id === child.id) {
      return { royal: { crown: "self", hrh: true, peerage: null, line: 0 }, rank: royalRankFor(gender, true), log: `The crown passes to you. Long live the ${royalRankFor(gender, true)}!` };
    }
    const taken = [reigning.royalTitle ?? ""];
    const peerage = dukedomFor(old, gender, rng, taken);
    return { royal: { crown: "sibling", hrh: true, peerage, line: 2 }, rank: male(gender) ? "Prince" : "Princess", log: `Your ${reigning.age >= child.age ? "elder " : ""}sibling ${reigning.name.split(" ")[0]} ${o.crown === "abdicated" ? "wears" : "inherits"} the crown. You remain ${male(gender) ? "a Prince" : "a Princess"} and are created ${peerage}.` };
  }
  const sov = old.relatives.find((r) => r.alive && r.relation === "Parent" && isSovereignTitle(r.royalTitle));
  if (o.crown === "parent" && sov) {
    // Your grandparent still reigns: you are their grandchild, so still HRH and in the line.
    return { royal: { crown: "grandparent", hrh: true, peerage: null, line: o.line === 1 ? 1 : o.line + 1 }, rank: male(gender) ? "Prince" : "Princess", log: `As a grandchild of the reigning sovereign you are ${male(gender) ? "a Prince" : "a Princess"}, ${o.line === 1 ? "first" : `number ${o.line + 1}`} in line to the throne.` };
  }
  if (o.crown === "grandparent" && old.royal?.line === 1 && !sovereignOf(old)) {
    return { royal: { crown: "grandparent", hrh: true, peerage: null, line: 1 }, rank: male(gender) ? "Prince" : "Princess", log: "You are heir to the throne." };
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
  return { royal: { crown: "other", hrh: false, peerage: peerage ?? (o.peerage ? lord : null), line: Math.min(30, Math.max(2, o.line + 1)) }, rank: "none", log: note };
}
