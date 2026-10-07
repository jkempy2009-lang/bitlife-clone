/**
 * Music careers. Stage one is the unsigned scene (band members with skills and chemistry, gigs,
 * demos, local fame). Stage two is the label (contract terms, recoupment, creative control).
 * Albums are driven by skill, songwriting, producer, direction and effort; tours pay and cost.
 */
import type { ActionResult, BandMember, PlayerState, RecordContract } from "@/types/game.types";
import { makeRng, type Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { ALBUM_RATINGS, MUSIC_GENRES } from "@/data/careersRegistry";
import { addLog, changeStat, clone, getPartner, isRoyal, livingRelatives } from "./state";
import { blockerFor } from "./occupation";
import { addVice } from "./vices";
import { info, logEvent, outputFor, payout, talentCeiling, trained, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const PRODUCERS = [
  { id: "self", label: "Produce it yourself", cost: 0, quality: -6, minFame: 0, blurb: "Free, and it sounds like it." },
  { id: "local", label: "Local engineer", cost: 6_000, quality: 0, minFame: 0, blurb: "Competent and affordable." },
  { id: "pro", label: "Industry producer", cost: 60_000, quality: 8, minFame: 15, blurb: "Radio-ready polish." },
  { id: "star", label: "Star producer", cost: 400_000, quality: 16, minFame: 45, blurb: "Their name sells records." },
] as const;

export const DIRECTIONS = [
  { id: "commercial", label: "Go commercial", blurb: "Chase the radio. More hits, thinner credibility." },
  { id: "balanced", label: "Balanced", blurb: "A bit of both." },
  { id: "artistic", label: "Artistic statement", blurb: "Your vision. Critics may love it, labels may not." },
] as const;

export const TOUR_SCALES = [
  { id: "club", label: "Club tour", minFans: 200, shows: 14, capacity: 400, price: 18, fixed: 6_000 },
  { id: "theatre", label: "Theatre tour", minFans: 8_000, shows: 24, capacity: 2_500, price: 45, fixed: 60_000 },
  { id: "arena", label: "Arena tour", minFans: 150_000, shows: 36, capacity: 15_000, price: 85, fixed: 500_000 },
  { id: "stadium", label: "Stadium tour", minFans: 2_000_000, shows: 44, capacity: 60_000, price: 140, fixed: 4_000_000 },
] as const;
export type TourScale = (typeof TOUR_SCALES)[number]["id"];

const LABELS = ["Neon Records", "Blackbird Music", "Eastside Sound", "Crown & Anchor", "Velvet Vinyl", "Meridian Entertainment", "Static Garden", "Big Dog Records"];
const FIRST = ["Alex", "Sam", "Jo", "Max", "Riley", "Dani", "Kit", "Remy", "Jules", "Tariq", "Mina", "Leo", "Priya", "Cole", "Nico", "Bea", "Omar", "Ivy", "Mateo", "Zoe"];
const LAST = ["Vance", "Okafor", "Reyes", "Lindqvist", "Moreau", "Tanaka", "Walsh", "Costa", "Novak", "Hart", "Dubois", "Singh", "Kowalski", "Brandt"];
const ROLES = ["Guitar", "Bass", "Drums", "Keys", "Vocals"];
const BAND_A = ["Velvet", "Neon", "Broken", "Midnight", "Paper", "Electric", "Lost", "Hollow", "Rust", "Golden"];
const BAND_B = ["Hearts", "Static", "Parade", "Wolves", "Highway", "Echo", "Ghosts", "Rivals", "Radio", "Fire"];

export const MAX_MEMBERS = 4;

export function albumRating(score: number) {
  let chosen: (typeof ALBUM_RATINGS)[number] = ALBUM_RATINGS[0];
  for (const r of ALBUM_RATINGS) if (score >= r.min) chosen = r;
  return chosen;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function bandSkill(p: PlayerState): number {
  const ms = p.music.members;
  if (ms.length === 0) return p.skills.music;
  return (p.skills.music * 1.5 + ms.reduce((s, m) => s + m.skill, 0)) / (1.5 + ms.length);
}

export function chemistry(p: PlayerState): number {
  const ms = p.music.members;
  return ms.length === 0 ? 100 : Math.round(ms.reduce((s, m) => s + m.loyalty, 0) / ms.length);
}

/** Your cut of whatever the act earns. */
export function playerShare(p: PlayerState): number {
  const n = p.music.members.length;
  return n === 0 ? 1 : Math.max(0.3, 1 / (n + 1) + 0.08);
}

export const isOneHitWonder = (p: PlayerState) => p.music.hits === 1 && p.music.yearsSinceHit >= 5 && p.music.albums.length >= 2;

export function musicTier(p: PlayerState): string {
  const m = p.music;
  if (m.status === "none" && m.albums.length === 0) return "Hobbyist";
  if (!m.signed) return m.localFame < 20 ? "Garage act" : m.localFame < 45 ? "Local favourite" : "Buzzing unsigned act";
  if (m.fans < 50_000) return "Signed act";
  if (m.fans < 500_000) return "Rising act";
  if (m.fans < 5_000_000) return "Headliner";
  return "Superstar";
}

export function contractOutstanding(c: RecordContract | null): number {
  return c ? c.unrecouped : 0;
}

export function qualityEstimate(p: PlayerState, producerId: string, direction: "commercial" | "balanced" | "artistic"): number {
  const m = p.music;
  const prod = PRODUCERS.find((x) => x.id === producerId) ?? PRODUCERS[1];
  const effortBonus = p.effort === "grind" ? 6 : p.effort === "coast" ? -8 : 0;
  const dirBonus = direction === "artistic" ? 2 : 0;
  const q = 0.34 * bandSkill(p) + 0.22 * m.songwriting + 12 + prod.quality + (chemistry(p) - 60) / 10 + effortBonus + dirBonus - Math.max(0, m.burnout - 60) * 0.3;
  return clamp(Math.round(q));
}

const memberName = (rng: Rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;

function makeMember(rng: Rng, skillBase: number, role?: string): BandMember {
  return {
    id: rng.id(),
    name: memberName(rng),
    role: role ?? rng.pick(ROLES),
    skill: clamp(Math.round(skillBase + rng.int(-14, 10))),
    loyalty: rng.int(55, 80),
    ego: rng.int(15, 85),
    partier: rng.chance(0.3),
  };
}

// ---------------------------------------------------------------------------
// Scene actions
// ---------------------------------------------------------------------------

export function practiceMusic(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if ((p.annual.practice ?? 0) >= 1) {
    return { player: p0, notices: [info("Sore Fingers", "You've practised plenty this year.")] };
  }
  p.annual.practice = 1;
  const gain = trained(p, "music", p.skills.music, rng.int(3, 6));
  p.skills.music = clamp(p.skills.music + gain);
  changeStat(p, "happiness", 2);
  const body = gain > 0
    ? `You practised for hours every day. Music skill +${gain}.`
    : `You practised for hours every day, but you've hit the limit of your natural talent. Only songwriting, gigs and experience can take you further.`;
  addLog(p, body);
  return { player: p, notices: [info("Practice Makes Perfect", body, "good")] };
}

export function writeSongs(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 12) return { player: p0 };
  if ((p.annual.write ?? 0) >= 1) return { player: p0, notices: [info("Notebook Full", "You've written all you can this year.")] };
  p.annual.write = 1;
  const m = p.music;
  const gain = trained(p, "song", m.songwriting, rng.int(3, 6) + (p.smarts >= 70 ? 1 : 0));
  m.songwriting = clamp(m.songwriting + gain);
  let body = `You filled notebooks with lyrics and chord sketches. Songwriting +${gain}.`;
  if (m.blockYears > 0 && rng.chance(0.5)) {
    m.blockYears = 0;
    body += " The words are flowing again: writer's block cured.";
  }
  changeStat(p, "happiness", 1);
  addLog(p, body);
  return { player: p, notices: [info("Songwriting", body, "good")] };
}

export function startSolo(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.age < 14 || p.music.status !== "none") return { player: p0 };
  p.music.status = "solo";
  const body = "You started performing solo: open mics, house parties, anywhere with a plug socket.";
  addLog(p, body);
  return { player: p, notices: [info("Solo Act", body, "good")] };
}

export function formBand(p0: PlayerState, tapScore: number, rng: Rng = makeRng(p0.year * 7919 + p0.age)): ActionResult {
  const p = clone(p0);
  if (p.age < 14) return { player: p0 };
  if (p.music.status === "band") return { player: p0 };
  if (p.music.signed) return { player: p0 };
  if ((p.annual.audition_music ?? 0) >= 1) {
    return { player: p0, notices: [info("Try Next Year", "Your bandmates are tired of rehearsing for now.")] };
  }
  p.annual.audition_music = 1;
  const rating = p.skills.music * 0.6 + tapScore * 0.6;
  if (rating >= 40) {
    const r = rng;
    const m = p.music;
    m.status = "band";
    m.members = Array.from({ length: 2 }, (_, i) => makeMember(r, rating * 0.8, ROLES[(i + 1) % ROLES.length]));
    m.bandName = `${r.pick(BAND_A)} ${r.pick(BAND_B)}`;
    changeStat(p, "fame", 2);
    changeStat(p, "happiness", 8);
    const body = `You formed a band called ${m.bandName} with ${m.members.map((x) => x.name).join(" and ")}. Your skill and rhythm check (${Math.round(rating)}) impressed everybody.`;
    addLog(p, body);
    return { player: p, notices: [info("A Band Is Born", body, "good")] };
  }
  changeStat(p, "happiness", -3);
  const body = `Nobody wanted to join your band. Rating: ${Math.round(rating)} (needed 40). Practise and try again.`;
  addLog(p, body);
  return { player: p, notices: [info("Band Fell Apart", body, "bad")] };
}

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
  const body = `${member.name} joined on ${role.toLowerCase()} (skill ${member.skill}). Chemistry is untested.`;
  addLog(p, body);
  return { player: p, notices: [info("New Member", body, "good")] };
}

export function dismissMember(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const m = p.music;
  const mem = m.members.find((x) => x.id === id);
  if (!mem) return { player: p0 };
  m.members = m.members.filter((x) => x.id !== id);
  for (const o of m.members) o.loyalty = clamp(o.loyalty - 6);
  if (m.members.length === 0 && !m.signed) m.status = "solo";
  const body = `You showed ${mem.name} the door. The others are uneasy about how easy that was.`;
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
  for (const o of m.members) o.loyalty = clamp(o.loyalty + 12);
  changeStat(p, "happiness", 3);
  const body = "You took the band out for food and a long argument about the best album ever made. Chemistry up.";
  addLog(p, body);
  return { player: p, notices: [info("Band Night", body, "good")] };
}

export function recordDemo(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.status === "none") return { player: p0 };
  if ((p.annual.demo ?? 0) >= 1) return { player: p0, notices: [info("Tape's Cut", "You already recorded a demo this year.")] };
  if (p.bankBalance < 1_500) return { player: p0, notices: [info("Can't Afford It", "Studio time for a demo costs $1,500.", "bad")] };
  p.annual.demo = 1;
  p.bankBalance -= 1_500;
  m.demo = clamp(Math.round(0.5 * bandSkill(p) + 0.3 * m.songwriting + 15 + rng.int(-8, 10)));
  const body = `You recorded a demo for $1,500. Quality: ${m.demo}/100. Labels will hear it when you audition.`;
  addLog(p, body);
  return { player: p, notices: [info("Demo Recorded", body, m.demo >= 55 ? "good" : "neutral")] };
}

export function toggleManager(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.status === "none") return { player: p0 };
  if (!m.manager && m.localFame < 25 && !m.signed) return { player: p0, notices: [info("Nobody Will Take You", "Managers want an act with a local buzz (25+ local fame).")] };
  m.manager = !m.manager;
  const body = m.manager ? "You hired a manager. They take 15% of everything, but they open doors, protect you from bad deals and keep your schedule sane." : "You fired your manager.";
  addLog(p, body);
  return { player: p, notices: [info(m.manager ? "Manager Hired" : "Manager Fired", body)] };
}

export function takeMusicBreak(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.status === "none") return { player: p0 };
  if (m.onBreak) return { player: p0, notices: [info("Already Resting", "You're already taking the year off.")] };
  m.onBreak = true;
  m.burnout = clamp(m.burnout - 30);
  changeStat(p, "happiness", 4);
  const body = "You cancelled everything and went home. Burnout eases, but your momentum won't wait for you.";
  addLog(p, body);
  return { player: p, notices: [info("Time Off", body)] };
}

// ---------------------------------------------------------------------------
// Label stage
// ---------------------------------------------------------------------------

function rollTerms(p: PlayerState, leverage: number, rng: Rng): RecordContract {
  const m = p.music;
  const years = rng.pick([3, 4, 5, 6]);
  const advance = Math.round((15_000 + m.localFame * 500 + p.fame * 2_500 + Math.max(0, leverage) * 1_500) / 1000) * 1000;
  return {
    label: rng.pick(LABELS),
    totalYears: years,
    yearsLeft: years,
    advance,
    stipend: 25_000,
    royaltyRate: Number(clamp(0.1 + leverage * 0.0025 + (m.manager ? 0.02 : 0), 0.1, 0.2).toFixed(3)),
    albumsOwed: years >= 5 ? 4 : 3,
    albumsDelivered: 0,
    unrecouped: advance,
    creativeControl: Math.round(clamp(25 + leverage * 1.5 + m.localFame / 4, 15, 80)),
    tourCut: 0.15,
    renegotiatedYear: 0,
  };
}

export function auditionRating(p: PlayerState, kind: "solo" | "band", tapScore: number): number {
  const m = p.music;
  return (
    p.skills.music * 0.3 + tapScore * 0.12 + p.looks * 0.06 + p.fame * 0.15 + m.localFame * 0.35 + m.demo * 0.15 + m.songwriting * 0.1 +
    (kind === "band" ? 5 : 0) + (m.manager ? 4 : 0)
  );
}

export function auditionContract(p0: PlayerState, kind: "solo" | "band", tapScore: number, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) {
    return { player: p0, notices: [info("Too Young", "Record labels only sign artists who are 18 or older.")] };
  }
  if (p.music.signed) return { player: p0 };
  const blocked = blockerFor(p, "music");
  if (blocked) return { player: p0, notices: [info("Can't Sign", blocked, "bad")] };
  if (kind === "band" && p.music.status !== "band") return { player: p0 };
  if ((p.annual.audition_music ?? 0) >= 1) {
    return { player: p0, notices: [info("Try Next Year", "You've already auditioned this year.")] };
  }
  p.annual.audition_music = 1;
  const m0 = p.music;
  // Labels are busy: a scene with no buzz rarely gets a meeting at all.
  if (!rng.chance(clamp(0.3 + m0.localFame / 100 + (m0.manager ? 0.15 : 0), 0.15, 0.9) * (p.age > 28 ? Math.max(0.2, 1 - (p.age - 28) * 0.05) : 1))) {
    const body = "No label would take the meeting. A&R scouts follow buzz: gig more, get a manager, record a demo.";
    addLog(p, body);
    return { player: p, notices: [info("No Meeting", body, "bad")] };
  }
  const need = kind === "solo" ? 45 : 40;
  const ability = kind === "solo" ? p.skills.music : bandSkill(p);
  if (ability < need) {
    changeStat(p, "happiness", -4);
    const body = `The A&R rep listened politely and passed: the playing isn't there yet (${Math.round(ability)}, labels want ${need}+${kind === "band" ? " from the band as a whole" : ""}). Practise, write and gig.`;
    addLog(p, body);
    return { player: p, notices: [info("Not Ready", body, "bad")] };
  }
  const rating = auditionRating(p, kind, tapScore) + rng.int(-8, 8);
  const needed = kind === "solo" ? 63 : 57;
  const m = p.music;
  if (rating >= needed) {
    m.signed = true;
    m.status = kind;
    m.contract = rollTerms(p, rating - needed, rng);
    m.labelStanding = 60;
    m.relevance = Math.max(m.relevance, 55);
    if (p.currentJob) {
      addLog(p, `You left your job as a ${p.currentJob.title} to focus on music.`);
      p.currentJob = null;
      p.annualSalary = 0;
    }
    if (!p.specialCareers.includes("musician")) p.specialCareers.push("musician");
    if (!isRoyal(p)) p.specialCareerPath = "musician";
    const c = m.contract;
    const net = payout(p, c.advance);
    changeStat(p, "fame", 6);
    changeStat(p, "happiness", 15);
    const body = `${c.label} signed you to a ${kind === "solo" ? "solo" : "band"} contract: ${c.totalYears} years, ${c.albumsOwed} albums, ${money(c.advance)} advance (${money(net)} after withholding) plus ${money(c.stipend)} a year. Your royalty rate is ${Math.round(c.royaltyRate * 100)}%, and the label fronts the costs. You repay everything out of your royalties.`;
    addLog(p, body);
    return { player: p, notices: [info("Record Deal!", body, "good")] };
  }
  changeStat(p, "happiness", -5);
  const body = `The label passed. Your audition scored ${Math.round(rating)} (needed ${needed}). Local buzz, a good demo and songwriting all count. Keep building your scene.`;
  addLog(p, body);
  return { player: p, notices: [info("Audition Failed", body, "bad")] };
}

/** Walk away from your label. Leaving early forfeits the catalogue you made under contract. */
export function leaveLabel(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (!m.signed) return { player: p0 };
  const early = (m.contract?.yearsLeft ?? 0) > 0;
  let lost = 0;
  if (early) {
    for (const a of m.albums) {
      if (!a.indie && !a.labelOwned) {
        a.labelOwned = true;
        lost += 1;
      }
    }
  }
  m.signed = false;
  m.contract = null;
  m.pendingAlbum = null;
  if (p.specialCareerPath === "musician") p.specialCareerPath = "none";
  changeStat(p, "happiness", -3);
  m.labelStanding = 40;
  const body = early && lost > 0
    ? `You broke your contract and left the label. They own the masters of your ${lost} album${lost > 1 ? "s" : ""} and keep the royalties. You're free, and independent.`
    : "You left your record label. Your back catalogue keeps earning, but the yearly stipend is gone. From here you release independently.";
  addLog(p, body);
  return { player: p, notices: [info("Left the Label", body, "neutral")] };
}

export function renegotiateContract(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const m = p.music;
  const c = m.contract;
  if (!m.signed || !c) return { player: p0 };
  if (c.renegotiatedYear === p.year) return { player: p0, notices: [info("Already Tried", "Your lawyers have had their say this year.")] };
  c.renegotiatedYear = p.year;
  const leverage = (m.labelStanding - 50) / 100 + p.fame / 200 + m.hits * 0.05 + (m.manager ? 0.1 : 0);
  if (rng.chance(clamp(0.3 + leverage, 0.1, 0.8))) {
    const bump = Number(rng.float(0.02, 0.04).toFixed(3));
    c.royaltyRate = Number(Math.min(0.3, c.royaltyRate + bump).toFixed(3));
    c.creativeControl = clamp(c.creativeControl + 10);
    c.stipend = Math.round(c.stipend * 1.1);
    const body = `Your lawyers pried better terms out of ${c.label}: royalty rate ${Math.round(c.royaltyRate * 100)}%, more creative control and a bigger stipend.`;
    addLog(p, body);
    return { player: p, notices: [info("Better Terms", body, "good")] };
  }
  m.labelStanding = clamp(m.labelStanding - 10);
  const body = `${c.label} refused and took offence at the ask. Your standing with them dropped.`;
  addLog(p, body);
  return { player: p, notices: [info("Talks Collapse", body, "bad")] };
}

export function recordAlbum(
  p0: PlayerState,
  genre: string,
  title: string,
  opts: { producer?: string; direction?: "commercial" | "balanced" | "artistic" } = {},
): ActionResult {
  const p = clone(p0);
  const m = p.music;
  if (m.status === "none" && !m.signed) return { player: p0 };
  if (m.blockYears > 0) return { player: p0, notices: [info("Writer's Block", "The songs aren't coming. Write, rest or take a break until it passes.", "bad")] };
  if ((p.annual.tour ?? 0) >= 1) return { player: p0, notices: [info("On the Road", "You can't record in a year you toured. Studio year or touring year.", "bad")] };
  if (m.pendingAlbum || (p.annual.album ?? 0) >= 1) {
    return { player: p0, notices: [info("Studio Booked", "You've already recorded an album this year. It will be released when you age up.")] };
  }
  const prod = PRODUCERS.find((x) => x.id === opts.producer) ?? PRODUCERS[1];
  if (p.fame + (m.signed ? 15 : 0) < prod.minFame) return { player: p0, notices: [info("Out of Your League", `${prod.label} won't work with someone under ${prod.minFame} Fame.`, "bad")] };
  const indie = !m.signed;
  const cost = prod.cost + (indie ? 2_000 : 0);
  if (indie && p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `Self-funding this record costs ${money(cost)}.`, "bad")] };
  let direction = opts.direction ?? "balanced";
  const notes: string[] = [];
  const c = m.contract;
  if (c && direction !== "commercial" && c.creativeControl < 40) {
    direction = "commercial";
    notes.push("The label overruled you and demanded a commercial record (creative control under 40).");
  }
  p.annual.album = 1;
  if (indie) p.bankBalance -= cost;
  else if (c) c.unrecouped += prod.cost;
  const name = title.trim() || `${genre} Dreams ${m.albums.length + 1}`;
  const quality = qualityEstimate(p, prod.id, direction);
  m.genre = genre;
  m.pendingAlbum = { title: name, genre, quality, producer: prod.id, direction, indie };
  const body = `You recorded a ${genre} album called "${name}" with ${prod.label.toLowerCase()}${cost ? ` (${money(cost)}${indie ? " from your pocket" : ", added to your label debt"})` : ""}. It will be released this year!${notes.length ? " " + notes.join(" ") : ""}`;
  addLog(p, body);
  return { player: p, notices: [info("In the Studio", body, "good")] };
}

export function tourOptions(p: PlayerState) {
  return TOUR_SCALES.map((t) => ({ ...t, ok: p.music.fans >= t.minFans }));
}

export function goOnTour(p0: PlayerState, rng: Rng, scaleId: TourScale): ActionResult {
  const p = clone(p0);
  const m = p.music;
  const scale = TOUR_SCALES.find((t) => t.id === scaleId);
  if (!scale || m.status === "none") return { player: p0 };
  if ((p.annual.tour ?? 0) >= 1) return { player: p0, notices: [info("Already Toured", "One tour a year is all your body can take.")] };
  if (m.pendingAlbum || (p.annual.album ?? 0) >= 1) return { player: p0, notices: [info("Studio Year", "You're making a record this year. You can't also be on the road.", "bad")] };
  if (m.fans < scale.minFans) return { player: p0, notices: [info("Not Enough Fans", `A ${scale.label.toLowerCase()} needs about ${scale.minFans.toLocaleString()} fans. You have ${Math.round(m.fans).toLocaleString()}.`)] };
  const indie = !m.signed;
  if (indie && p.bankBalance < scale.fixed * 0.5) return { player: p0, notices: [info("Can't Afford It", `You need ${money(Math.round(scale.fixed * 0.5))} up front to put a ${scale.label.toLowerCase()} on the road.`, "bad")] };
  p.annual.tour = 1;
  m.tours += 1;
  const relFactor = 0.5 + m.relevance / 100;
  const attendance = Math.min(scale.capacity, Math.round(m.fans * 0.04 * relFactor + m.localFame * 4 + 40));
  const fill = attendance / scale.capacity;
  const ticketRev = attendance * scale.shows * scale.price * (fill < 0.35 ? rng.float(0.7, 1) : 1);
  const merchRev = attendance * scale.shows * scale.price * 0.25;
  const gross = ticketRev + merchRev;
  const crew = ticketRev * 0.55;
  let net = gross - crew - scale.fixed;
  const notices: Notices = [];
  const c = m.contract;
  let labelCut = 0;
  if (net > 0 && m.signed && c) labelCut = net * c.tourCut;
  const mgrCut = net > 0 && m.manager ? net * 0.15 : 0;
  let yours = 0;
  if (net > 0) yours = (net - labelCut - mgrCut) * playerShare(p);
  else if (m.signed && c) {
    c.unrecouped += Math.round(-net);
    yours = 0;
  } else {
    yours = net * playerShare(p);
  }
  net = Math.round(net);
  const received = yours > 0 ? payout(p, yours) : Math.round(yours);
  if (yours < 0) p.bankBalance += Math.round(yours);
  m.earnings += Math.max(0, received);
  m.fans += attendance * scale.shows * 0.02;
  m.relevance = clamp(m.relevance + 4);
  m.burnout = clamp(m.burnout + 8 + TOUR_SCALES.indexOf(scale) * 4);
  changeStat(p, "health", -Math.round(scale.shows / 8));
  const success = net > 0;
  changeStat(p, "happiness", success ? 5 : -4);
  changeStat(p, "fame", success ? 2 : 0);
  const partner = getPartner(p);
  if (partner) partner.relationshipBar = clamp(partner.relationshipBar - 4);
  for (const k of livingRelatives(p, "Child")) if (k.age < 18) k.relationshipBar = clamp(k.relationshipBar - 2);
  let body = `${scale.label}: ${scale.shows} shows, about ${attendance.toLocaleString()} a night (${Math.round(fill * 100)}% full). ${
    net > 0 ? `You banked ${money(received)} after crew, label${m.manager ? ", manager" : ""} and band cuts and withholding.` : m.signed ? `It lost ${money(-net)}, which the label added to your debt.` : `It lost ${money(-net)} and you ate the cost.`
  }`;
  if (rng.chance(0.3 + m.burnout / 400 + m.members.filter((x) => x.partier).length * 0.06)) {
    const key = rng.chance(0.55) ? "alcohol" : "drugs";
    addVice(p, key, rng.int(4, 10));
    body += ` The tour bus had a lot of ${key === "alcohol" ? "drinking" : "pills and powders"}, and you joined in.`;
  }
  if (rng.chance(0.08)) {
    changeStat(p, "health", -10);
    body += " You strained your voice and cracked a rib on stage and had to cancel dates.";
  }
  addLog(p, body);
  notices.push(info(success ? "Tour Complete" : "Tour Loses Money", body, success ? "good" : "bad"));
  return { player: p, notices };
}

// ---------------------------------------------------------------------------
// Yearly tick
// ---------------------------------------------------------------------------

function dropFromLabel(p: PlayerState, notices: Notices, why: string, forfeit: boolean) {
  const m = p.music;
  m.droppedCount += 1;
  // Unrecouped acts never owned their records; a breach forfeits everything.
  if (forfeit || (m.contract?.unrecouped ?? 0) > 0) {
    for (const a of m.albums) if (!a.indie) a.labelOwned = true;
  }
  m.signed = false;
  m.contract = null;
  m.pendingAlbum = null;
  m.relevance = clamp(m.relevance - 10);
  changeStat(p, "happiness", -10);
  changeStat(p, "fame", -4);
  if (p.specialCareerPath === "musician") p.specialCareerPath = "none";
  logEvent(p, notices, "Dropped by the Label", why, "bad");
}

function releaseAlbum(p: PlayerState, rng: Rng, notices: Notices) {
  const m = p.music;
  const pending = m.pendingAlbum;
  if (!pending) return;
  const indie = pending.indie ?? !m.signed;
  const quality = pending.quality ?? qualityEstimate(p, "local", "balanced");
  const dir = pending.direction ?? "balanced";
  const hitChance = clamp((quality - 55) / 70 + (dir === "commercial" ? 0.14 : dir === "artistic" ? -0.08 : 0) + (m.relevance - 50) / 400 + (indie ? 0 : 0.06), 0.02, 0.75);
  const hit = rng.chance(hitChance);
  const score = quality * 0.7 + p.fame * 0.25 + (m.relevance - 50) * 0.1 + (hit ? 8 : 0) + rng.int(-12, 14) + (dir === "commercial" ? 4 : dir === "artistic" ? -3 : 0);
  const r = albumRating(score);
  const sales = Math.round(r.sales * rng.float(0.8, 1.25) * (hit ? 1.5 : 1) * (indie ? 0.35 : 1));
  const c = m.contract;
  const rate = indie ? 0.7 : c?.royaltyRate ?? 0.14;
  const royalty = Math.round(sales * 9 * rate);
  m.albums.push({ title: pending.title, genre: pending.genre, rating: r.rating, sales, royalty, year: p.year, quality, hit, indie });
  m.pendingAlbum = null;
  m.fans += sales * 0.1 + (hit ? 2_000 : 0);
  m.relevance = clamp(m.relevance + (hit ? 25 : r.fame >= 4 ? 12 : r.fame < 0 ? -12 : 2));
  if (hit) {
    m.hits += 1;
    m.yearsSinceHit = 0;
  }
  if (!indie && c) {
    c.albumsDelivered += 1;
    const delta = r.rating === "Flop" ? -22 : r.rating === "Modest" ? -3 : r.rating === "Hit" ? 10 : r.rating === "Gold" ? 16 : r.rating === "Platinum" ? 20 : 25;
    m.labelStanding = clamp(m.labelStanding + delta);
  }
  changeStat(p, "fame", r.fame);
  const body = `Your ${pending.genre} album "${pending.title}" ${hit ? "spawned a chart single and " : ""}sold ${sales.toLocaleString()} copies and was rated ${r.rating.toUpperCase()}.${indie ? " It was self-released." : ""} Royalties: ${money(royalty)}${!indie && c && c.unrecouped > 0 ? ` (they go against your ${money(c.unrecouped)} label debt first)` : ""}.`;
  addLog(p, body);
  notices.push(info(`Album Released: ${r.rating}`, body, r.fame >= 7 ? "jackpot" : r.fame > 0 ? "good" : "bad"));

  // Awards season
  const album = m.albums[m.albums.length - 1];
  if (quality >= 70 && ["Hit", "Gold", "Platinum", "Diamond"].includes(r.rating)) {
    const chance = clamp((quality - 70) / 60 + (dir === "artistic" ? 0.1 : 0) + (hit ? 0.1 : 0), 0, 0.6);
    if (rng.chance(chance)) {
      const award = m.albums.length === 1 ? "Best New Artist" : rng.pick(["Album of the Year", "Best Rock Album", "Record of the Year", "Critics' Choice Award"]);
      album.award = award;
      m.awards.push(`${award} (${p.year})`);
      m.relevance = clamp(m.relevance + 8);
      changeStat(p, "fame", 6);
      changeStat(p, "happiness", 12);
      logEvent(p, notices, "Awards Night", `"${pending.title}" won ${award}! You gave a speech you'll cringe at for years.`, "jackpot");
    }
  }
}

function royaltyIncome(p: PlayerState): { toPlayer: number; label: number } {
  const m = p.music;
  let label = 0;
  let indie = 0;
  for (const a of m.albums) {
    if (a.labelOwned) continue;
    if (a.indie) indie += a.royalty;
    else label += a.royalty;
  }
  const c = m.contract;
  let labelNet = label;
  if (c && c.unrecouped > 0) {
    const applied = Math.min(c.unrecouped, label);
    c.unrecouped -= applied;
    labelNet = label - applied;
  }
  return { toPlayer: Math.round((labelNet + indie) * playerShare(p)), label };
}

function bandTick(p: PlayerState, rng: Rng, notices: Notices, output: number) {
  const m = p.music;
  for (const mem of [...m.members]) {
    mem.skill = clamp(mem.skill + rng.int(0, 2) - (output < 0.4 ? 1 : 0));
    const drift =
      (output >= 0.8 ? 3 : output < 0.4 ? -3 : 0) - Math.round(mem.ego / 30) - (mem.partier ? 2 : 0) - (p.effort === "coast" ? 2 : 0) + (m.signed && m.labelStanding > 60 ? 2 : 0) + rng.int(-3, 4);
    mem.loyalty = clamp(mem.loyalty + drift);
    if (mem.loyalty < 20 && rng.chance(0.55)) {
      m.members = m.members.filter((x) => x.id !== mem.id);
      for (const o of m.members) o.loyalty = clamp(o.loyalty - 5);
      logEvent(p, notices, "Bandmate Quits", `${mem.name} (${mem.role.toLowerCase()}) quit the band after too many clashes and not enough rehearsal. The others are shaken.`, "bad");
    }
  }
  if (m.status === "band" && m.members.length === 0) {
    m.status = "solo";
    logEvent(p, notices, "The Band Is Over", `${m.bandName || "The band"} has no members left but you. You carry on as a solo act.`, "bad");
  }
  if (m.members.length >= 2 && chemistry(p) < 35 && rng.chance(0.3)) {
    for (const mem of m.members) mem.loyalty = clamp(mem.loyalty - 8);
    logEvent(p, notices, "Band Feud", "A blazing row backstage spilled onto social media. Chemistry took a beating.", "bad");
    if (m.fans >= 5_000) raiseScandal(p, "music", rng, notices, 1);
  }
}

/** Returns the year's gross (taxable) music income. */
export function processMusic(p: PlayerState, rng: Rng, notices: Notices): number {
  const m = p.music;
  const active = m.status !== "none" || m.signed;
  if (!active && m.albums.length === 0) return 0;
  let gross = 0;
  let costs = 0;
  const income = { gigs: 0, royalties: 0, stipend: 0, costs: 0 };
  if (active) m.yearsActive += 1;

  let output = active ? outputFor(p, "music") : 0;
  if (m.onBreak) {
    output = 0;
    m.onBreak = false;
  }

  // Release anything recorded last year, then count the money.
  releaseAlbum(p, rng, notices);
  const royalty = royaltyIncome(p);
  income.royalties = royalty.toPlayer;
  gross += royalty.toPlayer;
  for (const a of m.albums) a.royalty = a.royalty < 500 ? 0 : Math.round(a.royalty * 0.55);

  if (active) {
    // Playing is practice too: skills creep up with the hours you put in, up to your natural ceiling.
    const stoch = (x: number) => Math.floor(x) + (rng.chance(x - Math.floor(x)) ? 1 : 0);
    p.skills.music = clamp(p.skills.music + trained(p, "music", p.skills.music, stoch(output * 3.5)));
    m.songwriting = clamp(m.songwriting + trained(p, "song", m.songwriting, stoch(output * 2)));
    bandTick(p, rng, notices, output);
    const skillF = (bandSkill(p) / 60) * (0.6 + 0.4 * (chemistry(p) / 100));
    m.demo = Math.round(m.demo * 0.8);
    m.yearsSinceHit += 1;
    const ageDecay = p.age > 40 ? (p.age - 40) * 0.35 : 0;
    const genreDecay = m.genre === "Pop" || m.genre === "Hip-Hop" ? 3 : m.genre === "Jazz" || m.genre === "Country" ? -3 : 0;
    m.relevance = clamp(m.relevance - (7 + ageDecay + genreDecay - (m.yearsSinceHit <= 1 ? 3 : 0)));

    // Burnout, writer's block
    const burnDelta = output > 1.15 ? (output - 1.15) * 18 : output < 0.75 ? -6 : -2;
    m.burnout = clamp(m.burnout + burnDelta + (m.signed ? 4 : 0) - (m.manager ? 3 : 0));
    if (m.burnout >= 95) {
      m.burnout = 45;
      m.labelStanding = clamp(m.labelStanding - 10);
      p.effort = "steady";
      changeStat(p, "health", -6);
      changeStat(p, "happiness", -10);
      logEvent(p, notices, "Collapse", "You collapsed after a show and were hospitalised for exhaustion. Everything was cancelled and your effort has been reset to Steady.", "bad");
    }
    if (m.blockYears > 0) {
      m.blockYears -= 1;
      m.burnout = clamp(m.burnout - 10);
    } else if (m.burnout >= 70 && rng.chance(0.35)) {
      m.blockYears = rng.int(1, 2);
      logEvent(p, notices, "Writer's Block", "You stare at blank pages. The songs won't come while you're this worn out. You can't record until it passes.", "bad");
    }

    if (!m.signed) {
      // The unsigned scene: gigs, local fame, a growing (or shrinking) following.
      const gigs = Math.round(output * 14);
      m.gigs += gigs;
      const gigIncome = Math.round(gigs * (80 + m.localFame * 9) * playerShare(p));
      const gigCosts = gigs * 35 + (m.status === "band" ? 1_200 : 0);
      income.gigs = gigIncome;
      gross += gigIncome;
      costs += gigCosts;
      const lf = m.localFame;
      m.localFame = clamp(lf + gigs * 0.7 * skillF * (1 - lf / 110) - (gigs < 4 ? lf * 0.12 : lf * 0.03));
      m.fans = Math.max(0, Math.round(m.fans * (gigs >= 6 ? 0.96 : 0.88) + gigs * (5 + m.localFame * 0.7) * skillF));
    } else if (m.contract) {
      const c = m.contract;
      income.stipend = c.stipend;
      gross += c.stipend;
      c.unrecouped += c.stipend;
      c.yearsLeft -= 1;
      m.fans = Math.round(m.fans * (m.yearsSinceHit <= 1 ? 0.97 : 0.92));
      const sinceRelease = p.year - (m.albums[m.albums.length - 1]?.year ?? p.year - 3);
      if (sinceRelease >= 2 && !m.pendingAlbum) m.labelStanding = clamp(m.labelStanding - 6);
      const last2 = m.albums.filter((a) => !a.indie).slice(-2);
      if (m.signed && ((last2.length === 2 && last2.every((a) => a.rating === "Flop")) || m.labelStanding <= 15)) {
        dropFromLabel(p, notices, `${c.label} dropped you after another round of poor sales and a cooling relationship. ${c.unrecouped > 0 ? "They keep the masters of what you made for them." : ""}`.trim(), false);
      } else if (c.yearsLeft <= 0) {
        const fulfilled = c.albumsDelivered >= c.albumsOwed;
        if (fulfilled && m.labelStanding >= 45) {
          const years = rng.int(2, 4);
          m.contract = {
            ...c,
            totalYears: years,
            yearsLeft: years,
            advance: Math.round(c.advance * 1.5),
            stipend: Math.round(c.stipend * 1.4),
            royaltyRate: Number(Math.min(0.3, c.royaltyRate + 0.03).toFixed(3)),
            albumsOwed: rng.int(2, 3),
            albumsDelivered: 0,
            creativeControl: clamp(c.creativeControl + 10),
            renegotiatedYear: 0,
          };
          m.contract.unrecouped = c.unrecouped;
          const net = payout(p, m.contract.advance);
          logEvent(p, notices, "Contract Renewed", `${c.label} renewed you on better terms: ${years} years, ${Math.round(m.contract.royaltyRate * 100)}% royalty, ${money(m.contract.advance)} advance (${money(net)} after withholding).`, "good");
        } else if (fulfilled) {
          m.signed = false;
          m.contract = null;
          m.pendingAlbum = null;
          if (p.specialCareerPath === "musician") p.specialCareerPath = "none";
          logEvent(p, notices, "Contract Expired", `${c.label} let your contract lapse. You keep your catalogue and your freedom, but not their budget. Release independently or look for another deal.`, "neutral");
        } else {
          dropFromLabel(p, notices, `You didn't deliver the ${c.albumsOwed} albums you owed ${c.label}. They terminated the contract and kept the masters.`, true);
        }
      } else if (c.yearsLeft === 1 && c.albumsDelivered < c.albumsOwed) {
        notices.push(info("Delivery Deadline", `${c.label} expects ${c.albumsOwed - c.albumsDelivered} more album(s) before the contract ends next year.`, "bad"));
      }
    }

    // Temptations of the lifestyle
    const partiers = m.members.filter((x) => x.partier).length;
    if (p.fame >= 40 && rng.chance(0.06 + m.burnout / 600 + partiers * 0.03)) {
      const key = rng.chance(0.6) ? "alcohol" : "drugs";
      addVice(p, key, rng.int(4, 9));
      logEvent(p, notices, "Rock-Star Lifestyle", `The after-parties never end. You're ${key === "alcohol" ? "drinking" : "using"} more than you used to.`, "bad");
    }
    if (m.fans >= 5_000 && rng.chance(0.03 + (m.burnout > 70 ? 0.03 : 0))) raiseScandal(p, "music", rng, notices);

    if (m.manager && gross > 0) costs += Math.round(gross * 0.15);
  }
  m.fans = Math.round(m.fans);
  income.costs = costs;
  p.bankBalance -= costs;
  m.lastIncome = income;
  m.earnings += gross - costs;
  return gross;
}

export const GENRES = MUSIC_GENRES;
export { talentCeiling };
