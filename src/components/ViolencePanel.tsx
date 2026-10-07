"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { HITMAN_COST, METHODS, arson, assault, blackmail, commitMurder, coverChance, kidnap, targetsFor } from "@/engine/violence";
import { Button, Card, SectionTitle } from "./ui";

/** Violent crimes. Adults only, mature-content setting required. */
export default function ViolencePanel() {
  const { player: p, act } = useGame();
  const targets = targetsFor(p);
  const [targetId, setTargetId] = useState("stranger");
  const [method, setMethod] = useState<string>(METHODS[0].id);
  const [confirm, setConfirm] = useState(false);
  const target = targets.find((t) => t.id === targetId) ?? targets[0];
  const rel = p.relatives.find((r) => r.id === targetId);

  if (!p.matureContent) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Violent options are hidden while mature content is off. You can enable it in Settings (⚙️).</p>
      </Card>
    );
  }
  if (p.age < 18) {
    return (
      <Card>
        <p className="text-sm text-slate-400">These options are for adults only.</p>
      </Card>
    );
  }

  const selector = (
    <select
      value={target?.id}
      onChange={(e) => {
        setTargetId(e.target.value);
        setConfirm(false);
      }}
      className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
      aria-label="Target"
    >
      {targets.map((t) => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="adults only · non-graphic">Violence & Vengeance</SectionTitle>
      <Card className="border-rose-900/50">
        <div className="text-xl">🗡️ <span className="font-bold">Murder</span></div>
        <p className="mb-2 mt-1 text-xs text-slate-400">The ultimate crime. Choose a target and a method, then live with it. Detectives can reopen cases years later, and some countries have the death penalty.</p>
        {selector}
        <select value={method} onChange={(e) => { setMethod(e.target.value); setConfirm(false); }} className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm" aria-label="Method">
          {METHODS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="mb-2 text-xs text-slate-400">
          {METHODS.find((m) => m.id === method)?.blurb} Odds of avoiding suspicion: {Math.round(coverChance(p, method, target?.kind ?? "stranger", rel) * 100)}%.
        </div>
        {!confirm ? (
          <Button variant="danger" className="w-full" disabled={(p.annual.murder ?? 0) >= 1 || (method === "hitman" && p.bankBalance < HITMAN_COST)} onClick={() => setConfirm(true)}>
            Plan it…
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <p className="col-span-2 text-center text-sm font-semibold text-rose-300">Really target {target?.label}? There is no undoing this.</p>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Back out</Button>
            <Button variant="danger" onClick={() => { setConfirm(false); act((pl, rng) => commitMurder(pl, target.id, method, rng)); }}>Do it</Button>
          </div>
        )}
        {p.stats.kills > 0 && <p className="mt-2 text-xs text-rose-300">Lives taken: {p.stats.kills}</p>}
      </Card>

      <Card>
        <div className="mb-2 font-semibold">👊 Assault · ✉️ Blackmail</div>
        {selector}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger" disabled={(p.annual.assault ?? 0) >= 2} onClick={() => act((pl, rng) => assault(pl, target.id, rng))}>👊 Beat Them Up</Button>
          <Button variant="danger" disabled={(p.annual.blackmail ?? 0) >= 1 || target?.kind === "stranger"} onClick={() => act((pl, rng) => blackmail(pl, target.id, rng))}>✉️ Blackmail</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-2">
        <Button variant="danger" disabled={p.properties.length === 0 || (p.annual.arson ?? 0) >= 1} onClick={() => act((pl, rng) => arson(pl, "own", rng))}>🔥 Burn Down Your Property for Insurance</Button>
        <Button variant="danger" disabled={(p.annual.arson ?? 0) >= 1} onClick={() => act((pl, rng) => arson(pl, "rival", rng))}>🔥 Torch a Rival's Business</Button>
        <Button variant="danger" disabled={(p.annual.kidnap ?? 0) >= 1} onClick={() => act((pl, rng) => kidnap(pl, rng))}>🧳 Kidnap an Executive for Ransom</Button>
      </div>
      <p className="text-xs text-slate-500">Arson and kidnapping can bring decades behind bars.</p>
    </div>
  );
}
