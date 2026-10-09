"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import type { DynastyField, Relative } from "@/types/game.types";
import { buildFamilyTree, type TreeNode } from "@/engine/familyTree";
import { FIELD_INFO, GROOM_BLURB, GROOM_COST, GROOM_TRACKS, cloutWord, familyFortune, fundTrust, groomBlocker, groomChild, setWill, TRUST_MIN_GIFT, TRUST_PAYOUT } from "@/engine/dynasty";
import { PLAN_INFO } from "@/engine/estate";
import { money } from "@/lib/format";
import { Button, Card, MiniBar, Pill, SectionTitle } from "./ui";

function Node({ n }: { n: TreeNode }) {
  return (
    <div className={`rounded-xl border p-2.5 text-sm ${n.relation === "You" ? "border-emerald-500/60 bg-emerald-950/30" : "border-slate-700/60 bg-slate-800/60"} ${n.alive ? "" : "opacity-60"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold">{n.name}</span>
        <span className="shrink-0 text-xs text-slate-400">{n.label} · {n.alive ? n.age : `died at ${n.age}`}</span>
      </div>
      {(n.title || n.note || n.tags.length > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {n.title && <Pill tone="amber">{n.title}</Pill>}
          {n.tags.map((t) => <Pill key={t}>{t}</Pill>)}
          {n.note && <span className="text-xs text-slate-400">{n.note}</span>}
        </div>
      )}
    </div>
  );
}

function Layer({ title, nodes }: { title: string; nodes: TreeNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <SectionTitle hint={`${nodes.length}`}>{title}</SectionTitle>
      <div className="flex flex-col gap-1.5">{nodes.map((n) => <Node key={n.id} n={n} />)}</div>
    </div>
  );
}

export default function FamilyView({ onBack }: { onBack: () => void }) {
  const { player: p, act } = useGame();
  const tree = buildFamilyTree(p);
  const [kidId, setKidId] = useState<string | null>(null);
  const kids: Relative[] = p.relatives.filter((r) => r.relation === "Child" && r.alive);
  const kid = kids.find((k) => k.id === kidId) ?? null;
  const clout = Object.entries(p.dynasty.clout).filter(([, v]) => (v ?? 0) > 0) as [DynastyField, number][];
  const will = p.dynasty.will;
  const trust = p.dynasty.trust;

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" onClick={onBack}>← Back</Button>
      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-400">The {p.dynasty.name} family · generation {tree.standing.generation}</div>
        <div className="mt-1 text-xl font-bold">{tree.standing.tier}</div>
        <p className="text-sm text-slate-300">{tree.standing.blurb}</p>
        <div className="mt-2 text-xs text-slate-400">Dynasty score {Math.round(tree.standing.score)} · family fortune {money(familyFortune(p))}</div>
      </Card>

      {tree.succession && (
        <Card>
          <SectionTitle>Line of succession</SectionTitle>
          <p className="mb-2 text-xs text-slate-400">{tree.succession.note}</p>
          <ol className="flex flex-col gap-1 text-sm">
            {tree.succession.line.map((e) => (
              <li key={e.id} className={`flex justify-between rounded-lg px-2 py-1 ${e.you ? "bg-emerald-900/40 font-semibold" : "bg-slate-800/60"}`}>
                <span>{e.place}. {e.name}{e.you ? " (you)" : ""}</span>
                <span className="text-xs text-slate-400">{e.label} · {e.age}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Layer title="Earlier generations" nodes={tree.chronicle.map((g) => ({ id: `g${g.generation}`, name: g.name, label: `Generation ${g.generation}`, relation: "Parent", age: g.age, alive: false, gender: g.gender, note: g.headline, tags: g.honours.slice(0, 2), parentId: undefined }))} />
      <Layer title="Elders" nodes={tree.elders} />
      <Layer title="Your generation" nodes={[...(tree.partner ? [tree.partner] : []), tree.you, ...tree.siblings]} />
      <Layer title="Nephews and nieces" nodes={tree.nephews} />
      <Layer title="Children" nodes={tree.children} />
      <Layer title="Grandchildren" nodes={tree.grandchildren} />

      {clout.length > 0 && (
        <Card>
          <SectionTitle hint="what the surname opens">Family name</SectionTitle>
          <div className="flex flex-col gap-2">
            {clout.map(([f, v]) => (
              <div key={f}>
                <div className="mb-1 flex justify-between text-xs"><span>{FIELD_INFO[f].emoji} {FIELD_INFO[f].label}</span><span className="text-slate-400">{cloutWord(v)}</span></div>
                <MiniBar value={v} color="bg-amber-400" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle hint={trust ? money(trust.balance) : "none"}>Family trust</SectionTitle>
        <p className="mb-2 text-xs text-slate-400">Money settled here can't be taxed at death, split by a will or seized, and pays {Math.round(TRUST_PAYOUT * 100)}% a year. You can't take it back. Minimum {money(TRUST_MIN_GIFT)}.</p>
        <div className="grid grid-cols-3 gap-2">
          {[10_000, 50_000, 250_000].map((a) => (
            <Button key={a} variant="secondary" disabled={p.bankBalance < a} onClick={() => act((pl) => fundTrust(pl, a))}>{money(a)}</Button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle hint="used when you die">Your will</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(PLAN_INFO) as (keyof typeof PLAN_INFO)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => act((pl) => setWill(pl, k, k === "chosen" ? (kids[0]?.id ?? null) : null))}
              className={`rounded-xl border p-2.5 text-left text-sm ${will.plan === k ? "border-emerald-500/70 bg-emerald-950/30" : "border-slate-700/60 bg-slate-800/60"}`}
            >
              <div className="font-semibold">{PLAN_INFO[k].emoji} {PLAN_INFO[k].label}</div>
              <div className="text-xs text-slate-400">{PLAN_INFO[k].blurb}</div>
            </button>
          ))}
        </div>
        {will.plan === "chosen" && kids.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {kids.map((k) => (
              <Button key={k.id} variant={will.chosenId === k.id ? "primary" : "secondary"} className="px-3 py-1.5 text-xs" onClick={() => act((pl) => setWill(pl, "chosen", k.id))}>{k.name.split(" ")[0]}</Button>
            ))}
          </div>
        )}
      </Card>

      {kids.some((k) => k.age >= 6 && k.age <= 22) && (
        <Card>
          <SectionTitle hint="one child a year">Raise an heir</SectionTitle>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {kids.filter((k) => k.age >= 6 && k.age <= 22).map((k) => (
              <Button key={k.id} variant={kidId === k.id ? "primary" : "secondary"} className="px-3 py-1.5 text-xs" onClick={() => setKidId(k.id)}>
                {k.name.split(" ")[0]} ({k.age}){k.groom ? ` · ${FIELD_INFO[k.groom.track].emoji} ${Math.round(k.groom.level)}` : ""}
              </Button>
            ))}
          </div>
          {kid && (
            <div className="flex flex-col gap-1.5">
              {GROOM_TRACKS.map((t) => {
                const why = groomBlocker(p, kid, t);
                return (
                  <Button key={t} variant="secondary" className="justify-start text-left" disabled={!!why} title={why ?? GROOM_BLURB[t]} onClick={() => act((pl, rng) => groomChild(pl, rng, kid.id, t))}>
                    {FIELD_INFO[t].emoji} {FIELD_INFO[t].label}{GROOM_COST[t] ? ` · ${money(GROOM_COST[t])}` : ""}
                    <span className="block text-xs font-normal text-slate-400">{why ?? GROOM_BLURB[t]}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
