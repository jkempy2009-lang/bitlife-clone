/**
 * Marriage and partnership over time: what each of you needs, hurts that resurface until you clear the
 * air, counselling, trial separation, reconciliation, and what happens to the children when a couple
 * splits (custody, co-parenting, support). Also keeps your exes in the world: they age, and they die.
 */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { LifeEvent } from "@/data/lifeEventsEngine";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner } from "./state";
import { deathChance } from "./mortality";
import { endRelationship } from "./social";
import { spouseIncome } from "./household";
import {
  VALUE_BY_ID, addGrievance, compatibility, grievanceLoad, learnValue, meet, needMet, relationshipHealth, remember,
  soften, valuesOf, worstGrievance, yearsKnown,
} from "./bonds";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });
const first = (r: Relative) => r.name.split(" ")[0];

export const COUNSELLING_COST = 1_500;
export const GOALS_COST = 800;
export const LEGAL_COST = 2_500;

const minors = (p: PlayerState) => p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age < 18);
const isExOf = (kid: Relative, ex: Relative) => kid.otherParent === ex.name || (!kid.otherParent && kid.relation === "Child");

// ---------------------------------------------------------------------------
// When a couple splits
// ---------------------------------------------------------------------------

/** Sets up custody for the children you shared. Returns a line for the log (or null if there are none). */
export function splitFamily(p: PlayerState, ex: Relative): string | null {
  const kids = minors(p).filter((k) => !k.custody && isExOf(k, ex));
  if (kids.length === 0) return null;
  for (const k of kids) {
    k.custody = "shared";
    k.otherParent = ex.name;
    k.relationshipBar = clamp(k.relationshipBar - 4);
    remember(p, k, "hardship", `Your split with ${first(ex)} turned ${first(k)}'s world upside down.`);
  }
  if (!p.flags.includes("child_support")) p.flags.push("child_support");
  return `You and ${first(ex)} agreed to share custody of ${kids.length === 1 ? first(kids[0]) : `your ${kids.length} children`} for now. You can change that from ${kids.length === 1 ? "their" : "each child's"} page.`;
}

export type Custody = NonNullable<Relative["custody"]>;

export function setCustody(p0: PlayerState, kidId: string, to: Custody, rng: Rng): ActionResult {
  const p = clone(p0);
  const kid = p.relatives.find((r) => r.id === kidId && r.alive && r.relation === "Child" && r.age < 18 && r.custody);
  if (!kid || kid.custody === to) return { player: p0 };
  if ((p.annual[`custody:${kid.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Settled", "Custody has been looked at this year. Courts don't like constant change.")] };
  const ex = p.relatives.find((r) => r.relation !== "Child" && r.partnerStatus === "ex" && r.name === kid.otherParent);
  const n = first(kid);
  p.annual[`custody:${kid.id}`] = 1;
  if (to === "them") {
    kid.custody = "them";
    kid.relationshipBar = clamp(kid.relationshipBar - 6);
    changeStat(p, "happiness", -4);
    const body = `You agreed that ${n} will live mostly with ${ex ? first(ex) : "their other parent"}. You'll see them on weekends and pay support. It feels like a loss, whatever the reasons.`;
    addLog(p, body);
    remember(p, kid, "hardship", `${n} moved to live mostly with ${ex ? first(ex) : "their other parent"}.`);
    return { player: p, notices: [info("Custody Changed", body, "bad")] };
  }
  if (p.bankBalance < LEGAL_COST) return { player: p0, notices: [info("Insufficient Funds", `Lawyers and a mediator cost ${money(LEGAL_COST)}.`, "bad")] };
  p.bankBalance -= LEGAL_COST;
  const exOk = ex ? ex.relationshipBar / 200 : 0.25;
  const chance = clamp((to === "shared" ? 0.6 : 0.3) + exOk - (ex ? grievanceLoad(ex) * 0.04 : 0) + (p.currentJob || p.business ? 0.05 : -0.1), 0.1, 0.9);
  if (rng.chance(chance)) {
    kid.custody = to;
    kid.relationshipBar = clamp(kid.relationshipBar + 5);
    changeStat(p, "happiness", 4);
    const body = to === "you" ? `The mediator agreed that ${n} will live with you, and spend time with ${ex ? first(ex) : "their other parent"}. ${money(LEGAL_COST)} in fees, but ${n} is home.` : `${n} will split their time evenly between your homes. The calendar is a nightmare, but ${n} has you both.`;
    addLog(p, body);
    remember(p, kid, "milestone", to === "you" ? `${n} came to live with you.` : `${n} now splits time between you and ${ex ? first(ex) : "their other parent"}.`);
    return { player: p, notices: [info("Custody Agreed", body, "good")] };
  }
  if (ex) ex.relationshipBar = clamp(ex.relationshipBar - 8);
  changeStat(p, "happiness", -4);
  const body = `${ex ? first(ex) : "Their other parent"} wouldn't agree, and the mediator sided with the status quo. ${money(LEGAL_COST)} gone, and things are tenser than before.`;
  addLog(p, body);
  return { player: p, notices: [info("Custody Refused", body, "bad")] };
}

/** Share of income paid as support. Shared custody pays a smaller share. */
export function supportShare(p: PlayerState): number {
  let s = 0;
  for (const k of minors(p)) {
    if (k.custody === "them") s += 0.08;
    else if (k.custody === "shared") s += 0.045;
  }
  return Math.min(0.25, s);
}

// ---------------------------------------------------------------------------
// Actions inside a relationship
// ---------------------------------------------------------------------------

const partnerOf = (p: PlayerState, id: string) => p.relatives.find((r) => r.id === id && r.alive && r.relation === "Partner" && r.partnerStatus !== "ex");

export function talkAboutUs(p0: PlayerState, relId: string): ActionResult {
  const p = clone(p0);
  const rel = partnerOf(p, relId);
  if (!rel) return { player: p0 };
  const n = first(rel);
  if ((p.annual[`us:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Talked", `You and ${n} have had that conversation this year.`)] };
  if (rel.relationshipBar < 15) return { player: p0, notices: [info("Shut Out", `${n} isn't willing to talk about the future right now.`, "bad")] };
  p.annual[`us:${rel.id}`] = 1;
  meet(p, rel, "security");
  rel.relationshipBar = clamp(rel.relationshipBar + 3);
  const v = learnValue(rel);
  const body = v ? `You asked ${n} what they really need from a relationship. They thought about it: "${v.label.toLowerCase()}". ${v.hint}.` : `You talked about money, plans and where you'll both be in ten years. There was nothing left to ask. You know each other.`;
  addLog(p, body);
  return { player: p, notices: [info("Talking About Us", body, "good")] };
}

export function backTheirGoals(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const rel = partnerOf(p, relId);
  if (!rel) return { player: p0 };
  const n = first(rel);
  if ((p.annual[`goals:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Backed", `You've already backed ${n}'s plans this year.`)] };
  if (p.bankBalance < GOALS_COST) return { player: p0, notices: [info("Insufficient Funds", `A course, a business licence or a few shifts' cover costs about ${money(GOALS_COST)}.`, "bad")] };
  p.annual[`goals:${rel.id}`] = 1;
  p.bankBalance -= GOALS_COST;
  meet(p, rel, "ambition");
  rel.relationshipBar = clamp(rel.relationshipBar + 4);
  let body = `You paid for ${n}'s course and covered the home front while they studied. They won't forget that you believed in them.`;
  if (rel.age < 58 && rel.incomeTier < 5 && rng.chance(0.28)) {
    rel.incomeTier += 1;
    body += ` It paid off: ${n} landed a better job.`;
  }
  addLog(p, body);
  remember(p, rel, "kindness", `You backed ${n}'s goals when it counted.`);
  return { player: p, notices: [info("Backing Their Goals", body, "good")] };
}

export function giveSpace(p0: PlayerState, relId: string): ActionResult {
  const p = clone(p0);
  const rel = partnerOf(p, relId);
  if (!rel) return { player: p0 };
  const n = first(rel);
  if ((p.annual[`space:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Done", `You've already given ${n} their space this year.`)] };
  p.annual[`space:${rel.id}`] = 1;
  meet(p, rel, "independence");
  rel.relationshipBar = clamp(rel.relationshipBar + 1);
  const body = `You told ${n} to take that trip with their friends, no questions asked, and spent the weekend on your own projects. They came back glowing.`;
  addLog(p, body);
  return { player: p, notices: [info("Room to Breathe", body, "good")] };
}

/** Shared by the action and the crisis event. */
function runCounselling(p: PlayerState, rel: Relative, rng: Rng): ActionResult["notices"] {
  const n = first(rel);
  p.annual[`counsel:${rel.id}`] = 1;
  p.bankBalance -= COUNSELLING_COST;
  rel.counselling = (rel.counselling ?? 0) + 1;
  const fit = compatibility(p, rel);
  const chance = clamp(0.42 + fit.score / 300 + (rel.counselling - 1) * 0.06 - grievanceLoad(rel) * 0.03 + (p.talents.empathy - 50) / 300, 0.15, 0.9);
  const v1 = learnValue(rel);
  const v2 = learnValue(rel);
  const learned = [v1, v2].filter(Boolean).map((v) => v!.label.toLowerCase());
  if (rng.chance(chance)) {
    for (const g of [...(rel.grievances ?? [])]) soften(rel, g.id, 1);
    rel.relationshipBar = clamp(rel.relationshipBar + 8);
    changeStat(p, "happiness", 4);
    const body = `The counsellor made you each say what you needed out loud, without interrupting. ${n} needs ${learned.length ? learned.join(" and ") : "what you already know"}. You left holding hands, and some of the old arguments felt smaller.`;
    addLog(p, body);
    if (rel.counselling === 1) remember(p, rel, "milestone", `You and ${n} started couples counselling.`);
    return [info("Counselling Helped", body, "good")];
  }
  rel.relationshipBar = clamp(rel.relationshipBar - 2);
  changeStat(p, "happiness", -2);
  const body = `You both tried, but the sessions mostly circled the same arguments. At least you now understand that ${n} needs ${learned.length ? learned.join(" and ") : "different things from you"}.`;
  addLog(p, body);
  return [info("A Hard Session", body, "neutral")];
}

export function counselling(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const rel = partnerOf(p, relId);
  if (!rel) return { player: p0 };
  const n = first(rel);
  if ((p.annual[`counsel:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Booked", "You've done your sessions for this year.")] };
  if (p.bankBalance < COUNSELLING_COST) return { player: p0, notices: [info("Insufficient Funds", `Couples counselling costs about ${money(COUNSELLING_COST)} a year.`, "bad")] };
  if (rel.relationshipBar < 12) return { player: p0, notices: [info("Too Late", `${n} says they've already checked out. They won't sit in a room with you and a counsellor.`, "bad")] };
  return { player: p, notices: runCounselling(p, rel, rng) };
}

export function separate(p0: PlayerState, relId: string): ActionResult {
  const p = clone(p0);
  const rel = partnerOf(p, relId);
  if (!rel || rel.partnerStatus !== "married" || rel.separatedYear) return { player: p0 };
  const n = first(rel);
  rel.separatedYear = p.year;
  rel.relationshipBar = clamp(rel.relationshipBar - 4);
  changeStat(p, "happiness", -4);
  remember(p, rel, "hardship", `You and ${n} separated.`);
  const body = `You moved out. ${n} and you agreed it's a trial, not a decision, but everyone knows what a trial separation usually means. Your finances are no longer shared.`;
  addLog(p, body);
  return { player: p, notices: [info("Living Apart", body, "bad")] };
}

export function reconcile(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const rel = partnerOf(p, relId);
  if (!rel || !rel.separatedYear) return { player: p0 };
  const n = first(rel);
  if ((p.annual[`reconcile:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Give It Time", `You've already tried to win ${n} back this year.`)] };
  p.annual[`reconcile:${rel.id}`] = 1;
  const chance = clamp(0.28 + rel.relationshipBar / 200 + (rel.counselling ?? 0) * 0.08 - grievanceLoad(rel) * 0.05, 0.08, 0.85);
  if (rng.chance(chance)) {
    rel.separatedYear = undefined;
    rel.relationshipBar = clamp(rel.relationshipBar + 10);
    changeStat(p, "happiness", 8);
    remember(p, rel, "milestone", `You and ${n} got back together after living apart.`);
    const body = `You turned up with nothing prepared and said what you should have said months ago. ${n} let you in. The first night was awkward; the second wasn't.`;
    addLog(p, body);
    return { player: p, notices: [info("Back Together", body, "good")] };
  }
  rel.relationshipBar = clamp(rel.relationshipBar - 4);
  changeStat(p, "happiness", -3);
  const body = `${n} listened, then said they need more time. It wasn't a no. It wasn't a yes either.`;
  addLog(p, body);
  return { player: p, notices: [info("Not Yet", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Clearing the air (any relationship)
// ---------------------------------------------------------------------------

export type Approach = "apologise" | "talk" | "gift";

export function clearTheAir(p0: PlayerState, relId: string, approach: Approach, rng: Rng): ActionResult {
  const p = clone(p0);
  const rel = p.relatives.find((r) => r.id === relId && r.alive && r.relation !== "Pet");
  if (!rel) return { player: p0 };
  const n = first(rel);
  const g = worstGrievance(rel);
  if (!g) return { player: p0, notices: [info("Nothing to Fix", `There's nothing unresolved between you and ${n}.`)] };
  if ((p.annual[`air:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Not Again", `You've already tried to clear the air with ${n} this year. Let it settle.`)] };
  const cost = approach === "gift" ? 300 * g.weight : 0;
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `That gesture costs ${money(cost)}.`, "bad")] };
  p.annual[`air:${rel.id}`] = 1;
  p.bankBalance -= cost;
  const heavy = g.weight - 1;
  let chance: number;
  if (approach === "apologise") chance = 0.58 + rel.relationshipBar / 260 + (p.talents.empathy - 50) / 300 - heavy * 0.1 - (g.kind === "betrayal" ? 0.06 : 0);
  else if (approach === "talk") chance = 0.46 + rel.relationshipBar / 300 + (p.talents.empathy + p.talents.charisma - 100) / 400 - heavy * 0.08;
  else chance = g.kind === "betrayal" ? 0.08 : 0.55 - heavy * 0.25;
  chance = clamp(chance, 0.05, 0.92);
  if (!rng.chance(chance)) {
    rel.relationshipBar = clamp(rel.relationshipBar - 3);
    changeStat(p, "happiness", -2);
    const body =
      approach === "gift" ? `${n} took one look at the gift and said "you can't buy this back". Some things need words.`
      : approach === "apologise" ? `Your apology about ${g.text} came out wrong, and ${n} wasn't ready to hear it.`
      : `The conversation about ${g.text} turned into a second argument.`;
    addLog(p, body);
    return { player: p, notices: [info("Not Ready", body, "bad")] };
  }
  const gone = soften(rel, g.id, approach === "apologise" ? 2 : 1);
  rel.relationshipBar = clamp(rel.relationshipBar + (approach === "talk" ? 6 : 4));
  if (approach === "apologise") changeStat(p, "happiness", -1);
  else changeStat(p, "happiness", 2);
  let tail = "";
  if (approach === "talk") {
    const v = learnValue(rel);
    if (v) tail = ` You also learned something: ${n} needs ${v.label.toLowerCase()}.`;
  }
  if (gone) {
    remember(p, rel, "kindness", `You made peace with ${n} about ${g.text}.`);
    if (rel.riftYear && !(rel.grievances ?? []).some((x) => x.kind === "fight" || x.kind === "betrayal")) {
      rel.riftYear = undefined;
      rel.relationshipBar = clamp(rel.relationshipBar + 8);
      remember(p, rel, "milestone", `You and ${n} mended the friendship after falling out.`);
      tail += " The friendship is back on, a bit stronger for having been tested.";
    }
  }
  const body = gone
    ? `You and ${n} finally put ${g.text} to rest.${tail}`
    : `It helped. ${n} softened about ${g.text}, though it isn't entirely behind you.${tail}`;
  addLog(p, body);
  return { player: p, notices: [info(gone ? "Peace Made" : "A Step Forward", body, "good")] };
}

// ---------------------------------------------------------------------------
// The yearly turn
// ---------------------------------------------------------------------------

const MILESTONE_YEARS = [1, 5, 10, 15, 20, 25, 30, 40, 50];
const ANNIVERSARY_NAME: Record<number, string> = { 1: "paper", 5: "wood", 10: "tin", 15: "crystal", 20: "china", 25: "silver", 30: "pearl", 40: "ruby", 50: "golden" };

/** Needs that are met simply by how you lived this year (not just by pressing a button). */
function passivelyMet(p: PlayerState, rel: Relative, prev: Record<string, number>, v: string): boolean {
  if (v === "independence") return (prev[`rel:${rel.id}`] ?? 0) <= 2;
  if (v === "affection") return (prev[`love:${rel.id}`] ?? 0) >= 2;
  if (v === "adventure") return Object.keys(prev).some((k) => (k.startsWith("exp:") && k.endsWith(`:${rel.id}`)) || k === `scene:${rel.id}`);
  if (v === "security") return p.bankBalance >= 25_000 && !!(p.currentJob || p.business);
  if (v === "family") return minors(p).length > 0 && Object.keys(prev).some((k) => k.startsWith("kid:family:"));
  return false;
}

function crisisEvent(p: PlayerState, rel: Relative): LifeEvent {
  const n = first(rel);
  const married = rel.partnerStatus === "married";
  const id = rel.id;
  const worst = worstGrievance(rel);
  return {
    id: `rel_crisis_${id}_${p.year}`,
    title: married ? "The Marriage Is in Trouble" : "Something Has Gone Wrong",
    description: `${n} sat you down. ${worst ? `It started with ${worst.text}, but it's about more than that now.` : "It's not one thing; it's a hundred small things."} "I don't know if we can keep doing this the way we are," ${n} said. You've been together ${yearsKnown(p, rel) ?? "a few"} years.`,
    minAge: 0,
    maxAge: 200,
    category: "romance",
    options: [
      {
        text: `Suggest counselling (${money(COUNSELLING_COST)})`,
        effects: {
          logText: `You asked ${n} to try counselling before giving up.`,
          bankBalanceDelta: -COUNSELLING_COST,
          apply: (q, rng) => {
            const r = q.relatives.find((x) => x.id === id);
            if (r) for (const nn of runCounselling(q, r, rng) ?? []) addLog(q, "body" in nn ? nn.body : "");
          },
        },
      },
      {
        text: "Promise to change, and mean it",
        effects: { logText: `You promised ${n} things would be different. Now you have to keep that promise.`, happinessDelta: -2, apply: (q) => { const r = q.relatives.find((x) => x.id === id); if (r) { r.relationshipBar = clamp(r.relationshipBar + 8); r.unmet = {}; remember(q, r, "milestone", `You promised ${n} things would change.`); } } },
        chance: { p: clamp(0.4 + rel.relationshipBar / 200, 0.2, 0.8), failure: { logText: `${n} wanted to believe you, but they'd heard it before.`, happinessDelta: -4, apply: (q) => { const r = q.relatives.find((x) => x.id === id); if (r) { r.relationshipBar = clamp(r.relationshipBar - 6); addGrievance(q, r, "neglect", 2, "a promise that wasn't kept"); } } } },
      },
      ...(married
        ? [{
            text: "Suggest a trial separation",
            effects: { logText: `You and ${n} agreed to live apart for a while.`, happinessDelta: -4, apply: (q: PlayerState) => { const r = q.relatives.find((x) => x.id === id); if (r && r.partnerStatus === "married") { r.separatedYear = q.year; remember(q, r, "hardship", `You and ${n} separated.`); } } },
          }]
        : []),
      {
        text: married ? "End it: file for divorce" : "End it",
        effects: { logText: married ? `You and ${n} agreed it was over.` : `You and ${n} ended things.`, happinessDelta: -6, apply: (q) => { if (getPartner(q)?.id === id) endRelationship(q, married ? "divorce" : "breakup"); } },
      },
    ],
  };
}

export function processPartnership(p: PlayerState, prev: Record<string, number>, rng: Rng, notices: Notices) {
  const partner = getPartner(p);
  if (partner && partner.relation === "Partner" && partner.metYear !== p.year) {
    const n = first(partner);
    const fit = compatibility(p, partner);
    const married = partner.partnerStatus === "married";

    // Needs: each of them wants two things from you.
    for (const v of valuesOf(partner)) {
      const met = needMet(prev, partner, v) || passivelyMet(p, partner, prev, v);
      const unmet = (partner.unmet = partner.unmet ?? {});
      if (met) {
        unmet[v] = 0;
        partner.relationshipBar = clamp(partner.relationshipBar + 2);
        continue;
      }
      unmet[v] = (unmet[v] ?? 0) + 1;
      partner.relationshipBar = clamp(partner.relationshipBar - (unmet[v] === 1 ? 1 : 3));
      if (unmet[v] >= 2) {
        const def = VALUE_BY_ID[v];
        const had = (partner.grievances ?? []).some((g) => g.kind === "neglect" && g.text === `how little you've made room for ${def.label.toLowerCase()}`);
        addGrievance(p, partner, "neglect", unmet[v] >= 3 ? 2 : 1, `how little you've made room for ${def.label.toLowerCase()}`);
        partner.knownValues = Array.from(new Set([...(partner.knownValues ?? []), v]));
        if (!had) {
          const body = `${n} never said it outright, but it's clear: ${n} ${def.lack}. ${def.hint}.`;
          addLog(p, body);
          notices.push(info("Something Is Missing", body, "bad"));
        }
      }
    }
    partner.relationshipBar = clamp(partner.relationshipBar + (fit.score >= 66 ? 1 : fit.score < 42 ? -2 : 0));

    // Old hurts come back.
    const wounds = partner.grievances ?? [];
    if (wounds.length > 0) {
      const worst = worstGrievance(partner)!;
      if (rng.chance(0.18 + worst.weight * 0.12)) {
        partner.relationshipBar = clamp(partner.relationshipBar - 2 * worst.weight);
        changeStat(p, "happiness", -worst.weight);
        const body = `${n} brought up ${worst.text} again, in the middle of an unrelated argument. It was never really over.`;
        addLog(p, body);
        notices.push(info("Old Wounds", body, "bad"));
      }
      for (const g of [...wounds]) if (g.weight === 1 && g.kind !== "betrayal" && rng.chance(0.14)) soften(partner, g.id, 1);
    }

    // Anniversaries
    const years = married && partner.marriedYear !== undefined ? p.year - partner.marriedYear : null;
    if (married && !partner.separatedYear && years !== null && MILESTONE_YEARS.includes(years)) {
      const health = relationshipHealth(p, partner);
      const name = ANNIVERSARY_NAME[years] ?? "";
      if (health.score >= 45) {
        partner.relationshipBar = clamp(partner.relationshipBar + 3);
        changeStat(p, "happiness", 3);
        const body = `${years} year${years === 1 ? "" : "s"} married${name ? ` (${name})` : ""}. You and ${n} looked back through old photographs and laughed at who you used to be.`;
        remember(p, partner, "joy", `Your ${years}${years === 1 ? "st" : "th"} anniversary.`);
        addLog(p, body);
        notices.push(info("Anniversary", body, "good"));
      } else {
        const body = `${years} year${years === 1 ? "" : "s"} married. The card said all the right things. Neither of you quite believed them.`;
        remember(p, partner, "hardship", `An anniversary that felt hollow.`);
        addLog(p, body);
        notices.push(info("A Quiet Anniversary", body, "bad"));
      }
    }

    // Separation hardens or the relationship hits a crisis.
    if (partner.separatedYear) {
      partner.relationshipBar = clamp(partner.relationshipBar - 2);
      if (p.year - partner.separatedYear >= 2 && rng.chance(0.45)) {
        const name = partner.name;
        endRelationship(p, "divorce");
        const body = `After ${p.year - partner.separatedYear} years apart, ${name} filed for divorce. The separation became permanent.`;
        addLog(p, body);
        changeStat(p, "happiness", -8);
        notices.push(info("Divorce", body, "bad"));
      }
    } else {
      const health = relationshipHealth(p, partner);
      if (health.score < 30 && rng.chance(0.4)) notices.push({ kind: "event", event: crisisEvent(p, partner) });
    }
  }

  // Exes: still in the world.
  for (const x of p.relatives) {
    if (!x.alive || x.partnerStatus !== "ex") continue;
    x.health = clamp(x.health + rng.int(x.age > 60 ? -4 : -1, 1));
    if (x.age > 40 && rng.chance(deathChance(x.age, x.health))) {
      x.alive = false;
      x.deathAge = x.age;
      x.deathYear = p.year;
      if (x.relation !== "Friend") {
        const kids = minors(p).filter((k) => k.otherParent === x.name);
        for (const k of kids) {
          k.custody = "you";
          k.relationshipBar = clamp(k.relationshipBar - 6);
          remember(p, k, "loss", `${first(k)} lost ${first(x)}, and came to live with you.`);
        }
        const body = `${x.name}, your ex, died at ${x.age}.${kids.length ? ` ${kids.length === 1 ? first(kids[0]) : "Your children"} will live with you now, and so will the grief.` : ""}`;
        addLog(p, body);
        changeStat(p, "happiness", kids.length ? -6 : -3);
        notices.push(info("An Ex Has Died", body, "bad"));
      }
    }
  }

  // Children of a split couple.
  const kids = minors(p).filter((k) => k.custody);
  if (kids.length > 0) {
    let received = 0;
    for (const k of kids) {
      const ex = p.relatives.find((r) => r.relation !== "Child" && r.partnerStatus === "ex" && r.name === k.otherParent && r.alive);
      if (k.custody === "them") k.relationshipBar = clamp(k.relationshipBar - ((prev[`rel:${k.id}`] ?? 0) >= 2 ? 1 : 3));
      if (k.custody === "you" && ex) received += Math.round(spouseIncome(ex) * 0.05);
    }
    if (received > 0) {
      p.bankBalance += received;
      addLog(p, `Child support from your ex came to ${money(received)} this year.`);
    }
  }

  // Anyone who died this year while something was left unsaid.
  for (const r of p.relatives) {
    if (r.alive || r.deathYear !== p.year || r.relation === "Pet" || r.partnerStatus === "ex") continue;
    const load = grievanceLoad(r);
    if (load >= 2) {
      const body = `You never did clear the air with ${first(r)} about ${worstGrievance(r)?.text ?? "what happened between you"}. Now you never will.`;
      changeStat(p, "happiness", -Math.min(8, load * 2));
      addLog(p, body);
      notices.push(info("Unfinished Business", body, "bad"));
    }
  }
}
