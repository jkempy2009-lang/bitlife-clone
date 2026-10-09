/**
 * Friendship over a lifetime: who becomes a best friend, who you fall out with, who you lose touch with,
 * and whether you can find your way back. Friends have lives of their own and need tending.
 */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { addGrievance, remember, yearsKnown } from "./bonds";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });
const first = (r: Relative) => r.name.split(" ")[0];

const activeFriends = (p: PlayerState) => p.relatives.filter((r) => r.relation === "Friend" && r.alive && r.partnerStatus !== "ex");

/** What kind of friend someone is, from how long and how closely you've known them. */
export function friendKindFor(p: PlayerState, rel: Relative, isBest: boolean): string {
  if (rel.riftYear) return "Fallen out";
  const years = yearsKnown(p, rel) ?? 0;
  if (isBest && rel.relationshipBar >= 78 && years >= 3) return "Best friend";
  if (years >= 12 && rel.relationshipBar >= 45) return "Old friend";
  if (rel.relationshipBar >= 65) return "Close friend";
  if (rel.relationshipBar < 30) return "Acquaintance";
  return "Friend";
}

const RIFT_CAUSES = [
  "a falling-out over money",
  "something unforgivable said at a party",
  "a birthday you forgot",
  "taking the wrong side in someone else's argument",
  "a partner they never liked",
  "a secret that got repeated",
];

const MOMENTS: { text: (n: string) => string; bar?: number; happy?: number; mem: (n: string) => string }[] = [
  { text: (n) => `${n} got married, and you were there, a bit teary, near the front.`, bar: 3, mem: (n) => `You were at ${n}'s wedding.` },
  { text: (n) => `${n} had a baby and sent you the first photo before most of their family.`, bar: 3, mem: (n) => `${n} had a baby.` },
  { text: (n) => `${n} moved to another city for work. The group chat is now your whole friendship.`, bar: -8, mem: (n) => `${n} moved away.` },
  { text: (n) => `${n} lost their job and has been quiet. A text from you would mean a lot.`, bar: 0, mem: (n) => `${n} had a hard year.` },
  { text: (n) => `${n} got a big promotion and treated everyone to dinner.`, bar: 2, happy: 1, mem: (n) => `You celebrated ${n}'s promotion.` },
];

export function processCircle(p: PlayerState, prev: Record<string, number>, rng: Rng, notices: Notices) {
  const friends = activeFriends(p).sort((a, b) => b.relationshipBar - a.relationshipBar);
  const bestId = friends[0]?.id;
  for (const f of friends) {
    const n = first(f);
    f.friendKind = friendKindFor(p, f, f.id === bestId);

    if (f.riftYear) {
      if (p.year - f.riftYear >= 3) {
        f.partnerStatus = "ex";
        f.lostYear = p.year;
        remember(p, f, "loss", `You and ${n} never made up.`);
        const body = `${f.name} is out of your life for good now. Neither of you made the first move, and the silence set like concrete.`;
        addLog(p, body);
        notices.push(info("Estranged", body, "bad"));
      } else {
        f.relationshipBar = clamp(f.relationshipBar - 3);
      }
      continue;
    }

    // Falling out: likelier with a short fuse, a jealous streak, or a year of silence.
    const silent = (prev[`rel:${f.id}`] ?? 0) === 0;
    const risk =
      0.025 +
      ((f.traits ?? []).includes("Hot-tempered") ? 0.035 : 0) +
      ((f.jealousy ?? 50) > 65 ? 0.025 : 0) +
      (silent && f.relationshipBar >= 40 ? 0.045 : 0) -
      (p.talents.empathy - 50) / 2000;
    if (f.relationshipBar >= 35 && rng.chance(Math.max(0.01, risk))) {
      const cause = rng.pick(RIFT_CAUSES);
      f.riftYear = p.year;
      f.relationshipBar = clamp(f.relationshipBar - 25);
      addGrievance(p, f, "fight", 2, cause);
      remember(p, f, "conflict", `You and ${n} fell out over ${cause}.`);
      changeStat(p, "happiness", -3);
      const body = `You and ${n} had a bitter falling-out over ${cause}. It could still be mended if somebody swallows their pride soon. Open ${n}'s page and clear the air.`;
      addLog(p, body);
      notices.push(info("A Falling-Out", body, "bad"));
    }
  }

  // Friends have lives. One piece of news a year, at most.
  const candidates = activeFriends(p).filter((f) => !f.riftYear && f.relationshipBar >= 35);
  if (candidates.length > 0 && rng.chance(0.4)) {
    const f = rng.pick(candidates);
    const m = rng.pick(MOMENTS);
    f.relationshipBar = clamp(f.relationshipBar + (m.bar ?? 0));
    if (m.happy) changeStat(p, "happiness", m.happy);
    remember(p, f, "milestone", m.mem(first(f)));
    const body = m.text(first(f));
    addLog(p, body);
    notices.push(info("Friends' News", body, "neutral"));
  }

  // A big circle is thin: you can't keep everybody warm.
  const rest = activeFriends(p);
  if (rest.length > 6) {
    const weakest = rest.sort((a, b) => a.relationshipBar - b.relationshipBar)[0];
    weakest.relationshipBar = clamp(weakest.relationshipBar - 4);
  }

  // Lost friends fade from memory eventually.
  p.relatives = p.relatives.filter((r) => !(r.relation === "Friend" && r.partnerStatus === "ex" && r.lostYear !== undefined && p.year - r.lostYear > 20));
}

export function reachOut(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const f = p.relatives.find((r) => r.id === relId && r.alive && r.relation === "Friend" && r.partnerStatus === "ex");
  if (!f) return { player: p0 };
  const n = first(f);
  if ((p.annual[`reach:${f.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Wait a While", `You've already reached out to ${n} this year.`)] };
  p.annual[`reach:${f.id}`] = 1;
  const gone = p.year - (f.lostYear ?? p.year);
  const chance = clamp(0.6 - gone * 0.03 + (p.talents.empathy - 50) / 300 - (f.grievances ?? []).reduce((s, g) => s + g.weight, 0) * 0.04, 0.12, 0.85);
  if (rng.chance(chance)) {
    f.partnerStatus = undefined;
    f.lostYear = undefined;
    f.riftYear = undefined;
    f.grievances = [];
    f.relationshipBar = clamp(40 + rng.int(0, 15));
    remember(p, f, "milestone", `You and ${n} found each other again after ${gone || "a few"} years.`);
    changeStat(p, "happiness", 5);
    const body = `You sent ${n} a message that took you an hour to write. They replied within minutes: "I was just thinking about you." You talked until the phone died.`;
    addLog(p, body);
    return { player: p, notices: [info("Back in Touch", body, "good")] };
  }
  changeStat(p, "happiness", -2);
  const body = `You wrote to ${n}. The message was read, and nothing came back. Some doors only open from one side.`;
  addLog(p, body);
  return { player: p, notices: [info("No Reply", body, "bad")] };
}
