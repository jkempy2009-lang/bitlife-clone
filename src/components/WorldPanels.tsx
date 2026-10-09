"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import type { Disease, PlayerState } from "@/types/game.types";
import { activePlan, planBlocker, plansFor, planUpfrontCost, planYearlyCost, startTreatment, stopTreatment } from "@/engine/treatment";
import { CLUBS, CLUB_BY_ID, SCHOOL_ACTIONS, joinClub, leaveClub, schoolAction, schoolStanding, inSchoolYears, type SchoolAction } from "@/engine/school";
import { STATUS_LABEL, isCitizen, naturalise, naturaliseBlocker, needsRoute, routeOptions, statusLines } from "@/engine/visa";
import { countryNews } from "@/engine/worldEvents";
import { relocate } from "@/engine/world";
import { COUNTRIES } from "@/data/countries";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle } from "./ui";

/** Treatment choices for one condition: a plan to follow, what it costs and what it does. */
export function TreatmentPlans({ d }: { d: Disease }) {
  const { player: p, act } = useGame();
  const plans = plansFor(d);
  if (plans.length === 0) return null;
  const current = activePlan(d);
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {d.lapsed && <p className="text-xs text-rose-300">Treatment lapsed: the condition is running unchecked.</p>}
      {plans.map((plan) => {
        const why = planBlocker(p, d, plan);
        const on = current?.id === plan.id;
        return (
          <button
            key={plan.id}
            type="button"
            disabled={on || !!why}
            onClick={() => act((pl, rng) => startTreatment(pl, d.id, plan.id, rng))}
            className={`rounded-xl border p-2 text-left text-xs ${on ? "border-emerald-500/60 bg-emerald-950/30" : "border-slate-700/60 bg-slate-800/60"} disabled:opacity-60`}
          >
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{plan.emoji} {plan.label}{on ? " · following" : ""}</span>
              <span className="text-slate-400">{planYearlyCost(p, plan) > 0 ? `${money(planYearlyCost(p, plan))}/yr` : "free"}{planUpfrontCost(p, plan) > 0 ? ` + ${money(planUpfrontCost(p, plan))}` : ""}</span>
            </div>
            <div className="text-slate-400">{why ?? plan.blurb}</div>
          </button>
        );
      })}
      {current && <Button variant="ghost" className="py-1 text-xs" onClick={() => act((pl) => stopTreatment(pl, d.id))}>Stop treatment</Button>}
    </div>
  );
}

/** School life: how it's going, clubs, and what to do about trouble. */
export function SchoolCard() {
  const { player: p, act } = useGame();
  if (!inSchoolYears(p)) return null;
  const s = schoolStanding(p);
  const club = p.school.club ? CLUB_BY_ID[p.school.club] : null;
  const actions = (Object.keys(SCHOOL_ACTIONS) as SchoolAction[]).filter((a) => SCHOOL_ACTIONS[a].when(p));
  return (
    <>
      <SectionTitle hint={`grade ${s.grade}`}>School Life</SectionTitle>
      <Card>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Pill tone="blue">{s.social}</Pill>
          <Pill>{s.teacher}</Pill>
          <Pill tone={p.school.bullied >= 40 || p.school.stress >= 70 ? "red" : "green"}>{s.mood}</Pill>
        </div>
        {club ? (
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>{club.emoji} {club.label}</span>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => act((pl) => leaveClub(pl))}>Leave</Button>
          </div>
        ) : (
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {CLUBS.filter((c) => p.age >= c.minAge).map((c) => (
              <Button key={c.id} variant="secondary" className="px-2 py-1.5 text-xs" title={`${c.blurb} ${c.gain}`} onClick={() => act((pl) => joinClub(pl, c.id))}>{c.emoji} {c.label}</Button>
            ))}
          </div>
        )}
        {actions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {actions.map((a) => (
              <Button key={a} variant="secondary" className="justify-start text-left" onClick={() => act((pl, rng) => schoolAction(pl, a, rng))}>
                {SCHOOL_ACTIONS[a].emoji} {SCHOOL_ACTIONS[a].label}
                <span className="block text-xs font-normal text-slate-400">{SCHOOL_ACTIONS[a].blurb}</span>
              </Button>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/** Moving abroad needs papers: pick a route, see your status, and become a citizen in the end. */
export function MoveAbroad({ p }: { p: PlayerState }) {
  const { act } = useGame();
  const [dest, setDest] = useState<string | null>(null);
  const routes = dest && needsRoute(p, dest) ? routeOptions(p, dest) : [];
  const lines = statusLines(p);
  const nat = naturaliseBlocker(p);
  const news = countryNews(p.world, p.residence.country, p.year);
  return (
    <>
      <SectionTitle hint={isCitizen(p) ? "citizen" : STATUS_LABEL[p.immigration.status]}>Living Abroad</SectionTitle>
      <Card>
        {lines.length > 0 && <ul className="mb-2 list-disc pl-4 text-xs text-slate-300">{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
        {!isCitizen(p) && (
          <Button variant="secondary" className="mb-2 w-full" disabled={!!nat} title={nat ?? "Apply for citizenship"} onClick={() => act((pl, rng) => naturalise(pl, rng))}>
            🛂 Apply for citizenship{nat ? ` (${nat})` : ""}
          </Button>
        )}
        <p className="mb-1.5 text-xs text-slate-400">Pick a country. Abroad you'll need a route to stay legally.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {COUNTRIES.filter((c) => c.name !== p.residence.country).map((c) => (
            <Button key={c.name} variant={dest === c.name ? "primary" : "secondary"} className="px-2 py-1.5 text-xs" disabled={p.age < 18} onClick={() => (needsRoute(p, c.name) ? setDest(c.name) : act((pl, rng) => relocate(pl, c.name, rng)))}>
              {c.name}
            </Button>
          ))}
        </div>
        {dest && routes.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {routes.map((r) => (
              <button key={r.id} type="button" disabled={!!r.blocker} onClick={() => act((pl, rng) => relocate(pl, dest, rng, r.id))} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-2 text-left text-xs disabled:opacity-50">
                <div className="flex justify-between"><span className="font-semibold">{r.emoji} {r.label}</span><span className="text-slate-400">{r.fee > 0 ? money(r.fee) : "free"} · {Math.round(r.chance * 100)}%</span></div>
                <div className="text-slate-400">{r.blocker ?? r.blurb}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
      {news.length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-semibold">In the news: {p.residence.country}</div>
          <ul className="list-disc pl-4 text-xs text-slate-300">{news.map((n) => <li key={n}>{n}</li>)}</ul>
        </Card>
      )}
    </>
  );
}
