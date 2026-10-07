"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { COUNTRIES } from "@/data/countries";
import type { NewLifeOptions } from "@/engine/state";
import { Button } from "./ui";
import HallOfLives, { useHall } from "./HallOfLives";
import { ACHIEVEMENTS } from "@/data/achievements";
import { CHALLENGES } from "@/data/challenges";

const TRAITS = [
  { key: "happiness", label: "😊 Happiness", effect: "Your temperament: the mood you settle around for life. Low moods drag health and work down; high moods protect them." },
  { key: "health", label: "❤️ Health", effect: "Resistance to illness, how long you live, and the stamina for sport and hard work." },
  { key: "smarts", label: "🧠 Smarts", effect: "School grades, which careers and courses you qualify for, and how well businesses run." },
  { key: "looks", label: "✨ Looks", effect: "Hiring odds in some fields, dating, modelling and fame. Fades with age." },
] as const;
type TraitKey = (typeof TRAITS)[number]["key"];
const POINTS = 270;
const GIFTS = [
  { key: "athletic", label: "🏃 Athletic gift" },
  { key: "musical", label: "🎵 Musical ear" },
  { key: "acting", label: "🎭 Stage presence" },
  { key: "charisma", label: "🗣️ Charm" },
  { key: "business", label: "💼 Business sense" },
  { key: "discipline", label: "🧱 Willpower" },
] as const;
type GiftKey = (typeof GIFTS)[number]["key"];
const GIFT_POINTS = 330;

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
  const [customTraits, setCustomTraits] = useState(false);
  const [freeEdit, setFreeEdit] = useState(false);
  const [traits, setTraits] = useState<Record<TraitKey, number>>({ happiness: 75, health: 80, smarts: 60, looks: 55 });
  const [customGifts, setCustomGifts] = useState(false);
  const [gifts, setGifts] = useState<Record<GiftKey, number>>({ athletic: 50, musical: 50, acting: 50, charisma: 50, business: 50, discipline: 50 });
  const giftUsed = Object.values(gifts).reduce((a, b) => a + b, 0);
  const setGift = (k: GiftKey, v: number) =>
    setGifts((g) => {
      const max = freeEdit ? 100 : Math.min(100, GIFT_POINTS - (giftUsed - g[k]));
      return { ...g, [k]: Math.max(0, Math.min(max, Math.round(v))) };
    });
  const used = traits.happiness + traits.health + traits.smarts + traits.looks;
  const setTrait = (k: TraitKey, v: number) =>
    setTraits((t) => {
      const others = used - t[k];
      const max = freeEdit ? 100 : Math.min(100, POINTS - others);
      return { ...t, [k]: Math.max(5, Math.min(max, Math.round(v))) };
    });
  const randomTraits = () => {
    // Shuffle the budget across the four traits.
    const cuts = [Math.random(), Math.random(), Math.random()].sort();
    const parts = [cuts[0], cuts[1] - cuts[0], cuts[2] - cuts[1], 1 - cuts[2]].map((x) => 20 + x * (POINTS - 80));
    const vals = parts.map((x) => Math.max(5, Math.min(100, Math.round(x))));
    setTraits({ happiness: vals[0], health: vals[1], smarts: vals[2], looks: vals[3] });
  };

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
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <input type="checkbox" checked={customTraits} onChange={(e) => setCustomTraits(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Choose my starting traits
            </label>
            {customTraits && (
              <div className="mt-2 rounded-2xl border border-slate-700 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{freeEdit ? "Free edit: no limit" : `Points left: ${POINTS - used}`}</span>
                  <span className="flex gap-2">
                    <button type="button" className="underline" onClick={randomTraits}>Shuffle</button>
                    <button type="button" className="underline" onClick={() => setTraits({ happiness: 70, health: 70, smarts: 65, looks: 65 })}>Balanced</button>
                  </span>
                </div>
                {TRAITS.map((t) => (
                  <div key={t.key} className="mt-2.5">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t.label}</span>
                      <span className="tabular-nums">{traits[t.key]}</span>
                    </div>
                    <input type="range" min={5} max={100} value={traits[t.key]} onChange={(e) => setTrait(t.key, Number(e.target.value))} aria-label={t.label} className="w-full accent-emerald-500" />
                    <div className="text-xs text-slate-500">{t.effect}</div>
                  </div>
                ))}
                <label className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={freeEdit} onChange={(e) => setFreeEdit(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
                  <span>Free edit (no point limit). Fun for sandbox lives; scenario challenges won't count.</span>
                </label>
              </div>
            )}
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <input type="checkbox" checked={customGifts} onChange={(e) => setCustomGifts(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Shape my hidden gifts
            </label>
            {customGifts && (
              <div className="mt-2 rounded-2xl border border-slate-700 bg-slate-900/50 p-3">
                <p className="text-xs text-slate-400">Natural gifts you won't see in play, but that quietly shape what you're good at. Anything you leave alone is left to chance.</p>
                {!freeEdit && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Gift points left</span><span className="tabular-nums">{Math.max(0, GIFT_POINTS - giftUsed)}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, (GIFT_POINTS - giftUsed) / GIFT_POINTS) * 100}%` }} /></div>
                  </div>
                )}
                {GIFTS.map((g) => (
                  <div key={g.key} className="mt-2.5">
                    <div className="flex items-center justify-between text-sm font-semibold"><span>{g.label}</span><span className="text-xs font-normal text-slate-500">ordinary ↔ exceptional</span></div>
                    <input type="range" min={0} max={100} value={gifts[g.key]} onChange={(e) => setGift(g.key, Number(e.target.value))} aria-label={g.label} className="w-full accent-emerald-500" />
                  </div>
                ))}
              </div>
            )}
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
              <Button variant="primary" onClick={() => newGame({ firstName, lastName, gender, country, scenario, ...(customTraits ? { stats: traits } : {}), ...(customGifts ? { talents: gifts } : {}), ...(freeEdit && (customTraits || customGifts) ? { freeStats: true } : {}) })}>Be Born</Button>
            </div>
          </div>
        )}
      </div>
      {showHall && <HallOfLives onClose={() => setShowHall(false)} />}
    </main>
  );
}
