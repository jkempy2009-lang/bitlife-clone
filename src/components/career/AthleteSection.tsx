"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { SPORTS, signWithClub, trainAthletics } from "@/engine/paths";
import { jobEligibility, workHarder, quitJob } from "@/engine/career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

export function AthleteSection() {
  const { player: p, act } = useGame();
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const job = p.currentJob?.lineId === "athlete" ? p.currentJob : null;
  const line = CAREER_BY_ID.athlete;
  const elig = jobEligibility(p, line);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Professional Sports</SectionTitle>
      <Card>
        <StatBar label="🏃 Athletics" value={p.skills.athletics} color="teal" />
        <StatBar label="❤️ Health" value={p.health} color="green" compact />
        {job ? (
          <div className="mt-3">
            <div className="text-lg font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{job.company} · {money(job.salary)}/yr</div>
            <div className="mt-2"><StatBar label="Performance" value={job.performance} color="green" /></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" disabled={(p.annual.work ?? 0) >= 1} onClick={() => act((pl, rng) => workHarder(pl, rng))}>💪 Push Harder</Button>
              <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Leave Club</Button>
            </div>
          </div>
        ) : null}
      </Card>
      <Button variant="secondary" disabled={(p.annual.train ?? 0) >= 1 || p.age < 8} onClick={() => act((pl, rng) => trainAthletics(pl, rng))}>
        🏋️ Training Camp ({(p.annual.train ?? 0) >= 1 ? "done" : "+4–8 Athletics"})
      </Button>
      {!job && (
        <Card>
          <div className="mb-1 font-semibold">Sign with a club</div>
          <p className="mb-2 text-xs text-slate-400">Needs 40+ Athletics and age 16+. Better skill and health mean better odds. Careers end around 36–40, and injuries happen.</p>
          <select value={sport} onChange={(e) => setSport(e.target.value)} className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm" aria-label="Sport">
            {SPORTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
          <Button variant="gold" className="w-full" disabled={!elig.ok || (p.annual["apply:athlete"] ?? 0) >= 1} onClick={() => act((pl, rng) => signWithClub(pl, sport, rng))}>
            🏅 Try Out
          </Button>
        </Card>
      )}
    </div>
  );
}
