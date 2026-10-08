"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  CAREER_LINES,
  DECREES,
  PROGRAMS,
  UNIVERSITY_MAJORS,
} from "@/data/careersRegistry";
import {
  applyForJob,
  askForRaise,
  dropOut,
  enrollCertificate,
  enrollProgram,
  executeCitizen,
  goFullTime,
  goPartTime,
  pensionFor,
  holdGala,
  jobEligibility,
  passDecree,
  quitJob,
  retire,
  startingTier,
  studyHarder,
  workHarder,
} from "@/engine/career";
import { isRoyal } from "@/engine/state";
import { royalStyleText } from "@/engine/royalty";
import { EFFORT_INFO, hasCommitment } from "@/engine/occupation";
import { CERTIFICATES, CERT_BY_ID } from "@/data/certificates";
import { money } from "@/lib/format";
import { Button, Card, Pill, Segmented, SectionTitle, StatBar, TooYoung } from "./ui";
import { MovieStarSection } from "./career/MovieStarSection";
import { MusicSection } from "./career/MusicSection";
import { CourtSection, FormerRoyalCard } from "./career/CourtSection";
import { AdultWorkSection, AthleteSection, BusinessSection, InfluencerSection, PoliticsSection, SpySection, UnderworldSection } from "./CareerPaths";

type Section = "work" | "school" | "business" | "sports" | "online" | "politics" | "underworld" | "spy" | "adult" | "stardom" | "music";

export default function CareerTab() {
  const { player: p } = useGame();
  const royal = isRoyal(p);
  const [section, setSection] = useState<Section>(royal ? "work" : p.education.stage !== "None" && !p.currentJob ? "school" : "work");

  if (p.age < 5) return <TooYoung>No career yet — your job is to nap, eat, and be adorable.</TooYoung>;
  const options: { id: Section; label: string }[] = [
    { id: "work", label: royal ? "👑 Royal Duties" : "💼 Work" },
    { id: "school", label: "🎓 Academics" },
    ...(royal ? [] : [{ id: "business" as const, label: "🏢 Business" }, { id: "sports" as const, label: "🏅 Athlete" }]),
    { id: "online", label: "📱 Influencer" },
    ...(royal ? [] : [{ id: "politics" as const, label: "🏛️ Politics" }, { id: "underworld" as const, label: "🕴️ Underworld" }, { id: "spy" as const, label: "🕵️ Agent" }, ...(p.matureContent && p.age >= 18 ? [{ id: "adult" as const, label: "🔞 Adult Work" }] : [])]),
    ...(royal ? [] : [{ id: "stardom" as const, label: "🎬 Movie Star" }]),
    { id: "music", label: "🎸 Rock Star" },
  ];
  return (
    <div>
      <EffortCard />
      <Segmented<Section> value={section} onChange={setSection} options={options} />
      {section === "work" && (royal ? <RoyalDuties /> : <CorporateCareer />)}
      {section === "school" && <Academics />}
      {section === "business" && <BusinessSection />}
      {section === "sports" && <AthleteSection />}
      {section === "online" && <InfluencerSection />}
      {section === "politics" && <PoliticsSection />}
      {section === "underworld" && <UnderworldSection />}
      {section === "spy" && <SpySection />}
      {section === "adult" && <AdultWorkSection />}
      {section === "stardom" && <MovieStarSection />}
      {section === "music" && <MusicSection />}
    </div>
  );
}

function EffortCard() {
  const { player: p, act } = useGame();
  if (!hasCommitment(p) || p.age < 14) return null;
  const e = p.effort;
  return (
    <div className="mb-3 rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold">How hard are you pushing?</span>
        <span className="text-xs text-slate-500">applies to work, study, business</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(EFFORT_INFO) as (keyof typeof EFFORT_INFO)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => act((pl) => ({ player: { ...pl, effort: k } }))}
            className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${e === k ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            {EFFORT_INFO[k].emoji} {EFFORT_INFO[k].label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{EFFORT_INFO[e].blurb}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academics
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<string, string> = {
  None: "Not enrolled",
  Masters: "Graduate School",
  Primary: "Primary School",
  HighSchool: "High School",
  University: "University",
  MedicalSchool: "Medical School",
  LawSchool: "Law School",
  Certificate: "Vocational Course",
};

function Academics() {
  const { player: p, act } = useGame();
  const e = p.education;
  const [major, setMajor] = useState<string>(UNIVERSITY_MAJORS[0].id);
  const enrolled = e.stage !== "None";
  const studied = (p.annual.study ?? 0) >= 1;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Education</SectionTitle>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">{STAGE_LABEL[e.stage]}</div>
            {enrolled && (
              <div className="text-sm text-slate-400">
                {e.yearsLeft} year{e.yearsLeft === 1 ? "" : "s"} left{e.major ? ` · ${UNIVERSITY_MAJORS.find((m) => m.id === e.major)?.name ?? CERT_BY_ID[e.major]?.name ?? ""}` : ""}{(e.scholarship ?? 0) > 0 ? ` · ${Math.round((e.scholarship ?? 0) * 100)}% scholarship (keep grades 70+)` : ""}
              </div>
            )}
          </div>
          <span className="text-3xl">🎓</span>
        </div>
        {enrolled && (
          <>
            <div className="mt-3">
              <StatBar label="Grades" value={e.grades} color="blue" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => act((pl) => studyHarder(pl))} disabled={studied}>
                📖 {studied ? "Studied" : "Study Harder"}
              </Button>
              <Button variant="ghost" onClick={() => act((pl) => dropOut(pl))} disabled={p.age < 16 || e.stage === "Primary"}>
                Drop Out
              </Button>
            </div>
          </>
        )}
        {e.degrees.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.degrees.map((d) => (
              <Pill key={d} tone="green">
                {d === "highschool" ? "High School Diploma" : d === "md" ? "Medical Degree" : d === "jd" ? "Law Degree" : d === "masters" ? "Master\'s Degree" : d.startsWith("cert:") ? (CERT_BY_ID[d.slice(5)]?.name ?? d) : `BA/BS ${UNIVERSITY_MAJORS.find((m) => m.id === d.slice(9))?.name ?? ""}`}
              </Pill>
            ))}
          </div>
        )}
      </Card>

      {!enrolled && (
        <>
          <SectionTitle>Continue Your Studies</SectionTitle>
          <Card>
            <div className="mb-1 font-semibold">🏛️ University</div>
            <p className="mb-2 text-xs text-slate-400">4 years · {money(PROGRAMS.University.tuition)}/yr · needs a high school diploma & {PROGRAMS.University.minSmarts}+ Smarts. Unaffordable tuition becomes student debt.</p>
            <select
              value={major}
              onChange={(ev) => setMajor(ev.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              aria-label="Choose a major"
            >
              {UNIVERSITY_MAJORS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "University", major, rng))}>
              Apply
            </Button>
          </Card>
          <Card>
            <div className="mb-1 font-semibold">🎓 Graduate School</div>
            <p className="mb-2 text-xs text-slate-400">2 years · {money(PROGRAMS.Masters.tuition)}/yr · needs a Bachelor's & {PROGRAMS.Masters.minSmarts}+ Smarts. Opens academia, psychology and consulting.</p>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "Masters", null, rng))}>Apply</Button>
          </Card>
          <Card>
            <div className="mb-1 font-semibold">⚕️ Medical School</div>
            <p className="mb-2 text-xs text-slate-400">4 years · {money(PROGRAMS.MedicalSchool.tuition)}/yr · needs a Bachelor's & {PROGRAMS.MedicalSchool.minSmarts}+ Smarts.</p>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "MedicalSchool", null, rng))}>Apply</Button>
          </Card>
          <Card>
            <div className="mb-1 font-semibold">⚖️ Law School</div>
            <p className="mb-2 text-xs text-slate-400">3 years · {money(PROGRAMS.LawSchool.tuition)}/yr · needs a Bachelor's & {PROGRAMS.LawSchool.minSmarts}+ Smarts.</p>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "LawSchool", null, rng))}>Apply</Button>
          </Card>
          <SectionTitle hint="fit around a full-time job">Vocational Courses</SectionTitle>
          {CERTIFICATES.map((c) => (
            <Card key={c.id}>
              <div className="mb-1 font-semibold">{c.emoji} {c.name}</div>
              <p className="mb-2 text-xs text-slate-400">{c.years} year{c.years > 1 ? "s" : ""} · {money(c.tuition)}/yr · {c.minSmarts}+ Smarts. {c.blurb}</p>
              <Button variant="secondary" className="w-full" disabled={e.degrees.includes(`cert:${c.id}`)} onClick={() => act((pl, rng) => enrollCertificate(pl, c.id, rng))}>
                {e.degrees.includes(`cert:${c.id}`) ? "✓ Qualified" : "Enrol"}
              </Button>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corporate career
// ---------------------------------------------------------------------------

function JobBoard() {
  const { player: p, act } = useGame();
  return (
    <div className="flex flex-col gap-2">
      {CAREER_LINES.filter((l) => !l.pack).map((line) => {
        const elig = jobEligibility(p, line);
        const applied = (p.annual[`apply:${line.id}`] ?? 0) >= 1;
        const exp = p.careerYears[line.id] ?? 0;
        const tier = startingTier(p, line);
        return (
          <div key={line.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{line.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{line.ladder[tier].title}</div>
                <div className="text-xs text-slate-400">{line.name} · {money(line.ladder[tier].salary)}/yr → {money(line.ladder[line.ladder.length - 1].salary)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Needs {line.requirements.degrees?.length ? "degree, " : ""}{line.requirements.minSmarts}+ Smarts{line.requirements.minLooks ? `, ${line.requirements.minLooks}+ Looks` : ""}, age {line.minAge}+
                </div>
                {exp >= 1 && <div className="mt-1 text-xs text-emerald-300">🧰 {Math.round(exp)} yrs experience{tier > 0 ? ": you'd skip entry level" : ""}</div>}
                {!elig.ok && <div className="mt-1 text-xs font-medium text-rose-300">🔒 {elig.reason}</div>}
                {elig.ok && elig.partTime && <div className="mt-1 text-xs font-medium text-sky-300">⏱️ Part-time while you study (about {money(Math.round(line.ladder[tier].salary * 0.45))}/yr)</div>}
                {elig.ok && elig.switching && <div className="mt-1 text-xs font-medium text-amber-300">↔️ You'd leave your current job. Failed interviews can get back to your boss.</div>}
              </div>
              <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={!elig.ok || applied} onClick={() => act((pl, rng) => applyForJob(pl, line.id, rng))}>
                {applied ? "Applied" : "Apply"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CorporateCareer() {
  const { player: p, act } = useGame();
  const job = p.currentJob;
  const experience = Object.entries(p.careerYears).filter(([, y]) => y >= 1).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-3">
      <FormerRoyalCard />
      {job ? (
        <>
          <SectionTitle>Current Job</SectionTitle>
          <Card>
            <div className="text-lg font-bold">{job.title}{job.partTime ? " (part-time)" : ""}</div>
            <div className="text-sm text-slate-400">{job.company} · {Math.round(p.stats.yearsWorked)} years worked in total</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-300">{money(job.salary)}<span className="text-sm font-normal text-slate-400"> / year</span></div>
            <div className="mt-3">
              <StatBar label={job.partTime ? "Performance (no promotions while part-time)" : "Performance (85+ earns a promotion offer)"} value={job.performance} color="green" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => act((pl, rng) => workHarder(pl, rng))} disabled={(p.annual.work ?? 0) >= 1 || job.lineId === "athlete"}>
                💪 {(p.annual.work ?? 0) >= 1 ? "Pushed this year" : "Extra Push"}
              </Button>
              {!CAREER_LINES.find((l) => l.id === job.lineId)?.pack ? (
                <Button variant="secondary" onClick={() => act((pl, rng) => askForRaise(pl, rng))} disabled={(p.annual.raise ?? 0) >= 1}>
                  💵 {(p.annual.raise ?? 0) >= 1 ? "Asked already" : "Ask for a Raise"}
                </Button>
              ) : <span />}
              {job.lineId === "athlete" && <p className="col-span-2 text-xs text-slate-400">Your sports contract is managed from the Athlete tab: re-sign, transfer, retire or quit there.</p>}
              {!job.partTime && !CAREER_LINES.find((l) => l.id === job.lineId)?.pack && (
                <Button variant="secondary" onClick={() => act((pl) => goPartTime(pl))}>⏱️ Go Part-Time</Button>
              )}
              {job.partTime && (
                <Button variant="secondary" onClick={() => act((pl) => goFullTime(pl))}>⏱️ Go Full-Time</Button>
              )}
              <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))} disabled={job.lineId === "athlete"}>Quit Job</Button>
              {p.age >= 60 && (
                <Button variant="gold" className="col-span-2" onClick={() => act((pl) => retire(pl))}>🏖️ Retire (pension ≈ {money(pensionFor(p))}/yr)</Button>
              )}
            </div>
          </Card>
        </>
      ) : (
        <>
          {p.pension > 0 ? (
            <Card>
              <div className="font-semibold">🏖️ Retired</div>
              <div className="text-sm text-slate-400">Pension: {money(p.pension)} / year</div>
            </Card>
          ) : p.age >= 60 ? (
            <Button variant="gold" onClick={() => act((pl) => retire(pl))}>🏖️ Retire (pension ≈ {money(pensionFor(p))}/yr)</Button>
          ) : null}
        </>
      )}
      {experience.length > 0 && (
        <Card className="p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Your experience</div>
          <div className="flex flex-wrap gap-1.5">
            {experience.map(([id, y]) => (
              <Pill key={id} tone="blue">{CAREER_LINES.find((l) => l.id === id)?.name ?? id}: {Math.round(y)} yrs</Pill>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Experience improves your hiring odds and lets you skip entry level in the same field.</p>
        </Card>
      )}
      {job ? (
        <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">🔍 Look for another job</summary>
          <div className="mt-3"><JobBoard /></div>
        </details>
      ) : (
        <>
          <SectionTitle hint="your experience counts">Job Board</SectionTitle>
          <JobBoard />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Royalty pack
// ---------------------------------------------------------------------------

function RoyalDuties() {
  const { player: p, act } = useGame();
  const used = (k: string) => (p.annual[k] ?? 0) >= 1;
  const sovereign = p.royal?.crown === "self" || p.royalRank === "King" || p.royalRank === "Queen";
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{sovereign ? "Royal Duties" : "Royal Engagements"}</SectionTitle>
      <Card className="border-purple-500/40 bg-gradient-to-br from-purple-950/60 to-slate-800/70">
        <div className="text-xs uppercase tracking-wider text-purple-300">{p.birthCountry}</div>
        <div className="text-2xl font-bold">{royalStyleText(p) || p.royalRank}{p.court.regnalName && sovereign ? "" : ` ${p.firstName}`}</div>
        {p.royal && !sovereign && (
          <div className="mt-1 text-sm text-slate-300">
            {p.royal.line === 1 ? "Heir to the throne" : `Number ${p.royal.line} in the line of succession`}
            {p.royal.peerage ? ` · ${p.royal.peerage}` : ""}
          </div>
        )}
        <div className="mt-3">
          <StatBar label="Royal Respect (0 means a coup)" value={p.royalRespect} color="purple" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-slate-400">Economy</div><div className="text-base font-bold">{p.nation.economy}</div></div>
          <div><div className="text-slate-400">Freedom</div><div className="text-base font-bold">{p.nation.freedom}</div></div>
          <div><div className="text-slate-400">Military</div><div className="text-base font-bold">{p.nation.military}</div></div>
        </div>
      </Card>

      <CourtSection />

      <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">⚖️ Royal prerogative (galas{sovereign ? ", decrees, executions" : ""})</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Button variant="gold" onClick={() => act((pl) => holdGala(pl))} disabled={used("gala")}>
            🎉 {sovereign ? "Hold a Public Gala (−$100,000, +10 Respect)" : "Host a Charity Gala (−$100,000, +10 Respect)"}
          </Button>
          {p.court.mourning > 0 && <p className="text-xs text-amber-300">The nation is in mourning: a gala now would be tone-deaf.</p>}
          {sovereign && !p.court.regency ? (
            <>
              <p className="text-xs text-slate-500">A modern constitutional monarch does not rule by decree. These powers still exist in this realm, but ministers resent them: each decree adds constitutional strain, and an execution is a catastrophe for approval.</p>
              <Button variant="danger" onClick={() => act((pl, rng) => executeCitizen(pl, rng))} disabled={used("exec")}>
                🪓 Execute a Citizen (Karma → 0, −30 Respect, −25 approval)
              </Button>

              <SectionTitle hint="one per year">Pass a Decree</SectionTitle>
              <div className="flex flex-col gap-2">
                {DECREES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={used("decree")}
                    onClick={() => act((pl) => passDecree(pl, d.id))}
                    className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-purple-400/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-slate-400">{d.blurb}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Respect {d.respect >= 0 ? "+" : ""}{d.respect} · strain +8
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Only the reigning sovereign sets policy.</p>
          )}
        </div>
      </details>
      <p className="text-xs text-slate-500">Royals can't hold ordinary jobs. Funding comes from the Sovereign Grant, a duchy or an allowance: see the Finances tab.</p>
    </div>
  );
}
