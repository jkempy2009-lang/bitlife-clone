import type { ReactNode } from "react";

/** A titled panel used across the Athlete tab. */
export function Block({ title, children, tone = "slate" }: { title: string; children: ReactNode; tone?: "slate" | "red" | "amber" | "green" }) {
  const border = tone === "red" ? "border-rose-700/60" : tone === "amber" ? "border-amber-700/60" : tone === "green" ? "border-emerald-700/60" : "border-slate-700/60";
  return (
    <div className={`rounded-2xl border ${border} bg-slate-800/70 p-4`}>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}
