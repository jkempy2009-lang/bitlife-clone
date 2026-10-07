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
  dropOut,
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
  studyHarder,
  workHarder,
} from "@/engine/career";
import { isRoyal } from "@/engine/state";
import { EFFORT_INFO, hasCommitment } from "@/engine/occupation";
import { money } from "@/lib/format";
import { Button, Card, Pill, Segmented, SectionTitle, StatBar, TooYoung } from "./ui";
import { MovieStarSection } from "./career/MovieStarSection";
import { MusicSection } from "./career/MusicSection";
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
                {e.yearsLeft} year{e.yearsLeft === 1 ? "" : "s"} left{e.major ? ` · ${UNIVERSITY_MAJORS.find((m) => m.id === e.major)?.name}` : ""}
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
                {d === "highschool" ? "High School Diploma" : d === "md" ? "Medical Degree" : d === "jd" ? "Law Degree" : d === "masters" ? "Master\'s Degree" : `BA/BS ${UNIVERSITY_MAJORS.find((m) => m.id === d.slice(9))?.name ?? ""}`}
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
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corporate career
// ---------------------------------------------------------------------------

function CorporateCareer() {
  const { player: p, act } = useGame();
  const job = p.currentJob;

  return (
    <div className="flex flex-col gap-3">
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
                💪 {(p.annual.work ?? 0) >= 1 ? "Worked hard" : "Work Harder"}
              </Button>
              <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))} disabled={job.lineId === "athlete"}>Quit Job</Button>
              {job.lineId === "athlete" && <p className="col-span-2 text-xs text-slate-400">Your sports contract is managed from the Athlete tab: re-sign, transfer, retire or quit there.</p>}
              {!job.partTime && !CAREER_LINES.find((l) => l.id === job.lineId)?.pack && (
                <Button variant="secondary" onClick={() => act((pl) => goPartTime(pl))}>⏱️ Go Part-Time</Button>
              )}
              {job.partTime && (
                <Button variant="secondary" onClick={() => act((pl) => goFullTime(pl))}>⏱️ Go Full-Time</Button>
              )}
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
            <Button variant="gold" onClick={() => act((pl) => retire(pl))}>🏖️ Retire</Button>
          ) : null}
          <SectionTitle hint="entry-level postings">Job Board</SectionTitle>
          <div className="flex flex-col gap-2">
            {CAREER_LINES.filter((l) => !l.pack).map((line) => {
              const elig = jobEligibility(p, line);
              const applied = (p.annual[`apply:${line.id}`] ?? 0) >= 1;
              return (
                <div key={line.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{line.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{line.ladder[0].title}</div>
                      <div className="text-xs text-slate-400">{line.name} · {money(line.ladder[0].salary)}/yr → {money(line.ladder[line.ladder.length - 1].salary)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Needs {line.requirements.degrees?.length ? "degree, " : ""}{line.requirements.minSmarts}+ Smarts{line.requirements.minLooks ? `, ${line.requirements.minLooks}+ Looks` : ""}, age {line.minAge}+
                      </div>
                      {!elig.ok && <div className="mt-1 text-xs font-medium text-rose-300">🔒 {elig.reason}</div>}
                      {elig.ok && elig.partTime && <div className="mt-1 text-xs font-medium text-sky-300">⏱️ Part-time while you study (about {money(Math.round(line.ladder[0].salary * 0.45))}/yr)</div>}
                    </div>
                    <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={!elig.ok || applied} onClick={() => act((pl, rng) => applyForJob(pl, line.id, rng))}>
                      {applied ? "Applied" : "Apply"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Royal Duties</SectionTitle>
      <Card className="border-purple-500/40 bg-gradient-to-br from-purple-950/60 to-slate-800/70">
        <div className="text-xs uppercase tracking-wider text-purple-300">{p.birthCountry}</div>
        <div className="text-2xl font-bold">{p.royalRank} {p.firstName}</div>
        <div className="mt-3">
          <StatBar label="Royal Respect (0 means a coup)" value={p.royalRespect} color="purple" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-slate-400">Economy</div><div className="text-base font-bold">{p.nation.economy}</div></div>
          <div><div className="text-slate-400">Freedom</div><div className="text-base font-bold">{p.nation.freedom}</div></div>
          <div><div className="text-slate-400">Military</div><div className="text-base font-bold">{p.nation.military}</div></div>
        </div>
      </Card>

      <Button variant="gold" onClick={() => act((pl) => holdGala(pl))} disabled={used("gala")}>
        🎉 Hold a Public Gala (−$100,000, +10 Respect)
      </Button>
      <Button variant="danger" onClick={() => act((pl, rng) => executeCitizen(pl, rng))} disabled={used("exec")}>
        🪓 Execute a Citizen (Karma → 0, −30 Respect)
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
              Respect {d.respect >= 0 ? "+" : ""}{d.respect}
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Royals can't hold ordinary jobs. They receive a state allowance, tax-free.</p>
    </div>
  );
}

