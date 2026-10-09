"use client";

import { useGame } from "@/context/GameStateContext";
import { kindOf } from "@/engine/businessModel";
import {
  AGENDA_INFO,
  MAX_TEAM,
  RIVAL_INFO,
  ROLES,
  ROLE_BLURB,
  boardNotes,
  buyOutInvestor,
  buyOutRival,
  canPayDividend,
  dismissKey,
  giveRaise,
  marketNotes,
  offerEquity,
  payDividend,
  priceWar,
  priceWarCost,
  priceWarOdds,
  raiseOf,
  recruitFee,
  recruitKey,
  respondToShift,
  roleTitle,
  shiftResponseCost,
  spareCash,
  stepBack,
  takeBackControl,
  teamBlocker,
  teamNotes,
  buyoutCost,
  investorBuyoutPrice,
} from "@/engine/business";
import { money } from "@/lib/format";
import { Button, Card, MiniBar, Pill, SectionTitle } from "../ui";

/** People, rivals and the board: the parts of running a business that are about other people. */
export default function BusinessDepth() {
  const { player: p, act } = useGame();
  const b = p.business;
  if (!b) return null;
  const k = kindOf(b);
  return (
    <>
      <SectionTitle hint={`${b.team.length}/${MAX_TEAM}`}>Key People</SectionTitle>
      <Card>
        <div className="flex flex-col gap-2">
          {ROLES.map((role) => {
            const t = b.team.find((x) => x.role === role);
            const why = teamBlocker(p, b, role);
            return (
              <div key={role} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5">
                {t ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{t.name} <span className="font-normal text-slate-400">· {t.title}</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{money(t.wage)}/yr</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>Skill {Math.round(t.skill)}</span>
                      <span className="flex-1"><MiniBar value={t.loyalty} color={t.loyalty < 35 ? "bg-rose-500" : "bg-emerald-500"} /></span>
                      <span>Loyalty {Math.round(t.loyalty)}</span>
                      {t.partner && <Pill tone="amber">partner</Pill>}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={() => act((pl) => giveRaise(pl, t.id))}>Raise (+{money(raiseOf(t))})</Button>
                      <Button variant="secondary" className="px-1 py-1.5 text-xs" disabled={t.partner} onClick={() => act((pl) => offerEquity(pl, t.id))}>Offer equity</Button>
                      <Button variant="ghost" className="px-1 py-1.5 text-xs" onClick={() => act((pl) => dismissKey(pl, t.id))}>Let go</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold">{roleTitle(b.kind, role)}</div>
                    <div className="text-xs text-slate-400">{ROLE_BLURB[role]}</div>
                    <Button variant="secondary" className="mt-2 w-full py-1.5 text-xs" disabled={!!why} title={why ?? ""} onClick={() => act((pl) => recruitKey(pl, role))}>
                      {why ?? `Recruit (fee about ${money(recruitFee(Math.round(k.wage * 1.6)))})`}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {teamNotes(b).map((n) => <p key={n} className="mt-2 text-xs text-amber-300">{n}</p>)}
      </Card>

      <SectionTitle hint="the industry around you">Market</SectionTitle>
      <Card>
        {b.shift ? (
          <div className="mb-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5">
            <div className="text-sm font-semibold">{b.shift.label} <span className="text-xs font-normal text-slate-400">· {b.shift.yearsLeft}y left</span></div>
            <div className="text-xs text-slate-400">{b.shift.blurb}</div>
            <Button variant="secondary" className="mt-2 w-full py-1.5 text-xs" disabled={b.shift.responded} onClick={() => act((pl) => respondToShift(pl))}>
              {b.shift.responded ? "You've responded" : `Respond (${money(shiftResponseCost(b))})`}
            </Button>
          </div>
        ) : (
          <p className="mb-2 text-xs text-slate-400">No big change in your industry right now.</p>
        )}
        {b.rivals.length > 0 ? (
          <div className="flex flex-col gap-2">
            {b.rivals.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{r.name} <span className="font-normal text-slate-400">· {RIVAL_INFO[r.kind].label}</span></span>
                  <span className="text-xs text-slate-400">Strength {Math.round(r.strength)}</span>
                </div>
                <div className="text-xs text-slate-400">{RIVAL_INFO[r.kind].blurb}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={() => act((pl, rng) => priceWar(pl, rng, r.id))}>Price war ({money(priceWarCost(b))}, {Math.round(priceWarOdds(b, r) * 100)}%)</Button>
                  <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={() => act((pl, rng) => buyOutRival(pl, rng, r.id))}>Buy out ({money(buyoutCost(b, r))})</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No serious competitor has appeared.</p>
        )}
        {marketNotes(b).map((n) => <p key={n} className="mt-2 text-xs text-amber-300">{n}</p>)}
      </Card>

      {(b.investors.length > 0 || b.passive || b.ousted) && (
        <>
          <SectionTitle hint={`board heat ${Math.round(b.boardHeat)}`}>Board and Investors</SectionTitle>
          <Card>
            <div className="flex flex-col gap-2">
              {b.investors.map((i) => (
                <div key={i.id} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{i.name} <span className="font-normal text-slate-400">· {i.kind}</span></span>
                    <span className="text-xs text-slate-400">{Math.round(i.share * 100)}%</span>
                  </div>
                  <div className="text-xs text-slate-400">Wants: {AGENDA_INFO[i.agenda].label}. {AGENDA_INFO[i.agenda].blurb}</div>
                  <Button variant="secondary" className="mt-2 w-full py-1.5 text-xs" onClick={() => act((pl) => buyOutInvestor(pl, i.id))}>Buy them out ({money(investorBuyoutPrice(b, i))})</Button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <Button variant="secondary" className="py-1.5 text-xs" disabled={!canPayDividend(p, b)} onClick={() => act((pl) => payDividend(pl, spareCash(b)))}>Pay a dividend ({money(spareCash(b))})</Button>
              {b.passive ? (
                <Button variant="secondary" className="py-1.5 text-xs" disabled={b.ousted} onClick={() => act((pl) => takeBackControl(pl))}>Take back control</Button>
              ) : (
                <Button variant="secondary" className="py-1.5 text-xs" onClick={() => act((pl) => stepBack(pl))}>Step back (hire a CEO)</Button>
              )}
            </div>
            {boardNotes(b).map((n) => <p key={n} className="mt-2 text-xs text-amber-300">{n}</p>)}
          </Card>
        </>
      )}
    </>
  );
}
