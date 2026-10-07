"use client";

import { useGame } from "@/context/GameStateContext";
import { jobEligibility, workHarder } from "@/engine/career";
import { inMob, joinMob, leaveMob } from "@/engine/underworld";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

export function UnderworldSection() {
  const { player: p, act } = useGame();
  const job = inMob(p) ? p.currentJob : null;
  const line = CAREER_BY_ID.mafia;
  const elig = jobEligibility(p, line);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>The Underworld</SectionTitle>
      {job ? (
        <Card className="border-rose-900/60">
          <div className="text-xs uppercase tracking-widest text-rose-300">{job.company}</div>
          <div className="text-xl font-bold">{job.title}</div>
          <div className="text-sm text-slate-400">{money(job.salary)}/yr, untaxed · arrest and gang-war risk rises with rank</div>
          <div className="mt-3"><StatBar label="Standing" value={job.performance} color="red" /></div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" disabled={(p.annual.work ?? 0) >= 1} onClick={() => act((pl, rng) => workHarder(pl, rng))}>🔫 Take on a Job</Button>
            <Button variant="ghost" onClick={() => act((pl, rng) => leaveMob(pl, rng))}>Leave the Family</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="mb-2 text-sm text-slate-300">Associates earn off-the-books cash and climb to Boss. But the police, rival crews, and your conscience are all watching.</p>
          <p className="mb-2 text-xs text-slate-500">Odds improve with a criminal record and a low karma. Open to Karma 50 or lower.</p>
          {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
          <Button variant="danger" className="w-full" disabled={!elig.ok || (p.annual["apply:mafia"] ?? 0) >= 1} onClick={() => act((pl, rng) => joinMob(pl, rng))}>🕴️ Seek Out the Family</Button>
        </Card>
      )}
    </div>
  );
}
