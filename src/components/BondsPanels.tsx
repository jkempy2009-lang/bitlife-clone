"use client";

import { useGame } from "@/context/GameStateContext";
import type { Relative } from "@/types/game.types";
import { VALUE_BY_ID, compatibility, myValues, relationshipHealth, timeline, valuesOf, yearsKnown } from "@/engine/bonds";
import { COUNSELLING_COST, GOALS_COST, backTheirGoals, clearTheAir, counselling, giveSpace, reconcile, separate, setCustody, talkAboutUs, type Approach, type Custody } from "@/engine/partnership";
import { HOLIDAY_COST, askInLawsForHelp, hostHoliday, visitInLaws } from "@/engine/inlaws";
import { reachOut } from "@/engine/circle";
import { STYLES, TEMPERAMENTS, setParentingStyle, temperamentOf } from "@/engine/parenting";
import { money } from "@/lib/format";
import { Button, Card, MiniBar, Pill, SectionTitle } from "./ui";

const MEMORY_ICON: Record<string, string> = { met: "✨", milestone: "⭐", joy: "😊", hardship: "🌧️", conflict: "⚡", betrayal: "💔", kindness: "🤝", loss: "🕯️" };

const barColor = (v: number) => (v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-400" : "bg-rose-500");

/** How this relationship is going, what's unresolved, and what you've been through together. */
export function RelationshipCard({ rel }: { rel: Relative }) {
  const { player: p, act } = useGame();
  const health = relationshipHealth(p, rel);
  const years = yearsKnown(p, rel);
  const isPartner = rel.relation === "Partner";
  const fit = isPartner ? compatibility(p, rel) : null;
  const wounds = [...(rel.grievances ?? [])].sort((a, b) => b.weight - a.weight);
  const airedThisYear = (p.annual[`air:${rel.id}`] ?? 0) >= 1;
  const memories = timeline(rel, 12);
  const n = rel.name.split(" ")[0];
  const run = (a: Approach) => act((pl, rng) => clearTheAir(pl, rel.id, a, rng));
  const worst = wounds[0];
  const giftCost = worst ? 300 * worst.weight : 0;
  if (rel.relation === "Pet") return null;
  return (
    <>
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={health.tone}>{health.label}</Pill>
          {fit && <Pill tone={fit.label === "Natural fit" ? "green" : fit.label === "Opposites" ? "amber" : "slate"}>{fit.label}</Pill>}
          {rel.friendKind && rel.relation === "Friend" && <Pill tone={rel.friendKind === "Fallen out" ? "red" : rel.friendKind === "Best friend" ? "green" : "blue"}>{rel.friendKind}</Pill>}
          {years !== null && years > 0 && <Pill>{years} year{years === 1 ? "" : "s"} known</Pill>}
          {rel.separatedYear && <Pill tone="red">Living apart</Pill>}
          {rel.custody && <Pill tone="blue">{rel.custody === "you" ? "Lives with you" : rel.custody === "them" ? `Lives with ${rel.otherParent?.split(" ")[0] ?? "other parent"}` : "Shared custody"}</Pill>}
          {rel.relation === "Child" && <Pill tone="slate">{temperamentOf(rel).label}</Pill>}
        </div>
        {rel.relation === "Child" && <p className="mt-1 text-xs text-slate-500">{temperamentOf(rel).blurb}</p>}
        {isPartner && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">What {n} needs from you</div>
            <ul className="flex flex-col gap-1 text-sm">
              {valuesOf(rel).map((v) => {
                const def = VALUE_BY_ID[v];
                const known = rel.knownValues?.includes(v);
                const unmet = rel.unmet?.[v] ?? 0;
                return (
                  <li key={v} className="flex items-start gap-2">
                    <span>{known ? def.emoji : "❔"}</span>
                    <span className="min-w-0 flex-1 text-slate-300">
                      {known ? <><span className="font-semibold">{def.label}</span> <span className="text-xs text-slate-500">· {def.hint}</span></> : <span className="text-slate-500">Something you haven&apos;t worked out yet. Talk about it.</span>}
                      {known && unmet > 0 && <span className="block text-xs text-amber-300">Unmet {unmet} year{unmet === 1 ? "" : "s"} running</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-slate-500">You value {myValues(p).map((v) => VALUE_BY_ID[v].label.toLowerCase()).join(" and ")}. Needs are met by what you do each year, not by luck.</p>
          </div>
        )}
        {wounds.length > 0 && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-rose-300">Unresolved</div>
            <ul className="flex flex-col gap-1 text-sm text-rose-100">
              {wounds.map((g) => (
                <li key={g.id} className="flex items-start gap-2">
                  <span className="shrink-0 text-xs tracking-tighter text-rose-300">{"●".repeat(g.weight)}{"○".repeat(3 - g.weight)}</span>
                  <span>{g.text.charAt(0).toUpperCase() + g.text.slice(1)} <span className="text-xs text-rose-300/70">({g.year})</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-400">These come back when you least want them, and they stay with you if {n} dies before you fix them. Start with the heaviest.</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Button variant="secondary" className="px-1 py-2 text-xs" disabled={airedThisYear} onClick={() => run("apologise")}>🙏 Apologise</Button>
              <Button variant="secondary" className="px-1 py-2 text-xs" disabled={airedThisYear} onClick={() => run("talk")}>💬 Talk it out</Button>
              <Button variant="secondary" className="px-1 py-2 text-xs" disabled={airedThisYear || p.bankBalance < giftCost} onClick={() => run("gift")}>🎁 Gesture ({money(giftCost)})</Button>
            </div>
            {airedThisYear && <p className="mt-1 text-xs text-slate-500">You&apos;ve already tried this year. Let it settle.</p>}
          </div>
        )}
      </Card>
      {memories.length > 0 && (
        <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">📖 Shared history ({rel.memories?.length ?? 0})</summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-300">
            {memories.map((m, i) => (
              <li key={`${m.year}-${i}`} className="flex gap-2">
                <span>{MEMORY_ICON[m.kind] ?? "•"}</span>
                <span className="min-w-0 flex-1">{m.text} <span className="text-xs text-slate-500">· age {m.age}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** Actions that tend a marriage or partnership. */
export function PartnerCare({ rel }: { rel: Relative }) {
  const { player: p, act } = useGame();
  const married = rel.partnerStatus === "married";
  const n = rel.name.split(" ")[0];
  const done = (k: string) => (p.annual[`${k}:${rel.id}`] ?? 0) >= 1;
  return (
    <>
      <SectionTitle hint="meeting what they need">Keep It Alive</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={done("us")} onClick={() => act((pl) => talkAboutUs(pl, rel.id))}>💭 Talk About Us</Button>
        <Button variant="secondary" disabled={done("goals") || p.bankBalance < GOALS_COST} onClick={() => act((pl, rng) => backTheirGoals(pl, rel.id, rng))}>🚀 Back Their Goals ({money(GOALS_COST)})</Button>
        <Button variant="secondary" disabled={done("space")} onClick={() => act((pl) => giveSpace(pl, rel.id))}>🕊️ Give Them Space</Button>
        <Button variant="secondary" disabled={done("counsel") || p.bankBalance < COUNSELLING_COST} onClick={() => act((pl, rng) => counselling(pl, rel.id, rng))}>🛋️ Counselling ({money(COUNSELLING_COST)})</Button>
        {married && !rel.separatedYear && (
          <Button variant="ghost" className="col-span-2" onClick={() => act((pl) => separate(pl, rel.id))}>🧳 Trial Separation</Button>
        )}
        {rel.separatedYear && (
          <Button variant="gold" className="col-span-2" disabled={done("reconcile")} onClick={() => act((pl, rng) => reconcile(pl, rel.id, rng))}>💌 Try to Win {n} Back</Button>
        )}
      </div>
    </>
  );
}

export function InLawsCard({ rel }: { rel: Relative }) {
  const { player: p, act } = useGame();
  if (!rel.inLaws || rel.inLaws.length === 0) return null;
  const alive = rel.inLaws.filter((l) => l.alive);
  const done = (k: string) => (p.annual[`inlaw:${k}:${rel.id}`] ?? 0) >= 1;
  return (
    <>
      <SectionTitle hint={`${alive.length} living`}>{rel.name.split(" ")[0]}&apos;s Family</SectionTitle>
      <Card className="p-3">
        <ul className="flex flex-col gap-2">
          {rel.inLaws.map((l) => (
            <li key={l.name} className={l.alive ? "" : "opacity-50"}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{l.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{l.role} · {l.alive ? l.age : "died"}</span>
              </div>
              {l.alive && <div className="mt-1"><MiniBar value={l.warmth} color={barColor(l.warmth)} /></div>}
            </li>
          ))}
        </ul>
        {alive.length > 0 && rel.partnerStatus === "married" && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <Button variant="secondary" className="px-1 py-2 text-xs" disabled={done("visit")} onClick={() => act((pl, rng) => visitInLaws(pl, rel.id, rng))}>🚗 Visit</Button>
            <Button variant="secondary" className="px-1 py-2 text-xs" disabled={done("host") || p.bankBalance < HOLIDAY_COST} onClick={() => act((pl) => hostHoliday(pl, rel.id))}>🍽️ Host ({money(HOLIDAY_COST)})</Button>
            <Button variant="secondary" className="px-1 py-2 text-xs" disabled={done("ask")} onClick={() => act((pl, rng) => askInLawsForHelp(pl, rel.id, rng))}>🙏 Ask Help</Button>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">The bar shows how warmly they feel about you. Ignore them and it fades; wear them down and they interfere.</p>
      </Card>
    </>
  );
}

export function ParentingCard() {
  const { player: p, act } = useGame();
  const kids = p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age >= 3 && r.age < 18 && !r.custody);
  if (kids.length === 0) return null;
  const cur = STYLES.find((s) => s.id === p.parentingStyle) ?? STYLES[1];
  return (
    <div>
      <SectionTitle hint="how you raise them">Parenting Style</SectionTitle>
      <Card className="p-3">
        <div className="grid grid-cols-2 gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => act((pl) => setParentingStyle(pl, s.id))}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${p.parentingStyle === s.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">{cur.blurb}</p>
        <p className="mt-1 text-xs text-slate-500">Each child is different ({TEMPERAMENTS.slice(0, 4).map((t) => t.label.toLowerCase()).join(", ")}, and more). The same rules suit one child and crush another.</p>
      </Card>
    </div>
  );
}

export function CustodyPicker({ kid }: { kid: Relative }) {
  const { player: p, act } = useGame();
  if (!kid.custody || kid.age >= 18) return null;
  const done = (p.annual[`custody:${kid.id}`] ?? 0) >= 1;
  const opts: { id: Custody; label: string }[] = [
    { id: "you", label: "Lives with me" },
    { id: "shared", label: "Shared" },
    { id: "them", label: "Lives with them" },
  ];
  return (
    <>
      <SectionTitle hint="your ex and you">Custody</SectionTitle>
      <div className="grid grid-cols-3 gap-1.5">
        {opts.map((o) => (
          <Button key={o.id} variant={kid.custody === o.id ? "primary" : "secondary"} className="px-1 py-2 text-xs" disabled={kid.custody === o.id || done} onClick={() => act((pl, rng) => setCustody(pl, kid.id, o.id, rng))}>
            {o.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Changing it costs legal fees and needs your ex to agree (unless you step back). Children who live elsewhere drift unless you keep spending time with them. Support is paid on your income unless they live with you.</p>
    </>
  );
}

/** People who are gone from your day-to-day: exes, lost friends, and the dead. */
export function PastPeople({ past, labelOf }: { past: Relative[]; labelOf: (r: Relative) => string }) {
  const { act } = useGame();
  if (past.length === 0) return null;
  return (
    <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-400">In memory & past relationships ({past.length})</summary>
      <ul className="mt-2 space-y-2 text-sm text-slate-400">
        {past.map((r) => {
          const lostFriend = r.relation === "Friend" && r.alive;
          const years = r.lostYear;
          return (
            <li key={r.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                {r.alive ? (lostFriend ? "👋" : "💔") : "🕯️"} {r.name} — {r.alive ? (lostFriend ? `Lost touch${years ? ` (${years})` : ""}` : `Ex (${r.age})`) : `${labelOf(r)}, died at ${r.deathAge ?? r.age}`}
                {r.memories && r.memories.length > 0 && r.alive && <span className="block text-xs text-slate-500">{r.memories[r.memories.length - 1].text}</span>}
              </span>
              {lostFriend && (
                <Button variant="ghost" className="shrink-0 px-2 py-1 text-xs" onClick={() => act((pl, rng) => reachOut(pl, r.id, rng))}>Reach out</Button>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
