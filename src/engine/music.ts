/**
 * Music careers. Stage one is the unsigned scene (band members with skills and chemistry, gigs,
 * demos, local fame). Stage two is the label (contract terms, recoupment, creative control).
 * Albums are driven by skill, songwriting, producer, direction and effort; tours pay and cost.
 */
import type { ActionResult, PlayerState, RecordContract } from "@/types/game.types";
import { makeRng, type Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { MUSIC_GENRES } from "@/data/careersRegistry";
import { addLog, changeStat, clone, isRoyal } from "./state";
import { blockerFor } from "./occupation";
import { addVice } from "./vices";
import { info, logEvent, outputFor, payout, talentCeiling, trained, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";
import {
  BAND_A, BAND_B, LABELS, PRODUCERS, ROLES, UNIT_VALUE, albumRating, audienceFor, bandSkill, chemistry, fanRetention, legacyScore,
  makeMember, playerShare,
} from "./musicCore";
import { bandTick } from "./musicBand";
import { disputeTick } from "./musicLegacy";

export * from "./musicCore";
export * from "./musicBand";
export * from "./musicTour";
export * from "./musicLegacy";

export function qualityEstimate(p: PlayerState, producerId: string, direction: "commercial" | "balanced" | "artistic"): number {
  const m = p.music;
  const prod = PRODUCERS.find((x) => x.id === producerId) ?? PRODUCERS[1];
  const effortBonus = p.effort === "grind" ? 6 : p.effort === "coast" ? -8 : 0;
  const dirBonus = direction === "artistic" ? 2 : 0;
  const q = 0.34 * bandSkill(p) + 0.22 * m.songwriting + 12 + prod.quality + (chemistry(p) - 60) / 10 + effortBonus + dirBonus - Math.max(0, m.burnout - 60) * 0.3;
  return clamp(Math.round(q));
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
    m.formerBand = null;
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
    // Always one year of slack: a studio year and a touring year can't be the same year.
    albumsOwed: Math.max(2, years - (years >= 5 ? 2 : 1)),
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
  m.formerBand = m.status === "band" ? null : m.formerBand;
  const body = `You recorded a ${genre} album called "${name}" with ${prod.label.toLowerCase()}${cost ? ` (${money(cost)}${indie ? " from your pocket" : ", added to your label debt"})` : ""}. It will be released this year!${notes.length ? " " + notes.join(" ") : ""}`;
  addLog(p, body);
  return { player: p, notices: [info("In the Studio", body, "good")] };
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

/** What an album sells as a share of the audience it can reach, by how it landed. */
const SALES_SHARE: Record<string, number> = { Flop: 0.02, Modest: 0.1, Hit: 0.28, Gold: 0.5, Platinum: 0.85, Diamond: 1.4 };
/** Certifications are about real units: a small act can have a great record without it being "Platinum". */
const CERT_FLOOR: Record<string, number> = { Gold: 40_000, Platinum: 200_000, Diamond: 1_000_000 };
const RATING_ORDER = ["Flop", "Modest", "Hit", "Gold", "Platinum", "Diamond"];
const ALBUM_MINS = [0, 35, 55, 70, 82, 94];

function releaseAlbum(p: PlayerState, rng: Rng, notices: Notices) {
  const m = p.music;
  const pending = m.pendingAlbum;
  if (!pending) return;
  const indie = pending.indie ?? !m.signed;
  const quality = pending.quality ?? qualityEstimate(p, "local", "balanced");
  const dir = pending.direction ?? "balanced";
  const audience = audienceFor(p);
  const hitChance = clamp((quality - 55) / 70 + (dir === "commercial" ? 0.14 : dir === "artistic" ? -0.08 : 0) + (m.relevance - 50) / 400 + (indie ? 0 : 0.06), 0.02, 0.75);
  const hit = rng.chance(hitChance);
  // A song can catch fire on streaming far beyond the audience that was waiting for it.
  const breakout = hit && m.fans < 1_500_000 && rng.chance(clamp(0.1 + (quality - 60) / 200, 0.04, 0.3));
  const score = quality * 0.7 + p.fame * 0.25 + (m.relevance - 50) * 0.1 + (hit ? 8 : 0) + rng.int(-12, 14) + (dir === "commercial" ? 4 : dir === "artistic" ? -3 : 0);
  const planned = albumRating(score);
  // Releasing every single year floods your own market; a global audience also has only so much attention.
  const last = m.albums[m.albums.length - 1];
  const fatigue = last && p.year - last.year <= 1 ? 0.75 : 1;
  const saturation = 1 / (1 + audience / 12_000_000);
  const sales = Math.max(
    12,
    Math.round(audience * SALES_SHARE[planned.rating] * rng.float(0.75, 1.3) * (hit ? 1.5 : 1) * (breakout ? rng.float(3, 12) : 1) * (indie ? 0.8 : 1) * fatigue * saturation),
  );
  // Cap the headline rating at what the units actually support.
  let idx = RATING_ORDER.indexOf(planned.rating);
  while (idx > 0 && CERT_FLOOR[RATING_ORDER[idx]] !== undefined && sales < CERT_FLOOR[RATING_ORDER[idx]]) idx -= 1;
  const r = albumRating(ALBUM_MINS[idx]);
  const c = m.contract;
  const rate = indie ? 0.7 : c?.royaltyRate ?? 0.14;
  const royalty = Math.round(sales * UNIT_VALUE * rate);
  const evergreen = idx >= 2 ? Math.round(royalty * 0.1) : 0;
  m.albums.push({ title: pending.title, genre: pending.genre, rating: r.rating, sales, royalty, year: p.year, quality, hit, indie, evergreen, breakout, direction: dir });
  m.pendingAlbum = null;
  m.fans += sales * (breakout ? 0.3 : 0.1) + (hit ? audience * 0.03 : 0);
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
  const body = `Your ${pending.genre} album "${pending.title}" ${breakout ? "had a single explode on streaming and " : hit ? "spawned a chart single and " : ""}sold ${sales.toLocaleString()} copies and was rated ${r.rating.toUpperCase()}.${indie ? " It was self-released." : ""} Royalties: ${money(royalty)}${!indie && c && c.unrecouped > 0 ? ` (they go against your ${money(c.unrecouped)} label debt first)` : ""}.`;
  addLog(p, body);
  notices.push(info(`Album Released: ${r.rating}`, body, breakout || r.fame >= 7 ? "jackpot" : r.fame > 0 ? "good" : "bad"));

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
    if (a.labelOwned || a.sold) continue;
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
  for (const a of m.albums) a.royalty = a.sold ? 0 : Math.max(a.evergreen ?? 0, a.royalty * 0.55 < 500 ? 0 : Math.round(a.royalty * 0.55));

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
    // A legend never sounds entirely out of date: the catalogue keeps a floor under relevance.
    m.relevance = Math.max(m.relevance, Math.round(legacyScore(p) * 0.25), Math.round(8 + m.localFame * 0.3));

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
      m.fans = Math.max(0, Math.round(m.fans * fanRetention(p, gigs >= 6 ? 0.96 : 0.88) + gigs * (5 + m.localFame * 0.7) * skillF));
    } else if (m.contract) {
      const c = m.contract;
      income.stipend = c.stipend;
      gross += c.stipend;
      c.unrecouped += c.stipend;
      c.yearsLeft -= 1;
      m.fans = Math.round(m.fans * fanRetention(p, m.yearsSinceHit <= 1 ? 0.97 : 0.92));
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
            albumsOwed: Math.max(1, years - 1),
            albumsDelivered: 0,
            extended: 0,
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
        } else if ((c.extended ?? 0) < 1 && m.labelStanding > 25) {
          // The label would rather have the records than the lawsuit: one extension, at a price.
          const short = c.albumsOwed - c.albumsDelivered;
          c.extended = (c.extended ?? 0) + 1;
          c.yearsLeft = Math.min(2, short);
          c.totalYears += c.yearsLeft;
          m.labelStanding = clamp(m.labelStanding - 8);
          logEvent(p, notices, "Contract Extended", `You still owe ${c.label} ${short} album${short > 1 ? "s" : ""}. They extended your term by ${c.yearsLeft} year${c.yearsLeft > 1 ? "s" : ""} to get them, with no new advance and a grudge.`, "bad");
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
  m.peakFans = Math.max(m.peakFans ?? 0, m.fans);
  disputeTick(p, rng, notices);
  income.costs = costs;
  p.bankBalance -= costs;
  m.lastIncome = income;
  m.earnings += gross - costs;
  return gross;
}

export const GENRES = MUSIC_GENRES;
export { talentCeiling };
