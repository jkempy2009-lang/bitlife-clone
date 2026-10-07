import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { NewRelativeSpec, LifeEvent } from "@/data/lifeEventsEngine";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { getCountry } from "@/data/countries";
import {
  addLog,
  changeStat,
  clone,
  getPartner,
  livingRelatives,
  makeRelativeBase,
  netWorth,
  partnerGenderFor,
  randomGender,
  randomName,
} from "./state";

export function firstName(r: Relative) {
  return r.name.split(" ")[0];
}

export function createRelative(p: PlayerState, spec: NewRelativeSpec, rng: Rng): Relative {
  if (spec.prebuilt) return { ...spec.prebuilt, id: rng.id() };
  const country = getCountry(p.birthCountry);
  const tier = Math.min(5, Math.max(1, Math.round(1 + netWorth(p) / 400_000)));
  if (spec.relation === "Child") {
    const gender = randomGender(rng);
    const partner = getPartner(p);
    const first = randomName(p.birthCountry, gender, rng).first;
    const kid = makeRelativeBase(rng, "Child", `${first} ${p.lastName}`, 0, gender, tier, rng.int(70, 100));
    kid.smarts = clamp(Math.round((p.smarts + (partner?.smarts ?? 50)) / 2 + rng.int(-15, 15)));
    kid.looks = clamp(Math.round((p.looks + (partner?.looks ?? 50)) / 2 + rng.int(-15, 15)));
    kid.health = rng.int(80, 100);
    return kid;
  }
  if (spec.relation === "Partner") {
    const gender = partnerGenderFor(p, rng);
    const [lo, hi] = spec.ageOffset ?? [-4, 5];
    const age = Math.max(14, p.age + rng.int(lo, hi));
    const first = randomName(p.birthCountry, gender, rng).first;
    const rel = makeRelativeBase(rng, "Partner", `${first} ${rng.pick(country.lastNames)}`, age, gender, rng.int(1, 5), rng.int(55, 85));
    rel.partnerStatus = spec.partnerStatus ?? "dating";
    return rel;
  }
  const gender = rng.pick(["Male", "Female"]);
  const [lo, hi] = spec.ageOffset ?? [-2, 3];
  const first = randomName(p.birthCountry, gender, rng).first;
  const last = spec.relation === "Sibling" ? p.lastName : rng.pick(country.lastNames);
  return makeRelativeBase(rng, spec.relation, `${first} ${last}`, Math.max(3, p.age + rng.int(lo, hi)), gender, rng.int(1, 4), rng.int(45, 80));
}

export function addRelative(p: PlayerState, spec: NewRelativeSpec, rng: Rng): Relative {
  const rel = createRelative(p, spec, rng);
  p.relatives.push(rel);
  if (rel.relation === "Child") {
    p.stats.childrenBorn += 1;
    addLog(p, `A child, ${rel.name}, was born into your family.`);
  } else if (rel.relation === "Partner") {
    addLog(p, `You are now ${rel.partnerStatus === "married" ? "married to" : "dating"} ${rel.name}.`);
  } else if (rel.relation === "Friend") {
    addLog(p, `You made a new friend: ${rel.name}.`);
  }
  return rel;
}

export function endRelationship(p: PlayerState, how: "breakup" | "divorce") {
  const partner = getPartner(p);
  if (!partner) return;
  partner.partnerStatus = "ex";
  if (how === "divorce" && p.bankBalance > 0) {
    const lost = Math.round(p.bankBalance * 0.3);
    p.bankBalance -= lost;
    addLog(p, `Your divorce from ${partner.name} cost you ${money(lost)}.`);
  }
}

// ---------------------------------------------------------------------------
// Interactions (spec: Spend Time / Converse / Compliment / Insult / Ask for Money)
// ---------------------------------------------------------------------------

const SPEND: Record<string, string[]> = {
  Parent: ["You took {n} to a baseball game.", "You cooked dinner with {n} and talked for hours.", "You went on a long walk with {n}.", "You and {n} binge-watched a TV series."],
  Sibling: ["You and {n} played video games all afternoon.", "You and {n} had a pillow fight like old times.", "You and {n} went to the movies."],
  Child: ["You built a fort with {n}.", "You took {n} to the playground.", "You helped {n} with their homework."],
  Partner: ["You had a candlelit dinner with {n}.", "You and {n} took a weekend getaway.", "You and {n} cuddled on the couch and watched movies."],
  Friend: ["You and {n} grabbed pizza and talked all night.", "You and {n} went to a concert.", "You and {n} went hiking."],
};
const CONVERSE: Record<string, string[]> = {
  Parent: ["You and {n} talked about your future.", "{n} gave you some unsolicited life advice.", "You and {n} chatted about politics."],
  Sibling: ["You and {n} reminisced about childhood.", "You and {n} gossiped about the family."],
  Child: ["You asked {n} about their day.", "{n} told you about their dreams."],
  Partner: ["You and {n} discussed your plans for the future.", "You and {n} talked about where to travel next."],
  Friend: ["You and {n} talked about life.", "You and {n} argued about sports."],
};
const COMPLIMENT = ["You told {n} they're wonderful. They beamed.", "You complimented {n}'s sense of humour.", "You told {n} how much they mean to you."];
const INSULT = ["You called {n} a name. They stormed off.", "You and {n} had a vicious argument.", "You mocked {n}'s taste. They were deeply hurt."];

const CAP_KEY = (id: string) => `rel:${id}`;
export const INTERACTION_CAP = 4;

export type SocialAction = "spend" | "converse" | "compliment" | "insult" | "askMoney";

export function interact(p0: PlayerState, relId: string, action: SocialAction, rng: Rng): ActionResult {
  const p = clone(p0);
  const rel = p.relatives.find((r) => r.id === relId);
  if (!rel || !rel.alive) return { player: p0 };
  const n = firstName(rel);
  const fill = (s: string) => s.replace("{n}", n);
  const used = p.annual[CAP_KEY(rel.id)] ?? 0;
  const tone: "good" | "bad" | "neutral" = "neutral";
  let title = `${n}`;
  let body = "";
  let outcome: "good" | "bad" | "neutral" = tone;

  if (action !== "insult" && action !== "askMoney" && used >= INTERACTION_CAP) {
    return {
      player: p0,
      notices: [{ kind: "info", title, body: `You've spent plenty of time with ${n} this year. Give it a rest until you age up.`, tone: "neutral" }],
    };
  }

  switch (action) {
    case "spend": {
      const gain = rng.int(5, 15);
      rel.relationshipBar = clamp(rel.relationshipBar + gain);
      body = fill(rng.pick(SPEND[rel.relation] ?? SPEND.Friend));
      changeStat(p, "happiness", rng.int(1, 3));
      p.annual[CAP_KEY(rel.id)] = used + 1;
      outcome = "good";
      break;
    }
    case "converse": {
      const good = rng.chance(0.7);
      const d = rng.int(2, 6);
      rel.relationshipBar = clamp(rel.relationshipBar + (good ? d : -d));
      body = fill(rng.pick(CONVERSE[rel.relation] ?? CONVERSE.Friend)) + (good ? " It went well." : " It got awkward.");
      p.annual[CAP_KEY(rel.id)] = used + 1;
      outcome = good ? "good" : "bad";
      break;
    }
    case "compliment": {
      if (rel.relationshipBar >= 100) {
        body = `${n} is already as close to you as can be, but they appreciate the kind words.`;
        outcome = "good";
      } else {
        rel.relationshipBar = clamp(rel.relationshipBar + rng.int(3, 8));
        body = fill(rng.pick(COMPLIMENT));
        outcome = "good";
      }
      p.annual[CAP_KEY(rel.id)] = used + 1;
      break;
    }
    case "insult": {
      rel.relationshipBar = clamp(rel.relationshipBar - 20);
      changeStat(p, "happiness", -5);
      changeStat(p, "karma", -2);
      body = fill(rng.pick(INSULT));
      outcome = "bad";
      break;
    }
    case "askMoney": {
      if (rel.relation !== "Parent" || p.age >= 22) {
        return { player: p0, notices: [{ kind: "info", title, body: "You can only ask your parents for money before you turn 22.", tone: "neutral" }] };
      }
      if ((p.annual[`ask:${rel.id}`] ?? 0) >= 1) {
        return { player: p0, notices: [{ kind: "info", title, body: `${n} already gave you what they could this year.`, tone: "neutral" }] };
      }
      p.annual[`ask:${rel.id}`] = 1;
      const prob = clamp(0.15 + rel.relationshipBar / 150 + (100 - p.smarts) / 300, 0.05, 0.95);
      if (rng.chance(prob)) {
        const amt = rng.int(10, 200);
        p.bankBalance += amt;
        body = `${n} sighed and handed you ${money(amt)}. "Don't spend it all in one place."`;
        outcome = "good";
        title = `${n} · +${money(amt)}`;
      } else {
        rel.relationshipBar = clamp(rel.relationshipBar - 3);
        body = `${n} said no. "Money doesn't grow on trees, you know."`;
        outcome = "bad";
      }
      break;
    }
  }
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title, body, tone: outcome }] };
}

// ---------------------------------------------------------------------------
// Partner actions
// ---------------------------------------------------------------------------

export function propose(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner || partner.partnerStatus !== "dating") return { player: p0 };
  if (partner.age < 18 || p.age < 18) {
    return { player: p0, notices: [{ kind: "info", title: "Too young", body: "You're both too young to marry.", tone: "neutral" }] };
  }
  if (rng.chance(clamp(partner.relationshipBar / 110, 0.05, 0.95))) {
    partner.partnerStatus = "married";
    partner.relationshipBar = clamp(partner.relationshipBar + 15);
    p.bankBalance -= 3000;
    changeStat(p, "happiness", 15);
    const body = `${partner.name} said yes! You married in a ceremony that cost ${money(3000)}.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Just Married!", body, tone: "good" }] };
  }
  partner.relationshipBar = clamp(partner.relationshipBar - 20);
  changeStat(p, "happiness", -8);
  const body = `${partner.name} said they aren't ready. The silence was deafening.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Rejected", body, tone: "bad" }] };
}

export function leavePartner(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner) return { player: p0 };
  const married = partner.partnerStatus === "married";
  const name = partner.name;
  endRelationship(p, married ? "divorce" : "breakup");
  changeStat(p, "happiness", -6);
  const body = married ? `You divorced ${name}.` : `You broke up with ${name}.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: married ? "Divorced" : "Single Again", body, tone: "bad" }] };
}

export function tryForBaby(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner) return { player: p0 };
  if ((p.annual.baby ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Patience", body: "You've already tried this year.", tone: "neutral" }] };
  }
  p.annual.baby = 1;
  if (p.age < 18 || partner.age < 18 || partner.age > 45 || (p.gender === partner.gender && p.sexuality === "Gay")) {
    const body = partner.age > 45 || p.age > 52 ? `At your age, conceiving naturally isn't likely.` : "You're not in a position to have a baby right now.";
    return { player: p0, notices: [{ kind: "info", title: "Not Possible", body, tone: "neutral" }] };
  }
  if (rng.chance(0.4)) {
    const kid = addRelative(p, { relation: "Child" }, rng);
    changeStat(p, "happiness", 15);
    partner.relationshipBar = clamp(partner.relationshipBar + 8);
    const body = `${partner.name} gave birth to a baby ${kid.gender === "Male" ? "boy" : "girl"}: ${kid.name}!`;
    return { player: p, notices: [{ kind: "info", title: "It's a baby!", body, tone: "good" }] };
  }
  const body = `You and ${partner.name} tried for a baby this year. No luck.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Not Yet", body, tone: "neutral" }] };
}

export function dateNight(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner) return { player: p0 };
  if ((p.annual.date ?? 0) >= 2) {
    return { player: p0, notices: [{ kind: "info", title: "Easy there", body: "You've had enough date nights this year.", tone: "neutral" }] };
  }
  if (p.bankBalance < 100) {
    return { player: p0, notices: [{ kind: "info", title: "Too poor", body: "A date night costs $100.", tone: "bad" }] };
  }
  p.annual.date = (p.annual.date ?? 0) + 1;
  p.bankBalance -= 100;
  partner.relationshipBar = clamp(partner.relationshipBar + 12);
  changeStat(p, "happiness", 4);
  const body = `You took ${partner.name} out for a romantic evening.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Date Night", body, tone: "good" }] };
}

// ---------------------------------------------------------------------------
// Meeting new people (builds an embedded one-off event)
// ---------------------------------------------------------------------------

export function meetSomeone(p0: PlayerState, kind: "friend" | "date", rng: Rng): ActionResult {
  const p = clone(p0);
  const key = `meet:${kind}`;
  if ((p.annual[key] ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Social Battery Low", body: "You've already put yourself out there this year.", tone: "neutral" }] };
  }
  if (kind === "date" && (p.age < 16 || getPartner(p))) {
    return { player: p0, notices: [{ kind: "info", title: "Not now", body: getPartner(p) ? "You already have a partner." : "You're too young to date.", tone: "neutral" }] };
  }
  if (kind === "friend" && p.age < 4) return { player: p0 };
  p.annual[key] = 1;

  const spec: NewRelativeSpec =
    kind === "date"
      ? { relation: "Partner", ageOffset: [-4, 5], partnerStatus: "dating" }
      : { relation: "Friend", ageOffset: [-3, 4] };
  const candidate = createRelative(p, spec, rng);
  const places = ["at a coffee shop", "at a friend's party", "at the gym", "at the library", "online", "at a concert"];
  const place = rng.pick(places);
  const event: LifeEvent = {
    id: `meet_${candidate.id}`,
    title: kind === "date" ? "A Spark?" : "New Face",
    description: `You met ${candidate.name} (${candidate.age}) ${place}. ${kind === "date" ? "There's definitely something there." : "They seem friendly."}`,
    minAge: 0,
    maxAge: 200,
    category: "romance",
    options: [
      {
        text: kind === "date" ? "Ask them out" : "Start a conversation",
        effects: {
          logText: `You and ${candidate.name} really hit it off.`,
          happinessDelta: 6,
          addRelative: { relation: spec.relation, prebuilt: candidate, partnerStatus: spec.partnerStatus },
        },
        chance: {
          p: clamp(0.45 + (kind === "date" ? (p.looks - 50) / 200 + p.skills.charisma / 250 : 0.25), 0.15, 0.9),
          failure: { logText: `You and ${candidate.name} didn't click. It happens.`, happinessDelta: -3 },
        },
      },
      { text: "Walk away", effects: { logText: `You decided not to talk to ${candidate.name}.` } },
    ],
  };
  return { player: p, notices: [{ kind: "event", event }] };
}

export function worthKeeping(p: PlayerState) {
  return livingRelatives(p);
}
