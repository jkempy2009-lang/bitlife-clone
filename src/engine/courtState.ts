/**
 * Court state factory, save migration, and the hooks that fire when a reign begins or a monarch's death is
 * mourned. Kept light on imports (only state helpers used inside functions) so state.ts, save.ts, legacy.ts and
 * royalty.ts can use it without trouble.
 */
import type { CourtState, PlayerState, Relative, RoyalTraining } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { REALM_NAMES, TERRITORY_NAMES } from "@/data/court";
import { addLog, randomName } from "./state";

export const newCourt = (approval = 55): CourtState => ({
  approval,
  republic: 15,
  heat: 20,
  strain: 0,
  government: 60,
  pm: "",
  secretary: 0,
  patronages: [],
  service: null,
  scandal: null,
  regnalName: null,
  mourning: 0,
  regency: null,
  coronated: false,
  realmNames: [],
  withdrawn: 0,
  disgraced: false,
  steppedBack: false,
  abdicated: false,
  lastReferendum: 0,
  estateOpen: false,
  slimmed: false,
  grantAdj: 0,
  booked: {},
  slotsLast: 0,
  ledger: { grant: 0, duchy: 0, estate: 0, allowance: 0, staff: 0, upkeep: 0 },
});

/** Realms that share the sovereign, by country (the British Commonwealth realms, the Kingdom of the Netherlands' territories). */
export function realmNamesFor(country: string): string[] {
  if (country === "United Kingdom") return REALM_NAMES.slice(0, 12);
  if (country === "Netherlands") return [...TERRITORY_NAMES];
  return [];
}

/** Fill in missing fields so older saves keep working. */
export function hydrateCourt(raw: Partial<CourtState> | undefined, p: Pick<PlayerState, "royal" | "royalRank" | "birthCountry">): CourtState {
  const base = newCourt();
  const c: CourtState = {
    ...base,
    ...(raw ?? {}),
    patronages: raw?.patronages ?? [],
    booked: raw?.booked ?? {},
    realmNames: raw?.realmNames ?? [],
    ledger: { ...base.ledger, ...(raw?.ledger ?? {}) },
  };
  // Saves from before the court existed: royals share the Crown's realms, and a sitting sovereign is already crowned.
  if (!raw && (p.royal || p.royalRank !== "none")) c.realmNames = realmNamesFor(p.birthCountry);
  if (!raw && (p.royal?.crown === "self" || p.royalRank === "King" || p.royalRank === "Queen")) c.coronated = true;
  return c;
}

export const isSovereign = (p: PlayerState) => p.alive && p.royal?.crown === "self" && (p.royalRank === "King" || p.royalRank === "Queen");

const ROMAN: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n: number): string {
  let out = "";
  let rest = n;
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out;
}

/** The people who run the government change from time to time. */
export function newPrimeMinister(p: PlayerState, rng: Rng) {
  const gender = rng.pick(["Male", "Female"]);
  const n = randomName(p.birthCountry, gender, rng);
  p.court.pm = `${n.first} ${n.last}`;
  p.court.government = clamp(p.court.government + rng.int(-12, 8), 20, 90);
}

/** The monarch has died. Everyone in the family mourns; engagements are curtailed for a year. */
export function beginMourning(p: PlayerState) {
  p.court.mourning = Math.max(p.court.mourning, 1);
  if (!p.queuedEvents.includes("crown_state_funeral")) p.queuedEvents.push("crown_state_funeral");
}

/** You are the sovereign now: mourning, the Accession Council, a coronation to come, and a regency if you are a minor. */
export function beginReign(p: PlayerState, rng: Rng) {
  const c = p.court;
  beginMourning(p);
  c.coronated = false;
  c.regnalName = null;
  c.abdicated = false;
  c.strain = 0;
  c.approval = clamp(c.approval + 8);
  if (!c.pm) newPrimeMinister(p, rng);
  if (p.age < 18) {
    const parent = p.relatives.find((r) => r.alive && r.relation === "Parent" && r.partnerStatus !== "ex");
    c.regency = parent ? parent.name : "the Counsellors of State";
    addLog(p, `You are crowned as a minor. ${c.regency} acts as Regent until you turn 18.`);
  }
  if (!p.queuedEvents.includes("crown_accession_council")) p.queuedEvents.push("crown_accession_council");
  if (!p.scheduled.some((s) => s.id === "crown_coronation")) p.scheduled.push({ id: "crown_coronation", dueYear: p.year + 1 });
}

/** Training defaults for a royal child. */
export const defaultTraining = (): RoyalTraining => ({ duty: 50, touch: 50, polish: 50, school: "tutors" });
export const trainingOf = (r: Relative): RoyalTraining => r.royalTraining ?? defaultTraining();

/**
 * The court a new generation inherits: the institution (realms, government, mood of the country) carries over,
 * while personal popularity, patronages and service reflect how the heir was brought up.
 */
export function courtForHeir(old: PlayerState, child: Relative, crown: "self" | "other"): CourtState {
  const t = trainingOf(child);
  const c = newCourt(clamp(Math.round(50 + (t.touch - 50) / 4 + (t.polish - 50) / 8 + (old.court.approval - 50) * 0.3)));
  c.republic = Math.round(old.court.republic * 0.85);
  c.heat = Math.round(old.court.heat * 0.6);
  c.government = old.court.government;
  c.pm = old.court.pm;
  c.realmNames = [...old.court.realmNames];
  c.slimmed = old.court.slimmed;
  c.grantAdj = old.court.grantAdj;
  c.estateOpen = old.court.estateOpen;
  c.lastReferendum = old.court.lastReferendum;
  c.secretary = crown === "self" ? Math.max(2, Math.min(3, old.court.secretary)) : Math.min(1, old.court.secretary);
  if (t.patron && child.age >= 16) c.patronages.push({ id: t.patron, years: Math.max(0, child.age - 16), lastYear: old.deathYear ?? old.year });
  if (t.service && child.age >= 18) c.service = { branch: t.service, years: Math.min(6, child.age - 18), rank: Math.min(3, child.age - 19 > 0 ? Math.floor((child.age - 18) / 2) : 0), deployed: false, deployments: 0, done: child.age >= 26 };
  return c;
}
