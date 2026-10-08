"use client";

import { useMemo } from "react";
import { useGame } from "@/context/GameStateContext";
import { money } from "@/lib/format";
import { netWorth, playerTitle } from "@/engine/state";
import { Card, Pill, SectionTitle, StatBar } from "./ui";
import { ACHIEVEMENTS } from "@/data/achievements";
import { AchievementGrid } from "./HallOfLives";
import { suggestTips } from "@/lib/tips";
import { CHALLENGE_BY_ID } from "@/data/challenges";
import { activeStorylines } from "@/engine/storylines";

interface YearGroup {
  header: string;
  entries: string[];
}

function groupLog(log: string[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const line of log) {
    if (line.startsWith("## ")) groups.push({ header: line.slice(3), entries: [] });
    else if (groups.length) groups[groups.length - 1].entries.push(line);
    else groups.push({ header: "Prologue", entries: [line] });
  }
  return groups.reverse();
}

function Delta({ label, v, isMoney }: { label: string; v: number; isMoney?: boolean }) {
  if (v === 0) return null;
  const good = v > 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${good ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
      {label} {good ? "+" : "−"}{isMoney ? money(Math.abs(v)) : Math.abs(v)}
    </span>
  );
}

function LastYear({ y }: { y: NonNullable<ReturnType<typeof useGame>["player"]["lastYear"]> }) {
  const any = y.happiness || y.health || y.smarts || y.looks || y.money;
  if (!any) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">Over the past year</span>
      <Delta label="😊" v={y.happiness} />
      <Delta label="❤️" v={y.health} />
      <Delta label="🧠" v={y.smarts} />
      <Delta label="✨" v={y.looks} />
      <Delta label="💰" v={y.money} isMoney />
    </div>
  );
}

export default function DashboardTab() {
  const { player: p, setTab } = useGame();
  const tips = suggestTips(p);
  const stories = activeStorylines(p);
  const groups = useMemo(() => groupLog(p.lifeLog), [p.lifeLog]);
  const nw = netWorth(p);
  const showFame = p.fame > 0 || p.specialCareers.length > 0 || p.royalRank !== "none";

  return (
    <div className="flex flex-col gap-3">
      {/* Top header panel */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-800/60">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Name</div>
            <div className="truncate text-lg font-bold">{p.firstName} {p.lastName}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-400">Age</div>
            <div className="text-lg font-bold tabular-nums">{p.age}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Title</div>
            <div className="truncate text-sm font-semibold text-emerald-300">{playerTitle(p)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-400">Net Worth</div>
            <div className={`text-lg font-bold tabular-nums ${nw < 0 ? "text-rose-400" : "text-amber-300"}`}>{money(nw)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-400">
          <span>📍 {p.birthCity}, {p.birthCountry}</span>
          <span>· Gen {p.generation}</span>
          <span>· {p.economy.climate === "boom" ? "📈 Boom" : p.economy.climate === "recession" ? "📉 Recession" : "➖ Steady economy"}</span>
        </div>
        {(p.diseases.length > 0 || p.isFugitive || p.outstandingLoans > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.diseases.map((d) => (
              <Pill key={d.id} tone={d.severity === "fatal" ? "red" : d.severity === "chronic" ? "amber" : "slate"}>
                🩺 {d.name}
              </Pill>
            ))}
            {p.isFugitive && <Pill tone="red">🚨 Fugitive</Pill>}
            {p.outstandingLoans > 0 && <Pill tone="amber">Debt {money(p.outstandingLoans)}</Pill>}
          </div>
        )}
      </Card>

      {/* Status bars */}
      <Card>
        <div className="grid grid-cols-2 gap-x-4">
          <StatBar label="😊 Happiness" value={p.happiness} color="green" />
          <StatBar label="❤️ Health" value={p.health} color="teal" />
          <StatBar label="🧠 Smarts" value={p.smarts} color="blue" />
          <StatBar label="✨ Looks" value={p.looks} color="pink" />
        </div>
        {showFame && <StatBar label="🌟 Fame" value={p.fame} color="amber" />}
        {p.royalRank !== "none" && <StatBar label="👑 Royal Respect" value={p.royalRespect} color="purple" />}
        {p.royalRank !== "none" && <StatBar label="🗳️ Public Approval" value={p.court.approval} color="blue" />}
        <StatBar label="☯️ Karma" value={p.karma} color="slate" compact />
      </Card>

      {p.lastYear && p.lastYear.age === p.age && <LastYear y={p.lastYear} />}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <div className="text-[11px] uppercase text-slate-400">Cash</div>
          <div className="text-sm font-bold tabular-nums text-emerald-300">{money(p.bankBalance)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase text-slate-400">Salary</div>
          <div className="text-sm font-bold tabular-nums">{money(p.annualSalary)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase text-slate-400">Credit</div>
          <div className="text-sm font-bold tabular-nums">{p.creditScore}</div>
        </Card>
      </div>

      {p.challenge && CHALLENGE_BY_ID[p.challenge.id] && (() => {
        const c = CHALLENGE_BY_ID[p.challenge.id];
        const tone = p.challenge.status === "won" ? "border-amber-400/50 bg-amber-500/10" : p.challenge.status === "failed" ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/5";
        return (
          <div className={`rounded-2xl border p-3 ${tone}`}>
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{c.emoji} Challenge: {c.name}</span>
              <span className="text-xs text-slate-400">{p.challenge.status === "active" ? `by age ${Math.min(c.byAge, 100)}` : p.challenge.status === "won" ? "🏅 won" : "failed"}</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{c.goal}</div>
            {p.challenge.status === "active" && <div className="mt-1 text-xs font-medium text-emerald-300">{c.progress(p)}</div>}
          </div>
        );
      })()}

      {tips.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {tips.map((t) => (
            <button
              key={t.text}
              type="button"
              onClick={() => setTab(t.tab)}
              className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-left text-sm text-sky-100 transition-colors hover:bg-sky-500/20"
            >
              <span className="text-lg">{t.emoji}</span>
              <span className="flex-1">{t.text}</span>
              <span className="text-xs text-sky-300">Go →</span>
            </button>
          ))}
        </div>
      )}

      {stories.length > 0 && (
        <div>
          <SectionTitle hint="your choices echo">Ongoing storylines</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {stories.map((s) => (
              <li key={s.id} className="flex items-start gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
                <span className="text-lg leading-none">{s.emoji}</span>
                <span>
                  <span className="font-semibold">{s.title}.</span> {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          🏆 Achievements this life: {p.achievements.length}/{ACHIEVEMENTS.length}
        </summary>
        <div className="mt-3"><AchievementGrid unlocked={p.achievements} /></div>
      </details>

      {/* Core feed */}
      <div>
        <SectionTitle hint="newest first">Life Story</SectionTitle>
        <div className="scroll-thin max-h-[52vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3" aria-live="polite">
          {groups.map((g, i) => (
            <div key={`${g.header}-${i}`} className={i === 0 ? "" : "opacity-80"}>
              <div className={`sticky top-0 z-10 -mx-3 mb-1.5 mt-3 bg-slate-800/95 px-3 py-1 text-xs font-bold uppercase tracking-wider first:mt-0 ${i === 0 ? "text-emerald-300" : "text-slate-400"}`}>
                {g.header}
              </div>
              <ul className="space-y-1.5">
                {g.entries.map((e, j) => (
                  <li key={j} className="text-[14px] leading-snug text-slate-200">
                    {e}
                  </li>
                ))}
                {g.entries.length === 0 && <li className="text-sm italic text-slate-500">Nothing notable happened.</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
