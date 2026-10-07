"use client";

import { useGame } from "@/context/GameStateContext";
import { LAWYERS } from "@/data/crimes";
import { resolveTrial } from "@/engine/crime";
import { money } from "@/lib/format";

/** Full-screen Justice Subsystem overlay. Main navigation is hidden while it is up. */
export default function TrialView() {
  const { player: p, act } = useGame();
  const charge = p.pendingTrial;
  if (!charge) return null;
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-gradient-to-b from-slate-950 via-rose-950/60 to-slate-950">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-5">
        <div className="pop-in">
          <div className="text-center text-5xl">⚖️</div>
          <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-rose-300">YOU'RE ON TRIAL</h1>
          <div className="mt-5 rounded-2xl border border-rose-700/60 bg-slate-900/80 p-4">
            <div className="text-xs uppercase tracking-widest text-rose-300">The Charge</div>
            <div className="text-xl font-bold">{charge.name}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{charge.description}</p>
            <p className="mt-2 text-xs text-slate-500">Possible sentence: about {charge.years} year{charge.years === 1 ? "" : "s"} ({charge.severity}).</p>
          </div>
          <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Choose your representation</h2>
          <div className="flex flex-col gap-2">
            {LAWYERS.map((l) => {
              const cant = l.cost > p.bankBalance;
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={cant}
                  onClick={() => act((pl, rng) => resolveTrial(pl, l.id, rng))}
                  className="rounded-2xl border border-slate-600 bg-slate-800/80 p-4 text-left transition-colors hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">{l.name}</span>
                    <span className="text-sm font-semibold text-amber-300">{l.cost ? money(l.cost) : "Free"}</span>
                  </div>
                  <div className="text-xs text-slate-400">{l.blurb}</div>
                  <div className="mt-1 text-sm text-emerald-300">
                    {l.id === "plea" ? "Guaranteed conviction, half the sentence" : `${Math.round(l.successChance * 100)}% chance of acquittal`}
                  </div>
                  {cant && <div className="text-xs text-rose-300">You can't afford this.</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
