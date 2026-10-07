"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { jobEligibility } from "@/engine/career";
import {
  MAX_CREW,
  MAX_TERRITORY,
  MOB_JOBS,
  RESPECT_FOR_RANK,
  becomeInformant,
  buyoutCost,
  coupChance,
  enterWitsec,
  expandTerritory,
  inMob,
  jobChance,
  joinChance,
  joinMob,
  leaveMob,
  leaveRisk,
  payRespects,
  plotCoup,
  recruitCrew,
  runMobJob,
  sitDown,
  skimChance,
  skimTribute,
  territoryIncome,
  tributeRate,
} from "@/engine/underworld";
import { scrutiny } from "@/engine/justice";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";

const HEAT_LABEL = { unknown: "Unknown to police", noticed: "On their radar", watched: "Under watch", wanted: "Wanted" } as const;

export function UnderworldSection() {
  const { player: p, act } = useGame();
  const [plan, setPlan] = useState<0 | 1 | 2>(0);
  const [crew, setCrew] = useState(0);
  const line = CAREER_BY_ID.mafia;
  const job = inMob(p) ? p.currentJob : null;
  const elig = jobEligibility(p, line);
  const m = p.mob;
  const used = (k: string, n = 1) => (p.annual[k] ?? 0) >= n;

  if (!job) {
    const blocked = !elig.ok ? elig.reason ?? "They won't talk to you." : m.witsec ? "You testified. No family will ever touch you." : used("apply:mafia") ? "You've already asked around this year." : null;
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>The Underworld</SectionTitle>
        <Card>
          <p className="mb-2 text-sm text-slate-300">Associates earn off-the-books cash and climb to Boss through street respect and the family's trust. Police, rival crews and your own conscience are all watching.</p>
          <p className="mb-2 text-xs text-slate-500">Open to Karma 50 or lower. A criminal record and old gang ties help. Your chance of being taken in: {Math.round(joinChance(p) * 100)}%.</p>
          <Button variant="danger" className="w-full" disabled={!!blocked} onClick={() => act((pl, rng) => joinMob(pl, rng))}>🕴️ Seek Out the Family</Button>
          {blocked && <div className="mt-1 text-xs text-rose-300">🔒 {blocked}</div>}
        </Card>
        {m.witsec && <Banner tone="blue">🛡️ You are in witness protection. The marshals send a stipend, and the family still has a long memory.</Banner>}
        {m.marked && <Banner tone="red">☠️ You are marked. Old associates are still looking for you.</Banner>}
      </div>
    );
  }

  const tier = job.tier;
  const nextRespect = tier < 3 ? RESPECT_FOR_RANK[tier] : null;
  const jobsLeft = 2 - (p.annual.mobjob ?? 0);
  const crewMax = Math.min(2, m.crew);
  const crewUsed = Math.min(crew, crewMax);
  const planCost = plan * 2_000 * (1 + tier);
  const tribute = Math.round((job.salary + territoryIncome(tier, m.territory)) * tributeRate(tier));

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>The Underworld</SectionTitle>
      <Card className="border-rose-900/60">
        <div className="text-xs uppercase tracking-widest text-rose-300">{job.company}</div>
        <div className="text-xl font-bold">{job.title}</div>
        <div className="text-sm text-slate-400">{money(job.salary)}/yr untaxed · tribute up the chain {Math.round(tributeRate(tier) * 100)}% (~{money(tribute)}/yr)</div>
        <div className="mt-3 flex flex-col gap-2.5">
          <Meter label="🤝 Loyalty (the family's trust)" value={m.loyalty} tone={m.loyalty < 25 ? "red" : m.loyalty < 50 ? "amber" : "green"} />
          <Meter label="💪 Street respect" value={m.respect} tone="red" note={nextRespect !== null ? `${Math.round(m.respect)} / ${nextRespect} for promotion` : `${Math.round(m.respect)}`} />
          <Meter label="⚔️ Rival hostility" value={m.rivalHeat} tone={m.rivalHeat >= 60 ? "red" : "slate"} note={m.rivalHeat >= 60 ? "war" : `${Math.round(m.rivalHeat)}`} />
          <Meter label="🚔 Police heat" value={p.justice.heat} tone={p.justice.heat >= 40 ? "red" : "amber"} note={HEAT_LABEL[scrutiny(p)]} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="blue">🏙️ {m.territory}/{MAX_TERRITORY} blocks{m.territory > 0 ? ` (${money(territoryIncome(tier, m.territory))}/yr)` : ""}</Pill>
          <Pill>👥 Crew {m.crew}/{MAX_CREW}</Pill>
          <Pill>📋 {m.jobsDone} jobs</Pill>
          {m.informant && <Pill tone="amber">🎙️ Wired (exposure {Math.round(m.exposure)}%)</Pill>}
          {m.marked && <Pill tone="red">☠️ Marked</Pill>}
        </div>
        {m.loyalty < 25 && <div className="mt-2"><Banner tone="red">The family is losing patience with you. Below 15 loyalty they may decide you are a problem.</Banner></div>}
        {m.rivalHeat >= 60 && <div className="mt-2"><Banner tone="amber">A rival crew is gunning for you. A sit-down could cool things, and so could a lot of money.</Banner></div>}
      </Card>

      <SectionTitle hint={`${Math.max(0, jobsLeft)} job${jobsLeft === 1 ? "" : "s"} left this year`}>Take on a Job</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-400">Planning</div>
            <div className="flex gap-1">
              {[0, 1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setPlan(n as 0 | 1 | 2)} className={`flex-1 rounded-lg px-1 py-1.5 text-xs font-medium ${plan === n ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                  {["Wing it", "Scout", "Plan"][n]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-400">Crew ({m.crew} available)</div>
            <div className="flex gap-1">
              {[0, 1, 2].map((n) => (
                <button key={n} type="button" disabled={n > crewMax} onClick={() => setCrew(n)} className={`flex-1 rounded-lg px-1 py-1.5 text-xs font-medium disabled:opacity-40 ${crewUsed === n ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                  {n === 0 ? "Solo" : `+${n}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Planning costs {planCost ? money(planCost) : "nothing"}. Crew takes 15% each and adds people who could talk later.</p>
      </Card>
      <div className="flex flex-col gap-2">
        {MOB_JOBS.map((j) => {
          const reason = j.minTier > tier ? `Needs rank: ${line.ladder[j.minTier].title}` : j.mature && !p.matureContent ? "Mature content is off" : jobsLeft <= 0 ? "The family authorises two jobs a year" : p.pendingTrial ? "On trial" : planCost > p.bankBalance ? "Can't afford the prep" : null;
          return (
            <div key={j.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{j.emoji} {j.name}</span>
                <span className="text-sm text-emerald-300">{Math.round(jobChance(p, j, plan, crewUsed) * 100)}%</span>
              </div>
              <div className="text-xs text-slate-400">{j.blurb} Pays {money(Math.round(j.reward[0] * (1 + tier * 0.5)))}–{money(Math.round(j.reward[1] * (1 + tier * 0.5)))}; heat +{j.heat}.</div>
              <ActionButton className="mt-2" variant="danger" label="Do the job" reason={reason} onClick={() => act((pl, rng) => runMobJob(pl, j.id, rng, { plan, crew: crewUsed }))} />
            </div>
          );
        })}
      </div>

      <SectionTitle>Running the Block</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-2">
          <ActionButton label="🎁 Pay Respects to the Boss" hint={`${money(2_000 * (1 + tier))}: +8 loyalty`} reason={used("mob:respects") ? "Done this year" : null} onClick={() => act((pl) => payRespects(pl))} />
          <ActionButton label="👥 Recruit a Crew Member" hint="$5,000 · needs 20+ respect" reason={m.crew >= MAX_CREW ? "Crew is full" : m.respect < 20 ? "Needs 20+ respect" : used("mob:recruit") ? "Done this year" : null} onClick={() => act((pl) => recruitCrew(pl))} />
          <ActionButton label="🏙️ Muscle into New Territory" hint={`${money(15_000 * (1 + tier))}: pays ${money(territoryIncome(tier, 1))}/yr per block, raises rival hostility`} reason={tier < 1 ? "Soldiers and above only" : m.territory >= MAX_TERRITORY ? "Can't hold more ground" : used("mob:turf") ? "Done this year" : null} onClick={() => act((pl, rng) => expandTerritory(pl, rng))} />
          <ActionButton label="🍷 Hold a Sit-Down with Rivals" hint={`${money(10_000 * (1 + tier))}: −25 hostility (70%)`} reason={used("mob:sitdown") ? "Done this year" : null} onClick={() => act((pl, rng) => sitDown(pl, rng))} />
          <ActionButton label="🧾 Skim the Tribute" hint={`${Math.round(skimChance(p) * 100)}% you get caught: −40 loyalty`} variant="ghost" reason={used("mob:skim") ? "Done this year" : null} onClick={() => act((pl, rng) => skimTribute(pl, rng))} />
          {tier === 3 && <ActionButton label="👑 Move Against the Boss" hint={`${Math.round(coupChance(p) * 100)}% to succeed. Failure is usually fatal.`} variant="danger" reason={m.respect < 70 ? "Needs 70+ respect" : used("mob:coup") ? "Done this year" : null} onClick={() => act((pl, rng) => plotCoup(pl, rng))} />}
        </div>
      </Card>

      <SectionTitle hint="the way out">Betrayal & Exit</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-2">
          <ActionButton label="🎙️ Become an FBI Informant" hint="Immunity, $25,000 and 10,000/yr. Fewer raids, but if they find the wire, you're dead or worse." reason={m.informant ? "Already cooperating" : null} onClick={() => act((pl) => becomeInformant(pl))} />
          <ActionButton label="🛡️ Enter Witness Protection" hint="Leave the life for good: new city, family cut off, stipend." reason={!m.informant ? "Only informants are offered protection" : null} onClick={() => act((pl, rng) => enterWitsec(pl, rng))} />
          <ActionButton label="🚪 Walk Away" hint={`${Math.round(leaveRisk(p, false) * 100)}% they punish you (clean exit needs 70+ loyalty)`} variant="ghost" reason={null} onClick={() => act((pl, rng) => leaveMob(pl, rng, "walk"))} />
          <ActionButton label={`💼 Buy Your Way Out (${money(buyoutCost(tier))})`} hint={`${Math.round(leaveRisk(p, true) * 100)}% they punish you`} variant="ghost" reason={p.bankBalance < buyoutCost(tier) ? "Can't afford it" : null} onClick={() => act((pl, rng) => leaveMob(pl, rng, "buyout"))} />
        </div>
      </Card>
      <p className="text-xs text-slate-500">Money earned off the books is illicit proceeds: if you're convicted, the courts can seize it. Arrest odds depend on police heat, your rank and the country's policing.</p>
    </div>
  );
}
