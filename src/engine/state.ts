import type {
  Chip,
  EducationState,
  PlayerState,
  Relative,
  RoyalRank,
} from "@/types/game.types";
import { clamp } from "@/lib/format";
import { makeRng, type Rng } from "@/lib/rng";
import { COUNTRIES, MONARCHIES, getCountry } from "@/data/countries";
import { classicFirstName, lastNameFor } from "@/data/names";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { occupationFor } from "@/data/occupations";
import { newRoyalLife, royalStyleText } from "./royalty";
import { newAthleteState } from "./athleteState";
import { newCourt, realmNamesFor } from "./courtState";
import { freshJustice, freshMob, freshSpy, freshStatecraft } from "./justiceState";
import { newActing, newCeleb, newInfluencer, newMusic } from "./creativeState";

export const MAX_AGE = 120;

export const clone = <T,>(x: T): T => structuredClone(x);

export function addLog(p: PlayerState, text: string) {
  p.lifeLog.push(text);
}

export function logHeader(p: PlayerState) {
  return `## Age ${p.age} · ${p.year}`;
}

export function changeStat(
  p: PlayerState,
  key: "happiness" | "health" | "smarts" | "looks" | "karma" | "fame" | "royalRespect",
  delta: number | undefined,
) {
  if (!delta) return;
  p[key] = clamp(Math.round(p[key] + delta));
}

export function clampAll(p: PlayerState) {
  for (const k of ["happiness", "health", "smarts", "looks", "karma", "fame", "royalRespect"] as const) {
    p[k] = clamp(Math.round(p[k]));
  }
  p.creditScore = clamp(Math.round(p.creditScore), 300, 850);
  p.skills.acting = clamp(p.skills.acting);
  p.skills.music = clamp(p.skills.music);
  p.skills.charisma = clamp(p.skills.charisma);
  p.skills.athletics = clamp(p.skills.athletics);
}

export function netWorth(p: PlayerState): number {
  const props = p.properties.reduce((s, x) => s + x.currentValue - x.mortgageBalance, 0);
  const cars = p.vehicles.reduce((s, x) => s + x.currentValue - x.loanBalance, 0);
  const portfolio = Object.values(p.investments).reduce((sum, h) => sum + h.value, 0);
  return Math.round(p.bankBalance + props + cars + portfolio + (p.business?.value ?? 0) + p.retirementSavings - p.outstandingLoans);
}

export const isRoyal = (p: PlayerState) => p.royalRank !== "none";
export const hasFlag = (p: PlayerState, f: string) => p.flags.includes(f);
export function setFlag(p: PlayerState, f: string) {
  if (!p.flags.includes(f)) p.flags.push(f);
}
export function clearFlag(p: PlayerState, f: string) {
  p.flags = p.flags.filter((x) => x !== f);
}

export const livingRelatives = (p: PlayerState, relation?: Relative["relation"]) =>
  p.relatives.filter(
    (r) => r.alive && !(r.partnerStatus === "ex") && (!relation || r.relation === relation),
  );

export const getPartner = (p: PlayerState): Relative | undefined =>
  p.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");

export const hasPartner = (p: PlayerState) => !!getPartner(p);

export function hasDegree(p: PlayerState, req: string): boolean {
  return p.education.degrees.some((d) => d === req || (req === "bachelor" && d.startsWith("bachelor:")));
}

export function hasAnyDegree(p: PlayerState, reqs: string[] | undefined): boolean {
  if (!reqs || reqs.length === 0) return true;
  return reqs.some((r) => hasDegree(p, r));
}

export function playerTitle(p: PlayerState): string {
  if (!p.alive) return "Deceased";
  if (p.isInPrison) return "Inmate";
  if (p.royal) return royalStyleText(p) || (p.royal.peerage ?? "Lord");
  if (p.music.signed) return `${p.music.status === "band" ? "Band Member" : "Recording Artist"}`;
  if (p.currentJob) return p.currentJob.title;
  if (p.business) return "Business Owner";
  if (p.influencer.active && p.influencer.followers >= 10_000) return "Influencer";
  const st = p.education.stage;
  if (p.athlete?.stage === "college") return "College Athlete";
  if (st === "University") return "University Student";
  if (st === "MedicalSchool") return "Medical Student";
  if (st === "LawSchool") return "Law Student";
  if (st === "HighSchool") return "High School Student";
  if (st === "Primary") return "Student";
  if (p.age < 5) return p.age < 2 ? "Infant" : "Toddler";
  if (p.athlete?.stage === "retired" && p.pension === 0) return "Former Athlete";
  if (p.pension > 0) return "Retired";
  if (p.isFugitive) return "Fugitive";
  return "Unemployed";
}

export function educationForAge(age: number): EducationState {
  const base: EducationState = {
    stage: "None",
    yearsLeft: 0,
    major: null,
    grades: 60,
    studyEffort: 0,
    degrees: [],
  };
  if (age >= 5 && age < 14) return { ...base, stage: "Primary", yearsLeft: 14 - age };
  if (age >= 14 && age < 18) return { ...base, stage: "HighSchool", yearsLeft: 18 - age };
  if (age >= 18) return { ...base, degrees: ["highschool"] };
  return base;
}

export function royalRankFor(gender: string, king: boolean): RoyalRank {
  const male = gender === "Male";
  if (king) return male ? "King" : "Queen";
  return male ? "Prince" : "Princess";
}

export function randomName(
  countryName: string,
  gender: string,
  rng: Rng,
): { first: string; last: string } {
  const c = getCountry(countryName);
  const pool =
    gender === "Male" ? c.maleNames : gender === "Female" ? c.femaleNames : [...c.maleNames, ...c.femaleNames];
  return { first: rng.pick(pool), last: lastNameFor(countryName, rng) };
}

export function randomGender(rng: Rng): string {
  const r = rng.next();
  if (r < 0.485) return "Male";
  if (r < 0.97) return "Female";
  return "Non-binary";
}

export function partnerGenderFor(p: PlayerState, rng: Rng): string {
  const opposite = p.gender === "Male" ? "Female" : p.gender === "Female" ? "Male" : randomGender(rng);
  if (p.sexuality === "Gay") return p.gender === "Non-binary" ? randomGender(rng) : p.gender;
  if (p.sexuality === "Bisexual") return rng.chance(0.5) ? "Male" : "Female";
  return opposite;
}

export interface NewLifeOptions {
  firstName?: string;
  lastName?: string;
  gender?: "Male" | "Female" | "Non-binary" | "random";
  country?: string | "random";
  scenario: "random" | "average" | "wealthy" | "struggling" | "celebrity" | "royal";
  startYear: number;
  /** Optional scenario challenge id (see data/challenges.ts). */
  challenge?: string;
  /** Hand-picked starting traits from character design (0-100). */
  stats?: { happiness: number; health: number; smarts: number; looks: number };
  /** Hidden gifts picked in character design (0-100); anything omitted is randomised. */
  talents?: Partial<import("@/types/game.types").Talents>;
  /** Free-edit design (no point budget): fine to play, but challenge wins don't count. */
  freeStats?: boolean;
}

const TRAITS: Record<string, { open: number; jealous: number }> = {
  Loyal: { open: -10, jealous: 5 },
  Adventurous: { open: 30, jealous: -5 },
  Jealous: { open: -10, jealous: 40 },
  Romantic: { open: 5, jealous: 10 },
  Ambitious: { open: 0, jealous: 0 },
  Easygoing: { open: 10, jealous: -20 },
  Wild: { open: 30, jealous: 0 },
  Reserved: { open: -25, jealous: 5 },
  Kind: { open: 0, jealous: -10 },
  "Hot-tempered": { open: 0, jealous: 20 },
};

export function rollPersonality(rng: Rng): { traits: string[]; openness: number; jealousy: number } {
  const names = Object.keys(TRAITS);
  const a = rng.pick(names);
  let b = rng.pick(names);
  if (b === a) b = names[(names.indexOf(a) + 3) % names.length];
  const traits = [a, b];
  const openness = clamp(Math.round(35 + TRAITS[a].open + TRAITS[b].open + rng.int(-15, 15)));
  const jealousy = clamp(Math.round(40 + TRAITS[a].jealous + TRAITS[b].jealous + rng.int(-15, 15)));
  return { traits, openness, jealousy };
}

export function makeRelativeBase(
  rng: Rng,
  relation: Relative["relation"],
  name: string,
  age: number,
  gender: string,
  incomeTier: number,
  bar: number,
): Relative {
  const rel: Relative = {
    id: rng.id(),
    relation,
    name,
    age,
    relationshipBar: clamp(bar),
    health: rng.int(55, 100),
    alive: true,
    incomeTier,
    gender,
    smarts: rng.int(20, 90),
    looks: rng.int(20, 90),
    ...rollPersonality(rng),
  };
  if (age >= 20 && relation !== "Pet" && relation !== "Child" && relation !== "Grandchild" && relation !== "Grandparent") {
    rel.occupation = age >= 67 ? `Retired ${occupationFor(incomeTier, rng).toLowerCase()}` : occupationFor(incomeTier, rng);
  }
  return rel;
}

export { TALENT_KEYS } from "@/data/talents";
import { TALENT_KEYS as KEYS } from "@/data/talents";

/** Random natural gifts, with anything the player chose taking precedence. */
export function rollTalents(main: Rng, chosen?: Partial<import("@/types/game.types").Talents>): import("@/types/game.types").Talents {
  // A private stream seeded from the main one's state, so the main stream isn't consumed (keeps other rolls stable).
  const rng = makeRng((main.state() ^ 0x9e3779b9) >>> 0);
  const roll = () => clamp(Math.round((rng.int(5, 95) + rng.int(5, 95) + rng.int(5, 95)) / 3));
  const t = {} as import("@/types/game.types").Talents;
  for (const k of KEYS) {
    const r = roll();
    t[k] = chosen?.[k] !== undefined ? clamp(Math.round(chosen[k] as number)) : r;
  }
  return t;
}

export function createNewPlayer(opts: NewLifeOptions, rng: Rng): PlayerState {
  let scenario = opts.scenario;
  if (scenario === "random" && rng.chance(0.01)) scenario = "royal";
  if (scenario === "random") {
    const r = rng.next();
    scenario = r < 0.15 ? "wealthy" : r < 0.4 ? "struggling" : r < 0.43 ? "celebrity" : "average";
  }

  let countryName =
    opts.country && opts.country !== "random" ? opts.country : rng.pick(COUNTRIES).name;
  if (scenario === "royal") {
    const chosen = getCountry(countryName);
    if (!chosen.monarchy) countryName = rng.pick(MONARCHIES).name;
  }
  const country = getCountry(countryName);
  const gender = !opts.gender || opts.gender === "random" ? randomGender(rng) : opts.gender;
  const generated = randomName(countryName, gender, rng);
  const firstName = opts.firstName?.trim() || generated.first;
  const lastName = opts.lastName?.trim() || generated.last;

  const r = rng.next();
  const sexuality = r < 0.88 ? "Straight" : r < 0.93 ? "Gay" : r < 0.98 ? "Bisexual" : "Asexual";

  const tier =
    scenario === "wealthy" ? rng.int(4, 5)
    : scenario === "celebrity" ? rng.int(4, 5)
    : scenario === "royal" ? 5
    : scenario === "struggling" ? 1
    : rng.int(2, 3);

  const dad = randomName(countryName, "Male", rng).first;
  const mum = randomName(countryName, "Female", rng).first;
  const relatives: Relative[] = [
    makeRelativeBase(rng, "Parent", `${mum} ${lastName}`, rng.int(21, 40), "Female", tier, rng.int(55, 95)),
    makeRelativeBase(rng, "Parent", `${dad} ${lastName}`, rng.int(22, 44), "Male", tier, rng.int(55, 95)),
  ];
  const sibCount = rng.pick([0, 0, 1, 1, 2]);
  for (let i = 0; i < sibCount; i++) {
    const sg = rng.pick(["Male", "Female"]);
    relatives.push(
      makeRelativeBase(rng, "Sibling", `${randomName(countryName, sg, rng).first} ${lastName}`, rng.int(1, 8), sg, tier, rng.int(40, 85)),
    );
  }

  // Royal families: one parent reigns, and birth order decides whether you are the heir or a younger child.
  let royalLife: ReturnType<typeof newRoyalLife> | null = null;
  if (scenario === "royal") {
    const heir = rng.chance(0.6);
    if (heir) for (let i = relatives.length - 1; i >= 2; i--) relatives.splice(i, 1);
    else if (relatives.length === 2) {
      relatives.push(makeRelativeBase(rng, "Sibling", `${randomName(countryName, "Female", rng).first} ${lastName}`, rng.int(2, 9), "Female", tier, rng.int(40, 85)));
    }
    const queenReigns = rng.chance(0.5);
    relatives[0].royalTitle = queenReigns ? "Queen" : "Queen Consort";
    relatives[1].royalTitle = queenReigns ? "Prince Consort" : "King";
    for (const sib of relatives.filter((r) => r.relation === "Sibling")) sib.royalTitle = sib.gender === "Male" ? "Prince" : "Princess";
    royalLife = newRoyalLife(relatives.filter((r) => r.relation === "Sibling").length);
  }

  // Grandparents: each side may still be alive.
  for (const gender of ["Female", "Male"] as const) {
    if (rng.chance(0.65)) {
      const gp = makeRelativeBase(rng, "Grandparent", `${classicFirstName(countryName, gender, rng) ?? randomName(countryName, gender, rng).first} ${lastNameFor(countryName, rng)}`, relatives[0].age + rng.int(20, 30), gender, tier, rng.int(50, 90));
      gp.health = rng.int(35, 90);
      relatives.push(gp);
    }
  }

  const royal = scenario === "royal";
  const celebrity = scenario === "celebrity";

  const flags: string[] = [];
  if (scenario === "wealthy") flags.push("trust_fund");
  if (celebrity) flags.push("famous_family");
  if (royal) flags.push("royal_born");
  if (opts.freeStats) flags.push("sandbox_stats");

  const player: PlayerState = {
    id: rng.id(),
    firstName,
    lastName,
    age: 0,
    year: opts.startYear,
    birthYear: opts.startYear,
    birthCountry: country.name,
    birthCity: rng.pick(country.cities),
    gender,
    sexuality,
    karma: 50,
    fame: royal ? 20 : celebrity ? 25 : 0,
    talents: rollTalents(rng, opts.talents),
    outlook: opts.stats ? clamp(opts.stats.happiness) : 84,
    happiness: opts.stats ? clamp(opts.stats.happiness) : clamp(rng.int(72, 96) + (scenario === "struggling" ? -6 : 0)),
    health: opts.stats ? clamp(opts.stats.health) : rng.int(75, 100),
    smarts: opts.stats ? clamp(opts.stats.smarts) : clamp(Math.round((rng.int(10, 95) + rng.int(10, 95)) / 2)),
    looks: opts.stats ? clamp(opts.stats.looks) : clamp(Math.round((rng.int(10, 95) + rng.int(10, 95)) / 2) + (royal || celebrity ? 8 : 0)),
    diseases: [],
    bankBalance: 0,
    outstandingLoans: 0,
    creditScore: 650,
    annualSalary: 0,
    taxesPaidThisYear: 0,
    pension: 0,
    retirementSavings: 0,
    savingsLevel: 1,
    relatives,
    properties: [],
    vehicles: [],
    currentJob: null,
    careerYears: {},
    specialCareerPath: royal ? "royalty" : "none",
    specialCareers: [],
    royalRank: royal ? royalRankFor(gender, false) : "none",
    royal: royalLife,
    royalRespect: royal ? 60 : 50,
    nation: { economy: 50, freedom: 50, military: 50 },
    court: { ...newCourt(royal ? 62 : 55), realmNames: royal ? realmNamesFor(country.name) : [] },
    education: educationForAge(0),
    skills: { acting: 0, music: 0, charisma: rng.int(0, 10), athletics: rng.int(0, 20) },
    music: newMusic(),
    business: null,
    influencer: newInfluencer(),
    acting: newActing(),
    celeb: newCeleb(),
    athlete: newAthleteState(),
    hobbies: {},
    politics: { popularity: 30, yearsInOffice: 0, party: null },
    statecraft: freshStatecraft(),
    economy: { climate: rng.pick(["normal", "normal", "boom", "recession"] as const), yearsLeft: rng.int(1, 4) },
    residence: { country: country.name, city: "", rentTier: 1 },
    investments: {},
    vices: { smoking: 0, alcohol: 0, drugs: 0, gambling: 0 },
    probation: null,
    pregnancy: null,
    blackjack: null,
    intimacy: { ageAuto: true, ageMin: 18, ageMax: 60, genders: [], interests: ["sensual", "playful"] },
    matureContent: true,
    effort: "steady",
    habits: { exercise: 1, diet: 1 },
    lifestyle: 1,
    isInPrison: false,
    isFugitive: false,
    prison: null,
    pendingTrial: null,
    criminalRecord: [],
    justice: freshJustice(),
    mob: freshMob(),
    spy: freshSpy(),
    achievements: [],
    goalsDone: [],
    challenge: opts.challenge ? { id: opts.challenge, status: "active" } : null,
    lastYear: null,
    recentCats: [],
    history: [],
    flags,
    annual: {},
    queuedEvents: [],
    scheduled: [],
    seenEvents: {},
    lifeLog: [],
    stats: {
      highestCareerTier: -1,
      highestCareerTitle: "",
      highestSalary: 0,
      crimesCommitted: 0,
      childrenBorn: 0,
      peakNetWorth: 0,
      yearsInPrison: 0,
      kills: 0,
      affairs: 0,
      hookups: 0,
      yearsWorked: 0,
    },
    generation: 1,
    alive: true,
    causeOfDeath: null,
    deathYear: null,
  };

  player.residence.city = player.birthCity;
  // Natural gifts nudge where you start.
  player.skills.charisma = clamp(player.skills.charisma + Math.round(player.talents.charisma * 0.3));
  player.skills.athletics = clamp(player.skills.athletics + Math.max(0, Math.round((player.talents.athletic - 50) * 0.25)));
  const birthLine = royal
    ? `You were born ${royalRankFor(gender, false) === "Prince" ? "a Prince" : "a Princess"} in ${player.birthCity}, ${country.name}. The whole nation celebrates. Your parents are ${relatives[0].name} and ${relatives[1].name}.`
    : `You were born in ${player.birthCity}, ${country.name}. Your parents are ${relatives[0].name} and ${relatives[1].name}.`;
  addLog(player, logHeader(player));
  addLog(player, birthLine);
  for (const s of relatives.filter((x) => x.relation === "Sibling")) {
    addLog(player, `You have ${s.age > 4 ? "an older" : "a"} sibling named ${s.name}, age ${s.age}.`);
  }
  return player;
}

export function summarizeDelta(before: PlayerState, after: PlayerState): Chip[] {
  const chips: Chip[] = [];
  const add = (label: string, d: number, money = false) => {
    if (d !== 0) chips.push({ label, delta: d, money });
  };
  add("Happiness", after.happiness - before.happiness);
  add("Health", after.health - before.health);
  add("Smarts", after.smarts - before.smarts);
  add("Looks", after.looks - before.looks);
  add("Karma", after.karma - before.karma);
  add("Fame", after.fame - before.fame);
  add("Money", after.bankBalance - before.bankBalance, true);
  if (isRoyal(after)) add("Respect", after.royalRespect - before.royalRespect);
  return chips;
}

export function jobTitleFor(lineId: string, tier: number): string {
  const line = CAREER_BY_ID[lineId];
  return line?.ladder[Math.min(tier, line.ladder.length - 1)]?.title ?? "Worker";
}
