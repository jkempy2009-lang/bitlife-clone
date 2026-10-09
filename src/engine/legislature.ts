/**
 * The legislature: bills with real content, whip counts, compromise and horse-trading, executive orders,
 * and a country whose health, wealth, air and freedom actually move when you govern.
 * Laws you pass stay on the books after you leave (until someone repeals them), reshape the justice system
 * for criminal-justice bills, and are what voters judge you on at the next election.
 */
import type { ActionResult, EnactedLaw, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { INDICATORS, ISSUE_INDICATORS, LAWS, LAW_BY_ID, TIER_SCALE, conflictsOf, type IndicatorId, type IssueKey, type LawDef } from "@/data/laws";
import { ISSUES, PARTIES } from "@/data/politicsData";
import { addLog, changeStat, clone } from "./state";
import { ISSUE_IDS } from "./justiceState";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

const holdsOffice = (p: PlayerState) => p.currentJob?.lineId === "politics";
const officeTier = (p: PlayerState) => (holdsOffice(p) ? p.currentJob!.tier : -1);

export type Approach = "plain" | "compromise" | "horse_trade";

export const APPROACHES: { id: Approach; name: string; blurb: string }[] = [
  { id: "plain", name: "As written", blurb: "Full effect, full fight." },
  { id: "compromise", name: "Compromise", blurb: "Water it down: +20% to pass, half the effect." },
  { id: "horse_trade", name: "Horse-trade", blurb: "Buy votes with district projects: +15% to pass, costs money, smells." },
];

export const issueName = (id: string) => ISSUES.find((i) => i.id === id)?.name ?? id;

/** Money a horse-trade costs: scaled to the office, not a fixed sum. */
export function horseTradeCost(p: PlayerState): number {
  return Math.max(3_000, Math.round((p.currentJob?.salary ?? 60_000) * 0.3));
}

export const lawName = (id: string) => LAW_BY_ID[id]?.name ?? id;

export const isEnacted = (p: PlayerState, id: string) => p.statecraft.laws.some((l) => l.id === id && l.country === p.residence.country);

/** The stance a bill needs. A centrist (stance 0) can only push centrist bills once they belong to a party. */
function stanceAllows(p: PlayerState, law: LawDef): boolean {
  const s = p.statecraft.stances[law.issue] ?? 0;
  if (law.stance === 0) return s === 0 && p.politics.party !== null;
  return s === law.stance;
}

/** Bills this politician can introduce right now: their office, their stated positions, not already law. */
export function availableBills(p: PlayerState, issue?: IssueKey): LawDef[] {
  const tier = officeTier(p);
  if (tier < 0) return [];
  return LAWS.filter((l) => (!issue || l.issue === issue) && l.minTier <= tier && stanceAllows(p, l) && !isEnacted(p, l.id));
}

/** Bills that would be possible but are held back by a missing position or a lower office. */
export function lockedBills(p: PlayerState, issue: IssueKey): { law: LawDef; why: string }[] {
  const tier = officeTier(p);
  const out: { law: LawDef; why: string }[] = [];
  for (const l of LAWS) {
    if (l.issue !== issue || isEnacted(p, l.id)) continue;
    if (!stanceAllows(p, l)) continue;
    if (l.minTier > tier) out.push({ law: l, why: `Needs ${["City Councillor", "Mayor", "State Governor", "Senator", "Head of State"][l.minTier]}` });
  }
  return out;
}

/** Chance a bill clears the chamber. Party standing, coalition, approval and effort count; so does how hard a fight it is. */
export function billChance(p: PlayerState, law: LawDef, approach: Approach = "plain"): number {
  const sc = p.statecraft;
  const tier = Math.max(0, officeTier(p));
  const effort = p.effort === "grind" ? 8 : p.effort === "coast" ? -10 : 0;
  const votes = sc.machine * 0.35 + sc.coalition * 0.35 + p.politics.popularity * 0.3 + effort;
  const need = 26 + tier * 6 + law.opposition * 30;
  const idx = ISSUE_IDS.indexOf(law.issue);
  const plat = PARTIES.find((x) => x.id === p.politics.party)?.platform[idx];
  const platform = plat !== undefined && law.stance === plat ? 0.05 : plat !== undefined && plat !== 0 && law.stance !== plat ? -0.1 : 0;
  const bonus = approach === "compromise" ? 0.2 : approach === "horse_trade" ? 0.15 : 0;
  return clamp((votes - need) / 60 + 0.5 + platform + bonus, 0.08, 0.92);
}

/** Plain-words summary of what a bill does, for the UI and the log. */
export function effectChips(law: LawDef, power = 1): { label: string; delta: number }[] {
  const out: { label: string; delta: number }[] = [];
  for (const [k, v] of Object.entries(law.effects) as [IndicatorId, number][]) {
    const name = INDICATORS.find((i) => i.id === k)?.name ?? k;
    out.push({ label: name, delta: Math.round(v * power * 10) / 10 });
  }
  const d = law.law;
  if (d?.harshness) out.push({ label: "Sentences", delta: d.harshness > 0 ? 1 : -1 });
  if (d?.policing) out.push({ label: "Policing", delta: d.policing > 0 ? 1 : -1 });
  if (d?.corruption) out.push({ label: "Corruption", delta: d.corruption > 0 ? 1 : -1 });
  if (d?.deathPenalty !== undefined) out.push({ label: "Death penalty", delta: d.deathPenalty ? 1 : -1 });
  return out;
}

function spend(p: PlayerState, cost: number): boolean {
  const sc = p.statecraft;
  if (sc.funds + p.bankBalance < cost) return false;
  const fromFunds = Math.min(sc.funds, cost);
  sc.funds -= fromFunds;
  p.bankBalance -= cost - fromFunds;
  return true;
}

function enact(p: PlayerState, law: LawDef, power: number): string[] {
  const notes: string[] = [];
  const country = p.residence.country;
  for (const other of conflictsOf(law.id)) {
    const i = p.statecraft.laws.findIndex((l) => l.id === other && l.country === country);
    if (i >= 0) {
      p.statecraft.laws.splice(i, 1);
      notes.push(`It repealed the ${lawName(other).toLowerCase()}.`);
    }
  }
  const entry: EnactedLaw = { id: law.id, year: p.year, country, power, tier: Math.max(0, officeTier(p)) };
  p.statecraft.laws.push(entry);
  return notes;
}

const consequenceText = (law: LawDef, power: number) => {
  const up = effectChips(law, power).filter((c) => c.delta > 0).map((c) => c.label.toLowerCase());
  const down = effectChips(law, power).filter((c) => c.delta < 0).map((c) => c.label.toLowerCase());
  return `${up.length ? `Expect ${up.join(" and ")} to improve over the next three years` : ""}${up.length && down.length ? ", " : ""}${down.length ? `${up.length ? "at the cost of" : "Expect a hit to"} ${down.join(" and ")}` : ""}.`;
};

/** Introduce a bill. One floor fight a year. Passing it changes the country; losing it costs you. */
export function pushBill(p0: PlayerState, rng: Rng, lawId: string, approach: Approach = "plain"): ActionResult {
  const p = clone(p0);
  const law = LAW_BY_ID[lawId];
  if (!holdsOffice(p)) return { player: p0, notices: [info("Not in Office", "You need a seat to propose legislation.", "bad")] };
  if (!law || !availableBills(p).some((l) => l.id === law.id)) return { player: p0, notices: [info("Can't Table That", "You can only push bills that match the positions you've staked out and the office you hold.", "bad")] };
  if ((p.annual["pol:policy"] ?? 0) >= 1) return { player: p0, notices: [info("Floor Time Used", "The legislature has no more time for your agenda this year.")] };
  const sc = p.statecraft;
  if (approach === "horse_trade") {
    const cost = horseTradeCost(p);
    if (!spend(p, cost)) return { player: p0, notices: [info("Insufficient Funds", `Greasing the votes costs ${money(cost)}.`, "bad")] };
  }
  p.annual["pol:policy"] = 1;
  const power = approach === "compromise" ? 0.5 : 1;
  if (rng.chance(billChance(p, law, approach))) {
    sc.policyWins += 1;
    p.annual["pol:win"] = (p.annual["pol:win"] ?? 0) + 1;
    const mood = sc.mood[law.issue] ?? 0;
    const popular = law.stance !== 0 ? law.stance * mood > 0 : Math.abs(mood) < 0.3;
    p.politics.popularity = clamp(p.politics.popularity + (popular ? 5 : 1));
    sc.machine = clamp(sc.machine + 2);
    changeStat(p, "fame", 1);
    const notes = enact(p, law, power);
    let extra = "";
    if (approach === "horse_trade" && !sc.scandal && rng.chance(0.2)) {
      sc.scandal = { kind: "expenses", title: "Pork-barrel spending", severity: 1, year: p.year };
      extra = " Journalists are already counting the district projects you handed out.";
    }
    const body = `Your ${law.name.toLowerCase()} passed${approach === "compromise" ? " in a watered-down form" : ""}. ${popular ? "Voters like it." : "Voters shrugged: it isn't what they're asking for right now."} ${consequenceText(law, power)}${notes.length ? ` ${notes.join(" ")}` : ""}${extra}`;
    addLog(p, body);
    return { player: p, notices: [info("Bill Passed", body, "good")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - 3);
  sc.machine = clamp(sc.machine - 2);
  const body = `Your ${law.name.toLowerCase()} died in committee. ${approach === "compromise" ? "Even the watered-down version could not find the votes." : "The opposition made sure of it."}`;
  addLog(p, body);
  return { player: p, notices: [info("Bill Defeated", body, "bad")] };
}

/** Governors and above can sign an order without a vote, if the courts let it stand. */
export function executiveOrder(p0: PlayerState, rng: Rng, lawId: string): ActionResult {
  const p = clone(p0);
  const law = LAW_BY_ID[lawId];
  if (!holdsOffice(p) || officeTier(p) < 2) return { player: p0, notices: [info("No Such Power", "Only a Governor or higher can govern by order.", "bad")] };
  if (!law || !availableBills(p).some((l) => l.id === law.id)) return { player: p0, notices: [info("Can't Order That", "You can only order what you've campaigned for, from the office you hold.", "bad")] };
  if ((p.annual["pol:exec"] ?? 0) >= 1) return { player: p0, notices: [info("Pen Down", "You've already signed an order this year.")] };
  p.annual["pol:exec"] = 1;
  const sc = p.statecraft;
  const struck = rng.chance(clamp(0.2 + law.opposition * 0.35, 0.2, 0.45));
  sc.machine = clamp(sc.machine - 3);
  if (struck) {
    p.politics.popularity = clamp(p.politics.popularity - 5);
    const body = `You signed an executive order on the ${law.name.toLowerCase()}. A court struck it down within weeks, and the press called it overreach.`;
    addLog(p, body);
    return { player: p, notices: [info("Order Struck Down", body, "bad")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - 3);
  const notes = enact(p, law, 0.6);
  const body = `You signed the ${law.name.toLowerCase()} by executive order. It stands, at 60% strength, and critics call it rule by decree. ${consequenceText(law, 0.6)}${notes.length ? ` ${notes.join(" ")}` : ""}`;
  addLog(p, body);
  return { player: p, notices: [info("Executive Order", body, "neutral")] };
}

/** Try to strike a law from the books. Uses the year's floor time. */
export function repealLaw(p0: PlayerState, rng: Rng, lawId: string): ActionResult {
  const p = clone(p0);
  const law = LAW_BY_ID[lawId];
  if (!holdsOffice(p)) return { player: p0, notices: [info("Not in Office", "Only a sitting legislator can repeal a law.", "bad")] };
  const i = p.statecraft.laws.findIndex((l) => l.id === lawId && l.country === p.residence.country);
  if (!law || i < 0) return { player: p0 };
  if ((p.annual["pol:policy"] ?? 0) >= 1) return { player: p0, notices: [info("Floor Time Used", "The legislature has no more time for your agenda this year.")] };
  p.annual["pol:policy"] = 1;
  const chance = clamp(billChance(p, { ...law, opposition: 0.4 }) , 0.1, 0.85);
  if (rng.chance(chance)) {
    p.statecraft.laws.splice(i, 1);
    p.politics.popularity = clamp(p.politics.popularity - 2);
    const body = `The ${law.name.toLowerCase()} was repealed. The country starts to drift back to where it was.`;
    addLog(p, body);
    return { player: p, notices: [info("Law Repealed", body, "neutral")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - 3);
  const body = `Your repeal of the ${law.name.toLowerCase()} failed. Its supporters had the votes.`;
  addLog(p, body);
  return { player: p, notices: [info("Repeal Failed", body, "bad")] };
}

// ---------------------------------------------------------------------------
// The state of the nation
// ---------------------------------------------------------------------------

/** Where each indicator is heading given the laws on the books and the economic climate. */
export function indicatorTargets(p: PlayerState): Record<IndicatorId, number> {
  const t = Object.fromEntries(INDICATORS.map((i) => [i.id, 50])) as Record<IndicatorId, number>;
  const climate = p.economy.climate;
  if (climate === "recession") {
    t.prosperity -= 8;
    t.finances -= 4;
  } else if (climate === "boom") {
    t.prosperity += 6;
    t.finances += 3;
  }
  for (const l of p.statecraft.laws) {
    if (l.country !== p.residence.country) continue;
    const def = LAW_BY_ID[l.id];
    if (!def) continue;
    const ramp = clamp((p.year - l.year + 1) / 3, 0.34, 1);
    const k = (TIER_SCALE[l.tier] ?? 1) * l.power * ramp;
    for (const [id, v] of Object.entries(def.effects) as [IndicatorId, number][]) t[id] += v * k;
  }
  for (const i of INDICATORS) t[i.id] = clamp(t[i.id]);
  return t;
}

/** Sum of how far each indicator sits from neutral, in units of 50: roughly -6 to +6. */
export function nationScore(p: PlayerState): number {
  let sum = 0;
  for (const i of INDICATORS) sum += ((p.statecraft.indicators[i.id] ?? 50) - 50) / 50;
  return sum;
}

/** Voters weigh the issues they care about most: the indicators behind the issue you campaigned on. */
export function issueScore(p: PlayerState, issue: IssueKey): number {
  const ids = ISSUE_INDICATORS[issue];
  return ids.reduce((s, id) => s + (p.statecraft.indicators[id] ?? 50) - 50, 0) / ids.length;
}

/** Yearly: laws bite, the country moves, budgets break and old laws get repealed. */
export function processNation(p: PlayerState, rng: Rng, notices: Notices) {
  const sc = p.statecraft;
  const target = indicatorTargets(p);
  for (const i of INDICATORS) {
    const v = sc.indicators[i.id] ?? 50;
    sc.indicators[i.id] = Math.round(clamp(v + (target[i.id] - v) * 0.45 + rng.float(-0.6, 0.6)) * 10) / 10;
  }
  const here = sc.laws.filter((l) => l.country === p.residence.country);
  if (!holdsOffice(p)) {
    // Whoever governs now may undo what you did.
    for (const l of [...here]) {
      if (p.year - l.year < 1 || !rng.chance(0.06)) continue;
      sc.laws = sc.laws.filter((x) => x !== l);
      const body = `The new government repealed your ${lawName(l.id).toLowerCase()}.`;
      addLog(p, body);
      notices.push(info("Law Repealed", body, "bad"));
    }
    return;
  }
  if ((sc.indicators.finances ?? 50) < 20) {
    p.politics.popularity = clamp(p.politics.popularity - 8);
    sc.indicators.prosperity = clamp((sc.indicators.prosperity ?? 50) - 2);
    const body = "The ratings agencies downgraded the country over its deficits. Austerity is on the table, and voters blame you.";
    addLog(p, body);
    notices.push(info("Fiscal Crisis", body, "bad"));
  }
  if ((sc.indicators.liberty ?? 50) < 22 && rng.chance(0.4)) {
    p.politics.popularity = clamp(p.politics.popularity - 6);
    const body = "Protesters filled the squares, furious at what has been done to their rights. The images ran on every channel.";
    addLog(p, body);
    notices.push(info("Mass Protests", body, "bad"));
  }
  if ((sc.indicators.health ?? 50) < 25 && rng.chance(0.35)) {
    p.politics.popularity = clamp(p.politics.popularity - 4);
    const body = "Hospitals are overwhelmed and a bad winter has made it a national story. The blame is landing on the government.";
    addLog(p, body);
    notices.push(info("Health Emergency", body, "bad"));
  }
}

/** Approval effect of how the country is doing under you (added to the yearly drift). */
export function nationApproval(p: PlayerState): number {
  return Math.round(nationScore(p) * 2.5);
}

/** Election-odds factor for the state of the nation. */
export function nationFactor(p: PlayerState): number {
  return clamp(nationScore(p) * 0.02, -0.1, 0.1);
}
