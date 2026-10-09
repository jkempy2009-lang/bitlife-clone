/**
 * Immigration: you can't simply live anywhere. Moving abroad means a route (a skilled-worker visa, study,
 * a spouse's sponsorship, an investor visa, asylum from a country in crisis, or going without papers),
 * with odds that depend on where you are going and who you are. Temporary status has strings attached
 * (a job, a course, a marriage), permits expire, language takes years to learn, and papers can lead to
 * permanent residence and citizenship, or to deportation.
 */
import type { ActionResult, ImmigrationState, PlayerState, VisaStatus } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { COUNTRY_BY_NAME } from "@/data/countries";
import { profileOf } from "@/data/countryProfiles";
import { addLog, changeStat, getPartner, hasDegree, isRoyal } from "./state";
import { inCrisis, worldHiring } from "./worldEvents";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const freshImmigration = (country: string): ImmigrationState => ({ citizenship: [country], status: "citizen", yearsLeft: 0, residenceYears: 0, fluency: 100, refused: 0, idle: 0 });

export function hydrateImmigration(raw: Partial<ImmigrationState> | undefined, p: Pick<PlayerState, "birthCountry">): ImmigrationState {
  const f = freshImmigration(p.birthCountry);
  if (!raw) return f;
  return { ...f, ...raw, citizenship: Array.isArray(raw.citizenship) && raw.citizenship.length ? raw.citizenship : f.citizenship };
}

export const isCitizen = (p: PlayerState) => p.immigration.citizenship.includes(p.residence.country);

export const STATUS_LABEL: Record<VisaStatus, string> = {
  citizen: "Citizen",
  permanent: "Permanent resident",
  work: "Work visa",
  student: "Student visa",
  family: "Family visa",
  asylum: "Asylum seeker / refugee",
  overstay: "Undocumented",
};

/** Fluency a person arrives with: native speakers of the language keep it; everyone else starts near zero. */
function arrivalFluency(p: PlayerState, dest: string): number {
  const lang = profileOf(dest).language;
  return p.immigration.citizenship.some((c) => profileOf(c).language === lang) ? 95 : p.flags.includes("bilingual") ? 40 : 6;
}

/** A hiring-odds adjustment from the world economy and from your status and language. Plugs into job applications. */
export function jobMarketShift(p: PlayerState): number {
  const im = p.immigration;
  let shift = worldHiring(p);
  if (im && !isCitizen(p)) {
    if (im.fluency < 40) shift -= 0.15 * (1 - im.fluency / 40);
    if (im.status === "overstay") shift -= 0.5;
  }
  return shift;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export type RouteId = "work" | "student" | "family" | "investor" | "asylum" | "undocumented";
export const ROUTE_IDS: RouteId[] = ["work", "student", "family", "investor", "asylum", "undocumented"];

export interface RouteInfo {
  id: RouteId;
  label: string;
  emoji: string;
  blurb: string;
  /** Application fees (on top of the cost of moving). */
  fee: number;
  /** Chance of approval (1 = certain). */
  chance: number;
  /** Reason it is not available to you now. */
  blocker: string | null;
}

const HIGHER_ED = new Set(["University", "MedicalSchool", "LawSchool", "Masters"]);
const careerExperience = (p: PlayerState) => Object.values(p.careerYears).reduce((a, b) => a + b, 0);

export function routeOptions(p: PlayerState, dest: string): RouteInfo[] {
  const E = profileOf(dest).entry;
  const same = profileOf(dest).language === profileOf(p.residence.country).language;
  const educated = hasDegree(p, "bachelor") || hasDegree(p, "masters") || hasDegree(p, "md") || hasDegree(p, "jd");
  const exp = careerExperience(p);
  const refusedPenalty = Math.min(0.15, p.immigration.refused * 0.03);
  const partner = getPartner(p);
  const crisis = inCrisis(p.world, p.residence.country, p.year);
  const crisisSeverity = Math.max(0, ...p.world.events.filter((e) => e.country === p.residence.country && ["war", "unrest"].includes(e.id)).map((e) => e.severity));
  return [
    {
      id: "work", label: "Skilled-worker visa", emoji: "💼", fee: 3_000,
      blurb: "A four-year permit tied to having a job there. Your current employer can transfer you; otherwise you must find work within a year.",
      chance: clamp(0.82 - E / 170 + (p.smarts - 50) / 300 + (educated ? 0.12 : 0) + Math.min(0.12, exp * 0.02) + (same ? 0.06 : 0) - refusedPenalty, 0.08, 0.92),
      blocker: p.age < 20 || p.age > 58 ? "Work visas favour applicants aged 20 to 58." : educated || exp >= 3 ? null : "You need a degree or three years of work experience.",
    },
    {
      id: "student", label: "Student visa", emoji: "🎓", fee: 2_500,
      blurb: "Study there for up to four years. You may work part-time; when the course ends you have a year to find a job or leave.",
      chance: clamp(0.86 - E / 200 + (p.smarts - 50) / 300 - refusedPenalty, 0.15, 0.95),
      blocker: p.age < 17 || p.age > 35 ? "Student visas are for ages 17 to 35." : p.bankBalance < 15_000 ? "You must show $15,000 in savings." : !HIGHER_ED.has(p.education.stage) && !(p.education.stage === "None" && p.age <= 25) ? "You need to be in higher education, or fresh from school." : null,
    },
    {
      id: "family", label: "Marry-in / family visa", emoji: "💍", fee: 2_000,
      blurb: "Move on your spouse's sponsorship. Three years later you may settle permanently, if the marriage lasts.",
      chance: clamp(0.9 - E / 300 - refusedPenalty, 0.5, 0.92),
      blocker: partner?.partnerStatus === "married" ? null : "You need to be married to sponsor a move together.",
    },
    {
      id: "investor", label: "Investor visa", emoji: "🏦", fee: 250_000,
      blurb: "Invest $250,000 in the country and receive permanent residence at once. The money is not coming back.",
      chance: 0.95,
      blocker: p.bankBalance < 300_000 ? "You need $300,000 ($250,000 is invested, the rest covers fees and the move)." : null,
    },
    {
      id: "asylum", label: "Claim asylum", emoji: "🕊️", fee: 500,
      blurb: "Flee a country in crisis. You may work while your claim is heard; if it succeeds you can stay. Going home ends your protection.",
      chance: clamp(0.78 - E / 160 + crisisSeverity * 0.04 - refusedPenalty, 0.2, 0.85),
      blocker: crisis ? null : "You can only claim asylum from a country in crisis (war, a political emergency or a pandemic).",
    },
    {
      id: "undocumented", label: "Go without papers", emoji: "🌑", fee: 6_000,
      blurb: "Pay smugglers or overstay a tourist visa. You cannot work legally, you get no healthcare cover, and every year there is a risk of being deported.",
      chance: 0.82,
      blocker: null,
    },
  ];
}

export function routeFor(p: PlayerState, dest: string, id: RouteId): RouteInfo | undefined {
  return routeOptions(p, dest).find((r) => r.id === id);
}

/** Whether you may move to `dest` without a route (you are a citizen there, or it is within your own country). */
export const needsRoute = (p: PlayerState, dest: string) => dest !== p.residence.country && !p.immigration.citizenship.includes(dest);

// ---------------------------------------------------------------------------
// Arriving, staying, leaving
// ---------------------------------------------------------------------------

const PERMIT_YEARS: Record<RouteId, number> = { work: 4, student: 4, family: 3, investor: 0, asylum: 5, undocumented: 0 };
const STATUS_OF: Record<RouteId, VisaStatus> = { work: "work", student: "student", family: "family", investor: "permanent", asylum: "asylum", undocumented: "overstay" };

/** Record your new status after a move (or an emigration event). `route` null means you moved as a citizen. */
export function settle(p: PlayerState, dest: string, route: RouteId | null) {
  const prev = p.immigration;
  p.immigration = {
    ...prev,
    status: route ? STATUS_OF[route] : "citizen",
    yearsLeft: route ? PERMIT_YEARS[route] : 0,
    residenceYears: 0,
    fluency: route === null && prev.citizenship.includes(dest) && dest === p.birthCountry ? 100 : arrivalFluency(p, dest),
    idle: 0,
  };
}

/** Sent back to where you hold citizenship. */
export function deport(p: PlayerState, reason: string, notices: Notices, seize = 0) {
  const home = p.immigration.citizenship[0] ?? p.birthCountry;
  const c = COUNTRY_BY_NAME[home] ?? COUNTRY_BY_NAME[p.birthCountry];
  const from = p.residence.country;
  p.residence = { ...p.residence, country: c.name, city: c.cities[0] };
  p.immigration = { ...p.immigration, status: "citizen", yearsLeft: 0, residenceYears: 0, fluency: 100, idle: 0 };
  p.currentJob = null;
  p.annualSalary = 0;
  if (seize > 0) p.bankBalance = Math.round(p.bankBalance * (1 - seize));
  changeStat(p, "happiness", -9);
  const body = `${reason} You had to leave ${from} and went back to ${c.name}.`;
  addLog(p, body);
  notices.push(info("Sent Home", body, "bad"));
}

export function naturaliseBlocker(p: PlayerState): string | null {
  const im = p.immigration;
  if (isCitizen(p)) return "You are already a citizen here.";
  if (im.status !== "permanent") return "Only permanent residents can apply for citizenship.";
  if (im.residenceYears < 6) return `You need ${6 - im.residenceYears} more year${6 - im.residenceYears === 1 ? "" : "s"} of residence.`;
  if (im.fluency < 40) return "You must pass a language test: your fluency is not yet good enough.";
  if (p.criminalRecord.length > 1 && !p.justice.expunged) return "Your criminal record counts against you.";
  if (p.bankBalance < 1_500) return `The application costs ${money(1_500)}.`;
  return null;
}

export function naturalise(p0: PlayerState, rng: Rng): ActionResult {
  const block = naturaliseBlocker(p0);
  if (block) return { player: p0, notices: [info("Not Yet", block)] };
  const p = structuredClone(p0);
  p.bankBalance -= 1_500;
  if (!rng.chance(0.92)) {
    const body = "Your application was delayed pending more paperwork. You can try again next year.";
    p.annual.naturalise = 1;
    addLog(p, body);
    return { player: p, notices: [info("Delayed", body, "neutral")] };
  }
  p.immigration.citizenship = [...p.immigration.citizenship, p.residence.country];
  p.immigration.status = "citizen";
  p.immigration.yearsLeft = 0;
  changeStat(p, "happiness", 10);
  const body = `After ${p.immigration.residenceYears} years, you swore the oath and became a citizen of ${p.residence.country}. You now hold ${p.immigration.citizenship.length} passports.`;
  addLog(p, body);
  return { player: p, notices: [info("New Citizen!", body, "good")] };
}

/** Yearly: permits tick down, language grows, homesickness bites, and status is reviewed. */
export function processImmigration(p: PlayerState, rng: Rng, notices: Notices) {
  const im = p.immigration;
  if (isCitizen(p)) {
    im.status = "citizen";
    im.yearsLeft = 0;
    im.residenceYears += 1;
    im.fluency = Math.max(im.fluency, arrivalFluency(p, p.residence.country) >= 90 ? 95 : im.fluency);
    return;
  }
  im.residenceYears += 1;
  // Language comes with time, faster when young and for quick learners.
  if (im.fluency < 100) im.fluency = clamp(Math.round(im.fluency + 8 + (p.talents.learner - 50) / 10 + (p.age < 25 ? 6 : 0) + (isRoyal(p) ? 0 : 0)));
  // Homesickness and isolation fade as you settle and learn the language.
  if (im.fluency < 30) changeStat(p, "happiness", im.residenceYears <= 2 ? -3 : -2);
  else if (im.residenceYears <= 1) changeStat(p, "happiness", -1);

  const jobless = !p.currentJob && !p.business && !p.music.signed;
  if (im.status === "work") {
    im.idle = jobless ? im.idle + 1 : 0;
    im.yearsLeft -= 1;
    if (im.idle >= 2) return deport(p, "Your work visa was cancelled after two years without a job.", notices);
    if (im.yearsLeft <= 0) {
      if (im.residenceYears >= 5 && !jobless && rng.chance(0.9)) {
        im.status = "permanent";
        const body = `After ${im.residenceYears} years of work, ${p.residence.country} granted you permanent residence.`;
        addLog(p, body);
        notices.push(info("Permanent Resident", body, "good"));
      } else if (!jobless && rng.chance(0.85)) {
        im.yearsLeft = 4;
        addLog(p, "Your work visa was renewed for four more years.");
      } else return deport(p, "Your work visa expired and was not renewed.", notices);
    } else if (im.idle === 1) {
      const body = "Your work visa depends on having a job. You have a year to find one, or you will be asked to leave.";
      addLog(p, body);
      notices.push(info("Visa at Risk", body, "bad"));
    }
  } else if (im.status === "student") {
    const finished = !HIGHER_ED.has(p.education.stage);
    im.idle = finished && jobless ? im.idle + 1 : 0;
    im.yearsLeft -= 1;
    if (finished && im.yearsLeft > 1) im.yearsLeft = 1;
    if (im.yearsLeft <= 0 || im.idle >= 2) {
      if (!jobless && rng.chance(0.7)) {
        im.status = "work";
        im.yearsLeft = 4;
        im.idle = 0;
        const body = "Your studies are done and your employer sponsored you: your student visa became a work visa.";
        addLog(p, body);
        notices.push(info("Staying On", body, "good"));
      } else return deport(p, "Your student visa ended and you had no job or course to keep you there.", notices);
    }
  } else if (im.status === "family") {
    const married = getPartner(p)?.partnerStatus === "married";
    im.yearsLeft -= 1;
    if (!married && im.yearsLeft > 1) im.yearsLeft = 1;
    if (im.yearsLeft <= 0) {
      if (married) {
        im.status = "permanent";
        const body = "Three years into your marriage, immigration signed off: you are now a permanent resident.";
        addLog(p, body);
        notices.push(info("Settled", body, "good"));
      } else return deport(p, "Your marriage ended, and so did the visa that depended on it.", notices);
    }
  } else if (im.status === "asylum") {
    im.yearsLeft -= 1;
    if (im.yearsLeft <= 0) {
      im.status = "permanent";
      const body = "Five years on, your refugee status was converted into permanent residence. You are safe here for good.";
      addLog(p, body);
      notices.push(info("Safe at Last", body, "good"));
    }
  } else if (im.status === "overstay") {
    const caught = 0.12 + Math.min(0.2, im.residenceYears * 0.03);
    if (rng.chance(caught)) return deport(p, "Immigration officers found you during a raid and deported you, seizing part of your savings.", notices, 0.4);
    if (rng.chance(0.05)) {
      im.status = "permanent";
      const body = "A new amnesty regularised people in your position. You have papers at last.";
      addLog(p, body);
      notices.push(info("Amnesty", body, "good"));
    } else if (rng.chance(0.3)) {
      p.currentJob = null;
      p.annualSalary = 0;
      addLog(p, "Without papers, you were let go as soon as an employer checked.");
    }
    changeStat(p, "happiness", -1);
  }
}

/** Short lines for the UI: what your status means right now. */
export function statusLines(p: PlayerState): string[] {
  const im = p.immigration;
  const out: string[] = [];
  if (isCitizen(p)) return out;
  out.push(`${STATUS_LABEL[im.status]}${im.yearsLeft > 0 ? `, ${im.yearsLeft} year${im.yearsLeft === 1 ? "" : "s"} left on the permit` : ""}`);
  if (im.status === "work") out.push(im.idle > 0 ? "No job: your visa is at risk" : "Tied to your job");
  if (im.status === "student") out.push("Tied to your studies");
  if (im.status === "family") out.push("Tied to your marriage");
  if (im.status === "overstay") out.push("No legal work, no healthcare cover, risk of deportation");
  out.push(`${profileOf(p.residence.country).language} fluency ${im.fluency}%`);
  return out;
}
