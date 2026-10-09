import type { PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { money } from "@/lib/format";
import { newAthleteState } from "./athleteState";
import { inheritBusiness } from "./business";
import { inheritRoyalty } from "./royalty";
import { beginMourning, beginReign, courtForHeir } from "./courtState";
import { newActing, newCeleb, newInfluencer, newMusic } from "./creativeState";
import {
  addLog,
  clone,
  createNewPlayer,
  educationForAge,
  isRoyal,
  logHeader,
  makeRelativeBase,
  netWorth,
} from "./state";
import { applyFamilyLegacy } from "./generations";
import { describeLife, inheritDynasty } from "./dynasty";
import { hydrateDynasty } from "./dynastyState";
import { ESTATE_TAX, divideEstate, fairness, settleDebts, type Division } from "./estate";

export interface DeathSummary {
  highestCareer: string;
  crimes: number;
  netWorth: number;
  children: number;
  lifespan: string;
  finalAssets: { cash: number; property: number; vehicles: number; investments: number; debt: number };
}

export function summarize(p: PlayerState): DeathSummary {
  return {
    highestCareer: p.stats.highestCareerTitle || (isRoyal(p) ? `${p.royalRank}` : "Never held a job"),
    crimes: p.stats.crimesCommitted,
    netWorth: netWorth(p),
    children: p.stats.childrenBorn,
    lifespan: `${p.birthYear} – ${p.deathYear ?? p.year}`,
    finalAssets: {
      cash: p.bankBalance,
      property: p.properties.reduce((s, x) => s + x.currentValue, 0),
      vehicles: p.vehicles.reduce((s, x) => s + x.currentValue, 0),
      investments: Object.values(p.investments).reduce((s, h) => s + h.value, 0) + (p.business?.value ?? 0),
      debt: p.outstandingLoans + p.properties.reduce((s, x) => s + x.mortgageBalance, 0) + p.vehicles.reduce((s, x) => s + x.loanBalance, 0),
    },
  };
}

/** A shareable plain-text obituary + life story. */
export function lifeStoryText(p: PlayerState): string {
  const sm = summarize(p);
  const lines = [
    `${p.firstName} ${p.lastName} (${sm.lifespan}), aged ${p.age}`,
    `"${epitaph(p)}"`,
    `Cause of death: ${p.causeOfDeath ?? "unknown"}`,
    `Peak career: ${sm.highestCareer} · Final net worth: $${Math.round(sm.netWorth).toLocaleString("en-US")} · Children: ${sm.children}`,
    ...(p.athlete.record.seasons > 0 ? [`Sports career (${p.athlete.sport}): ${p.athlete.record.seasons} seasons, ${p.athlete.record.titles} titles, best rating ${Math.round(p.athlete.record.bestRating)}, ${money(p.athlete.record.earnings)} earned`] : []),
    `Achievements: ${p.achievements.length}`,
    "",
  ];
  for (const l of p.lifeLog) lines.push(l.startsWith("## ") ? `\n${l.slice(3)}` : `  ${l}`);
  lines.push("", "Played on Lifeline");
  return lines.join("\n");
}

/** Dynamic Epitaph Engine. */
export function epitaph(p: PlayerState): string {
  const nw = netWorth(p);
  if (p.age < 18) return "Gone far too soon, but never forgotten.";
  if (p.stats.kills >= 3) return "A name whispered in fear long after the lights went out.";
  if (p.stats.kills >= 1 && p.karma < 30) return "They took their darkest secret to the grave.";
  if (p.karma < 20) return "A notorious rogue who terrified the public.";
  if (p.royalRank === "King" || p.royalRank === "Queen") return "A sovereign whose name echoes through the halls of history.";
  if (p.flags.includes("hall_of_fame")) return "A sporting legend, immortalised in the Hall of Fame.";
  if (p.flags.includes("doping_caught") && p.athlete.record.proSeasons > 0) return "Won it all, lost it all. The asterisk stayed.";
  if (p.athlete.record.titles >= 3 && p.fame >= 40) return "A champion whose trophies outlasted the cheers.";
  if (nw > 10_000_000) return "A brilliant tycoon who amassed massive family fortunes.";
  if (p.fame >= 70) return "A legend whose name was known in every household.";
  if (p.stats.crimesCommitted >= 5) return "A career criminal who always had one more scheme.";
  if (p.stats.yearsInPrison >= 5) return "Did the time, never did the crime. (Allegedly.)";
  if (p.karma >= 80 && p.stats.childrenBorn > 0) return "A kind soul and a loving parent, beloved by all who knew them.";
  if (p.karma >= 80) return "A kind soul beloved by all who knew them.";
  if (p.smarts >= 85) return "A brilliant mind that was far ahead of its time.";
  if (p.stats.childrenBorn >= 3) return "A devoted parent at the heart of a sprawling family.";
  if (nw < -20_000) return "Died as they lived: owing everyone money.";
  if (p.age >= 100) return "Outlived everyone, including the jokes.";
  if (p.happiness >= 80) return "They lived well and laughed often.";
  return "Lived. Laughed. Aged. Departed.";
}

export const heirs = (p: PlayerState): Relative[] =>
  p.relatives.filter((r) => r.relation === "Child" && r.alive);

function blendTalents(a: PlayerState["talents"], b: PlayerState["talents"]): PlayerState["talents"] {
  const out = { ...b };
  for (const k of Object.keys(b) as (keyof typeof b)[]) out[k] = Math.round(((a[k] ?? b[k]) + b[k]) / 2);
  return out;
}

/** Share of your cash that goes with you when you step aside (no estate tax, but you keep some to live on). */
export const HANDOVER_CASH_SHARE = 0.75;

/** Why you can't hand your life over to this child (null = you can). Only the basics: you can do it any time. */
export function handoverBlocker(p: PlayerState, child: Relative): string | null {
  if (!p.alive) return "Your story has already ended.";
  if (child.relation !== "Child" || !child.alive) return "That child can't take over.";
  return null;
}

/** Brothers and sisters judge how the estate was divided; an unfair will can start a dispute. */
function divideAmongSiblings(next: PlayerState, living: boolean, division: Division, idMap: Map<string, string>) {
  let grudge = false;
  for (const [oldId, newId] of idMap) {
    if (division.siblingCash[oldId] === undefined) continue;
    const sib = next.relatives.find((r) => r.id === newId);
    if (!sib || !sib.alive) continue;
    const f = fairness(division, oldId);
    if (f < 0.75) {
      sib.relationshipBar = Math.max(0, sib.relationshipBar - 14);
      grudge = true;
    } else if (f > 1.15) sib.relationshipBar = Math.min(100, sib.relationshipBar + 6);
  }
  const trust = next.dynasty.trust?.balance ?? 0;
  const alive = [...idMap.values()].filter((id) => next.relatives.find((r) => r.id === id)?.alive);
  if (alive.length > 0 && trust >= 100_000 && trust > division.heirCash) {
    for (const id of alive) {
      const s = next.relatives.find((r) => r.id === id)!;
      s.relationshipBar = Math.max(0, s.relationshipBar - 6);
    }
    addLog(next, `Your siblings have learned that most of the family's money sits in a trust that only your line will ever see. Nobody has said anything yet.`);
  }
  if (alive.length > 0 && division.charity > 0) addLog(next, `${money(division.charity)} of the estate went to charity, as the will asked.`);
  if (alive.length > 0 && !living) {
    const total = Object.values(division.siblingCash).reduce((s, v) => s + v, 0);
    if (total > 0) addLog(next, `Under the will your ${alive.length === 1 ? "sibling" : "siblings"} received ${money(total)} in cash.`);
  }
  if (living || alive.length === 0) return;
  if (grudge && next.bankBalance > 5_000) next.scheduled.push({ id: "estate_heir_will", dueYear: next.year + 1 });
  else if (division.heirWeight < division.equalWeight * 0.75) next.scheduled.push({ id: "estate_short_changed", dueYear: next.year + 1 });
}

/**
 * Take over as one of your children. After death (default) the old character is gone and the estate passes on with
 * 10% tax. With `living`, the old character steps aside but stays in the family as a living parent.
 */
export function continueAsChild(old: PlayerState, childId: string, rng: Rng, living = false): PlayerState | null {
  const child = heirs(old).find((c) => c.id === childId);
  if (!child) return null;
  if (living && handoverBlocker(old, child)) return null;

  const year = living ? old.year : (old.deathYear ?? old.year);
  const fresh = createNewPlayer({ scenario: "average", startYear: year, country: old.birthCountry }, rng);
  const [firstName, ...rest] = child.name.split(" ");
  const lastName = rest.join(" ") || old.lastName;
  const bizHeir = inheritBusiness(old, child.age, rng);
  const heirsLeft = heirs(old).filter((c) => c.id !== child.id);
  const will = hydrateDynasty(old).will;
  const claimants = heirs(old).map((c) => ({ id: c.id, age: c.age }));
  const equity = (x: { currentValue: number; mortgageBalance?: number; loanBalance?: number }) => x.currentValue - (x.mortgageBalance ?? 0) - (x.loanBalance ?? 0);
  const portfolio = Object.values(old.investments).reduce((s, h) => s + h.value, 0);

  // The money. After a death, debts come off the top (an insolvent estate is written off: heirs are not liable),
  // then the will divides the cash. Houses, cars, investments and any business go to the heir you play.
  let division: Division;
  let investmentFactor = 1;
  let taxPaid = 0;
  let writtenOff = 0;
  let retained = 0;
  const propertyEquity = old.properties.reduce((s, x) => s + equity(x), 0) + old.vehicles.reduce((s, x) => s + equity(x), 0);
  if (living) {
    const gift = Math.round(Math.max(0, old.bankBalance) * HANDOVER_CASH_SHARE);
    division = divideEstate(gift, propertyEquity + portfolio + (bizHeir.business?.value ?? 0), will.plan, child.id, claimants, will.chosenId);
    // What the old character keeps (a quarter of their cash and their pension pot, less debts) is their own estate, divided when they die.
    retained = Math.max(0, Math.round(old.bankBalance - gift + old.retirementSavings * 0.85 - old.outstandingLoans));
  } else {
    const settled = settleDebts(old, Math.max(0, old.bankBalance + (old.alive ? 0 : old.retirementSavings * 0.85)));
    investmentFactor = settled.investmentKeep;
    writtenOff = settled.writtenOff;
    taxPaid = Math.round(settled.cash * ESTATE_TAX);
    division = divideEstate(settled.cash - taxPaid, propertyEquity + portfolio * investmentFactor * (1 - ESTATE_TAX) + (bizHeir.business?.value ?? 0), will.plan, child.id, claimants, will.chosenId);
  }
  const inherited = division.heirCash + bizHeir.cash;
  const survivingPartner = old.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus === "married");
  const life = describeLife(old);

  const relatives: Relative[] = [];
  relatives.push({
    ...makeRelativeBase(rng, "Parent", `${old.firstName} ${old.lastName}`, old.age, old.gender, Math.min(5, Math.max(1, Math.round(1 + netWorth(old) / 400_000))), 80),
    ...(living ? { alive: true, relationshipBar: Math.max(70, child.relationshipBar) } : { alive: false, deathAge: old.age, deathYear: year }),
    // The old character's own story, not a random job: what they did and what they left.
    occupation: life.headline,
    legacyNote: life.honours.slice(0, 3).join(" · ") || undefined,
    ...(living ? { wealth: retained, willPlan: will.plan } : {}),
    // Where this royal stood in line, so the family can work out who is crowned next once the reign ends.
    ...(old.royal && (old.royal.crown === "parent" || old.royal.crown === "grandparent") ? { royalLine: old.royal.line } : {}),
    ...(living && isRoyal(old) ? { royalTitle: old.royal?.crown === "self" ? (old.gender === "Female" ? "Queen" : "King") : old.gender === "Female" ? "Princess" : "Prince" } : {}),
    ...(living && (old.isInPrison || old.pendingTrial || old.isFugitive) ? { traits: [old.isInPrison ? "In prison" : old.isFugitive ? "On the run" : "Awaiting trial"] } : {}),
  });
  if (survivingPartner) {
    // Only a spouse becomes a step-parent: a girlfriend of a few months does not become your mother.
    const stepParent = survivingPartner.age - child.age < 16;
    relatives.push({
      ...survivingPartner,
      id: rng.id(),
      relation: "Parent",
      partnerStatus: undefined,
      relationshipBar: Math.max(60, survivingPartner.relationshipBar),
      traits: [...(survivingPartner.traits ?? []).filter((t) => t !== "Step-parent"), ...(stepParent ? ["Step-parent"] : [])],
    });
  }
  // Brothers and sisters, including any who died (their children keep their place in the line of succession).
  const idMap = new Map<string, string>();
  for (const s of old.relatives.filter((r) => r.relation === "Child" && r.id !== child.id)) {
    const nid = rng.id();
    idMap.set(s.id, nid);
    const cut = division.siblingCash[s.id] ?? 0;
    relatives.push({ ...s, id: nid, relation: "Sibling", partnerStatus: undefined, ...(cut > 0 ? { wealth: (s.wealth ?? 0) + cut } : {}) });
  }
  if (living) relatives[0].willHeirId = will.chosenId === child.id ? "self" : will.chosenId ? idMap.get(will.chosenId) : undefined;
  // Your parent's grandchildren: your own children if they came through you, your nephews and nieces if through a sibling.
  for (const g of old.relatives.filter((r) => r.relation === "Grandchild" && r.alive && r.parentId)) {
    if (g.parentId === child.id) relatives.push({ ...g, id: rng.id(), relation: "Child", parentId: undefined });
    else if (idMap.has(g.parentId!)) relatives.push({ ...g, id: rng.id(), relation: "Nephew", parentId: idMap.get(g.parentId!) });
  }
  // The old player's own living parents become the new player's grandparents.
  for (const gp of old.relatives.filter((r) => r.relation === "Parent" && r.alive)) {
    relatives.push({ ...gp, id: rng.id(), relation: "Grandparent" });
  }
  // A reigning sovereign (or other royal) above them stays in the family tree, so the crown can still pass down to this line.
  for (const gg of old.relatives.filter((r) => r.relation === "Grandparent" && r.alive && r.royalTitle)) {
    relatives.push({ ...gg, id: rng.id(), relation: "Grandparent", traits: [...(gg.traits ?? []).filter((t) => t !== "Great-grandparent"), "Great-grandparent"] });
  }

  const royalHeir = inheritRoyalty(old, child, heirsLeft, rng, living);
  const royalParent = !!royalHeir || isRoyal(old);
  const next: PlayerState = {
    ...fresh,
    firstName,
    lastName,
    age: child.age,
    year,
    birthYear: year - child.age,
    birthCountry: old.birthCountry,
    birthCity: old.birthCity,
    gender: child.gender,
    karma: 50,
    fame: Math.round(old.fame * 0.3),
    happiness: 70,
    health: Math.max(60, child.health),
    smarts: child.smarts,
    looks: child.looks,
    diseases: [],
    bankBalance: inherited,
    outstandingLoans: 0, // debts die with the estate (or stay with the parent who stepped aside): the heir starts clean
    creditScore: 600,
    annualSalary: 0,
    taxesPaidThisYear: 0,
    pension: 0,
    relatives,
    properties: clone(old.properties),
    vehicles: clone(old.vehicles),
    currentJob: null,
    specialCareerPath: royalHeir && royalHeir.rank !== "none" ? "royalty" : "none",
    specialCareers: [],
    royalRank: royalHeir ? royalHeir.rank : "none",
    royal: royalHeir ? royalHeir.royal : null,
    royalRespect: royalParent ? 60 : 50,
    // Gifts run in families: half from the parent, half luck.
    talents: blendTalents(old.talents, fresh.talents),
    nation: royalParent ? { ...old.nation } : { economy: 50, freedom: 50, military: 50 },
    court: royalHeir ? courtForHeir(old, child, royalHeir.royal.crown === "self" ? "self" : "other") : fresh.court,
    education: educationForAge(child.age),
    skills: { acting: 0, music: 0, charisma: 0, athletics: rng.int(0, 20) },
    music: newMusic(),
    business: bizHeir.business,
    influencer: newInfluencer(),
    acting: newActing(),
    celeb: newCeleb(),
    athlete: newAthleteState(),
    hobbies: {},
    politics: { popularity: 30, yearsInOffice: 0, party: null },
    economy: { ...old.economy },
    residence: { ...old.residence },
    // The world carries on around the next generation; a child born abroad is a citizen of where they were born, too.
    world: structuredClone(old.world),
    immigration: { ...fresh.immigration, citizenship: [...new Set([old.birthCountry, old.residence.country, ...old.immigration.citizenship])] },
    investments: Object.fromEntries(
      Object.entries(old.investments).map(([k, h]) => [k, { value: Math.round(h.value * investmentFactor * (living ? 1 : 1 - ESTATE_TAX)), basis: Math.round(h.basis * investmentFactor * (living ? 1 : 1 - ESTATE_TAX)) }]),
    ),
    vices: { smoking: 0, alcohol: 0, drugs: 0, gambling: 0 },
    probation: null,
    pregnancy: null,
    blackjack: null,
    matureContent: old.matureContent,
    isInPrison: false,
    isFugitive: false,
    prison: null,
    pendingTrial: null,
    criminalRecord: [],
    achievements: [],
    goalsDone: [],
    challenge: old.challenge && old.challenge.status === "active" ? { ...old.challenge } : null,
    lastYear: null,
    recentCats: [],
    history: [],
    flags: royalParent ? ["royal_born"] : [],
    annual: {},
    queuedEvents: [],
    seenEvents: {},
    lifeLog: [],
    generation: old.generation + 1,
    alive: true,
    causeOfDeath: null,
    deathYear: null,
  };
  addLog(next, logHeader(next));
  addLog(next, living
    ? `${old.firstName} ${old.lastName} stepped aside. You took control of your life at age ${child.age}, with $${inherited.toLocaleString("en-US")} from your parent.`
    : `You have taken control of your life at age ${child.age}, inheriting $${inherited.toLocaleString("en-US")} from your late parent.`);
  if (old.properties.length || old.vehicles.length) {
    addLog(next, living
      ? `Your parent also signed over ${old.properties.length} propert${old.properties.length === 1 ? "y" : "ies"} and ${old.vehicles.length} vehicle${old.vehicles.length === 1 ? "" : "s"}.`
      : `You also inherited ${old.properties.length} propert${old.properties.length === 1 ? "y" : "ies"} and ${old.vehicles.length} vehicle${old.vehicles.length === 1 ? "" : "s"}.`);
  }
  if (!living && taxPaid > 0) addLog(next, `Estate tax took ${money(taxPaid)}.`);
  if (!living && writtenOff > 0) addLog(next, `The estate could not cover its debts. Creditors took everything liquid and ${money(writtenOff)} of what was owed died with your parent. You are not liable for it.`);
  else if (!living && old.outstandingLoans > 0) addLog(next, `Your parent's loans of ${money(old.outstandingLoans)} were paid off from the estate before it was divided.`);
  if (bizHeir.business) next.flags.push("business_owner");
  if (bizHeir.note) addLog(next, bizHeir.note);
  if (royalHeir) addLog(next, royalHeir.log);
  // The sovereign has died: the whole family mourns, and an heir who is crowned goes through accession.
  if (!living && royalHeir && (old.royal?.crown === "self" || old.royal?.crown === "abdicated")) {
    if (royalHeir.royal.crown === "self") beginReign(next, rng);
    else if (old.royal.crown === "self") beginMourning(next);
  }
  applyFamilyLegacy(next, old, child, rng); // family continuity: upbringing, reputation, traits, flags, opening events
  inheritDynasty(next, old, child, living, epitaph(old), rng); // chronicle, name clout, trust, grooming
  divideAmongSiblings(next, living, division, idMap);
  if (living) {
    // Nobody died: no grief, no memorial, no reading of the will. Your old self carries on as a living parent.
    for (const r of next.relatives) if (r.relation === "Parent" && r.traits?.includes("Grieving")) r.traits = r.traits.filter((t) => t !== "Grieving");
    const me = next.relatives.find((r) => r.relation === "Parent" && r.name === `${old.firstName} ${old.lastName}`);
    if (me) {
      me.smarts = old.smarts;
      me.looks = old.looks;
    }
    next.queuedEvents = next.queuedEvents.filter((e) => e !== "legacy_memorial");
    next.scheduled = next.scheduled.filter((s) => s.id !== "estate_heir_will" && s.id !== "legacy_letter_note");
    next.flags.push("parent_stepped_aside");
    if (old.isInPrison) addLog(next, `${old.firstName} is serving a sentence. You write to them when you can.`);
    else if (old.isFugitive) addLog(next, `${old.firstName} is on the run. You haven't heard from them in a while.`);
    else if (old.pendingTrial) addLog(next, `${old.firstName} faces trial and left you to run the family.`);
  }
  return next;
}
