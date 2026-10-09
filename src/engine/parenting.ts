/** Raising children: schooling, activities, family time, discipline, and how they turn out. */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner } from "./state";
import { hash01 } from "./people";
import { meet, remember } from "./bonds";
import { firstName } from "./social";
import { occupationFor } from "@/data/occupations";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const TUTOR_COST = 1_200;
export const ACTIVITY_COST = 600;
export const PRIVATE_SCHOOL_COST = 12_000;

export const INTERESTS = [
  { id: "sport", label: "Sport", emoji: "⚽" },
  { id: "music", label: "Music", emoji: "🎸" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "science", label: "Science club", emoji: "🔬" },
] as const;

export const TEMPERAMENTS = [
  { id: "bold", label: "Bold", blurb: "Fearless, pushes every boundary." },
  { id: "shy", label: "Shy", blurb: "Watches first, speaks later." },
  { id: "curious", label: "Curious", blurb: "Asks why about everything." },
  { id: "stubborn", label: "Stubborn", blurb: "Has opinions, and keeps them." },
  { id: "gentle", label: "Gentle", blurb: "Kind, easily hurt." },
  { id: "mischievous", label: "Mischievous", blurb: "Always up to something." },
  { id: "driven", label: "Driven", blurb: "Sets goals and chases them." },
  { id: "sensitive", label: "Sensitive", blurb: "Feels everything deeply." },
] as const;

/** A child's nature. Stable for life; it decides how they respond to the way you raise them. */
export function temperamentOf(kid: Relative): (typeof TEMPERAMENTS)[number] {
  const found = TEMPERAMENTS.find((t) => t.id === kid.temperament);
  return found ?? TEMPERAMENTS[Math.floor(hash01(`${kid.id}:temper`) * TEMPERAMENTS.length)];
}

export const STYLES: { id: PlayerState["parentingStyle"]; label: string; emoji: string; blurb: string }[] = [
  { id: "strict", label: "Strict", emoji: "📏", blurb: "Clear rules and high expectations. Driven kids thrive; defiant ones rebel; sensitive ones withdraw." },
  { id: "balanced", label: "Balanced", emoji: "⚖️", blurb: "Warm but firm. No big wins, no big risks." },
  { id: "permissive", label: "Easy-going", emoji: "🌈", blurb: "Closer bonds and creativity; bold kids run wild." },
  { id: "handsoff", label: "Hands-off", emoji: "🪁", blurb: "More time for you. Kids drift, and trouble finds them." },
];

export function setParentingStyle(p0: PlayerState, style: PlayerState["parentingStyle"]): ActionResult {
  if (p0.parentingStyle === style) return { player: p0 };
  const p = clone(p0);
  p.parentingStyle = style;
  return { player: p };
}

/** Yearly effect of your parenting style on one child: bond, smarts, and the chance of trouble. */
export function styleEffect(style: PlayerState["parentingStyle"], temper: string): { bond: number; smarts: number; trouble: number } {
  const defiant = temper === "bold" || temper === "stubborn" || temper === "mischievous";
  const tender = temper === "shy" || temper === "sensitive" || temper === "gentle";
  switch (style) {
    case "strict":
      return defiant ? { bond: -3, smarts: 0, trouble: 0.1 } : tender ? { bond: -2, smarts: 1, trouble: 0 } : temper === "driven" ? { bond: 0, smarts: 2, trouble: -0.04 } : { bond: -1, smarts: 1, trouble: -0.02 };
    case "permissive":
      return defiant ? { bond: 2, smarts: 0, trouble: 0.1 } : tender ? { bond: 3, smarts: 0, trouble: 0 } : { bond: 2, smarts: temper === "curious" ? 1 : 0, trouble: 0.01 };
    case "handsoff":
      return { bond: -3, smarts: -1, trouble: 0.08 };
    default:
      return { bond: 1, smarts: 0, trouble: 0 };
  }
}

export type ChildAction = "tutor" | "activity" | "family" | "school" | "talk";

const kidOf = (p: PlayerState, id: string): Relative | undefined => p.relatives.find((r) => r.id === id && r.alive && r.relation === "Child" && r.age < 18);

export function childAction(p0: PlayerState, kidId: string, action: ChildAction, rng: Rng, interest?: Relative["interest"]): ActionResult {
  const p = clone(p0);
  const kid = kidOf(p, kidId);
  if (!kid) return { player: p0 };
  const n = firstName(kid);
  const key = `kid:${action}:${kid.id}`;
  if (action !== "school" && (p.annual[key] ?? 0) >= 1) return { player: p0, notices: [info("Already Done", `You've already done that with ${n} this year.`)] };

  if (action === "school") {
    if (kid.age < 5) return { player: p0, notices: [info("Too Young", `${n} isn't old enough for school yet.`)] };
    kid.school = kid.school === "private" ? "public" : "private";
    const body = kid.school === "private" ? `You enrolled ${n} in a private school (${money(PRIVATE_SCHOOL_COST)} a year).` : `You moved ${n} to the local public school.`;
    addLog(p, body);
    return { player: p, notices: [info("School Choice", body)] };
  }
  if (action === "tutor") {
    if (kid.age < 5) return { player: p0 };
    if (p.bankBalance < TUTOR_COST) return { player: p0, notices: [info("Insufficient Funds", `A tutor costs ${money(TUTOR_COST)}.`, "bad")] };
    p.annual[key] = 1;
    p.bankBalance -= TUTOR_COST;
    const gain = rng.int(2, 5);
    kid.smarts = clamp(kid.smarts + gain);
    kid.relationshipBar = clamp(kid.relationshipBar + (rng.chance(0.5) ? 2 : -2));
    const body = `A tutor worked with ${n} all year. Smarts +${gain}.`;
    addLog(p, body);
    return { player: p, notices: [info("Extra Lessons", body, "good")] };
  }
  if (action === "activity") {
    if (kid.age < 4) return { player: p0 };
    if (p.bankBalance < ACTIVITY_COST) return { player: p0, notices: [info("Insufficient Funds", `That costs ${money(ACTIVITY_COST)}.`, "bad")] };
    p.annual[key] = 1;
    p.bankBalance -= ACTIVITY_COST;
    kid.interest = interest ?? "sport";
    kid.relationshipBar = clamp(kid.relationshipBar + 5);
    if (kid.interest === "science") kid.smarts = clamp(kid.smarts + 2);
    if (kid.interest === "art") kid.looks = clamp(kid.looks + 1);
    const label = INTERESTS.find((i) => i.id === kid.interest)?.label.toLowerCase() ?? "something";
    const body = `You signed ${n} up for ${label}. They threw themselves into it.`;
    addLog(p, body);
    return { player: p, notices: [info("A New Passion", body, "good")] };
  }
  if (action === "family") {
    p.annual[key] = 1;
    kid.relationshipBar = clamp(kid.relationshipBar + 10);
    changeStat(p, "happiness", 3);
    const mate = getPartner(p);
    if (mate) meet(p, mate, "family");
    const body = `A whole weekend with ${n}, no phones. They talked about everything.`;
    addLog(p, body);
    return { player: p, notices: [info("Family Time", body, "good")] };
  }
  // talk: sit down about problems
  p.annual[key] = 1;
  kid.relationshipBar = clamp(kid.relationshipBar + 5);
  if ((kid.trouble ?? 0) > 0) {
    kid.trouble = Math.max(0, (kid.trouble ?? 0) - 1);
    const body = `You sat ${n} down and listened first. Things at school have calmed down.`;
    addLog(p, body);
    return { player: p, notices: [info("A Real Talk", body, "good")] };
  }
  const body = `You and ${n} had a heart-to-heart. They said it meant a lot.`;
  addLog(p, body);
  return { player: p, notices: [info("A Real Talk", body, "good")] };
}

/** Yearly cost of private schooling for all your children. */
export function schoolCosts(p: PlayerState): number {
  return p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age >= 5 && r.age < 18 && r.school === "private").length * PRIVATE_SCHOOL_COST;
}

/** Yearly: children grow, get into trouble when neglected, and launch at 18. */
export function processChildren(p: PlayerState, rng: Rng, notices: Notices) {
  const tier = Math.min(5, Math.max(1, Math.round(1 + (p.bankBalance + p.retirementSavings) / 150_000)));
  for (const kid of p.relatives) {
    if (kid.relation !== "Child" || !kid.alive) continue;
    const n = firstName(kid);
    if (kid.age < 18) {
      kid.smarts = clamp(kid.smarts + rng.int(0, 2) + (kid.school === "private" ? 1 : 0));
      // How you raise them, and who they are, shape the bond. (Kids who live mostly elsewhere are not shaped by your style.)
      const fx = kid.age >= 3 && !kid.custody ? styleEffect(p.parentingStyle ?? "balanced", temperamentOf(kid).id) : { bond: 0, smarts: 0, trouble: 0 };
      kid.relationshipBar = clamp(kid.relationshipBar + fx.bond);
      kid.smarts = clamp(kid.smarts + fx.smarts);
      if (kid.age >= 12 && (kid.relationshipBar < 40 || fx.trouble >= 0.08) && rng.chance(Math.max(0, 0.12 + (kid.trouble ?? 0) * 0.05 + fx.trouble))) {
        kid.trouble = (kid.trouble ?? 0) + 1;
        const cost = rng.int(300, 2_500);
        p.bankBalance = Math.max(0, p.bankBalance - cost);
        changeStat(p, "happiness", -4);
        const body = `${n} got into trouble this year (a fight, skipping school, and a call from the principal). It cost ${money(cost)} to smooth over. Maybe it's time for a real talk.`;
        addLog(p, body);
        notices.push(info("Teenage Trouble", body, "bad"));
      }
    }
    if (kid.age === 18) {
      const bonus = (kid.school === "private" ? 0.4 : 0) + (kid.interest === "science" ? 0.2 : 0) + (kid.traits?.includes("College fund") ? 0.5 : 0);
      kid.incomeTier = Math.min(5, Math.max(1, Math.round(1 + (kid.smarts - 30) / 20 + bonus + (tier - 3) * 0.3 - (kid.trouble ?? 0) * 0.3)));
      kid.occupation = kid.smarts >= 62 && (kid.trouble ?? 0) < 2 ? `University student (${occupationFor(kid.incomeTier, rng).toLowerCase()} in the making)` : occupationFor(Math.max(1, kid.incomeTier - 1), rng);
      const body = `${n} turned 18 and set out on their own: ${kid.occupation}.`;
      addLog(p, body);
      remember(p, kid, "milestone", `${n} turned 18 and left home.`);
      notices.push(info("All Grown Up", body, "good"));
    }
  }
  const minorsNow = p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age < 18 && !r.custody).length;
  if (minorsNow > 0 && p.parentingStyle === "handsoff") changeStat(p, "happiness", 1);
  processAdultChildren(p, rng, notices);
}

/** Grown children have lives: partners, weddings, and the grandchildren that follow. */
function processAdultChildren(p: PlayerState, rng: Rng, notices: Notices) {
  for (const kid of p.relatives) {
    if (kid.relation !== "Child" || !kid.alive || kid.age < 22 || kid.age > 45) continue;
    const traits = (kid.traits = kid.traits ?? []);
    const n = firstName(kid);
    const close = kid.relationshipBar >= 45;
    if (!traits.includes("Married") && !traits.includes("Partnered") && rng.chance(0.07)) {
      traits.push("Partnered");
      remember(p, kid, "milestone", `${n} brought someone home.`);
      const body = close ? `${n} called to say they've met someone, and asked if they could bring them to Sunday lunch.` : `You heard through a cousin that ${n} is seeing someone. They hadn't told you.`;
      addLog(p, body);
      notices.push(info("Your Child Is in Love", body, close ? "good" : "bad"));
    } else if (traits.includes("Partnered") && !traits.includes("Married") && kid.age >= 24 && rng.chance(0.18)) {
      traits.splice(traits.indexOf("Partnered"), 1, "Married");
      remember(p, kid, "milestone", `${n} got married.`);
      changeStat(p, "happiness", close ? 4 : 1);
      const body = close ? `${n} got married. You gave a toast, cried, and danced badly.` : `${n} got married. You were invited, but sat at the far end of the room, and it showed.`;
      addLog(p, body);
      notices.push(info("A Wedding in the Family", body, close ? "good" : "neutral"));
    }
  }
}
