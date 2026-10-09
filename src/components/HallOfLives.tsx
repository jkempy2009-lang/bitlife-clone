"use client";

import { useSyncExternalStore } from "react";
import { ACHIEVEMENTS } from "@/data/achievements";
import { CHALLENGES } from "@/data/challenges";
import { clearHall, hallServerSnapshot, readHall, subscribeHall } from "@/engine/hall";
import { money } from "@/lib/format";
import { Button, Card, Modal, SectionTitle } from "./ui";

export function useHall() {
  return useSyncExternalStore(subscribeHall, readHall, hallServerSnapshot);
}

export function AchievementGrid({ unlocked }: { unlocked: string[] }) {
  const set = new Set(unlocked);
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {ACHIEVEMENTS.map((a) => {
        const on = set.has(a.id);
        return (
          <div key={a.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${on ? "border-amber-500/50 bg-amber-950/20" : "border-slate-700/60 bg-slate-800/40 opacity-60"}`}>
            <span className={`text-2xl ${on ? "" : "grayscale"}`}>{on ? a.emoji : "🔒"}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{a.name}</div>
              <div className="text-xs text-slate-400">{a.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HallOfLives({ onClose }: { onClose: () => void }) {
  const hall = useHall();
  return (
    <Modal label="Hall of Lives" onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95">
      <div className="mx-auto max-w-md p-4 sm:max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black">🏆 Hall of Lives</h2>
          <Button variant="ghost" className="px-3 py-1.5" onClick={onClose} data-autofocus>Close</Button>
        </div>
        <SectionTitle hint={`${hall.achievements.length}/${ACHIEVEMENTS.length} unlocked`}>Achievements</SectionTitle>
        <AchievementGrid unlocked={hall.achievements} />
        <div className="mt-5">
          <SectionTitle hint={`${hall.challenges?.length ?? 0}/${CHALLENGES.length} won`}>Challenges</SectionTitle>
          <div className="grid grid-cols-1 gap-1.5">
            {CHALLENGES.map((c) => {
              const on = hall.challenges?.includes(c.id);
              return (
                <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${on ? "border-amber-500/50 bg-amber-950/20" : "border-slate-700/60 bg-slate-800/40 opacity-60"}`}>
                  <span className="text-2xl">{on ? c.emoji : "🔒"}</span>
                  <div className="min-w-0"><div className="text-sm font-semibold">{c.name}</div><div className="text-xs text-slate-400">{c.goal}</div></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-5">
          <SectionTitle hint={`${hall.lives.length} remembered`}>Lives Lived</SectionTitle>
          {hall.lives.length === 0 && <Card><p className="text-sm text-slate-400">No lives lived yet. Go live one.</p></Card>}
          <div className="flex flex-col gap-2">
            {hall.lives.map((l) => (
              <Card key={l.key} className="p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold">{l.name}</span>
                  <span className="text-xs text-slate-400">Gen {l.generation}</span>
                </div>
                <div className="text-xs text-slate-400">{l.country} · {l.birthYear}–{l.deathYear} · died at {l.age} of {l.cause}</div>
                <div className="mt-1 text-sm italic text-slate-300">“{l.epitaph}”</div>
                <div className="mt-1 text-xs text-slate-400">Net worth {money(l.netWorth)} · {l.career}</div>
              </Card>
            ))}
          </div>
        </div>
        {(hall.lives.length > 0 || hall.achievements.length > 0) && (
          <button type="button" className="mt-4 text-xs text-slate-500 underline" onClick={() => { if (confirm("Erase the Hall of Lives and all achievements?")) clearHall(); }}>
            Erase the Hall of Lives
          </button>
        )}
      </div>
    </Modal>
  );
}