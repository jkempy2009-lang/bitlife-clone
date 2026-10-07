"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { buyCar, buyHouse, carInventory, houseInventory, maxLoan, renovate, repayLoan, sellCar, sellHouse, takeLoan } from "@/engine/assets";
import { CAR_LOAN_RATE, CAR_LOAN_YEARS, MORTGAGE_RATE, MORTGAGE_YEARS } from "@/data/assetsCatalog";
import { money } from "@/lib/format";
import { Button, Card, MiniBar, Pill, Segmented, SectionTitle } from "./ui";

type Panel = "cars" | "homes" | "bank";

export default function AssetsTab() {
  const [panel, setPanel] = useState<Panel>("cars");
  return (
    <div>
      <Segmented<Panel>
        value={panel}
        onChange={setPanel}
        options={[
          { id: "cars", label: "🚗 Car Dealership" },
          { id: "homes", label: "🏠 Real Estate" },
          { id: "bank", label: "🏦 Bank" },
        ]}
      />
      {panel === "cars" && <Cars />}
      {panel === "homes" && <Homes />}
      {panel === "bank" && <Bank />}
    </div>
  );
}

function Cars() {
  const { player: p, act } = useGame();
  const inventory = useMemo(() => carInventory(p.year, p.id), [p.year, p.id]);
  return (
    <div className="flex flex-col gap-3">
      {p.vehicles.length > 0 && (
        <>
          <SectionTitle>Your Garage</SectionTitle>
          {p.vehicles.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{v.yearManufactured} {v.name}</div>
                  <div className="text-xs text-slate-400">Worth {money(v.currentValue)} · bought {money(v.purchasePrice)}</div>
                  {v.loanBalance > 0 && <div className="text-xs text-amber-300">Loan: {money(v.loanBalance)} ({money(v.loanPaymentAnnual)}/yr, {v.loanYearsLeft}y left)</div>}
                </div>
                <Button variant="ghost" className="shrink-0 px-3 py-1.5" onClick={() => act((pl) => sellCar(pl, v.id))}>Sell</Button>
              </div>
              <div className="mt-2 text-xs text-slate-400">Condition {Math.round(v.condition)}%</div>
              <MiniBar value={v.condition} />
            </Card>
          ))}
        </>
      )}
      <SectionTitle hint={`Financing: 10% down, ${CAR_LOAN_YEARS}y @ ${CAR_LOAN_RATE * 100}%`}>Showroom</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {inventory.map((l) => {
          const locked = p.age < l.arch.minAge;
          return (
            <Card key={l.listingId} className="p-3">
              <div className="text-3xl">{l.arch.emoji}</div>
              <div className="font-semibold">{l.arch.name}</div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-center text-xs">
                <div><div className="text-slate-500">Cost</div><div className="font-bold">{money(l.price)}</div></div>
                <div><div className="text-slate-500">Condition</div><div className="font-bold">{l.condition}%</div></div>
                <div><div className="text-slate-500">Year</div><div className="font-bold">{l.year}</div></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="primary" className="px-2" disabled={locked || p.bankBalance < l.price} onClick={() => act((pl, rng) => buyCar(pl, l, false, rng))}>
                  Buy cash
                </Button>
                <Button variant="secondary" className="px-2" disabled={locked || p.bankBalance < l.price * 0.1} onClick={() => act((pl, rng) => buyCar(pl, l, true, rng))}>
                  Finance
                </Button>
              </div>
              {locked && <div className="mt-1 text-xs text-rose-300">🔒 Age {l.arch.minAge}+</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Homes() {
  const { player: p, act } = useGame();
  const inventory = useMemo(() => houseInventory(p.year, p.id), [p.year, p.id]);
  return (
    <div className="flex flex-col gap-3">
      {p.properties.length > 0 && (
        <>
          <SectionTitle>Your Properties</SectionTitle>
          {p.properties.map((h) => (
            <Card key={h.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-xs text-slate-400">Worth {money(h.currentValue)} · bought {money(h.originalValue)}</div>
                  {h.mortgageBalance > 0 && <div className="text-xs text-amber-300">Mortgage: {money(h.mortgageBalance)} ({money(h.monthlyMortgage)}/mo, {h.remainingTerm}y left)</div>}
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">Condition {Math.round(h.condition)}%</div>
              <MiniBar value={h.condition} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="primary" disabled={h.condition >= 100 || p.bankBalance < h.currentValue * 0.1} onClick={() => act((pl) => renovate(pl, h.id))}>
                  🔨 Renovate ({money(h.currentValue * 0.1)})
                </Button>
                <Button variant="ghost" onClick={() => act((pl) => sellHouse(pl, h.id))}>Sell</Button>
              </div>
            </Card>
          ))}
        </>
      )}
      <SectionTitle hint={`Mortgage: 20% down, ${MORTGAGE_YEARS}y @ ${MORTGAGE_RATE * 100}%`}>On the Market</SectionTitle>
      {inventory.map((l) => (
        <Card key={l.listingId} className="p-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{l.arch.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{l.arch.name}</div>
              <div className="text-xs text-slate-400">{l.arch.blurb}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Pill>{l.arch.beds} bed</Pill>
                <Pill>{l.arch.baths} bath</Pill>
                <Pill>{l.arch.sqft.toLocaleString()} sqft</Pill>
                <Pill tone={l.condition >= 70 ? "green" : l.condition >= 45 ? "amber" : "red"}>Condition {l.condition}%</Pill>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-lg font-bold tabular-nums text-amber-300">{money(l.price)}</div>
            <div className="flex gap-2">
              <Button variant="primary" className="px-3 py-1.5" disabled={p.age < 18 || p.bankBalance < l.price} onClick={() => act((pl, rng) => buyHouse(pl, l, false, rng))}>Buy cash</Button>
              <Button variant="secondary" className="px-3 py-1.5" disabled={p.age < 18 || p.bankBalance < l.price * 0.2} onClick={() => act((pl, rng) => buyHouse(pl, l, true, rng))}>Mortgage</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Bank() {
  const { player: p, act } = useGame();
  const limit = maxLoan(p);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Your Accounts</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><div className="text-xs text-slate-400">Cash</div><div className="text-lg font-bold text-emerald-300">{money(p.bankBalance)}</div></div>
          <div><div className="text-xs text-slate-400">Debt</div><div className={`text-lg font-bold ${p.outstandingLoans > 0 ? "text-rose-300" : ""}`}>{money(p.outstandingLoans)}</div></div>
          <div><div className="text-xs text-slate-400">Credit score</div><div className="text-lg font-bold">{p.creditScore}</div></div>
          <div><div className="text-xs text-slate-400">Taxes last year</div><div className="text-lg font-bold">{money(p.taxesPaidThisYear)}</div></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Loans accrue 7% interest and are repaid automatically each year. Overdrafts become loans and hurt your credit.</p>
      </Card>
      <SectionTitle hint={`you can borrow up to ${money(limit)}`}>Take a Loan</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[5_000, 25_000, 100_000].map((amt) => (
          <Button key={amt} variant="secondary" disabled={amt > limit} onClick={() => act((pl) => takeLoan(pl, amt))}>
            {money(amt)}
          </Button>
        ))}
      </div>
      {p.outstandingLoans > 0 && (
        <>
          <SectionTitle>Repay</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={p.bankBalance <= 0} onClick={() => act((pl) => repayLoan(pl, 5_000))}>Repay $5,000</Button>
            <Button variant="primary" disabled={p.bankBalance <= 0} onClick={() => act((pl) => repayLoan(pl, pl.outstandingLoans))}>Repay All</Button>
          </div>
        </>
      )}
    </div>
  );
}
