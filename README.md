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

Your game autosaves to `localStorage` (no backend). Use the gear icon to export/import a save.

## What you can do

- **Grow up:** 380+ data-driven life events from infancy to 100+, school, romance, family, crime, health, fame.
- **Study:** high school, university (7 majors), medical school, law school, graduate school; student debt.
- **Work:** 45+ careers with ladders, plus special packs: movie star, rock star, pro athlete, influencer,
  entrepreneur (6 businesses), politician (elections), secret agent, astronaut, crime family, model, royalty (modelled on the British monarchy: public approval and a republican
  movement, an engagement diary with patronages, tours and military service, a private office, scandals and the press office,
  the Sovereign Grant and duchy income, audiences, royal assent and constitutional crises, accession, coronation, mourning,
  regency, abdication, stepping back, marriage consent, and raising heirs who inherit across generations).
- **Money:** taxes by country, loans, mortgages, rent tiers, investments (bonds, index, tech, crypto) and a
  boom/recession economy that moves layoffs, hiring, housing and markets.
- **Live:** hobbies with milestones, addictions and rehab, relocate abroad, adopt, grandchildren, pets, faith.
- **Break the law:** shoplifting to bank robbery, trial with lawyers or a plea bargain, probation and fines,
  prison (riot, escape, parole), life on the run.
- **Adult life (mature-content setting, on by default, 18+):** intimacy with partners, protection choices,
  pregnancy and STIs, open relationships, threesomes (their consent depends on personality), hookups at venues,
  flings, secret affairs and the fallout, adult careers (dancer, companion, content creator). Suggestive, never
  explicit, adults only.
- **Darker paths:** murder (five methods, cover-ups, detectives, cold cases, death row where it exists),
  assault, blackmail, arson, kidnapping, fraud, smuggling, tax evasion.
- **Legacy:** tombstone, epitaph, life chart, continue as your child after death (estate tax) or **hand your life to a child while you're alive** (any time; a reigning sovereign keeps the crown, which still passes by birth order), a family tree and dynasty view (line of succession, name clout, family trust, wills, raising an heir), plus a Hall of Lives and 50+
  achievements that persist across characters. Copy your life story as plain text from the tombstone.
- **Commitments are exclusive:** you can't run a business and hold a job, sign a record deal while employed, or study full time
  while working. Students take part-time jobs; evening courses (certificates) fit around work. Effort (coast / steady / grind),
  living standard, exercise and diet are standing choices with real costs and payoffs.
- **Scenario challenges:** fixed starts with goals and deadlines (Rags to Riches, Rise to Power, Dynasty, ...).
- **Adult relationships (mature setting):** set the age range (adults only), genders and interests you're open to; share a menu of
  experiences with partners and lovers; learn what each person enjoys and where their limits are by talking; open or polyamorous
  agreements. Everyone involved is an adult and a willing participant, and text is suggestive.
- **Quality of life:** a "past year" strip on the dashboard, milestone notices at key ages, contextual tips,
  **Skip 10 years** (autopilot makes the decisions cautiously and shows a recap; it stops for death, a trial or prison), text-size and reduce-motion settings,
  a rolling one-year backup save with crash recovery, and offline play (service worker, production build).

## Depth systems (recent)

- **Work and money:** burnout, annual reviews, promotion tracks, sector slumps and booms, layoff choices, unemployment benefit and a
  thin safety net, student loans, renting out property, distress and bankruptcy.
- **The world:** country- and era-specific events (pandemics, wars, recessions, disasters), healthcare that differs by country,
  treatment plans for chronic illness, school life (clubs, bullying, tutoring), visa routes and citizenship.
- **People:** shared memories and grievances, values and compatibility, counselling, separation and custody, in-laws, friendship arcs.
- **Business:** key people with loyalty and equity, rivals and market shifts, investors and a board, stepping back to chair.
- **Fame:** band members with grievances, tour pace, rights disputes and catalogue sales; TV, stage and franchises for actors; sponsors,
  national teams, rivalries and academies for athletes.
- **Politics:** a legislature where laws move national indicators, executive orders and repeals.
- **Names:** large per-country name pools with immigrant-family surnames.
- **Player help:** a contextual guide, glossary and life journal; pending decisions survive a reload.

## Testing

`npm test` runs ~490 Vitest tests, including multi-seed fuzz bots (`fuzz.test.ts`, `depth.fuzz.test.ts`) that check invariants
(bounded stats, unique relative ids, one sovereign, one full-time commitment) and a fixture save from before the depth work
(`__tests__/fixtures`) to keep old saves loading. Use the NEUTRAL talents helper in tests to avoid seed-brittle assertions.

## Architecture

| Path | Purpose |
| --- | --- |
| `src/types/game.types.ts` | `PlayerState`, `Relative`, `Job`, `Property`, `Vehicle`, notices |
| `src/context/GameStateContext.tsx` | React context: reducer, autosave, UI state |
| `src/engine/` | **Pure** game logic (no React). `ageUp.ts` is the yearly transaction; `world.ts`, `vices.ts`, `hobbies.ts`, `politics.ts`, `underworld.ts`, `spy.ts`, `paths.ts` are the feature modules |
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
