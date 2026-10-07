"use client";

import { useMemo } from "react";
import { useGame } from "@/context/GameStateContext";
import { money } from "@/lib/format";
import { netWorth, playerTitle } from "@/engine/state";
import { Card, Pill, SectionTitle, StatBar } from "./ui";
import { ACHIEVEMENTS } from "@/data/achievements";
import { AchievementGrid } from "./HallOfLives";

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

export default function DashboardTab() {
  const { player: p } = useGame();
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
        <StatBar label="☯️ Karma" value={p.karma} color="slate" compact />
      </Card>

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
