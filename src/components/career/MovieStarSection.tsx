"use client";

import { useGame } from "@/context/GameStateContext";
import { CAREER_LINES } from "@/data/careersRegistry";
import { FAMOUS_FAME, applyForJob, auditionForLead, jobEligibility, shootCommercial, writeMemoir } from "@/engine/career";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

// ---------------------------------------------------------------------------
// Movie Star pack
// ---------------------------------------------------------------------------

export function MovieStarSection() {
  const { player: p, act } = useGame();
  const line = CAREER_LINES.find((l) => l.id === "actor")!;
  const job = p.currentJob?.lineId === "actor" ? p.currentJob : null;
  const elig = jobEligibility(p, line);
  const famous = p.fame >= FAMOUS_FAME;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Movie Star</SectionTitle>
      <Card>
        <StatBar label="🌟 Fame" value={p.fame} color="amber" />
        {job ? (
          <>
            <div className="text-lg font-bold">{job.title}</div>
            <div className="mb-2 text-sm text-slate-400">{job.company} · {money(job.salary)}/yr</div>
            <StatBar label="Performance" value={job.performance} color="green" />
            <Button
              variant="gold"
              className="w-full"
              disabled={(p.annual.audition ?? 0) >= 1 || job.tier >= 3}
              onClick={() => act((pl, rng) => auditionForLead(pl, rng))}
            >
              {job.tier >= 3 ? "You're at the top!" : "🎭 Audition for Lead Role"}
            </Button>
            <p className="mt-2 text-xs text-slate-500">Success odds scale with Looks × Performance.</p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-300">Start at the bottom: a Background Actor needs Looks above 70.</p>
            {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
            <Button variant="primary" className="w-full" disabled={!elig.ok || (p.annual["apply:actor"] ?? 0) >= 1} onClick={() => act((pl, rng) => applyForJob(pl, "actor", rng))}>
              🎬 Become a Background Actor
            </Button>
          </>
        )}
      </Card>

      <SectionTitle hint={famous ? "unlocked" : `unlocks at ${FAMOUS_FAME} Fame`}>Celebrity Activities</SectionTitle>
      <div className="grid grid-cols-1 gap-2">
        <Button variant="primary" disabled={!famous || (p.annual.commercial ?? 0) >= 1} onClick={() => act((pl) => shootCommercial(pl))}>
          📺 Shoot a Commercial (+$50,000, +5 Fame)
        </Button>
        <Button variant="primary" disabled={!famous || (p.annual.memoir ?? 0) >= 1} onClick={() => act((pl, rng) => writeMemoir(pl, rng))}>
          📖 Write a Memoir (pays ≈ {money(p.fame * 25_000)})
        </Button>
      </div>
    </div>
  );
}
