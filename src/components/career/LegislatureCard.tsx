"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { INDICATORS, LAW_BY_ID } from "@/data/laws";
import { APPROACHES, availableBills, billChance, effectChips, executiveOrder, horseTradeCost, isEnacted, issueName, nationApproval, pushBill, repealLaw, type Approach } from "@/engine/legislature";
import { inOffice } from "@/engine/politics";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

/** Governing: how the country is doing, what you can legislate, and the laws on the books. */
export default function LegislatureCard() {
  const { player: p, act } = useGame();
  const [approach, setApproach] = useState<Approach>("plain");
  const sc = p.statecraft;
  if (!inOffice(p)) return null;
  const bills = availableBills(p).filter((l) => !isEnacted(p, l.id));
  const mine = sc.laws.filter((l) => l.country === p.residence.country);
  const used = (p.annual["pol:policy"] ?? 0) >= 1;
  return (
    <>
      <SectionTitle hint={`approval of the nation ${Math.round(nationApproval(p))}`}>How the Country Is Doing</SectionTitle>
      <Card>
        <div className="flex flex-col gap-1.5">
          {INDICATORS.map((i) => (
            <StatBar key={i.id} label={`${i.emoji} ${i.name}`} value={sc.indicators[i.id] ?? 50} color={(sc.indicators[i.id] ?? 50) < 30 ? "red" : (sc.indicators[i.id] ?? 50) < 55 ? "amber" : "green"} compact />
          ))}
        </div>
      </Card>

      <SectionTitle hint={used ? "one floor fight a year: used" : "one floor fight a year"}>Legislate</SectionTitle>
      <Card>
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          {APPROACHES.map((a) => (
            <Button key={a.id} variant={approach === a.id ? "primary" : "secondary"} className="px-1 py-1.5 text-xs" title={a.blurb} onClick={() => setApproach(a.id)}>{a.name}{a.id === "horse_trade" ? ` (${money(horseTradeCost(p))})` : ""}</Button>
          ))}
        </div>
        <p className="mb-2 text-xs text-slate-400">{APPROACHES.find((a) => a.id === approach)?.blurb}</p>
        {bills.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing you can propose from this office that matches your platform. Change your stances to open up other bills.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {bills.map((l) => (
              <div key={l.id} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{l.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{issueName(l.issue)} · {Math.round(billChance(p, l, approach) * 100)}%</span>
                </div>
                <div className="text-xs text-slate-400">{l.blurb}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {effectChips(l).map((c) => <span key={c.label} className={c.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>{c.label} {c.delta > 0 ? "+" : ""}{c.delta}</span>)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Button variant="primary" className="py-1.5 text-xs" disabled={used} onClick={() => act((pl, rng) => pushBill(pl, rng, l.id, approach))}>Put it to a vote</Button>
                  <Button variant="secondary" className="py-1.5 text-xs" onClick={() => act((pl, rng) => executiveOrder(pl, rng, l.id))}>Sign an order</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {mine.length > 0 && (
        <>
          <SectionTitle hint={`${mine.length}`}>Laws You Passed</SectionTitle>
          <Card>
            <ul className="flex flex-col gap-1.5">
              {mine.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{LAW_BY_ID[l.id]?.name ?? l.id} <span className="text-xs text-slate-400">({l.year}{l.power < 1 ? ", watered down" : ""})</span></span>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => act((pl, rng) => repealLaw(pl, rng, l.id))}>Repeal</Button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
