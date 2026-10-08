"use client";

import { useGame } from "@/context/GameStateContext";
import {
  DINNER_COST, NATIONAL_PLANS, THERAPY_COST, appealBan, appealBlocker, appealChance, captainBlocker, coachTalkBlocker, dealBlocker, declineDeal, dinnerBlocker,
  dropDeal, fuelRivalry, makePeace, nationalBlocker, requestTransfer, rivalBlocker, runForCaptain, seeTherapist, setNationalPlan, signDeal, talkToCoach,
  teamDinner, therapyBlocker, transferRequestBlocker,
} from "@/engine/athleteLife";
import { DEAL_KINDS, dealEligible, maxDeals } from "@/engine/athleteDepth";
import { SPORT_INFO, type Sport } from "@/data/sports";
import { money } from "@/lib/format";
import { Button, Pill, StatBar } from "../ui";
import { Block } from "./AthleteBlock";

const isTeam = (sport: string | null) => !!sport && SPORT_INFO[sport as Sport]?.team;

// ---------------------------------------------------------------------------
// Team, coach and head
// ---------------------------------------------------------------------------

function Action({ label, hint, why, onClick, variant = "secondary" }: { label: string; hint: string; why: string | null; onClick: () => void; variant?: "secondary" | "ghost" | "danger" }) {
  return (
    <div className="flex flex-col">
      <Button variant={variant} disabled={!!why} onClick={onClick}>{label}</Button>
      <span className={`mt-0.5 text-[11px] ${why ? "text-rose-300" : "text-slate-500"}`}>{why ?? hint}</span>
    </div>
  );
}

export function TeamAndMind() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const team = isTeam(a.sport);
  const hasClub = a.stage === "college" || ((a.stage === "semipro" || a.stage === "pro") && !a.freeAgent);
  const moodTone = a.mental >= 60 ? "text-emerald-300" : a.mental >= 35 ? "text-amber-300" : "text-rose-300";
  return (
    <Block title={team ? "🧠 Team & mind" : "🧠 Entourage & mind"}>
      <StatBar label="Morale and mental health" value={a.mental} color={a.mental >= 60 ? "green" : a.mental >= 35 ? "amber" : "red"} compact />
      <p className={`mt-1 text-[11px] ${moodTone}`}>
        {a.mental >= 60 ? "In a good place." : a.mental >= 35 ? "Wearing thin. Rest and success help." : "Close to burnout: form is suffering."}
      </p>
      {hasClub && (
        <div className="mt-3 flex flex-col gap-2">
          <StatBar label={team ? "Team chemistry" : "Support team (coach, physio, family)"} value={a.chemistry} color="blue" compact />
          <StatBar label="Relationship with the coach" value={a.coachRel} color="purple" compact />
          {team && (a.stage === "semipro" || a.stage === "pro") && (
            <StatBar label={`Playing time${a.playing < 35 ? " (benched)" : a.playing >= 75 ? " (starter)" : ""}`} value={a.playing} color="teal" compact />
          )}
          <div className="flex flex-wrap gap-1.5">
            {a.captain && <Pill tone="amber">🎖️ Captain</Pill>}
            {a.transferReq && <Pill tone="red">Transfer request in</Pill>}
            {a.narrative && <Pill tone="blue">“{a.narrative}”</Pill>}
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Action label={`🛋️ Psychologist${p.age >= 18 ? ` (${money(THERAPY_COST)})` : ""}`} hint="Morale +10-18. Once a year." why={therapyBlocker(p)} onClick={() => act((pl, rng) => seeTherapist(pl, rng))} />
        {hasClub && <Action label={`🍽️ Team dinner (${money(DINNER_COST)})`} hint="Chemistry +6-11. Once a year." why={dinnerBlocker(p)} onClick={() => act((pl, rng) => teamDinner(pl, rng))} />}
        {hasClub && <Action label="💬 Talk to the coach" hint="Win him over for minutes, or annoy him. Once a year." why={coachTalkBlocker(p)} onClick={() => act((pl, rng) => talkToCoach(pl, rng))} />}
        {team && hasClub && <Action label="🎖️ Stand for captain" hint="Needs chemistry 55+, two years at the club and a pro contract." why={captainBlocker(p)} onClick={() => act((pl, rng) => runForCaptain(pl, rng))} />}
        {hasClub && (a.stage === "semipro" || a.stage === "pro") && (
          <Action
            label="✈️ Ask to leave"
            hint="The club may find you a buyer at season's end. Costs relationships and image."
            why={transferRequestBlocker(p)}
            variant="ghost"
            onClick={() => act((pl) => requestTransfer(pl))}
          />
        )}
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------

export function BrandDeals() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const eligible = dealEligible(p, a);
  if (!eligible && a.deals.length === 0) {
    if (a.stage === "youth" || a.stage === "none" || a.stage === "retired") return null;
    return (
      <Block title="💼 Brand deals">
        <p className="text-xs text-slate-400">Sponsors only call athletes with some fame (30+) and a clean record. You&apos;re at fame {p.fame}.</p>
      </Block>
    );
  }
  const imgTone = a.image >= 65 ? "green" : a.image >= 40 ? "amber" : "red";
  return (
    <Block title={`💼 Brand deals (${a.deals.length}/${maxDeals(p)})`}>
      <StatBar label="Public image (sponsors pay for it)" value={a.image} color={imgTone} compact />
      {a.deals.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {a.deals.map((d) => {
            const k = DEAL_KINDS[d.category];
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/50 p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{k.emoji} {d.brand}</div>
                  <div className="text-[11px] text-slate-400">{k.label} · {d.years} season{d.years === 1 ? "" : "s"} left · {money(d.pay)}/yr</div>
                </div>
                <Button variant="ghost" className="shrink-0 !px-2 !py-1 text-xs" onClick={() => act((pl) => dropDeal(pl, d.id))}>Drop</Button>
              </li>
            );
          })}
        </ul>
      )}
      {a.dealOffers.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-300">Offers (expire at the next Age Up)</div>
          {a.dealOffers.map((d) => {
            const k = DEAL_KINDS[d.category];
            const why = dealBlocker(p, d.id);
            return (
              <div key={d.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{k.emoji} {d.brand}</div>
                    <div className="text-xs text-slate-400">{k.label} · {d.years} season{d.years === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-right text-lg font-bold tabular-nums text-emerald-300">{money(d.pay)}</div>
                </div>
                <p className="mt-1 text-xs text-slate-400">{k.blurb}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill tone={k.risk >= 0.1 ? "red" : k.risk >= 0.04 ? "amber" : "green"}>{k.risk >= 0.1 ? "High image risk" : k.risk >= 0.04 ? "Some image risk" : k.risk > 0 ? "Low risk" : "Image boost"}</Pill>
                </div>
                {why && <p className="mt-1 text-xs font-medium text-rose-300">🔒 {why}</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="primary" disabled={!!why} onClick={() => act((pl) => signDeal(pl, d.id))}>Sign</Button>
                  <Button variant="ghost" onClick={() => act((pl) => declineDeal(pl, d.id))}>Pass</Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No new offers this year. Results, fame and a clean image bring brands to your door.</p>
      )}
    </Block>
  );
}

// ---------------------------------------------------------------------------
// National team
// ---------------------------------------------------------------------------

export function NationalTeamCard() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const c = a.natCall;
  if (!c) return null;
  if (!c.selected) {
    return (
      <Block title={`🌍 ${c.major} ${c.year}`} tone="red">
        <p className="text-xs text-slate-300">The selectors left you out of the squad. Keep your rating up and stay visible, and you could be in the next cycle.</p>
      </Block>
    );
  }
  return (
    <Block title={`🌍 ${c.major} ${c.year}: national squad`} tone="green">
      <p className="mb-2 text-xs text-slate-300">You&apos;re in the squad. How much will you give it? You can change your mind until the next Age Up. Your plan: <strong>{NATIONAL_PLANS.find((x) => x.id === a.natPlan)?.label}</strong>.</p>
      <div className="flex flex-col gap-2">
        {NATIONAL_PLANS.map((pl) => {
          const why = nationalBlocker(p, pl.id);
          const on = a.natPlan === pl.id;
          return (
            <button
              key={pl.id}
              type="button"
              disabled={!!why}
              aria-pressed={on}
              onClick={() => act((st) => setNationalPlan(st, pl.id))}
              className={`rounded-xl border p-2.5 text-left transition-colors disabled:opacity-40 ${on ? "border-emerald-500 bg-emerald-900/30" : "border-slate-700 bg-slate-900/40 hover:bg-slate-800"}`}
            >
              <div className="text-sm font-semibold">{pl.label}</div>
              <div className={`text-[11px] ${why ? "text-rose-300" : "text-slate-400"}`}>{why ?? pl.blurb}</div>
            </button>
          );
        })}
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Doping appeal and rivalry
// ---------------------------------------------------------------------------

export function AppealCard() {
  const { player: p, act } = useGame();
  const ap = p.athlete.appeal;
  if (!ap) return null;
  const why = appealBlocker(p);
  return (
    <Block title="⚖️ Positive test: contest it?" tone="red">
      <p className="text-xs text-slate-300">
        You tested positive. The ban is {ap.ban} years and {ap.stripped} title{ap.stripped === 1 ? "" : "s"} were stripped. Lawyers say the supplement could have been contaminated. An appeal costs {money(ap.cost)}, wins about {Math.round(appealChance(p) * 100)}% of the time (halving the ban and restoring half your titles) and a loss adds a year. The window closes at the next Age Up.
      </p>
      <Button variant="danger" className="mt-2 w-full" disabled={!!why} onClick={() => act((pl, rng) => appealBan(pl, rng))}>Appeal ({money(ap.cost)})</Button>
      {why && <p className="mt-0.5 text-[11px] text-rose-300">🔒 {why}</p>}
    </Block>
  );
}

export function RivalryCard() {
  const { player: p, act } = useGame();
  const r = p.athlete.rival;
  if (!r) return null;
  const why = rivalBlocker(p);
  return (
    <Block title={`🥊 Rival: ${r.name}`}>
      <StatBar label="How personal it has become" value={r.heat} color="red" compact />
      <p className="mt-1 text-xs text-slate-400">Head to head: {r.wins} wins, {r.losses} losses. Feuds sell tickets and wear you down.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Action label="🔥 Fuel the feud" hint="Fame and visibility up, image down." why={why} variant="ghost" onClick={() => act((pl) => fuelRivalry(pl))} />
        <Action label="🤝 Make peace" hint="Image and morale up, the heat drops." why={why} onClick={() => act((pl) => makePeace(pl))} />
      </div>
    </Block>
  );
}
