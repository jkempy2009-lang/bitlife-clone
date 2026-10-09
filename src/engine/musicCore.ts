/**
 * Shared music-career model: catalogue of producers and tours, band maths, audience size, catalogue value and legacy.
 * No actions here; see music.ts (scene, label, albums), musicBand.ts, musicTour.ts and musicLegacy.ts.
 */
import type { BandMember, BandTrait, PlayerState, RecordContract } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { ALBUM_RATINGS } from "@/data/careersRegistry";

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

/** Venue sizes. Attendance comes from your fan base, so a small act that books too big plays to empty seats. */
export const TOUR_SCALES = [
  { id: "club", label: "Club tour", minFans: 300, shows: 14, capacity: 300, price: 18, fixed: 6_000 },
  { id: "theatre", label: "Theatre tour", minFans: 30_000, shows: 20, capacity: 1_500, price: 42, fixed: 70_000 },
  { id: "arena", label: "Arena tour", minFans: 800_000, shows: 30, capacity: 12_000, price: 78, fixed: 700_000 },
  { id: "stadium", label: "Stadium tour", minFans: 6_000_000, shows: 40, capacity: 50_000, price: 125, fixed: 6_000_000 },
] as const;
export type TourScale = (typeof TOUR_SCALES)[number]["id"];

export const TOUR_PACES = [
  { id: "light", label: "Light schedule", shows: 0.7, wear: 0.6, blurb: "Fewer dates, days off between shows. Smaller payday, kinder on body and band." },
  { id: "standard", label: "Standard run", shows: 1, wear: 1, blurb: "A normal touring cycle." },
  { id: "punishing", label: "Punishing schedule", shows: 1.4, wear: 1.7, blurb: "Back-to-back dates. Big money, big toll on health, voice and marriages." },
] as const;
export type TourPace = (typeof TOUR_PACES)[number]["id"];

export const LABELS = ["Neon Records", "Blackbird Music", "Eastside Sound", "Crown & Anchor", "Velvet Vinyl", "Meridian Entertainment", "Static Garden", "Big Dog Records"];
const FIRST = ["Alex", "Sam", "Jo", "Max", "Riley", "Dani", "Kit", "Remy", "Jules", "Tariq", "Mina", "Leo", "Priya", "Cole", "Nico", "Bea", "Omar", "Ivy", "Mateo", "Zoe"];
const LAST = ["Vance", "Okafor", "Reyes", "Lindqvist", "Moreau", "Tanaka", "Walsh", "Costa", "Novak", "Hart", "Dubois", "Singh", "Kowalski", "Brandt"];
export const ROLES = ["Guitar", "Bass", "Drums", "Keys", "Vocals"];
export const BAND_A = ["Velvet", "Neon", "Broken", "Midnight", "Paper", "Electric", "Lost", "Hollow", "Rust", "Golden"];
export const BAND_B = ["Hearts", "Static", "Parade", "Wolves", "Highway", "Echo", "Ghosts", "Rivals", "Radio", "Fire"];

export const MAX_MEMBERS = 4;
/** Dollars the artist earns per record sold, before their royalty rate. */
export const UNIT_VALUE = 7;

export const TRAITS: Record<BandTrait, { label: string; blurb: string }> = {
  peacemaker: { label: "Peacemaker", blurb: "Keeps everyone talking. Chemistry holds up under pressure." },
  diva: { label: "Diva", blurb: "Big talent, bigger ego. Wants credit, the spotlight and the last word." },
  workaholic: { label: "Workaholic", blurb: "Always rehearsing. Resents a band that coasts." },
  flake: { label: "Flake", blurb: "Late, distracted, brilliant when present. Never grows much." },
  addict: { label: "Troubled", blurb: "Fighting a habit. Tours and after-parties are dangerous for them." },
  mercenary: { label: "Hired gun", blurb: "Plays for the paycheque. Loyal exactly as long as the money is good." },
  loyalist: { label: "Ride-or-die", blurb: "Has your back through everything. Rarely causes trouble." },
};

export const albumRating = (score: number) => {
  let chosen: (typeof ALBUM_RATINGS)[number] = ALBUM_RATINGS[0];
  for (const r of ALBUM_RATINGS) if (score >= r.min) chosen = r;
  return chosen;
};

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

const memberName = (rng: Rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;

export function makeMember(rng: Rng, skillBase: number, role?: string): BandMember {
  const trait: BandTrait = rng.weighted<BandTrait>(["peacemaker", "diva", "workaholic", "flake", "addict", "mercenary", "loyalist"], (t) => (t === "addict" ? 0.7 : t === "loyalist" ? 1.2 : 1)) ?? "peacemaker";
  const ego = clamp(rng.int(15, 85) + (trait === "diva" ? 25 : trait === "peacemaker" || trait === "loyalist" ? -15 : 0));
  return {
    id: rng.id(),
    name: memberName(rng),
    role: role ?? rng.pick(ROLES),
    skill: clamp(Math.round(skillBase + rng.int(-14, 10))),
    loyalty: clamp(rng.int(55, 80) + (trait === "loyalist" ? 12 : trait === "mercenary" ? -10 : 0)),
    ego,
    partier: trait === "addict" || trait === "flake" ? rng.chance(0.7) : rng.chance(0.15),
    trait,
    credit: 0,
    years: 0,
    grievance: null,
    grievanceYears: 0,
    talked: false,
  };
}

export function bandSkill(p: PlayerState): number {
  const ms = p.music.members;
  if (ms.length === 0) return p.skills.music;
  return (p.skills.music * 1.5 + ms.reduce((s, m) => s + m.skill, 0)) / (1.5 + ms.length);
}

export function chemistry(p: PlayerState): number {
  const ms = p.music.members;
  return ms.length === 0 ? 100 : Math.round(ms.reduce((s, m) => s + m.loyalty, 0) / ms.length);
}

/** Share of the band's songs credited to you. */
export function playerCredit(p: PlayerState): number {
  return clamp(100 - p.music.members.reduce((s, m) => s + (m.credit ?? 0), 0), 20, 100);
}

/** Your cut of whatever the act earns. */
export function playerShare(p: PlayerState): number {
  const n = p.music.members.length;
  if (n === 0) return 1;
  const equal = Math.max(0.3, 1 / (n + 1) + 0.08);
  if (p.music.split === "writers") return Math.max(0.25, (0.35 / (n + 1) + (0.65 * playerCredit(p)) / 100));
  return equal;
}

/** What one member of the band takes from a given pot, for display. */
export function memberShare(p: PlayerState, m: BandMember): number {
  const n = p.music.members.length;
  if (p.music.split === "writers") return 0.35 / (n + 1) + (0.65 * (m.credit ?? 0)) / 100;
  return (1 - playerShare(p)) / Math.max(1, n);
}

// ---------------------------------------------------------------------------
// Audience, catalogue, legacy
// ---------------------------------------------------------------------------

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

/** People an album can reach: fans first, then the wider scene and general fame. A label's marketing multiplies it. */
export function audienceFor(p: PlayerState): number {
  const m = p.music;
  const base = m.fans + 25 * m.localFame + 90 * p.fame;
  return Math.round(base * (m.signed ? 1.5 : 1));
}

/** A rough yearly value of the catalogue you own: the floor under every record plus half of what is still decaying. */
export function catalogueIncome(p: PlayerState): number {
  let sum = 0;
  for (const a of p.music.albums) {
    if (a.labelOwned || a.sold) continue;
    sum += (a.evergreen ?? 0) + 0.5 * Math.max(0, a.royalty - (a.evergreen ?? 0));
  }
  return Math.round(sum);
}

export const catalogueValue = (p: PlayerState): number => Math.round(catalogueIncome(p) * 7);

/** Masters the label owns that you could try to buy back, and what they want. */
export function masterBuybackPrice(p: PlayerState): number {
  let sum = 0;
  for (const a of p.music.albums) {
    if (!a.labelOwned || a.sold) continue;
    sum += 20_000 + 6 * ((a.evergreen ?? 0) + 0.5 * Math.max(0, a.royalty - (a.evergreen ?? 0)));
  }
  return Math.round(sum / 1000) * 1000;
}

/** How history will remember you: 0-100. */
export function legacyScore(p: PlayerState): number {
  const m = p.music;
  const certified = (rating: string) => m.albums.filter((a) => a.rating === rating).length;
  const score =
    m.hits * 5 +
    m.awards.length * 8 +
    certified("Gold") * 3 +
    certified("Platinum") * 6 +
    certified("Diamond") * 10 +
    Math.min(18, m.yearsActive * 0.6) +
    Math.max(0, Math.log10(Math.max(10, m.peakFans ?? m.fans)) - 3) * 6;
  return clamp(Math.round(score));
}

export function legacyTier(score: number): string {
  if (score < 12) return "Barely remembered";
  if (score < 30) return "Cult name";
  if (score < 55) return "Respected veteran";
  if (score < 80) return "Legend";
  return "Icon";
}

/** Burnout and bad press chew through the fans slower for loyal audiences. */
export function fanRetention(p: PlayerState, base: number): number {
  const d = p.celeb.devotion ?? 20;
  return 1 - (1 - base) * (1 - d * 0.004);
}
