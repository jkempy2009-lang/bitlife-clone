import type { PlayerState } from "@/types/game.types";
import { netWorth } from "@/engine/state";
import { money } from "@/lib/format";

export interface Challenge {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Forced starting background. */
  scenario: "average" | "wealthy" | "struggling" | "celebrity" | "royal";
  /** Must be achieved by this age, or the challenge is failed. */
  byAge: number;
  goal: string;
  achieved: (p: PlayerState) => boolean;
  /** Dying doesn't end it while a child can carry the family on. */
  survivesDeath?: boolean;
  /** One-line progress for the dashboard. */
  progress: (p: PlayerState) => string;
}

const crimeFree = (p: PlayerState) => p.stats.crimesCommitted === 0 && p.criminalRecord.length === 0;
const kids = (p: PlayerState) => p.relatives.filter((r) => r.relation === "Child").length;
const married = (p: PlayerState) => p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "married" && r.alive);
const degreeKinds = (p: PlayerState) => {
  const d = p.education.degrees;
  return (d.some((x) => x.startsWith("bachelor:")) ? 1 : 0) + (d.includes("masters") ? 1 : 0) + (d.includes("md") || d.includes("jd") ? 1 : 0);
};

export const CHALLENGES: Challenge[] = [
  {
    id: "rags", name: "Rags to Riches", emoji: "🥫", scenario: "struggling", byAge: 50,
    blurb: "Born into a struggling family with nothing. Build real wealth the hard way.",
    goal: "Reach a net worth of $1,000,000 by age 50.",
    achieved: (p) => netWorth(p) >= 1_000_000,
    progress: (p) => `Net worth ${money(netWorth(p))} / $1,000,000`,
  },
  {
    id: "power", name: "Rise to Power", emoji: "🏛️", scenario: "average", byAge: 75,
    blurb: "From the local council to the highest office in the land.",
    goal: "Become Head of State (or crown yourself monarch) by age 75.",
    achieved: (p) => (p.currentJob?.lineId === "politics" && p.currentJob.tier >= 4) || p.royalRank === "King" || p.royalRank === "Queen",
    progress: (p) => (p.currentJob?.lineId === "politics" ? `Currently: ${p.currentJob.title}` : "No office yet"),
  },
  {
    id: "mogul", name: "Business Mogul", emoji: "🏢", scenario: "average", byAge: 65,
    blurb: "Be your own boss and build something worth a fortune.",
    goal: "Own a business valued at $5,000,000 by age 65.",
    achieved: (p) => (p.business?.value ?? 0) >= 5_000_000,
    progress: (p) => (p.business ? `${p.business.name}: ${money(p.business.value)} / $5,000,000` : "No business yet"),
  },
  {
    id: "household", name: "Household Name", emoji: "🌟", scenario: "average", byAge: 55,
    blurb: "Be known by everyone, one way or another.",
    goal: "Reach 85 Fame by age 55.",
    achieved: (p) => p.fame >= 85,
    progress: (p) => `Fame ${Math.round(p.fame)} / 85`,
  },
  {
    id: "saint", name: "Pillar of the Community", emoji: "😇", scenario: "average", byAge: 60,
    blurb: "A good person with a good life: love, family, no crimes.",
    goal: "By 60: Karma 85+, married, at least two children, spotless record.",
    achieved: (p) => p.karma >= 85 && married(p) && kids(p) >= 2 && crimeFree(p) && p.age >= 40,
    progress: (p) => `Karma ${p.karma}/85 · ${married(p) ? "married" : "unmarried"} · ${kids(p)}/2 children · ${crimeFree(p) ? "clean record" : "record tarnished"}`,
  },
  {
    id: "scholar", name: "Renaissance Mind", emoji: "🎓", scenario: "average", byAge: 45,
    blurb: "Collect the whole academic set.",
    goal: "Earn a bachelor's, a master's and a medical or law degree by age 45.",
    achieved: (p) => degreeKinds(p) >= 3,
    progress: (p) => `${degreeKinds(p)}/3 qualifications`,
  },
  {
    id: "centenarian", name: "Centenarian", emoji: "🎂", scenario: "average", byAge: 100,
    blurb: "Take care of yourself. A long life is the hardest game of all.",
    goal: "Live to 100.",
    achieved: (p) => p.age >= 100,
    progress: (p) => `Age ${p.age} / 100`,
  },
  {
    id: "dynasty", name: "Dynasty", emoji: "👑", scenario: "wealthy", byAge: 400, survivesDeath: true,
    blurb: "One life isn't enough. Pass your legacy down.",
    goal: "Reach the third generation of your family with a $1,000,000 net worth.",
    achieved: (p) => p.generation >= 3 && netWorth(p) >= 1_000_000,
    progress: (p) => `Generation ${p.generation}/3 · net worth ${money(netWorth(p))}`,
  },
];

export const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
