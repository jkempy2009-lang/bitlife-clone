import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { discussDesires, setIntimacyPrefs, shareExperience, toggleGender, toggleInterest } from "../desire";
import { adultRange, tasteOf } from "../people";
import { closeRelationship, hookUp, proposeOpenRelationship, askThreesome, seduce, SEDUCE_TARGETS, processIntimacy } from "../intimacy";
import { meetSomeone } from "../social";
import { EXPERIENCES } from "@/data/experiences";
import type { PlayerState, Relative } from "@/types/game.types";

const adult = (seed: number, age = 30): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = age;
  p.bankBalance = 100_000;
  p.looks = 80;
  return { rng, p };
};

const lover = (over: Partial<Relative> = {}): Relative => ({
  id: "L1", relation: "Partner", name: "Alex Partner", age: 31, relationshipBar: 80, health: 90, alive: true, incomeTier: 3,
  gender: "Female", smarts: 60, looks: 60, partnerStatus: "dating", openness: 70, jealousy: 30, ...over,
});

describe("preferences", () => {
  it("never allows an age below 18, and keeps min <= max", () => {
    const { p } = adult(1);
    const a = setIntimacyPrefs(p, { ageAuto: false, ageMin: 5, ageMax: 2 }).player;
    expect(a.intimacy.ageMin).toBe(18);
    expect(a.intimacy.ageMax).toBeGreaterThanOrEqual(a.intimacy.ageMin);
    expect(adultRange(a)[0]).toBeGreaterThanOrEqual(18);
    const young = adult(2, 18).p;
    expect(adultRange(young)[0]).toBeGreaterThanOrEqual(18);
  });

  it("generates only adults inside the chosen range and genders across many encounters", () => {
    let { p } = adult(3, 40);
    p = setIntimacyPrefs(p, { ageAuto: false, ageMin: 50, ageMax: 65, genders: ["Female"] }).player;
    for (let s = 1; s <= 60; s++) {
      const res = hookUp({ ...structuredClone(p), annual: {} }, "bar", true, makeRng(s), "casual");
      for (const r of res.player.relatives.filter((x) => x.relation === "Lover")) {
        expect(r.age).toBeGreaterThanOrEqual(50);
        expect(r.age).toBeLessThanOrEqual(65);
        expect(r.gender).toBe("Female");
      }
    }
    const date = meetSomeone({ ...p, relatives: p.relatives.filter((r) => r.relation !== "Partner") }, "date", makeRng(5));
    const ev = date.notices?.[0];
    expect(ev && "event" in ev ? ev.event.description : "").toMatch(/\((5\d|6[0-5])\)/);
  });

  it("toggles genders and interests", () => {
    const { p } = adult(4);
    const g = toggleGender(p, "Male").player;
    expect(g.intimacy.genders).toEqual(["Male"]);
    expect(toggleGender(g, "Male").player.intimacy.genders).toEqual([]);
    const i = toggleInterest(p, "kink").player;
    expect(i.intimacy.interests).toContain("kink");
    expect(toggleInterest(i, "kink").player.intimacy.interests).not.toContain("kink");
  });
});

describe("tastes and experiences", () => {
  it("tastes are deterministic per person and more adventurous interests are rarer", () => {
    const rel = lover();
    expect(tasteOf(rel, "kink")).toBe(tasteOf(rel, "kink"));
    let likesSensual = 0;
    let likesGroup = 0;
    for (let i = 0; i < 400; i++) {
      const r = lover({ id: `p${i}`, openness: 50 });
      if (tasteOf(r, "sensual") === "like") likesSensual++;
      if (tasteOf(r, "group") === "like") likesGroup++;
    }
    expect(likesSensual).toBeGreaterThan(likesGroup);
  });

  it("requires your own opt-in, trust and funds; a limit is respected and nothing happens", () => {
    const { rng, p } = adult(5);
    const rel = lover({ tastes: { kink: "limit", playful: "like" } });
    p.relatives.push(rel);
    // Not opted in to kink
    const noOpt = shareExperience(p, "L1", "kink", true, rng);
    expect(noOpt.notices?.[0]).toMatchObject({ title: "Not On Your List" });
    p.intimacy.interests = ["sensual", "playful", "kink"];
    // Limit: they refuse; no pregnancy/disease/happiness windfall
    const before = structuredClone(p);
    const refused = shareExperience(p, "L1", "kink", true, rng);
    expect(refused.notices?.[0]).toMatchObject({ title: "Not For Them" });
    expect(refused.player.relatives.find((r) => r.id === "L1")!.knownTastes).toContain("kink");
    expect(refused.player.pregnancy).toBeNull();
    expect(refused.player.happiness).toBeLessThanOrEqual(before.happiness);
    // A liked experience goes ahead and the bond grows
    const ok = shareExperience(p, "L1", "roleplay", true, makeRng(11));
    expect(ok.player.relatives.find((r) => r.id === "L1")!.relationshipBar).toBeGreaterThan(80 - 1);
    // Low trust blocks the heavier experiences
    const weak = lover({ id: "L2", relationshipBar: 20 });
    p.relatives.push(weak);
    expect(shareExperience(p, "L2", "kink", true, rng).notices?.[0]).toMatchObject({ title: "Not There Yet" });
  });

  it("respects annual caps and never works with minors or mature content off", () => {
    const { p } = adult(6);
    p.intimacy.interests = ["sensual", "playful", "toys", "photo", "adventurous", "kink", "group", "digital"];
    p.relatives.push(lover({ tastes: Object.fromEntries(["sensual", "playful", "toys", "photo", "adventurous", "kink", "group", "digital"].map((t) => [t, "like" as const])) }));
    const exp = EXPERIENCES.find((e) => e.id === "boudoir")!;
    let q = p;
    let done = 0;
    for (let i = 0; i < 6; i++) {
      const r = shareExperience(q, "L1", "boudoir", true, makeRng(20 + i));
      if (r.player !== q) done++;
      q = r.player;
    }
    expect(done).toBe(exp.cap);

    const off = { ...structuredClone(p), matureContent: false };
    expect(shareExperience(off, "L1", "massage", true, makeRng(1)).player).toBe(off);
    const kid = { ...structuredClone(p), age: 16 };
    expect(shareExperience(kid, "L1", "massage", true, makeRng(1)).player).toBe(kid);
    const minorPartner = structuredClone(p);
    minorPartner.relatives.find((r) => r.id === "L1")!.age = 17;
    expect(shareExperience(minorPartner, "L1", "massage", true, makeRng(1)).player).toBe(minorPartner);
  });

  it("talking about desires reveals a taste once a year and builds the bond", () => {
    const { p } = adult(7);
    p.relatives.push(lover({ relationshipBar: 50 }));
    const t1 = discussDesires(p, "L1").player;
    const rel = t1.relatives.find((r) => r.id === "L1")!;
    expect(rel.knownTastes?.length).toBe(1);
    expect(rel.relationshipBar).toBeGreaterThan(50);
    expect(discussDesires(t1, "L1").notices?.[0]).toMatchObject({ title: "Already Talked" });
  });
});

describe("relationship styles", () => {
  it("polyamory is a separate agreement from an open relationship, and you can go back to exclusive", () => {
    let found: PlayerState | null = null;
    for (let s = 1; s <= 30 && !found; s++) {
      const { p } = adult(100 + s);
      p.relatives.push(lover({ relationshipBar: 90, openness: 95, jealousy: 10, partnerStatus: "married" }));
      const r = proposeOpenRelationship(p, makeRng(s), "poly").player;
      if (r.flags.includes("polyamorous")) found = r;
    }
    expect(found).not.toBeNull();
    expect(found!.flags).not.toContain("open_relationship");
    const closed = closeRelationship(found!).player;
    expect(closed.flags).not.toContain("polyamorous");
  });

  it("a threesome needs the interest and is never offered to someone with a hard limit", () => {
    const { p } = adult(8);
    p.relatives.push(lover({ tastes: { group: "limit" } }));
    expect(askThreesome(p, true, makeRng(1)).notices?.[0]).toMatchObject({ title: "Not On Your List" });
    p.intimacy.interests.push("group");
    let said = 0;
    for (let s = 1; s <= 40; s++) {
      const r = askThreesome({ ...structuredClone(p), annual: {} }, true, makeRng(s));
      if (r.player.flags.includes("threesome")) said++;
    }
    expect(said).toBeLessThanOrEqual(3);
  });
});

describe("planning an evening", () => {
  it("their reaction reflects their tastes; a limit blocks the plan and a no stays a no", async () => {
    const { sceneReaction, playScene, SCENE_MOODS } = await import("../desire");
    const rel = lover({ tastes: { playful: "like", kink: "limit" } });
    expect(sceneReaction(rel, SCENE_MOODS.find((m) => m.id === "playful")!).verdict).toBe("yes");
    expect(sceneReaction(rel, SCENE_MOODS.find((m) => m.id === "control")!).verdict).toBe("no");

    const { p } = adult(40);
    p.intimacy.interests = ["sensual", "playful", "kink"];
    p.relatives.push(rel);
    const refused = playScene(p, "L1", { setting: "home", mood: "control", extra: "none", checkIn: true, aftercare: true }, true, makeRng(1));
    expect(refused.notices?.[0]).toMatchObject({ title: "A Limit" });
    expect(refused.player.pregnancy).toBeNull();
    expect(refused.player.bankBalance).toBe(p.bankBalance);
  });

  it("matching tastes and checking in make for better evenings; costs, caps and opt-ins are enforced", async () => {
    const { playScene, SCENE_CAP } = await import("../desire");
    const gain = (checkIn: boolean, like: boolean) => {
      let total = 0;
      for (let s = 1; s <= 40; s++) {
        const { p } = adult(50);
        p.intimacy.interests = ["sensual", "playful"];
        p.relatives.push(lover({ tastes: like ? { playful: "like", sensual: "like" } : {}, relationshipBar: 60 }));
        const r = playScene(p, "L1", { setting: "home", mood: "playful", extra: "none", checkIn, aftercare: false }, true, makeRng(s)).player;
        total += r.relatives.find((x) => x.id === "L1")!.relationshipBar - 60;
      }
      return total / 40;
    };
    expect(gain(true, true)).toBeGreaterThan(gain(false, false));

    const { p } = adult(51);
    p.intimacy.interests = ["sensual", "playful"];
    p.relatives.push(lover({ tastes: {} }));
    // Not opted in to adventurous
    expect(playScene(p, "L1", { setting: "outdoors", mood: "tender", extra: "none", checkIn: true, aftercare: true }, true, makeRng(1)).notices?.[0]).toMatchObject({ title: "Not On Your List" });
    // Caps
    let q = p;
    let done = 0;
    for (let i = 0; i < SCENE_CAP + 2; i++) {
      const r = playScene(q, "L1", { setting: "home", mood: "tender", extra: "none", checkIn: true, aftercare: true }, true, makeRng(60 + i));
      if (r.player !== q) done++;
      q = r.player;
    }
    expect(done).toBe(SCENE_CAP);
    // Adults only and mature content off
    const off = { ...structuredClone(p), matureContent: false };
    expect(playScene(off, "L1", { setting: "home", mood: "tender", extra: "none", checkIn: true, aftercare: true }, true, makeRng(1)).player).toBe(off);
  });
});

describe("more people to be intimate with", () => {
  it("every kind is adult-only, gated by circumstance, and workplace ones carry consequences", () => {
    let bossLovers = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { rng, p } = adult(seed);
      p.matureContent = true;
      p.fame = 60;
      p.currentJob = { id: "j", title: "Analyst", company: "Acme", salary: 60_000, performance: 70, tier: 2, lineId: "corporate" } as never;
      p.annualSalary = 60_000;
      for (const t of SEDUCE_TARGETS) {
        if (t.need(p) && t.id !== "employee" && t.id !== "classmate") continue;
        const res = seduce(p, t.id, true, rng);
        for (const r of res.player.relatives) if (r.relation === "Lover") expect(r.age).toBeGreaterThanOrEqual(18);
        if (t.id === "boss" && res.player.relatives.some((r) => r.relation === "Lover" && r.traits?.includes("Your boss"))) {
          bossLovers++;
          // Over the years a boss romance ends, one way or another, and it never improves your standing.
          const q = res.player;
          for (let y = 0; y < 30; y++) processIntimacy(q, {}, rng, []);
          expect(q.relatives.filter((r) => r.traits?.includes("Your boss")).every((r) => r.partnerStatus === "ex")).toBe(true);
        }
      }
    }
    expect(bossLovers).toBeGreaterThan(0);
    // Employees need staff.
    const { p } = adult(2);
    p.matureContent = true;
    expect(SEDUCE_TARGETS.find((t) => t.id === "employee")!.need(p)).not.toBeNull();
  });
});
