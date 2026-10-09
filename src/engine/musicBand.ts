/**
 * Band life: members are people with a temperament, a share of the songwriting and grievances that
 * fester if ignored. You can talk, share credit, pay, send to rehab, dismiss, split up, and one day reunite.
 */
import type { ActionResult, BandMember, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { logEvent, info, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";
import { MAX_MEMBERS, ROLES, TRAITS, chemistry, legacyScore, makeMember, playerCredit } from "./musicCore";
import { raiseDispute } from "./musicLegacy";

const GRIEVANCE_TEXT: Record<NonNullable<BandMember["grievance"]>, string> = {
  credit: "wants more writing credit",
  money: "thinks the band underpays them",
  direction: "hates the direction the band is heading",
  habit: "is struggling with drink and drugs",
};

/** What a member's departure is worth to a lawyer: credit on songs that still earn. */
const claimFor = (p: PlayerState, credit: number) =>
  Math.round(Math.max(4_000, (p.music.lastIncome.royalties + p.music.lastIncome.gigs) * (credit / 100) * 1.6 + 2_500) / 100) * 100;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function recruitMember(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.status !== "band") return { player: p0, notices: [info("No Band", "Form a band first.")] };
  if (m.members.length >= MAX_MEMBERS) return { player: p0, notices: [info("Full Line-up", `${MAX_MEMBERS} members is plenty.`)] };
  if ((p.annual.recruit ?? 0) >= 1) return { player: p0, notices: [info("Auditions Over", "You've already auditioned players this year.")] };
  p.annual.recruit = 1;
  const taken = new Set(m.members.map((x) => x.role));
  const role = ROLES.find((r) => !taken.has(r)) ?? rng.pick(ROLES);
  const member = makeMember(rng, clamp(p.skills.music + rng.int(-10, 5), 15, 25 + m.localFame * 0.6 + 30), role);
  m.members.push(member);
  const body = `${member.name} joined on ${role.toLowerCase()} (skill ${member.skill}). First impressions: ${TRAITS[member.trait ?? "peacemaker"].label.toLowerCase()}. Chemistry is untested.`;
  addLog(p, body);
  return { player: p, notices: [info("New Member", body, "good")] };
}

function recordFormerBand(p: PlayerState, members: BandMember[], split: "amicable" | "bitter") {
  const m = p.music;
  if (members.length === 0) return;
  m.formerBand = { name: m.bandName || "The band", year: p.year, members: members.map((x) => ({ ...x, grievance: null, grievanceYears: 0 })), split };
}

export function dismissMember(p0: PlayerState, id: string, rng?: Rng): ActionResult {
  const p = clone(p0);
  const m = p.music;
  const mem = m.members.find((x) => x.id === id);
  if (!mem) return { player: p0 };
  m.members = m.members.filter((x) => x.id !== id);
  for (const o of m.members) o.loyalty = clamp(o.loyalty - (mem.trait === "loyalist" ? 10 : 6));
  let body = `You showed ${mem.name} the door. The others are uneasy about how easy that was.`;
  if ((mem.credit ?? 0) >= 10 && m.fans >= 2_000 && (rng ? rng.chance(0.6) : true)) {
    const claim = claimFor(p, mem.credit ?? 0);
    if (raiseDispute(p, "credit", mem.name, claim, 2)) body += ` ${mem.name} has hired a lawyer over the songs they wrote.`;
  }
  if (m.members.length === 0 && !m.signed) {
    m.status = "solo";
    recordFormerBand(p, [mem], "bitter");
  }
  addLog(p, body);
  return { player: p, notices: [info("Band Shake-Up", body)] };
}

export function teamNight(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.members.length === 0) return { player: p0, notices: [info("No Band", "You need bandmates to bond with.")] };
  if ((p.annual.teamnight ?? 0) >= 1) return { player: p0, notices: [info("Enough Bonding", "You already took the band out this year.")] };
  if (p.bankBalance < 400) return { player: p0, notices: [info("Can't Afford It", "A night out for the band costs $400.", "bad")] };
  p.annual.teamnight = 1;
  p.bankBalance -= 400;
  // A night out cheers everybody, but it is no substitute for dealing with what is actually wrong.
  for (const o of m.members) o.loyalty = clamp(o.loyalty + (o.grievance ? 4 : 10));
  changeStat(p, "happiness", 3);
  const body = "You took the band out for food and a long argument about the best album ever made. Chemistry up, though the ones with real problems are still sitting on them.";
  addLog(p, body);
  return { player: p, notices: [info("Band Night", body, "good")] };
}

export function talkToMember(p0: PlayerState, rng: Rng, id: string): ActionResult {
  const p = clone(p0);
  const mem = p.music.members.find((x) => x.id === id);
  if (!mem) return { player: p0 };
  if ((p.annual[`talk:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Talked", `You've already sat down with ${mem.name} this year.`)] };
  p.annual[`talk:${id}`] = 1;
  mem.talked = true;
  if (!mem.grievance) {
    mem.loyalty = clamp(mem.loyalty + 4);
    const body = `You and ${mem.name} had a long, easy talk about where the band is going. They left feeling heard.`;
    addLog(p, body);
    return { player: p, notices: [info("Heart to Heart", body, "good")] };
  }
  if (mem.grievance === "habit") {
    mem.loyalty = clamp(mem.loyalty + 2);
    const body = `${mem.name} nodded, said they were fine, and changed the subject. This needs treatment, not conversation.`;
    addLog(p, body);
    return { player: p, notices: [info("They Won't Listen", body, "bad")] };
  }
  const trait = mem.trait ?? "peacemaker";
  const bonus = trait === "peacemaker" || trait === "loyalist" ? 0.15 : trait === "diva" ? -0.15 : trait === "mercenary" ? -0.1 : 0;
  const hard = mem.grievance === "direction" ? 0 : -0.15;
  const chance = clamp(0.4 + p.skills.charisma / 250 + mem.loyalty / 350 + bonus + hard, 0.1, 0.85);
  if (rng.chance(chance)) {
    mem.grievance = null;
    mem.grievanceYears = 0;
    mem.loyalty = clamp(mem.loyalty + 10);
    const body = `You talked ${mem.name} round. They still have opinions, but they are staying.`;
    addLog(p, body);
    return { player: p, notices: [info("Cleared the Air", body, "good")] };
  }
  mem.loyalty = clamp(mem.loyalty - 5);
  const body = `The talk with ${mem.name} turned into a shouting match. Nothing is settled and the mood is worse.`;
  addLog(p, body);
  return { player: p, notices: [info("It Got Heated", body, "bad")] };
}

export function shareCredit(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const mem = p.music.members.find((x) => x.id === id);
  if (!mem) return { player: p0 };
  if ((mem.credit ?? 0) >= 45) return { player: p0, notices: [info("Nothing Left to Give", `${mem.name} already has a huge share of the songs.`)] };
  if (playerCredit(p) <= 25) return { player: p0, notices: [info("Your Own Band", "You already give away most of the songs.")] };
  mem.credit = Math.min(45, (mem.credit ?? 0) + 10);
  mem.loyalty = clamp(mem.loyalty + 12);
  if (mem.grievance === "credit") {
    mem.grievance = null;
    mem.grievanceYears = 0;
  }
  for (const o of p.music.members) if (o.id !== id && (o.credit ?? 0) === 0 && p.music.split === "writers") o.loyalty = clamp(o.loyalty - 3);
  const body = `You put ${mem.name}'s name on more of the songs (now ${mem.credit}% of the writing). ${p.music.split === "writers" ? "Their royalty share grows with it." : "It costs you nothing yet, but switch to a writers' split and it would."}`;
  addLog(p, body);
  return { player: p, notices: [info("Credit Shared", body, "good")] };
}

export const raiseCost = (p: PlayerState) => Math.max(2_500, Math.round((p.music.lastIncome.gigs + p.music.lastIncome.royalties + p.music.lastIncome.stipend) * 0.06));

export function payRaise(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const mem = p.music.members.find((x) => x.id === id);
  if (!mem) return { player: p0 };
  const cost = raiseCost(p);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `A proper bonus for ${mem.name} is ${money(cost)}.`, "bad")] };
  if ((p.annual[`raise:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Paid", `${mem.name} has had their bonus this year.`)] };
  p.annual[`raise:${id}`] = 1;
  p.bankBalance -= cost;
  mem.loyalty = clamp(mem.loyalty + (mem.grievance === "money" ? 12 : 6));
  if (mem.grievance === "money") {
    mem.grievance = null;
    mem.grievanceYears = 0;
  }
  const body = `You paid ${mem.name} a ${money(cost)} bonus out of your own pocket. Money talks, and for now they are listening.`;
  addLog(p, body);
  return { player: p, notices: [info("Bonus Paid", body, "good")] };
}

export const REHAB_COST_MEMBER = 12_000;

export function sendToRehab(p0: PlayerState, rng: Rng, id: string): ActionResult {
  const p = clone(p0);
  const mem = p.music.members.find((x) => x.id === id);
  if (!mem) return { player: p0 };
  if (mem.grievance !== "habit" && mem.trait !== "addict") return { player: p0, notices: [info("No Need", `${mem.name} isn't in trouble.`)] };
  if (p.bankBalance < REHAB_COST_MEMBER) return { player: p0, notices: [info("Can't Afford It", `A good clinic is ${money(REHAB_COST_MEMBER)}.`, "bad")] };
  if ((p.annual[`rehab:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Done", `${mem.name} has already been this year.`)] };
  p.annual[`rehab:${id}`] = 1;
  p.bankBalance -= REHAB_COST_MEMBER;
  if (rng.chance(0.6 + (mem.loyalty - 50) / 250)) {
    mem.trait = "loyalist";
    mem.grievance = null;
    mem.grievanceYears = 0;
    mem.partier = false;
    mem.loyalty = clamp(mem.loyalty + 15);
    const body = `${mem.name} came back from rehab clear-eyed and grateful. They will not forget who paid for it.`;
    addLog(p, body);
    return { player: p, notices: [info("Clean", body, "good")] };
  }
  mem.loyalty = clamp(mem.loyalty - 6);
  const body = `${mem.name} walked out of the clinic after ten days. The money is gone and so is the progress.`;
  addLog(p, body);
  return { player: p, notices: [info("Relapse", body, "bad")] };
}

export function setSplit(p0: PlayerState, policy: "equal" | "writers"): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.split === policy) return { player: p0 };
  m.split = policy;
  for (const o of m.members) {
    if (policy === "writers") o.loyalty = clamp(o.loyalty - ((o.credit ?? 0) >= 10 ? 0 : o.trait === "mercenary" ? 12 : 6));
    else o.loyalty = clamp(o.loyalty - ((o.credit ?? 0) >= 10 ? 10 : 0) + (o.trait === "mercenary" ? 4 : 0));
  }
  const body = policy === "writers"
    ? "From now on, money follows the songs: whoever writes more, earns more. Members who only play are not delighted."
    : "You went back to an equal split. Writers who carried the songs feel robbed.";
  addLog(p, body);
  return { player: p, notices: [info(policy === "writers" ? "Writers' Split" : "Equal Split", body)] };
}

/** Break the band up. Going solo keeps most of your audience, but the story gets told by the people you leave. */
export function leaveBand(p0: PlayerState, rng: Rng, amicable: boolean): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.status !== "band") return { player: p0 };
  const notices: Notices = [];
  const members = m.members;
  const name = m.bandName || "the band";
  const body0 = amicable ? `${name} played a farewell show and went their separate ways, hugging in the car park.` : `You walked out on ${name}. The group chat has been unusually quiet since.`;
  let body = body0;
  recordFormerBand(p, members, amicable ? "amicable" : "bitter");
  m.members = [];
  m.status = "solo";
  m.fans = Math.round(m.fans * (amicable ? 0.88 : 0.75));
  m.relevance = clamp(m.relevance - (amicable ? 2 : 8));
  if (m.signed && m.contract) m.labelStanding = clamp(m.labelStanding - (amicable ? 6 : 15));
  if (!amicable) {
    const heavy = members.filter((x) => (x.credit ?? 0) >= 10);
    if (heavy.length && m.fans >= 2_000) {
      const w = heavy[0];
      if (raiseDispute(p, "credit", w.name, claimFor(p, w.credit ?? 0), 2)) body += ` ${w.name} is talking to lawyers.`;
    }
    if (m.fans >= 5_000 && rng.chance(0.5)) raiseScandal(p, "music", rng, notices, 1, "your bandmates told their side of the break-up to a magazine");
  }
  changeStat(p, "happiness", amicable ? -2 : -6);
  addLog(p, body);
  return { player: p, notices: [info(amicable ? "The Band Splits" : "Bitter Split", body, amicable ? "neutral" : "bad"), ...notices] };
}

/** Get the old band back together. Time heals; so does a catalogue people still love. */
export function reunite(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const m = p.music;
  const fb = m.formerBand;
  if (!fb || m.status === "band") return { player: p0 };
  if (p.year - fb.year < 3) return { player: p0, notices: [info("Too Soon", "The wounds are still fresh. Give it a few years.")] };
  if ((p.annual.reunion ?? 0) >= 1) return { player: p0, notices: [info("Waiting on Replies", "You've already made the calls this year.")] };
  p.annual.reunion = 1;
  const years = p.year - fb.year;
  const base = (fb.split === "amicable" ? 0.7 : 0.25) + Math.min(0.25, (years - 3) * 0.03) + legacyScore(p) / 300;
  const back = fb.members.filter((x) => rng.chance(clamp(base + (x.loyalty - 50) / 300, 0.05, 0.92)));
  if (back.length === 0) {
    const body = `You called around about getting ${fb.name} back together. Nobody picked up. One voicemail was just a laugh.`;
    addLog(p, body);
    return { player: p, notices: [info("No Reunion", body, "bad")] };
  }
  m.status = "band";
  m.bandName = fb.name;
  m.members = back.map((x) => ({ ...x, loyalty: clamp(x.loyalty * 0.5 + 35), grievance: null, grievanceYears: 0, years: 0, talked: false }));
  m.formerBand = null;
  const bump = 1.1 + legacyScore(p) / 400;
  m.fans = Math.round(m.fans * bump);
  m.relevance = clamp(m.relevance + 12);
  m.localFame = clamp(m.localFame + 6);
  changeStat(p, "happiness", 8);
  changeStat(p, "fame", 2);
  const body = `${fb.name} are back: ${back.map((x) => x.name).join(", ")} agreed to plug in again${back.length < fb.members.length ? " (not everyone returned the call)" : ""}. Nostalgia is a powerful drug: ticket queries tripled overnight.`;
  addLog(p, body);
  return { player: p, notices: [info("Reunion!", body, "jackpot")] };
}

// ---------------------------------------------------------------------------
// Yearly tick
// ---------------------------------------------------------------------------

function newGrievance(p: PlayerState, rng: Rng, mem: BandMember, output: number): BandMember["grievance"] {
  const m = p.music;
  const ego = mem.ego;
  const last = m.albums[m.albums.length - 1];
  switch (mem.trait) {
    case "diva":
      return rng.chance(0.28) ? "credit" : null;
    case "mercenary":
      return rng.chance(m.lastIncome.gigs + m.lastIncome.royalties + m.lastIncome.stipend < 30_000 * (m.members.length + 1) ? 0.3 : 0.08) ? "money" : null;
    case "workaholic":
      return output < 0.8 && rng.chance(0.3) ? "direction" : null;
    case "addict":
      return rng.chance(0.35) ? "habit" : null;
    default:
      if (last && last.direction === "commercial" && last.year >= p.year - 1 && ego > 50 && rng.chance(0.18)) return "direction";
      return ego > 65 && rng.chance(0.12) ? "credit" : null;
  }
}

export function bandTick(p: PlayerState, rng: Rng, notices: Notices, output: number) {
  const m = p.music;
  const peace = m.members.some((x) => x.trait === "peacemaker") ? 1 : 0;
  let raised = false;
  const gone: BandMember[] = [];
  for (const mem of [...m.members]) {
    mem.years = (mem.years ?? 0) + 1;
    mem.talked = false;
    const trait = mem.trait ?? "peacemaker";
    const growth = trait === "flake" ? rng.int(0, 1) : trait === "workaholic" ? rng.int(1, 3) : rng.int(0, 2);
    mem.skill = clamp(mem.skill + growth - (output < 0.4 ? 1 : 0));
    let drift =
      (output >= 0.8 ? 3 : output < 0.4 ? -3 : 0) - Math.round(mem.ego / 30) - (mem.partier ? 2 : 0) - (p.effort === "coast" ? 2 : 0) + (m.signed && m.labelStanding > 60 ? 2 : 0) + rng.int(-3, 4);
    drift += trait === "peacemaker" ? 2 : trait === "loyalist" ? 3 : trait === "diva" ? -2 : trait === "addict" ? -2 : 0;
    if (trait === "workaholic") drift += output < 0.8 ? -4 : 2;
    if (trait === "flake") drift += rng.int(-4, 3);
    if (trait === "mercenary") drift += m.lastIncome.gigs + m.lastIncome.royalties + m.lastIncome.stipend >= 30_000 * (m.members.length + 1) ? 3 : -3;
    if (peace && trait !== "peacemaker") drift += 1;
    if (mem.grievance) {
      mem.grievanceYears = (mem.grievanceYears ?? 0) + 1;
      drift -= 4 + 3 * mem.grievanceYears;
    } else if (!raised) {
      const g = newGrievance(p, rng, mem, output);
      if (g) {
        mem.grievance = g;
        mem.grievanceYears = 0;
        raised = true;
        notices.push(info("Band Trouble", `${mem.name} (${(TRAITS[trait].label).toLowerCase()}) ${GRIEVANCE_TEXT[g]}. Deal with it in The Band section before it festers.`, "bad"));
      }
    }
    mem.loyalty = clamp(mem.loyalty + drift);
    if (mem.grievance === "habit" && (mem.grievanceYears ?? 0) >= 2 && rng.chance(0.35)) {
      mem.loyalty = clamp(mem.loyalty - 20);
      mem.grievance = null;
      mem.grievanceYears = 0;
      for (const o of m.members) if (o.id !== mem.id) o.loyalty = clamp(o.loyalty - 8);
      logEvent(p, notices, "Overdose Scare", `${mem.name} was found unconscious after a party and rushed to hospital. They lived. The whole band is shaken.`, "bad");
      if (m.fans >= 5_000) raiseScandal(p, "music", rng, notices, 1, `${mem.name}'s overdose made the papers`);
    }
    const limit = trait === "loyalist" ? 12 : 20;
    if (mem.loyalty < limit && rng.chance(0.55)) {
      m.members = m.members.filter((x) => x.id !== mem.id);
      gone.push(mem);
      for (const o of m.members) o.loyalty = clamp(o.loyalty - 5);
      let text = `${mem.name} (${mem.role.toLowerCase()}) quit the band after too many clashes and not enough rehearsal. The others are shaken.`;
      if (mem.grievance === "credit" || (mem.credit ?? 0) >= 10) {
        if (m.fans >= 2_000 && raiseDispute(p, "credit", mem.name, claimFor(p, Math.max(10, mem.credit ?? 0)), 2)) text += ` ${mem.name} says half the songs are theirs and is taking it to lawyers.`;
      }
      logEvent(p, notices, "Bandmate Quits", text, "bad");
    }
  }
  if (m.status === "band" && m.members.length === 0) {
    m.status = "solo";
    recordFormerBand(p, gone, "bitter");
    logEvent(p, notices, "The Band Is Over", `${m.bandName || "The band"} has no members left but you. You carry on as a solo act.`, "bad");
  }
  if (m.members.length >= 2 && chemistry(p) < 35 && rng.chance(0.3)) {
    for (const mem of m.members) mem.loyalty = clamp(mem.loyalty - 8);
    logEvent(p, notices, "Band Feud", "A blazing row backstage spilled onto social media. Chemistry took a beating.", "bad");
    if (m.fans >= 5_000) raiseScandal(p, "music", rng, notices, 1);
  }
}
