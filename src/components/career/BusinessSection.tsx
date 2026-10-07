"use client";

import { useState, type ReactNode } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  BUSINESS_TYPES,
  INSURANCE_LABELS,
  PAYOUT_LABELS,
  PRICE_LABELS,
  acquireCompetitor,
  businessCosts,
  businessHealth,
  closeBusiness,
  complianceAudit,
  diversifyBusiness,
  expandBusiness,
  fileBankruptcy,
  fireManager,
  fireStaff,
  forecast,
  fundingTerms,
  handToManager,
  hireManager,
  hireStaff,
  investInBusiness,
  kindOf,
  liquidationValue,
  loanLimit,
  loanRateFor,
  pivotBusiness,
  raiseFunding,
  renovateBusiness,
  repayBusinessLoan,
  riskNotes,
  runMarketing,
  saleQuote,
  sellBusiness,
  sellFranchise,
  setInsurance,
  setPayout,
  setPrice,
  setRescue,
  startBusiness,
  takeBusinessLoan,
  trainStaff,
  typicalOutlook,
  upgradeProduct,
  workOnBusiness,
  CORP_TAX,
  SALE_FEE,
} from "@/engine/paths";
import { blockerFor } from "@/engine/occupation";
import { EFFORT_INFO } from "@/engine/occupation";
import { money } from "@/lib/format";
import type { Business, BusinessPayout, PlayerState } from "@/types/game.types";
import { Button, Card, MiniBar, Pill, Segmented, SectionTitle } from "../ui";

type Tab = "people" | "market" | "money" | "growth" | "exit";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const tone = (n: number) => (n < 0 ? "text-rose-300" : "text-emerald-300");

function Kpi({ label, value, sub, className = "" }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-900/60 px-2 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`truncate text-base font-bold tabular-nums ${className}`}>{value}</div>
      {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">{hint ?? Math.round(value)}</span>
      </div>
      <MiniBar value={value} />
    </div>
  );
}

/** Profit by year as bars around a zero line. */
function ProfitChart({ history }: { history: Business["history"] }) {
  const rows = history.slice(-10);
  if (rows.length === 0) return <p className="py-4 text-center text-xs text-slate-500">No trading history yet. Your first annual results appear after the next Age Up.</p>;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));
  const W = 300;
  const H = 90;
  const mid = H / 2;
  const bw = W / rows.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={`Profit by year: ${rows.map((r) => `${r.year} ${money(r.profit)}`).join(", ")}`}>
      <line x1="0" x2={W} y1={mid} y2={mid} stroke="currentColor" className="text-slate-600" strokeWidth="1" />
      {rows.map((r, i) => {
        const h = (Math.abs(r.profit) / max) * (mid - 6);
        const x = i * bw + bw * 0.15;
        return (
          <rect key={r.year} x={x} width={bw * 0.7} y={r.profit >= 0 ? mid - h : mid} height={Math.max(1, h)} rx="2" className={r.profit >= 0 ? "fill-emerald-500" : "fill-rose-500"}>
            <title>{`${r.year}: profit ${money(r.profit)}, revenue ${money(r.revenue)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function Decision({ title, cost, children, blurb }: { title: string; cost?: string; blurb: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {cost && <span className="shrink-0 text-xs tabular-nums text-amber-300">{cost}</span>}
      </div>
      <p className="mb-2 mt-0.5 text-xs text-slate-400">{blurb}</p>
      {children}
    </div>
  );
}

function Choice<T extends string | number>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${value === o.id ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Confirm({ label, danger = true, onConfirm, detail }: { label: string; danger?: boolean; onConfirm: () => void; detail: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button variant={danger ? "danger" : "ghost"} className="w-full" onClick={() => setArmed(true)}>{label}</Button>;
  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-2">
      <p className="mb-2 text-xs text-rose-200">{detail}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setArmed(false)}>Cancel</Button>
        <Button variant="danger" onClick={() => { setArmed(false); onConfirm(); }}>Confirm</Button>
      </div>
    </div>
  );
}

export function BusinessSection() {
  const { player: p } = useGame();
  const [name, setName] = useState("");
  if (!p.business) return <StartBusiness p={p} name={name} setName={setName} />;
  return <BusinessDashboard p={p} biz={p.business} />;
}

function StartBusiness({ p, name, setName }: { p: PlayerState; name: string; setName: (v: string) => void }) {
  const { act } = useGame();
  const blocked = blockerFor(p, "business");
  const cooloff = p.flags.some((f) => f.startsWith("biz_cooloff:"));
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="a full-time commitment">Start a Business</SectionTitle>
      <p className="text-xs text-slate-400">
        Running a company is a full-time job of its own: you can&apos;t also hold a job, sign with a label or study full time. Outcomes depend on market fit you can&apos;t see in advance, your effort, staff, cash and the economy. Many fail.
      </p>
      {blocked && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">🔒 {blocked}</p>}
      {!blocked && p.flags.includes("biz_bankrupt") && !cooloff && <p className="rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">Your last bankruptcy is behind you, but lenders remember it. Expect worse loan terms.</p>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Business name (optional)"
        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      {BUSINESS_TYPES.map((b) => {
        const out = typicalOutlook(b, p);
        const skillMiss = b.skill && p.skills[b.skill.key] < b.skill.min;
        const reason = p.age < 18 ? "Must be 18+" : p.smarts < b.minSmarts ? `Needs ${b.minSmarts}+ Smarts` : skillMiss ? `Needs ${b.skill!.min}+ ${b.skill!.label}` : p.bankBalance < b.cost ? "Not enough cash" : null;
        const risk = b.fail5 >= 60 ? "Wild" : b.fail5 >= 35 ? "Volatile" : "Stable";
        return (
          <div key={b.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{b.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-slate-400">{b.blurb}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Pill tone={risk === "Wild" ? "red" : risk === "Volatile" ? "amber" : "green"}>{risk}</Pill>
                  <Pill>{b.minSmarts}+ Smarts</Pill>
                  {b.skill && <Pill>{b.skill.min}+ {b.skill.label}</Pill>}
                  {b.franchise && <Pill tone="blue">Franchisable</Pill>}
                  <Pill tone={b.fail5 >= 60 ? "red" : b.fail5 >= 35 ? "amber" : "green"}>~{b.fail5}% fail in 5 yrs</Pill>
                </div>
                <div className="mt-1.5 text-xs text-slate-400">
                  {b.id === "startup" ? (
                    <>Most startups burn out. Rare winners can be worth millions, so don&apos;t count on it. </>
                  ) : (
                    <>
                      Once established, owner profit before tax is roughly{" "}
                      <span className="font-semibold text-slate-200">{money(Math.max(0, out.low))} to {money(out.high)}</span>, not guaranteed. Early years run lower.{" "}
                    </>
                  )}
                  Needs staff, about {money(b.fixed)} a year in fixed costs.
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              className="mt-2 w-full"
              disabled={!!reason || !!blocked}
              onClick={() => act((pl, rng) => startBusiness(pl, b.id, name, rng))}
            >
              {reason ?? `Open for ${money(b.cost)}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function BusinessDashboard({ p, biz }: { p: PlayerState; biz: Business }) {
  const { act } = useGame();
  const [tab, setTab] = useState<Tab>("people");
  const [amount, setAmount] = useState(25_000);
  const k = kindOf(biz);
  const fc = forecast(p, biz);
  const health = businessHealth(p, biz);
  const notes = riskNotes(p, biz);
  const costs = businessCosts(biz);
  const years = p.year - biz.founded;
  const quote = saleQuote(p, biz);
  const limit = loanLimit(p, biz);
  const rate = loanRateFor(p, biz);
  const effort = EFFORT_INFO[p.effort];
  const canPay = (n: number) => p.bankBalance + biz.cash >= n;
  const maxStaff = k.maxStaff * biz.locations;
  const lastRec = biz.history[biz.history.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="a full-time commitment">Your Business</SectionTitle>
      <Card>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{k.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{biz.name}</div>
            <div className="text-xs text-slate-400">
              {k.name} · founded {biz.founded} ({years === 0 ? "this year" : `${years} yr${years > 1 ? "s" : ""}`}) · {biz.locations} location{biz.locations > 1 ? "s" : ""}
              {biz.franchises > 0 && ` · ${biz.franchises} franchised`}
            </div>
          </div>
          <Pill tone={health.tone}>{health.label}</Pill>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Kpi label="Your stake" value={money(biz.value)} sub={biz.ownerShare < 1 ? `${pct(biz.ownerShare)} owned` : "100% owned"} className="text-amber-300" />
          <Kpi label="Revenue" value={biz.history.length ? money(biz.revenue) : "n/a"} sub="last year" />
          <Kpi label="Profit" value={biz.history.length ? money(biz.lastProfit) : "n/a"} sub="before tax" className={biz.history.length ? tone(biz.lastProfit) : ""} />
          <Kpi label="Cash" value={money(biz.cash)} sub="company account" className={biz.cash < 0 ? "text-rose-300" : ""} />
          <Kpi label="Debt" value={money(biz.debt)} sub={biz.debt > 0 ? `${(biz.loanRate * 100).toFixed(1)}% interest` : "none"} className={biz.debt > 0 ? "text-rose-300" : ""} />
          <Kpi label="Reputation" value={`${Math.round(biz.reputation)}`} sub="of 100" />
        </div>
      </Card>

      <Card className="p-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Profit history</span>
          {lastRec && <span className="text-xs text-slate-500">{lastRec.year}: {money(lastRec.profit)}</span>}
        </div>
        <ProfitChart history={biz.history} />
      </Card>

      <Card className="p-3">
        <div className="mb-2 text-sm font-semibold">Next year&apos;s outlook</div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-900/60 p-2"><div className="text-slate-400">Bad year</div><div className={`font-bold tabular-nums ${tone(fc.profit.low)}`}>{money(fc.profit.low)}</div></div>
          <div className="rounded-lg bg-slate-900/60 p-2"><div className="text-slate-400">Likely</div><div className={`font-bold tabular-nums ${tone(fc.profit.mid)}`}>{money(fc.profit.mid)}</div></div>
          <div className="rounded-lg bg-slate-900/60 p-2"><div className="text-slate-400">Good year</div><div className={`font-bold tabular-nums ${tone(fc.profit.high)}`}>{money(fc.profit.high)}</div></div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Profit after interest, before tax; revenue {money(fc.revenue.low)} to {money(fc.revenue.high)}. Demand is about {pct(Math.min(fc.demand, 1.7))} of a full house and your team can serve {pct(Math.min(fc.capacity, 1.5))}.
          {fc.runway !== null && ` At the pessimistic burn your cash lasts about ${fc.runway.toFixed(1)} years.`}
          {fc.debtService > 0 && ` Debt service: ${money(fc.debtService)}.`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {biz.history.length < 2 ? "Too early to judge the business, so this range is wide. " : ""}These are estimates, not promises: market fit is hidden, luck and the economy swing results, and a rough guide to the chance of going under within three years is {pct(fc.failureRisk)}.
        </p>
      </Card>

      {notes.length > 0 && (
        <Card className="p-3">
          <div className="mb-1 text-sm font-semibold">Watch out</div>
          <ul className="flex flex-col gap-1.5 text-xs text-amber-200">
            {notes.map((n) => (
              <li key={n}>⚠️ {n}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-3">
        <div className="mb-2 text-sm font-semibold">Operations</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Meter label="Customer base" value={biz.customers} />
          <Meter label="Quality" value={biz.quality} />
          <Meter label="Staff morale" value={biz.morale} />
          <Meter label="Training" value={biz.training} />
          <Meter label="Premises" value={biz.facility} />
          <Meter label="Compliance" value={biz.compliance} />
          <Meter label="Competition (lower is better)" value={100 - biz.competition} hint={`${Math.round(biz.competition)} pressure`} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-400">
          <Pill>{biz.staff}/{maxStaff} staff (suggested {fc.recommendedStaff})</Pill>
          <Pill>{PRICE_LABELS[biz.price]} prices</Pill>
          <Pill>{INSURANCE_LABELS[biz.insurance]} insurance</Pill>
          <Pill>Payout: {PAYOUT_LABELS[biz.payout]}</Pill>
        </div>
      </Card>

      <Card className="p-3">
        <div className="mb-1 text-sm font-semibold">Who runs it?</div>
        {biz.manager ? (
          <p className="text-xs text-slate-300">
            🧑‍💼 <span className="font-semibold">{biz.manager.name}</span> manages the business (skill {biz.manager.skill}, {money(biz.manager.wage)} a year). Your effort setting no longer drives results, and it no longer costs your health or family time. Expect a bit less profit than a sharp owner-operator and a weaker customer pull.
          </p>
        ) : (
          <p className="text-xs text-slate-300">
            🛠️ You run it yourself on <span className="font-semibold">{effort.emoji} {effort.label}</span> effort. {p.effort === "coast" ? "Coasting without a manager makes quality, morale and reputation decay." : p.effort === "grind" ? "Grinding lifts results but costs health, happiness and family time, with a real burnout risk." : "A sustainable pace."} Change effort in the card at the top of the Career tab, or hire a manager in People.
          </p>
        )}
      </Card>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { id: "people", label: "👥 People" },
          { id: "market", label: "📣 Market" },
          { id: "money", label: "💰 Money" },
          { id: "growth", label: "🏪 Growth" },
          { id: "exit", label: "🚪 Exit" },
        ]}
      />

      {tab === "people" && (
        <div className="flex flex-col gap-2">
          <Decision title="Hire staff" cost={`${money(costs.hire)} + ${money(k.wage)}/yr`} blurb={`Each hire adds capacity if demand needs it, and costs a salary either way. Suggested headcount for next year: ${fc.recommendedStaff}.`}>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={biz.staff >= maxStaff || !canPay(costs.hire)} onClick={() => act((pl) => hireStaff(pl))}>👤 Hire</Button>
              <Button variant="ghost" disabled={biz.staff <= 0} onClick={() => act((pl) => fireStaff(pl))}>Let someone go ({money(costs.severance)})</Button>
            </div>
          </Decision>
          <Decision title="Train staff" cost={money(costs.train)} blurb="Raises service quality and morale. Fades about 15% a year, so it needs repeating.">
            <Button variant="secondary" className="w-full" disabled={(p.annual.biztrain ?? 0) >= 1 || !canPay(costs.train)} onClick={() => act((pl) => trainStaff(pl))}>🎓 Run a training programme</Button>
          </Decision>
          <Decision title="General manager" cost={biz.manager ? `${money(biz.manager.wage)}/yr` : `from ${money(costs.managerWage.solid)}/yr`} blurb="A manager runs the day-to-day so you don't have to. Costs wages and recruiting fees, and is a little less effective than a great owner, but protects your health and family time and stops neglect. Pays off most with several locations.">
            {biz.manager ? (
              <Button variant="ghost" className="w-full" onClick={() => act((pl) => fireManager(pl))}>Let {biz.manager.name} go ({money(costs.managerSeverance)})</Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={!canPay(costs.managerFee.solid)} onClick={() => act((pl, rng) => hireManager(pl, rng, "solid"))}>Solid hire<br /><span className="text-[11px] font-normal">{money(costs.managerWage.solid)}/yr · fee {money(costs.managerFee.solid)}</span></Button>
                <Button variant="secondary" disabled={!canPay(costs.managerFee.star)} onClick={() => act((pl, rng) => hireManager(pl, rng, "star"))}>Star hire<br /><span className="text-[11px] font-normal">{money(costs.managerWage.star)}/yr · fee {money(costs.managerFee.star)}</span></Button>
              </div>
            )}
          </Decision>
          {!biz.manager && (
            <Decision title="Crunch time" blurb="A one-off sprint on top of your effort setting: a small lift to this year's revenue, at a cost to your health and mood.">
              <Button variant="ghost" className="w-full" disabled={(p.annual.bizwork ?? 0) >= 1} onClick={() => act((pl) => workOnBusiness(pl))}>💪 Work a punishing sprint</Button>
            </Decision>
          )}
        </div>
      )}

      {tab === "market" && (
        <div className="flex flex-col gap-2">
          <Decision title="Pricing" blurb="Premium pricing needs strong reputation and quality; budget pricing buys volume at thin margins. Changeable once a year.">
            <Choice<number> value={biz.price} onChange={(v) => act((pl) => setPrice(pl, v))} options={PRICE_LABELS.map((l, i) => ({ id: i, label: l }))} />
          </Decision>
          <Decision title="Marketing campaign" cost={money(costs.marketing)} blurb="Builds awareness with diminishing returns: the more you already advertise, the less each extra campaign adds. Awareness decays yearly.">
            <Button variant="secondary" className="w-full" disabled={(p.annual.marketing ?? 0) >= 1 || !canPay(costs.marketing)} onClick={() => act((pl) => runMarketing(pl))}>📣 Launch campaign</Button>
          </Decision>
          <Decision title="Renovate premises" cost={money(costs.renovate)} blurb="Restores a run-down site. Customers, staff and inspectors all notice.">
            <Button variant="secondary" className="w-full" disabled={biz.facility >= 85 || !canPay(costs.renovate)} onClick={() => act((pl) => renovateBusiness(pl))}>🛠️ Renovate</Button>
          </Decision>
          <Decision title={`Upgrade product (level ${biz.upgrades}/5)`} cost={money(costs.upgrade)} blurb="Better equipment and ingredients raise quality and reputation over time, and nudge unit costs up.">
            <Button variant="secondary" className="w-full" disabled={biz.upgrades >= 5 || !canPay(costs.upgrade)} onClick={() => act((pl) => upgradeProduct(pl))}>⬆️ Upgrade</Button>
          </Decision>
          <Decision title={`Diversify (level ${biz.diversified}/2)`} cost={money(costs.diversify)} blurb="A second product line adds a little revenue and damps swings in demand, but stretches management.">
            <Button variant="secondary" className="w-full" disabled={biz.diversified >= 2 || !canPay(costs.diversify)} onClick={() => act((pl) => diversifyBusiness(pl))}>🧩 Add a product line</Button>
          </Decision>
          <Decision title="Pivot / rebrand" cost={money(costs.pivot)} blurb="Start over with a new offer when the market isn't buying. You lose a quarter of your reputation and 30% of your customers, but may find a better fit. Once every three years.">
            <Button variant="ghost" className="w-full" disabled={p.year - biz.lastPivot < 3 || !canPay(costs.pivot)} onClick={() => act((pl, rng) => pivotBusiness(pl, rng))}>🔄 Pivot the business</Button>
          </Decision>
          <Decision title="Buy a competitor" cost={money(costs.acquire)} blurb="Absorb customers and weaken local competition. Integration is rarely smooth: morale suffers and a key person may leave.">
            <Button variant="secondary" className="w-full" disabled={biz.competition < 25 || (p.annual.bizacquire ?? 0) >= 1 || !canPay(costs.acquire)} onClick={() => act((pl, rng) => acquireCompetitor(pl, rng))}>🤝 Acquire a rival</Button>
          </Decision>
          <Decision title="Insurance" blurb={`Basic cover absorbs about 60% of big losses for roughly 0.5% of revenue; comprehensive about 90% for roughly 1.4%. ${k.name}s have ${k.hazard >= 1 ? "above-average" : k.hazard >= 0.7 ? "average" : "lower"} incident risk.`}>
            <Choice<number> value={biz.insurance} onChange={(v) => act((pl) => setInsurance(pl, v))} options={INSURANCE_LABELS.map((l, i) => ({ id: i, label: l }))} />
          </Decision>
          <Decision title="Compliance review" cost={money(costs.audit)} blurb="Cuts the chance and cost of incidents, fraud, inspections and audits for a while. Fades about 8 points a year.">
            <Button variant="secondary" className="w-full" disabled={(p.annual.bizaudit ?? 0) >= 1 || !canPay(costs.audit)} onClick={() => act((pl) => complianceAudit(pl))}>📋 Commission a review</Button>
          </Decision>
        </div>
      )}

      {tab === "money" && (
        <div className="flex flex-col gap-2">
          <Decision title="Owner payout" blurb={`Profit is taxed at ${pct(CORP_TAX)} in the company; payouts to you are then taxed as personal income. Reinvesting builds a cushion and value but pays you nothing.`}>
            <Choice<BusinessPayout> value={biz.payout} onChange={(v) => act((pl) => setPayout(pl, v))} options={(["reinvest", "balanced", "salary"] as const).map((m) => ({ id: m, label: PAYOUT_LABELS[m] }))} />
          </Decision>
          <Decision title="Inject your own money" blurb="Cash from your savings extends the runway. It isn't guaranteed to come back: only profits and an eventual sale return it.">
            <Choice<number> value={amount} onChange={setAmount} options={[10_000, 25_000, 100_000].map((v) => ({ id: v, label: money(v) }))} />
            <Button variant="secondary" className="mt-2 w-full" disabled={p.bankBalance < amount} onClick={() => act((pl) => investInBusiness(pl, amount))}>Put {money(amount)} into the company</Button>
          </Decision>
          <Decision title="Business loan" cost={limit > 0 ? `up to ${money(limit)} at ~${(rate * 100).toFixed(1)}%` : "unavailable"} blurb="Limits depend on profits, collateral, reputation and your credit. You pay interest plus about 10% of the balance each year, and must keep profit above debt service or the bank may call the loan. You guarantee part personally.">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={limit < 5_000} onClick={() => act((pl) => takeBusinessLoan(pl, Math.min(limit, Math.max(5_000, Math.floor(limit / 2 / 1000) * 1000))))}>Borrow {money(Math.min(limit, Math.max(5_000, Math.floor(limit / 2 / 1000) * 1000)))}</Button>
              <Button variant="secondary" disabled={limit < 5_000} onClick={() => act((pl) => takeBusinessLoan(pl, limit))}>Borrow max</Button>
            </div>
            {biz.debt > 0 && (
              <Button variant="ghost" className="mt-2 w-full" disabled={!canPay(Math.min(biz.debt, 10_000))} onClick={() => act((pl) => repayBusinessLoan(pl, biz.debt))}>Repay everything ({money(biz.debt)})</Button>
            )}
          </Decision>
          <FundingCard p={p} biz={biz} />
          <Decision title="Safety net" blurb="If the company runs out of cash, cover the gap from your savings automatically. Turn it off to protect your own money and let a failing company fail.">
            <Choice<string> value={biz.rescue ? "on" : "off"} onChange={(v) => act((pl) => setRescue(pl, v === "on"))} options={[{ id: "on", label: "Cover from savings" }, { id: "off", label: "Let it fail" }]} />
          </Decision>
        </div>
      )}

      {tab === "growth" && (
        <div className="flex flex-col gap-2">
          <Decision title={`Open location #${biz.locations + 1}`} cost={money(costs.expand)} blurb={`The new site starts with few customers and needs its own staff. Owner-run groups get stretched thin: every extra location cuts your own output by 20% and hurts reputation, unless a manager helps. Maximum ${k.maxLocations}.`}>
            <Button variant="secondary" className="w-full" disabled={biz.locations >= k.maxLocations || !canPay(costs.expand)} onClick={() => act((pl) => expandBusiness(pl))}>🏪 Expand</Button>
          </Decision>
          {k.franchise ? (
            <Decision title={`Franchise the brand (${biz.franchises}/10)`} cost={biz.franchises === 0 ? money(k.franchise.fee) : money(Math.round(k.franchise.fee * 0.2))} blurb={`Franchisees pay an upfront fee and about ${money(k.franchise.royalty)} a year in royalties, but their mistakes become your reputation problem. Needs 60+ reputation and two profitable years (you have ${biz.profitableYears}).`}>
              <Button variant="secondary" className="w-full" disabled={biz.franchises >= 10 || biz.reputation < 60 || biz.profitableYears < 2 || (p.annual.bizfranchise ?? 0) >= 1} onClick={() => act((pl, rng) => sellFranchise(pl, rng))}>🍔 Sell a franchise</Button>
            </Decision>
          ) : (
            <p className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 text-xs text-slate-400">{k.name}s depend too much on their owner to franchise.</p>
          )}
        </div>
      )}

      {tab === "exit" && (
        <div className="flex flex-col gap-2">
          <Decision title="Sell the business" cost={quote.equity > 0 ? `${money(quote.net)} net` : "no buyers"} blurb={`A buyer would pay about ${money(quote.enterprise)} for the operation${quote.multiple > 0 ? ` (${quote.multiple.toFixed(1)}x earnings)` : ""}, plus cash, minus debt, times your ${pct(biz.ownerShare)} share, less ${pct(SALE_FEE)} fees and ${money(quote.tax)} tax on gains. Buyers pay more in a boom and less in a recession, and discount young or owner-dependent businesses.`}>
            <Confirm label="Sell" danger={false} detail={`Sell ${biz.name} and take about ${money(quote.net)}?`} onConfirm={() => act((pl, rng) => sellBusiness(pl, rng))} />
          </Decision>
          {biz.manager && (
            <Decision title="Hand over to your manager" blurb="Sell to your manager at a friendly 70% of market value with no broker fees.">
              <Confirm label="Hand over the keys" danger={false} detail={`${biz.manager.name} buys you out. You'll receive about 70% of fair value after tax.`} onConfirm={() => act((pl) => handToManager(pl))} />
            </Decision>
          )}
          <Decision title="Close down" cost={`${money(Math.round(liquidationValue(biz) * 0.9))} assets`} blurb="Liquidating yields far less than selling a going concern: assets go at fire-sale prices, staff are paid off and creditors come first. Any shortfall lands on you personally.">
            <Confirm label="Close the business" detail="Wind down and liquidate everything? This can't be undone." onConfirm={() => act((pl) => closeBusiness(pl))} />
          </Decision>
          <Decision title="File for bankruptcy" blurb="Ends the business and discharges most of its debts, but wrecks your credit (-110), costs happiness, leaves you personally liable for guaranteed loans, and bars you from founding a company for four years.">
            <Confirm label="File for bankruptcy" detail="This wrecks your credit and bars you from starting a business for 4 years." onConfirm={() => act((pl) => fileBankruptcy(pl))} />
          </Decision>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Company profit is taxed at {pct(CORP_TAX)}; payouts to you are taxed as personal income; gains above your invested capital are taxed at a capital-gains-style rate when you sell. Investors, lenders and the economy all have a say.
      </p>
    </div>
  );
}

function FundingCard({ p, biz }: { p: PlayerState; biz: Business }) {
  const { act } = useGame();
  const k = kindOf(biz);
  const vc = k.revMult > 0;
  const stakes = [0.1, 0.2, 0.3];
  const terms = stakes.map((s) => ({ s, t: fundingTerms(p, biz, s) }));
  const ok = terms[0].t.available;
  return (
    <Decision title={vc ? "Venture funding" : "Angel investors"} blurb={vc ? "Sell a stake for growth capital. Investors share every payout and exit, so your ownership shrinks with each round; the money belongs to the company, not to you." : "Outside investors want a track record: two years of trading and a profitable last year. They take a share of all payouts and any sale."}>
      {!ok ? (
        <p className="text-xs text-amber-200">{terms[0].t.reason}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {terms.map(({ s, t }) => (
            <Button key={s} variant="secondary" className="px-1" disabled={!t.available || (p.annual.bizraise ?? 0) >= 1} onClick={() => act((pl, rng) => raiseFunding(pl, rng, s))}>
              {Math.round(s * 100)}%<br />
              <span className="text-[11px] font-normal">{money(t.amount)}</span>
              <br />
              <span className="text-[11px] font-normal">{Math.round(t.chance * 100)}% odds</span>
            </Button>
          ))}
        </div>
      )}
      {ok && <p className="mt-1.5 text-xs text-slate-500">Pre-money valuation about {money(terms[0].t.preMoney)}. You own {pct(biz.ownerShare)}; {biz.rounds} round{biz.rounds === 1 ? "" : "s"} raised so far.</p>}
    </Decision>
  );
}
