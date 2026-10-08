"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  AGENT_KINDS,
  agentBlocker,
  attendCallback,
  COACH_COST,
  fireAgent,
  fireManager,
  hireAgent,
  hireManager,
  managerBlocker,
} from "@/engine/acting";
import {
  acceptFranchise,
  bookSideGig,
  campaignBlocker,
  campaignForAwards,
  comebackBlocker,
  declineFranchise,
  franchiseExitCost,
  gigBlocker,
  leaveFranchise,
  leaveSeries,
  pressBlocker,
  pressCost,
  promoteFilm,
  seriesExitCost,
  startComeback,
  TRAIN_INFO,
  trainActing,
  trainBlocker,
  classCost,
  coachCost,
  type PressKind,
  type TrainKind,
} from "@/engine/actingActions";
import { CAMPAIGNS, campaignCost } from "@/engine/actingYear";
import { MEDIUM_LABEL } from "@/engine/actingShared";
import { careerSummary, ladderSteps } from "@/engine/actingStats";
import type { ActingMedium, AgentKind, CampaignMode } from "@/types/game.types";
import { Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";
import { BigStat, Row, money0 } from "./creativeUi";

const outcomeTone = (o: string) => (o === "flop" ? "red" : o === "blockbuster" ? "amber" : o === "hit" ? "green" : "slate");
const mediumIcon: Record<ActingMedium, string> = { film: "🎬", tv: "📺", stage: "🎭" };

/** Extra, bit part, supporting, lead, star: where you are and what the next step needs. */
export function LadderCard() {
  const { player: p } = useGame();
  if (p.currentJob?.lineId !== "actor") return null;
  const steps = ladderSteps(p);
  return (
    <Card>
      <h4 className="mb-2 text-sm font-bold">Role ladder</h4>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.title} className={`flex items-start gap-2 text-sm ${s.state === "here" ? "text-amber-300" : s.state === "done" ? "text-slate-300" : "text-slate-500"}`}>
            <span aria-hidden>{s.state === "done" ? "✓" : s.state === "here" ? "▶" : "○"}</span>
            <span>
              <span className="font-semibold">{s.title}</span> <span className="text-xs text-slate-500">{s.role}</span>
              {s.need && <span className="block text-xs text-sky-300">Next: {s.need}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** A second round of auditions: choose how to prepare. */
export function CallbackCard() {
  const { player: p, act } = useGame();
  const cb = p.acting.callback;
  if (!cb) return null;
  const poor = p.bankBalance < COACH_COST;
  return (
    <Card className="border-sky-700/60">
      <Banner tone="blue">
        <strong>Call-back:</strong> the producers want to see you again for a {cb.genre.toLowerCase()} part. It lapses when you age up. Odds if you wing it: {Math.round(cb.odds * 100)}%.
      </Banner>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <ActionButton label="Wing it" hint="No prep, no cost." onClick={() => act((pl, rng) => attendCallback(pl, rng, "wing"))} />
        <ActionButton label="Rehearse all night" hint={`+8 points, costs some happiness. About ${Math.round((cb.odds + 0.08) * 100)}%.`} variant="primary" onClick={() => act((pl, rng) => attendCallback(pl, rng, "rehearse"))} />
        <ActionButton label={`Book a coach (${money0(COACH_COST)})`} hint={`+15 points. About ${Math.round((cb.odds + 0.15) * 100)}%.`} variant="gold" reason={poor ? `Needs ${money0(COACH_COST)}` : null} onClick={() => act((pl, rng) => attendCallback(pl, rng, "coach"))} />
      </div>
    </Card>
  );
}

export function RepresentationPanel() {
  const { player: p, act } = useGame();
  const a = p.acting;
  const [kind, setKind] = useState<AgentKind>("mid");
  if (!p.currentJob || (p.currentJob.lineId !== "actor" && p.currentJob.lineId !== "model")) return null;
  const mBlock = managerBlocker(p);
  return (
    <>
      <SectionTitle>Representation</SectionTitle>
      <Card>
        {a.agent ? (
          <>
            <Row label="Agent" value={`${a.agent.name} (${AGENT_KINDS[a.agent.kind].label.toLowerCase()})`} />
            <Row label="Connections" value={`${a.agent.skill}/100`} />
            <Row label="Commission" value={`${Math.round(a.agent.cut * 100)}%`} />
            <Row label="Years together" value={a.agent.yearsWith} />
            <div className="mt-1.5">
              <Meter label="Their faith in you" value={a.agent.trust} tone={a.agent.trust > 50 ? "green" : a.agent.trust > 25 ? "amber" : "red"} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Work and hits build trust. A quiet year erodes it, and agents drop clients they no longer believe in.</p>
            <ActionButton className="mt-2" variant="ghost" label="Part ways with agent" hint="You will see fewer offers and no lead auditions." onClick={() => act((pl, rng) => fireAgent(pl, rng))} />
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-400">Pick the kind of agent to approach. Bigger agencies open doors but drop quiet clients.</p>
            <div className="mb-2 grid grid-cols-1 gap-2">
              {(Object.keys(AGENT_KINDS) as AgentKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${kind === k ? "border-emerald-500 bg-emerald-900/30" : "border-slate-700 bg-slate-900/50 hover:bg-slate-800"}`}
                >
                  <div className="text-sm font-semibold text-slate-100">{AGENT_KINDS[k].label}</div>
                  <div className="text-xs text-slate-400">{AGENT_KINDS[k].blurb}</div>
                </button>
              ))}
            </div>
            <ActionButton variant="primary" label="🤝 Approach agents" reason={agentBlocker(p, kind)} onClick={() => act((pl, rng) => hireAgent(pl, rng, kind))} />
          </>
        )}
      </Card>
      <Card>
        {a.manager ? (
          <>
            <Row label="Manager" value={a.manager.name} />
            <Row label="Taste" value={`${a.manager.skill}/100`} />
            <Row label="Commission" value={`${Math.round(a.manager.cut * 100)}% on top`} />
            <p className="mt-1 text-xs text-slate-500">Better scripts, an extra offer a year, and calmer scandals.</p>
            <ActionButton className="mt-2" variant="ghost" label="Let manager go" onClick={() => act((pl) => fireManager(pl))} />
          </>
        ) : (
          <ActionButton label="🧭 Hire a personal manager" hint="12% on top of your agent. Improves script quality, offers and scandal damage." reason={mBlock} onClick={() => act((pl, rng) => hireManager(pl, rng))} />
        )}
      </Card>
    </>
  );
}

export function SeriesPanel() {
  const { player: p, act } = useGame();
  const s = p.acting.series;
  if (!s) return null;
  const cost = seriesExitCost(p);
  return (
    <>
      <SectionTitle hint={s.status === "pilot" ? "awaiting a decision" : `season ${s.season}`}>Television</SectionTitle>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold">📺 {s.title}</div>
            <div className="text-xs text-slate-400">{s.genre} · {s.network} · {s.role}</div>
          </div>
          <Pill tone={s.status === "pilot" ? "blue" : s.ratings >= 55 ? "green" : "amber"}>{s.status === "pilot" ? "Pilot" : `${s.season} season${s.season === 1 ? "" : "s"}`}</Pill>
        </div>
        <div className="mt-2">
          <Row label="Fee per season" value={money0(s.fee)} />
          <Row label="Seasons on your contract" value={s.yearsLeft} />
          {s.status === "running" && s.season > 0 && <Meter label="Ratings" value={s.ratings} tone={s.ratings >= 55 ? "green" : s.ratings >= 30 ? "amber" : "red"} />}
        </div>
        <p className="mt-1 text-xs text-slate-500">While you are on a show you can't take features, but voice work and ads still fit. Run past four seasons and reruns keep paying.</p>
        <ActionButton
          className="mt-2"
          variant="danger"
          label={cost > 0 ? `Leave the show (${money0(cost)} damages)` : "Leave the show"}
          hint={cost > 0 ? "Breaking a contract costs money and reputation." : "Your contract is up. You can walk away cleanly."}
          reason={p.bankBalance < cost ? `Needs ${money0(cost)}` : null}
          onClick={() => act((pl) => leaveSeries(pl))}
        />
      </Card>
    </>
  );
}

export function FranchisePanel() {
  const { player: p, act } = useGame();
  const o = p.acting.franchiseOffer;
  const f = p.acting.franchise;
  if (!o && !f) return null;
  return (
    <>
      <SectionTitle>Franchise</SectionTitle>
      {o && (
        <Card className="border-amber-700/60">
          <Banner tone="amber">
            🎞️ The studio wants a {o.films}-film sequel deal for &quot;{o.name}&quot;: {money0(o.fee)} a picture, rising 15% each time. They choose the dates and you can&apos;t take other features until the saga ends. Later sequels tire audiences. Offer lapses when you age up.
          </Banner>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ActionButton variant="gold" label="Sign" reason={p.acting.studioDeal ? "Your studio deal is exclusive" : p.acting.series ? "Your series is exclusive" : null} onClick={() => act((pl) => acceptFranchise(pl))} />
            <ActionButton variant="ghost" label="Pass" hint="Keep your options open." onClick={() => act((pl) => declineFranchise(pl))} />
          </div>
        </Card>
      )}
      {f && (
        <Card>
          <Row label="Saga" value={f.name} />
          <Row label="Genre" value={f.genre} />
          <Row label="Next installment" value={`Part ${f.installment}`} />
          <Row label="Sequels still owed" value={f.filmsLeft} />
          <Row label="Next fee" value={money0(f.fee)} />
          <ActionButton
            className="mt-2"
            variant="danger"
            label={`Buy out of the saga (${money0(franchiseExitCost(p))})`}
            reason={p.bankBalance < franchiseExitCost(p) ? "Can't afford it" : null}
            onClick={() => act((pl) => leaveFranchise(pl))}
          />
        </Card>
      )}
    </>
  );
}

/** Press tour, coaching and method acting for the film in production. */
export function ProductionPanel() {
  const { player: p, act } = useGame();
  const f = p.acting.pendingFilm;
  const actor = p.currentJob?.lineId === "actor";
  if (!actor && !f) return null;
  const behind = f && (f.role === "producer" || f.role === "director");
  const train = (k: TrainKind) => act((pl, rng) => trainActing(pl, rng, k));
  const press = (k: PressKind) => act((pl, rng) => promoteFilm(pl, rng, k));
  return (
    <>
      <SectionTitle hint="before it opens">Training and Promotion</SectionTitle>
      <Card>
        <ActionButton
          label={`🎓 ${TRAIN_INFO.class.label} (${money0(classCost(p))})`}
          hint={TRAIN_INFO.class.blurb}
          reason={actor ? trainBlocker(p, "class") : "You need an acting job."}
          onClick={() => train("class")}
        />
        {f && !behind && (
          <div className="mt-3 grid grid-cols-1 gap-3">
            <ActionButton label={`🗣️ ${TRAIN_INFO.coach.label} (${money0(coachCost(p))})`} hint={TRAIN_INFO.coach.blurb} reason={trainBlocker(p, "coach")} onClick={() => train("coach")} />
            <ActionButton variant="gold" label={`🎭 ${TRAIN_INFO.method.label}`} hint={`${TRAIN_INFO.method.blurb} Costs health and happiness now; risk of a breakdown at release.`} reason={trainBlocker(p, "method")} onClick={() => train("method")} />
          </div>
        )}
        {f && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-700 pt-3">
            <div className="text-xs text-slate-400">&quot;{f.title}&quot; promotion: {f.promo ?? 0}/40</div>
            {!behind && <ActionButton label="📻 Do the interviews" hint="Free. Small boost, tiny risk of a gaffe." reason={pressBlocker(p, "interviews")} onClick={() => press("interviews")} />}
            {!behind && <ActionButton variant="primary" label={`✈️ Press tour (${money0(pressCost(p, "tour"))})`} hint="Bigger boost. Tiring, with a gaffe risk." reason={pressBlocker(p, "tour")} onClick={() => press("tour")} />}
            {behind && <ActionButton variant="primary" label={`📣 Marketing push (${money0(pressCost(p, "marketing"))})`} hint="8% of the budget on trailers and posters." reason={pressBlocker(p, "marketing")} onClick={() => press("marketing")} />}
          </div>
        )}
        {!f && <p className="mt-2 text-xs text-slate-500">Once you are cast in something you can coach, go method, or sell it on a press tour.</p>}
      </Card>
    </>
  );
}

export function AwardsPanel() {
  const { player: p, act } = useGame();
  const r = p.acting.awardsRun;
  if (!r) return null;
  const modes: CampaignMode[] = ["festivals", "lunch", "blitz"];
  return (
    <>
      <SectionTitle hint="ceremony next year">Awards Season</SectionTitle>
      <Card className="border-amber-700/60">
        <div className="font-semibold">🏆 &quot;{r.title}&quot; is a contender</div>
        <div className="text-xs text-slate-400">{MEDIUM_LABEL[r.medium]} · critics {r.critics} · prestige {r.prestige}</div>
        <p className="mt-1 text-xs text-slate-400">Current approach: <strong>{CAMPAIGNS[r.campaign].label}</strong>{r.spent ? ` (${money0(r.spent)} spent)` : ""}. A win lifts your fee 20%, but loud campaigns can backfire.</p>
        {r.campaign === "quiet" && (
          <div className="mt-2 grid grid-cols-1 gap-2">
            {modes.map((m) => (
              <ActionButton
                key={m}
                variant={m === "blitz" ? "gold" : "secondary"}
                label={`${CAMPAIGNS[m].label} (${money0(campaignCost(p, m))})`}
                hint={CAMPAIGNS[m].blurb}
                reason={campaignBlocker(p, m)}
                onClick={() => act((pl) => campaignForAwards(pl, m))}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export function SideWorkPanel() {
  const { player: p, act } = useGame();
  if (p.currentJob?.lineId !== "actor") return null;
  const a = p.acting;
  const cb = comebackBlocker(p);
  return (
    <>
      <SectionTitle hint="fits around anything">Side Work and Second Acts</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-3">
          <ActionButton label="🎙️ Book voice work" hint="Guild-rate animation or audiobook work. Small, steady, nobody sees your face." reason={gigBlocker(p, "voice")} onClick={() => act((pl, rng) => bookSideGig(pl, rng, "voice"))} />
          <ActionButton label="📺 Shoot a regional ad" hint="Quick money and a trickle of residuals. Serious critics wince." reason={gigBlocker(p, "commercial")} onClick={() => act((pl, rng) => bookSideGig(pl, rng, "commercial"))} />
          <ActionButton
            variant="gold"
            label="🔁 Stage a comeback"
            hint={`Call in favours for one small serious film. Needs a gap in your career or a slumping reputation. ${a.yearsSinceWork > 0 ? `(${a.yearsSinceWork} year${a.yearsSinceWork === 1 ? "" : "s"} without work)` : ""}`}
            reason={cb}
            onClick={() => act((pl, rng) => startComeback(pl, rng))}
          />
        </div>
      </Card>
    </>
  );
}

export function CareerSummaryCard() {
  const { player: p } = useGame();
  const a = p.acting;
  if (a.credits.length === 0) return null;
  const s = careerSummary(p);
  return (
    <>
      <SectionTitle hint={`${s.years} year${s.years === 1 ? "" : "s"} in the business`}>Career Summary</SectionTitle>
      <Card>
        <BigStat label="Credits" value={s.total} sub={`${mediumIcon.film} ${s.byMedium.film} · ${mediumIcon.tv} ${s.byMedium.tv} · ${mediumIcon.stage} ${s.byMedium.stage}`} />
        <div className="mt-2">
          <Row label="Hit rate" value={`${Math.round(s.hitRate * 100)}% (${s.hits} hits, ${s.flops} flops)`} />
          <Row label="Film box office" value={money0(s.grossed)} />
          <Row label="Television seasons" value={s.seasons} />
          <Row label="Awards / nominations" value={`${s.awards} / ${s.nominations}`} />
          <Row label="Produced or directed" value={s.producing} />
          <Row label="Lifetime screen earnings" value={money0(a.earnings)} />
          {s.best && <Row label="Best work" value={s.best.title} />}
          {s.worst && <Row label="Worst notices" value={s.worst.title} />}
          {a.typecast && <Row label="Typecast as" value={a.typecast} />}
        </div>
      </Card>
    </>
  );
}

export function Filmography() {
  const { player: p } = useGame();
  const [filter, setFilter] = useState<ActingMedium | "all">("all");
  const credits = p.acting.credits;
  if (credits.length === 0) return null;
  const shown = [...credits].filter((c) => filter === "all" || (c.medium ?? "film") === filter).reverse();
  return (
    <>
      <SectionTitle hint={`${credits.length} credit${credits.length === 1 ? "" : "s"}`}>Filmography</SectionTitle>
      <div className="flex gap-1.5">
        {(["all", "film", "tv", "stage"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setFilter(m)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === m ? "border-emerald-500 bg-emerald-900/30 text-slate-100" : "border-slate-700 text-slate-400"}`}
          >
            {m === "all" ? "All" : MEDIUM_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {shown.map((f) => {
          const medium = f.medium ?? "film";
          return (
            <Card key={f.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{mediumIcon[medium]} {f.title}{f.award ? " 🏆" : ""}{f.sleeper ? " 💤" : ""}</div>
                  <div className="text-xs text-slate-400">{f.year} · {f.genre} · {f.role}{f.installment ? ` · part ${f.installment}` : ""}{f.seasons ? ` · ${f.seasons} season${f.seasons === 1 ? "" : "s"}` : ""} · critics {f.critics}</div>
                  {medium !== "tv" && <div className="text-xs text-slate-500">Budget {money0(f.budget)} · {medium === "stage" ? "takings" : "box office"} {money0(f.boxOffice)}{f.sleeper ? " · sleeper hit" : ""}</div>}
                  {f.award && <div className="text-xs text-amber-300">{f.award}</div>}
                </div>
                <Pill tone={outcomeTone(f.outcome)}>{f.outcome}</Pill>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
