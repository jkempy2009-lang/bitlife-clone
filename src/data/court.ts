/** Static tables for the royal court: patronages, household staff, military ladders, scandals, names. */
import type { ServiceBranch } from "@/types/game.types";

export interface PatronageInfo {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Approval earned per engagement for this cause. */
  approval: number;
  /** Other benefits of an engagement. */
  perk: { happiness?: number; karma?: number; fame?: number; health?: number; respect?: number; military?: number };
  perkText: string;
}

export const PATRONAGES: PatronageInfo[] = [
  { id: "children", name: "Children's hospice", emoji: "🧸", blurb: "Tender, uncontroversial, loved.", approval: 2, perk: { happiness: 1 }, perkText: "+1 Happiness" },
  { id: "mental", name: "Mental health foundation", emoji: "🧠", blurb: "A modern cause that opens people up.", approval: 2, perk: { happiness: 2 }, perkText: "+2 Happiness" },
  { id: "forces", name: "Armed forces & veterans", emoji: "🎖️", blurb: "Colonel-in-Chief of a regiment.", approval: 2, perk: { military: 1 }, perkText: "+1 Military" },
  { id: "wildlife", name: "Wildlife conservation", emoji: "🦏", blurb: "Photogenic and increasingly urgent.", approval: 1, perk: { karma: 2 }, perkText: "+2 Karma" },
  { id: "arts", name: "National theatre & arts", emoji: "🎭", blurb: "Opening nights and a good seat.", approval: 1, perk: { fame: 1 }, perkText: "+1 Fame" },
  { id: "homeless", name: "Homelessness charity", emoji: "🏚️", blurb: "Hard hours and real impact.", approval: 3, perk: { karma: 3 }, perkText: "+3 Karma" },
  { id: "sport", name: "National sporting association", emoji: "🏉", blurb: "Cups to present, crowds to wave at.", approval: 2, perk: { health: 1 }, perkText: "+1 Health" },
  { id: "heritage", name: "Heritage & restoration", emoji: "🏰", blurb: "Traditionalists approve.", approval: 1, perk: { respect: 2 }, perkText: "+2 Respect" },
];
export const PATRONAGE_BY_ID: Record<string, PatronageInfo> = Object.fromEntries(PATRONAGES.map((x) => [x.id, x]));

export const SECRETARIES = [
  { name: "No private office", cost: 0, hire: 0, blurb: "You manage your own diary and your own mistakes." },
  { name: "Press secretary", cost: 60_000, hire: 25_000, blurb: "Someone to answer the phones when the tabloids call. Better press handling." },
  { name: "Private secretary", cost: 160_000, hire: 60_000, blurb: "A seasoned courtier: sharper scandal handling, fewer gaffes, one more engagement day, and wiser audiences." },
  { name: "Full private office", cost: 360_000, hire: 140_000, blurb: "Communications team, equerries and a constitutional adviser. Two extra engagement days." },
] as const;

export const BRANCHES: Record<ServiceBranch, { name: string; emoji: string; ranks: string[] }> = {
  army: { name: "Army", emoji: "🪖", ranks: ["Officer Cadet", "Second Lieutenant", "Lieutenant", "Captain", "Major", "Lieutenant Colonel"] },
  navy: { name: "Royal Navy", emoji: "⚓", ranks: ["Midshipman", "Sub-Lieutenant", "Lieutenant", "Lieutenant Commander", "Commander", "Captain"] },
  air: { name: "Air Force", emoji: "✈️", ranks: ["Officer Cadet", "Pilot Officer", "Flying Officer", "Flight Lieutenant", "Squadron Leader", "Wing Commander"] },
};

export type ScandalNeed = "married" | "sovereign" | "notSovereign" | "serving";
export interface ScandalTemplate {
  id: string;
  title: string;
  story: string;
  severity: 1 | 2 | 3;
  minAge: number;
  need?: ScandalNeed;
  weight: number;
}

export const SCANDALS: ScandalTemplate[] = [
  { id: "photos", title: "Party photographs", story: "Photographs from a raucous house party are splashed across the front pages.", severity: 1, minAge: 16, weight: 3 },
  { id: "microphone", title: "Hot microphone", story: "An off-colour remark, caught on a live microphone, is playing on a loop on every channel.", severity: 1, minAge: 18, weight: 3 },
  { id: "feud", title: "Family feud", story: "A family quarrel spills into the papers through 'palace insiders'.", severity: 1, minAge: 18, weight: 2 },
  { id: "costume", title: "Fancy dress", story: "A photograph of you in an ill-judged fancy-dress costume has resurfaced to national outrage.", severity: 2, minAge: 16, weight: 1.5 },
  { id: "spending", title: "Refurbishment bill", story: "Leaked accounts show a lavish refurbishment bill for your residence, paid from public funds.", severity: 2, minAge: 25, weight: 2 },
  { id: "tax", title: "Offshore trust", story: "Leaked documents link part of your private fortune to an offshore trust.", severity: 2, minAge: 25, weight: 1.5 },
  { id: "bullying", title: "Toxic household", story: "Former staff allege a bullying culture in your household.", severity: 2, minAge: 22, weight: 1.5 },
  { id: "gambling", title: "Gambling losses", story: "Reports detail a string of enormous losses at private gaming tables.", severity: 2, minAge: 22, weight: 1 },
  { id: "affair", title: "Intimate phone call", story: "Transcripts of a very private, very intimate phone call have been leaked to a newspaper.", severity: 2, minAge: 24, need: "married", weight: 2 },
  { id: "friend", title: "Disgraced friend", story: "Your friendship with a disgraced financier is the subject of a damning investigation.", severity: 3, minAge: 30, need: "notSovereign", weight: 1 },
  { id: "interview", title: "Car-crash interview", story: "A television interview meant to clear the air has done the opposite: you appear to show no empathy at all.", severity: 3, minAge: 30, weight: 1 },
  { id: "meddling", title: "Leaked letters", story: "Private letters lobbying ministers on policy have been published. Questions are being asked about the constitution.", severity: 3, minAge: 30, need: "sovereign", weight: 1 },
  { id: "drill", title: "Service blunder", story: "A mistake on exercise embarrasses your regiment and makes the evening news.", severity: 1, minAge: 18, need: "serving", weight: 2 },
];

export const REALM_NAMES = [
  "Canada", "Australia", "New Zealand", "Jamaica", "The Bahamas", "Belize", "Grenada", "Papua New Guinea", "Solomon Islands", "Tuvalu",
  "Saint Lucia", "Saint Vincent and the Grenadines", "Antigua and Barbuda", "Saint Kitts and Nevis",
];
export const TERRITORY_NAMES = ["Aruba", "Curaçao", "Sint Maarten"];

export const TRADITIONAL_NAMES = {
  Male: ["George", "Edward", "Henry", "William", "Charles", "James", "Richard", "Alfred", "Frederick", "Albert"],
  Female: ["Victoria", "Elizabeth", "Anne", "Mary", "Matilda", "Eleanor", "Charlotte", "Alexandra", "Caroline", "Adelaide"],
};
export const INFAMOUS_NAMES = { Male: ["John", "Richard", "Stephen"], Female: ["Jane", "Mary", "Isabella"] };

/** Prime Minister name helper uses randomName; titles for the head of government. */
export const PM_TITLE = "Prime Minister";

export const STAFF_ROLES = ["private secretary", "equerry", "lady-in-waiting", "press officer"];

export const TRAINING_SCHOOLS = {
  tutors: { label: "Private tutors", cost: 20_000, blurb: "Sheltered and safe. Polished, but out of touch with ordinary children." },
  boarding: { label: "Elite boarding school", cost: 80_000, blurb: "Tradition and discipline. Builds duty and polish, but you will miss them." },
  state: { label: "Ordinary local school", cost: 0, blurb: "The common touch: they grow up knowing how everyone else lives. Less polish; more press intrusion." },
} as const;
