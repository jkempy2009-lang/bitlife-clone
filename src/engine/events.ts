import type { ActionResult, Chip, PlayerState, Relation } from "@/types/game.types";
import {
  EVENT_BY_ID,
  LIFE_EVENTS,
  type ChoiceEffects,
  type ChoiceOption,
  type EventRequirements,
  type LifeEvent,
} from "@/data/lifeEventsEngine";
import { DISEASE_BY_ID, instantiateDisease } from "@/data/diseases";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import {
  addLog,
  changeStat,
  clearFlag,
  clone,
  getPartner,
  hasFlag,
  isRoyal,
  livingRelatives,
  netWorth,
  setFlag,
  summarizeDelta,
} from "./state";
import { killPlayer } from "./mortality";
import { addPet, addRelative, endRelationship, firstName } from "./social";
import { startTrial } from "./crime";
import { exposeAffair } from "./intimacy";
import { promoteJob } from "./career";

// ---------------------------------------------------------------------------
// Token substitution: {mother}, {father}, {partner}, {sibling}, {friend}, {child}, {name}
// ---------------------------------------------------------------------------

export function fillTokens(text: string, p: PlayerState): string {
  const parents = livingRelatives(p, "Parent");
  const find = (relation: Relation, gender?: string) =>
    livingRelatives(p, relation).find((r) => !gender || r.gender === gender) ?? livingRelatives(p, relation)[0];
  const mother = parents.find((r) => r.gender === "Female") ?? parents[0];
  const father = parents.find((r) => r.gender === "Male") ?? parents[0];
  const partner = getPartner(p);
  const sib = find("Sibling");
  const fr = find("Friend");
  const ch = find("Child");
  return text
    .replaceAll("{mother}", mother ? firstName(mother) : "your mother")
    .replaceAll("{father}", father ? firstName(father) : "your father")
    .replaceAll("{partner}", partner ? firstName(partner) : "your partner")
    .replaceAll("{sibling}", sib ? firstName(sib) : "your sibling")
    .replaceAll("{friend}", fr ? firstName(fr) : "your friend")
    .replaceAll("{child}", ch ? firstName(ch) : "your child")
    .replaceAll("{name}", p.firstName);
}

// ---------------------------------------------------------------------------
// Requirement checks
// ---------------------------------------------------------------------------

export function meetsRequirements(p: PlayerState, req: EventRequirements | undefined): boolean {
  if (!req) return true;
  const partner = getPartner(p);
  if (req.hasPartner !== undefined && !!partner !== req.hasPartner) return false;
  if (req.married && partner?.partnerStatus !== "married") return false;
  if (req.hasChildren !== undefined && livingRelatives(p, "Child").length > 0 !== req.hasChildren) return false;
  if (req.hasSibling !== undefined && livingRelatives(p, "Sibling").length > 0 !== req.hasSibling) return false;
  if (req.hasFriend !== undefined && livingRelatives(p, "Friend").length > 0 !== req.hasFriend) return false;
  if (req.parentAlive !== undefined && livingRelatives(p, "Parent").length > 0 !== req.parentAlive) return false;
  if (req.hasGrandchildren !== undefined && livingRelatives(p, "Grandchild").length > 0 !== req.hasGrandchildren) return false;
  if (req.hasPartnerStatus && partner?.partnerStatus !== req.hasPartnerStatus) return false;
  if (req.jobLine && !(p.currentJob && req.jobLine.includes(p.currentJob.lineId))) return false;
  if (req.climate && !req.climate.includes(p.economy.climate)) return false;
  if (req.minVice) for (const [k, v] of Object.entries(req.minVice)) if (p.vices[k as keyof typeof p.vices] < (v as number)) return false;
  if (req.hasJob !== undefined && !!p.currentJob !== req.hasJob) return false;
  if (req.inSchool !== undefined && (p.education.stage !== "None") !== req.inSchool) return false;
  if (req.royal !== undefined && isRoyal(p) !== req.royal) return false;
  if (req.hasVehicle !== undefined && p.vehicles.length > 0 !== req.hasVehicle) return false;
  if (req.hasProperty !== undefined && p.properties.length > 0 !== req.hasProperty) return false;
  if (req.careers && !req.careers.some((c) => p.specialCareers.includes(c))) return false;
  if (req.flagsAll && !req.flagsAll.every((f) => hasFlag(p, f))) return false;
  if (req.flagsNone && req.flagsNone.some((f) => hasFlag(p, f))) return false;
  if (req.minBank !== undefined && p.bankBalance < req.minBank) return false;
  if (req.maxBank !== undefined && p.bankBalance > req.maxBank) return false;
  if (req.minNetWorth !== undefined && netWorth(p) < req.minNetWorth) return false;
  if (req.minStat) for (const [k, v] of Object.entries(req.minStat)) if ((p as never)[k] < (v as number)) return false;
  if (req.maxStat) for (const [k, v] of Object.entries(req.maxStat)) if ((p as never)[k] > (v as number)) return false;
  if (req.countries && !req.countries.includes(p.birthCountry)) return false;
  if (req.custom && !req.custom(p)) return false;
  return true;
}

export function isEligible(p: PlayerState, e: LifeEvent): boolean {
  if (p.age < e.minAge || p.age > e.maxAge) return false;
  if (!!e.prisonOnly !== p.isInPrison) return false;
  if (e.mature && (!p.matureContent || p.age < 18)) return false;
  if (e.once && p.seenEvents[e.id] !== undefined) return false;
  const last = p.seenEvents[e.id];
  if (last !== undefined && p.age - last < (e.cooldown ?? 3)) return false;
  return meetsRequirements(p, e.requires);
}

export function eventWeight(e: LifeEvent): number {
  const span = e.maxAge - e.minAge;
  const boost = span <= 2 ? 5 : span <= 6 ? 1.6 : 1;
  return (e.weight ?? 1) * boost;
}

/** Event Selection Matrix: filter by age window + requirements, pick weighted random. */
export function selectEvents(p: PlayerState, rng: Rng): LifeEvent[] {
  const picked: LifeEvent[] = [];
  // Forced follow-ups first.
  const queued = p.queuedEvents.splice(0);
  for (const id of queued) {
    const e = EVENT_BY_ID[id];
    if (e) picked.push(e);
  }
  const wanted = picked.length === 0 ? (rng.chance(0.5) ? 2 : 1) : rng.chance(0.2) ? 1 : 0;
  const recent = p.recentCats ?? [];
  for (let i = 0; i < wanted; i++) {
    const pool = LIFE_EVENTS.filter((e) => isEligible(p, e) && !picked.some((x) => x.id === e.id));
    // Keep years varied: categories that just happened are less likely to repeat.
    const choice = rng.weighted(pool, (e) => eventWeight(e) * (recent.slice(-2).includes(e.category) || picked.some((x) => x.category === e.category) ? 0.45 : 1));
    if (choice) picked.push(choice);
  }
  p.recentCats = [...recent, ...picked.map((e) => e.category)].slice(-6);
  return picked;
}

export function optionCost(opt: ChoiceOption): number {
  return Math.max(0, -(opt.effects.bankBalanceDelta ?? 0));
}

export function canAfford(p: PlayerState, opt: ChoiceOption): boolean {
  return optionCost(opt) <= p.bankBalance;
}

// ---------------------------------------------------------------------------
// Effect application
// ---------------------------------------------------------------------------

export function addDisease(p: PlayerState, id: string, rng: Rng): boolean {
  const t = DISEASE_BY_ID[id];
  if (!t || p.diseases.some((d) => d.id === id)) return false;
  p.diseases.push(instantiateDisease(t, (a, b) => rng.int(a, b)));
  if (["chlamydia", "herpes", "hiv"].includes(id) && !p.flags.includes("had_sti")) p.flags.push("had_sti");
  addLog(p, `You were diagnosed with ${t.name}.`);
  return true;
}

export function stripRoyalty(p: PlayerState) {
  p.royalRank = "none";
  p.royalRespect = 50;
  p.specialCareerPath = p.music.signed ? "musician" : p.specialCareers.includes("actor") ? "actor" : "none";
}

export function applyEffects(p: PlayerState, e: ChoiceEffects, rng: Rng) {
  changeStat(p, "happiness", e.happinessDelta);
  changeStat(p, "health", e.healthDelta);
  changeStat(p, "smarts", e.smartsDelta);
  changeStat(p, "looks", e.looksDelta);
  changeStat(p, "karma", e.karmaDelta);
  changeStat(p, "fame", e.fameDelta);
  if (isRoyal(p)) changeStat(p, "royalRespect", e.royalRespectDelta);
  if (e.bankBalanceDelta) p.bankBalance += e.bankBalanceDelta;
  if (e.bankMultiplier !== undefined) p.bankBalance = Math.round(p.bankBalance * e.bankMultiplier);
  if (e.diseaseTrigger) addDisease(p, e.diseaseTrigger, rng);
  if (e.cureAll) p.diseases = [];
  if (e.viceDelta) for (const [k, v] of Object.entries(e.viceDelta)) p.vices[k as keyof typeof p.vices] = clamp(p.vices[k as keyof typeof p.vices] + (v ?? 0));
  if (e.hobbyDelta) for (const [k, v] of Object.entries(e.hobbyDelta)) p.hobbies[k] = clamp((p.hobbies[k] ?? 0) + v);
  if (e.performanceDelta && p.currentJob) {
    p.currentJob.performance = clamp(p.currentJob.performance + e.performanceDelta);
  }
  e.setFlags?.forEach((f) => setFlag(p, f));
  e.clearFlags?.forEach((f) => clearFlag(p, f));
  if (e.skillDeltas) {
    for (const [k, v] of Object.entries(e.skillDeltas)) {
      const key = k as keyof PlayerState["skills"];
      p.skills[key] = clamp(p.skills[key] + (v ?? 0));
    }
  }
  if (e.relationshipDelta) {
    const { target, delta } = e.relationshipDelta;
    for (const r of livingRelatives(p)) {
      if (target === "All" ? r.relation !== "Pet" && r.relation !== "Lover" : r.relation === target) r.relationshipBar = clamp(r.relationshipBar + delta);
    }
  }
  if (e.addPet) addPet(p, e.addPet, rng);
  if (e.kill) {
    p.stats.kills += 1;
    p.karma = Math.max(0, p.karma - 40);
    if (!p.flags.includes("killer")) p.flags.push("killer");
    if (!p.flags.includes("under_investigation")) p.flags.push("under_investigation");
  }
  if (e.pregnancy && !p.pregnancy) {
    const other = e.pregnancy === "lover" ? p.relatives.find((r) => r.relation === "Lover" && r.alive && r.partnerStatus !== "ex") : getPartner(p);
    if (other) {
      const carrier = p.gender === "Female" ? "self" : other.gender === "Female" ? other.id : "self";
      p.pregnancy = { carrier, other: other.name };
    }
  }
  if (e.exposeAffair) exposeAffair(p, rng, []);
  if (e.marry) {
    const partner = getPartner(p);
    if (partner && partner.partnerStatus !== "married") {
      partner.partnerStatus = "married";
      partner.marriedYear = p.year;
      p.queuedEvents.push("wedding_day");
    }
  }
  if (e.endRelationship) endRelationship(p, e.endRelationship);
  if (e.addRelative) {
    // A new partner replaces nothing; guard against double partners.
    if (e.addRelative.relation !== "Partner" || !getPartner(p)) addRelative(p, e.addRelative, rng);
  }
  if (e.queueEvent) p.queuedEvents.push(e.queueEvent);
  if (e.salaryPct && p.currentJob) {
    p.currentJob.salary = Math.round(p.currentJob.salary * (1 + e.salaryPct / 100));
    p.annualSalary = p.currentJob.salary;
  }
  if (e.promote) promoteJob(p);
  if (e.loseJob && p.currentJob) {
    p.currentJob = null;
    p.annualSalary = 0;
  }
  if (e.stripRoyalty) stripRoyalty(p);
  e.apply?.(p, rng);
  if (e.arrest) startTrial(p, e.arrest);
  if (e.die) killPlayer(p, e.die);
}

function pickBranch(p: PlayerState, option: ChoiceOption, rng: Rng): { fx: ChoiceEffects; success: boolean } {
  if (!option.chance) return { fx: option.effects, success: true };
  const shift = option.chance.scaleBy ? (p[option.chance.scaleBy] - 50) / 250 : 0;
  const prob = clamp(option.chance.p + shift, 0.02, 0.98);
  const success = rng.chance(prob);
  return { fx: success ? option.effects : option.chance.failure, success };
}

/** Resolve a chosen option, producing a result notice with stat chips. */
export function resolveEvent(p0: PlayerState, event: LifeEvent, optionIndex: number, rng: Rng): ActionResult {
  const p = clone(p0);
  const option = event.options[optionIndex];
  if (!option) return { player: p0 };
  if (!canAfford(p, option)) {
    return { player: p0, notices: [{ kind: "info", title: "Can't afford that", body: `This costs ${money(optionCost(option))}.`, tone: "bad" }] };
  }
  const before = clone(p);
  const { fx, success } = pickBranch(p, option, rng);
  const text = fillTokens(fx.logText, p);
  addLog(p, `${event.title}: ${text}`);
  p.seenEvents[event.id] = p.age;
  applyEffects(p, fx, rng);
  const chips: Chip[] = summarizeDelta(before, p);
  const bad = !success || (fx.happinessDelta ?? 0) < -3 || !!fx.arrest || !!fx.die;
  const upside = chips.some((c) => c.delta > 0);
  return {
    player: p,
    notices: [
      {
        kind: "info",
        title: event.title,
        body: text,
        tone: bad ? "bad" : upside ? "good" : "neutral",
        chips,
      },
    ],
  };
}

