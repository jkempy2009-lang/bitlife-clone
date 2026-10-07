"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  DOCTOR_COST,
  LEISURE,
  LOTTERY_ANNUAL_CAP,
  LOTTERY_COST,
  SURGERIES,
  WELLNESS,
  WITCH_COST,
  botchChance,
  buyLotteryTicket,
  doLeisure,
  doWellness,
  plasticSurgery,
  visitDoctor,
  visitWitchDoctor,
  type LeisureId,
  type WellnessId,
} from "@/engine/activities";
import { commitCrime } from "@/engine/crime";
import { HOBBIES, MAX_HOBBY_SESSIONS, hobbyIncome, practiceHobby } from "@/engine/hobbies";
import { REHAB_COST, VICE_INFO, hasAnyVice, quitVice, rehab } from "@/engine/vices";
import type { Vices } from "@/types/game.types";
import { CRIMES } from "@/data/crimes";
import { blackjackClear, blackjackDeal, blackjackHit, blackjackStand, handValue, type Card as PlayingCard } from "@/engine/blackjack";
import { money } from "@/lib/format";
import { Button, Card, Pill, Segmented, SectionTitle, StatBar, TooYoung } from "./ui";
import ViolencePanel from "./ViolencePanel";

type Panel = "medical" | "wellness" | "hobbies" | "casino" | "crime" | "surgery" | "leisure";

export default function ActivitiesTab() {
  const { player } = useGame();
  const [panel, setPanel] = useState<Panel>("wellness");
  if (player.age < 6) return <TooYoung>You're too little for activities. Enjoy being a kid, and ask your parents for a cookie.</TooYoung>;
  return (
    <div>
      <Segmented<Panel>
        value={panel}
        onChange={setPanel}
        options={[
          { id: "wellness", label: "🏋️ Wellness" },
          { id: "medical", label: "🏥 Medical" },
          { id: "hobbies", label: "🎨 Hobbies" },
          { id: "leisure", label: "🎈 Leisure" },
          { id: "casino", label: "🎰 Gambling" },
          { id: "crime", label: "🦹 Crime" },
          { id: "surgery", label: "💉 Surgery" },
        ]}
      />
      {panel === "wellness" && <Wellness />}
      {panel === "medical" && <MedicalCenter />}
      {panel === "hobbies" && <Hobbies />}
      {panel === "leisure" && <Leisure />}
      {panel === "casino" && <GamblingDen />}
      {panel === "crime" && <CrimeRings />}
      {panel === "surgery" && <SurgeryClinic />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MedicalCenter() {
  const { player: p, act } = useGame();
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Medical Center</SectionTitle>
      <Card>
        <div className="mb-2 text-sm font-semibold">Active conditions</div>
        {p.diseases.length === 0 ? (
          <p className="text-sm text-slate-400">You're in good health. No active diseases.</p>
        ) : (
          <ul className="space-y-2">
            {p.diseases.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/50 p-2.5">
                <div>
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className="mt-0.5 flex gap-1.5">
                    <Pill tone={d.severity === "fatal" ? "red" : d.severity === "chronic" ? "amber" : "slate"}>{d.severity}</Pill>
                    {d.yearsLeft !== undefined && <Pill tone="red">~{d.yearsLeft}y left</Pill>}
                  </div>
                </div>
                <Button variant="primary" className="shrink-0 px-3 py-1.5" onClick={() => act((pl, rng) => visitDoctor(pl, d.id, rng))}>
                  Treat ({money(DOCTOR_COST)})
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {hasAnyVice(p) && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Habits & addictions</div>
          {(Object.keys(VICE_INFO) as (keyof Vices)[]).filter((k) => p.vices[k] > 0).map((k) => (
            <div key={k} className="mb-2">
              <StatBar label={`${VICE_INFO[k].emoji} ${VICE_INFO[k].label}`} value={p.vices[k]} color="red" compact />
              <Button variant="ghost" className="mt-1 w-full py-1 text-xs" disabled={(p.annual[`quit:${k}`] ?? 0) >= 1} onClick={() => act((pl, rng) => quitVice(pl, k, rng))}>
                Try to quit
              </Button>
            </div>
          ))}
          <Button variant="primary" className="mt-1 w-full" disabled={p.bankBalance < REHAB_COST || (p.annual.rehab ?? 0) >= 1} onClick={() => act((pl) => rehab(pl))}>
            🏥 Enter Rehab — {money(REHAB_COST)}
          </Button>
        </Card>
      )}
      <Button variant="primary" onClick={() => act((pl, rng) => visitDoctor(pl, null, rng))}>
        🩺 Visit the Doctor — {money(DOCTOR_COST)}
      </Button>
      <Button variant="ghost" onClick={() => act((pl, rng) => visitWitchDoctor(pl, rng))}>
        🔮 Witch Doctor — {money(WITCH_COST)} <span className="text-xs text-slate-400">(miracle or curse)</span>
      </Button>
      <p className="text-xs text-slate-500">Doctors treat mild illnesses reliably, chronic ones sometimes, and fatal ones almost never. One treatment per condition per year.</p>
    </div>
  );
}

function Wellness() {
  const { player: p, act } = useGame();
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="once per year each">Wellness Complex</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(WELLNESS) as WellnessId[]).map((id) => {
          const done = (p.annual[`wellness:${id}`] ?? 0) >= 1;
          const w = WELLNESS[id];
          return (
            <button
              key={id}
              type="button"
              disabled={done}
              onClick={() => act((pl) => doWellness(pl, id))}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="text-2xl">{w.emoji}</div>
              <div className="mt-1 font-semibold">{w.label}</div>
              <div className="text-xs text-slate-400">{w.effects}</div>
              {done && <div className="mt-1 text-xs text-emerald-400">✓ Done this year</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Hobbies() {
  const { player: p, act } = useGame();
  const sessions = p.annual.hobbies ?? 0;
  const income = hobbyIncome(p);
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle hint={`${MAX_HOBBY_SESSIONS - sessions} sessions left this year`}>Hobbies</SectionTitle>
      {income > 0 && <Card className="p-3 text-sm text-emerald-300">Your hobbies earn about {money(income)} a year.</Card>}
      {HOBBIES.map((h) => {
        const skill = p.hobbies[h.id] ?? 0;
        const done = (p.annual[`hobby:${h.id}`] ?? 0) >= 1;
        return (
          <div key={h.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{h.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{h.name}</div>
                <div className="text-xs text-slate-400">{h.blurb} {h.effects}</div>
              </div>
              <Button variant={skill ? "secondary" : "primary"} className="shrink-0 px-3 py-1.5" disabled={done || sessions >= MAX_HOBBY_SESSIONS || p.age < 6} onClick={() => act((pl, rng) => practiceHobby(pl, h.id, rng))}>
                {done ? "✓" : skill ? "Practise" : "Start"}
              </Button>
            </div>
            {skill > 0 && <div className="mt-2"><StatBar label="Skill" value={skill} color="purple" compact /></div>}
          </div>
        );
      })}
    </div>
  );
}

function Leisure() {
  const { player: p, act } = useGame();
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle hint="once per year each">Leisure & Life</SectionTitle>
      {(Object.keys(LEISURE) as LeisureId[]).map((id) => {
        const d = LEISURE[id];
        const done = (p.annual[`leisure:${id}`] ?? 0) >= 1;
        return (
          <button
            key={id}
            type="button"
            disabled={done}
            onClick={() => act((pl, rng) => doLeisure(pl, id, rng))}
            className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-2xl">{d.emoji}</span>
            <span className="flex-1">
              <span className="block font-semibold">{d.label}</span>
              <span className="text-xs text-slate-400">{d.blurb}</span>
            </span>
            <span className="text-sm font-medium text-slate-300">{d.cost ? money(d.cost) : done ? "✓" : "Free"}</span>
          </button>
        );
      })}
    </div>
  );
}

function CrimeRings() {
  const { player: p, act } = useGame();
  const [tab, setTab] = useState<"Theft" | "Fraud" | "Underworld" | "Violence">("Theft");
  const list = CRIMES.filter((c) => c.category === tab);
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle hint="each repeat this year is riskier">Crime Rings</SectionTitle>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: "Theft", label: "🛍️ Theft" },
          { id: "Fraud", label: "🧾 Fraud" },
          { id: "Underworld", label: "📦 Underworld" },
          { id: "Violence", label: "🗡️ Violence" },
        ]}
      />
      {tab === "Violence" ? (
        <ViolencePanel />
      ) : (
        list.map((c) => {
          const reason = c.requires?.(p) ?? null;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
              <span className="text-2xl">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-400">{c.blurb}</div>
                <div className="mt-1 flex gap-1.5">
                  <Pill tone={c.risk === "Low" ? "green" : c.risk === "Medium" ? "amber" : "red"}>{c.risk} risk</Pill>
                  <Pill>{c.reward[0] === c.reward[1] ? money(c.reward[0]) : `${money(c.reward[0])}–${money(c.reward[1])}`}</Pill>
                </div>
                {reason && <div className="mt-1 text-xs font-medium text-rose-300">🔒 {reason}</div>}
              </div>
              <Button variant="danger" className="shrink-0 px-3 py-1.5" disabled={p.age < c.minAge || !!reason} onClick={() => act((pl, rng) => commitCrime(pl, c.id, rng))}>
                {p.age < c.minAge ? `${c.minAge}+` : "Do it"}
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}

function SurgeryClinic() {
  const { player: p, act } = useGame();
  const done = (p.annual.surgery ?? 0) >= 1;
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle hint="one procedure per year">Plastic Surgery Clinic</SectionTitle>
      {SURGERIES.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
          <span className="text-2xl">{s.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{s.name}</div>
            <div className="text-xs text-slate-400">+15 Looks · {Math.round(botchChance(s.cost) * 100)}% botch risk (−30 Looks, −20 Health)</div>
          </div>
          <Button variant="secondary" className="shrink-0 px-3 py-1.5" disabled={done || p.bankBalance < s.cost || p.age < 16} onClick={() => act((pl, rng) => plasticSurgery(pl, s.id, rng))}>
            {money(s.cost)}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gambling: Blackjack + Lottery
// ---------------------------------------------------------------------------

function CardView({ c, hidden }: { c: PlayingCard; hidden?: boolean }) {
  const red = c.suit === "♥" || c.suit === "♦";
  if (hidden) return <div className="flex h-16 w-11 items-center justify-center rounded-lg border border-slate-500 bg-indigo-900 text-xl">🂠</div>;
  return (
    <div className={`flex h-16 w-11 flex-col items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-sm font-bold ${red ? "text-rose-600" : "text-slate-900"}`}>
      <span>{c.rank}</span>
      <span>{c.suit}</span>
    </div>
  );
}

function GamblingDen() {
  const { player: p, act } = useGame();
  const [wagerText, setWagerText] = useState("100");
  const wager = Math.floor(Number(wagerText) || 0);
  const tickets = p.annual.lottery ?? 0;
  const blackjack = p.blackjack;
  const inPlay = blackjack?.phase === "play";

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint={p.vices.gambling >= 30 ? "⚠️ you may have a problem" : undefined}>Blackjack</SectionTitle>
      <Card>
        {p.age < 18 ? (
          <p className="text-sm text-slate-400">You must be 18 to gamble.</p>
        ) : !blackjack ? (
          <>
            <label className="mb-1 block text-xs text-slate-400" htmlFor="wager">Wager (you have {money(p.bankBalance)})</label>
            <div className="flex gap-2">
              <input
                id="wager"
                inputMode="numeric"
                value={wagerText}
                onChange={(e) => setWagerText(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base outline-none focus:border-emerald-500"
              />
              <Button variant="primary" onClick={() => act((pl, rng) => blackjackDeal(pl, wager, rng))} disabled={wager <= 0 || wager > p.bankBalance}>Deal</Button>
            </div>
          </>
        ) : (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>Dealer {inPlay ? "" : `(${handValue(blackjack.dealer)})`}</span>
              <span>Wager {money(blackjack.wager)}</span>
            </div>
            <div className="mb-3 flex gap-1.5">
              {blackjack.dealer.map((c, i) => <CardView key={i} c={c} hidden={inPlay && i === 1} />)}
            </div>
            <div className="mb-1 text-xs text-slate-400">You ({handValue(blackjack.player)})</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {blackjack.player.map((c, i) => <CardView key={i} c={c} />)}
            </div>
            {inPlay ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" onClick={() => act((pl) => blackjackHit(pl))}>Hit</Button>
                <Button variant="secondary" onClick={() => act((pl) => blackjackStand(pl))}>Stand</Button>
              </div>
            ) : (
              <>
                <p className="mb-2 text-sm font-semibold text-amber-300">{blackjack.message}</p>
                <Button variant="primary" className="w-full" onClick={() => act((pl) => blackjackClear(pl))}>New Hand</Button>
              </>
            )}
          </div>
        )}
      </Card>

      <SectionTitle hint={`${tickets}/${LOTTERY_ANNUAL_CAP} this year`}>Lottery</SectionTitle>
      <Card>
        <p className="mb-3 text-sm text-slate-400">A $10 ticket. Jackpot odds are 1 in 100,000 for a $50,000,000 prize. Limit {LOTTERY_ANNUAL_CAP} per year.</p>
        <Button variant="gold" className="w-full" disabled={p.age < 18 || p.bankBalance < LOTTERY_COST || tickets >= LOTTERY_ANNUAL_CAP} onClick={() => act((pl, rng) => buyLotteryTicket(pl, rng))}>
          🎟️ Buy Ticket — {money(LOTTERY_COST)}
        </Button>
      </Card>
    </div>
  );
}
