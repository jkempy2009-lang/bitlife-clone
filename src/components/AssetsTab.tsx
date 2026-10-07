"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { buyCar, buyHouse, carInventory, houseInventory, maxLoan, renovate, repayLoan, sellCar, sellHouse, takeLoan } from "@/engine/assets";
import { CAR_LOAN_RATE, CAR_LOAN_YEARS, MORTGAGE_RATE, MORTGAGE_YEARS } from "@/data/assetsCatalog";
import { money } from "@/lib/format";
import { Button, Card, MiniBar, Pill, Segmented, SectionTitle, TooYoung } from "./ui";
import { COUNTRIES } from "@/data/countries";
import { INVESTMENTS, RELOCATE_ABROAD, RELOCATE_DOMESTIC, LIFESTYLES, RENT_TIERS, divest, invest, portfolioValue, relocate, setLifestyle, setRentTier } from "@/engine/world";

type Panel = "cars" | "homes" | "living" | "invest" | "bank";

export default function AssetsTab() {
  const { player } = useGame();
  const [panel, setPanel] = useState<Panel>("cars");
  if (player.age < 16) return <TooYoung>Cars and houses can wait. Come back when you're 16 (or inherit a castle).</TooYoung>;
  return (
    <div>
      <Segmented<Panel>
        value={panel}
        onChange={setPanel}
        options={[
          { id: "cars", label: "🚗 Car Dealership" },
          { id: "homes", label: "🏠 Real Estate" },
          { id: "living", label: "🛋️ Living" },
          { id: "invest", label: "📈 Invest" },
          { id: "bank", label: "🏦 Bank" },
        ]}
      />
      {panel === "cars" && <Cars />}
      {panel === "homes" && <Homes />}
      {panel === "living" && <Living />}
      {panel === "invest" && <Invest />}
      {panel === "bank" && <Bank />}
    </div>
  );
}

const CLIMATE_LABEL = { boom: "📈 Boom", normal: "➖ Steady", recession: "📉 Recession" } as const;

function Living() {
  const { player: p, act } = useGame();
  const owns = p.properties.length > 0;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Where You Live</SectionTitle>
      <Card>
        <div className="text-lg font-bold">{p.residence.city}, {p.residence.country}</div>
        <div className="mt-1 text-sm text-slate-400">
          {owns ? "You own your home, so rent doesn't apply (utilities and upkeep still do)." : `Renting a ${RENT_TIERS[p.residence.rentTier].name.toLowerCase()}.`}
        </div>
        <div className="mt-2"><Pill tone={p.economy.climate === "recession" ? "red" : p.economy.climate === "boom" ? "green" : "slate"}>{CLIMATE_LABEL[p.economy.climate]}</Pill></div>
      </Card>

      {!owns && (
        <>
          <SectionTitle hint="a $500 moving fee applies">Rent</SectionTitle>
          {RENT_TIERS.map((t, i) => (
            <button
              key={t.name}
              type="button"
              disabled={i === p.residence.rentTier || p.age < 18}
              onClick={() => act((pl) => setRentTier(pl, i))}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-default ${i === p.residence.rentTier ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700/60 bg-slate-800/70 hover:border-emerald-500/60"}`}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="flex-1">
                <span className="block font-semibold">{t.name}</span>
                <span className="text-xs text-slate-400">{t.blurb}</span>
              </span>
              <span className="text-sm font-semibold text-slate-200">{money(t.rent)}/yr</span>
            </button>
          ))}
        </>
      )}

      <SectionTitle hint="what you spend day to day">Lifestyle</SectionTitle>
      {LIFESTYLES.map((t, i) => (
        <button
          key={t.name}
          type="button"
          disabled={i === p.lifestyle || p.age < 18}
          onClick={() => act((pl) => setLifestyle(pl, i))}
          className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-default ${i === p.lifestyle ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700/60 bg-slate-800/70 hover:border-emerald-500/60"}`}
        >
          <span className="text-2xl">{t.emoji}</span>
          <span className="flex-1">
            <span className="block font-semibold">{t.name}</span>
            <span className="text-xs text-slate-400">{t.blurb}</span>
          </span>
        </button>
      ))}

      <SectionTitle hint="you'll leave your job behind">Relocate</SectionTitle>
      <Card>
        <p className="mb-2 text-xs text-slate-400">Move within your country for {money(RELOCATE_DOMESTIC)} or abroad for {money(RELOCATE_ABROAD)}. Your tax rules change with where you live. Friends and family drift further away.</p>
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map((c) => (
            <Button
              key={c.name}
              variant={c.name === p.residence.country ? "primary" : "secondary"}
              className="px-2 py-1.5 text-xs"
              disabled={p.age < 18}
              onClick={() => act((pl, rng) => relocate(pl, c.name, rng))}
            >
              {c.name === p.residence.country ? "📍 " : ""}{c.name}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Invest() {
  const { player: p, act } = useGame();
  const total = portfolioValue(p);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="15% tax on gains when you sell">Portfolio</SectionTitle>
      <Card>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-slate-400">Total value</div>
          <div className="text-3xl font-black tabular-nums text-amber-300">{money(total)}</div>
          <div className="mt-1"><Pill tone={p.economy.climate === "recession" ? "red" : p.economy.climate === "boom" ? "green" : "slate"}>Market: {CLIMATE_LABEL[p.economy.climate]}</Pill></div>
        </div>
      </Card>
      {INVESTMENTS.map((inv) => {
        const h = p.investments[inv.id];
        return (
          <Card key={inv.id} className="p-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{inv.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{inv.name}</div>
                <div className="text-xs text-slate-400">{inv.blurb} Avg {Math.round(inv.mean * 100)}%/yr</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums">{money(h?.value ?? 0)}</div>
                {h && <div className={`text-xs tabular-nums ${h.value >= h.basis ? "text-emerald-400" : "text-rose-400"}`}>{h.value >= h.basis ? "+" : ""}{money(h.value - h.basis)}</div>}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[1_000, 10_000, 100_000].map((amt) => (
                <Button key={amt} variant="secondary" className="px-1 py-1.5 text-xs" disabled={p.bankBalance < amt || p.age < 18} onClick={() => act((pl) => invest(pl, inv.id, amt))}>
                  +{money(amt)}
                </Button>
              ))}
              <Button variant="ghost" className="px-1 py-1.5 text-xs" disabled={!h} onClick={() => act((pl) => divest(pl, inv.id))}>Sell all</Button>
            </div>
          </Card>
        );
      })}
      <p className="text-xs text-slate-500">Returns are rolled when you age up and follow the economic climate: booms lift stocks, recessions hammer them.</p>
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
