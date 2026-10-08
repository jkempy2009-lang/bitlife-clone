/**
 * The yearly beats of a screen career that outlive a single film: television seasons and renewals,
 * residuals, franchise sequels and awards season.
 */
import type { ActingMedium, CampaignMode, FilmCredit, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { changeStat } from "./state";
import { info, logEvent, trained, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";
import { buildOffer, roman } from "./actingShared";

// ---------------------------------------------------------------------------
// Awards season
// ---------------------------------------------------------------------------

export const CAMPAIGNS: Record<CampaignMode, { label: string; blurb: string; nom: number; win: number }> = {
  quiet: { label: "Let the work speak", blurb: "No spend. Voters judge the film on its merits.", nom: 0, win: 0 },
  festivals: { label: "Festival circuit", blurb: "Screenings and Q&As. Cheap, and strongest for small, serious films.", nom: 0.04, win: 0.02 },
  lunch: { label: "Lunches and screenings", blurb: "Private screenings and a lot of handshakes.", nom: 0.12, win: 0.06 },
  blitz: { label: "Full awards blitz", blurb: "Billboards, trade ads, a publicist on retainer. It can backfire.", nom: 0.22, win: 0.14 },
};

export function campaignCost(p: PlayerState, mode: CampaignMode): number {
  switch (mode) {
    case "quiet": return 0;
    case "festivals": return Math.round(12_000 + p.fame * 400);
    case "lunch": return Math.round(40_000 + p.fame * 2_000);
    case "blitz": return Math.round(200_000 + p.fame * 8_000);
  }
}

const AWARD_NAME = (role: FilmCredit["role"], medium: ActingMedium): string => {
  if (medium === "tv") return "Best Television Actor";
  if (medium === "stage") return "Best Stage Performance";
  if (role === "producer" || role === "director") return "Best Picture";
  return role === "lead" ? "Best Actor" : "Best Supporting Actor";
};

/** Resolve last year's contender: nomination, prize, and what the prize changes. */
export function processAwards(p: PlayerState, rng: Rng, notices: Notices) {
  const a = p.acting;
  const r = a.awardsRun;
  if (!r) return;
  a.awardsRun = null;
  const camp = CAMPAIGNS[r.campaign];
  const roleF = r.role === "cameo" ? 0.5 : r.role === "supporting" ? 0.8 : 1;
  const nomChance = clamp((r.critics - 62) / 45 + r.prestige / 500 + camp.nom + (r.campaign === "festivals" && r.indie ? 0.1 : 0), 0.03, 0.95);
  if (r.campaign === "blitz" && rng.chance(0.15)) {
    raiseScandal(p, "acting", rng, notices, 1, "your awards campaign was accused of dirty tricks against a rival");
  }
  if (!rng.chance(nomChance)) {
    logEvent(p, notices, "Awards Season", `"${r.title}" was passed over when the nominations came out${r.spent ? `, despite ${money(r.spent)} spent on the campaign` : ""}.`, "neutral");
    return;
  }
  a.nominations += 1;
  const winChance = clamp(0.12 + (r.critics - 70) / 120 + camp.win + a.reputation / 900, 0.04, 0.6) * roleF;
  if (!rng.chance(winChance)) {
    a.reputation = clamp(a.reputation + 2);
    logEvent(p, notices, "Nominated", `"${r.title}" earned a nomination (critics ${r.critics}) but the prize went elsewhere.`, "good");
    return;
  }
  const jury = r.campaign === "festivals" && r.indie && rng.chance(0.5);
  const award = jury ? "Festival Jury Prize" : AWARD_NAME(r.role, r.medium);
  const credit = a.credits.find((c) => c.id === r.filmId || (r.medium === "tv" && c.medium === "tv" && c.title === r.title));
  if (credit) credit.award = award;
  a.awards.push(`${award}: ${r.title} (${p.year})`);
  a.reputation = clamp(a.reputation + 8);
  a.pull = clamp(a.pull + 3);
  changeStat(p, "fame", 8);
  changeStat(p, "happiness", 15);
  const job = p.currentJob;
  if (job && job.lineId === "actor") {
    job.salary = Math.round(job.salary * 1.2);
    p.annualSalary = job.salary;
  }
  logEvent(p, notices, "Awards Season", `"${r.title}" won ${award}! Offers flood in and your fee goes up 20%.`, "jackpot");
}

// ---------------------------------------------------------------------------
// Television
// ---------------------------------------------------------------------------

/** Close the book on a series: the credit, syndication money and what the run did for your name. */
export function finishSeries(p: PlayerState, notices: Notices, why: string) {
  const a = p.acting;
  const s = a.series;
  if (!s) return;
  a.series = null;
  if (s.season < 1) {
    logEvent(p, notices, "Pilot Passed", `${why}`, "bad");
    return;
  }
  const outcome: FilmCredit["outcome"] =
    s.ratings >= 68 && s.season >= 3 ? "blockbuster" : s.ratings >= 52 && s.season >= 2 ? "hit" : s.season >= 2 || s.ratings >= 40 ? "modest" : "flop";
  a.credits.push({
    id: `tv:${s.title}:${p.year}`,
    title: s.title,
    year: p.year,
    genre: s.genre,
    role: s.role,
    budget: 0,
    boxOffice: 0,
    critics: Math.round(s.critics),
    outcome,
    medium: "tv",
    seasons: s.season,
  });
  if (s.season >= 4 && s.ratings >= 35) {
    const amount = Math.round(s.fee * 0.12 * clamp(s.ratings / 60, 0.4, 1.4));
    a.residuals.push({ title: `${s.title} (syndication)`, amount, yearsLeft: 6 });
    why += ` Reruns will pay about ${money(amount)} a year for a while.`;
  }
  if (outcome === "blockbuster") a.reputation = clamp(a.reputation + 5);
  logEvent(p, notices, "Series Over", `${why} "${s.title}" ran ${s.season} season${s.season === 1 ? "" : "s"}.`, outcome === "flop" ? "bad" : "neutral");
}

/** One television year. Returns the fees earned. */
export function processSeries(p: PlayerState, rng: Rng, notices: Notices): number {
  const a = p.acting;
  const s = a.series;
  if (!s) return 0;
  const job = p.currentJob;
  if (!job || job.lineId !== "actor") {
    finishSeries(p, notices, "You stepped away from acting and the show wrote your character out.");
    return 0;
  }
  const star = clamp(0.5 * a.pull + 0.3 * a.reputation + 0.2 * p.fame);
  const effortBonus = p.effort === "grind" ? 6 : p.effort === "coast" ? -8 : 0;
  const perf = clamp(0.55 * p.skills.acting + 0.25 * job.performance + 0.2 * p.smarts + effortBonus);

  if (s.status === "pilot") {
    const pilotFee = Math.round(s.fee * 0.12);
    const pick = clamp(0.25 + s.script / 250 + s.prestige / 400 + star / 400 + (a.agent ? a.agent.skill / 600 : 0), 0.1, 0.85);
    if (rng.chance(pick)) {
      s.status = "running";
      logEvent(p, notices, "Pilot Picked Up", `${s.network} ordered "${s.title}" to series. The first season airs next year at ${money(s.fee)} a season.`, "good");
    } else {
      finishSeries(p, notices, `${s.network} passed on the pilot of "${s.title}". You were paid ${money(pilotFee)} for the shoot and that is that.`);
    }
    return pilotFee;
  }

  s.season += 1;
  const critics = clamp(Math.round(0.45 * s.script + 0.35 * perf + 0.1 * s.prestige + rng.int(-12, 12)));
  s.critics = s.season === 1 ? critics : s.critics * 0.6 + critics * 0.4;
  const momentum = s.season > 1 ? (s.ratings - 50) * 0.25 : 0;
  const fatigue = s.season > 6 ? (s.season - 6) * 3 : 0;
  s.ratings = clamp(Math.round(0.3 * s.script + 0.25 * star + 0.15 * perf + 0.1 * s.prestige + 12 + momentum - fatigue + rng.int(-18, 18)));
  s.yearsLeft -= 1;

  const fee = s.fee;
  changeStat(p, "fame", Math.round(s.ratings / 30));
  if (s.ratings >= 60) a.reputation = clamp(a.reputation + 1);
  if (s.ratings >= 70) a.pull = clamp(a.pull + 2);
  if (s.ratings >= 65) {
    job.salary = Math.round(job.salary * 1.04);
    p.annualSalary = job.salary;
  }
  p.skills.acting = clamp(p.skills.acting + trained(p, "acting", p.skills.acting, p.effort === "grind" ? 3 : 2));
  logEvent(p, notices, `Season ${s.season} Airs`, `"${s.title}" drew ratings of ${s.ratings}/100 (critics ${Math.round(s.critics)}). Your season fee: ${money(fee)}.`, s.ratings >= 60 ? "good" : "neutral");

  // Television critics' darlings go into the same awards season as films.
  if (!a.awardsRun && s.critics >= 66) {
    a.awardsRun = { filmId: `tv:${s.title}:${p.year}`, title: s.title, genre: s.genre, role: s.role, critics: Math.round(s.critics), prestige: s.prestige, indie: false, medium: "tv", campaign: "quiet", spent: 0 };
  }

  let extra = 0;
  if (s.ratings < 22) {
    extra = Math.round(fee * Math.min(Math.max(s.yearsLeft, 0), 2) * 0.4);
    finishSeries(p, notices, `The ratings collapsed and ${s.network} pulled the plug.${extra ? ` The contract pays out ${money(extra)}.` : ""}`);
  } else if (s.yearsLeft <= 0) {
    const renew = clamp((s.ratings - 25) / 55, 0.05, 0.95);
    if (rng.chance(renew)) {
      s.yearsLeft = rng.int(2, 3);
      s.fee = Math.round(s.fee * (s.ratings >= 60 ? 1.3 : 1.15));
      logEvent(p, notices, "Renewed", `${s.network} renewed "${s.title}" for ${s.yearsLeft} more seasons. Your fee rises to ${money(s.fee)}. You are locked in again.`, "good");
    } else {
      finishSeries(p, notices, `${s.network} did not renew the show.`);
    }
  }
  return fee + extra;
}

// ---------------------------------------------------------------------------
// Residuals and franchises
// ---------------------------------------------------------------------------

/** Pay out repeat fees and age them. Returns the gross paid. */
export function processResiduals(p: PlayerState): number {
  const a = p.acting;
  let total = 0;
  for (const r of a.residuals) {
    total += r.amount;
    r.yearsLeft -= 1;
  }
  a.residuals = a.residuals.filter((r) => r.yearsLeft > 0);
  return total;
}

/** A franchise owes the studio a sequel a year, each with a bigger fee and a more tired audience. */
export function processFranchise(p: PlayerState, rng: Rng, notices: Notices) {
  const a = p.acting;
  const f = a.franchise;
  const job = p.currentJob;
  if (!f) return;
  if (!job || job.lineId !== "actor") {
    a.franchise = null;
    logEvent(p, notices, "Franchise Ends", `With you out of the business, the studio rebooted "${f.name}" with a new cast.`, "neutral");
    return;
  }
  if (a.pendingFilm) return;
  const role = job.tier >= 2 ? "lead" : "supporting";
  const base = buildOffer(p, rng, role, f.genre, f.fee);
  a.pendingFilm = {
    ...base,
    title: `${f.name}: Part ${roman(f.installment)}`,
    budget: Math.round(base.budget * (1 + 0.2 * (f.installment - 1))),
    installment: f.installment,
    medium: "film",
  };
  f.filmsLeft -= 1;
  f.installment += 1;
  f.fee = Math.round(f.fee * 1.15);
  if (f.filmsLeft <= 0) {
    a.franchise = null;
    logEvent(p, notices, "Franchise Wraps", `You owe the studio nothing after "${a.pendingFilm.title}". The saga ends with this one.`, "neutral");
  } else {
    notices.push(info("Sequel in Production", `"${a.pendingFilm.title}" is shooting. ${f.filmsLeft} more to go on your contract.`));
  }
}
