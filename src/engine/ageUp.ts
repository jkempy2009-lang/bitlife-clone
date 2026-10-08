import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { incomeTaxFor } from "@/data/countries";
import { DISEASE_CATALOG, instantiateDisease } from "@/data/diseases";
import {
  CAR_LOAN_RATE,
  MORTGAGE_RATE,
} from "@/data/assetsCatalog";
import { CAREER_BY_ID, PROGRAMS } from "@/data/careersRegistry";
import { CERT_BY_ID } from "@/data/certificates";
import {
  addLog,
  changeStat,
  clone,
  getPartner,
  hasFlag,
  isRoyal,
  livingRelatives,
  logHeader,
  netWorth,
  clampAll,
  MAX_AGE,
} from "./state";
import { deathChance, killPlayer, naturalCause } from "./mortality";
import { endRelationship, maybeGrandchild } from "./social";
import { processFriendLoans } from "./friends";
import { processTemper } from "./talentEffects";
import { processChildren, schoolCosts } from "./parenting";
import { processLaterLife } from "./later";
import { ensureSuccession, processRoyalFamily } from "./royalty";
import { processCourt, royalFinance } from "./court";
import { contributionFor, drawdownFor, growRetirement } from "./retirement";
import { selectEvents } from "./events";
import { convertToFullTime, maybeCoup, pensionFor, promotionEvent } from "./career";
import { checkAchievements } from "./achievements";
import { checkChallenge } from "./challenges";
import { processVices } from "./vices";
import { escortIsIllegal, processAdultWork, processIntimacy } from "./intimacy";
import { processPolitics } from "./politics";
import { processMob } from "./underworld";
import { processSpy } from "./spy";
import { processJustice } from "./justiceYear";
import { hobbyIncome, processHobbies } from "./hobbies";
import { processAthlete, processBusiness } from "./paths";
import { processCreative } from "./creative";
import { creativeFameFloor, processCelebrity } from "./celebrity";
import { EFFORT_STUDY, applyEffortCosts, effortPerformanceDelta } from "./occupation";
import { applyHabitEffects, applyMoodEffects, habitCost, illnessCosts, riskMultiplier } from "./health";
import { SHARED_LIVING_FACTOR, SPOUSE_TAX, childSupportDue, marriedPartner, spouseIncome } from "./household";
import { LIFESTYLES, RENT_TIERS, livesWithParents, BASE_LIVING, CHILD_COST, advanceClimate, housingCost, housingIndex, layoffChance, processInvestments } from "./world";

type Notices = NonNullable<ActionResult["notices"]>;

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" | "surgery" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// finalize: invariants applied after *every* state transition
// ---------------------------------------------------------------------------

export function finalize(p: PlayerState, notices: Notices) {
  clampAll(p);
  if (p.bankBalance < 0) {
    const debt = Math.round(-p.bankBalance);
    p.outstandingLoans += debt;
    p.bankBalance = 0;
    p.creditScore -= 12;
    addLog(p, `Your account overdrafted by ${money(debt)}. The bank converted it into a high-interest loan.`);
  }
  if (p.alive && p.health <= 0) {
    const worst = [...p.diseases].filter((d) => d.severity !== "mild").sort((a, b) => b.healthImpact - a.healthImpact)[0];
    killPlayer(p, worst ? worst.name.toLowerCase() : p.age >= 70 ? "old age" : "poor health");
  }
  if (p.alive && p.age >= MAX_AGE) killPlayer(p, "extreme old age");
  if (p.alive) {
    const coup = maybeCoup(p);
    if (coup) notices.push({ kind: "event", event: coup });
  }
  p.stats.peakNetWorth = Math.max(p.stats.peakNetWorth, netWorth(p));
  checkAchievements(p, notices);
  checkChallenge(p, notices);
  clampAll(p);
}

// ---------------------------------------------------------------------------
// Social graph
// ---------------------------------------------------------------------------

function processSocial(p: PlayerState, rng: Rng, notices: Notices) {
  for (const r of p.relatives) {
    if (!r.alive) continue;
    r.age += 1;
    if (r.partnerStatus === "ex") continue;
    if (r.relation === "Lover") continue; // handled in processIntimacy
    if (r.relation === "Pet") {
      r.relationshipBar = clamp(r.relationshipBar - rng.int(0, 2));
      if (r.age >= 9 && rng.chance(clamp((r.age - 8) * 0.07, 0, 0.7))) {
        r.alive = false;
        r.deathAge = r.age;
        r.deathYear = p.year;
        changeStat(p, "happiness", -Math.round(5 + r.relationshipBar / 10));
        const body = `Your ${r.species ?? "pet"}, ${r.name}, passed away at age ${r.age}. They were a very good ${r.species === "cat" ? "cat" : "friend"}.`;
        addLog(p, body);
        notices.push(info("Goodbye, Old Friend", body, "bad"));
        if (!p.relatives.some((x) => x.relation === "Pet" && x.alive && x.species === r.species && x.id !== r.id)) {
          p.flags = p.flags.filter((f) => f !== (r.species === "cat" ? "has_cat" : "has_dog"));
        }
      }
      continue;
    }
    r.health = clamp(r.health + rng.int(r.age > 60 ? -4 : -1, 1));
    const decay =
      r.relation === "Partner" ? rng.int(0, 4)
      : r.relation === "Friend" ? rng.int(1, 5)
      : r.relation === "Child" ? rng.int(0, 2)
      : rng.int(0, 3);
    r.relationshipBar = clamp(r.relationshipBar - Math.max(0, Math.round(decay * (1.25 - p.talents.empathy / 200))) - (p.isInPrison ? 3 : 0));
    // Mortality: spec asks for a death roll for the elderly; we use a graded curve so younger deaths are possible but rare.
    if (r.age > 40 && rng.chance(deathChance(r.age, r.health))) {
      r.alive = false;
      r.deathAge = r.age;
      r.deathYear = p.year;
      const line = `Your ${r.relation}, ${r.name}, passed away at age ${r.age}`;
      addLog(p, line + ".");
      let body = line + ".";
      changeStat(p, "happiness", -Math.round(6 + r.relationshipBar / 8));
      if (r.relation === "Partner" && r.partnerStatus === "married" && !p.flags.some((f) => f.startsWith("grief:"))) p.flags.push(`grief:${p.year}`);
      const chance =
        r.relation === "Parent" || r.relation === "Partner" ? 0.1 + 0.12 * r.incomeTier : 0.04 * r.incomeTier;
      if (rng.chance(chance)) {
        const estate = r.incomeTier * r.incomeTier * 20_000;
        const share = Math.round(estate * (r.relation === "Parent" || r.relation === "Partner" ? rng.float(0.5, 1) : 0.15));
        p.bankBalance += share;
        body += ` They left you ${money(share)} in their will.`;
        addLog(p, `You inherited ${money(share)} from ${r.name}.`);
      }
      notices.push(info("A Loss in the Family", body, "bad"));
    }
    if (r.relation === "Child" && r.age === 18) addLog(p, `Your child ${r.name} turned 18.`);
  }
  if (p.age >= 40) {
    const gc = maybeGrandchild(p, rng);
    if (gc) notices.push(info("Grandchild!", `Your family grew: ${gc.name} was born.`, "good"));
  }
  // Relationship fallout
  const partner = getPartner(p);
  if (partner && partner.relationshipBar <= 8 && rng.chance(0.4)) {
    const married = partner.partnerStatus === "married";
    const name = partner.name;
    endRelationship(p, married ? "divorce" : "breakup");
    const body = married ? `${name} filed for divorce. The marriage is over.` : `${name} broke up with you.`;
    addLog(p, body);
    changeStat(p, "happiness", -10);
    notices.push(info(married ? "Divorce" : "Breakup", body, "bad"));
  }
  p.relatives = p.relatives.filter((r) => {
    if (r.relation === "Friend" && r.alive && r.relationshipBar <= 0) {
      addLog(p, `You and ${r.name} drifted apart.`);
      return false;
    }
    return true;
  });
  if (p.age < 18 && !hasFlag(p, "orphan") && livingRelatives(p, "Parent").length === 0) {
    p.flags.push("orphan");
    changeStat(p, "happiness", -12);
    addLog(p, "With both parents gone, you're now an orphan.");
  }
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

function processAssets(p: PlayerState, rng: Rng) {
  const marketIndex = housingIndex(p.economy.climate, rng);
  if (p.properties.length > 0) {
    addLog(p, `The housing market ${marketIndex >= 0 ? "rose" : "fell"} ${(Math.abs(marketIndex) * 100).toFixed(1)}% this year.`);
  }
  for (const v of p.vehicles) {
    v.currentValue = Math.max(300, Math.round(v.currentValue * 0.88));
    p.bankBalance -= Math.round(v.purchasePrice * 0.03 * v.maintenanceWeight);
    v.condition = clamp(v.condition - rng.int(3, 8));
    if (v.loanBalance > 0) {
      const interest = v.loanBalance * CAR_LOAN_RATE;
      const pay = Math.min(v.loanPaymentAnnual, v.loanBalance + interest);
      p.bankBalance -= pay;
      v.loanBalance = Math.max(0, Math.round(v.loanBalance - (pay - interest)));
      v.loanYearsLeft -= 1;
      if (v.loanYearsLeft <= 0) v.loanBalance = 0;
    }
  }
  for (const h of p.properties) {
    const extraDrop = h.condition < 50 ? ((50 - h.condition) / 50) * 0.03 : 0;
    h.currentValue = Math.round(h.currentValue * (1 + marketIndex - extraDrop));
    if (h.remainingTerm > 0) {
      const pay = h.monthlyMortgage * 12;
      p.bankBalance -= pay;
      const interest = h.mortgageBalance * MORTGAGE_RATE;
      h.mortgageBalance = Math.max(0, Math.round(h.mortgageBalance - (pay - interest)));
      h.remainingTerm -= 1;
      if (h.remainingTerm <= 0) {
        h.mortgageBalance = 0;
        h.monthlyMortgage = 0;
      }
    }
    p.bankBalance -= Math.round(h.originalValue * (1 - h.condition / 100) * 0.02);
    if (h.condition > 20) h.condition -= 4;
  }
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

function processFinance(p: PlayerState, rng: Rng, notices: Notices) {
  let gross = 0;
  if (p.currentJob && !p.isInPrison) gross += p.currentJob.salary;
  if (p.pension > 0) gross += p.pension;
  gross += processCreative(p, rng, notices); // creator, music and screen income
  gross += hobbyIncome(p);
  processInvestments(p, rng, notices);
  const profit = processBusiness(p, rng, notices);
  if (profit > 0) gross += profit;
  else p.bankBalance += profit;

  const adult = p.age >= 18;
  if (adult && p.age < 65 && !p.currentJob && !isRoyal(p) && !p.isInPrison && !p.music.signed && p.pension === 0 && !marriedPartner(p)) {
    gross += 16_000;
  }
  // Royal funding (Sovereign Grant, allowances) is tax exempt; duchy and estate income is private and taxed like any other.
  const fin = isRoyal(p) ? royalFinance(p) : null;
  const allowance = fin ? fin.allowance : 0;
  if (fin) gross += fin.duchy + fin.estate;
  const offBooks = (p.currentJob?.lineId === "mafia" || escortIsIllegal(p)) && !p.isInPrison ? p.currentJob!.salary : 0;
  // Retirement account: grows, funds retirees, and takes pre-tax contributions from workers (with an employer match).
  growRetirement(p, rng);
  const draw = drawdownFor(p);
  p.retirementSavings -= draw;
  gross += draw;
  const { employee, employer } = contributionFor(p);
  const tax = incomeTaxFor(p.residence.country, Math.max(0, gross - offBooks - employee));
  p.taxesPaidThisYear = tax;
  p.bankBalance += gross - tax + allowance - employee;
  if (fin) {
    p.bankBalance -= fin.staff + fin.upkeep;
    p.court.ledger = { grant: isSovereignRank(p) ? fin.allowance : 0, duchy: fin.duchy, estate: fin.estate, allowance: isSovereignRank(p) ? 0 : fin.allowance, staff: fin.staff, upkeep: fin.upkeep };
  }
  p.retirementSavings += employee + employer;
  // A spouse's earnings join the household pot (taxed at a flat effective rate), and sharing a home costs extra.
  const spouse = marriedPartner(p);
  const spouseNet = spouse && !p.isInPrison ? Math.round(spouseIncome(spouse) * (1 - SPOUSE_TAX)) : 0;
  p.bankBalance += spouseNet;

  let living = 0;
  const parentSupport = p.age < 21 && livingRelatives(p, "Parent").length > 0;
  if (adult && !p.isInPrison && !isRoyal(p) && !parentSupport) {
    // Lifestyle inflation: the more you earn, the more you spend.
    const dependents = p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age < 18).length;
    const ls = LIFESTYLES[p.lifestyle] ?? LIFESTYLES[1];
    living = (BASE_LIVING * ls.base * (spouse ? 1 + SHARED_LIVING_FACTOR : 1) + housingCost(p) + dependents * CHILD_COST + Math.max(0, gross + spouseNet - 25_000) * ls.slope) * (1 - (p.talents.moneySense - 50) / 700);
    living += childSupportDue(p, gross) + schoolCosts(p);
  }
  living = Math.round(living);
  p.bankBalance -= living;
  // Standing health routine and the price of chronic illness (heavier where care isn't covered).
  const care = adult && !p.isInPrison ? habitCost(p) + illnessCosts(p) : 0;
  if (care > 0) {
    p.bankBalance -= care;
    if (illnessCosts(p) > 0 && p.bankBalance < 0 && p.age >= 18) {
      // Unaffordable treatment means going without.
      p.health -= 2;
    }
  }

  const prog = PROGRAMS[p.education.stage as keyof typeof PROGRAMS];
  const certTuition = p.education.stage === "Certificate" ? (CERT_BY_ID[p.education.major ?? ""]?.tuition ?? 0) : 0;
  const fullTuition = prog ? prog.tuition : certTuition;
  const tuition = fullTuition && !p.isInPrison ? Math.round(fullTuition * (1 - (p.education.scholarship ?? 0))) : 0;
  p.bankBalance -= tuition;

  if (p.bankBalance > 0) p.bankBalance = Math.round(p.bankBalance * 1.015);

  let loanPaid = 0;
  if (p.outstandingLoans > 0) {
    p.outstandingLoans = Math.round(p.outstandingLoans * 1.07);
    if (p.bankBalance > 0) {
      loanPaid = Math.min(p.bankBalance, Math.max(500, Math.round(p.outstandingLoans * 0.12)), p.outstandingLoans);
      p.bankBalance -= loanPaid;
      p.outstandingLoans -= loanPaid;
    }
    p.creditScore += loanPaid >= p.outstandingLoans * 0.1 ? 3 : -8;
  } else if (p.bankBalance > 0) {
    p.creditScore += 4;
  }
  if (gross + allowance > 0 || living > 0 || tuition > 0) {
    addLog(
      p,
      `Finances: income ${money(gross + allowance)}, taxes ${money(tax)}${living ? `, living costs ${money(living)}` : ""}${tuition ? `, tuition ${money(tuition)}` : ""}.`,
    );
  }
  p.annualSalary = p.currentJob?.salary ?? 0;
}

// ---------------------------------------------------------------------------
// Medical
// ---------------------------------------------------------------------------

function processMedical(p: PlayerState, rng: Rng, notices: Notices) {
  applyHabitEffects(p);
  applyMoodEffects(p);
  // Natural ageing
  const lingering = p.diseases.some((d) => d.severity !== "mild");
  if (p.age < 55 && !lingering) p.health += rng.int(1, 4);
  else if (p.age < 55 && p.health < 70) p.health += 1;
  else if (p.age >= 55) p.health -= Math.max(0, rng.int(0, 1) + (p.age >= 75 ? 1 : 0) + (p.age >= 90 ? 1 : 0) + (p.talents.longevity < 35 ? 1 : 0) - (p.talents.longevity > 65 && rng.chance(0.5) ? 1 : 0));

  for (const d of [...p.diseases]) {
    // Stat impacts are applied every year; mild and chronic conditions are dampened so a life on autopilot stays survivable.
    const scale = d.severity === "fatal" ? 1 : d.severity === "chronic" ? 0.3 : 0.4;
    p.health -= d.healthImpact * scale;
    p.happiness -= d.happinessImpact * scale;
    if (d.severity === "mild" && rng.chance(0.8)) {
      p.diseases = p.diseases.filter((x) => x.id !== d.id);
      addLog(p, `You recovered from ${d.name}.`);
    } else if (d.severity === "fatal" && d.yearsLeft !== undefined) {
      d.yearsLeft -= 1;
      if (d.yearsLeft <= 0) {
        killPlayer(p, d.name.toLowerCase());
        return;
      }
    }
  }

  // New diagnoses (at most one a year)
  const owned = new Set(p.diseases.map((d) => d.id));
  const healthFactor = clamp((100 - p.health) / 40 + 0.6, 0.5, 2.2);
  const candidates = DISEASE_CATALOG.filter((d) => !owned.has(d.id) && p.age >= d.minAge);
  const weight = (d: (typeof candidates)[number]) => d.baseChance * healthFactor * riskMultiplier(p, d.id);
  let roll = rng.weighted(candidates, (d) => weight(d) * (d.severity === "mild" ? 1 : 1 + (p.age - d.minAge) / 40));
  if (roll && rng.chance(Math.min(0.5, 0.45 * candidates.reduce((s, d) => s + weight(d), 0)))) {
    // Regular check-ups catch cancer early, when it is treatable.
    const screened = p.flags.includes(`checkup_${p.year}`) || p.flags.includes(`checkup_${p.year - 1}`);
    let earlyCatch = false;
    if (roll.id === "cancer" && screened && rng.chance(0.65)) {
      roll = DISEASE_CATALOG.find((d) => d.id === "early_cancer") ?? roll;
      earlyCatch = roll.id === "early_cancer";
    }
    p.diseases.push(instantiateDisease(roll, (a, b) => rng.int(a, b)));
    addLog(p, `You were diagnosed with ${roll.name}${earlyCatch ? ", caught early at a routine check-up" : ""}.`);
    notices.push(
      info(
        "Diagnosis",
        `You were diagnosed with ${roll.name}.${earlyCatch ? " Your last check-up caught it early, which makes it far more treatable." : roll.severity === "fatal" ? " The prognosis is grim." : roll.severity === "chronic" ? " It's a chronic condition that will wear on you each year." : " It should pass in time."}`,
        "bad",
      ),
    );
  }
  p.flags = p.flags.filter((f) => !f.startsWith("checkup_") || f === `checkup_${p.year}` || f === `checkup_${p.year - 1}`);

  p.health = clamp(Math.round(p.health));
  if (p.health <= 0) return; // finalize() handles the cause of death
  if (rng.chance(deathChance(p.age, p.health))) {
    const worst = [...p.diseases].filter((d) => d.severity !== "mild").sort((a, b) => b.healthImpact - a.healthImpact)[0];
    killPlayer(p, worst && p.age >= 40 ? worst.name.toLowerCase() : naturalCause(p.age, rng));
  }
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

function processEducation(p: PlayerState, rng: Rng, notices: Notices) {
  const e = p.education;
  if (p.age === 5 && e.stage === "None" && !e.degrees.includes("highschool")) {
    e.stage = "Primary";
    e.yearsLeft = 9;
    addLog(p, "You started school.");
  }
  if (p.age < 25 && p.smarts < 100) changeStat(p, "smarts", rng.int(0, 2));
  if (e.stage === "None" || p.isInPrison) {
    e.studyEffort = Math.max(0, e.studyEffort * 0.5);
    return;
  }
  if (p.age >= 8) e.studyEffort = Math.min(8, e.studyEffort + EFFORT_STUDY[p.effort]);
  e.grades = clamp(Math.round(e.grades * 0.5 + 0.5 * (p.smarts * 0.6 + 25 + e.studyEffort * 6 + (p.talents.learner - 50) * 0.25 + rng.int(-10, 10))));
  const effort = e.studyEffort;
  e.studyEffort = Math.max(0, e.studyEffort * 0.5);
  if ((e.scholarship ?? 0) > 0 && e.grades < 70) {
    e.scholarship = 0;
    const body = "Your grades slipped below 70 and the university withdrew your scholarship. Tuition is now due in full.";
    addLog(p, body);
    notices.push(info("Scholarship Lost", body, "bad"));
  }
  if (e.stage === "Certificate") changeStat(p, "happiness", p.currentJob ? -1 : 0);
  e.yearsLeft -= 1;
  if (e.yearsLeft > 0) return;

  if (e.stage === "Primary") {
    e.stage = "HighSchool";
    e.yearsLeft = 4;
    addLog(p, "You started high school.");
    return;
  }
  const base = e.stage === "HighSchool" ? 0.5 : 0.35;
  const divisor = e.stage === "HighSchool" ? 200 : 150;
  const chance = clamp(base + e.grades / divisor + effort * 0.03, 0.2, 0.98);
  if (!rng.chance(chance)) {
    e.yearsLeft = 1;
    changeStat(p, "happiness", -8);
    const body = `Your grades weren't good enough to graduate. You must repeat your final year.`;
    addLog(p, body);
    notices.push(info("Held Back", body, "bad"));
    return;
  }
  let degree = "highschool";
  let label = "high school";
  if (e.stage === "Certificate") {
    const cert = CERT_BY_ID[e.major ?? ""];
    degree = `cert:${e.major}`;
    label = cert ? `the ${cert.name}` : "your course";
    for (const [line, yrs] of Object.entries(cert?.experience ?? {})) p.careerYears[line] = (p.careerYears[line] ?? 0) + yrs;
  }
  if (e.stage === "University") {
    degree = `bachelor:${e.major ?? "arts"}`;
    label = "university";
  } else if (e.stage === "MedicalSchool") {
    degree = "md";
    label = "medical school";
  } else if (e.stage === "LawSchool") {
    degree = "jd";
    label = "law school";
  } else if (e.stage === "Masters") {
    degree = "masters";
    label = "graduate school";
  }
  if (!e.degrees.includes(degree)) e.degrees.push(degree);
  e.stage = "None";
  e.major = null;
  const fullTime = convertToFullTime(p);
  if (fullTime) addLog(p, `With your studies over, ${fullTime.charAt(0).toLowerCase()}${fullTime.slice(1)}`);
  changeStat(p, "happiness", 12);
  const body = `You graduated from ${label}!${degree === "md" ? " You're now Dr. " + p.lastName + "." : ""}`;
  addLog(p, body);
  notices.push(info("Graduation!", body, "good"));
}

// ---------------------------------------------------------------------------
// Career
// ---------------------------------------------------------------------------

function processCareer(p: PlayerState, rng: Rng, notices: Notices) {
  processAthlete(p, rng, notices);
  processAdultWork(p, rng, notices);
  processPolitics(p, rng, notices);
  processMob(p, rng, notices);
  processSpy(p, rng, notices);
  const job = p.currentJob;
  if (!job || p.isInPrison) return;
  p.stats.yearsWorked += job.partTime ? 0.5 : 1;
  p.careerYears[job.lineId] = (p.careerYears[job.lineId] ?? 0) + (job.partTime ? 0.5 : 1);
  // Elected officials, mobsters and agents answer to voters, bosses and handlers, not managers; athletes are driven by processAthlete.
  if (["politics", "crime", "spy"].includes(CAREER_BY_ID[job.lineId]?.pack ?? "") || job.lineId === "athlete") return;
  job.performance = clamp(job.performance + effortPerformanceDelta(job.partTime ? "steady" : p.effort, rng) + Math.round((p.smarts - 50) / 25));
  if (job.performance < 20 && rng.chance(0.4)) {
    const body = `You were fired from your job as a ${job.title} for poor performance.`;
    p.currentJob = null;
    changeStat(p, "happiness", -10);
    addLog(p, body);
    notices.push(info("You're Fired", body, "bad"));
    return;
  }
  if (rng.chance(layoffChance(p.economy.climate))) {
    const body = `${job.company} downsized and let you go. You received a small severance package.`;
    p.currentJob = null;
    p.bankBalance += Math.round(job.salary * 0.15);
    changeStat(p, "happiness", -8);
    addLog(p, body);
    notices.push(info("Laid Off", body, "bad"));
    return;
  }
  if (job.performance >= 50) {
    const line = CAREER_BY_ID[job.lineId];
    const cap = line ? line.ladder[line.ladder.length - 1].salary * 1.6 : Infinity;
    // Annual raise tracks performance and the economy: ~1% for adequate work, up to ~5% for stars.
    const climate = p.economy.climate === "boom" ? 1.3 : p.economy.climate === "recession" ? 0.4 : 1;
    const rate = (0.01 + Math.max(0, job.performance - 50) / 1000) * climate;
    job.salary = Math.min(Math.round(job.salary * (1 + rate)), Math.round(cap));
  }
  p.annualSalary = job.salary;
  if (p.age >= 75) {
    p.pension = pensionFor(p);
    addLog(p, `You retired from your job as a ${job.title} at age ${p.age}. Your pension is ${money(p.pension)} a year.`);
    p.currentJob = null;
    p.annualSalary = 0;
    return;
  }
  job.yearsInRole = (job.yearsInRole ?? 0) + 1;
  // Promotions need standout performance, time in the role, and an opening: rarer at the top and in a recession.
  const openingChance = (p.economy.climate === "boom" ? 0.55 : p.economy.climate === "recession" ? 0.2 : 0.4) * Math.max(0.3, 1 - 0.15 * job.tier) * (1 + (p.talents.leadership - 50) / 150);
  if (!job.partTime && job.performance > 85 && job.yearsInRole >= 3 + job.tier && rng.chance(openingChance)) {
    const ev = promotionEvent(p);
    if (ev) notices.push({ kind: "event", event: ev });
  }
}

// ---------------------------------------------------------------------------
// Entertainment, royalty, justice
// ---------------------------------------------------------------------------

function processEntertainment(p: PlayerState) {
  const job = p.currentJob;
  const actorActive = job?.lineId === "actor";
  if (actorActive && job.tier >= 2) changeStat(p, "fame", job.tier - 1);
  if (job?.lineId === "model" && job.tier >= 1) changeStat(p, "fame", job.tier);
  if (job?.lineId === "astronaut" && job.tier >= 1) changeStat(p, "fame", 1);
  const active = actorActive || job?.lineId === "creator" || job?.lineId === "model" || job?.lineId === "astronaut" || isRoyal(p) || creativeFameFloor(p) > 0 || job?.lineId === "athlete";
  if (!active) changeStat(p, "fame", p.fame > 0 ? -2 : 0);
}

function processRoyalty(p: PlayerState, rng: Rng, notices: Notices) {
  if (!isRoyal(p)) {
    // Not styled HRH, but still in the line of succession: the crown can still reach you.
    if (p.royal) {
      ensureSuccession(p, rng, notices);
      processRoyalFamily(p, rng, notices);
    }
    return;
  }
  const drift = rng.int(-3, 1) + Math.round((p.karma - 50) / 25) + Math.round((p.nation.economy + p.nation.freedom - 100) / 50) + Math.round((p.court.approval - 50) / 25);
  changeStat(p, "royalRespect", drift);
  for (const k of ["economy", "freedom", "military"] as const) {
    p.nation[k] += p.nation[k] > 50 ? -1 : p.nation[k] < 50 ? 1 : 0;
  }
  ensureSuccession(p, rng, notices);
  processRoyalFamily(p, rng, notices);
  processCourt(p, rng, notices);
}

const isSovereignRank = (p: PlayerState) => p.royalRank === "King" || p.royalRank === "Queen";

const MILESTONES: Record<number, { title: string; body: string }> = {
  5: { title: "First day of school", body: "School begins. Grades and friendships you build now will echo for years." },
  13: { title: "Teenager", body: "You're a teenager now. Expect dramas, crushes and bad ideas." },
  16: { title: "Sweet sixteen", body: "You're old enough for a driver's licence and a part-time job. Check the Career tab." },
  18: { title: "Adulthood", body: "You're an adult: you can leave home, go to university, work full time, and make your own mistakes." },
  30: { title: "Thirty", body: "A new decade. Your looks and metabolism are starting to notice the calendar." },
  40: { title: "Forty", body: "Midlife. Health checkups are worth taking seriously from here." },
  60: { title: "Retirement age", body: "You're eligible to retire. See the Career tab. Your pension depends on how long you worked." },
  80: { title: "Eighty", body: "Every year from here is a gift. Make them count." },
};

export const isMilestoneAge = (age: number) => age in MILESTONES;

function processMilestones(p: PlayerState, notices: Notices) {
  if (p.age === 18) {
    addLog(p, "You are now an adult.");
    if (livingRelatives(p, "Parent").length > 0 && !p.flags.includes("lives_with_parents")) {
      p.flags.push("lives_with_parents");
      addLog(p, "You're still living in your parents' home. You can move out whenever you can afford it (Assets tab).");
    }
    if (hasFlag(p, "trust_fund")) {
      p.bankBalance += 250_000;
      addLog(p, "Your family's trust fund released $250,000 to you.");
      notices.push(info("Trust fund released", "Your family's trust fund released $250,000 to you.", "jackpot"));
    }
  }
  if (p.age === 16) addLog(p, "You're old enough to get a driver's licence and a part-time job.");
  if (p.age === 60) addLog(p, "You're eligible for retirement. Check the Career tab.");
  const m = MILESTONES[p.age];
  if (m) notices.push(info(m.title, m.body, "neutral"));
}

function driftStats(p: PlayerState, rng: Rng) {
  const partner = getPartner(p);
  const atHome = livesWithParents(p);
  const rentBonus = p.properties.length === 0 && p.age >= 18 ? (atHome ? (p.age >= 25 ? -3 : 0) : RENT_TIERS[p.residence.rentTier].happiness * 2) : 0;
  const moodBonus = p.age >= 18 && !p.isInPrison ? (LIFESTYLES[p.lifestyle] ?? LIFESTYLES[1]).mood : 0;
  const temperament = Math.round(((p.outlook ?? 84) - 84) * 0.3);
  const target = 62 + temperament + moodBonus + rentBonus + (partner && partner.relationshipBar > 60 ? 4 : 0) + (p.bankBalance > 50_000 ? 3 : 0) - p.diseases.length * 2 - (p.isInPrison ? 25 : 0);
  p.happiness += Math.round((target - p.happiness) * 0.1) + rng.int(-2, 2);
  if (p.age >= 40 && !(p.talents.graceful > 50 && rng.chance((p.talents.graceful - 50) / 130))) p.looks -= rng.int(0, p.age >= 60 ? 3 : 2);
  if (p.age >= 70) p.smarts -= rng.int(0, 1);
}

// ---------------------------------------------------------------------------
// The Age Up transaction
// ---------------------------------------------------------------------------

export function ageUp(p0: PlayerState, rng: Rng): ActionResult {
  if (!p0.alive || p0.pendingTrial) return { player: p0 };
  const p = clone(p0);
  const notices: Notices = [];
  const before = { happiness: p.happiness, health: p.health, smarts: p.smarts, looks: p.looks, money: p.bankBalance, netWorth: netWorth(p) };

  // 1. Age & timeline
  p.age += 1;
  p.year += 1;
  const prevAnnual = p.annual;
  p.annual = {};
  addLog(p, logHeader(p));
  advanceClimate(p, rng, notices);

  processSocial(p, rng, notices); // 2. social graph
  processFriendLoans(p, rng, notices);
  processTemper(p, rng, notices);
  processChildren(p, rng, notices);
  processIntimacy(p, prevAnnual, rng, notices);
  processAssets(p, rng); // 3. asset economics
  processFinance(p, rng, notices); // 4. financial balance sheet
  processHobbies(p, prevAnnual, notices);
  processVices(p, rng, notices);
  processMedical(p, rng, notices); // 5. medical & disease progression
  if (p.alive) processLaterLife(p, notices);
  if (p.alive) {
    processEducation(p, rng, notices);
    processCareer(p, rng, notices);
    applyEffortCosts(p, rng, notices);
    processEntertainment(p);
    processCelebrity(p, rng, notices);
    processRoyalty(p, rng, notices);
    processJustice(p, rng, notices);
    processMilestones(p, notices);
    driftStats(p, rng);
  }

  finalize(p, notices);
  const nw = netWorth(p);
  p.history.push({ age: p.age, netWorth: nw, happiness: Math.round(p.happiness), health: Math.round(p.health) });
  p.lastYear = {
    age: p.age,
    happiness: Math.round(p.happiness - before.happiness),
    health: Math.round(p.health - before.health),
    smarts: Math.round(p.smarts - before.smarts),
    looks: Math.round(p.looks - before.looks),
    money: Math.round(p.bankBalance - before.money),
    netWorth: Math.round(nw - before.netWorth),
  };

  // 6. Event selection matrix (skipped when dead)
  if (p.alive) {
    for (const event of selectEvents(p, rng)) notices.push({ kind: "event", event });
  }
  return { player: p, notices };
}

