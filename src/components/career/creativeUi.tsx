"use client";

import type { ReactNode } from "react";
import { useGame } from "@/context/GameStateContext";
import { lawyerCost, layLow, managerCost, prFirmCost, resolveScandal, securityCost, toggleBusinessManager, toggleSecurity, type PrResponse } from "@/engine/celebrity";
import { money } from "@/lib/format";
import { Card, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";

/** A label / value row. */
export function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`text-right font-medium tabular-nums ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-slate-100"}`}>{value}</span>
    </div>
  );
}

/** Headline number with a caption, used at the top of each screen. */
export function BigStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-3xl font-black tabular-nums text-amber-300">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

/** A tappable choice in a group (platform, genre, producer...). */
export function Choice({ selected, onClick, title, hint, disabled }: { selected: boolean; onClick: () => void; title: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-40 ${selected ? "border-emerald-500 bg-emerald-900/30" : "border-slate-700 bg-slate-900/50 hover:bg-slate-800"}`}
    >
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </button>
  );
}

export const money0 = (n: number) => money(Math.round(n));

/** The cost of being known: scandals, privacy, stalkers, security and a business manager. Shared by all fame careers. */
export function CelebrityPanel() {
  const { player: p, act } = useGame();
  const c = p.celeb;
  if (p.fame < 10 && !c.scandal && c.scandals === 0) return null;
  const sc = c.scandal;
  const respond = (r: PrResponse) => act((pl, rng) => resolveScandal(pl, rng, r));
  const prCost = sc ? prFirmCost(p, sc.severity) : 0;
  const lawCost = sc ? lawyerCost(p, sc.severity) : 0;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint={`${c.scandals} past scandal${c.scandals === 1 ? "" : "s"}`}>Life in the Spotlight</SectionTitle>
      {sc && (
        <Card className="border-rose-700/60">
          <Banner tone="red">
            <strong>Scandal ({"!".repeat(sc.severity)}):</strong> {sc.cause}. Answer it now. If you wait until you age up, it resolves badly.
          </Banner>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ActionButton label="Apologise" hint="Safe, costs some pride" onClick={() => respond("apologise")} />
            <ActionButton label="Ignore it" hint="Cheap, may blow over" onClick={() => respond("ignore")} />
            <ActionButton label="Double down" variant="gold" hint="Risky, can make you more famous" onClick={() => respond("doubleDown")} />
            <ActionButton label={`PR firm ${money0(prCost)}`} variant="primary" reason={p.bankBalance < prCost ? `Needs ${money0(prCost)}` : null} hint="Best odds of a clean exit" onClick={() => respond("prFirm")} />
            <ActionButton label={`Lawyer ${money0(lawCost)}`} reason={p.bankBalance < lawCost ? `Needs ${money0(lawCost)}` : null} hint="Cheaper, good against claims, can drag on" onClick={() => respond("lawyer")} />
          </div>
        </Card>
      )}
      <Card>
        <div className="mb-3 grid grid-cols-1 gap-2">
          <Meter label="Privacy" value={c.privacy} tone={c.privacy > 50 ? "green" : c.privacy > 25 ? "amber" : "red"} />
          <Meter label="Stalker risk" value={c.stalker} tone={c.stalker > 50 ? "red" : c.stalker > 20 ? "amber" : "green"} />
        </div>
        <div className="grid grid-cols-1 gap-2">
          <ActionButton
            label={c.security ? "Dismiss security detail" : `Hire security (≈${money0(securityCost(p))}/yr)`}
            hint="Cuts stalker and break-in danger"
            onClick={() => act((pl) => toggleSecurity(pl))}
          />
          <ActionButton
            label={c.businessManager ? "Fire business manager" : `Hire business manager (≈${money0(managerCost(p))}/yr)`}
            hint="Guards against scams and bad money decisions"
            onClick={() => act((pl) => toggleBusinessManager(pl))}
          />
          <ActionButton
            label="Lay low for a year"
            hint="+25 privacy, stalker risk down, -2 fame"
            reason={(p.annual.lowprofile ?? 0) >= 1 ? "Already hiding this year" : null}
            onClick={() => act((pl) => layLow(pl))}
          />
        </div>
      </Card>
    </div>
  );
}
