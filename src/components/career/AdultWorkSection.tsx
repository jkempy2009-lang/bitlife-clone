"use client";

import { useGame } from "@/context/GameStateContext";
import { applyForJob, jobEligibility, workHarder, quitJob } from "@/engine/career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

export function AdultWorkSection() {
  const { player: p, act } = useGame();
  const lines = ["dancer", "escort", "creator"].map((id) => CAREER_BY_ID[id]);
  const job = p.currentJob && lines.some((l) => l.id === p.currentJob?.lineId) ? p.currentJob : null;
  if (!p.matureContent || p.age < 18) {
    return <Card><p className="text-sm text-slate-400">Adult work is hidden while mature content is off. Enable it in Settings (⚙️).</p></Card>;
  }
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="18+ · legal gray areas vary by country">Adult Work</SectionTitle>
      {job ? (
        <Card className="border-fuchsia-900/60">
          <div className="text-xs uppercase tracking-widest text-fuchsia-300">{job.company}</div>
          <div className="text-xl font-bold">{job.title}</div>
          <div className="text-sm text-slate-400">{money(job.salary)}/yr</div>
          <div className="mt-3"><StatBar label="Standing" value={job.performance} color="pink" /></div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={(p.annual.work ?? 0) >= 1} onClick={() => act((pl, rng) => workHarder(pl, rng))}>💪 Push Harder</Button>
            <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Quit</Button>
          </div>
        </Card>
      ) : (
        lines.map((line) => {
          const elig = jobEligibility(p, line);
          return (
            <div key={line.id} className="flex items-start gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
              <span className="text-2xl">{line.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{line.name}</div>
                <div className="text-xs text-slate-400">{line.blurb}</div>
                <div className="mt-1 text-xs text-slate-500">{money(line.ladder[0].salary)}/yr → {money(line.ladder[line.ladder.length - 1].salary)}</div>
                {!elig.ok && <div className="mt-1 text-xs font-medium text-rose-300">🔒 {elig.reason}</div>}
              </div>
              <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={!elig.ok || (p.annual[`apply:${line.id}`] ?? 0) >= 1} onClick={() => act((pl, rng) => applyForJob(pl, line.id, rng))}>Apply</Button>
            </div>
          );
        })
      )}
      <p className="text-xs text-slate-500">Everything is between consenting adults. Health, legal and family risks are real.</p>
    </div>
  );
}
