"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import type { Relative } from "@/types/game.types";
import {
  INTERACTION_CAP,
  dateNight,
  interact,
  leavePartner,
  meetSomeone,
  propose,
  tryForBaby,
  type SocialAction,
} from "@/engine/social";
import { Button, Card, MiniBar, Pill, SectionTitle } from "./ui";

const RELATION_ORDER = ["Partner", "Parent", "Child", "Sibling", "Friend"] as const;
const ICONS: Record<string, string> = { Partner: "💞", Parent: "👪", Child: "🧒", Sibling: "🧑‍🤝‍🧑", Friend: "🤝" };

function barColor(v: number) {
  return v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-400" : "bg-rose-500";
}

function label(r: Relative) {
  if (r.relation === "Partner") return r.partnerStatus === "married" ? "Spouse" : "Partner";
  if (r.relation === "Parent") return r.gender === "Female" ? "Mother" : r.gender === "Male" ? "Father" : "Parent";
  if (r.relation === "Sibling") return r.gender === "Female" ? "Sister" : r.gender === "Male" ? "Brother" : "Sibling";
  if (r.relation === "Child") return r.gender === "Female" ? "Daughter" : r.gender === "Male" ? "Son" : "Child";
  return r.relation;
}

export default function RelationshipsTab() {
  const { player: p, act } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const living = p.relatives.filter((r) => r.alive && r.partnerStatus !== "ex");
  const past = p.relatives.filter((r) => !r.alive || r.partnerStatus === "ex");
  const selected = living.find((r) => r.id === selectedId) ?? null;
  const hasPartner = living.some((r) => r.relation === "Partner");

  if (selected) {
    return <InteractionPanel rel={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <SectionTitle hint={`${living.length} living`}>Family & Friends</SectionTitle>
        <div className="flex flex-col gap-2">
          {RELATION_ORDER.flatMap((rel) => living.filter((r) => r.relation === rel)).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-emerald-500/60 active:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{ICONS[r.relation]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{label(r)} · {r.age}</span>
                  </div>
                  <div className="mt-1.5">
                    <MiniBar value={r.relationshipBar} color={barColor(r.relationshipBar)} />
                  </div>
                </div>
              </div>
            </button>
          ))}
          {living.length === 0 && <Card><p className="text-sm text-slate-400">You're all alone in the world. Go meet someone!</p></Card>}
        </div>
      </div>

      <div>
        <SectionTitle>Meet People</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => act((pl, rng) => meetSomeone(pl, "friend", rng))} disabled={p.age < 4}>
            🤝 Make a Friend
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => meetSomeone(pl, "date", rng))} disabled={p.age < 16 || hasPartner}>
            💘 Find Love
          </Button>
        </div>
      </div>

      {past.length > 0 && (
        <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-400">In memory & past relationships ({past.length})</summary>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
            {past.map((r) => (
              <li key={r.id}>
                {r.alive ? "💔" : "🕯️"} {r.name} — {r.alive ? `Ex (${r.age})` : `${label(r)}, died at ${r.deathAge ?? r.age}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function InteractionPanel({ rel, onBack }: { rel: Relative; onBack: () => void }) {
  const { player: p, act } = useGame();
  const used = p.annual[`rel:${rel.id}`] ?? 0;
  const capped = used >= INTERACTION_CAP;
  const run = (a: SocialAction) => act((pl, rng) => interact(pl, rel.id, a, rng));
  const canAsk = rel.relation === "Parent" && p.age < 22;

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-sm font-medium text-emerald-400 hover:text-emerald-300">
        ← Back
      </button>
      <Card>
        <div className="flex items-center gap-3">
          <div className="text-4xl">{ICONS[rel.relation]}</div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{rel.name}</div>
            <div className="text-sm text-slate-400">{label(rel)} · {rel.age} years old</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Relationship</span>
            <span className="tabular-nums">{Math.round(rel.relationshipBar)}</span>
          </div>
          <MiniBar value={rel.relationshipBar} color={barColor(rel.relationshipBar)} />
        </div>
        <div className="mt-2 flex gap-1.5">
          <Pill>Health {Math.round(rel.health)}</Pill>
          {rel.relation === "Partner" && <Pill tone="blue">{rel.partnerStatus === "married" ? "Married" : "Dating"}</Pill>}
        </div>
      </Card>

      <SectionTitle hint={capped ? "Take a breather until next year" : `${INTERACTION_CAP - used} left this year`}>Interact</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => run("spend")} disabled={capped}>🕒 Spend Time</Button>
        <Button onClick={() => run("converse")} disabled={capped}>💬 Converse</Button>
        <Button onClick={() => run("compliment")} disabled={capped}>🌸 Compliment</Button>
        <Button variant="danger" onClick={() => run("insult")}>😡 Insult</Button>
        {canAsk && (
          <Button variant="gold" className="col-span-2" onClick={() => run("askMoney")}>
            💵 Ask for Money
          </Button>
        )}
      </div>

      {rel.relation === "Partner" && (
        <>
          <SectionTitle>Together</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => act((pl) => dateNight(pl))}>🍷 Date Night ($100)</Button>
            <Button onClick={() => act((pl, rng) => tryForBaby(pl, rng))}>🍼 Try for a Baby</Button>
            {rel.partnerStatus === "dating" && (
              <Button variant="gold" onClick={() => act((pl, rng) => propose(pl, rng))}>💍 Propose</Button>
            )}
            <Button
              variant="danger"
              className={rel.partnerStatus === "dating" ? "" : "col-span-2"}
              onClick={() => {
                act((pl) => leavePartner(pl));
                onBack();
              }}
            >
              {rel.partnerStatus === "married" ? "⚖️ Divorce (−30% cash)" : "💔 Break Up"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
