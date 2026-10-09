"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { GLOSSARY, HOW_TO_PLAY } from "@/lib/glossary";
import { dismissCoach, useCoachVisible } from "@/lib/coach";
import { lifeStage, yearGuide, type GuideItem, type GuideKind } from "@/lib/guide";
import { requestSection } from "@/lib/nav";
import { Button, Modal } from "./ui";

const KIND_STYLE: Record<GuideKind, { ring: string; tag: string; tagText: string }> = {
  urgent: { ring: "border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20", tag: "bg-rose-900/70 text-rose-200", tagText: "Needs attention" },
  chance: { ring: "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20", tag: "bg-emerald-900/70 text-emerald-200", tagText: "Opportunity" },
  routine: { ring: "border-slate-600 bg-slate-800/60 hover:bg-slate-700/60", tag: "bg-slate-700 text-slate-300", tagText: "Routine" },
};

const TAB_NAME: Record<string, string> = { relationships: "People", activities: "Activities", career: "Career", assets: "Assets", dashboard: "" };

/** "This year": what is worth doing right now for this age and situation, each one tap away. */
export function GuideCard() {
  const { player: p, setTab } = useGame();
  const [all, setAll] = useState(false);
  const items = yearGuide(p);
  const stage = lifeStage(p);
  const shown = all ? items : items.slice(0, 3);
  const go = (i: GuideItem) => {
    if (i.tab === "dashboard") return;
    requestSection(i.tab, i.section);
    setTab(i.tab);
  };
  return (
    <section aria-labelledby="guide-h" className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 id="guide-h" className="text-sm font-semibold uppercase tracking-wider text-slate-300">This year</h3>
        <span className="truncate text-xs text-slate-400">{stage.label}</span>
      </div>
      <p className="mb-2 text-xs text-slate-400">{stage.blurb}</p>
      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-900/50 px-3 py-2 text-sm text-slate-300">Nothing pressing. Age Up when you are ready.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((i) => {
            const st = KIND_STYLE[i.kind];
            const body = (
              <>
                <span className="text-xl leading-none" aria-hidden="true">{i.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100">{i.title}</span>
                  {i.detail && <span className="block text-xs text-slate-300">{i.detail}</span>}
                </span>
                {i.tab !== "dashboard" && (
                  <span className="shrink-0 text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.tag}`}>{st.tagText}</span>
                    <span className="mt-0.5 block text-xs text-slate-300">{TAB_NAME[i.tab]} →</span>
                  </span>
                )}
              </>
            );
            return (
              <li key={i.id}>
                {i.tab === "dashboard" ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2.5">{body}</div>
                ) : (
                  <button type="button" onClick={() => go(i)} className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${st.ring}`}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 3 && (
        <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)} className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-slate-300 underline-offset-2 hover:underline">
          {all ? "Show fewer" : `Show ${items.length - 3} more ideas`}
        </button>
      )}
    </section>
  );
}

/** First-run card. Shown once per browser until dismissed; the glossary stays reachable from the Life tab and Settings. */
export function CoachCard({ onGlossary }: { onGlossary: () => void }) {
  const visible = useCoachVisible();
  if (!visible) return null;
  return (
    <section aria-labelledby="coach-h" className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3">
      <h3 id="coach-h" className="text-sm font-bold text-sky-100">Getting started</h3>
      <ol className="mt-2 flex flex-col gap-1.5">
        {HOW_TO_PLAY.map((s, n) => (
          <li key={s.title} className="flex gap-2.5 text-sm text-slate-200">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-900 text-[11px] font-bold text-sky-200" aria-hidden="true">{n + 1}</span>
            <span>
              <span className="font-semibold">{s.title}.</span> <span className="text-slate-300">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onGlossary}>What do the stats mean?</Button>
        <Button variant="primary" onClick={dismissCoach}>Got it</Button>
      </div>
    </section>
  );
}

/** Reference sheet: how to play and what every stat means. */
export function GlossarySheet({ onClose }: { onClose: () => void }) {
  const groups = ["Vitals", "Money", "People", "How it works"] as const;
  return (
    <Modal label="How to play and glossary" onClose={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-3 sm:items-center">
      <div className="pop-in flex max-h-[90dvh] w-full max-w-md flex-col rounded-3xl border border-slate-600 bg-slate-800">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700 px-5 py-3">
          <h2 className="text-lg font-bold">How to play</h2>
          <Button variant="ghost" className="px-3 py-1.5" onClick={onClose} data-autofocus>Close</Button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 pb-5 pt-3">
          <ol className="mb-4 flex flex-col gap-2">
            {HOW_TO_PLAY.map((s) => (
              <li key={s.title} className="flex gap-2.5 text-sm">
                <span aria-hidden="true">{s.emoji}</span>
                <span><span className="font-semibold">{s.title}.</span> <span className="text-slate-300">{s.text}</span></span>
              </li>
            ))}
          </ol>
          {groups.map((g) => (
            <div key={g} className="mt-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{g}</h3>
              <dl className="flex flex-col gap-2">
                {GLOSSARY.filter((e) => e.group === g).map((e) => (
                  <div key={e.id} className="rounded-xl bg-slate-900/50 p-2.5">
                    <dt className="text-sm font-semibold"><span aria-hidden="true">{e.emoji}</span> {e.term}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-slate-300">{e.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
