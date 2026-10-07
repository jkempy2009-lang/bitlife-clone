# Lifeline — a free text-life simulator

A mobile-first, BitLife-style life simulator built with **Next.js (App Router) + TypeScript + Tailwind CSS**.
Every year you age up, make choices, and live a different life: ordinary jobs, crime, royalty, stardom, prison,
families, dynasties. Lives continue across generations.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests (Vitest)
npm run build
```

Your game autosaves to `localStorage` (no backend).

## Architecture

| Path | Purpose |
| --- | --- |
| `src/types/game.types.ts` | `PlayerState`, `Relative`, `Job`, `Property`, `Vehicle`, notices |
| `src/context/GameStateContext.tsx` | React context: reducer, autosave, UI state |
| `src/engine/` | **Pure** game logic (no React). `ageUp.ts` is the yearly transaction |
| `src/data/lifeEventsEngine.ts` | Event schema + master list merged from `src/data/events/*` |
| `src/data/careersRegistry.ts` | Career ladders, education programs, Special Job Packs |
| `src/data/assetsCatalog.ts` | Cars, houses, mortgage/loan constants |
| `src/data/countries.ts`, `diseases.ts`, `crimes.ts` | Tax brackets & names, disease catalog, crime table |
| `src/components/` | Tabs, `ModalManager`, `TrialView`, `PrisonView`, `TombstoneOverlay`, `StartScreen` |

### Adding content (data-only)

Events live in `src/data/events/*.ts` and are built with `ev`, `opt`, `risk`:

```ts
ev("lost_dog", "general", 8, 60, "Lost Dog", "A frantic neighbour asks for help.", [
  opt("Help search", "You found the dog!", { karmaDelta: 5, happinessDelta: 4 }),
  risk("Charge a finder's fee", 0.4, ["They paid up.", { bankBalanceDelta: 200 }], ["They were furious.", { karmaDelta: -4 }]),
], { requires: { hasProperty: true }, cooldown: 6 });
```

Events support requirements (age, partner, job, flags, wealth, royalty…), weights, cooldowns, `once`,
chance outcomes, follow-ups (`queueEvent`), arrests, relatives, and more — see `ChoiceEffects`.

### Design notes

- All randomness uses a seeded PRNG stored in game state, so engine logic is deterministic and testable.
- Repeatable actions are limited to once per year (or capped) to prevent grinding.
- Mortality is a graded age/health curve; relatives die on the same curve.
