/**
 * The Agency: classified missions with cover, a handler you need to trust, counter-intelligence
 * suspicion, burn notices, the temptation of becoming a double agent, and consequences that follow
 * you home (a partner kept in the dark, foreign services that never forget).
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner, setFlag } from "./state";
import { applyForJob, promoteJob } from "./career";
import { killPlayer } from "./mortality";
import { startTrial, DEATH_PENALTY } from "./crime";
import { freshSpy } from "./justiceState";
import { COUNTRIES } from "@/data/countries";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const APPROACHES = [
  { id: "stealth", name: "Stealth Infiltration", blurb: "Lockpicks, shadows, and quiet footsteps.", stat: "Smarts" },
  { id: "social", name: "Social Engineering", blurb: "Charm your way past guards and into vaults.", stat: "Charisma & Looks" },
  { id: "force", name: "Direct Assault", blurb: "Subtlety is overrated.", stat: "Athletics & Health" },
] as const;

export const MISSIONS = [
  { id: "recon", name: "Surveillance", emoji: "🔭", reward: 1, hard: 0, cover: 4, minTier: 0, blurb: "Watch, listen, report. Low risk, modest pay." },
  { id: "extract", name: "Extraction", emoji: "🚁", reward: 1.6, hard: 0.08, cover: 10, minTier: 0, blurb: "Bring a source or a package out alive." },
  { id: "sabotage", name: "Sabotage", emoji: "🧨", reward: 2, hard: 0.12, cover: 14, minTier: 1, blurb: "Something must stop working. Loudly or quietly." },
  { id: "infiltrate", name: "Deep Infiltration", emoji: "🎭", reward: 2.6, hard: 0.18, cover: 18, minTier: 1, blurb: "Months undercover inside a hostile organisation." },
] as const;

export const inAgency = (p: PlayerState) => p.currentJob?.lineId === "spy";

export const missionBonus = (tier: number, reward: number) => Math.round(20_000 * (tier + 1) * reward);

export function missionChance(p: PlayerState, approach: string, kind: string = "recon"): number {
  const job = p.currentJob;
  const tier = job?.tier ?? 0;
  const m = MISSIONS.find((x) => x.id === kind) ?? MISSIONS[0];
  const stat =
    approach === "stealth" ? p.smarts
    : approach === "social" ? (p.skills.charisma + p.looks) / 2
    : (p.skills.athletics + p.health) / 2;
  const s = p.spy;
  const effort = p.effort === "grind" ? 0.04 : p.effort === "coast" ? -0.05 : 0;
  return clamp(0.15 + stat / 180 + tier * 0.04 + s.cover / 600 + s.handlerTrust / 700 - s.suspicion / 400 - m.hard + (p.annual["spy:prep"] ? 0.06 : 0) + effort, 0.1, 0.82);
}

/** Apply to the Agency; a fresh recruit starts with a clean cover and a new handler. */
export function joinAgency(p0: PlayerState, rng: Rng): ActionResult {
  const res = applyForJob(p0, "spy", rng);
  if (res.player !== p0 && res.player.currentJob?.lineId === "spy") {
    res.player.spy = { ...freshSpy(), missions: res.player.spy.missions, secrets: 0 };
    addLog(res.player, "You were assigned a handler and a cover identity. Trust them, but never tell anyone.");
  }
  return res;
}

/** Burn notice: the Agency disowns you, and your past may come looking. */
export function burnAgent(p: PlayerState, why: string, notices: Notices) {
  const s = p.spy;
  s.burned = true;
  s.burnedYear = p.year;
  s.hunted = 5;
  s.doubleAgent = false;
  p.currentJob = null;
  p.annualSalary = 0;
  setFlag(p, "burned_spy");
  changeStat(p, "happiness", -10);
  const partner = getPartner(p);
  if (partner && !s.partnerKnows) {
    partner.relationshipBar = Math.max(0, partner.relationshipBar - 20);
    why += ` ${partner.name} found out what you really did for a living, and learned it was all lies.`;
  }
  addLog(p, why);
  notices.push(info("Burn Notice", why, "bad"));
}

export function runMission(p0: PlayerState, approach: string, rng: Rng, kind: string = "recon"): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "spy") return { player: p0 };
  const mission = MISSIONS.find((m) => m.id === kind);
  if (!mission) return { player: p0 };
  if (mission.minTier > job.tier) return { player: p0, notices: [info("Not Cleared", `${mission.name} needs ${job.tier < 1 ? "Field Agent" : "a higher"} clearance.`, "bad")] };
  if ((p.annual.mission ?? 0) >= 1) return { player: p0, notices: [info("Debrief First", "Command only authorises one mission a year.")] };
  p.annual.mission = 1;
  const s = p.spy;
  s.missions += 1;
  s.cover = clamp(s.cover - mission.cover);
  if (rng.chance(missionChance(p, approach, kind))) {
    const bonus = missionBonus(job.tier, mission.reward);
    p.bankBalance += bonus;
    job.performance = clamp(job.performance + 10);
    s.handlerTrust = clamp(s.handlerTrust + 4);
    s.secrets += 1;
    changeStat(p, "happiness", 6);
    let body = `${mission.name}: accomplished. A grateful government wired you a ${money(bonus)} bonus. (You can't say what you did.)`;
    const notices: Notices = [info("Mission Success", body, "good")];
    if (job.performance >= 75 && s.missions >= 2 * (job.tier + 1) && s.suspicion < 40 && promoteJob(p)) {
      const promo = `Command promoted you to ${p.currentJob!.title}.`;
      body += ` ${promo}`;
      notices.push(info("Promoted", promo, "jackpot"));
    }
    addLog(p, body);
    return { player: p, notices };
  }
  job.performance = clamp(job.performance - 10);
  s.handlerTrust = clamp(s.handlerTrust - 6);
  const roll = rng.next();
  if (roll < 0.5) {
    const dmg = rng.int(10, 30);
    changeStat(p, "health", -dmg);
    const body = `${mission.name} went sideways. You escaped with injuries (Health −${dmg}).`;
    addLog(p, body);
    return { player: p, notices: [info("Mission Failed", body, "bad")] };
  }
  if (roll < 0.8) {
    s.cover = clamp(s.cover - 25);
    if (s.cover <= 10) {
      const notices: Notices = [];
      burnAgent(p, "Your cover was blown beyond repair. The Agency issued a burn notice and cleared your desk.", notices);
      return { player: p, notices };
    }
    const body = `${mission.name} compromised your cover (−25 cover). Command is watching you closely.`;
    addLog(p, body);
    return { player: p, notices: [info("Cover Compromised", body, "bad")] };
  }
  if (roll < 0.92) {
    const notices: Notices = [];
    burnAgent(p, "Your cover was blown. The Agency disavowed you and cleared your desk.", notices);
    return { player: p, notices };
  }
  p.currentJob = null;
  p.annualSalary = 0;
  startTrial(p, { name: "Espionage", description: "A foreign government captured you and put you on trial for spying.", years: 12, severity: "heinous", evidence: 90 });
  return { player: p, notices: [info("Captured!", "Foreign agents caught you in the act. You're being tried for espionage. Your handler may negotiate an exchange.", "bad")] };
}

// ---------------------------------------------------------------------------
// Tradecraft
// ---------------------------------------------------------------------------

export function prepareMission(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inAgency(p)) return { player: p0 };
  if (p.annual["spy:prep"]) return { player: p0, notices: [info("Briefed", "You've already studied the target this year.")] };
  if (p.bankBalance < 3_000) return { player: p0, notices: [info("Insufficient Funds", "Preparation (travel, kit, safe houses) costs 3,000 dollars.", "bad")] };
  p.bankBalance -= 3_000;
  p.annual["spy:prep"] = 1;
  const body = "You spent months on reconnaissance, kit and exit routes. Mission odds +6% this year.";
  addLog(p, body);
  return { player: p, notices: [info("Preparation", body, "good")] };
}

export function meetHandler(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inAgency(p)) return { player: p0 };
  if ((p.annual["spy:handler"] ?? 0) >= 1) return { player: p0, notices: [info("Dead Drop Only", "Another meeting this year would draw attention.")] };
  p.annual["spy:handler"] = 1;
  p.spy.handlerTrust = clamp(p.spy.handlerTrust + 12);
  const watched = rng.chance(0.12);
  if (watched) p.spy.cover = clamp(p.spy.cover - 3);
  const body = watched ? "You met your handler in a park. Someone may have noticed. Trust +12, cover −3." : "You met your handler in a quiet cafe. They shared a few useful rumours. Trust +12.";
  addLog(p, body);
  return { player: p, notices: [info("Handler Meet", body, "good")] };
}

export function maintainCover(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inAgency(p)) return { player: p0 };
  if ((p.annual["spy:cover"] ?? 0) >= 1) return { player: p0, notices: [info("Already Polished", "Your cover story is as solid as it'll get this year.")] };
  if (p.bankBalance < 5_000) return { player: p0, notices: [info("Insufficient Funds", "Maintaining a cover identity costs 5,000 dollars.", "bad")] };
  p.bankBalance -= 5_000;
  p.annual["spy:cover"] = 1;
  p.spy.cover = clamp(p.spy.cover + 20);
  const body = "You refreshed your paper trail: a plausible employer, a social media history, a neighbour who vouches for you. Cover +20.";
  addLog(p, body);
  return { player: p, notices: [info("Cover Maintenance", body, "good")] };
}

export function layLow(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inAgency(p)) return { player: p0 };
  if ((p.annual["spy:low"] ?? 0) >= 1) return { player: p0, notices: [info("Already Quiet", "You're as quiet as you can be.")] };
  p.annual["spy:low"] = 1;
  p.spy.suspicion = clamp(p.spy.suspicion - 20);
  changeStat(p, "happiness", 1);
  const body = "You took a quiet year of desk work and good behaviour. Suspicion −20.";
  addLog(p, body);
  return { player: p, notices: [info("Laying Low", body, "neutral")] };
}

export function confideInPartner(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const partner = getPartner(p);
  if (!inAgency(p) || !partner) return { player: p0, notices: [info("Nobody to Tell", "You need a partner, and a job to tell them about.")] };
  if (p.spy.partnerKnows) return { player: p0, notices: [info("They Know", `${partner.name} already knows.`)] };
  p.spy.partnerKnows = true;
  partner.relationshipBar = Math.min(100, partner.relationshipBar + 15);
  p.spy.cover = clamp(p.spy.cover - 15);
  let body = `You told ${partner.name} the truth. They were shaken, then relieved. Relationship +15, cover −15.`;
  if (rng.chance(0.2)) {
    p.spy.cover = clamp(p.spy.cover - 20);
    body += " But they confided in a close friend, and the secret is out among people it shouldn't be.";
  }
  addLog(p, body);
  return { player: p, notices: [info("Telling the Truth", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Betrayal
// ---------------------------------------------------------------------------

export function secretsValue(p: PlayerState): number {
  return p.spy.secrets * 30_000 * (1 + (p.currentJob?.tier ?? 0) * 0.5);
}

/** Sell what you know to a foreign service. Lucrative, treasonous, and the start of a clock. */
export function sellSecrets(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inAgency(p)) return { player: p0 };
  if (p.spy.secrets < 1) return { player: p0, notices: [info("Nothing to Sell", "You haven't learned anything worth stealing yet. Complete missions first.", "bad")] };
  if ((p.annual["spy:sell"] ?? 0) >= 1) return { player: p0, notices: [info("Too Risky", "A second handoff this year would be reckless.", "bad")] };
  p.annual["spy:sell"] = 1;
  const pay = Math.round(secretsValue(p));
  p.bankBalance += pay;
  p.justice.proceeds += Math.round(pay * 0.3);
  p.spy.secrets = 0;
  p.spy.doubleAgent = true;
  p.spy.foreignTrust = clamp(p.spy.foreignTrust + 20);
  p.spy.suspicion = clamp(p.spy.suspicion + 20);
  changeStat(p, "karma", -15);
  const body = `You passed classified material to a foreign contact and were paid ${money(pay)}. You are a double agent now, and counter-intelligence is hunting for a mole.`;
  addLog(p, body);
  return { player: p, notices: [info("Double Agent", body, "bad")] };
}

/** Confess to your handler. Mercy is possible, but not guaranteed. */
export function confess(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inAgency(p) || !p.spy.doubleAgent) return { player: p0 };
  const roll = rng.next();
  p.spy.doubleAgent = false;
  p.spy.suspicion = 0;
  p.spy.foreignTrust = 0;
  p.spy.handlerTrust = clamp(p.spy.handlerTrust - 30);
  if (roll < 0.5) {
    changeStat(p, "karma", 5);
    const body = "You confessed. The Agency decided you were more useful as a controlled channel to the other side. You keep your job, on a very short leash.";
    addLog(p, body);
    return { player: p, notices: [info("Forgiven", body, "good")] };
  }
  if (roll < 0.8) {
    const notices: Notices = [];
    burnAgent(p, "You confessed. The Agency thanked you, fired you, and issued a burn notice.", notices);
    return { player: p, notices };
  }
  p.currentJob = null;
  p.annualSalary = 0;
  startTrial(p, { name: "Unauthorised Disclosure", description: "You gave classified material to a foreign contact. Your confession was admitted as evidence.", years: 8, severity: "heinous", evidence: 85 });
  return { player: p, notices: [info("Prosecuted", "Your confession was accepted, and so was the prosecution's case.", "bad")] };
}

/** Run for it with the foreign service's help. */
export function defect(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inAgency(p) || !p.spy.doubleAgent) return { player: p0 };
  const notices: Notices = [];
  const dest = rng.pick(COUNTRIES.filter((c) => c.name !== p.residence.country));
  p.bankBalance += 250_000;
  p.spy.burned = true;
  p.spy.burnedYear = p.year;
  p.currentJob = null;
  p.annualSalary = 0;
  p.isFugitive = true;
  setFlag(p, "fugitive");
  setFlag(p, "burned_spy");
  p.residence = { ...p.residence, country: dest.name, city: rng.pick(dest.cities) };
  changeStat(p, "karma", -20);
  changeStat(p, "happiness", -8);
  p.justice.heat = 70;
  const body = `You defected to ${dest.name} with a ${money(250_000)} resettlement payment. Your old government has an arrest warrant waiting.`;
  addLog(p, body);
  notices.push(info("Defected", body, "neutral"));
  return { player: p, notices };
}

// ---------------------------------------------------------------------------
// Yearly
// ---------------------------------------------------------------------------

export function processSpy(p: PlayerState, rng: Rng, notices: Notices) {
  const s = p.spy;
  // Prisoner exchange: a good handler gets you home from a foreign cell.
  if (p.isInPrison && p.prison?.charge === "Espionage" && s.handlerTrust >= 40 && rng.chance(0.12)) {
    p.isInPrison = false;
    p.prison = null;
    p.flags = p.flags.filter((f) => f !== "ex_con");
    s.burned = true;
    s.burnedYear = p.year;
    setFlag(p, "burned_spy");
    changeStat(p, "happiness", 12);
    const body = "At dawn you were walked across a bridge in a prisoner exchange. You're free, and finished as an agent.";
    addLog(p, body);
    notices.push(info("Exchanged", body, "good"));
    return;
  }
  // Foreign services don't forget a burned agent.
  if (!inAgency(p) && s.burned && s.hunted > 0 && !p.isInPrison) {
    s.hunted -= 1;
    if (rng.chance(0.1)) {
      const dmg = rng.int(15, 35);
      changeStat(p, "health", -dmg);
      const body = `Foreign agents tried to settle old scores. You survived the attack (Health −${dmg}).`;
      addLog(p, body);
      notices.push(info("Old Enemies", body, "bad"));
      if (rng.chance(0.05)) killPlayer(p, "an assassination");
    }
    return;
  }
  if (!inAgency(p) || p.isInPrison) return;

  s.cover = clamp(s.cover - (p.fame >= 40 ? 6 : 3));
  s.handlerTrust = clamp(s.handlerTrust + Math.sign(50 - s.handlerTrust) * Math.min(3, Math.abs(50 - s.handlerTrust)));
  s.suspicion = clamp(s.suspicion + (s.doubleAgent ? 12 : -5));
  if (s.doubleAgent) {
    p.bankBalance += 60_000;
    p.justice.proceeds += 20_000;
    s.foreignTrust = clamp(s.foreignTrust + 5);
    changeStat(p, "karma", -3);
  }
  const partner = getPartner(p);
  if (partner && !s.partnerKnows) {
    partner.relationshipBar = Math.max(0, partner.relationshipBar - 3);
    if (rng.chance(0.08)) {
      partner.relationshipBar = Math.max(0, partner.relationshipBar - 15);
      const body = `${partner.name} caught you in a lie about where you were. The secrecy is wearing the relationship down.`;
      addLog(p, body);
      notices.push(info("Home Front", body, "bad"));
    }
  }

  // Counter-intelligence hunts for moles.
  if (s.suspicion > 50 && rng.chance((s.suspicion - 40) / 200)) {
    if (s.doubleAgent) {
      s.doubleAgent = false;
      p.currentJob = null;
      p.annualSalary = 0;
      s.burned = true;
      s.burnedYear = p.year;
      setFlag(p, "burned_spy");
      startTrial(p, {
        name: "Treason",
        description: "Counter-intelligence traced the leaks to you. The money trail was thorough.",
        years: 25,
        severity: "heinous",
        capital: DEATH_PENALTY.has(p.residence.country),
        evidence: 88,
      });
      notices.push(info("Mole Caught", "Counter-intelligence found the leak. It was you.", "bad"));
      return;
    }
    s.suspicion = clamp(s.suspicion - 30);
    s.handlerTrust = clamp(s.handlerTrust - 5);
    const body = "Internal affairs investigated you as a possible mole. They found nothing, but the interview was humiliating.";
    addLog(p, body);
    notices.push(info("Mole Hunt", body, "neutral"));
  }
  // A thin cover eventually fails by itself.
  if (s.cover < 20 && rng.chance(0.35)) {
    burnAgent(p, "Your cover wore through and a hostile service identified you. The Agency issued a burn notice.", notices);
  }
}
