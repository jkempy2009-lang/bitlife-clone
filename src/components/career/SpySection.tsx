"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { jobEligibility, quitJob } from "@/engine/career";
import {
  APPROACHES,
  MISSIONS,
  confess,
  confideInPartner,
  defect,
  inAgency,
  joinAgency,
  layLow,
  maintainCover,
  meetHandler,
  missionBonus,
  missionChance,
  prepareMission,
  runMission,
  secretsValue,
  sellSecrets,
} from "@/engine/spy";
import { getPartner } from "@/engine/state";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";

export function SpySection() {
  const { player: p, act } = useGame();
  const [approach, setApproach] = useState<(typeof APPROACHES)[number]["id"]>("stealth");
  const job = inAgency(p) ? p.currentJob : null;
  const line = CAREER_BY_ID.spy;
  const elig = jobEligibility(p, line);
  const s = p.spy;
  const used = (k: string) => (p.annual[k] ?? 0) > 0;

  if (!job) {
    const blocked = !elig.ok ? elig.reason ?? "Not eligible." : used("apply:spy") ? "You've already applied this year." : null;
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>Secret Agent</SectionTitle>
        <Card>
          <p className="mb-2 text-sm text-slate-300">The Agency recruits quietly: a degree, 70+ Smarts and a clean record. Pay is good. Disavowal is possible, and a burn notice follows you for life.</p>
          {blocked && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {blocked}</p>}
          <ActionButton variant="primary" label="🕵️ Apply to the Agency" reason={blocked} onClick={() => act((pl, rng) => joinAgency(pl, rng))} />
        </Card>
        {s.burned && <Banner tone="red">🔥 Burned{s.burnedYear ? ` in ${s.burnedYear}` : ""}. The Agency will never take you back.{s.hunted > 0 ? ` Foreign services are still hunting you (${s.hunted} years).` : ""}</Banner>}
      </div>
    );
  }

  const partner = getPartner(p);
  const prep = used("spy:prep");
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Secret Agent</SectionTitle>
      <Card className="border-sky-900/60">
        <div className="text-xs uppercase tracking-widest text-sky-300">{job.company}</div>
        <div className="text-xl font-bold">{job.title}</div>
        <div className="text-sm text-slate-400">{money(job.salary)}/yr · {s.missions} missions flown</div>
        <div className="mt-3 flex flex-col gap-2.5">
          <Meter label="🎭 Cover integrity" value={s.cover} tone={s.cover < 30 ? "red" : s.cover < 60 ? "amber" : "green"} note={s.cover < 20 ? "about to unravel" : `${Math.round(s.cover)}`} />
          <Meter label="🤝 Handler trust" value={s.handlerTrust} tone="blue" />
          <Meter label="🔎 Counter-intelligence suspicion" value={s.suspicion} tone={s.suspicion >= 50 ? "red" : "slate"} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="blue">🗂️ Intel held: {s.secrets}</Pill>
          {s.doubleAgent && <Pill tone="red">🐍 Double agent</Pill>}
          {s.partnerKnows && <Pill tone="green">💬 Partner knows</Pill>}
          {p.fame >= 40 && <Pill tone="amber">⭐ Fame is eroding your cover</Pill>}
        </div>
        {s.cover < 30 && <div className="mt-2"><Banner tone="red">Your cover is thin. Below 20 it can fail on its own and you will be burned. Maintain it.</Banner></div>}
        {s.suspicion >= 50 && <div className="mt-2"><Banner tone="amber">Counter-intelligence is hunting for a mole. {s.doubleAgent ? "If they find you, it's treason." : "Lie low and it will blow over."}</Banner></div>}
      </Card>

      <SectionTitle hint="one mission per year">Take a Mission</SectionTitle>
      <div className="grid grid-cols-3 gap-1.5">
        {APPROACHES.map((a) => (
          <button key={a.id} type="button" onClick={() => setApproach(a.id)} className={`rounded-xl px-1 py-2 text-xs font-semibold ${approach === a.id ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"}`}>
            {a.name.split(" ")[0]}
            <div className="text-[10px] font-normal opacity-80">{a.stat}</div>
          </button>
        ))}
      </div>
      <ActionButton label={`📋 Prepare thoroughly ($3,000)`} hint="+6% to this year's mission" reason={prep ? "Already prepared" : p.bankBalance < 3_000 ? "Needs $3,000" : null} onClick={() => act((pl) => prepareMission(pl))} />
      <div className="flex flex-col gap-2">
        {MISSIONS.map((m) => {
          const reason = m.minTier > job.tier ? "Needs Field Agent clearance" : used("mission") ? "Command authorises one mission a year" : null;
          return (
            <div key={m.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{m.emoji} {m.name}</span>
                <span className="text-sm text-emerald-300">{Math.round(missionChance(p, approach, m.id) * 100)}%</span>
              </div>
              <div className="text-xs text-slate-400">{m.blurb} Bonus {money(missionBonus(job.tier, m.reward))}; costs ~{m.cover} cover.</div>
              <ActionButton className="mt-2" variant="primary" label="Run mission" reason={reason} onClick={() => act((pl, rng) => runMission(pl, approach, rng, m.id))} />
            </div>
          );
        })}
      </div>

      <SectionTitle>Tradecraft</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-2">
          <ActionButton label="☕ Meet Your Handler" hint="+12 trust. Small risk of being seen." reason={used("spy:handler") ? "Done this year" : null} onClick={() => act((pl, rng) => meetHandler(pl, rng))} />
          <ActionButton label="🪪 Maintain Your Cover ($5,000)" hint="+20 cover" reason={used("spy:cover") ? "Done this year" : p.bankBalance < 5_000 ? "Needs $5,000" : null} onClick={() => act((pl) => maintainCover(pl))} />
          <ActionButton label="🛋️ Lie Low" hint="−20 suspicion" reason={used("spy:low") ? "Done this year" : null} onClick={() => act((pl) => layLow(pl))} />
          <ActionButton label={`💬 Tell ${partner ? partner.name.split(" ")[0] : "your partner"} the truth`} hint="+15 relationship, −15 cover, risk they tell someone" variant="ghost" reason={!partner ? "You have no partner" : s.partnerKnows ? "They already know" : null} onClick={() => act((pl, rng) => confideInPartner(pl, rng))} />
        </div>
        {partner && !s.partnerKnows && <p className="mt-2 text-xs text-amber-300">{partner.name} doesn't know what you do. The secrecy erodes your relationship every year.</p>}
      </Card>

      <SectionTitle hint="the dark side">Double Dealing</SectionTitle>
      <Card className="border-rose-900/50">
        <div className="grid grid-cols-1 gap-2">
          <ActionButton label={`🐍 Sell Secrets (${money(Math.round(secretsValue(p)))})`} hint="Treason. Pays now, ~60,000/yr after, and raises suspicion by 12 a year." variant="danger" reason={s.secrets < 1 ? "You hold no intel yet. Complete missions first." : used("spy:sell") ? "Done this year" : null} onClick={() => act((pl) => sellSecrets(pl))} />
          {s.doubleAgent && (
            <>
              <ActionButton label="🙏 Confess to Your Handler" hint="50% forgiven, 30% fired and burned, 20% prosecuted" reason={null} onClick={() => act((pl, rng) => confess(pl, rng))} />
              <ActionButton label="🛫 Defect ($250,000)" hint="Flee abroad as a fugitive; your agent career is over." variant="danger" reason={null} onClick={() => act((pl, rng) => defect(pl, rng))} />
            </>
          )}
        </div>
      </Card>
      <ActionButton label="Resign" variant="ghost" onClick={() => act((pl) => quitJob(pl))} />
      <p className="text-xs text-slate-500">A burn notice ends your career, closes the Agency and security work for good, and foreign services hunt you for five years.</p>
    </div>
  );
}
