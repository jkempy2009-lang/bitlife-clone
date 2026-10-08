"use client";

import { useGame } from "@/context/GameStateContext";
import { academyBlocker, academyCost, academyDiscount, startAcademy } from "@/engine/athleteLife";
import { LEGACY_TIERS, careerSummary } from "@/engine/athleteLegacy";
import { money } from "@/lib/format";
import { Button, Pill } from "../ui";
import { Block } from "./AthleteBlock";

/** How history will remember you: a score, a tier, clubs, highlights and scandals. Works mid-career too. */
export function CareerSummaryCard() {
  const { player: p } = useGame();
  const a = p.athlete;
  if (!a.sport || a.record.seasons === 0) return null;
  const s = careerSummary(p);
  const next = [...LEGACY_TIERS].reverse().find(([m]) => m > s.score);
  const retired = a.stage === "retired";
  return (
    <Block title={retired ? "🏛️ Career summary" : "🏛️ Legacy so far"} tone={s.inducted ? "amber" : "slate"}>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold">{s.tier}</div>
          <div className="text-xs text-slate-400">{s.verdict}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tabular-nums text-amber-300">{s.score}</div>
          <div className="text-[11px] text-slate-500">{next ? `${next[0] - s.score} to ${next[1]}` : "top tier"}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {s.inducted && <Pill tone="amber">🏛️ Hall of Fame{a.hofYear ? ` ${a.hofYear}` : ""}</Pill>}
        {!s.inducted && retired && s.nextBallot !== null && <Pill tone="blue">Hall of Fame vote in {s.nextBallot} year{s.nextBallot === 1 ? "" : "s"}</Pill>}
        {a.narrative && <Pill tone="blue">“{a.narrative}”</Pill>}
        {s.scandals.map((x) => <Pill key={x} tone="red">{x}</Pill>)}
      </div>
      {s.highlights.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 gap-0.5 text-xs text-slate-300 sm:grid-cols-2">
          {s.highlights.map((h) => <li key={h}>• {h}</li>)}
        </ul>
      )}
      {s.clubs.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-300">Clubs</div>
          <ul className="divide-y divide-slate-700/60 text-xs">
            {s.clubs.slice(-8).reverse().map((c) => (
              <li key={c.club} className="flex justify-between gap-2 py-1">
                <span className="truncate text-slate-200">{c.club}</span>
                <span className="shrink-0 tabular-nums text-slate-400">{c.seasons} season{c.seasons === 1 ? "" : "s"}{c.titles > 0 ? ` · ${c.titles} 🏆` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Legacy counts titles, medals, awards, peak level, longevity, fame, money and image. Doping and match-fixing cost you dearly. Halls of Fame vote 5 and 10 years after retirement.</p>
    </Block>
  );
}

/** Life after the game: coach, pundit (see the offers above), or an academy of your own. */
export function PostCareer() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  if (a.stage !== "retired") return null;
  const why = academyBlocker(p);
  const cost = academyCost() - academyDiscount(p);
  return (
    <Block title="🧭 What next?">
      <ul className="mb-2 space-y-1 text-xs text-slate-400">
        <li>🎙️ <strong className="text-slate-300">Pundit</strong> and 📋 <strong className="text-slate-300">coach</strong> jobs arrive as offers (see above) if your name and record are strong enough.</li>
        <li>🏫 <strong className="text-slate-300">Your own academy</strong> uses the business engine: staff, fees and risk. Fame lowers the start-up cost and improves the brand.</li>
        <li>🔁 Or come back to the game while you still can.</li>
      </ul>
      {a.post === "academy" && p.business ? (
        <p className="text-xs font-medium text-emerald-300">You run {p.business.name}. Manage it in the Business tab.</p>
      ) : (
        <>
          <Button variant="secondary" className="w-full" disabled={!!why} onClick={() => act((pl, rng) => startAcademy(pl, rng))}>🏫 Found an academy ({money(cost)})</Button>
          {why && <p className="mt-0.5 text-[11px] text-rose-300">🔒 {why}</p>}
        </>
      )}
    </Block>
  );
}
