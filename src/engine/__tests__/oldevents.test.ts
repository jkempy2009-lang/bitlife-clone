import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { resolveEvent } from "../events";
import { formBand, recruitMember } from "../music";
import { startChannel } from "../influencer";
import { LIFE_EVENTS } from "@/data/lifeEventsEngine";

const ev = (id: string) => LIFE_EVENTS.find((e) => e.id === id)!;

describe("fame events use the creative state", () => {
  it("the band breakup only applies to a band, and going solo really leaves it", () => {
    const rng = makeRng(1);
    let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 25;
    p.skills.music = 60;
    expect(ev("band_breakup").requires!.custom!(p)).toBe(false);
    p = formBand(p, 90, rng).player;
    p.annual.recruit = 0;
    p = recruitMember(p, rng).player;
    expect(ev("band_breakup").requires!.custom!(p)).toBe(true);
    const mediated = resolveEvent(p, ev("band_breakup"), 0, rng).player;
    expect(mediated.music.status).toBe("band");
    const solo = resolveEvent(p, ev("band_breakup"), 1, rng).player;
    expect(solo.music.status).not.toBe("band");
    expect(solo.music.formerBand).toBeTruthy();
  });

  it("the cancelled event needs a real audience and costs trust or followers", () => {
    const rng = makeRng(2);
    let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 25;
    p.fame = 40;
    expect(ev("influencer_scandal").requires!.custom!(p)).toBe(false);
    p = startChannel(p, rng).player;
    p.influencer.followers = 80_000;
    expect(ev("influencer_scandal").requires!.custom!(p)).toBe(true);
    const out = resolveEvent(p, ev("influencer_scandal"), 0, rng).player;
    expect(out.influencer.followers).toBeLessThan(80_000);
    expect(out.influencer.authenticity).toBeLessThan(p.influencer.authenticity + 1);
  });
});

describe("quitting an acting job under a TV contract", () => {
  it("breaks the contract (damages and reputation) instead of silently walking away", async () => {
    const { quitJob } = await import("../career");
    const rng = makeRng(3);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 30;
    p.bankBalance = 100_000;
    p.currentJob = { id: "j", title: "Actor", company: "Studio", salary: 80_000, performance: 70, tier: 2, lineId: "actor" } as never;
    p.acting.series = { title: "Night Shift", status: "running", fee: 60_000, yearsLeft: 3, seasons: 2 } as never;
    p.acting.reputation = 60;
    const out = quitJob(p).player;
    expect(out.currentJob).toBeNull();
    expect(out.acting.series).toBeNull();
    expect(out.bankBalance).toBeLessThan(p.bankBalance);
    expect(out.acting.reputation).toBeLessThan(60);
    const broke = { ...p, bankBalance: 100 } as typeof p;
    expect(quitJob(broke).player).toBe(broke); // cannot afford to leave
  });
});
