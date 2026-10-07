"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { ESCAPE_PATHS, attemptEscape, requestParole, startRiot, studyInPrison, workOutYard } from "@/engine/crime";
import { Button, Card, SectionTitle, StatBar } from "./ui";

/** Penitentiary Dashboard. */
export default function PrisonView() {
  const { player: p, act } = useGame();
  const [escaping, setEscaping] = useState(false);
  const prison = p.prison;
  if (!prison) return null;
  const remaining = Math.max(0, prison.sentenceYears - prison.yearsServed);
  const pct = (prison.yearsServed / prison.sentenceYears) * 100;

  return (
    <div className="flex flex-col gap-3">
      <Card className="border-rose-900/60 bg-gradient-to-br from-zinc-900 to-slate-800">
        <div className="mb-1 text-xs uppercase tracking-widest text-rose-300">State Penitentiary</div>
        <div className="text-2xl font-bold">Inmate #{p.id.slice(0, 5).toUpperCase()}</div>
        <div className="text-sm text-slate-400">{p.firstName} {p.lastName} · Convicted of {prison.charge}</div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-slate-200">Sentence</span>
            <span className="tabular-nums text-slate-300">{remaining} year{remaining === 1 ? "" : "s"} remaining</span>
          </div>
          <div className="relative h-4 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Sentence served">
            <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">{prison.yearsServed} of {prison.sentenceYears} years served</div>
        </div>
      </Card>

      <Card>
        <StatBar label="❤️ Health" value={p.health} color="teal" />
        <StatBar label="😊 Happiness" value={p.happiness} color="green" compact />
      </Card>

      <SectionTitle>Prison Activities</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => act((pl) => workOutYard(pl))} disabled={(p.annual.yard ?? 0) >= 1}>
          🏋️ Work Out in the Yard
        </Button>
        <Button variant="secondary" onClick={() => act((pl) => studyInPrison(pl))} disabled={(p.annual.prisonstudy ?? 0) >= 1}>
          📚 Library
        </Button>
        <Button variant="danger" onClick={() => act((pl, rng) => startRiot(pl, rng))} disabled={(p.annual.riot ?? 0) >= 1}>
          🔥 Start a Riot
        </Button>
        <Button variant="gold" onClick={() => setEscaping(true)} disabled={(p.annual.escape ?? 0) >= 1}>
          🏃 Escape Attempt
        </Button>
        <Button variant="ghost" className="col-span-2" onClick={() => act((pl, rng) => requestParole(pl, rng))} disabled={(p.annual.parole ?? 0) >= 1}>
          ⚖️ Request Parole {prison.yearsServed < prison.sentenceYears / 2 ? "(after half your sentence)" : ""}
        </Button>
      </div>
      <p className="text-xs text-slate-500">Relationships, tabs and your job are on hold while you're inside. Age up to serve a year.</p>

      {escaping && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/85 p-3 sm:items-center">
          <div className="pop-in w-full max-w-md rounded-3xl border border-amber-500/50 bg-slate-800 p-5">
            <h2 className="text-xl font-bold text-amber-300">Plan Your Escape</h2>
            <p className="mb-3 mt-1 text-sm text-slate-400">Failure means 3 more years. Success makes you a fugitive.</p>
            <div className="flex flex-col gap-2">
              {ESCAPE_PATHS.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => {
                    setEscaping(false);
                    act((pl, rng) => attemptEscape(pl, path.id, rng));
                  }}
                  className="rounded-xl border border-slate-600 bg-slate-700/60 p-3 text-left hover:border-amber-400"
                >
                  <div className="font-semibold">{path.name}</div>
                  <div className="text-xs text-slate-400">{path.blurb}</div>
                </button>
              ))}
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setEscaping(false)}>Never mind</Button>
          </div>
        </div>
      )}
    </div>
  );
}
