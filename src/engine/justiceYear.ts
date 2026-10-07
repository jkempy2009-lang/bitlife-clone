/** Yearly justice processing: life inside, supervision, heat, snitches, cold cases and fugitives. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { addLog, changeStat } from "./state";
import { hydratePrison } from "./justiceState";
import { addHeat, policingOf, sealJuvenileRecord } from "./justice";
import { processPrisonYear } from "./prison";
import { startTrial } from "./crime";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

function sendBack(p: PlayerState, charge: string, years: number, notices: Notices, why: string) {
  p.probation = null;
  p.isInPrison = true;
  p.prison = hydratePrison({ charge, sentenceYears: Math.max(1, years), yearsServed: 0, conduct: 60 });
  p.currentJob = null;
  p.annualSalary = 0;
  changeStat(p, "happiness", -12);
  addLog(p, why);
  notices.push(info("Back Inside", why, "bad"));
}

function processSupervision(p: PlayerState, rng: Rng, notices: Notices) {
  const sup = p.probation;
  if (!sup) return;
  const working = !!p.currentJob || !!p.business || p.age < 18 || p.age >= 65;
  const risk = (sup.parole ? 0.07 : 0.04) + (working ? 0 : 0.1) + (p.vices.drugs >= 30 ? 0.12 : 0) + (p.justice.gangTies ? 0.05 : 0);
  if (rng.chance(risk)) {
    sup.strikes = (sup.strikes ?? 0) + 1;
    const reason = !working ? "being unemployed" : p.vices.drugs >= 30 ? "a failed drug test" : p.justice.gangTies ? "associating with known gang members" : "missing a check-in";
    if (sup.strikes >= 2) {
      sendBack(
        p,
        sup.parole ? `${sup.charge} (parole revoked)` : sup.charge,
        sup.parole ? sup.yearsLeft : Math.min(2, sup.yearsLeft),
        notices,
        `Your ${sup.parole ? "parole" : "probation"} was revoked after a second violation (${reason}). You're going back to prison.`,
      );
      return;
    }
    changeStat(p, "happiness", -3);
    const body = `Your ${sup.parole ? "parole" : "probation"} officer wrote you up for ${reason}. One more violation and you're back inside.`;
    addLog(p, body);
    notices.push(info("Violation Warning", body, "bad"));
  }
  sup.yearsLeft -= 1;
  if (sup.yearsLeft <= 0) {
    const body = `You completed your ${sup.parole ? "parole" : "probation"} for ${sup.charge}. No more check-ins or conditions.`;
    p.probation = null;
    addLog(p, body);
    notices.push(info(sup.parole ? "Parole Complete" : "Probation Over", body, "good"));
  }
}

export function processJustice(p: PlayerState, rng: Rng, notices: Notices) {
  const j = p.justice;
  if (p.isInPrison && p.prison) {
    processPrisonYear(p, rng, notices);
    return;
  }

  if (p.age === 18) {
    const line = sealJuvenileRecord(p, rng);
    if (line) {
      addLog(p, line);
      notices.push(info("Your Juvenile Record", line, line.includes("NOT") ? "bad" : "good"));
    }
  }

  // The police lose interest over time, unless you're a recent ex-con.
  addHeat(p, -12);
  if (j.reentry > 0) {
    p.justice.heat = Math.max(p.justice.heat, 15);
    j.reentry -= 1;
  }

  if (p.flags.includes("under_investigation") && !p.pendingTrial) {
    const risk = clamp((0.08 + p.stats.kills * 0.04 - (p.smarts - 50) / 400) * policingOf(p) + j.heat / 600, 0.03, 0.4);
    const coldKey = p.flags.find((f) => f.startsWith("cold:"));
    const years = coldKey ? Number(coldKey.slice(5)) : 0;
    if (rng.chance(risk)) {
      p.flags = p.flags.filter((f) => f !== "under_investigation" && !f.startsWith("cold:"));
      p.karma = 0;
      startTrial(p, { name: "Murder", description: "A detective finally connected the dots. DNA, cameras, and a patient investigator did the rest.", years: 32, severity: "heinous", capital: true });
      notices.push(info("The Detective Was Patient", "Years later, the police arrived with a warrant. You're being charged with murder.", "bad"));
      return;
    } else if (years + 1 >= 8) {
      p.flags = p.flags.filter((f) => f !== "under_investigation" && !f.startsWith("cold:"));
      const body = "The investigation into the death went cold. You're probably safe now.";
      addLog(p, body);
      notices.push(info("Cold Case", body, "neutral"));
    } else {
      p.flags = p.flags.filter((f) => !f.startsWith("cold:"));
      p.flags.push(`cold:${years + 1}`);
      changeStat(p, "happiness", -2);
    }
  }

  // Loose lips: accomplices get arrested and talk.
  if (j.accomplices > 0 && !p.pendingTrial) {
    if (rng.chance(Math.min(0.3, 0.035 * j.accomplices * (1 + j.heat / 100)))) {
      j.accomplices -= 1;
      startTrial(p, {
        name: "Conspiracy",
        description: "A former accomplice was arrested and traded your name for a lighter sentence.",
        years: 4,
        severity: "serious",
        evidence: 80,
      });
      notices.push(info("Someone Talked", "An old accomplice gave the police your name. Detectives are at the door.", "bad"));
      return;
    }
    if (rng.chance(0.12)) j.accomplices -= 1;
  }

  processSupervision(p, rng, notices);

  if (p.isFugitive) {
    changeStat(p, "happiness", -2);
    if (rng.chance(clamp(0.15 * policingOf(p) + j.heat / 500, 0.05, 0.4))) {
      p.isFugitive = false;
      p.flags = p.flags.filter((f) => f !== "fugitive");
      p.isInPrison = true;
      if (p.prison) p.prison.sentenceYears += 2;
      else p.prison = { charge: "Escape from Custody", sentenceYears: 4, yearsServed: 0 };
      p.prison = hydratePrison(p.prison);
      p.currentJob = null;
      const body = "The police tracked you down and dragged you back to prison. Two more years were added to your sentence.";
      addLog(p, body);
      notices.push(info("Recaptured", body, "bad"));
    }
  }
}
