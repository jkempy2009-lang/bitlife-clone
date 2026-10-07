"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { COUNTRIES } from "@/data/countries";
import type { NewLifeOptions } from "@/engine/state";
import { Button } from "./ui";
import HallOfLives, { useHall } from "./HallOfLives";
import { ACHIEVEMENTS } from "@/data/achievements";
import { CHALLENGES } from "@/data/challenges";

const SCENARIOS: { id: NewLifeOptions["scenario"]; label: string; blurb: string }[] = [
  { id: "random", label: "🎲 Surprise Me", blurb: "Fate decides (1% chance of royalty)." },
  { id: "average", label: "🏡 Ordinary Family", blurb: "Working parents, normal life." },
  { id: "wealthy", label: "💎 Wealthy Family", blurb: "Rich parents and a $250k trust fund at 18." },
  { id: "struggling", label: "🥫 Struggling Family", blurb: "Hard start, big comeback potential." },
  { id: "celebrity", label: "🌟 Celebrity Family", blurb: "Famous, wealthy, and always watched." },
  { id: "royal", label: "👑 Royal Heir", blurb: "Born into a monarchy. Rule wisely." },
];

export default function StartScreen() {
  const { newGame, continueSave, hasSave, deleteSave } = useGame();
  const [designing, setDesigning] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [showHall, setShowHall] = useState(false);
  const hall = useHall();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<NonNullable<NewLifeOptions["gender"]>>("random");
  const [country, setCountry] = useState("random");
  const [scenario, setScenario] = useState<NewLifeOptions["scenario"]>("random");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-5">
      <div className="pop-in">
        <div className="mb-6 text-center">
          <div className="text-6xl">🧬</div>
          <h1 className="mt-2 bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-5xl font-black tracking-tight text-transparent">Lifeline</h1>
          <p className="mt-2 text-slate-400">Live a thousand lives. Every choice has a price.</p>
        </div>

        {challenging ? (
          <div className="rounded-3xl border border-slate-700 bg-slate-800/80 p-4">
            <h2 className="mb-1 text-lg font-bold">🎯 Scenario Challenges</h2>
            <p className="mb-3 text-xs text-slate-400">A fixed starting point, a goal and a deadline. Win to earn a place in the Hall of Lives.</p>
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {CHALLENGES.map((c) => {
                const won = hall.challenges?.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => newGame({ scenario: c.scenario, challenge: c.id })}
                    className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-left transition-colors hover:border-emerald-500"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{c.emoji} {c.name}</span>
                      {won && <span className="text-xs text-amber-300">🏅 won</span>}
                    </div>
                    <div className="text-xs text-slate-400">{c.blurb}</div>
                    <div className="mt-1 text-xs font-medium text-emerald-300">{c.goal}</div>
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setChallenging(false)}>Back</Button>
          </div>
        ) : !designing ? (
          <div className="flex flex-col gap-3">
            {hasSave && (
              <Button variant="primary" className="py-3.5 text-base" onClick={continueSave}>
                ▶ Continue Your Life
              </Button>
            )}
            <Button variant={hasSave ? "secondary" : "primary"} className="py-3.5 text-base" onClick={() => newGame({ scenario: "random" })}>
              🎲 Start a Random Life
            </Button>
            <Button variant="secondary" className="py-3.5 text-base" onClick={() => setDesigning(true)}>
              ✏️ Design a Life
            </Button>
            <Button variant="secondary" className="py-3.5 text-base" onClick={() => setChallenging(true)}>
              🎯 Scenario Challenges
            </Button>
            <Button variant="ghost" onClick={() => setShowHall(true)}>
              🏆 Hall of Lives · {hall.achievements.length}/{ACHIEVEMENTS.length}
            </Button>
            {hasSave && (
              <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={deleteSave}>
                Delete saved game
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-700 bg-slate-800/80 p-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={20} placeholder="Random" className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100 outline-none focus:border-emerald-500" />
              </label>
              <label className="text-xs text-slate-400">
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={20} placeholder="Random" className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100 outline-none focus:border-emerald-500" />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                Gender
                <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100">
                  <option value="random">Random</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Non-binary</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Country
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100">
                  <option value="random">Random</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}{c.monarchy ? " 👑" : ""}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 text-xs text-slate-400">Family background</div>
            <div className="mt-1 grid grid-cols-1 gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenario(s.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${scenario === s.id ? "border-emerald-500 bg-emerald-950/50" : "border-slate-700 bg-slate-900/50 hover:border-slate-500"}`}
                >
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-slate-400">{s.blurb}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setDesigning(false)}>Back</Button>
              <Button variant="primary" onClick={() => newGame({ firstName, lastName, gender, country, scenario })}>Be Born</Button>
            </div>
          </div>
        )}
      </div>
      {showHall && <HallOfLives onClose={() => setShowHall(false)} />}
    </main>
  );
}
