"use client";

import type { ReactNode } from "react";
import { Button } from "../ui";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "gold";

/** A button with an optional hint underneath and, when disabled, the reason why. */
export function ActionButton({
  label,
  hint,
  reason,
  onClick,
  variant = "secondary",
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** When set, the button is disabled and this explains why. */
  reason?: string | null;
  onClick: () => void;
  variant?: Variant;
  className?: string;
}) {
  return (
    <div className={className}>
      <Button variant={variant} className="w-full" disabled={!!reason} onClick={onClick}>
        {label}
      </Button>
      {reason ? <div className="mt-0.5 text-xs text-rose-300">🔒 {reason}</div> : hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

/** A labelled meter with a plain-language read-out beside it. */
export function Meter({ label, value, tone, note }: { label: string; value: number; tone: "green" | "amber" | "red" | "blue" | "slate"; note?: string }) {
  const colors = { green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-rose-500", blue: "bg-blue-500", slate: "bg-slate-400" } as const;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">{note ?? Math.round(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full transition-all duration-500 ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

/** A coloured warning strip. */
export function Banner({ tone, children }: { tone: "red" | "amber" | "blue" | "green"; children: ReactNode }) {
  const tones = {
    red: "border-rose-700/60 bg-rose-950/40 text-rose-200",
    amber: "border-amber-700/60 bg-amber-950/40 text-amber-200",
    blue: "border-sky-700/60 bg-sky-950/40 text-sky-200",
    green: "border-emerald-700/60 bg-emerald-950/40 text-emerald-200",
  };
  return <div className={`rounded-xl border p-2.5 text-xs leading-relaxed ${tones[tone]}`}>{children}</div>;
}
