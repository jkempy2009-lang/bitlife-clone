"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { BUSINESS_TYPES, investInBusiness, sellBusiness, startBusiness, MARKETING_COST, MAX_LOCATIONS, expandBusiness, fireStaff, hireStaff, maxStaff, runMarketing, STAFF_SALARY, workOnBusiness } from "@/engine/paths";
import { blockerFor } from "@/engine/occupation";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle } from "../ui";

export function BusinessSection() {
  const { player: p, act } = useGame();
  const [name, setName] = useState("");
  const biz = p.business;

  if (biz) {
    const kind = BUSINESS_TYPES.find((b) => b.id === biz.kind)!;
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>Your Business</SectionTitle>
        <Card>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{kind.emoji}</span>
            <div>
              <div className="text-lg font-bold">{biz.name}</div>
              <div className="text-xs text-slate-400">{kind.name} · founded {biz.founded}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div><div className="text-xs text-slate-400">Valuation</div><div className="text-lg font-bold text-amber-300">{money(biz.value)}</div></div>
            <div><div className="text-xs text-slate-400">Last year's profit</div><div className={`text-lg font-bold ${biz.lastProfit < 0 ? "text-rose-300" : "text-emerald-300"}`}>{money(biz.lastProfit)}</div></div>
          </div>
        </Card>
        <Button variant="primary" disabled={(p.annual.bizwork ?? 0) >= 1} onClick={() => act((pl) => workOnBusiness(pl))}>
          💪 Work Overtime (+12% profit this year)
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={p.bankBalance < 25_000} onClick={() => act((pl) => investInBusiness(pl, 25_000))}>Invest $25,000</Button>
          <Button variant="secondary" disabled={p.bankBalance < 100_000} onClick={() => act((pl) => investInBusiness(pl, 100_000))}>Invest $100,000</Button>
        </div>
        <Card className="p-3">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">Operations</span>
            <span className="text-slate-400">{biz.staff} staff · {biz.locations} location{biz.locations > 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={biz.staff >= maxStaff(biz.locations) || p.bankBalance < 3_000} onClick={() => act((pl) => hireStaff(pl))}>👤 Hire Staff</Button>
            <Button variant="ghost" disabled={biz.staff <= 0} onClick={() => act((pl) => fireStaff(pl))}>Let Someone Go</Button>
            <Button variant="secondary" disabled={(p.annual.marketing ?? 0) >= 1 || p.bankBalance < MARKETING_COST} onClick={() => act((pl) => runMarketing(pl))}>📣 Marketing ({money(MARKETING_COST)})</Button>
            <Button variant="secondary" disabled={biz.locations >= MAX_LOCATIONS || p.bankBalance < biz.value * 0.6} onClick={() => act((pl) => expandBusiness(pl))}>🏪 Expand ({money(biz.value * 0.6)})</Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Each employee adds 4% to profit but costs {money(STAFF_SALARY)} a year. More locations multiply value and risk.</p>
        </Card>
        <Button variant="ghost" onClick={() => act((pl) => sellBusiness(pl))}>Sell Business ({money(biz.value * 0.9)})</Button>
        <p className="text-xs text-slate-500">Profit is taxed as income. Risky ventures can go bankrupt; tech startups may get acquired.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="a full-time commitment">Start a Business</SectionTitle>
      {blockerFor(p, "business") && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">🔒 {blockerFor(p, "business")}</p>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Business name (optional)"
        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      {BUSINESS_TYPES.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
          <span className="text-3xl">{b.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{b.name}</div>
            <div className="text-xs text-slate-400">{b.blurb}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Pill tone={b.vol > 0.5 ? "red" : b.vol > 0.25 ? "amber" : "green"}>{b.vol > 0.5 ? "Wild" : b.vol > 0.25 ? "Volatile" : "Stable"}</Pill>
              <Pill>{b.minSmarts}+ Smarts</Pill>
            </div>
          </div>
          <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={p.bankBalance < b.cost || p.smarts < b.minSmarts || p.age < 18 || !!blockerFor(p, "business")} onClick={() => act((pl) => startBusiness(pl, b.id, name))}>
            {money(b.cost)}
          </Button>
        </div>
      ))}
    </div>
  );
}
