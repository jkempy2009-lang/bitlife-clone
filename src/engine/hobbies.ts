/** Hobbies: practise a craft, reach milestones, maybe turn it into income. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, setFlag } from "./state";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

interface Milestone {
  at: number;
  title: string;
  text: string;
  payout: number;
  fame: number;
  karma?: number;
  happiness?: number;
}

export interface HobbyDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  effects: string;
  /** Applied per practice session. */
  stats: { happiness?: number; health?: number; smarts?: number; looks?: number; athletics?: number };
  milestones: Milestone[];
  /** Yearly income per skill point once `incomeAt` is reached. */
  income?: { at: number; perPoint: number; label: string };
}

export const HOBBIES: HobbyDef[] = [
  {
    id: "painting", name: "Painting", emoji: "🎨", blurb: "Colour outside the lines.", effects: "+happiness",
    stats: { happiness: 3 },
    milestones: [
      { at: 60, title: "First Sale", text: "A collector bought one of your paintings.", payout: 3_000, fame: 1 },
      { at: 85, title: "Solo Exhibition", text: "A gallery gave you a solo show. Critics were kind.", payout: 40_000, fame: 6 },
    ],
    income: { at: 60, perPoint: 120, label: "commissions" },
  },
  {
    id: "writing", name: "Writing", emoji: "✍️", blurb: "Words are cheap. Good ones aren't.", effects: "+smarts",
    stats: { smarts: 1, happiness: 2 },
    milestones: [
      { at: 55, title: "Published!", text: "A magazine published your short story.", payout: 1_000, fame: 1 },
      { at: 80, title: "Bestselling Novel", text: "Your novel hit the bestseller list. Film rights are in talks.", payout: 150_000, fame: 10 },
    ],
    income: { at: 70, perPoint: 100, label: "royalties" },
  },
  {
    id: "chess", name: "Chess", emoji: "♟️", blurb: "64 squares of pure suffering.", effects: "+smarts",
    stats: { smarts: 2 },
    milestones: [
      { at: 65, title: "Tournament Win", text: "You won a regional chess tournament.", payout: 5_000, fame: 2 },
      { at: 90, title: "Grandmaster", text: "You earned the grandmaster title. People whisper your name in coffee shops.", payout: 50_000, fame: 8 },
    ],
  },
  {
    id: "cooking", name: "Cooking", emoji: "🍳", blurb: "Master the art of not burning dinner.", effects: "+health, +happiness",
    stats: { health: 1, happiness: 1 },
    milestones: [
      { at: 60, title: "Catering Gig", text: "Friends of friends hired you to cater a wedding.", payout: 4_000, fame: 1 },
      { at: 85, title: "Cookbook Deal", text: "A publisher offered you a cookbook deal.", payout: 60_000, fame: 5 },
    ],
  },
  {
    id: "gardening", name: "Gardening", emoji: "🌱", blurb: "Watch things grow. Slowly.", effects: "+happiness, +health",
    stats: { happiness: 3, health: 1 },
    milestones: [
      { at: 60, title: "Blue Ribbon", text: "Your roses won first prize at the county fair.", payout: 500, fame: 0, karma: 3 },
      { at: 85, title: "Garden Tour", text: "Your garden was featured on a regional tour. Visitors left glowing reviews.", payout: 5_000, fame: 2, happiness: 6 },
    ],
  },
  {
    id: "photography", name: "Photography", emoji: "📷", blurb: "Catch the moment.", effects: "+happiness",
    stats: { happiness: 2, looks: 0 },
    milestones: [
      { at: 60, title: "Print Sale", text: "A magazine bought one of your photographs.", payout: 2_000, fame: 1 },
      { at: 85, title: "Gallery Show", text: "A gallery displayed your photography series.", payout: 30_000, fame: 4 },
    ],
    income: { at: 65, perPoint: 90, label: "stock photo sales" },
  },
  {
    id: "coding", name: "Coding", emoji: "💻", blurb: "Debug your way to enlightenment.", effects: "+smarts",
    stats: { smarts: 2 },
    milestones: [
      { at: 75, title: "Viral Open Source", text: "Your open-source project took off. Sponsors lined up.", payout: 10_000, fame: 5 },
      { at: 92, title: "Acquired!", text: "A big company acquired your app.", payout: 200_000, fame: 6 },
    ],
    income: { at: 60, perPoint: 250, label: "freelance work" },
  },
  {
    id: "martial", name: "Martial Arts", emoji: "🥋", blurb: "Discipline in white pyjamas.", effects: "+health, +athletics",
    stats: { health: 2, looks: 1, athletics: 2 },
    milestones: [
      { at: 60, title: "Black Belt", text: "You earned your black belt. Confidence +10.", payout: 0, fame: 1, happiness: 10 },
      { at: 85, title: "Champion", text: "You won a national martial arts championship.", payout: 20_000, fame: 5 },
    ],
  },
];

export const HOBBY_BY_ID: Record<string, HobbyDef> = Object.fromEntries(HOBBIES.map((h) => [h.id, h]));
export const MAX_HOBBY_SESSIONS = 3;

export function practiceHobby(p0: PlayerState, id: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const h = HOBBY_BY_ID[id];
  if (!h) return { player: p0 };
  if (p.age < 6) return { player: p0, notices: [info("Too Young", "Come back in a few years.")] };
  if (p.isInPrison) return { player: p0, notices: [info("Behind Bars", "No hobbies in the cell block.")] };
  if ((p.annual[`hobby:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Practised Out", `You've already put in your ${h.name.toLowerCase()} time this year.`)] };
  if ((p.annual.hobbies ?? 0) >= MAX_HOBBY_SESSIONS) return { player: p0, notices: [info("Out of Time", `You can only commit to ${MAX_HOBBY_SESSIONS} hobbies per year.`)] };
  p.annual[`hobby:${id}`] = 1;
  p.annual.hobbies = (p.annual.hobbies ?? 0) + 1;
  const gain = rng.int(5, 10) + Math.floor((p.smarts - 50) / 25);
  const before = p.hobbies[id] ?? 0;
  p.hobbies[id] = clamp(before + Math.max(3, gain));
  changeStat(p, "happiness", h.stats.happiness ?? 0);
  changeStat(p, "health", h.stats.health ?? 0);
  changeStat(p, "smarts", h.stats.smarts ?? 0);
  changeStat(p, "looks", h.stats.looks ?? 0);
  if (h.stats.athletics) p.skills.athletics = clamp(p.skills.athletics + h.stats.athletics);
  const body = before === 0 ? `You took up ${h.name.toLowerCase()}. Skill: ${p.hobbies[id]}.` : `You practised ${h.name.toLowerCase()}. Skill ${before} → ${p.hobbies[id]}.`;
  addLog(p, body);
  return { player: p, notices: [info(h.name, body, "good")] };
}

export function hobbyIncome(p: PlayerState): number {
  let total = 0;
  for (const h of HOBBIES) {
    const skill = p.hobbies[h.id] ?? 0;
    if (h.income && skill >= h.income.at) total += skill * h.income.perPoint;
  }
  return Math.round(total);
}

/** Yearly: unpractised skills fade, milestones pay out. `prevAnnual` is last year's action counters. */
export function processHobbies(p: PlayerState, prevAnnual: Record<string, number>, notices: Notices) {
  for (const h of HOBBIES) {
    const skill = p.hobbies[h.id] ?? 0;
    if (skill <= 0) continue;
    if (!prevAnnual[`hobby:${h.id}`]) p.hobbies[h.id] = Math.max(0, skill - 2);
    for (const m of h.milestones) {
      const flag = `hm:${h.id}:${m.at}`;
      if (p.hobbies[h.id] >= m.at && !p.flags.includes(flag)) {
        setFlag(p, flag);
        p.bankBalance += m.payout;
        changeStat(p, "fame", m.fame);
        changeStat(p, "karma", m.karma ?? 0);
        changeStat(p, "happiness", m.happiness ?? 4);
        const body = `${m.text}${m.payout ? ` You earned ${money(m.payout)}.` : ""}`;
        addLog(p, `${h.emoji} ${m.title}: ${body}`);
        notices.push(info(`${h.emoji} ${m.title}`, body, m.at >= 80 ? "jackpot" : "good"));
      }
    }
  }
}
