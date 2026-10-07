/**
 * Online fame: a creator career with a platform and niche, a posting cadence driven by your
 * effort and free hours, audience quality, brand contracts, merch and memberships, algorithm
 * shifts, controversies and bans.
 */
import type { ActionResult, Platform, PlayerState, SponsorDeal } from "@/types/game.types";
import { hashString, type Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, setFlag } from "./state";
import { blockerFor } from "./occupation";
import { info, outputFor, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface PlatformInfo {
  id: Platform;
  label: string;
  emoji: string;
  blurb: string;
  /** Follower growth multiplier. */
  growth: number;
  /** Ad revenue multiplier. */
  ads: number;
  /** Sponsorship rate multiplier. */
  sponsor: number;
  /** Chance per year of an algorithm shake-up. */
  volatility: number;
}

export const PLATFORMS: PlatformInfo[] = [
  { id: "video", label: "Long-form video", emoji: "🎥", blurb: "Slow to grow, pays best from ads. Needs craft.", growth: 1, ads: 1, sponsor: 1, volatility: 0.12 },
  { id: "shorts", label: "Short clips", emoji: "📲", blurb: "Explosive growth but thin ad money and a fickle algorithm.", growth: 1.35, ads: 0.4, sponsor: 0.8, volatility: 0.24 },
  { id: "stream", label: "Live streaming", emoji: "🔴", blurb: "Intense and loyal. Great memberships, brutal hours.", growth: 0.85, ads: 0.7, sponsor: 1, volatility: 0.12 },
  { id: "photo", label: "Photo feed", emoji: "📸", blurb: "Little ad income, but brands love it. Looks matter.", growth: 0.9, ads: 0.3, sponsor: 1.4, volatility: 0.16 },
  { id: "podcast", label: "Podcast", emoji: "🎙️", blurb: "Small, loyal audiences that listen for years.", growth: 0.75, ads: 0.8, sponsor: 1.2, volatility: 0.06 },
];
export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map((x) => [x.id, x])) as Record<Platform, PlatformInfo>;

export interface NicheInfo {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** The stat your content quality leans on. */
  skill: "looks" | "smarts" | "charisma" | "athletics" | "music" | "acting";
  growth: number;
  /** Extra yearly scandal risk. */
  risk: number;
}

export const NICHES: NicheInfo[] = [
  { id: "gaming", label: "Gaming", emoji: "🎮", blurb: "Huge, crowded, forgiving. Charisma carries it.", skill: "charisma", growth: 1.05, risk: 0.02 },
  { id: "comedy", label: "Comedy", emoji: "😂", blurb: "Hard to be funny every week, easy to offend someone.", skill: "acting", growth: 1.15, risk: 0.04 },
  { id: "beauty", label: "Beauty & fashion", emoji: "💄", blurb: "Looks drive it. Brands pay well.", skill: "looks", growth: 1.0, risk: 0.02 },
  { id: "fitness", label: "Fitness", emoji: "🏋️", blurb: "A strong body is the product.", skill: "athletics", growth: 0.95, risk: 0.02 },
  { id: "tech", label: "Tech & education", emoji: "🧠", blurb: "Smart audiences, slow growth, loyal viewers.", skill: "smarts", growth: 0.85, risk: 0.01 },
  { id: "music", label: "Music covers", emoji: "🎸", blurb: "Talent shows. Copyright strikes too.", skill: "music", growth: 1.0, risk: 0.02 },
  { id: "lifestyle", label: "Lifestyle & vlogs", emoji: "🏡", blurb: "Be yourself. Everybody does.", skill: "charisma", growth: 0.9, risk: 0.02 },
  { id: "commentary", label: "Drama & commentary", emoji: "🗣️", blurb: "Fast growth, fast enemies.", skill: "smarts", growth: 1.25, risk: 0.07 },
];
export const NICHE_BY_ID = Object.fromEntries(NICHES.map((x) => [x.id, x])) as Record<string, NicheInfo>;

export const CREATOR_TIERS: Array<{ min: number; label: string }> = [
  { min: 0, label: "Nobody (yet)" },
  { min: 1_000, label: "Local Face" },
  { min: 10_000, label: "Micro-Influencer" },
  { min: 100_000, label: "Rising Creator" },
  { min: 500_000, label: "Name Brand" },
  { min: 1_000_000, label: "Mega-Creator" },
  { min: 10_000_000, label: "Global Icon" },
];

export function creatorTier(followers: number): string {
  let label = CREATOR_TIERS[0].label;
  for (const t of CREATOR_TIERS) if (followers >= t.min) label = t.label;
  return label;
}

export const MONETISATION = { ads: 1_000, deals: 3_000, premium: 10_000, merch: 20_000 } as const;

const BRANDS = ["GlowUp Cosmetics", "TurboVPN", "FreshBox Meals", "NorthPeak Outdoor", "ByteGear", "PureLeaf Tea", "Stride Sneakers", "QuickLoan Pro", "MegaWhey", "SnapPhone", "Lumen Lamps", "HyperEnergy"];
const SHADY_BRANDS = ["MiracleSlim Pills", "CryptoMoonCoin", "BetBlitz Casino", "Flash Loans Direct", "DetoxTea Plus"];

export const maxDeals = (followers: number) => 1 + (followers >= 50_000 ? 1 : 0) + (followers >= 500_000 ? 1 : 0);

// ---------------------------------------------------------------------------
// Derived values (used by the UI and the yearly tick)
// ---------------------------------------------------------------------------

export function creatorQuality(p: PlayerState): number {
  const inf = p.influencer;
  const niche = NICHE_BY_ID[inf.niche] ?? NICHES[0];
  const nicheStat = niche.skill === "smarts" ? p.smarts : niche.skill === "looks" ? p.looks : p.skills[niche.skill];
  const q = 15 + 0.2 * p.skills.charisma + 0.35 * inf.craft + 0.25 * nicheStat + 0.1 * p.smarts - (inf.burnout >= 60 ? (inf.burnout - 50) * 0.4 : 0);
  return clamp(Math.round(q));
}

const skillFactor = (q: number) => 0.25 + 1.5 * Math.pow(q / 100, 1.5);

/**
 * How well this channel's format happens to click with audiences: a hidden, persistent roll tied to the
 * person, platform and niche. Most fits are mediocre, a few are magic, and rebranding re-rolls it.
 */
export function channelFit(p: PlayerState): number {
  const u = (hashString(`${p.id}:${p.influencer.platform}:${p.influencer.niche}`) % 10_000) / 10_000;
  return 0.45 + 1.6 * u * u;
}

function growthModifiers(p: PlayerState): number {
  const inf = p.influencer;
  const plat = PLATFORM_BY_ID[inf.platform];
  const niche = NICHE_BY_ID[inf.niche] ?? NICHES[0];
  const algo = inf.algorithm === "boost" ? 1.35 : inf.algorithm === "suppress" ? 0.6 : 1;
  const trend = inf.niche === inf.trend ? 1.25 : 1;
  return plat.growth * niche.growth * algo * trend * channelFit(p) * (0.8 + inf.engagement / 250);
}

/** Expected followers added next Age Up at current settings, for the dashboard. */
export function projectedGrowth(p: PlayerState): number {
  const inf = p.influencer;
  const q = creatorQuality(p) / 100;
  const output = Math.max(0.05, outputFor(p, "creator"));
  const satur = 1 / (1 + inf.followers / 60_000);
  const gain = (150 + inf.followers * 0.4 * satur) * Math.pow(Math.min(output, 1.4), 1.1) * skillFactor(q * 100) * growthModifiers(p);
  const churn = inf.followers * (baseChurn(inf) + (inf.cadence < 35 ? 0.06 + ((35 - inf.cadence) / 35) * 0.12 : 0));
  return Math.round(gain * ageFade(p) - churn);
}

/** Followers who drift away every year even if you do everything right. */
const baseChurn = (inf: PlayerState["influencer"]) => 0.1 - (inf.engagement > 60 ? 0.03 : 0);
/** Younger audiences chase younger creators. */
const ageFade = (p: PlayerState) => (p.age > 40 ? Math.max(0.4, 1 - (p.age - 40) * 0.012) : 1);

export function adIncome(p: PlayerState): number {
  const inf = p.influencer;
  if (inf.followers < MONETISATION.ads || inf.bannedYears > 0) return 0;
  return Math.round(inf.followers * 0.28 * (inf.engagement / 55) * clamp(inf.cadence / 45, 0, 1.1) * PLATFORM_BY_ID[inf.platform].ads);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function startChannel(p0: PlayerState, rng: Rng, opts: { platform?: Platform; niche?: string } = {}): ActionResult {
  const p = clone(p0);
  if (p.age < 10) return { player: p0, notices: [info("Too Young", "Ask your parents again in a few years.")] };
  if (p.influencer.active) return { player: p0 };
  const platform = opts.platform && PLATFORM_BY_ID[opts.platform] ? opts.platform : "video";
  const niche = opts.niche && NICHE_BY_ID[opts.niche] ? opts.niche : "lifestyle";
  const inf = p.influencer;
  inf.active = true;
  inf.followers = rng.int(20, 200);
  inf.lastPostYear = p.year;
  inf.platform = platform;
  inf.niche = niche;
  inf.engagement = rng.int(45, 60);
  inf.authenticity = rng.int(55, 70);
  inf.cadence = 40;
  inf.peakFollowers = inf.followers;
  inf.followerHistory = [inf.followers];
  inf.trend = rng.pick(NICHES).id;
  setFlag(p, "influencer");
  const body = `You launched a ${PLATFORM_BY_ID[platform].label.toLowerCase()} channel about ${NICHE_BY_ID[niche].label.toLowerCase()}. ${inf.followers} people followed, mostly family. Growth now depends on how many hours you can give it and how hard you push.`;
  addLog(p, body);
  return { player: p, notices: [info("Channel Launched", body, "good")] };
}

export function postContent(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active) return { player: p0 };
  if (inf.bannedYears > 0) return { player: p0, notices: [info("Suspended", "Your channel is banned. Appeal or wait it out.", "bad")] };
  if ((p.annual.post ?? 0) >= 1) return { player: p0, notices: [info("Algorithm Fatigue", "You've already poured everything into one flagship project this year.")] };
  p.annual.post = 1;
  inf.lastPostYear = p.year;
  const q = creatorQuality(p) / 100;
  const viral = rng.chance(0.05 + q * 0.14);
  const satur = 1 / (1 + inf.followers / 60_000);
  const base = (150 + inf.followers * 0.12 * satur) * skillFactor(q * 100) * growthModifiers(p) * rng.float(0.6, 1.5);
  const gained = Math.max(30, Math.round(base * (viral ? rng.float(2.5, 8) : 1)));
  inf.followers += gained;
  inf.peakFollowers = Math.max(inf.peakFollowers, inf.followers);
  inf.craft = clamp(inf.craft + 1.5);
  inf.burnout = clamp(inf.burnout + 6);
  if (viral) {
    inf.viralHits += 1;
    inf.engagement = clamp(inf.engagement - 4);
  }
  p.skills.charisma = clamp(p.skills.charisma + 1);
  changeStat(p, "happiness", viral ? 5 : 1);
  const body = viral
    ? `Your flagship video went VIRAL! +${gained.toLocaleString()} followers (${inf.followers.toLocaleString()} total). Many of them won't stick around.`
    : `Your flagship project found an audience: +${gained.toLocaleString()} followers (${inf.followers.toLocaleString()} total). It cost you sleep (burnout +6).`;
  addLog(p, body);
  return { player: p, notices: [info(viral ? "VIRAL!" : "Flagship Content", body, viral ? "jackpot" : "good")] };
}

/** A one-off sponsored post. Quick cash, small authenticity cost. */
export function brandCollab(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active || inf.followers < MONETISATION.deals) return { player: p0, notices: [info("Not Yet", `Brands start calling at ${MONETISATION.deals.toLocaleString()} followers.`)] };
  if (inf.bannedYears > 0) return { player: p0, notices: [info("Suspended", "Brands won't touch a banned channel.", "bad")] };
  if ((p.annual.collab ?? 0) >= 1) return { player: p0, notices: [info("Booked Solid", "You've already done a one-off sponsored post this year.")] };
  p.annual.collab = 1;
  const pay = Math.round(inf.followers * 0.05 * (inf.engagement / 55) * PLATFORM_BY_ID[inf.platform].sponsor);
  p.bankBalance += Math.round(pay * 0.75);
  inf.authenticity = clamp(inf.authenticity - 2);
  inf.income.deals += pay;
  const body = `A brand paid you ${money(pay)} (${money(Math.round(pay * 0.75))} after withholding) for a sponsored post. Followers noticed it was an ad (authenticity -2).`;
  addLog(p, body);
  return { player: p, notices: [info("Sponsored Post", body, "good")] };
}

export function switchFocus(p0: PlayerState, rng: Rng, opts: { platform?: Platform; niche?: string }): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active) return { player: p0 };
  const newPlatform = opts.platform && opts.platform !== inf.platform ? opts.platform : null;
  const newNiche = opts.niche && opts.niche !== inf.niche ? opts.niche : null;
  if (!newPlatform && !newNiche) return { player: p0, notices: [info("No Change", "Pick a different platform or niche.")] };
  if ((p.annual.switch ?? 0) >= 1) return { player: p0, notices: [info("Pace Yourself", "You already rebranded this year.")] };
  p.annual.switch = 1;
  const loss = newPlatform && newNiche ? 0.7 : newPlatform ? 0.5 : 0.4;
  const before = inf.followers;
  inf.followers = Math.round(inf.followers * (1 - loss * rng.float(0.85, 1.15)));
  inf.engagement = clamp(inf.engagement - 12);
  inf.craft = Math.round(inf.craft * 0.85);
  if (newPlatform) inf.platform = newPlatform;
  if (newNiche) inf.niche = newNiche;
  const body = `You rebranded. ${(before - inf.followers).toLocaleString()} followers didn't follow you to the new ${newPlatform && newNiche ? "platform and niche" : newPlatform ? "platform" : "niche"}. Engagement took a hit while you find your feet.`;
  addLog(p, body);
  return { player: p, notices: [info("Rebrand", body, "neutral")] };
}

/** Make the channel your job. `quit` hands in your notice at the same time. */
export function goFullTimeCreator(p0: PlayerState, quit = false): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active || inf.fullTime) return { player: p0 };
  if (p.age < 16) return { player: p0, notices: [info("Too Young", "Finish growing up first.")] };
  if (p.currentJob && !quit) return { player: p0, notices: [info("Quit First", `You can't be a full-time creator and a ${p.currentJob.title}.`, "bad")] };
  const trial = quit && p.currentJob ? { ...p, currentJob: null } : p;
  const blocked = blockerFor(trial, "creator");
  if (blocked) return { player: p0, notices: [info("Can't Go Full-Time", blocked, "bad")] };
  if (p.currentJob) {
    addLog(p, `You quit your job as a ${p.currentJob.title} to create full time.`);
    p.currentJob = null;
    p.annualSalary = 0;
  }
  inf.fullTime = true;
  const body = "You went full-time. Every hour is yours to fill, and so is every bill. Growth and income now depend entirely on the channel.";
  addLog(p, body);
  return { player: p, notices: [info("Full-Time Creator", body, "good")] };
}

export function stepBackCreator(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.influencer.fullTime) return { player: p0 };
  p.influencer.fullTime = false;
  const body = "You stepped back to creating part-time. You're free to take a job again, but your output will drop.";
  addLog(p, body);
  return { player: p, notices: [info("Part-Time Again", body)] };
}

export function takeBreak(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active) return { player: p0 };
  if (inf.onBreak) return { player: p0, notices: [info("Already Resting", "You're already taking this year off posting.")] };
  inf.onBreak = true;
  inf.burnout = clamp(inf.burnout - 30);
  changeStat(p, "happiness", 4);
  const body = "You announced a hiatus. Burnout eases, but the algorithm and your audience will notice the silence.";
  addLog(p, body);
  return { player: p, notices: [info("Hiatus", body)] };
}

function findOffer(p: PlayerState, id: string): SponsorDeal | undefined {
  return p.influencer.offers.find((o) => o.id === id);
}

function signDeal(p: PlayerState, deal: SponsorDeal): string | null {
  const inf = p.influencer;
  if (inf.deals.length >= maxDeals(inf.followers)) return `You can only juggle ${maxDeals(inf.followers)} sponsor contract${maxDeals(inf.followers) > 1 ? "s" : ""} at your size.`;
  inf.offers = inf.offers.filter((o) => o.id !== deal.id);
  inf.deals.push(deal);
  return null;
}

export function acceptDeal(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const deal = findOffer(p, id);
  if (!deal) return { player: p0 };
  const err = signDeal(p, deal);
  if (err) return { player: p0, notices: [info("Contract Limit", err, "bad")] };
  const body = `You signed with ${deal.brand}: ${money(deal.pay)} a year for ${deal.yearsLeft} year${deal.yearsLeft > 1 ? "s" : ""}. You must keep output at ${Math.round(deal.minOutput * 100)}% or better.`;
  addLog(p, body);
  return { player: p, notices: [info("Deal Signed", body, "good")] };
}

export function negotiateDeal(p0: PlayerState, rng: Rng, id: string): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  const deal = findOffer(p, id);
  if (!deal) return { player: p0 };
  if ((p.annual[`haggle:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Pushed", "They won't move again.")] };
  p.annual[`haggle:${id}`] = 1;
  const chance = clamp(0.4 + (inf.engagement - 50) / 200 + (inf.authenticity - 50) / 300 + Math.log10(Math.max(10, inf.followers)) * 0.02, 0.15, 0.8);
  if (rng.chance(chance)) {
    deal.pay = Math.round(deal.pay * 1.25);
    deal.authCost = Math.max(0, deal.authCost - 1);
    const err = signDeal(p, deal);
    if (err) return { player: p0, notices: [info("Contract Limit", err, "bad")] };
    const body = `You pushed back and ${deal.brand} came up to ${money(deal.pay)} a year with a lighter obligation.`;
    addLog(p, body);
    return { player: p, notices: [info("Negotiated", body, "good")] };
  }
  if (rng.chance(0.5)) {
    inf.offers = inf.offers.filter((o) => o.id !== id);
    const body = `${deal.brand} walked away from the table. That money's gone.`;
    addLog(p, body);
    return { player: p, notices: [info("Deal Lost", body, "bad")] };
  }
  return { player: p, notices: [info("No Movement", `${deal.brand} won't budge, but the original offer still stands.`)] };
}

export function declineDeal(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const deal = findOffer(p, id);
  if (!deal) return { player: p0 };
  p.influencer.offers = p.influencer.offers.filter((o) => o.id !== id);
  if (deal.shady) p.influencer.authenticity = clamp(p.influencer.authenticity + 2);
  return { player: p, notices: [info("Declined", `You turned down ${deal.brand}.${deal.shady ? " Your audience would have noticed if you hadn't (authenticity +2)." : ""}`)] };
}

export const merchCost = (p: PlayerState) => Math.max(3_000, Math.round(p.influencer.followers * 0.04));

export function launchMerch(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active || inf.merch) return { player: p0 };
  if (inf.followers < MONETISATION.merch) return { player: p0, notices: [info("Too Early", `Merch needs ${MONETISATION.merch.toLocaleString()} followers.`)] };
  const cost = merchCost(p);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `Stocking a merch line costs ${money(cost)}.`, "bad")] };
  p.bankBalance -= cost;
  inf.merch = true;
  const body = `You launched a merch line for ${money(cost)}. Sales depend on how loyal your audience is.`;
  addLog(p, body);
  return { player: p, notices: [info("Merch Launched", body, "good")] };
}

export function toggleMemberships(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active) return { player: p0 };
  if (!inf.premium && inf.followers < MONETISATION.premium) return { player: p0, notices: [info("Too Early", `Memberships need ${MONETISATION.premium.toLocaleString()} followers.`)] };
  inf.premium = !inf.premium;
  if (!inf.premium) inf.subscribers = 0;
  const body = inf.premium
    ? "You opened paid memberships. Subscribers expect regular exclusive content, and some will want far too much of you."
    : "You closed memberships.";
  addLog(p, body);
  return { player: p, notices: [info(inf.premium ? "Memberships Open" : "Memberships Closed", body)] };
}

export function buyFollowers(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active || inf.followers < 500) return { player: p0, notices: [info("Not Worth It", "Fake followers need a real audience to hide among.")] };
  if ((p.annual.buy ?? 0) >= 1) return { player: p0 };
  const cost = 300 + Math.round(inf.followers * 0.03);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `That costs ${money(cost)}.`, "bad")] };
  p.annual.buy = 1;
  p.bankBalance -= cost;
  const gained = Math.round(inf.followers * 0.25 + 1500);
  inf.followers += gained;
  inf.peakFollowers = Math.max(inf.peakFollowers, inf.followers);
  inf.engagement = clamp(inf.engagement - 18);
  inf.authenticity = clamp(inf.authenticity - 10);
  inf.boughtFollowers = true;
  const notices: Notices = [];
  const body = `You paid ${money(cost)} for ${gained.toLocaleString()} bot followers. Your number looks great and your engagement looks terrible.`;
  addLog(p, body);
  notices.push(info("Bought Followers", body, "neutral"));
  if (rng.chance(0.22)) raiseScandal(p, "influencer", rng, notices, 2);
  return { player: p, notices };
}

export function appealBan(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (inf.bannedYears <= 0) return { player: p0 };
  if ((p.annual.appeal ?? 0) >= 1) return { player: p0, notices: [info("Pending", "You've already appealed this year.")] };
  if (p.bankBalance < 1_500) return { player: p0, notices: [info("Can't Afford It", "A lawyer's appeal letter costs $1,500.", "bad")] };
  p.annual.appeal = 1;
  p.bankBalance -= 1_500;
  if (rng.chance(clamp(0.25 + inf.authenticity / 200, 0.2, 0.7))) {
    inf.bannedYears = 0;
    const body = "Your appeal worked. The channel is back, though the audience has aged out a little.";
    addLog(p, body);
    return { player: p, notices: [info("Reinstated", body, "good")] };
  }
  return { player: p, notices: [info("Appeal Denied", "The platform stood by its decision.", "bad")] };
}

// ---------------------------------------------------------------------------
// Yearly tick
// ---------------------------------------------------------------------------

function newOffers(p: PlayerState, rng: Rng): SponsorDeal[] {
  const inf = p.influencer;
  if (inf.followers < MONETISATION.deals || inf.engagement < 25 || inf.bannedYears > 0) return [];
  const count = inf.followers >= 50_000 ? rng.int(1, 3) : rng.chance(0.6) ? rng.int(1, 2) : 0;
  const offers: SponsorDeal[] = [];
  const sponsor = PLATFORM_BY_ID[inf.platform].sponsor;
  for (let i = 0; i < count; i++) {
    const shady = rng.chance(0.25);
    const base = inf.followers * 0.1 * (inf.engagement / 55) * sponsor * rng.float(0.7, 1.4);
    offers.push({
      id: rng.id(),
      brand: rng.pick(shady ? SHADY_BRANDS : BRANDS),
      pay: Math.max(300, Math.round(shady ? base * 1.5 : base)),
      yearsLeft: rng.int(1, 3),
      minOutput: shady ? Number(rng.float(0.3, 0.6).toFixed(2)) : Number(rng.float(0.35, 0.9).toFixed(2)),
      authCost: shady ? rng.int(6, 9) : rng.int(1, 4),
      shady,
    });
  }
  return offers;
}

/** Returns the year's gross (taxable) platform income. Costs are paid straight from the bank. */
export function processInfluencer(p: PlayerState, rng: Rng, notices: Notices): number {
  const inf = p.influencer;
  if (!inf.active) return 0;
  inf.yearsActive += 1;
  inf.offers = [];
  inf.income = { ads: 0, deals: 0, subs: 0, merch: 0, costs: 0 };

  // Algorithm and trend shifts
  if (inf.algoYears > 0) {
    inf.algoYears -= 1;
    if (inf.algoYears === 0) inf.algorithm = "neutral";
  } else if (rng.chance(PLATFORM_BY_ID[inf.platform].volatility)) {
    inf.algorithm = rng.chance(0.4) ? "boost" : "suppress";
    inf.algoYears = rng.int(2, 3);
    notices.push(
      info(
        inf.algorithm === "boost" ? "Algorithm Boost" : "Algorithm Shake-Up",
        inf.algorithm === "boost"
          ? "A platform update favours channels like yours. Growth should be better for a couple of years."
          : "A platform update buried channels like yours. Growth will be harder for a couple of years.",
        inf.algorithm === "boost" ? "good" : "bad",
      ),
    );
  }
  if (rng.chance(0.3)) {
    inf.trend = rng.pick(NICHES).id;
    if (inf.trend === inf.niche) notices.push(info("You're Trending", `The platform is pushing ${NICHE_BY_ID[inf.niche].label.toLowerCase()} content this year. That's your niche.`, "good"));
  }

  // Banned: the audience drifts away
  if (inf.bannedYears > 0) {
    inf.bannedYears -= 1;
    inf.followers = Math.round(inf.followers * 0.88);
    inf.cadence = Math.round(inf.cadence * 0.5);
    changeStat(p, "happiness", -2);
    if (inf.bannedYears === 0) notices.push(info("Back Online", "Your suspension ended. Time to rebuild.", "neutral"));
    inf.followerHistory = [...inf.followerHistory, inf.followers].slice(-15);
    return 0;
  }

  // Effort and hours become output
  let output = outputFor(p, "creator");
  if (inf.onBreak) {
    output = 0.1;
    inf.onBreak = false;
  }
  const burnDelta = output > 1.15 ? (output - 1.15) * 20 : output < 0.75 ? -8 : -3;
  inf.burnout = clamp(inf.burnout + burnDelta + (inf.premium ? 2 : 0) + inf.deals.length * 1.5);
  if (inf.burnout >= 95 || (inf.burnout >= 80 && rng.chance(0.3))) {
    output = 0.15;
    inf.burnout = 40;
    p.effort = "steady";
    changeStat(p, "happiness", -10);
    changeStat(p, "health", -6);
    const body = "You hit a wall. After months of forcing content out, you stopped posting and couldn't open the editing software. Your effort has been reset to Steady.";
    addLog(p, body);
    notices.push(info("Creator Burnout", body, "bad"));
  } else if (inf.burnout >= 70) {
    changeStat(p, "health", -2);
    changeStat(p, "happiness", -3);
  }
  inf.cadence = Math.round(inf.cadence * 0.5 + Math.min(100, output * 65) * 0.5);
  inf.craft = clamp(inf.craft + output * 2.6 * (1 - inf.craft / 120));
  if (output >= 0.5) inf.lastPostYear = p.year;

  // Growth
  const q = creatorQuality(p) / 100;
  const satur = 1 / (1 + inf.followers / 60_000);
  const viral = rng.chance(0.01 + 0.07 * q * q * Math.min(output, 1.3));
  let gained = ageFade(p) * (150 + inf.followers * 0.4 * satur) * Math.pow(Math.min(output, 1.4), 1.1) * skillFactor(q * 100) * growthModifiers(p) * rng.float(0.3, 1.7);
  if (viral) {
    gained += inf.followers * rng.float(0.3, 1.5) + rng.int(1_000, 20_000) * skillFactor(q * 100);
    inf.viralHits += 1;
    inf.engagement = clamp(inf.engagement - 6);
    notices.push(info("Viral Moment", "One of your posts exploded far beyond your audience. Plenty of strangers followed, though not all will stay.", "jackpot"));
  }
  const churn = inf.followers * (baseChurn(inf) + (inf.cadence < 35 ? 0.06 + ((35 - inf.cadence) / 35) * 0.12 : 0));
  inf.followers = Math.max(0, Math.round(inf.followers + gained - churn));
  inf.peakFollowers = Math.max(inf.peakFollowers, inf.followers);

  // Audience quality and trust
  const target = 35 + 0.4 * q * 100 + 0.2 * inf.authenticity - inf.deals.length * 4 - (inf.boughtFollowers ? 20 : 0) - Math.max(0, Math.log10(Math.max(1, inf.followers)) - 5) * 4;
  inf.engagement = clamp(Math.round(inf.engagement + (target - inf.engagement) * 0.3 + rng.int(-2, 2)));
  if (inf.deals.length === 0 && inf.cadence >= 50) inf.authenticity = clamp(inf.authenticity + 2);

  // Sponsor contracts: obligations first
  let dealIncome = 0;
  for (const d of [...inf.deals]) {
    if (output < d.minOutput) {
      inf.deals = inf.deals.filter((x) => x.id !== d.id);
      inf.authenticity = clamp(inf.authenticity - 8);
      const body = `You didn't produce enough to honour your ${d.brand} contract (needed ${Math.round(d.minOutput * 100)}% output, managed ${Math.round(output * 100)}%). They cancelled and told other brands.`;
      addLog(p, body);
      notices.push(info("Contract Breach", body, "bad"));
      continue;
    }
    dealIncome += d.pay;
    inf.authenticity = clamp(inf.authenticity - d.authCost);
    d.yearsLeft -= 1;
    if (d.shady && rng.chance(0.1)) raiseScandal(p, "influencer", rng, notices, 2);
    if (d.yearsLeft <= 0) {
      inf.deals = inf.deals.filter((x) => x.id !== d.id);
      addLog(p, `Your ${d.brand} contract ended.`);
    }
  }

  // Revenue streams
  const ads = adIncome(p);
  let subs = 0;
  if (inf.premium) {
    const target2 = inf.followers * 0.004 * (inf.engagement / 50) * (inf.cadence >= 40 ? 1 : 0.5);
    inf.subscribers = Math.round(inf.subscribers * 0.4 + target2 * 0.6);
    subs = inf.subscribers * 60;
  }
  const merch = inf.merch ? Math.round(inf.followers * 0.12 * (inf.engagement / 55) * rng.float(0.3, 1.6)) : 0;
  const gross = ads + dealIncome + subs + merch;
  const costs = inf.followers >= MONETISATION.ads ? Math.round(200 + gross * 0.07 + merch * 0.25) : 0;
  p.bankBalance -= costs;
  inf.income = { ads, deals: dealIncome, subs, merch, costs };
  inf.lifetimeEarnings += gross - costs;

  // Brand offers for next year; controversies
  inf.offers = newOffers(p, rng);
  if (inf.offers.length) notices.push(info("Brand Offers", `${inf.offers.length} brand${inf.offers.length > 1 ? "s want" : " wants"} to work with you. See the Influencer tab.`, "good"));
  const niche = NICHE_BY_ID[inf.niche] ?? NICHES[0];
  if (inf.followers >= 5_000) {
    const risk = 0.03 + niche.risk + (inf.followers >= 100_000 ? 0.04 : 0) + (inf.boughtFollowers ? 0.05 : 0) + (inf.burnout > 70 ? 0.04 : 0);
    if (rng.chance(risk)) raiseScandal(p, "influencer", rng, notices);
  }

  inf.followerHistory = [...inf.followerHistory, inf.followers].slice(-15);
  if (gross > 0) addLog(p, `Your channel earned ${money(gross)} (${money(costs)} costs). ${inf.followers.toLocaleString()} followers.`);
  return gross;
}
