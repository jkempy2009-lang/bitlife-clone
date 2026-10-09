/**
 * Your partner's family: the people who come with a marriage. They have feelings about you, they age,
 * they help or interfere, and when one dies how you showed up matters to your spouse.
 */
import type { ActionResult, InLaw, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { deathChance } from "./mortality";
import { freshFirstName } from "./people";
import { addGrievance, meet, remember } from "./bonds";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });
const first = (r: { name: string }) => r.name.split(" ")[0];

export const HOLIDAY_COST = 400;

/** Generates the family the first time it's needed (at the wedding). */
export function ensureInLaws(p: PlayerState, partner: Relative, rng: Rng): InLaw[] {
  if (partner.inLaws) return partner.inLaws;
  const surname = partner.name.split(" ").slice(1).join(" ") || p.lastName;
  const mk = (role: InLaw["role"], gender: string, age: number): InLaw => {
    const parent = role === "Mother-in-law" || role === "Father-in-law";
    const alive = rng.chance(clamp(1 - Math.max(0, age - 62) * 0.04, 0.1, 0.98));
    const warmth = clamp(Math.round(46 + (partner.relationshipBar - 55) / 5 + (p.bankBalance > 100_000 ? 5 : 0) + rng.int(-16, 16) + (parent ? 0 : 6)));
    return { name: `${freshFirstName(p, gender, rng)} ${surname}`, role, age, alive, warmth };
  };
  const list: InLaw[] = [
    mk("Mother-in-law", "Female", partner.age + rng.int(21, 32)),
    mk("Father-in-law", "Male", partner.age + rng.int(22, 34)),
  ];
  if (rng.chance(0.55)) {
    const sister = rng.chance(0.5);
    list.push(mk(sister ? "Sister-in-law" : "Brother-in-law", sister ? "Female" : "Male", Math.max(18, partner.age + rng.int(-6, 6))));
  }
  partner.inLaws = list;
  const living = list.filter((l) => l.alive);
  if (living.length > 0) remember(p, partner, "milestone", `You met ${first(partner)}'s family: ${living.map((l) => first(l)).join(", ")}.`);
  return list;
}

const livingInLaws = (partner: Relative) => (partner.inLaws ?? []).filter((l) => l.alive);

function marriedPartnerOf(p: PlayerState, relId: string): Relative | undefined {
  const r = p.relatives.find((x) => x.id === relId && x.alive && x.relation === "Partner" && x.partnerStatus === "married");
  return r && r.inLaws ? r : undefined;
}

export function visitInLaws(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const partner = marriedPartnerOf(p, relId);
  if (!partner) return { player: p0 };
  const family = livingInLaws(partner);
  if (family.length === 0) return { player: p0, notices: [info("Nobody to Visit", `${first(partner)}'s family is gone now.`)] };
  if ((p.annual[`inlaw:visit:${partner.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Just Visited", "You've already made the trip this year.")] };
  p.annual[`inlaw:visit:${partner.id}`] = 1;
  meet(p, partner, "family", "affection");
  const mishap = rng.chance(0.22);
  for (const l of family) l.warmth = clamp(l.warmth + (mishap ? 1 : 5));
  partner.relationshipBar = clamp(partner.relationshipBar + (mishap ? 1 : 3));
  const who = family.map(first).join(" and ");
  const body = mishap
    ? `You drove to see ${who}. The visit was long on small talk and short on warmth, and someone mentioned how you load the dishwasher. ${first(partner)} squeezed your hand under the table.`
    : `A weekend with ${who}: board games, too much food, an old family story you hadn't heard. ${first(partner)} was visibly relieved that you made the effort.`;
  addLog(p, body);
  return { player: p, notices: [info(mishap ? "A Stiff Visit" : "Family Weekend", body, mishap ? "neutral" : "good")] };
}

export function hostHoliday(p0: PlayerState, relId: string): ActionResult {
  const p = clone(p0);
  const partner = marriedPartnerOf(p, relId);
  if (!partner) return { player: p0 };
  const family = livingInLaws(partner);
  if (family.length === 0) return { player: p0, notices: [info("Nobody to Host", `${first(partner)}'s family is gone now.`)] };
  if ((p.annual[`inlaw:host:${partner.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Once a Year", "Hosting the holiday once a year is quite enough.")] };
  if (p.bankBalance < HOLIDAY_COST) return { player: p0, notices: [info("Insufficient Funds", `A proper holiday spread costs about ${money(HOLIDAY_COST)}.`, "bad")] };
  p.annual[`inlaw:host:${partner.id}`] = 1;
  p.bankBalance -= HOLIDAY_COST;
  meet(p, partner, "family", "affection");
  for (const l of family) l.warmth = clamp(l.warmth + 8);
  partner.relationshipBar = clamp(partner.relationshipBar + 4);
  changeStat(p, "happiness", 2);
  const body = `You hosted the whole family. ${family.map(first).join(" and ")} ate everything, criticised nothing out loud, and left with leftovers. ${first(partner)} said it was the best holiday in years.`;
  addLog(p, body);
  remember(p, partner, "joy", `You hosted the family holiday.`);
  return { player: p, notices: [info("Hosting the Family", body, "good")] };
}

export function askInLawsForHelp(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const partner = marriedPartnerOf(p, relId);
  if (!partner) return { player: p0 };
  const family = livingInLaws(partner);
  if (family.length === 0) return { player: p0, notices: [info("Nobody to Ask", `${first(partner)}'s family is gone now.`)] };
  if ((p.annual[`inlaw:ask:${partner.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Not Again", "You've already leaned on them this year.")] };
  p.annual[`inlaw:ask:${partner.id}`] = 1;
  const warm = family.reduce((s, l) => s + l.warmth, 0) / family.length;
  if (rng.chance(clamp(warm / 110, 0.1, 0.9))) {
    const kids = p.relatives.some((r) => r.relation === "Child" && r.alive && r.age < 12);
    const saved = kids ? 2_400 : 1_000;
    p.bankBalance += saved;
    for (const l of family) l.warmth = clamp(l.warmth + 3);
    changeStat(p, "happiness", 3);
    const body = kids ? `${first(family[0])} took the children every Thursday for a year, and wouldn't hear of being thanked. That saved you ${money(saved)} in childcare.` : `${first(family[0])} quietly slipped you ${money(saved)} "for the house". They said it was only what they'd have spent on you at Christmas.`;
    addLog(p, body);
    return { player: p, notices: [info("Family Helps", body, "good")] };
  }
  for (const l of family) l.warmth = clamp(l.warmth - 6);
  partner.relationshipBar = clamp(partner.relationshipBar - 2);
  const body = `You asked ${first(family[0])} for help and got a lecture about managing money instead. ${first(partner)} was mortified.`;
  addLog(p, body);
  return { player: p, notices: [info("Not Welcome", body, "bad")] };
}

export function processInLaws(p: PlayerState, prev: Record<string, number>, rng: Rng, notices: Notices) {
  for (const partner of p.relatives) {
    if (!partner.inLaws || !partner.alive) continue;
    const present = partner.partnerStatus === "married" && !partner.separatedYear;
    for (const l of partner.inLaws) {
      if (!l.alive) continue;
      l.age += 1;
      if (present) {
        const visited = (prev[`inlaw:visit:${partner.id}`] ?? 0) + (prev[`inlaw:host:${partner.id}`] ?? 0) > 0;
        l.warmth = clamp(l.warmth + (visited ? 0 : -3));
      }
      if (l.age > 55 && rng.chance(deathChance(l.age, 70))) {
        l.alive = false;
        if (!present) continue;
        const closeness = l.warmth;
        let body = `${l.name}, ${first(partner)}'s ${l.role.replace("-in-law", "").toLowerCase()}, passed away at ${l.age}.`;
        if (closeness >= 50) {
          partner.relationshipBar = clamp(partner.relationshipBar + 4);
          changeStat(p, "happiness", -3);
          body += ` You helped with the funeral and held ${first(partner)} together. They won't forget it.`;
          remember(p, partner, "kindness", `You stood by ${first(partner)} when ${first(l)} died.`);
        } else if (closeness < 30) {
          partner.relationshipBar = clamp(partner.relationshipBar - 3);
          body += ` You went because you had to. ${first(partner)} noticed how little you said.`;
          addGrievance(p, partner, "neglect", 1, `how you handled ${first(l)}'s death`);
        } else {
          changeStat(p, "happiness", -1);
        }
        addLog(p, body);
        notices.push(info("A Death in the Family", body, "bad"));
      }
    }
    if (!present) continue;
    const family = livingInLaws(partner);
    if (family.length === 0) continue;
    const avg = family.reduce((s, l) => s + l.warmth, 0) / family.length;
    const lead = family[0];
    if (avg < 28 && rng.chance(0.3)) {
      partner.relationshipBar = clamp(partner.relationshipBar - 3);
      addGrievance(p, partner, "fight", 1, `${first(lead)}'s constant comments`);
      const body = `${first(lead)} criticised the way you live, again, and ${first(partner)} was caught in the middle. It ended in a row in the car park.`;
      addLog(p, body);
      notices.push(info("Interfering In-Laws", body, "bad"));
    } else if (avg >= 68 && rng.chance(0.25)) {
      changeStat(p, "happiness", 2);
      partner.relationshipBar = clamp(partner.relationshipBar + 2);
      const body = `${first(lead)} turned up with a casserole and an offer to help with the garden, and stayed for dinner. Marrying into this family has its perks.`;
      addLog(p, body);
      notices.push(info("A Warm Family", body, "good"));
    }
  }
}
