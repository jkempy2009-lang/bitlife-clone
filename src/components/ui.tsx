"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-700/60 bg-slate-800/70 p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 mt-1 flex items-baseline justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "gold";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-600 active:bg-emerald-800",
  secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800",
  danger: "bg-rose-700 text-white hover:bg-rose-600 active:bg-rose-800",
  ghost: "bg-transparent text-slate-300 hover:bg-slate-700/60 border border-slate-600",
  gold: "bg-amber-500 text-slate-900 hover:bg-amber-400 active:bg-amber-600",
};

export function Button({
  variant = "secondary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}

const BAR_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  teal: "bg-teal-400",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  amber: "bg-amber-400",
  purple: "bg-purple-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
};

export function StatBar({
  label,
  value,
  color,
  compact = false,
  max = 100,
}: {
  label: string;
  value: number;
  color: keyof typeof BAR_COLORS;
  compact?: boolean;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={compact ? "" : "mb-2.5"}>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">{Math.round(value)}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-700"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${BAR_COLORS[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MiniBar({ value, color }: { value: number; color?: string }) {
  const c = color ?? (value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-400" : "bg-rose-500");
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
      <div className={`h-full rounded-full transition-all duration-500 ease-out ${c}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "red" | "green" | "amber" | "blue" }) {
  const tones = {
    slate: "bg-slate-700 text-slate-200",
    red: "bg-rose-900/60 text-rose-200",
    green: "bg-emerald-900/60 text-emerald-200",
    amber: "bg-amber-900/60 text-amber-200",
    blue: "bg-blue-900/60 text-blue-200",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  onPanel = false,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  /** True when the chips sit on a slate-800 panel (modal) rather than the page background. */
  onPanel?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  // Tell the player there are more chips off-screen, and keep the active one in view.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const active = el.querySelector<HTMLElement>("[aria-pressed=true]");
    if (active && (active.offsetLeft < el.scrollLeft || active.offsetLeft + active.offsetWidth > el.scrollLeft + el.clientWidth)) {
      el.scrollLeft = Math.max(0, active.offsetLeft - 16);
    }
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [value, options.length]);
  return (
    <div className="relative -mx-1 mb-3">
      <div ref={row} role="group" aria-label={label ?? "Sections"} className="scroll-thin flex gap-1.5 overflow-x-auto px-1 pb-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              value === o.id ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {more && (
        <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l ${onPanel ? "from-slate-800 via-slate-800/80" : "from-slate-900 via-slate-900/80"} to-transparent pb-1 pr-1.5 text-lg font-bold text-slate-300`}>
          ›
        </div>
      )}
    </div>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible overlay: role=dialog, labelled, Escape to close (when `onClose` is given), Tab stays inside,
 * focus moves in on open (to `[data-autofocus]` or the dialog itself) and returns to where it was on close.
 * Change `focusKey` to move focus again when the content swaps (e.g. the next notice in a queue).
 */
export function Modal({
  children,
  onClose,
  label,
  className = "",
  focusKey,
}: {
  children: ReactNode;
  onClose?: () => void;
  label: string;
  className?: string;
  focusKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const el = opener.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>("[data-autofocus]") ?? root;
    target.focus({ preventScroll: true });
  }, [focusKey]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && onClose) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const root = ref.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
      className={`outline-none ${className}`}
    >
      {children}
    </div>
  );
}

export function TooYoung({ children }: { children: ReactNode }) {
  return (
    <Card className="mt-2 text-center">
      <div className="text-4xl">🧸</div>
      <p className="mt-2 text-sm text-slate-300">{children}</p>
    </Card>
  );
}
