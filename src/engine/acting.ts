/**
 * Screen and runway. The `actor` career line stays the income backbone (a retainer that rises and
 * falls with your fortunes); on top of it sit an agent, film offers, auditions by genre, typecasting,
 * box-office results, awards season, scandals, studio contracts and producing / directing.
 */
import type { ActionResult, ActingState, Agent, FilmCredit, FilmOffer, PendingFilm, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone } from "./state";
import { promoteJob } from "./career";
import { info, logEvent, payout, trained, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";

export const FAMOUS_FAME = 30;

export const FILM_GENRES = ["Drama", "Comedy", "Action", "Horror", "Romance", "Sci-Fi", "Indie"] as const;

const TITLE_A = ["Last", "Silent", "Broken", "Midnight", "Crimson", "Hollow", "Golden", "Wild", "Burning", "Distant", "Final", "Secret"];
const TITLE_B = ["Harvest", "Horizon", "Signal", "Summer", "Protocol", "Kingdom", "Letters", "Frontier", "Echoes", "Promise", "Orbit", "Departure"];
const AGENT_FIRST = ["Marcus", "Dana", "Lorraine", "Vikram", "Sofia", "Hugh", "Tamsin", "Reggie", "Camille", "Ari"];
const AGENT_LAST = ["Sterling", "Goldberg", "Park", "Delacroix", "Bell", "Whitfield", "Oyelaran", "Ricci", "Hayes", "Moss"];
const STUDIOS = ["Starlight Studios", "Silverscreen Pictures", "Horizon Films", "Meridian Pictures", "Apex Entertainment"];

export const PRODUCE_TIERS = [
  { id: "indie", label: "Indie feature", cost: 300_000, blurb: "A small film made with friends and favours." },
  { id: "studio", label: "Studio picture", cost: 4_000_000, blurb: "A proper release with a marketing push." },
  { id: "tentpole", label: "Tentpole blockbuster", cost: 30_000_000, blurb: "Win big or lose a fortune." },
] as const;
export type ProduceTier = (typeof PRODUCE_TIERS)[number]["id"];

export const isActor = (p: PlayerState) => p.currentJob?.lineId === "actor";
export const isModel = (p: PlayerState) => p.currentJob?.lineId === "model";

export function ageLooksFactor(p: PlayerState): number {
  return p.age <= 40 ? 1 : Math.max(0.55, 1 - (p.age - 40) * 0.015);
}

const title = (rng: Rng) => `The ${rng.pick(TITLE_A)} ${rng.pick(TITLE_B)}`;

const ROLE_PCT = { cameo: 0.1, supporting: 0.3, lead: 0.45 } as const;

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/** Genre you're being typecast in: three of your last five roles. */
export function typecastFrom(credits: FilmCredit[]): string | null {
  const recent = credits.filter((c) => c.role !== "producer" && c.role !== "director").slice(-5);
  const counts: Record<string, number> = {};
  for (const c of recent) counts[c.genre] = (counts[c.genre] ?? 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 3 ? best[0] : null;
}

export function actingTier(p: PlayerState): string {
  const job = p.currentJob;
  if (!job || (job.lineId !== "actor" && job.lineId !== "model")) return p.acting.credits.length > 0 ? "Former performer" : "Not in the business";
  return job.title;
}

export function auditionChance(p: PlayerState, genre: string): number {
  const job = p.currentJob;
  const a = p.acting;
  if (!job) return 0;
  let c =
    0.0 + 0.3 * (p.skills.acting / 100) + 0.12 * (p.looks / 100) * ageLooksFactor(p) + 0.1 * (job.performance / 100) +
    (a.agent ? a.agent.skill / 1000 : 0) + a.reputation * 0.0015 - job.tier * 0.06;
  if (a.typecast) c += a.typecast === genre ? 0.12 : -0.1;
  return clamp(c, 0.03, 0.85);
}

export const auditionLimit = (p: PlayerState) => (p.acting.agent && p.acting.reputation >= 50 ? 2 : 1);

export function auditionBlocker(p: PlayerState): string | null {
  const job = p.currentJob;
  if (!job || job.lineId !== "actor") return "You need an acting job first.";
  if (job.tier >= 3) return "You're already at the very top.";
  if (p.acting.pendingFilm) return "You're already committed to a film this year.";
  if (job.tier >= 1 && !p.acting.agent) return "Studios won't see unrepresented leads. Hire an agent first.";
  if (job.tier === 1 && p.acting.reputation < 35) return "Casting directors don't see you as a lead yet (industry reputation 35+).";
  if (job.tier === 2 && (p.acting.reputation < 60 || p.acting.pull < 40)) return "Studios won't bet a franchise on you yet (reputation 60+ and box-office pull 40+).";
  if ((p.annual.audition ?? 0) >= auditionLimit(p)) return "You've used up your auditions this year.";
  return null;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export function hireAgent(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!isActor(p) && !isModel(p)) return { player: p0, notices: [info("No Career Yet", "Agents represent working performers. Get a job in acting or modelling first.")] };
  if (p.acting.agent) return { player: p0 };
  if (p.acting.reputation < 15 && p.fame < 10 && (p.currentJob?.tier ?? 0) === 0) {
    if (!rng.chance(0.5)) return { player: p0, notices: [info("No Takers", "Nobody wants to represent a total unknown. Build a few credits or try again next year.", "bad")] };
  }
  const skill = clamp(Math.round(rng.int(30, 80) + p.acting.reputation / 5));
  const agent: Agent = { name: `${rng.pick(AGENT_FIRST)} ${rng.pick(AGENT_LAST)}`, cut: 0.1, skill, yearsWith: 0 };
  p.acting.agent = agent;
  const body = `${agent.name} agreed to represent you for 10% of your film and booking fees. They seem ${skill >= 65 ? "very well connected" : skill >= 45 ? "reasonably connected" : "enthusiastic, mostly"}.`;
  addLog(p, body);
  return { player: p, notices: [info("Agent Signed", body, "good")] };
}

export function fireAgent(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.acting.agent) return { player: p0 };
  const body = `You parted ways with ${p.acting.agent.name}. Without representation you'll see fewer offers and no lead roles.`;
  p.acting.agent = null;
  addLog(p, body);
  return { player: p, notices: [info("Agent Dropped", body)] };
}

// ---------------------------------------------------------------------------
// Offers, auditions and contracts
// ---------------------------------------------------------------------------

function buildOffer(p: PlayerState, rng: Rng, role: FilmOffer["role"], genre?: string, fee?: number): FilmOffer {
  const a = p.acting;
  const job = p.currentJob;
  const salary = job?.salary ?? 18_000;
  const g = genre ?? (a.typecast && rng.chance(0.65) ? a.typecast : rng.pick(FILM_GENRES));
  const indie = g === "Indie";
  const budget = indie
    ? rng.int(300_000, 3_000_000)
    : role === "cameo" ? rng.int(500_000, 5_000_000) : role === "supporting" ? rng.int(3_000_000, 40_000_000) : rng.int(10_000_000, 120_000_000);
  return {
    id: rng.id(),
    title: title(rng),
    genre: g,
    role,
    fee: fee ?? Math.max(1_500, Math.round(salary * ROLE_PCT[role] * rng.float(0.7, 1.4))),
    budget,
    script: clamp(Math.round(30 + a.reputation * 0.25 + (a.agent?.skill ?? 0) * 0.2 + rng.int(-20, 25) + (indie ? 8 : 0))),
    prestige: rng.int(20, 90),
  };
}

function roleFor(p: PlayerState, rng: Rng): FilmOffer["role"] {
  const a = p.acting;
  const tier = p.currentJob?.tier ?? 0;
  const leadOk = !!a.agent && a.reputation >= 40;
  const old = p.age >= 50 && a.reputation < 70 ? 0.3 : 1;
  if (tier === 0) return rng.chance(0.4) && a.reputation >= 25 ? "supporting" : "cameo";
  if (tier === 1) return leadOk && rng.chance(0.3 * old) ? "lead" : "supporting";
  if (tier === 2) return rng.chance(0.6 * old) ? "lead" : "supporting";
  return rng.chance(0.85 * old) ? "lead" : "supporting";
}

export function acceptOffer(p0: PlayerState, rng: Rng, id: string, haggle = false): ActionResult {
  const p = clone(p0);
  const a = p.acting;
  const offer = a.offers.find((o) => o.id === id);
  if (!offer || !isActor(p)) return { player: p0 };
  if (a.pendingFilm) return { player: p0, notices: [info("Booked", "You can only make one film at a time.")] };
  if (a.studioDeal) return { player: p0, notices: [info("Exclusive", "Your studio deal covers your film work.", "bad")] };
  let fee = offer.fee;
  let extra = "";
  if (haggle) {
    if ((p.annual[`haggle:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Pushed", "They won't move again.")] };
    p.annual[`haggle:${id}`] = 1;
    if (rng.chance(clamp(0.35 + (a.agent?.skill ?? 0) / 250 + a.reputation / 400, 0.2, 0.75))) {
      fee = Math.round(fee * 1.25);
      extra = ` You negotiated the fee up to ${money(fee)}.`;
    } else if (rng.chance(0.35)) {
      a.offers = a.offers.filter((o) => o.id !== id);
      const body = `The producers thanked you and called the next name on their list. "${offer.title}" is gone.`;
      addLog(p, body);
      return { player: p, notices: [info("Offer Withdrawn", body, "bad")] };
    } else {
      return { player: p, notices: [info("No Movement", "They won't pay more, but the original offer stands.")] };
    }
  }
  a.offers = [];
  a.pendingFilm = { ...offer, fee };
  const body = `You signed on as ${offer.role === "lead" ? "the lead" : offer.role === "supporting" ? "a supporting actor" : "a cameo"} in "${offer.title}" (${offer.genre}, ${money(offer.budget)} budget) for ${money(fee)}.${extra} It comes out when you age up.`;
  addLog(p, body);
  return { player: p, notices: [info("Cast!", body, "good")] };
}

export function declineOffer(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  p.acting.offers = p.acting.offers.filter((o) => o.id !== id);
  return { player: p, notices: [info("Passed", "You turned the role down. The studio will find someone else.")] };
}

/** Audition for a bigger part: succeeds into a promotion and a film to shoot this year. */
export function auditionForLead(p0: PlayerState, rng: Rng, genre: string = "Drama"): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "actor") return { player: p0 };
  if (job.tier >= 3) return { player: p0 };
  const blocked = auditionBlocker(p);
  if (blocked) {
    const exhausted = (p.annual.audition ?? 0) >= auditionLimit(p);
    return { player: p0, notices: [info(exhausted ? "Already Auditioned" : "Can't Audition", exhausted ? "Casting directors need time to forget your face. Try next year." : blocked, exhausted ? "neutral" : "bad")] };
  }
  p.annual.audition = (p.annual.audition ?? 0) + 1;
  const a = p.acting;
  const chance = auditionChance(p, genre);
  if (rng.chance(chance)) {
    const wasType = a.typecast;
    promoteJob(p);
    const j = p.currentJob!;
    const role: FilmOffer["role"] = j.tier >= 2 ? "lead" : "supporting";
    const offer = buildOffer(p, rng, role, genre);
    a.pendingFilm = offer;
    a.reputation = clamp(a.reputation + 4);
    const fameGain = rng.int(8, 15);
    changeStat(p, "fame", fameGain);
    changeStat(p, "happiness", 12);
    let body = `You nailed the ${genre.toLowerCase()} audition and landed a bigger role: ${j.title}, starring in "${offer.title}"! Fame +${fameGain}.`;
    if (wasType && genre !== wasType) {
      a.critics = clamp(a.critics + 6);
      body += ` Breaking out of your ${wasType.toLowerCase()} typecasting impressed critics.`;
    }
    addLog(p, body);
    return { player: p, notices: [info("You Got the Part!", body, "good")] };
  }
  changeStat(p, "happiness", -4);
  const body = `The casting director said, "Thanks, we'll call you." (${Math.round(chance * 100)}% odds for ${genre.toLowerCase()}.) They won't.`;
  addLog(p, body);
  return { player: p, notices: [info("No Callback", body, "bad")] };
}

export function signStudioDeal(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const a = p.acting;
  const job = p.currentJob;
  if (!job || job.lineId !== "actor" || job.tier < 1) return { player: p0, notices: [info("Not Yet", "Studios sign supporting actors and above to multi-picture deals.")] };
  if (a.studioDeal) return { player: p0 };
  if (a.reputation < 30) return { player: p0, notices: [info("Not Yet", "Your reputation (30+) isn't strong enough for a studio to commit.")] };
  if (a.pendingFilm) return { player: p0, notices: [info("Booked", "Finish the film you're making first.")] };
  const genre = a.typecast ?? rng.pick(FILM_GENRES);
  a.studioDeal = { studio: rng.pick(STUDIOS), yearsLeft: 3, fee: Math.round(job.salary * 0.5), genre };
  const body = `${a.studioDeal.studio} signed you to a three-picture deal: one ${genre.toLowerCase()} film a year at ${money(a.studioDeal.fee)} each. Steady money, but they choose the roles and the genre.`;
  addLog(p, body);
  return { player: p, notices: [info("Studio Deal", body, "good")] };
}

export function buyOutStudioDeal(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const d = p.acting.studioDeal;
  if (!d) return { player: p0 };
  const cost = Math.round(d.fee * d.yearsLeft * 0.5);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `Buying out the contract costs ${money(cost)}.`, "bad")] };
  p.bankBalance -= cost;
  p.acting.studioDeal = null;
  const body = `You paid ${money(cost)} to walk away from ${d.studio}.`;
  addLog(p, body);
  return { player: p, notices: [info("Bought Out", body)] };
}

export function produceBlocker(p: PlayerState, tier: ProduceTier, directing: boolean): string | null {
  const a = p.acting;
  const t = PRODUCE_TIERS.find((x) => x.id === tier)!;
  if (p.age < 25) return "You're too young for the producer's chair.";
  if (a.pendingFilm) return "You're already committed to a film this year.";
  if (a.credits.length < (directing ? 5 : 3)) return `You need ${directing ? 5 : 3}+ screen credits first.`;
  if (p.fame < 30) return "Financiers want a name (30+ Fame).";
  if (directing && a.critics < 50) return "Directing needs critical credibility (50+).";
  if (p.bankBalance < t.cost) return `You'd have to put up ${money(t.cost)} of your own.`;
  return null;
}

export function produceFilm(p0: PlayerState, rng: Rng, tier: ProduceTier, directing = false): ActionResult {
  const p = clone(p0);
  const blocked = produceBlocker(p, tier, directing);
  if (blocked) return { player: p0, notices: [info("Can't Greenlight", blocked, "bad")] };
  const t = PRODUCE_TIERS.find((x) => x.id === tier)!;
  const a = p.acting;
  p.bankBalance -= t.cost;
  const film: PendingFilm = {
    id: rng.id(),
    title: title(rng),
    genre: tier === "indie" ? "Indie" : rng.pick(FILM_GENRES),
    role: directing ? "director" : "producer",
    fee: 0,
    budget: t.cost,
    script: clamp(Math.round(40 + a.reputation * 0.3 + (directing ? p.smarts * 0.1 : 0) + rng.int(-15, 25))),
    prestige: rng.int(30, 90),
    invested: t.cost,
  };
  a.pendingFilm = film;
  const body = `You put ${money(t.cost)} of your own money into "${film.title}" (${t.label.toLowerCase()})${directing ? " and took the director's chair" : ""}. You'll know how it did when you age up.`;
  addLog(p, body);
  return { player: p, notices: [info("Film Greenlit", body, "good")] };
}

/** One-off modelling job. Quick money, a little exposure. */
export function bookCampaign(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "model") return { player: p0, notices: [info("Not a Model", "You need a modelling job.")] };
  if ((p.annual.campaign ?? 0) >= 1) return { player: p0, notices: [info("Booked Out", "You've already shot a campaign this year.")] };
  p.annual.campaign = 1;
  const a = p.acting;
  const gross = Math.round(job.salary * rng.float(0.15, 0.35) * ageLooksFactor(p) * (a.agent ? 1 + a.agent.skill / 300 : 1));
  const agentCut = a.agent ? Math.round(gross * a.agent.cut) : 0;
  const net = payout(p, gross - agentCut);
  a.modelBookings += 1;
  changeStat(p, "fame", rng.int(1, 2));
  changeStat(p, "happiness", 2);
  const notices: Notices = [];
  const body = `You shot a campaign for ${money(gross)}${agentCut ? ` (${money(agentCut)} to your agent)` : ""}. ${money(net)} after withholding.`;
  addLog(p, body);
  notices.push(info("Campaign Shot", body, "good"));
  if (rng.chance(0.05)) raiseScandal(p, "acting", rng, notices, 1);
  return { player: p, notices };
}

export function shootCommercial(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.fame < FAMOUS_FAME) return { player: p0 };
  if ((p.annual.commercial ?? 0) >= 1) {
    return { player: p0, notices: [info("Over-exposed", "You've already shot a commercial this year.")] };
  }
  p.annual.commercial = 1;
  const fee = 20_000 + p.fame * 1_000;
  const agentCut = p.acting.agent ? Math.round(fee * p.acting.agent.cut) : 0;
  p.bankBalance += fee - agentCut;
  changeStat(p, "fame", 5);
  const body = `You shot a commercial for a luxury brand. +${money(fee - agentCut)}${agentCut ? ` (after your agent's ${money(agentCut)})` : ""}, +5 Fame.`;
  addLog(p, body);
  return { player: p, notices: [info("Commercial Shoot", body, "good")] };
}

export function writeMemoir(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.fame < FAMOUS_FAME) return { player: p0 };
  if ((p.annual.memoir ?? 0) >= 1) {
    return { player: p0, notices: [info("Writer's Cramp", "You've already written a memoir this year.")] };
  }
  p.annual.memoir = 1;
  const payoutAmount = Math.round(p.fame * 25_000 * rng.float(0.8, 1.2));
  p.bankBalance += payoutAmount;
  changeStat(p, "happiness", 4);
  const body = `Your memoir became a bestseller. The publisher paid you ${money(payoutAmount)}.`;
  addLog(p, body);
  return { player: p, notices: [info("Memoir Published", body, "good")] };
}

// ---------------------------------------------------------------------------
// Yearly tick
// ---------------------------------------------------------------------------

function demote(p: PlayerState, why: string, notices: Notices) {
  const j = p.currentJob;
  if (!j) return;
  const line = CAREER_BY_ID[j.lineId];
  if (!line || j.tier <= 0) return;
  j.tier -= 1;
  j.title = line.ladder[j.tier].title;
  j.salary = Math.max(line.ladder[j.tier].salary, Math.round(j.salary * 0.6));
  p.annualSalary = j.salary;
  logEvent(p, notices, "Demoted by the Industry", `${why} You're now billed as a ${j.title}.`, "bad");
}

function releaseFilm(p: PlayerState, rng: Rng, notices: Notices): { fees: number; bonuses: number; revenue: number } {
  const a = p.acting;
  const f = a.pendingFilm;
  if (!f) return { fees: 0, bonuses: 0, revenue: 0 };
  a.pendingFilm = null;
  const job = p.currentJob;
  const behind = f.role === "producer" || f.role === "director";
  const star = clamp(0.5 * a.pull + 0.3 * a.reputation + 0.2 * p.fame);
  const effortBonus = p.effort === "grind" ? 6 : p.effort === "coast" ? -8 : 0;
  const perf = clamp(0.55 * p.skills.acting + 0.25 * (job?.performance ?? 55) + 0.2 * p.smarts + effortBonus);
  const directorBonus = f.role === "director" ? (a.critics - 50) * 0.15 + (p.smarts - 50) * 0.1 : 0;
  const critics = clamp(Math.round(0.42 * f.script + 0.38 * perf + 0.1 * f.prestige + directorBonus + rng.int(-12, 12)));
  const marketing = clamp((Math.log10(Math.max(1, f.budget)) - 5.5) * 8, -10, 16);
  const audience = clamp(0.25 * f.script + 0.35 * star + marketing + 14 + (a.typecast === f.genre ? 4 : 0) + rng.int(-26, 26));
  const mult =
    audience < 30 ? rng.float(0.15, 0.7)
    : audience < 50 ? rng.float(0.7, 1.5)
    : audience < 68 ? rng.float(1.5, 3.2)
    : audience < 82 ? rng.float(3.2, 6)
    : rng.float(6, 12);
  const boxOffice = Math.round(f.budget * mult);
  const outcome: FilmCredit["outcome"] = mult < 1 ? "flop" : mult < 2.2 ? "modest" : mult < 4 ? "hit" : "blockbuster";
  const credit: FilmCredit = { id: f.id, title: f.title, year: p.year, genre: f.genre, role: f.role, budget: f.budget, boxOffice, critics, outcome };
  const lead = f.role === "lead" || behind;

  // Industry standing
  const rep = { flop: lead ? -7 : -4, modest: 1, hit: 4, blockbuster: 7 }[outcome];
  const pull = { flop: lead ? -5 : -3, modest: 1, hit: 5, blockbuster: 9 }[outcome];
  a.reputation = clamp(a.reputation + rep + (critics >= 75 ? 3 : critics < 30 ? -2 : 0));
  a.pull = clamp(a.pull + pull);
  a.critics = clamp(Math.round(a.critics * 0.7 + critics * 0.3));
  if (outcome === "blockbuster") changeStat(p, "fame", 4);
  if (job && job.lineId === "actor") {
    const line = CAREER_BY_ID.actor;
    const factor = { flop: 0.92, modest: 1, hit: 1.1, blockbuster: 1.25 }[outcome];
    job.salary = Math.max(Math.round(line.ladder[job.tier].salary * 0.5), Math.round(job.salary * factor));
    p.annualSalary = job.salary;
  }

  // Money
  let fees = 0;
  let bonuses = 0;
  let revenue = 0;
  if (behind) {
    revenue = Math.round(boxOffice * 0.45);
  } else {
    fees = f.fee;
    if (job && job.tier >= 2 && (outcome === "hit" || outcome === "blockbuster")) bonuses = Math.round(boxOffice * 0.008 * (a.pull / 100 + 0.3));
  }

  // Awards
  const role = f.role;
  if (critics >= 72) {
    a.nominations += 1;
    const chance = clamp((critics - 70) / 40 + f.prestige / 400, 0, 0.6) * (role === "lead" ? 1 : role === "supporting" ? 0.8 : 0.6);
    if (rng.chance(chance)) {
      const award = behind ? "Best Picture" : role === "lead" ? "Best Actor" : "Best Supporting Actor";
      credit.award = award;
      a.awards.push(`${award}: ${f.title} (${p.year})`);
      a.reputation = clamp(a.reputation + 8);
      changeStat(p, "fame", 8);
      changeStat(p, "happiness", 15);
      if (job && job.lineId === "actor") {
        job.salary = Math.round(job.salary * 1.2);
        p.annualSalary = job.salary;
      }
      logEvent(p, notices, "Awards Season", `"${f.title}" won ${award}! Offers flood in and your fee goes up 20%.`, "jackpot");
    } else {
      logEvent(p, notices, "Nominated", `"${f.title}" earned a nomination (critics ${critics}) but the prize went elsewhere.`, "good");
    }
  }
  if (!behind) p.skills.acting = clamp(p.skills.acting + trained(p, "acting", p.skills.acting, p.effort === "grind" ? 4 : p.effort === "steady" ? 3 : 1));
  a.credits.push(credit);
  const before = a.typecast;
  a.typecast = typecastFrom(a.credits);
  if (a.typecast && a.typecast !== before) logEvent(p, notices, "Typecast", `Casting directors now see you as "the ${a.typecast.toLowerCase()} one". Offers in that genre come easy; everything else is a fight.`, "neutral");
  const mood = outcome === "flop" ? "bad" : outcome === "blockbuster" ? "jackpot" : "good";
  const net = behind ? `Your share is ${money(revenue)} against ${money(f.invested ?? 0)} invested.` : `You earned ${money(fees)}${bonuses ? ` plus a ${money(bonuses)} profit bonus` : ""}.`;
  logEvent(p, notices, `Film Released: ${outcome.toUpperCase()}`, `"${f.title}" (${f.genre}) grossed ${money(boxOffice)} on a ${money(f.budget)} budget. Critics gave it ${critics}/100. ${net}`, mood);
  return { fees, bonuses, revenue };
}

/** Returns the year's gross (taxable) screen income. Agent fees are deducted from the bank. */
export function processActing(p: PlayerState, rng: Rng, notices: Notices): number {
  const a: ActingState = p.acting;
  const job = p.currentJob;
  const actor = job?.lineId === "actor";
  const model = job?.lineId === "model";
  if (!actor && !model && a.credits.length === 0 && !a.pendingFilm) {
    a.offers = [];
    return 0;
  }
  a.offers = [];
  const released = releaseFilm(p, rng, notices);
  let gross = released.fees + released.bonuses + released.revenue;
  let agentFee = 0;
  if (a.agent) {
    agentFee = Math.round((released.fees + released.bonuses) * a.agent.cut);
    a.agent.yearsWith += 1;
    a.agent.skill = clamp(a.agent.skill + rng.int(-3, 3));
  }

  // Studio deal: one film a year, chosen for you
  const d = a.studioDeal;
  if (d && actor && !a.pendingFilm) {
    const role: FilmOffer["role"] = (job?.tier ?? 1) >= 2 ? "lead" : "supporting";
    a.pendingFilm = buildOffer(p, rng, role, d.genre, d.fee);
    d.yearsLeft -= 1;
    if (d.yearsLeft <= 0) {
      a.studioDeal = null;
      logEvent(p, notices, "Studio Deal Ends", `Your three-picture deal with ${d.studio} wrapped. You're a free agent again.`, "neutral");
    }
  }

  if (actor && job) {
    const worked = released.fees + released.revenue > 0 || !!a.pendingFilm;
    a.yearsSinceWork = worked ? 0 : a.yearsSinceWork + 1;
    const line = CAREER_BY_ID.actor;
    if (a.yearsSinceWork >= 2) {
      a.reputation = clamp(a.reputation - 3);
      a.pull = clamp(a.pull - 2);
      job.salary = Math.max(Math.round(line.ladder[job.tier].salary * 0.4), Math.round(job.salary * 0.9));
      p.annualSalary = job.salary;
      notices.push(info("Work Is Drying Up", "You haven't been in a film for two years. Casting directors have forgotten you and your retainer is shrinking.", "bad"));
      if (a.yearsSinceWork >= 3 && job.tier >= 1) {
        demote(p, "Three quiet years is a long time in this business.", notices);
        a.yearsSinceWork = 1;
      }
    }
    // Ageing: draw fades without a body of work behind it
    if (p.age > 45) a.pull = clamp(a.pull - Math.max(0, Math.round((p.age - 45) * 0.15)) + (a.reputation >= 70 ? 1 : 0));
    // Next year's offers
    if (!a.pendingFilm) {
      const n = a.agent ? 1 + Math.round(a.agent.skill / 45) : rng.chance(0.4) ? 1 : 0;
      const slots = Math.min(3, n + (a.reputation >= 60 ? 1 : 0));
      for (let i = 0; i < slots; i++) a.offers.push(buildOffer(p, rng, roleFor(p, rng)));
      if (a.offers.length) notices.push(info("Scripts Arrive", `${a.offers.length} film offer${a.offers.length > 1 ? "s" : ""} on your desk. See the Movie Star tab.`, "good"));
    }
  }

  if (model && job) {
    if (p.age >= 32) {
      job.salary = Math.round(job.salary * 0.94);
      p.annualSalary = job.salary;
    }
    const line = CAREER_BY_ID.model;
    if (job.tier >= 1 && (p.looks < 70 || (p.age >= 38 && p.fame < 40)) && rng.chance(0.35)) {
      job.tier -= 1;
      job.title = line.ladder[job.tier].title;
      job.salary = Math.max(line.ladder[job.tier].salary, Math.round(job.salary * 0.5));
      p.annualSalary = job.salary;
      logEvent(p, notices, "Aged Out", `The bookings thinned out as the industry chased younger faces. You're now billed as a ${job.title}.`, "bad");
    }
  }

  if (agentFee) p.bankBalance -= agentFee;
  a.lastIncome = { fees: released.fees + released.revenue, bonuses: released.bonuses, agent: agentFee };
  a.earnings += gross - agentFee;

  // Scandals
  if ((actor || model) && p.fame >= 20) {
    const risk = 0.015 + p.fame / 900 + (Math.max(...Object.values(p.vices)) >= 40 ? 0.03 : 0);
    if (rng.chance(risk)) raiseScandal(p, "acting", rng, notices);
  }
  gross = Math.round(gross);
  return gross;
}
