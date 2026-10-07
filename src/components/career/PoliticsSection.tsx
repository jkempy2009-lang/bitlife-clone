"use client";

import { useGame } from "@/context/GameStateContext";
import { CAMPAIGN_COST, MIN_AGE, PARTIES, TERM_YEARS, canRun, charityDrive, electionChance, giveSpeech, joinParty, nextTier, runForOffice } from "@/engine/politics";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

export function PoliticsSection() {
  const { player: p, act } = useGame();
  const line = CAREER_BY_ID.politics;
  const job = p.currentJob?.lineId === "politics" ? p.currentJob : null;
  const tier = nextTier(p);
  const next = line.ladder[tier];
  const check = canRun(p);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Politics</SectionTitle>
      <Card>
        {job ? (
          <>
            <div className="text-lg font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{job.company} · {money(job.salary)}/yr · term year {p.politics.yearsInOffice + 1}/{TERM_YEARS}</div>
          </>
        ) : (
          <div className="text-sm text-slate-300">You hold no office. Win elections, from city council all the way to head of state.</div>
        )}
        <div className="mt-3"><StatBar label="🗳️ Popularity" value={p.politics.popularity} color="blue" compact /></div>
      </Card>
      <SectionTitle hint={p.politics.party ? "switching costs popularity" : "pick your side"}>Your Party</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {PARTIES.map((party) => (
          <button
            key={party.id}
            type="button"
            disabled={p.politics.party === party.id}
            onClick={() => act((pl) => joinParty(pl, party.id))}
            className={`rounded-xl border p-2.5 text-left transition-colors disabled:cursor-default ${p.politics.party === party.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700/60 bg-slate-800/60 hover:border-emerald-500/50"}`}
          >
            <div className="text-sm font-semibold">{party.emoji} {party.name}</div>
            <div className="text-xs text-slate-400">{party.blurb}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={(p.annual.speech ?? 0) >= 1 || p.age < 18} onClick={() => act((pl, rng) => giveSpeech(pl, rng))}>🎤 Give a Speech</Button>
        <Button variant="secondary" disabled={(p.annual.drive ?? 0) >= 1 || p.bankBalance < 5_000} onClick={() => act((pl) => charityDrive(pl))}>🤝 Charity Drive ($5,000)</Button>
      </div>
      {next && (
        <Card>
          <div className="font-semibold">Run for {next.title}</div>
          <div className="text-xs text-slate-400">Campaign cost {money(CAMPAIGN_COST[tier])} · age {MIN_AGE[tier]}+ · salary {money(next.salary)}</div>
          {check.ok ? <div className="mt-1 text-xs text-emerald-300">Estimated odds: {Math.round(electionChance(p, tier) * 100)}%</div> : <div className="mt-1 text-xs font-medium text-rose-300">🔒 {check.reason}</div>}
          <Button variant="gold" className="mt-2 w-full" disabled={!check.ok || (p.annual.campaign ?? 0) >= 1} onClick={() => act((pl, rng) => runForOffice(pl, rng))}>🏛️ Launch Campaign</Button>
        </Card>
      )}
      <p className="text-xs text-slate-500">Karma, charisma, fame and popularity all sway voters. Incumbents face re-election every {TERM_YEARS} years.</p>
    </div>
  );
}
