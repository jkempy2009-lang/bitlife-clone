"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  ENGAGEMENTS,
  adoptPatronage,
  answerChance,
  answerScandal,
  approvalWord,
  deploymentBlocker,
  dropPatronage,
  engage,
  engagementBlocker,
  gaffeChance,
  joinService,
  leaveService,
  maxPatronages,
  patronageBlocker,
  republicWord,
  requestDeployment,
  royalFinance,
  secretaryBlocker,
  serviceBlocker,
  setSecretary,
  slotsFor,
  slotsUsed,
  stepBack,
  stepBackBlocker,
  tellAll,
  toggleEstate,
  type EngagementKind,
  type ScandalAnswer,
} from "@/engine/court";
import {
  NATION_LABEL,
  abdicateAction,
  abdicationBlocker,
  adviceChance,
  audienceBlocker,
  heirToThrone,
  holdAudience,
  honoursBlocker,
  honoursList,
  referendumChance,
  type AbdicationMode,
  type AudienceStance,
  type HonoursKind,
  type NationKey,
} from "@/engine/crown";
import { royalChildren, setSchool, trainChild, trainingBlocker, type TrainingKind } from "@/engine/courtFamily";
import { isSovereign, trainingOf } from "@/engine/courtState";
import { BRANCHES, PATRONAGES, PATRONAGE_BY_ID, SECRETARIES, TRAINING_SCHOOLS } from "@/data/court";
import { money } from "@/lib/format";
import type { RoyalTraining, ServiceBranch } from "@/types/game.types";
import { Button, Card, Pill, Segmented, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";

type Tab = "diary" | "crown" | "household" | "family" | "money";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function CourtSection() {
  const { player: p } = useGame();
  const sov = isSovereign(p);
  const [tab, setTab] = useState<Tab>("diary");
  const tabs: { id: Tab; label: string }[] = [
    { id: "diary", label: "📅 Diary" },
    { id: "crown", label: sov ? "👑 The Crown" : "🏛️ Crown" },
    { id: "household", label: "🏠 Household" },
    { id: "family", label: "👪 Family" },
    { id: "money", label: "💷 Finances" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Standing />
      <Segmented<Tab> value={tab} onChange={setTab} options={tabs} />
      {tab === "diary" && <Diary />}
      {tab === "crown" && <Crown />}
      {tab === "household" && <Household />}
      {tab === "family" && <Family />}
      {tab === "money" && <Finances />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standing: approval, republic, press
// ---------------------------------------------------------------------------

function Standing() {
  const { player: p } = useGame();
  const c = p.court;
  return (
    <Card className="flex flex-col gap-2.5">
      <Meter label="🗳️ Public approval" value={c.approval} tone={c.approval >= 60 ? "green" : c.approval >= 35 ? "amber" : "red"} note={`${Math.round(c.approval)} · ${approvalWord(c.approval)}`} />
      <Meter label="🚩 Republican support" value={c.republic} tone={c.republic >= 60 ? "red" : c.republic >= 35 ? "amber" : "slate"} note={`${Math.round(c.republic)} · ${republicWord(c.republic)}`} />
      <Meter label="📸 Press attention" value={c.heat} tone={c.heat >= 60 ? "red" : c.heat >= 35 ? "amber" : "blue"} />
      <p className="text-xs text-slate-500">
        Approval is how much the public like you; it drives funding and republican feeling. Royal Respect (above) is how safe the throne is. Work the diary, keep clear of scandal, and the two rise together.
      </p>
      {c.mourning > 0 && <Banner tone="blue">🖤 The nation is in mourning. Only solemn duties are appropriate: galas and tours will backfire.</Banner>}
      {c.regency && <Banner tone="amber">⚖️ You are a minor. {c.regency} acts as Regent until you turn 18.</Banner>}
      {c.withdrawn > 0 && <Banner tone="amber">🚪 Out of public life for {c.withdrawn} more year{c.withdrawn === 1 ? "" : "s"}; allowance halved.</Banner>}
      {c.disgraced && <Banner tone="red">⛔ You have been stripped of titles' use, patronages and funding. You can still leave royal life from the Diary tab.</Banner>}
      {c.regnalName && isSovereign(p) && !c.coronated && <Banner tone="blue">👑 Not yet crowned. A coronation will follow the year of mourning.</Banner>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Diary
// ---------------------------------------------------------------------------

const KIND_ORDER: EngagementKind[] = ["hospital", "walkabout", "patron", "remembrance", "investiture", "banquet", "tour_realm", "tour_state"];

function PressOffice() {
  const { player: p, act } = useGame();
  const s = p.court.scandal;
  if (!s) return null;
  const core = isSovereign(p) || p.royal?.line === 1;
  const row = (how: ScandalAnswer, label: string, hint: string) => (
    <ActionButton key={how} label={label} hint={`${hint} · about ${pct(answerChance(p, how, s.severity))} to work`} onClick={() => act((pl, rng) => answerScandal(pl, rng, how))} />
  );
  return (
    <Card className="border-rose-600/50 bg-rose-950/30">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-rose-300">Press office · severity {s.severity}/3</div>
      <div className="font-semibold">{s.title}</div>
      <p className="mb-2 text-sm text-slate-300">{s.story}</p>
      <div className="flex flex-col gap-2">
        {row("statement", "Issue a statement", "Free")}
        {row("apologise", "Apologise publicly", "Free, costs a little pride")}
        {core && row("address", "Address the nation", "Free, high stakes")}
        {row("lawyers", "Send in the lawyers", `Costs ${money(s.severity * 120_000)}; a failed injunction backfires`)}
        {row("silence", "Say nothing", "Free; only works on small stories")}
        {!core && row("withdraw", "Withdraw from public life", "Certain, but you lose your diary and half your allowance")}
        {!core && row("leave", "Leave royal life", "Certain, and permanent")}
      </div>
    </Card>
  );
}

function Diary() {
  const { player: p, act } = useGame();
  const c = p.court;
  const total = slotsFor(p);
  const used = slotsUsed(p);
  const sov = isSovereign(p);
  const serving = c.service && !c.service.done ? c.service : null;
  return (
    <div className="flex flex-col gap-3">
      <PressOffice />
      <SectionTitle hint={total > 0 ? `${used} of ${total} days booked` : "no free days"}>Engagement diary</SectionTitle>
      <Card className="flex flex-col gap-3">
        <Meter label="Days booked this year" value={total === 0 ? 0 : (used / total) * 100} tone={used >= total ? "amber" : "green"} note={`${used} / ${total}`} />
        <p className="text-xs text-slate-500">
          Tours take three days, so you cannot also fit a full round of visits in. Military service, a new baby, age and your private office change how many days you have. Working royals keep their full allowance; a royal who never turns up is cut and called idle.
        </p>
        <div className="flex flex-col gap-2">
          {KIND_ORDER.filter((k) => k !== "patron" && !(ENGAGEMENTS[k].sovereignOnly && !sov) && !(k === "tour_realm" && c.realmNames.length === 0)).map((k) => {
            const e = ENGAGEMENTS[k];
            return (
              <ActionButton
                key={k}
                label={`${e.emoji} ${e.label}${k === "tour_realm" || k === "tour_state" ? " · 3 days" : ""}`}
                hint={`${e.blurb}${e.cost ? ` Costs ${money(e.cost)}.` : ""}${k === "walkabout" ? ` Gaffe risk about ${pct(gaffeChance(p))}.` : ""}`}
                reason={engagementBlocker(p, k)}
                onClick={() => act((pl, rng) => engage(pl, rng, k))}
              />
            );
          })}
        </div>
      </Card>

      <SectionTitle hint={`${c.patronages.length} of ${maxPatronages(p)} causes`}>Patronages</SectionTitle>
      <Card className="flex flex-col gap-3">
        {c.patronages.length === 0 && <p className="text-sm text-slate-400">You back no causes yet. A patron who keeps visiting year after year earns far more goodwill than one who signs a letter.</p>}
        {c.patronages.map((h) => {
          const info = PATRONAGE_BY_ID[h.id];
          const idle = p.year - h.lastYear;
          return (
            <div key={h.id} className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{info.emoji} {info.name}</div>
                  <div className="text-xs text-slate-400">{h.years} year{h.years === 1 ? "" : "s"} of service · {info.perkText} per visit{idle >= 2 ? ` · unvisited for ${idle} years!` : ""}</div>
                </div>
                <Button variant="ghost" className="shrink-0 px-2.5 py-1.5 text-xs" onClick={() => act((pl) => dropPatronage(pl, h.id))}>Step down</Button>
              </div>
              <ActionButton className="mt-2" label="Visit this year" reason={engagementBlocker(p, "patron", h.id)} onClick={() => act((pl, rng) => engage(pl, rng, "patron", h.id))} />
            </div>
          );
        })}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">➕ Take up a new cause</summary>
          <div className="mt-2 flex flex-col gap-2">
            {PATRONAGES.filter((x) => !c.patronages.some((h) => h.id === x.id)).map((x) => (
              <ActionButton key={x.id} label={`${x.emoji} ${x.name}`} hint={`${x.blurb} +${x.approval} approval and ${x.perkText} per visit. Takes a day to launch.`} reason={patronageBlocker(p, x.id)} onClick={() => act((pl) => adoptPatronage(pl, x.id))} />
            ))}
          </div>
        </details>
      </Card>

      <SectionTitle>Military service</SectionTitle>
      <Card className="flex flex-col gap-2">
        {serving ? (
          <>
            <div className="font-semibold">{BRANCHES[serving.branch].emoji} {BRANCHES[serving.branch].ranks[serving.rank]}, {BRANCHES[serving.branch].name}</div>
            <div className="text-xs text-slate-400">{serving.years} year{serving.years === 1 ? "" : "s"} served · {serving.deployments} operational tour{serving.deployments === 1 ? "" : "s"}{serving.deployed ? " · deployed now" : ""}</div>
            <ActionButton label="🛡️ Request an operational deployment" hint={`The public admire a royal who serves at the front. Real risk of injury or worse${p.royal?.line === 1 ? "; the Ministry is reluctant to risk the heir" : ""}.`} reason={deploymentBlocker(p)} onClick={() => act((pl, rng) => requestDeployment(pl, rng))} />
            <Button variant="ghost" onClick={() => act((pl) => leaveService(pl))}>Leave the forces</Button>
            <p className="text-xs text-slate-500">Service costs you two days a year from your diary (four while deployed) and ends after eight years.</p>
          </>
        ) : c.service?.done ? (
          <p className="text-sm text-slate-300">🎖️ You served {c.service.years} years as a {BRANCHES[c.service.branch].ranks[c.service.rank]} and are respected for it. Veterans earn extra goodwill at remembrance events.</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">Many young royals serve. It earns respect, fitness and a story to tell, but it takes up your diary for years.</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(BRANCHES) as ServiceBranch[]).map((b) => (
                <Button key={b} variant="secondary" disabled={!!serviceBlocker(p)} onClick={() => act((pl) => joinService(pl, b))}>{BRANCHES[b].emoji} {BRANCHES[b].name}</Button>
              ))}
            </div>
            {serviceBlocker(p) && <div className="text-xs text-rose-300">🔒 {serviceBlocker(p)}</div>}
          </>
        )}
      </Card>

      {!sov && (
        <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">🚪 Step back from royal life</summary>
          <p className="my-2 text-xs leading-relaxed text-slate-400">
            Like a senior royal who leaves: you keep your name and your fortune, but lose the allowance, security and use of your HRH style, and the patronages go. You may then work, start a business and live privately, though the press will follow. You can sell your story afterwards, at a price in family goodwill.
          </p>
          <ActionButton variant="danger" label="Leave the Firm" reason={stepBackBlocker(p)} onClick={() => act((pl) => stepBack(pl))} />
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Crown (constitutional role)
// ---------------------------------------------------------------------------

const TOPICS: NationKey[] = ["economy", "freedom", "military"];

function Crown() {
  const { player: p, act } = useGame();
  const c = p.court;
  const sov = isSovereign(p);
  const [topic, setTopic] = useState<NationKey>("economy");
  const [confirm, setConfirm] = useState<AbdicationMode | null>(null);
  const heir = heirToThrone(p);

  if (!sov) {
    return (
      <Card>
        <div className="font-semibold">{p.royal?.crown === "abdicated" ? "A former sovereign" : p.royal?.line === 1 ? "Heir to the throne" : `Number ${p.royal?.line ?? "?"} in line`}</div>
        <p className="mt-1 text-sm text-slate-400">
          Only the sovereign holds the constitutional role. Until then you carry out engagements, build your popularity and prepare. When the sovereign dies the crown goes to the eldest child under absolute primogeniture. A younger sibling who is passed over becomes a duke or duchess. If you were passed the throne young, a Regent governs for you until you are 18.
        </p>
        {p.royal?.line === 1 && <p className="mt-2 text-xs text-slate-500">As heir you receive the duchy's income, and every scandal and gaffe is a rehearsal for the day you reign.</p>}
      </Card>
    );
  }
  const blocked = audienceBlocker(p);
  const honoursBlock = honoursBlocker(p);
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2.5">
        <div className="text-sm">🏛️ {c.pm ? `Prime Minister ${c.pm}` : "The Prime Minister"}</div>
        <Meter label="Relationship with the government" value={c.government} tone={c.government >= 55 ? "green" : c.government >= 30 ? "amber" : "red"} />
        <Meter label="Constitutional strain (70+ is a crisis)" value={c.strain} tone={c.strain >= 60 ? "red" : c.strain >= 30 ? "amber" : "slate"} />
        <p className="text-xs text-slate-500">The sovereign's job is to be consulted, to encourage and to warn, never to govern. Meddling raises strain; at 70 ministers force a crisis.</p>
      </Card>

      <SectionTitle hint="once a year">Weekly audience</SectionTitle>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Topic on your mind:</span>
          {TOPICS.map((t) => (
            <button key={t} type="button" onClick={() => setTopic(t)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${topic === t ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-300"}`}>{NATION_LABEL[t]}</button>
          ))}
        </div>
        {([
          ["listen", "🤝 Listen and encourage", "Safe. Builds trust with the government."],
          ["advise", "⚠️ Advise and warn", `Your constitutional right. About ${pct(adviceChance(p))} chance the government listens; otherwise they bristle.`],
          ["press", "🗣️ Press your own preference", "Overstepping. Strain +18 and the government resents it; sometimes you win; if it leaks, approval collapses."],
        ] as [AudienceStance, string, string][]).map(([s, label, hint]) => (
          <ActionButton key={s} label={label} hint={hint} reason={blocked} variant={s === "press" ? "danger" : "secondary"} onClick={() => act((pl, rng) => holdAudience(pl, rng, s, topic))} />
        ))}
      </Card>

      <SectionTitle hint="once a year">Honours list</SectionTitle>
      <Card className="flex flex-col gap-2">
        {([
          ["servants", "🏅 Public servants and volunteers", "Approval +4, Karma +2."],
          ["celebrities", "⭐ Sport, arts and celebrity", "Fame +3, approval +3, more press attention."],
          ["pm_list", "📜 The Prime Minister's list as drafted", "Government +5. The press may notice the donors."],
          ["friends", "🥂 Your household and old friends", "Happiness +3, but 'jobs for friends' is a risk."],
        ] as [HonoursKind, string, string][]).map(([k, label, hint]) => (
          <ActionButton key={k} label={label} hint={hint} reason={honoursBlock} onClick={() => act((pl, rng) => honoursList(pl, rng, k))} />
        ))}
      </Card>

      {c.realmNames.length > 0 && (
        <>
          <SectionTitle hint={`${c.realmNames.length} realms`}>Realms that share your crown</SectionTitle>
          <Card>
            <div className="flex flex-wrap gap-1.5">{c.realmNames.map((r) => <Pill key={r} tone="blue">{r}</Pill>)}</div>
            <p className="mt-2 text-xs text-slate-500">Low approval and republican feeling make realms vote to leave. A realm tour in the Diary halves the risk for the year.</p>
          </Card>
        </>
      )}

      {c.republic >= 55 && (
        <Banner tone="red">🚩 Republican support is {Math.round(c.republic)}. At 65 a referendum can be forced. If one comes, your chance of surviving would be about {pct(referendumChance(p, "above"))} by staying above politics.</Banner>
      )}

      <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">🪑 Abdicate</summary>
        <p className="my-2 text-xs leading-relaxed text-slate-400">
          Hand the crown to {heir ? `${heir.name} (age ${heir.age})` : "your heir"} and live on as a Prince or Princess on an allowance from the new sovereign. A dignified retirement after 65 is admired; abdicating young, under pressure or for love costs you dearly. A succession crisis can follow.
        </p>
        {abdicationBlocker(p) ? <div className="text-xs text-rose-300">🔒 {abdicationBlocker(p)}</div> : (
          <div className="flex flex-col gap-2">
            {confirm === null ? (
              <Button variant="secondary" onClick={() => setConfirm("retire")}>Begin the abdication…</Button>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-300">Are you sure? This cannot be undone.</p>
                <Button variant="danger" onClick={() => { act((pl) => abdicateAction(pl, confirm)); setConfirm(null); }}>Yes, abdicate</Button>
                <Button variant="ghost" onClick={() => setConfirm(null)}>Keep the crown</Button>
              </>
            )}
          </div>
        )}
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

function Household() {
  const { player: p, act } = useGame();
  const cur = p.court.secretary;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Private office</SectionTitle>
      <p className="text-xs text-slate-500">
        A good private office handles scandals, spares you gaffes, gives you extra engagement days and keeps constitutional advice sane. Dismissing a senior aide can lead to a tell-all.
      </p>
      {SECRETARIES.map((s, i) => (
        <Card key={s.name} className={i === cur ? "border-emerald-500/60" : ""}>
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-semibold">{i === cur ? "✓ " : ""}{s.name}</div>
            <div className="text-xs tabular-nums text-slate-400">{s.cost ? `${money(s.cost)} / yr` : "free"}</div>
          </div>
          <p className="my-1 text-xs text-slate-400">{s.blurb}{i > cur && s.hire ? ` Recruitment fee ${money(s.hire)}.` : ""}</p>
          {i !== cur && <ActionButton label={i > cur ? "Appoint" : "Scale back"} reason={secretaryBlocker(p, i)} variant={i > cur ? "primary" : "ghost"} onClick={() => act((pl, rng) => setSecretary(pl, rng, i))} />}
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Family: spouse, succession, training the next generation
// ---------------------------------------------------------------------------

function TrainBars({ t }: { t: RoyalTraining }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Meter label="Duty" value={t.duty} tone="blue" />
      <Meter label="Common touch" value={t.touch} tone="green" />
      <Meter label="Polish" value={t.polish} tone="amber" />
    </div>
  );
}

function ChildCard({ id }: { id: string }) {
  const { player: p, act } = useGame();
  const kid = p.relatives.find((r) => r.id === id);
  const [cause, setCause] = useState<string>(PATRONAGES[0].id);
  if (!kid) return null;
  const t = trainingOf(kid);
  const name = kid.name.split(" ")[0];
  const run = (kind: TrainingKind, label: string, hint: string, arg?: string) => (
    <ActionButton key={kind + (arg ?? "")} label={label} hint={hint} reason={trainingBlocker(p, id, kind, arg)} onClick={() => act((pl, rng) => trainChild(pl, rng, id, kind, arg))} />
  );
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">{kid.name}</div>
        <div className="text-xs text-slate-400">{kid.royalTitle} · age {kid.age}</div>
      </div>
      <TrainBars t={t} />
      {kid.age >= 4 && kid.age < 18 && (
        <div>
          <div className="mb-1 text-xs text-slate-400">Schooling</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(TRAINING_SCHOOLS) as RoyalTraining["school"][]).map((s) => (
              <button key={s} type="button" onClick={() => act((pl) => setSchool(pl, id, s))} className={`rounded-xl px-2 py-2 text-xs font-semibold ${t.school === s ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                {TRAINING_SCHOOLS[s].label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{TRAINING_SCHOOLS[t.school].blurb}{TRAINING_SCHOOLS[t.school].cost ? ` ${money(TRAINING_SCHOOLS[t.school].cost)} a year.` : ""}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {run("engagement", `🎗️ Take ${name} to an engagement`, "Uses a diary day. Duty +6, common touch +2.")}
        {run("ordinary", `🎈 A normal week for ${name}`, "Common touch +7, a little polish lost.")}
        {run("media", `🎤 Etiquette and media training`, "Polish +8. $15,000.")}
        {kid.age >= 18 && kid.age <= 24 && !t.service && (
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(BRANCHES) as ServiceBranch[]).map((b) => (
              <Button key={b} variant="secondary" className="text-xs" disabled={!!trainingBlocker(p, id, "service", b)} onClick={() => act((pl, rng) => trainChild(pl, rng, id, "service", b))}>{BRANCHES[b].emoji} {BRANCHES[b].name}</Button>
            ))}
          </div>
        )}
        {t.service && <div className="text-xs text-emerald-300">{BRANCHES[t.service].emoji} Steered towards the {BRANCHES[t.service].name}</div>}
        {kid.age >= 16 && !t.patron && (
          <div className="flex gap-2">
            <select value={cause} onChange={(e) => setCause(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-2 py-2 text-xs" aria-label="Choose a cause">
              {PATRONAGES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <Button variant="secondary" className="shrink-0 text-xs" disabled={!!trainingBlocker(p, id, "patron", cause)} onClick={() => act((pl, rng) => trainChild(pl, rng, id, "patron", cause))}>Suggest</Button>
          </div>
        )}
        {t.patron && <div className="text-xs text-emerald-300">{PATRONAGE_BY_ID[t.patron].emoji} Patron of the {PATRONAGE_BY_ID[t.patron].name}</div>}
      </div>
    </Card>
  );
}

function Family() {
  const { player: p } = useGame();
  const kids = royalChildren(p);
  const spouse = p.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus === "married");
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="font-semibold">Succession</div>
        <p className="mt-1 text-sm text-slate-400">
          {isSovereign(p) ? "You are the sovereign." : p.royal?.crown === "abdicated" ? "You abdicated; your heir reigns." : p.royal ? (p.royal.line === 1 ? "You are the heir to the throne." : `You are number ${p.royal.line} in line.`) : ""}
          {spouse ? ` Married to ${spouse.name}${spouse.royalTitle ? ` (${spouse.royalTitle})` : ""}.` : " Unmarried. Marrying in the first six in line needs the sovereign's consent, and a commoner brings popularity and press intrusion."}
        </p>
        <p className="mt-1 text-xs text-slate-500">Your children are Princes or Princesses only if they are the sovereign's children or grandchildren. Otherwise they are Lord or Lady. A divorce strips a spouse of HRH and costs a settlement.</p>
      </Card>
      <SectionTitle>Raising the next generation</SectionTitle>
      {kids.length === 0 ? (
        <Card className="text-sm text-slate-400">No royal children yet. Duty, common touch and polish decide how popular they are when they inherit, and which patronages and service they carry into their reign.</Card>
      ) : kids.map((k) => <ChildCard key={k.id} id={k.id} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finances
// ---------------------------------------------------------------------------

function Finances() {
  const { player: p, act } = useGame();
  const sov = isSovereign(p);
  const fin = royalFinance(p);
  const net = fin.lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>This year's funding</SectionTitle>
      <Card className="flex flex-col gap-1.5">
        {fin.lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3 text-sm">
            <span className="text-slate-300">{l.label}</span>
            <span className={`tabular-nums ${l.amount < 0 ? "text-rose-300" : "text-emerald-300"}`}>{l.amount < 0 ? "-" : "+"}{money(Math.abs(l.amount))}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-slate-700 pt-1.5 text-sm font-semibold">
          <span>Before tax</span>
          <span className="tabular-nums">{net < 0 ? "-" : ""}{money(Math.abs(net))}</span>
        </div>
      </Card>
      <p className="text-xs text-slate-500">
        {sov
          ? "The Sovereign Grant pays for official duties and tracks the national mood: popular monarchs and booms get more, unpopular ones and recessions less. The duchy and private estates are your own money, taxed. Funding reviews can raise or cut the grant."
          : p.royal?.line === 1 && p.royal.crown !== "abdicated"
            ? "The heir lives on the duchy's private income. It is taxed; nobody votes on it."
            : "Younger royals get an allowance from the sovereign's private purse, and only while they work. A light diary means a smaller cheque."}
        {" "}Staff and estate upkeep come out of your own pocket.
      </p>
      {sov && (
        <ActionButton
          label={p.court.estateOpen ? "🏰 Close the estate to visitors" : "🏰 Open the private estate to visitors"}
          hint={p.court.estateOpen ? "Quiet returns; you lose the ticket income." : "+$350,000 income (−$80,000 upkeep), approval +3, a little privacy lost."}
          onClick={() => act((pl) => toggleEstate(pl))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// After leaving royal life
// ---------------------------------------------------------------------------

export function FormerRoyalCard() {
  const { player: p, act } = useGame();
  if (!p.court.steppedBack) return null;
  const told = p.flags.includes("royal_tell_all");
  return (
    <Card className="border-purple-500/40">
      <div className="font-semibold">🚪 Former working royal</div>
      <p className="mt-1 text-xs text-slate-400">
        You left royal life. You keep your name and your fortune and may work freely, but the allowance and security are gone, and the press still follows you. Public approval of you is {Math.round(p.court.approval)}.
      </p>
      <ActionButton className="mt-2" label="📺 Sell your story (interview and memoir)" hint="A huge payday and fame, at a heavy cost in family goodwill and public sympathy." reason={told ? "You've already told your side of the story." : null} onClick={() => act((pl, rng) => tellAll(pl, rng))} />
    </Card>
  );
}

