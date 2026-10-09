/**
 * Touring: headline runs sized to your audience, or a support slot on somebody bigger's tour.
 * Pace trades money against health, band chemistry and home life. Things go wrong on the road.
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner, livingRelatives } from "./state";
import { addVice } from "./vices";
import { info, payout, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";
import { TOUR_PACES, TOUR_SCALES, playerShare, type TourPace, type TourScale } from "./musicCore";

export interface TourOpts {
  pace?: TourPace;
  mode?: "headline" | "support";
}

export function tourOptions(p: PlayerState) {
  return TOUR_SCALES.map((t) => ({ ...t, ok: p.music.fans >= t.minFans }));
}

/** Expected nightly crowd for a venue size. */
export function expectedAttendance(p: PlayerState, capacity: number): number {
  const m = p.music;
  const relFactor = 0.5 + m.relevance / 100;
  return Math.min(capacity, Math.round(m.fans * 0.006 * relFactor + m.localFame * 2 + 25));
}

/** Can you open for someone bigger? Needs a real following but not a huge one. */
export function supportBlock(p: PlayerState): string | null {
  const m = p.music;
  if (m.fans < 1_000) return "Headliners want openers with at least 1,000 fans.";
  if (m.fans >= 600_000) return "You're too big to open for anyone.";
  if (m.relevance < 20) return "Nobody is booking an act that sounds this stale.";
  return null;
}

export function supportPreview(p: PlayerState, pace: TourPace = "standard") {
  const m = p.music;
  const paceInfo = TOUR_PACES.find((x) => x.id === pace) ?? TOUR_PACES[1];
  const shows = Math.round(24 * paceInfo.shows);
  const headliner = clamp(m.fans * 8, 6_000, 4_000_000);
  const fee = Math.round(shows * (200 + m.fans * 0.01));
  const gain = Math.round(headliner * 0.025 * (0.5 + m.relevance / 100));
  return { shows, headliner, fee, gain };
}

export function goOnTour(p0: PlayerState, rng: Rng, scaleId: TourScale, opts: TourOpts = {}): ActionResult {
  const p = clone(p0);
  const m = p.music;
  const scale = TOUR_SCALES.find((t) => t.id === scaleId);
  if (!scale || m.status === "none") return { player: p0 };
  const mode = opts.mode ?? "headline";
  const pace = TOUR_PACES.find((x) => x.id === (opts.pace ?? "standard")) ?? TOUR_PACES[1];
  if ((p.annual.tour ?? 0) >= 1) return { player: p0, notices: [info("Already Toured", "One tour a year is all your body can take.")] };
  if (m.pendingAlbum || (p.annual.album ?? 0) >= 1) return { player: p0, notices: [info("Studio Year", "You're making a record this year. You can't also be on the road.", "bad")] };
  if (mode === "support") {
    const blocked = supportBlock(p);
    if (blocked) return { player: p0, notices: [info("Not Yet", blocked)] };
  } else {
    if (m.fans < scale.minFans) return { player: p0, notices: [info("Not Enough Fans", `A ${scale.label.toLowerCase()} needs about ${scale.minFans.toLocaleString()} fans. You have ${Math.round(m.fans).toLocaleString()}.`)] };
    const indie = !m.signed;
    if (indie && p.bankBalance < scale.fixed * 0.5) return { player: p0, notices: [info("Can't Afford It", `You need ${money(Math.round(scale.fixed * 0.5))} up front to put a ${scale.label.toLowerCase()} on the road.`, "bad")] };
  }
  p.annual.tour = 1;
  m.tours += 1;
  const notices: Notices = [];
  const c = m.contract;
  const sizeIdx = mode === "support" ? 1 : TOUR_SCALES.findIndex((t) => t.id === scale.id);
  let body = "";
  let shows = 0;
  let attendance = 0;
  let net = 0;
  let received = 0;

  if (mode === "support") {
    const pv = supportPreview(p, pace.id);
    shows = pv.shows;
    attendance = pv.headliner;
    const fee = pv.fee;
    received = payout(p, fee * playerShare(p) * (m.manager ? 0.85 : 1));
    net = fee;
    m.earnings += Math.max(0, received);
    const gain = Math.round(pv.gain * rng.float(0.7, 1.35));
    m.fans += gain;
    m.relevance = clamp(m.relevance + 5);
    m.localFame = clamp(m.localFame + 4);
    m.burnout = clamp(m.burnout + Math.round((7 + sizeIdx * 3) * pace.wear));
    body = `Support slot: ${shows} nights opening for a bigger act to crowds of about ${attendance.toLocaleString()}. You were paid ${money(received)} and picked up ${gain.toLocaleString()} new fans who had never heard of you.`;
    changeStat(p, "happiness", 4);
    changeStat(p, "fame", 1);
  } else {
    shows = Math.max(4, Math.round(scale.shows * pace.shows));
    attendance = expectedAttendance(p, scale.capacity);
    const fill = attendance / scale.capacity;
    const ticketRev = attendance * shows * scale.price * (fill < 0.35 ? rng.float(0.7, 1) : 1);
    const merchRev = attendance * shows * scale.price * 0.22;
    const gross = ticketRev + merchRev;
    const venueCut = ticketRev * 0.15;
    const crew = ticketRev * 0.4;
    const fixed = scale.fixed * (0.6 + 0.4 * pace.shows);
    net = gross - venueCut - crew - fixed;
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
    received = yours > 0 ? payout(p, yours) : Math.round(yours);
    if (yours < 0) p.bankBalance += Math.round(yours);
    m.earnings += Math.max(0, received);
    m.fans += attendance * shows * 0.02 * (fill >= 0.8 ? 1.5 : 1);
    m.relevance = clamp(m.relevance + 4);
    m.burnout = clamp(m.burnout + Math.round((8 + sizeIdx * 4) * pace.wear));
    const success = net > 0;
    changeStat(p, "happiness", success ? 5 : -4);
    changeStat(p, "fame", success ? 2 : 0);
    body = `${scale.label} (${pace.label.toLowerCase()}): ${shows} shows, about ${attendance.toLocaleString()} a night (${Math.round(fill * 100)}% full). ${
      net > 0 ? `You banked ${money(received)} after venues, crew, label${m.manager ? ", manager" : ""} and band cuts and withholding.` : m.signed ? `It lost ${money(-net)}, which the label added to your debt.` : `It lost ${money(-net)} and you ate the cost.`
    }`;
  }

  // The road takes its toll.
  const wear = pace.wear;
  changeStat(p, "health", -Math.max(1, Math.round((shows / 8) * wear)));
  const partner = getPartner(p);
  const home = Math.round((2 + shows / 10) * (p.celeb.familyShield ? 0.6 : 1) * (wear > 1 ? 1.4 : wear < 1 ? 0.6 : 1));
  if (partner) partner.relationshipBar = clamp(partner.relationshipBar - home - 2);
  for (const k of livingRelatives(p, "Child")) if (k.age < 18) k.relationshipBar = clamp(k.relationshipBar - Math.max(1, home - 1));
  if (rng.chance(clamp(0.28 + m.burnout / 400 + m.members.filter((x) => x.partier).length * 0.06, 0, 0.8) * (wear > 1 ? 1.25 : wear < 1 ? 0.6 : 1))) {
    const key = rng.chance(0.55) ? "alcohol" : "drugs";
    addVice(p, key, rng.int(4, 10));
    body += ` The tour bus had a lot of ${key === "alcohol" ? "drinking" : "pills and powders"}, and you joined in.`;
  }
  const incidents: string[] = [];
  if (rng.chance(0.07 * wear + m.burnout / 1500)) {
    changeStat(p, "health", -10);
    incidents.push("You strained your voice and cracked a rib on stage and had to cancel dates.");
    net = Math.round(net * 0.85);
  }
  if (rng.chance(0.015 * wear)) {
    changeStat(p, "health", -18);
    incidents.push("The tour bus left the road on a wet night. Everyone survived, but you spent a month in a neck brace.");
  }
  if (!m.manager && !m.signed && mode === "headline" && net > 0 && rng.chance(0.1)) {
    const lost = Math.round(net * 0.08);
    p.bankBalance = Math.max(0, p.bankBalance - lost);
    incidents.push(`An unscrupulous promoter skimmed ${money(lost)} off the door. A manager would have caught it.`);
  }
  for (const mem of m.members) {
    if ((mem.trait === "addict" || mem.trait === "flake") && rng.chance(0.14 * wear)) {
      mem.loyalty = clamp(mem.loyalty - 8);
      if (mem.trait === "addict" && !mem.grievance) {
        mem.grievance = "habit";
        mem.grievanceYears = 0;
      }
      incidents.push(`${mem.name} missed a soundcheck and then a show. The tour bus has been tense ever since.`);
      break;
    }
  }
  if (m.burnout >= 75 && rng.chance(0.25)) {
    incidents.push("You came apart on stage in front of thousands and walked off mid-song. It was filmed.");
    raiseScandal(p, "music", rng, notices, 1, "a meltdown on stage went viral");
  } else if (net > 0 && attendance >= 300 && rng.chance(0.1 + (attendance / Math.max(1, scale.capacity) >= 0.85 ? 0.12 : 0))) {
    incidents.push("One night everything clicked. Fans are calling it the show of the decade, and the bootleg has a million views.");
    m.relevance = clamp(m.relevance + 6);
    m.fans += Math.round(m.fans * 0.05);
    changeStat(p, "happiness", 4);
  }
  if (incidents.length) body += " " + incidents.join(" ");
  m.lastTour = { year: p.year, label: mode === "support" ? "Support slot" : scale.label, shows, attendance, net: Math.round(received), mode };
  addLog(p, body);
  const good = mode === "support" || net > 0;
  notices.unshift(info(mode === "support" ? "Support Tour Done" : good ? "Tour Complete" : "Tour Loses Money", body, good ? "good" : "bad"));
  return { player: p, notices };
}
