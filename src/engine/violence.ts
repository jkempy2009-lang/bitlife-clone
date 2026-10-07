/**
 * Violent and "personal" crimes: murder, assault, blackmail, arson, kidnapping.
 * Strictly adult-only content: minors (and the player's children) can never be targets.
 * Text is non-graphic. Gated behind the player's mature-content setting.
 */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { startTrial } from "./crime";
import { addHeat, adjustCatch, policingOf } from "./justice";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export interface Target {
  id: string;
  label: string;
  kind: "relative" | "stranger" | "boss";
}

export const HITMAN_COST = 25_000;

export function targetsFor(p: PlayerState): Target[] {
  const out: Target[] = p.relatives
    .filter((r) => r.alive && r.age >= 18 && r.partnerStatus !== "ex" && !["Pet", "Child", "Grandchild"].includes(r.relation))
    .map((r) => ({ id: r.id, label: `${r.name} (${r.relation === "Lover" ? "lover" : r.relation.toLowerCase()})`, kind: "relative" as const }));
  out.push({ id: "stranger", label: "A stranger", kind: "stranger" });
  if (p.currentJob) out.push({ id: "boss", label: `Your boss at ${p.currentJob.company}`, kind: "boss" });
  return out;
}

function gate(p: PlayerState): ActionResult | null {
  if (!p.matureContent) return { player: p, notices: [info("Mature Content Off", "Turn on mature content in Settings to access violent options.")] };
  if (p.age < 18) return { player: p, notices: [info("Not for You", "Those options are only for adults.")] };
  if (p.isInPrison) return { player: p, notices: [info("Behind Bars", "Not from in here.")] };
  if (p.pendingTrial) return { player: p, notices: [info("On Trial", "You have bigger problems right now.")] };
  return null;
}

function resolveTarget(p: PlayerState, id: string): { rel?: Relative; label: string; kind: Target["kind"] } | null {
  const t = targetsFor(p).find((x) => x.id === id);
  if (!t) return null;
  const rel = t.kind === "relative" ? p.relatives.find((r) => r.id === id) : undefined;
  return { rel, label: rel ? rel.name : t.label, kind: t.kind };
}

// ---------------------------------------------------------------------------
// Murder
// ---------------------------------------------------------------------------

export const METHODS = [
  { id: "poison", name: "Poison", blurb: "Quiet and clinical. Smarts help.", kill: 0.85, hide: 0.6 },
  { id: "stab", name: "Knife", blurb: "Personal and messy, with lots of evidence.", kill: 0.9, hide: 0.35 },
  { id: "shoot", name: "Firearm", blurb: "Loud. Fast. Hard to explain.", kill: 0.92, hide: 0.4 },
  { id: "accident", name: "Staged Accident", blurb: "Cause 'an accident'. Clever, but unreliable.", kill: 0.8, hide: 0.55 },
  { id: "hitman", name: "Hire a Hitman ($25,000)", blurb: "Distance yourself from the deed.", kill: 0.95, hide: 0.65 },
] as const;

export function coverChance(p: PlayerState, methodId: string, kind: Target["kind"], rel?: Relative): number {
  const m = METHODS.find((x) => x.id === methodId);
  if (!m) return 0;
  let chance = m.hide + (p.smarts - 50) / 200 - p.stats.kills * 0.04 - p.justice.heat / 300 - (policingOf(p) - 1) * 0.2;
  if (kind === "stranger") chance += 0.1;
  if (rel?.relation === "Partner") chance -= 0.18;
  else if (rel) chance -= 0.12;
  return clamp(chance, 0.05, 0.9);
}

export function commitMurder(p0: PlayerState, targetId: string, methodId: string, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const target = resolveTarget(p, targetId);
  const method = METHODS.find((m) => m.id === methodId);
  if (!target || !method) return { player: p0 };
  if ((p.annual.murder ?? 0) >= 1) return { player: p0, notices: [info("Lie Low", "You can't do that again so soon. Too much heat.")] };
  if (method.id === "hitman" && p.bankBalance < HITMAN_COST) {
    return { player: p0, notices: [info("Insufficient Funds", `A professional charges ${money(HITMAN_COST)}.`, "bad")] };
  }
  p.annual.murder = 1;
  if (method.id === "hitman") p.bankBalance -= HITMAN_COST;
  const rel = target.rel;
  const notices: Notices = [];

  // Did the attempt actually kill them?
  if (!rng.chance(method.kill)) {
    changeStat(p, "karma", -30);
    if (rel) rel.relationshipBar = 0;
    if (rng.chance(0.7)) {
      startTrial(p, { name: "Attempted Murder", description: "Your victim survived and identified you to the police.", years: 14, severity: "heinous" });
      return { player: p, notices: [info("It Went Wrong", `${target.label} survived. And they know it was you.`, "bad")] };
    }
    addLog(p, `You tried to kill ${target.label} and failed. Nobody has pressed charges... yet.`);
    return { player: p, notices: [info("Botched", `${target.label} survived and, for now, hasn't gone to the police.`, "bad")] };
  }

  // The deed is done.
  addHeat(p, 25);
  p.stats.kills += 1;
  if (!p.flags.includes("killer")) p.flags.push("killer");
  if (rel) {
    rel.alive = false;
    rel.deathAge = rel.age;
    rel.deathYear = p.year;
    const estate = rel.incomeTier * rel.incomeTier * 20_000;
    if (rel.relation === "Parent" || rel.relation === "Partner") {
      if (rng.chance(0.1 + 0.12 * rel.incomeTier)) {
        const share = Math.round(estate * rng.float(0.5, 1));
        p.bankBalance += share;
        addLog(p, `You inherited ${money(share)} from ${rel.name}. (Convenient.)`);
      }
    }
  } else if (target.kind === "boss") {
    changeStat(p, "happiness", 2);
  }
  const caughtRoll = !rng.chance(coverChance(p, method.id, target.kind, rel));
  const guilt = p.stats.kills >= 3 ? rng.int(0, 3) : rng.int(8, 16);
  changeStat(p, "happiness", -guilt);
  p.karma = Math.max(0, p.karma - 40);
  if (caughtRoll) {
    const hit = method.id === "hitman";
    startTrial(p, {
      name: hit ? "Conspiracy to Commit Murder" : "Murder",
      description: hit
        ? "Your hitman was arrested and gave you up to cut a deal."
        : `Police linked you to the death of ${target.label} through forensic evidence.`,
      years: hit ? 22 : rel ? 35 : 30,
      severity: "heinous",
      capital: !hit,
    });
    const body = `${target.label} is dead, but the evidence points straight at you.`;
    addLog(p, body);
    return { player: p, notices: [info("Caught!", body, "bad"), ...notices] };
  }
  p.flags.push("under_investigation");
  const body = `${target.label} is dead. Nobody saw anything, and the police have no suspects (yet). You can't stop thinking about it.`;
  addLog(p, `You killed ${target.label} and got away with it. (For now.)`);
  return { player: p, notices: [info("Dead. Undetected.", body, "bad"), ...notices] };
}

// ---------------------------------------------------------------------------
// Assault, blackmail, arson, kidnapping
// ---------------------------------------------------------------------------

export function assault(p0: PlayerState, targetId: string, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const target = resolveTarget(p, targetId);
  if (!target) return { player: p0 };
  if ((p.annual.assault ?? 0) >= 2) return { player: p0, notices: [info("Cool Off", "You've been in enough fights this year.")] };
  p.annual.assault = (p.annual.assault ?? 0) + 1;
  addHeat(p, 8);
  changeStat(p, "karma", -10);
  const notices: Notices = [];
  const win = rng.chance(clamp(0.4 + (p.health - 50) / 200 + p.skills.athletics / 300, 0.15, 0.85));
  let body: string;
  if (win) {
    if (target.rel) target.rel.relationshipBar = clamp(target.rel.relationshipBar - 45);
    changeStat(p, "happiness", 2);
    body = `You beat ${target.label} badly. They won't forget it.`;
  } else {
    const dmg = rng.int(8, 25);
    changeStat(p, "health", -dmg);
    changeStat(p, "happiness", -5);
    if (target.rel) target.rel.relationshipBar = clamp(target.rel.relationshipBar - 30);
    body = `${target.label} fought back and you took a beating (Health −${dmg}).`;
  }
  addLog(p, body);
  if (rng.chance(adjustCatch(p, 0.4))) {
    startTrial(p, { name: "Assault", description: "Witnesses called the police and gave your description.", years: 3, severity: "serious" });
    notices.push(info("Arrested", "Someone saw the whole thing.", "bad"));
  }
  return { player: p, notices: [info(win ? "You Won the Fight" : "You Lost the Fight", body, win ? "neutral" : "bad"), ...notices] };
}

export function blackmail(p0: PlayerState, targetId: string, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const target = resolveTarget(p, targetId);
  if (!target || target.kind === "stranger") return { player: p0, notices: [info("Need Leverage", "You need to know someone to blackmail them.")] };
  if ((p.annual.blackmail ?? 0) >= 1) return { player: p0, notices: [info("Lie Low", "You've already squeezed someone this year.")] };
  p.annual.blackmail = 1;
  changeStat(p, "karma", -10);
  const tier = target.rel?.incomeTier ?? 3;
  if (rng.chance(clamp(0.45 + p.smarts / 300, 0.2, 0.85))) {
    const reward = Math.round(3_000 * Math.pow(tier, 1.6) * rng.float(0.8, 1.4));
    p.bankBalance += reward;
    if (target.rel) target.rel.relationshipBar = clamp(target.rel.relationshipBar - 50);
    const body = `${target.label} paid ${money(reward)} to keep a secret quiet.`;
    addLog(p, body);
    return { player: p, notices: [info("Pay Up", body, "good")] };
  }
  if (target.rel) target.rel.relationshipBar = clamp(target.rel.relationshipBar - 60);
  const notices: Notices = [];
  if (rng.chance(adjustCatch(p, 0.35))) {
    startTrial(p, { name: "Extortion", description: `${target.label} went to the police with your messages.`, years: 4, severity: "serious" });
    notices.push(info("Reported", "They took your threats to the police.", "bad"));
  }
  const body = `${target.label} called your bluff and told you exactly where to go.`;
  addLog(p, body);
  return { player: p, notices: [info("Backfired", body, "bad"), ...notices] };
}

export function arson(p0: PlayerState, mode: "own" | "rival", rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  if ((p.annual.arson ?? 0) >= 1) return { player: p0, notices: [info("Lie Low", "Investigators are still sniffing around the last one.")] };
  if (mode === "own") {
    const prop = p.properties[0];
    if (!prop) return { player: p0, notices: [info("Nothing to Burn", "You don't own a property.")] };
    p.annual.arson = 1;
    changeStat(p, "karma", -15);
    p.properties = p.properties.filter((h) => h.id !== prop.id);
    if (rng.chance(1 - adjustCatch(p, 1 - clamp(0.55 + p.smarts / 300, 0.2, 0.85)))) {
      const payout = Math.round(prop.currentValue * 0.8) - prop.mortgageBalance;
      p.bankBalance += payout;
      const body = `Your ${prop.name} went up in flames and the insurer paid out ${money(Math.max(0, payout))} after settling the mortgage.`;
      addLog(p, body);
      return { player: p, notices: [info("Torched", body, "bad")] };
    }
    startTrial(p, { name: "Arson & Insurance Fraud", description: "Fire investigators found accelerant all over your 'accident'.", years: 8, severity: "serious" });
    addLog(p, `You burned down your ${prop.name} for the insurance. It didn't work.`);
    return { player: p, notices: [info("Investigators Knew", "The fire marshal didn't buy it.", "bad")] };
  }
  p.annual.arson = 1;
  changeStat(p, "karma", -20);
  if (rng.chance(0.03)) changeStat(p, "health", -20);
  if (rng.chance(1 - adjustCatch(p, 0.35))) {
    changeStat(p, "happiness", 3);
    const body = "You torched a rival's business in the dead of night. Nobody was inside, and nobody saw you.";
    addLog(p, body);
    return { player: p, notices: [info("Up in Smoke", body, "bad")] };
  }
  startTrial(p, { name: "Arson", description: "A camera across the street caught you leaving the scene.", years: 6, severity: "serious" });
  return { player: p, notices: [info("Caught on Camera", "A security camera caught you running from the fire.", "bad")] };
}

export function kidnap(p0: PlayerState, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  if ((p.annual.kidnap ?? 0) >= 1) return { player: p0, notices: [info("Lie Low", "Too much heat for another.")] };
  p.annual.kidnap = 1;
  addHeat(p, 25);
  changeStat(p, "karma", -25);
  if (rng.chance(1 - adjustCatch(p, 1 - clamp(0.2 + p.smarts / 300, 0.1, 0.55)))) {
    const ransom = rng.int(100_000, 1_000_000);
    p.bankBalance += ransom;
    const body = `You abducted a wealthy executive and collected a ${money(ransom)} ransom. The hostage was released unharmed.`;
    addLog(p, body);
    return { player: p, notices: [info("Ransom Paid", body, "bad")] };
  }
  startTrial(p, { name: "Kidnapping", description: "The FBI traced the ransom call to your phone.", years: 20, severity: "heinous" });
  return { player: p, notices: [info("Traced!", "Federal agents traced the ransom call to you.", "bad")] };
}
