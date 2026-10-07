import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "@/engine/state";
import { ageUp } from "@/engine/ageUp";
import { BUSINESS_TYPES, hireManager, startBusiness } from "@/engine/paths";
import type { PlayerState } from "@/types/game.types";

let current: PlayerState;
vi.mock("@/context/GameStateContext", () => ({ useGame: () => ({ player: current, act: () => undefined }) }));

import { BusinessSection } from "../BusinessSection";

const render = () => renderToString(createElement(BusinessSection));

function owner(kind: string, seed = 1): PlayerState {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 34;
  p.smarts = 90;
  p.skills.charisma = 50;
  p.skills.athletics = 50;
  p.bankBalance = 3_000_000;
  p.education.degrees = ["highschool"];
  return startBusiness(p, kind, "Dashboard Test", rng).player;
}

describe("BusinessSection renders", () => {
  beforeEach(() => {
    current = owner("restaurant");
  });

  it("shows every business type with honest outlooks when you own nothing", () => {
    const p = owner("restaurant");
    current = { ...p, business: null, flags: p.flags.filter((f) => f !== "business_owner") };
    const html = render();
    for (const b of BUSINESS_TYPES) expect(html).toContain(b.name.replace("&", "&amp;"));
    expect(html).toContain("fail in 5 yrs");
    expect(html).not.toMatch(/NaN|undefined/);
  });

  it("explains why you are blocked when you hold a job", () => {
    const p = owner("restaurant");
    current = { ...p, business: null, currentJob: { title: "Cashier", company: "Shop", salary: 20_000, tier: 0, lineId: "retail", performance: 60, partTime: false, yearsInRole: 0 } as never };
    expect(render()).toContain("You can&#x27;t run a business while working as a Cashier");
  });

  it("renders the dashboard before and after trading history, with and without a manager", () => {
    const rng = makeRng(5);
    let p = owner("gym", 3);
    current = p;
    let html = render();
    for (const needle of ["Your Business", "Profit history", "Next year&#x27;s outlook", "Operations", "Who runs it?"]) expect(html).toContain(needle);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    for (let i = 0; i < 4; i++) p = { ...ageUp(p, rng).player, queuedEvents: [] };
    p = hireManager(p, rng, "solid").player;
    current = p;
    html = render();
    expect(html).toContain("manages the business");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("renders the dashboard for every business type", () => {
    for (const b of BUSINESS_TYPES) {
      current = owner(b.id, 7);
      const html = render();
      expect(html, b.id).toContain("Dashboard Test");
      expect(html, b.id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});
