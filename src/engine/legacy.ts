import type { PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { money } from "@/lib/format";
import { newAthleteState } from "./athleteState";
import { inheritBusiness } from "./business";
import { inheritRoyalty } from "./royalty";
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

export function continueAsChild(old: PlayerState, childId: string, rng: Rng): PlayerState | null {
  const child = heirs(old).find((c) => c.id === childId);
  if (!child) return null;

  const year = old.deathYear ?? old.year;
  const fresh = createNewPlayer({ scenario: "average", startYear: year, country: old.birthCountry }, rng);
  const [firstName, ...rest] = child.name.split(" ");
  const lastName = rest.join(" ") || old.lastName;
  const bizHeir = inheritBusiness(old, child.age, rng);
  const inherited = Math.round(Math.max(0, old.bankBalance) * 0.9) + bizHeir.cash; // 10% estate tax
  const heirsLeft = heirs(old).filter((c) => c.id !== child.id);
  const survivingPartner = old.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");

  const relatives: Relative[] = [];
  relatives.push({
    ...makeRelativeBase(rng, "Parent", `${old.firstName} ${old.lastName}`, old.age, old.gender, Math.min(5, Math.max(1, Math.round(1 + netWorth(old) / 400_000))), 80),
    alive: false,
    deathAge: old.age,
    deathYear: year,
  });
  if (survivingPartner) {
    relatives.push({ ...survivingPartner, id: rng.id(), relation: "Parent", partnerStatus: undefined, relationshipBar: Math.max(60, survivingPartner.relationshipBar) });
  }
  for (const s of heirsLeft) relatives.push({ ...s, id: rng.id(), relation: "Sibling", partnerStatus: undefined });
  // The old player's own living parents become the new player's grandparents.
  for (const gp of old.relatives.filter((r) => r.relation === "Parent" && r.alive)) {
    relatives.push({ ...gp, id: rng.id(), relation: "Grandparent" });
  }

  const royalHeir = inheritRoyalty(old, child, heirsLeft, rng);
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
    outstandingLoans: old.outstandingLoans,
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
    nation: royalParent ? { ...old.nation } : { economy: 50, freedom: 50, military: 50 },
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
    investments: Object.fromEntries(
      Object.entries(old.investments).map(([k, h]) => [k, { value: Math.round(h.value * 0.9), basis: Math.round(h.basis * 0.9) }]),
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
  addLog(next, `You have taken control of your life at age ${child.age}, inheriting $${inherited.toLocaleString("en-US")} from your late parent.`);
  if (old.properties.length || old.vehicles.length) {
    addLog(next, `You also inherited ${old.properties.length} propert${old.properties.length === 1 ? "y" : "ies"} and ${old.vehicles.length} vehicle${old.vehicles.length === 1 ? "" : "s"}. The estate tax took ${money(Math.round(Math.max(0, old.bankBalance) * 0.1))}.`);
  }
  if (bizHeir.business) next.flags.push("business_owner");
  if (bizHeir.note) addLog(next, bizHeir.note);
  if (royalHeir) addLog(next, royalHeir.log);
  return next;
}
