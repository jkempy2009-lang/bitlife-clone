/**
 * Staff as people. Beyond the anonymous headcount, a company can hold up to three named key employees (one per role):
 * the craftsperson who sets quality, the rainmaker who wins customers, the operator who keeps the machine running.
 * They cost real money, they have loyalty, rivals try to poach them, and when they walk they take things with them
 * (sometimes a new competitor). Candidates are deterministic for a given year so the UI can show who is on offer.
 */
import type { ActionResult, Business, KeyPerson, KeyRole, PlayerState } from "@/types/game.types";
import { hashString, makeRng, type Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import type { BusinessType } from "@/data/businessTypes";
import { addLog } from "./state";
import { canSpend, done, fromWhere, info, open, poor, spend, unchanged, type Notices } from "./businessKit";
import { kindOf } from "./businessModel";

export const MAX_TEAM = 3;
export const ROLES: KeyRole[] = ["craft", "sales", "ops"];
export const ROLE_BLURB: Record<KeyRole, string> = {
  craft: "Sets the standard: lifts product quality and reputation.",
  sales: "Brings the customers in: lifts demand.",
  ops: "Keeps it running: adds capacity, trims costs, keeps you compliant.",
};

const TITLES: Record<string, Record<KeyRole, string>> = {
  foodtruck: { craft: "Head cook", sales: "Social media lead", ops: "Prep and logistics lead" },
  onlinestore: { craft: "Product designer", sales: "Growth marketer", ops: "Fulfilment lead" },
  boutique: { craft: "Buyer and stylist", sales: "Client relations lead", ops: "Store operations lead" },
  consultancy: { craft: "Principal consultant", sales: "Rainmaker", ops: "Practice manager" },
  farm: { craft: "Head grower", sales: "Market liaison", ops: "Farm operations lead" },
  barcafe: { craft: "Head barista", sales: "Events promoter", ops: "Operations lead" },
  restaurant: { craft: "Head chef", sales: "Events and marketing manager", ops: "Operations manager" },
  gym: { craft: "Head coach", sales: "Membership sales lead", ops: "Facility manager" },
  construction: { craft: "Site foreman", sales: "Estimator and bid manager", ops: "Project operations manager" },
  logistics: { craft: "Fleet chief", sales: "Key accounts manager", ops: "Dispatch manager" },
  nightclub: { craft: "Resident DJ and booker", sales: "Promoter", ops: "Head of security and operations" },
  startup: { craft: "CTO", sales: "Head of growth", ops: "COO" },
};

export const roleTitle = (kindId: string, role: KeyRole) => (TITLES[kindId] ?? TITLES.restaurant)[role];

const FIRST = ["Mia", "Jonas", "Priya", "Tomas", "Aisha", "Leo", "Nadia", "Marcus", "Elena", "Sam", "Ines", "Kofi", "Hana", "Ravi", "Lucia", "Omar", "Freya", "Diego", "Mei", "Callum"];
const LAST = ["Okafor", "Lindqvist", "Patel", "Novak", "Haddad", "Brooks", "Tanaka", "Reyes", "Moreau", "Kowalski", "Mensah", "Costa", "Ivanov", "Walsh", "Sato", "Duarte"];

export const keyWage = (k: BusinessType, skill: number) => Math.round((k.wage * (1.5 + (skill - 50) / 100)) / 500) * 500;
export const recruitFee = (wage: number) => Math.round(wage * 0.2);
export const raiseOf = (t: KeyPerson) => Math.round((t.wage * 0.12) / 100) * 100;
export const equitySlice = 0.03;

/** The candidate on the market for a role this year (the same one every time you look, until the year turns). */
export function candidateFor(p: PlayerState, b: Business, role: KeyRole): KeyPerson {
  const k = kindOf(b);
  const rng = makeRng(hashString(`${p.id}${p.year}${b.name}${role}${b.team.length}`));
  const skill = Math.round(clamp(34 + 58 * Math.pow(rng.next(), 0.9), 34, 92));
  const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  return {
    id: `${role}-${p.year}-${rng.int(100, 999)}`,
    name, role, title: roleTitle(k.id, role), skill, loyalty: 60, wage: keyWage(k, skill), hired: p.year, partner: false,
  };
}

export function teamBlocker(p: PlayerState, b: Business, role: KeyRole): string | null {
  if (b.team.some((t) => t.role === role)) return `You already have a ${roleTitle(b.kind, role).toLowerCase()}.`;
  if (b.team.length >= MAX_TEAM) return "You can't carry more than three key people.";
  if (p.isInPrison) return "You can't interview anyone from a cell.";
  return null;
}

export function recruitKey(p0: PlayerState, role: KeyRole): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { p, b } = c;
  const blocked = teamBlocker(p, b, role);
  if (blocked) return unchanged(p0, "Can't Recruit", blocked);
  const cand = candidateFor(p, b, role);
  const fee = recruitFee(cand.wage);
  if (!canSpend(p, b, fee)) return poor(p0, "A headhunter's fee", fee);
  const src = spend(p, b, fee, false)!;
  b.team.push(cand);
  b.morale = clamp(b.morale + 2);
  return done(c, "Key Hire", `${cand.name} joined ${b.name} as ${cand.title.toLowerCase()} (skill ${cand.skill}) at ${money(cand.wage)} a year, with a ${money(fee)} search fee ${fromWhere(src)}. ${ROLE_BLURB[role]}`);
}

export function giveRaise(p0: PlayerState, id: string): ActionResult {
  const c = open(p0);
  const t = c?.b.team.find((x) => x.id === id);
  if (!c || !t) return { player: p0 };
  if ((c.p.annual[`raise_${id}`] ?? 0) >= 1) return unchanged(p0, "Already Rewarded", `${t.name} has had a raise this year.`);
  c.p.annual[`raise_${id}`] = 1;
  const up = raiseOf(t);
  t.wage += up;
  t.loyalty = clamp(t.loyalty + 15);
  return done(c, "Raise Granted", `${t.name} now earns ${money(t.wage)} (+${money(up)}). They feel valued, and recruiters will find them harder to tempt.`);
}

export function offerEquity(p0: PlayerState, id: string): ActionResult {
  const c = open(p0);
  const t = c?.b.team.find((x) => x.id === id);
  if (!c || !t) return { player: p0 };
  const { b } = c;
  if (t.partner) return unchanged(p0, "Already a Partner", `${t.name} already owns a slice of ${b.name}.`);
  if (b.ownerShare - equitySlice < 0.3) return unchanged(p0, "Too Little Left", "You would be left with too small a share of your own company to hand out more.", "bad");
  b.ownerShare = Math.round((b.ownerShare - equitySlice) * 1000) / 1000;
  b.investors.push({ id: `staff-${t.id}`, name: t.name, kind: "staff", share: equitySlice, agenda: "profit", invested: 0, pref: false, since: c.p.year });
  t.partner = true;
  t.loyalty = 95;
  b.morale = clamp(b.morale + 3);
  return done(c, "Partner Made", `${t.name} now owns ${Math.round(equitySlice * 100)}% of ${b.name}. They think like an owner and are very hard to poach, but that slice of every payout and exit is theirs for good.`);
}

export function dismissKey(p0: PlayerState, id: string): ActionResult {
  const c = open(p0);
  const t = c?.b.team.find((x) => x.id === id);
  if (!c || !t) return { player: p0 };
  const { b } = c;
  const sev = Math.round(t.wage * 0.3);
  if (!spend(c.p, b, sev, false)) b.cash -= sev;
  b.team = b.team.filter((x) => x.id !== id);
  // A partner keeps their shares even when dismissed.
  b.morale = clamp(b.morale - (t.loyalty > 70 ? 6 : 3));
  return done(c, "Parted Ways", `You let ${t.name} (${t.title.toLowerCase()}) go with ${money(sev)} severance.${t.partner ? " They keep their shares in the company." : ""}`, "neutral");
}

/** The key person most likely to be listening to recruiters (for events). */
export function flightRisk(b: Business): KeyPerson | null {
  const pool = b.team.filter((t) => !t.partner);
  if (pool.length === 0) return null;
  return [...pool].sort((x, y) => x.loyalty - y.loyalty || y.skill - x.skill)[0];
}

/** Event helper: respond to a poaching attempt on the flight-risk key person. */
export function bizKeyCounter(p: PlayerState, mode: "raise" | "equity" | "release"): string | undefined {
  const b = p.business;
  if (!b) return undefined;
  const t = flightRisk(b);
  if (!t) return undefined;
  if (mode === "raise") {
    const up = Math.round((t.wage * 0.15) / 100) * 100;
    t.wage += up;
    t.loyalty = clamp(t.loyalty + 25);
    return `${t.name} stays on ${money(t.wage)} a year (+${money(up)}).`;
  }
  if (mode === "equity" && b.ownerShare - equitySlice >= 0.3) {
    b.ownerShare = Math.round((b.ownerShare - equitySlice) * 1000) / 1000;
    b.investors.push({ id: `staff-${t.id}`, name: t.name, kind: "staff", share: equitySlice, agenda: "profit", invested: 0, pref: false, since: p.year });
    t.partner = true;
    t.loyalty = 95;
    return `${t.name} took ${Math.round(equitySlice * 100)}% of the company and tore up the other offer.`;
  }
  b.team = b.team.filter((x) => x.id !== t.id);
  applyDeparture(b, t);
  return `${t.name} left for the rival. ${roleLoss(t.role)}`;
}

const roleLoss = (role: KeyRole) => (role === "craft" ? "Quality will suffer until you find a replacement." : role === "sales" ? "Some of their customers went with them." : "Operations will be bumpier without them.");

function applyDeparture(b: Business, t: KeyPerson) {
  if (t.role === "craft") b.quality = clamp(b.quality - 5 - t.skill / 20);
  else if (t.role === "sales") b.customers = clamp(b.customers - 3 - t.skill / 15);
  else b.compliance = clamp(b.compliance - 10 - t.skill / 10);
  b.morale = clamp(b.morale - 4);
}

/** Yearly: skills grow, loyalty drifts with morale and results, and people walk. */
export function processTeam(p: PlayerState, b: Business, rng: Rng, notices: Notices, lastProfit: number) {
  if (b.team.length === 0) return;
  const keep: KeyPerson[] = [];
  for (const t of b.team) {
    if (t.skill < 95 && rng.chance(0.6)) t.skill = Math.min(95, t.skill + rng.int(0, 2));
    const target = 52 + (b.morale - 55) * 0.5 + (t.partner ? 28 : 0) + (lastProfit < 0 ? -6 : 3) + (b.manager ? 0 : 0);
    t.loyalty = Math.round(clamp(t.loyalty + 0.3 * (target - t.loyalty) + rng.int(-4, 4)));
    const pLeave = clamp(0.03 + Math.max(0, 60 - t.loyalty) * 0.004 + (t.skill > 75 ? 0.03 : 0) + b.rivals.length * 0.015, 0.01, 0.4) * (t.partner ? 0.15 : 1);
    if (!rng.chance(pLeave)) {
      keep.push(t);
      continue;
    }
    applyDeparture(b, t);
    let extra = "";
    if (t.skill >= 60 && b.rivals.length < 3 && rng.chance(0.3)) {
      const surname = t.name.split(" ").slice(-1)[0];
      b.rivals.push({ id: `spin-${t.id}`, name: `${surname} & Co`, kind: "upstart", strength: Math.round(18 + t.skill * 0.3), since: p.year });
      extra = ` They set up as ${surname} & Co, a new competitor on your doorstep.`;
    }
    const body = `${t.name}, your ${t.title.toLowerCase()}, resigned. ${roleLoss(t.role)}${extra}`;
    addLog(p, body);
    notices.push(info("Key Person Left", body, "bad"));
  }
  b.team = keep;
}

/** Plain-language flags for the dashboard. */
export function teamNotes(b: Business): string[] {
  const notes: string[] = [];
  for (const t of b.team) if (!t.partner && t.loyalty < 40) notes.push(`${t.name} (${t.title.toLowerCase()}) is restless and probably talking to recruiters.`);
  return notes;
}
