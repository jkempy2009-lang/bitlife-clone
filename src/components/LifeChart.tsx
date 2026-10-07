"use client";

import type { HistoryPoint } from "@/types/game.types";
import { money } from "@/lib/format";

function path(values: number[], w: number, h: number, min: number, max: number): string {
  if (values.length === 0) return "";
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Two compact sparklines: net worth over a lifetime, and happiness / health. */
export default function LifeChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null;
  const w = 300;
  const h = 70;
  const nw = history.map((p) => p.netWorth);
  const minNw = Math.min(0, ...nw);
  const maxNw = Math.max(1, ...nw);
  const last = history[history.length - 1];
  return (
    <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Your Life, Plotted</h2>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>Net worth</span>
        <span>peak {money(maxNw)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Net worth by age">
        <path d={path(nw, w, h, minNw, maxNw)} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" />
        {minNw < 0 && <line x1="0" x2={w} y1={h - ((0 - minNw) / (maxNw - minNw)) * h} y2={h - ((0 - minNw) / (maxNw - minNw)) * h} stroke="#475569" strokeDasharray="3 3" />}
      </svg>
      <div className="mb-1 mt-3 flex justify-between text-xs text-slate-400">
        <span><span className="text-emerald-400">●</span> Happiness · <span className="text-teal-300">●</span> Health</span>
        <span>ages {history[0].age}–{last.age}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Happiness and health by age">
        <path d={path(history.map((p) => p.happiness), w, h, 0, 100)} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
        <path d={path(history.map((p) => p.health), w, h, 0, 100)} fill="none" stroke="#5eead4" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 3" />
      </svg>
    </div>
  );
}
