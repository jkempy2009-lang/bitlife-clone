"use client";

import { useGame } from "@/context/GameStateContext";
import { bribeChance, bribeCost, postBail, bribeOfficial, representationOptions, resolveTrial } from "@/engine/crime";
import { RECORD_LABEL, bailFee, expectedYears, lawOf, recordLevel } from "@/engine/justice";
import { money } from "@/lib/format";
import { Modal, StatBar } from "./ui";

const strength = (e: number) => (e >= 75 ? "Overwhelming" : e >= 60 ? "Strong" : e >= 40 ? "Moderate" : "Weak");

/** Full-screen Justice Subsystem overlay. Main navigation is hidden while it is up. */
export default function TrialView() {
  const { player: p, act } = useGame();
  const charge = p.pendingTrial;
  if (!charge) return null;
  const evidence = charge.evidence ?? 50;
  const years = expectedYears(p, charge);
  const bail = charge.bail;
  const fee = bail ? bailFee(bail.amount) : 0;
  const options = representationOptions(p);
  const law = lawOf(p);
  const canBribe = !charge.juvenile && law.corruption >= 0.15;
  const bribeBlock = (p.annual.bribe ?? 0) >= 1 ? "You already tried this year." : bribeCost(p, charge) > p.bankBalance ? `You can't afford ${money(bribeCost(p, charge))}.` : null;
  return (
    <Modal label={charge.juvenile ? "Juvenile court" : "Your trial"} className="fixed inset-0 z-30 overflow-y-auto bg-slate-950 bg-gradient-to-b from-slate-950 via-rose-950/60 to-slate-950">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-5">
        <div className="pop-in">
          <div className="text-center text-5xl">{charge.juvenile ? "🧒" : "⚖️"}</div>
          <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-rose-300">{charge.juvenile ? "JUVENILE COURT" : "YOU'RE ON TRIAL"}</h1>
          <div className="mt-5 rounded-2xl border border-rose-700/60 bg-slate-900/80 p-4">
            <div className="text-xs uppercase tracking-widest text-rose-300">The Charge</div>
            <div className="text-xl font-bold">{charge.name}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{charge.description}</p>
            <div className="mt-3">
              <StatBar label={`Prosecution's case: ${strength(evidence)}`} value={evidence} color="red" compact />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Likely sentence if convicted: about {years} year{years === 1 ? "" : "s"} ({charge.severity}
              {p.justice.convictions > 0 ? `, repeat offender: ${p.justice.convictions} prior${p.justice.convictions === 1 ? "" : "s"}` : ""}; {p.residence.country} sentencing {law.harshness >= 1.15 ? "is harsh" : law.harshness <= 0.8 ? "is lenient" : "is typical"}).
            </p>
            <p className="mt-1 text-xs text-slate-500">Your record: {RECORD_LABEL[recordLevel(p)]}.{charge.innocent ? " You are innocent, but that doesn't make it easy." : ""}</p>
            {charge.juvenile && <p className="mt-1 text-xs text-amber-300">Tried as a minor: detention instead of prison, no bail, and a record that may be sealed at 18.</p>}
            {charge.capital && !charge.juvenile && <p className="mt-1 text-xs text-rose-300">This is a capital charge{law.deathPenalty ? ` and ${p.residence.country} has the death penalty.` : ", but the death penalty does not apply here."}</p>}
          </div>

          {!charge.juvenile && bail && (
            <div className="mt-3 rounded-2xl border border-slate-600 bg-slate-800/80 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">Bail</span>
                <span className="text-sm font-semibold text-amber-300">{bail.denied ? "Denied" : bail.amount === 0 ? "Own recognizance" : money(bail.amount)}</span>
              </div>
              {bail.denied ? (
                <p className="mt-1 text-xs text-rose-300">The judge ruled you a danger and flight risk. You will be held until trial, and lose your job and health along the way.</p>
              ) : bail.posted ? (
                <p className="mt-1 text-xs text-emerald-300">{bail.amount === 0 ? "You're released pending trial." : "Bail posted. You're free to work and prepare your defence (+4% acquittal)."}</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-400">A bondsman posts it for 10% (non-refundable). Skip it and you wait in jail: you lose your job, your health slips, and one year counts as time served if convicted.</p>
                  <button
                    type="button"
                    disabled={fee > p.bankBalance}
                    onClick={() => act((pl) => postBail(pl))}
                    className="mt-2 w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Post bail via bondsman, {money(fee)}
                  </button>
                  {fee > p.bankBalance && <div className="mt-1 text-xs text-rose-300">You can't afford the {money(fee)} fee.</div>}
                </>
              )}
            </div>
          )}

          <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Choose your representation</h2>
          <div className="flex flex-col gap-2">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={!o.affordable}
                onClick={() => act((pl, rng) => resolveTrial(pl, o.id, rng))}
                className="rounded-2xl border border-slate-600 bg-slate-800/80 p-4 text-left transition-colors hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{o.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-amber-300">{o.cost ? money(o.cost) : o.cost === 0 && o.id !== "plea" && o.id !== "cooperate" ? "Free" : "—"}</span>
                </div>
                <div className="text-xs text-slate-400">{o.blurb}</div>
                <div className="mt-1 text-sm text-emerald-300">
                  {o.acquittal === null ? `Guaranteed conviction, about ${o.years} year${o.years === 1 ? "" : "s"}` : `${Math.round(o.acquittal * 100)}% acquittal. If convicted: about ${o.years} year${o.years === 1 ? "" : "s"}`}
                </div>
                {!o.affordable && <div className="text-xs text-rose-300">You can't afford this ({money(o.cost)}).</div>}
              </button>
            ))}
          </div>

          {canBribe && (
            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
              <div className="text-sm font-bold">Make it go away</div>
              <p className="mt-0.5 text-xs text-slate-400">In {p.residence.country}, money sometimes buys a lost file. {Math.round(bribeChance(p, charge) * 100)}% to work, {money(bribeCost(p, charge))}. If it fails, you add attempted bribery and a worse sentence.</p>
              <button
                type="button"
                disabled={!!bribeBlock}
                onClick={() => act((pl, rng) => bribeOfficial(pl, rng))}
                className="mt-2 w-full rounded-xl border border-rose-700 px-3 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-950/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Offer a bribe
              </button>
              {bribeBlock && <div className="mt-1 text-xs text-rose-300">{bribeBlock}</div>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
