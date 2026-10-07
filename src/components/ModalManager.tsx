"use client";

import { useGame } from "@/context/GameStateContext";
import { fillTokens, canAfford, optionCost } from "@/engine/events";
import { money, signed } from "@/lib/format";
import type { Tone } from "@/types/game.types";
import type { EventCategory } from "@/data/lifeEventsEngine";
import { Button } from "./ui";

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  general: "🌟",
  school: "🎒",
  career: "💼",
  crime: "🚨",
  health: "🩺",
  royalty: "👑",
  fame: "📸",
  family: "👨‍👩‍👧",
  romance: "💘",
  money: "💰",
  prison: "⛓️",
};

const TONE_STYLES: Record<Tone, { ring: string; title: string; emoji: string }> = {
  good: { ring: "border-emerald-500/60", title: "text-emerald-300", emoji: "✅" },
  bad: { ring: "border-rose-500/60", title: "text-rose-300", emoji: "⚠️" },
  neutral: { ring: "border-slate-600", title: "text-slate-100", emoji: "📜" },
  jackpot: { ring: "border-amber-400/80", title: "text-amber-300", emoji: "🎉" },
  surgery: { ring: "border-fuchsia-500/60", title: "text-fuchsia-300", emoji: "💉" },
};

/** Universal modal: life events, choices, surgeries and text feedback. */
export default function ModalManager() {
  const { state, player, resolveEvent, dismissNotice } = useGame();
  const notice = state.notices[0];
  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="pop-in max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl">
        {notice.kind === "event" ? (
          <div className="rounded-3xl border border-slate-600 bg-slate-800 p-5 shadow-2xl">
            <div className="mb-1 text-3xl">{CATEGORY_EMOJI[notice.event.category]}</div>
            <h2 className="text-xl font-bold text-slate-50">{notice.event.title}</h2>
            <p className="mb-4 mt-2 text-[15px] leading-relaxed text-slate-300">
              {fillTokens(notice.event.description, player)}
            </p>
            <div className="flex flex-col gap-2">
              {notice.event.options.map((opt, i) => {
                const affordable = canAfford(player, opt);
                const cost = optionCost(opt);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!affordable}
                    onClick={() => resolveEvent(notice.id, i)}
                    className="rounded-xl border border-slate-600 bg-slate-700/70 px-4 py-3 text-left text-[15px] font-medium text-slate-100 transition-colors hover:border-emerald-500 hover:bg-slate-700 active:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {fillTokens(opt.text, player)}
                    {!affordable && cost > 0 && <span className="ml-2 text-xs text-rose-300">(need {money(cost)})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`rounded-3xl border bg-slate-800 p-5 shadow-2xl ${TONE_STYLES[notice.tone].ring}`}>
            <div className="mb-1 text-3xl">{TONE_STYLES[notice.tone].emoji}</div>
            <h2 className={`text-xl font-bold ${TONE_STYLES[notice.tone].title}`}>{notice.title}</h2>
            <p className="mb-4 mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-300">{notice.body}</p>
            {notice.chips && notice.chips.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {notice.chips.map((c) => (
                  <span
                    key={c.label}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      c.delta > 0 ? "bg-emerald-900/70 text-emerald-200" : "bg-rose-900/70 text-rose-200"
                    }`}
                  >
                    {c.label} {c.money ? (c.delta > 0 ? "+" : "-") + money(Math.abs(c.delta)) : signed(c.delta)}
                  </span>
                ))}
              </div>
            )}
            <Button variant="primary" className="w-full py-3 text-base" onClick={() => dismissNotice(notice.id)}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
