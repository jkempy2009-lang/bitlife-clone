"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { epitaph, heirs, lifeStoryText, summarize } from "@/engine/legacy";
import { money } from "@/lib/format";
import { Button } from "./ui";
import LifeChart from "./LifeChart";

/** Endgame overlay: pauses all engine operations until the player chooses what to do next. */
export default function TombstoneOverlay() {
  const { player: p, continueAsChild, quitToMenu, deleteSave } = useGame();
  const summary = useMemo(() => summarize(p), [p]);
  const eulogy = useMemo(() => epitaph(p), [p]);
  const kids = heirs(p);
  const [choosing, setChoosing] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyStory = async () => {
    try {
      await navigator.clipboard.writeText(lifeStoryText(p));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShowLog(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-5">
        <div className="pop-in w-full">
          {/* Tombstone */}
          <div className="mx-auto w-full max-w-xs rounded-t-[120px] border-4 border-slate-500 bg-gradient-to-b from-slate-300 to-slate-400 px-6 pb-8 pt-14 text-center text-slate-800 shadow-[0_0_60px_rgba(148,163,184,0.25)]">
            <div className="text-3xl">✝</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">Here Lies</div>
            <h1 className="mt-1 font-serif text-2xl font-black leading-tight">{p.firstName} {p.lastName}</h1>
            <div className="mt-1 font-serif text-sm text-slate-600">{summary.lifespan} · Age {p.age}</div>
            <div className="mx-auto my-3 h-px w-16 bg-slate-500" />
            <p className="font-serif text-[15px] italic leading-snug">“{eulogy}”</p>
            <p className="mt-3 text-xs text-slate-600">Cause of death: <strong className="capitalize">{p.causeOfDeath ?? "unknown"}</strong></p>
          </div>

          {/* Life summary */}
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">A Life in Numbers</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <dt className="text-slate-400">Final net worth</dt>
              <dd className="text-right font-bold text-amber-300">{money(summary.netWorth)}</dd>
              <dt className="text-slate-400">Cash</dt>
              <dd className="text-right font-semibold">{money(summary.finalAssets.cash)}</dd>
              <dt className="text-slate-400">Property</dt>
              <dd className="text-right font-semibold">{money(summary.finalAssets.property)}</dd>
              <dt className="text-slate-400">Vehicles</dt>
              <dd className="text-right font-semibold">{money(summary.finalAssets.vehicles)}</dd>
              <dt className="text-slate-400">Investments & business</dt>
              <dd className="text-right font-semibold">{money(summary.finalAssets.investments)}</dd>
              <dt className="text-slate-400">Debts</dt>
              <dd className="text-right font-semibold text-rose-300">{money(summary.finalAssets.debt)}</dd>
              <dt className="text-slate-400">Highest career</dt>
              <dd className="text-right font-semibold">{summary.highestCareer}</dd>
              <dt className="text-slate-400">Crimes committed</dt>
              <dd className="text-right font-semibold">{summary.crimes}</dd>
              <dt className="text-slate-400">Children born</dt>
              <dd className="text-right font-semibold">{summary.children}</dd>
            </dl>
          </div>

          <LifeChart history={p.history} />

          {/* Generational continuity */}
          {!choosing ? (
            <div className="mt-4 flex flex-col gap-2">
              {kids.length > 0 ? (
                <Button variant="gold" className="w-full py-3 text-base" onClick={() => (kids.length === 1 ? continueAsChild(kids[0].id) : setChoosing(true))}>
                  👶 Continue as Your Child
                </Button>
              ) : (
                <>
                  <Button variant="gold" className="w-full py-3 text-base" disabled>
                    No Heirs Found
                  </Button>
                  <p className="text-center text-xs text-slate-500">Only living children can inherit your legacy.</p>
                </>
              )}
              <Button variant="primary" className="w-full" onClick={() => { quitToMenu(); }}>
                🌱 Start a New Life
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowLog((s) => !s)}>
                {showLog ? "Hide" : "Read"} your life story
              </Button>
              <Button variant="secondary" className="w-full" onClick={copyStory}>
                {copied ? "✅ Copied!" : "📋 Copy life story"}
              </Button>
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => {
                  deleteSave();
                  quitToMenu();
                }}
              >
                Delete this save and return to the menu
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-slate-400">Who will inherit?</h2>
              <div className="flex flex-col gap-2">
                {kids.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => continueAsChild(k.id)}
                    className="rounded-2xl border border-slate-600 bg-slate-800 p-3 text-left hover:border-amber-400"
                  >
                    <div className="font-semibold">{k.name}</div>
                    <div className="text-xs text-slate-400">Age {k.age} · {k.gender} · Smarts {k.smarts} · Looks {k.looks}</div>
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setChoosing(false)}>Back</Button>
            </div>
          )}

          {showLog && (
            <div className="scroll-thin mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-sm">
              {[...p.lifeLog].reverse().map((l, i) => (
                <div key={i} className={l.startsWith("## ") ? "mt-2 text-xs font-bold uppercase text-emerald-300" : "text-slate-300"}>
                  {l.startsWith("## ") ? l.slice(3) : l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
