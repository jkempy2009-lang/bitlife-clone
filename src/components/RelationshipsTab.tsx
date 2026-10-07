"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import type { Relative } from "@/types/game.types";
import {
  ADOPTION_COST,
  INTERACTION_CAP,
  PET_COST,
  adoptChild,
  adoptPet,
  dateNight,
  interact,
  leavePartner,
  meetSomeone,
  propose,
  tryForBaby,
  type SocialAction,
} from "@/engine/social";
import {
  GETAWAY_COST,
  LOVE_CAP,
  SPICE_COST,
  SWINGER_COST,
  VENUES,
  askThreesome,
  endLover,
  hookUp,
  leaveForLover,
  makeLove,
  proposeOpenRelationship,
  romanticGetaway,
  seduce,
  spiceItUp,
  swingerClub,
} from "@/engine/intimacy";
import { money } from "@/lib/format";
import { spouseIncome } from "@/engine/household";
import { Button, Card, MiniBar, Pill, SectionTitle } from "./ui";

const RELATION_ORDER = ["Partner", "Lover", "Parent", "Child", "Grandchild", "Sibling", "Grandparent", "Friend", "Pet"] as const;
const ICONS: Record<string, string> = {
  Partner: "💞",
  Lover: "🔥",
  Parent: "👪",
  Child: "🧒",
  Sibling: "🧑‍🤝‍🧑",
  Friend: "🤝",
  Grandparent: "👵",
  Grandchild: "👶",
  Pet: "🐾",
};

function barColor(v: number) {
  return v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-400" : "bg-rose-500";
}

function label(r: Relative) {
  if (r.relation === "Partner") return r.partnerStatus === "married" ? "Spouse" : "Partner";
  if (r.relation === "Lover") return r.partnerStatus === "affair" ? "Secret lover" : "Fling";
  if (r.relation === "Pet") return r.species === "cat" ? "Cat" : "Dog";
  if (r.relation === "Parent") return r.gender === "Female" ? "Mother" : r.gender === "Male" ? "Father" : "Parent";
  if (r.relation === "Sibling") return r.gender === "Female" ? "Sister" : r.gender === "Male" ? "Brother" : "Sibling";
  if (r.relation === "Child") return r.gender === "Female" ? "Daughter" : r.gender === "Male" ? "Son" : "Child";
  if (r.relation === "Grandparent") return r.gender === "Female" ? "Grandmother" : "Grandfather";
  if (r.relation === "Grandchild") return "Grandchild";
  return r.relation;
}

export default function RelationshipsTab() {
  const { player: p, act } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [safe, setSafe] = useState(true);

  const living = p.relatives.filter((r) => r.alive && r.partnerStatus !== "ex");
  const past = p.relatives.filter((r) => !r.alive || r.partnerStatus === "ex");
  const selected = living.find((r) => r.id === selectedId) ?? null;
  const partner = living.find((r) => r.relation === "Partner");
  const mature = p.matureContent && p.age >= 18;

  if (selected) {
    return <InteractionPanel rel={selected} safe={safe} setSafe={setSafe} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {p.pregnancy && (
        <Card className="border-pink-500/40 bg-pink-950/20 p-3 text-sm text-pink-100">
          🤰 {p.pregnancy.carrier === "self" ? "You're" : "Your partner is"} expecting a baby. The birth is due when you next age up.
        </Card>
      )}
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
          <Button variant="secondary" className="col-span-2" onClick={() => act((pl, rng) => adoptChild(pl, rng))} disabled={p.age < 22}>
            🍼 Adopt a Child ({`$${ADOPTION_COST.toLocaleString()}`})
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => adoptPet(pl, "dog", rng))} disabled={p.age < 8}>
            🐶 Adopt a Dog (${PET_COST})
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => adoptPet(pl, "cat", rng))} disabled={p.age < 8}>
            🐱 Adopt a Cat (${PET_COST})
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => meetSomeone(pl, "friend", rng))} disabled={p.age < 4}>
            🤝 Make a Friend
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => meetSomeone(pl, "date", rng))} disabled={p.age < 16 || !!partner}>
            💘 Find Love
          </Button>
        </div>
      </div>

      {mature && (
        <div>
          <SectionTitle hint="18+ · consenting adults">Casual Encounters</SectionTitle>
          <Card className="mb-2 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Use protection
            </label>
            <p className="mt-1 text-xs text-slate-500">Protection greatly lowers the chance of pregnancy and infections.</p>
            {partner && !p.flags.includes("open_relationship") && (
              <p className="mt-2 text-xs font-medium text-rose-300">⚠️ You have a partner, and this would be cheating. You might be caught.</p>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-2">
            {VENUES.map((v) => (
              <Button key={v.id} variant="secondary" onClick={() => act((pl, rng) => hookUp(pl, v.id, safe, rng))}>
                {v.emoji} {v.label}{v.cost ? ` ($${v.cost})` : ""}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => act((pl, rng) => seduce(pl, "friend", safe, rng))}>🤝 A Friend</Button>
            <Button variant="secondary" onClick={() => act((pl, rng) => seduce(pl, "ex", safe, rng))}>💔 An Ex</Button>
            <Button variant="secondary" disabled={!p.currentJob} onClick={() => act((pl, rng) => seduce(pl, "coworker", safe, rng))}>💼 A Coworker</Button>
            <Button variant="secondary" disabled={!!partner && !p.flags.includes("open_relationship")} onClick={() => act((pl, rng) => swingerClub(pl, safe, rng))}>
              🪩 Swinger Club (${SWINGER_COST})
            </Button>
          </div>
        </div>
      )}

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

function InteractionPanel({ rel, safe, setSafe, onBack }: { rel: Relative; safe: boolean; setSafe: (b: boolean) => void; onBack: () => void }) {
  const { player: p, act } = useGame();
  const used = p.annual[`rel:${rel.id}`] ?? 0;
  const capped = used >= INTERACTION_CAP;
  const run = (a: SocialAction) => act((pl, rng) => interact(pl, rel.id, a, rng));
  const canAsk = rel.relation === "Parent" && p.age < 22;
  const mature = p.matureContent && p.age >= 18 && rel.age >= 18;
  const open = p.flags.includes("open_relationship");
  const loveLeft = LOVE_CAP - (p.annual[`love:${rel.id}`] ?? 0);
  const isPet = rel.relation === "Pet";

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
            <div className="text-sm text-slate-400">{label(rel)} · {rel.age} years old{rel.occupation ? ` · ${rel.occupation}` : ""}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Relationship</span>
            <span className="tabular-nums">{Math.round(rel.relationshipBar)}</span>
          </div>
          <MiniBar value={rel.relationshipBar} color={barColor(rel.relationshipBar)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill>Health {Math.round(rel.health)}</Pill>
          {rel.relation === "Partner" && <Pill tone="blue">{rel.partnerStatus === "married" ? `Married${rel.marriedYear ? ` ${Math.max(0, p.year - rel.marriedYear)} yrs` : ""}` : "Dating"}</Pill>}
          {rel.relation === "Partner" && rel.partnerStatus === "married" && <Pill tone="green">Adds ≈{money(Math.round(spouseIncome(rel) * 0.75))}/yr</Pill>}
          {rel.relation === "Partner" && open && <Pill tone="amber">Open relationship</Pill>}
          {(rel.relation === "Partner" || rel.relation === "Lover" || rel.relation === "Friend") && rel.traits?.map((t) => <Pill key={t} tone="slate">{t}</Pill>)}
        </div>
      </Card>

      <SectionTitle hint={capped ? "Take a breather until next year" : `${INTERACTION_CAP - used} left this year`}>Interact</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => run("spend")} disabled={capped}>{isPet ? "🦴 Play" : "🕒 Spend Time"}</Button>
        {!isPet && <Button onClick={() => run("converse")} disabled={capped}>💬 Converse</Button>}
        <Button onClick={() => run("compliment")} disabled={capped}>{isPet ? "🥰 Good Pet!" : "🌸 Compliment"}</Button>
        <Button variant="danger" onClick={() => run("insult")}>{isPet ? "😠 Scold" : "😡 Insult"}</Button>
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
            <Button onClick={() => act((pl) => romanticGetaway(pl, rel.id))}>🏝️ Getaway (${GETAWAY_COST.toLocaleString()})</Button>
            <Button onClick={() => act((pl, rng) => tryForBaby(pl, rng))}>🍼 Try for a Baby</Button>
            {rel.partnerStatus === "dating" && (
              <Button variant="gold" onClick={() => act((pl, rng) => propose(pl, rng))}>💍 Propose</Button>
            )}
            <Button
              variant="danger"
              className={rel.partnerStatus === "dating" ? "col-span-2" : "col-span-2"}
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

      {mature && (rel.relation === "Partner" || rel.relation === "Lover") && (
        <>
          <SectionTitle hint="18+ · consent matters">Intimacy</SectionTitle>
          <Card className="p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Use protection
            </label>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" className="col-span-2" disabled={loveLeft <= 0} onClick={() => act((pl, rng) => makeLove(pl, rel.id, safe, rng))}>
              ❤️‍🔥 Make Love {loveLeft <= 0 ? "(done this year)" : ""}
            </Button>
            {rel.relation === "Partner" && (
              <>
                <Button variant="secondary" onClick={() => act((pl, rng) => spiceItUp(pl, rel.id, rng))}>🎭 Spice It Up (${SPICE_COST})</Button>
                <Button variant="secondary" onClick={() => act((pl, rng) => askThreesome(pl, safe, rng))}>👥 Ask for a Threesome</Button>
                <Button variant="secondary" className="col-span-2" disabled={open} onClick={() => act((pl, rng) => proposeOpenRelationship(pl, rng))}>
                  {open ? "🔓 Relationship is open" : "🔓 Propose an Open Relationship"}
                </Button>
              </>
            )}
          </div>
          {rel.relation === "Partner" && (
            <p className="text-xs text-slate-500">Your partner's personality ({rel.traits?.join(", ") ?? "unknown"}) shapes how they'll react. Asking is always their choice, and no means no.</p>
          )}
        </>
      )}

      {rel.relation === "Lover" && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="gold" onClick={() => { act((pl, rng) => leaveForLover(pl, rel.id, rng)); onBack(); }}>💍 Make It Official</Button>
          <Button variant="ghost" onClick={() => { act((pl) => endLover(pl, rel.id)); onBack(); }}>End It</Button>
        </div>
      )}
    </div>
  );
}
