"use client";

import { useGame } from "@/context/GameStateContext";
import { applyForJob, jobEligibility, quitJob } from "@/engine/career";
import { APPROACHES, inAgency, missionChance, runMission } from "@/engine/spy";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

export function SpySection() {
  const { player: p, act } = useGame();
  const job = inAgency(p) ? p.currentJob : null;
  const line = CAREER_BY_ID.spy;
  const elig = jobEligibility(p, line);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Secret Agent</SectionTitle>
      {job ? (
        <>
          <Card className="border-sky-900/60">
            <div className="text-xs uppercase tracking-widest text-sky-300">{job.company}</div>
            <div className="text-xl font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{money(job.salary)}/yr · mission bonus {money(20_000 * (job.tier + 1))}</div>
            <div className="mt-3"><StatBar label="Standing" value={job.performance} color="blue" compact /></div>
          </Card>
          <SectionTitle hint="one mission per year">Take a Mission</SectionTitle>
          {APPROACHES.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={(p.annual.mission ?? 0) >= 1}
              onClick={() => act((pl, rng) => runMission(pl, a.id, rng))}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{a.name}</span>
                <span className="text-sm text-emerald-300">{Math.round(missionChance(p, a.id) * 100)}%</span>
              </div>
              <div className="text-xs text-slate-400">{a.blurb} Uses {a.stat}.</div>
            </button>
          ))}
          <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Resign</Button>
        </>
      ) : (
        <Card>
          <p className="mb-2 text-sm text-slate-300">The Agency recruits quietly: a degree and 70+ Smarts. Pay is good. Disavowal is possible.</p>
          {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
          <Button variant="primary" className="w-full" disabled={!elig.ok || (p.annual["apply:spy"] ?? 0) >= 1} onClick={() => act((pl, rng) => applyForJob(pl, "spy", rng))}>🕵️ Apply to the Agency</Button>
        </Card>
      )}
    </div>
  );
}
