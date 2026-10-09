# Work-in-progress snapshots (unverified)

Eight parallel agents were stopped mid-work to save usage. Each patch applies on top of commit `5a1e9a0`
(the head of this branch before the agents started) and has NOT been type-checked, linted, tested or built.

Apply one with:  `git apply --3way wip/<name>.patch`  (then run tsc, eslint, vitest, build and fix what's broken).

| Patch | Domain |
|---|---|
| careers-education-money.patch | corporate careers, education, personal money |
| relationships-family.patch | relationships, family, adult life |
| crime-justice-politics.patch | crime, justice, politics, underworld, spy |
| business.patch | business and entrepreneurship |
| music-creators-fame.patch | music, creators, fame (rewrote music.ts) |
| health-aging-world.patch | health, ageing, world and era events |
| dynasty-royal-athlete.patch | handover chains, family tree, royal, athlete |
| ui-ux.patch | UI navigation, onboarding, accessibility |

Notes: patches exclude each agent's scratch play-through logs. The agents' own local branches are named
`worktree-agent-<id>` inside `.claude/worktrees/` and vanish if the container is reclaimed; these patches are the durable copy.
Each agent's play-through findings were never reported (stopped before the final report).
