/**
 * The cost of being known: fame that follows your audience, paparazzi, stalkers, strained
 * relationships, security and money management, and PR crises shared by every fame career.
 */
import type { ActionResult, PlayerState, ScandalState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner, livingRelatives } from "./state";
import { info, logInterp, type Notices } from "./creativeCore";

// ---------------------------------------------------------------------------
// Fame follows the audience
// ---------------------------------------------------------------------------

/** log10(audience) -> fame. Most channels and bands stay obscure, so fame is steep at the top. */
const AUDIENCE_FAME: ReadonlyArray<readonly [number, number]> = [
  [2.5, 0],
  [3, 4],
  [4, 12],
  [5, 26],
  [6, 46],
  [7, 68],
  [8, 86],
];

/** Fame the player's current creative standing supports. 0 means nothing creative is sustaining their fame. */
export function creativeFameFloor(p: PlayerState): number {
  let floor = 0;
  const inf = p.influencer;
  if (inf.active) floor = Math.max(floor, logInterp(AUDIENCE_FAME, inf.followers) * (0.6 + 0.4 * (inf.engagement / 100)));
  const m = p.music;
  if (m.status !== "none" || m.albums.length > 0) {
    const fanFame = logInterp(AUDIENCE_FAME, m.fans) * (0.4 + 0.6 * (m.relevance / 100));
    floor = Math.max(floor, fanFame, m.localFame * 0.12);
  }
  const a = p.acting;
  if (a.credits.length > 0) floor = Math.max(floor, a.reputation * 0.35 + a.pull * 0.45);
  return Math.round(floor);
}

const FAME_JOBS = ["actor", "model", "astronaut", "athlete", "creator"];

/** Raise fame toward what the audience supports, and let stale fame fade. */
export function syncFame(p: PlayerState) {
  const floor = creativeFameFloor(p);
  if (floor <= 0) return;
  if (p.fame < floor) p.fame = Math.min(floor, p.fame + 6);
  else if (p.fame > floor && !FAME_JOBS.includes(p.currentJob?.lineId ?? "")) {
    p.fame = Math.max(floor, p.fame - Math.max(1, Math.round((p.fame - floor) * 0.1)));
  }
}

// ---------------------------------------------------------------------------
// Scandals and PR
// ---------------------------------------------------------------------------

const CAUSES: Record<ScandalState["source"], string[]> = {
  influencer: [
    "an old post resurfaced and the screenshots are everywhere",
    "a rival creator accused you of faking a story for views",
    "a promoted product turned out to be a scam",
    "a clip of you being rude to a waiter went viral",
  ],
  music: [
    "a leaked voicemail shows you trashing a fellow artist",
    "lyrics from your latest record are being called offensive",
    "a bandmate told a magazine about your wild behaviour",
    "you were accused of lifting a melody from an unknown songwriter",
  ],
  acting: [
    "a co-star went public about your behaviour on set",
    "you walked off a production and the studio is furious",
    "private photos hit the tabloids",
    "an old interview resurfaced and it has not aged well",
  ],
  general: ["a night out was captured on someone's phone", "a rumour about you took on a life of its own"],
};

export function raiseScandal(p: PlayerState, source: ScandalState["source"], rng: Rng, notices: Notices, severity?: 1 | 2 | 3): boolean {
  if (p.celeb.scandal) return false;
  const sev = severity ?? (rng.chance(0.18 + p.fame / 400) ? 3 : rng.chance(0.5) ? 2 : 1);
  const cause = rng.pick(CAUSES[source]);
  p.celeb.scandal = { source, cause, severity: sev };
  p.celeb.scandals += 1;
  const body = `Scandal: ${cause}. The press is calling. Decide how to respond in your fame career tab before it blows up on its own.`;
  addLog(p, body);
  notices.push(info("PR Crisis", body, "bad"));
  return true;
}

export type PrResponse = "apologise" | "ignore" | "doubleDown" | "prFirm";

export const prFirmCost = (p: PlayerState, severity: number) => Math.round(15_000 * severity * (1 + p.fame / 40));

/** Apply the fallout. A negative factor is a windfall: the controversy made you more famous. */
function applyDamage(p: PlayerState, source: ScandalState["source"], f: number, rng: Rng, notices: Notices) {
  const win = f < 0;
  if (source === "influencer") {
    const inf = p.influencer;
    inf.followers = Math.max(0, Math.round(inf.followers * clamp(1 - 0.09 * f, 0.3, 1.25)));
    inf.authenticity = clamp(inf.authenticity - 7 * f);
    inf.engagement = clamp(inf.engagement - 4 * f);
    if (f >= 2.4 && rng.chance(0.3)) {
      inf.bannedYears = rng.int(1, 2);
      notices.push(info("Platform Ban", `The platform suspended your channel for ${inf.bannedYears} year${inf.bannedYears > 1 ? "s" : ""}.`, "bad"));
    }
    if (f >= 2 && inf.deals.length) {
      const lost = inf.deals.shift()!;
      notices.push(info("Sponsor Walks", `${lost.brand} cancelled your contract.`, "bad"));
    }
  } else if (source === "music") {
    const m = p.music;
    m.relevance = clamp(m.relevance - 7 * f);
    m.fans = Math.max(0, Math.round(m.fans * clamp(1 - 0.07 * f, 0.4, 1.2)));
    m.labelStanding = clamp(m.labelStanding - 8 * f);
  } else if (source === "acting") {
    const a = p.acting;
    a.reputation = clamp(a.reputation - 8 * f);
    a.pull = clamp(a.pull - 4 * f);
    a.critics = clamp(a.critics - 2 * f);
    if (f >= 2.4 && a.studioDeal) {
      a.studioDeal = null;
      notices.push(info("Studio Deal Torn Up", "The studio terminated your multi-picture deal over the scandal.", "bad"));
    }
  }
  changeStat(p, "fame", win ? Math.round(-3 * f) : Math.round(-2 * f));
  changeStat(p, "happiness", -Math.min(12, Math.round(2 * Math.abs(f))));
}

/** Mutating core. Returns false (and changes nothing) if the response can't be carried out. */
function runScandal(p: PlayerState, rng: Rng, response: PrResponse, notices: Notices, prefix = ""): boolean {
  const s = p.celeb.scandal;
  if (!s) return false;
  const sev = s.severity;
  const cred = clamp((p.karma + (s.source === "influencer" ? p.influencer.authenticity : 50)) / 2);
  let success = false;
  let factor = 0;
  let text = "";
  if (response === "prFirm") {
    const cost = prFirmCost(p, sev);
    if (p.bankBalance < cost) {
      notices.push(info("Can't Afford It", `A crisis PR firm charges ${money(cost)}.`, "bad"));
      return false;
    }
    p.bankBalance -= cost;
    success = rng.chance(0.88);
    factor = success ? 0.3 * sev : 1.1 * sev;
    text = success ? `The PR firm spun it into a "learning moment" for ${money(cost)}. It faded fast.` : `You paid ${money(cost)} and the story still got out of hand.`;
  } else if (response === "apologise") {
    success = rng.chance(0.4 + cred / 200);
    factor = success ? 0.35 * sev : sev;
    if (success) changeStat(p, "karma", 2);
    text = success ? "Your apology landed. People respect someone who owns a mistake." : "Your apology was read as insincere and made things worse.";
  } else if (response === "ignore") {
    success = rng.chance(clamp(0.6 - sev * 0.12, 0.2, 0.6));
    factor = success ? 0.15 * sev : 1.5 * sev;
    text = success ? "You said nothing and the news cycle moved on." : "Silence read as guilt. The story snowballed.";
  } else {
    const loyal = s.source === "influencer" ? p.influencer.engagement / 500 : 0.05;
    success = rng.chance(0.28 + loyal);
    factor = success ? -0.4 * sev : 2 * sev;
    changeStat(p, "karma", -3);
    text = success ? "You doubled down and your fans rallied round. The controversy made you bigger." : "Doubling down backfired spectacularly.";
  }
  const body = `${text} (${s.cause})`;
  p.celeb.scandal = null;
  addLog(p, body);
  notices.push(info(prefix + (success ? "Crisis Handled" : "Crisis Escalates"), body, success ? "good" : "bad"));
  applyDamage(p, s.source, factor, rng, notices);
  return true;
}

export function resolveScandal(p0: PlayerState, rng: Rng, response: PrResponse): ActionResult {
  if (!p0.celeb.scandal) return { player: p0 };
  const p = clone(p0);
  const notices: Notices = [];
  if (!runScandal(p, rng, response, notices)) return { player: p0, notices };
  return { player: p, notices };
}

/** Unanswered crises resolve themselves, badly. Runs at the start of Age Up. */
export function autoResolveScandal(p: PlayerState, rng: Rng, notices: Notices) {
  runScandal(p, rng, "ignore", notices, "Unanswered: ");
}

// ---------------------------------------------------------------------------
// Privacy, stalkers, security and money management
// ---------------------------------------------------------------------------

export const securityCost = (p: PlayerState) => Math.round(Math.max(8_000, p.fame * 1_200));
export const managerCost = (p: PlayerState) => Math.round(Math.max(5_000, p.fame * 600));

export function processCelebrity(p: PlayerState, rng: Rng, notices: Notices) {
  syncFame(p);
  const c = p.celeb;
  if (p.fame < 25) {
    c.stalker = Math.max(0, c.stalker - 5);
    c.privacy = Math.min(100, c.privacy + 5);
    return;
  }
  if (c.security) p.bankBalance -= securityCost(p);
  if (c.businessManager) p.bankBalance -= managerCost(p);
  c.privacy = clamp(c.privacy - Math.round(p.fame / 25) + (c.security ? 3 : 0) + rng.int(0, 3));
  // Relationships under fame.
  const strain = Math.round(p.fame / 25);
  const partner = getPartner(p);
  if (partner && strain > 0) {
    const hit = rng.int(0, strain) - (p.effort === "coast" ? 1 : 0);
    if (hit > 0) partner.relationshipBar = clamp(partner.relationshipBar - hit);
  }
  for (const kid of livingRelatives(p, "Child")) if (kid.age < 18 && p.fame >= 50 && p.effort === "grind") kid.relationshipBar = clamp(kid.relationshipBar - 1);
  // Paparazzi.
  const exposure = (p.fame - 30) / 220 + ((100 - c.privacy) / 100) * 0.15;
  if (p.fame >= 35 && rng.chance(clamp(exposure, 0, 0.4))) {
    changeStat(p, "happiness", -3);
    c.privacy = clamp(c.privacy - 5);
    const body = rng.pick([
      "Photographers camped outside your home and sold every angle of your breakfast.",
      "A long-lens photo of your private moment ran on a gossip site.",
      "You couldn't get a coffee without a camera in your face.",
    ]);
    addLog(p, body);
    notices.push(info("Paparazzi", body, "bad"));
  }
  // Stalkers and parasocial obsession.
  const audience = p.influencer.active ? p.influencer.followers + p.influencer.subscribers * 20 : p.music.fans;
  c.stalker = clamp(c.stalker + p.fame / 40 + Math.log10(Math.max(10, audience)) / 3 - (c.security ? 6 : 0) + rng.int(-2, 2));
  if (c.stalker >= 60 && rng.chance(c.security ? 0.12 : 0.3)) {
    const severe = !c.security && rng.chance(0.2);
    changeStat(p, "happiness", severe ? -12 : -6);
    changeStat(p, "health", severe ? -10 : -2);
    c.stalker = 25;
    const body = severe
      ? "An obsessed fan broke into your home. You were shaken and hurt. Security is suddenly a very reasonable expense."
      : "An obsessed fan found your address and left unsettling gifts. You had to move for a while.";
    addLog(p, body);
    notices.push(info(severe ? "Break-In" : "Stalker", body, "bad"));
  }
}

function toggle(p0: PlayerState, key: "security" | "businessManager"): ActionResult {
  const p = clone(p0);
  p.celeb[key] = !p.celeb[key];
  const label = key === "security" ? "security detail" : "business manager";
  const cost = key === "security" ? securityCost(p) : managerCost(p);
  const body = p.celeb[key]
    ? `You hired a ${label} for about ${money(cost)} a year.`
    : `You let your ${label} go.`;
  addLog(p, body);
  return { player: p, notices: [info(p.celeb[key] ? "Hired" : "Let Go", body)] };
}

export const toggleSecurity = (p: PlayerState) => toggle(p, "security");
export const toggleBusinessManager = (p: PlayerState) => toggle(p, "businessManager");

/** Disappear for a while: privacy returns, fame fades a little. */
export function layLow(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if ((p.annual.lowprofile ?? 0) >= 1) return { player: p0, notices: [info("Already Hiding", "You've already gone to ground this year.")] };
  p.annual.lowprofile = 1;
  p.celeb.privacy = clamp(p.celeb.privacy + 25);
  p.celeb.stalker = clamp(p.celeb.stalker - 20);
  changeStat(p, "fame", -2);
  changeStat(p, "happiness", 3);
  if (p.influencer.active) p.influencer.burnout = clamp(p.influencer.burnout - 10);
  if (p.music.status !== "none") p.music.burnout = clamp(p.music.burnout - 10);
  const body = "You kept a low profile: no appearances, no posts about your private life. Privacy +25, stalker risk down.";
  addLog(p, body);
  return { player: p, notices: [info("Laying Low", body, "good")] };
}
