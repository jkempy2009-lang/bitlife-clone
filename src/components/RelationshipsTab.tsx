"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import type { Relative } from "@/types/game.types";
import {
  ADOPTION_COST,
  INTERACTION_CAP,
  PET_COST,
  adoptChild,
  adoptPet,
  dateNight,
  interact,
  leavePartner,
  meetSomeone,
  propose,
  tryForBaby,
  type SocialAction,
} from "@/engine/social";
import {
  GETAWAY_COST,
  LOVE_CAP,
  SPICE_COST,
  SWINGER_COST,
  VENUES,
  askThreesome,
  endLover,
  hookUp,
  leaveForLover,
  makeLove,
  proposeOpenRelationship,
  romanticGetaway,
  seduce,
  spiceItUp,
  swingerClub,
} from "@/engine/intimacy";
import { EXPERIENCES, INTERESTS, INTEREST_BY_ID } from "@/data/experiences";
import { discussDesires, knownTastes, setIntimacyPrefs, shareExperience, toggleGender, toggleInterest } from "@/engine/desire";
import { adultRange } from "@/engine/people";
import { closeRelationship, type Intent } from "@/engine/intimacy";
import { money } from "@/lib/format";
import { spouseIncome } from "@/engine/household";
import { Button, Card, MiniBar, Pill, SectionTitle } from "./ui";

const RELATION_ORDER = ["Partner", "Lover", "Parent", "Child", "Grandchild", "Sibling", "Grandparent", "Friend", "Pet"] as const;
const ICONS: Record<string, string> = {
  Partner: "💞",
  Lover: "🔥",
  Parent: "👪",
  Child: "🧒",
  Sibling: "🧑‍🤝‍🧑",
  Friend: "🤝",
  Grandparent: "👵",
  Grandchild: "👶",
  Pet: "🐾",
};

function barColor(v: number) {
  return v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-400" : "bg-rose-500";
}

function label(r: Relative) {
  if (r.relation === "Partner") return r.partnerStatus === "married" ? "Spouse" : "Partner";
  if (r.relation === "Lover") return r.partnerStatus === "affair" ? "Secret lover" : "Fling";
  if (r.relation === "Pet") return r.species === "cat" ? "Cat" : "Dog";
  if (r.relation === "Parent") return r.gender === "Female" ? "Mother" : r.gender === "Male" ? "Father" : "Parent";
  if (r.relation === "Sibling") return r.gender === "Female" ? "Sister" : r.gender === "Male" ? "Brother" : "Sibling";
  if (r.relation === "Child") return r.gender === "Female" ? "Daughter" : r.gender === "Male" ? "Son" : "Child";
  if (r.relation === "Grandparent") return r.gender === "Female" ? "Grandmother" : "Grandfather";
  if (r.relation === "Grandchild") return "Grandchild";
  return r.relation;
}

export default function RelationshipsTab() {
  const { player: p, act } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [safe, setSafe] = useState(true);
  const [intent, setIntent] = useState<Intent>("casual");

  const living = p.relatives.filter((r) => r.alive && r.partnerStatus !== "ex");
  const past = p.relatives.filter((r) => !r.alive || r.partnerStatus === "ex");
  const selected = living.find((r) => r.id === selectedId) ?? null;
  const partner = living.find((r) => r.relation === "Partner");
  const mature = p.matureContent && p.age >= 18;

  if (selected) {
    return <InteractionPanel rel={selected} safe={safe} setSafe={setSafe} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {p.pregnancy && (
        <Card className="border-pink-500/40 bg-pink-950/20 p-3 text-sm text-pink-100">
          🤰 {p.pregnancy.carrier === "self" ? "You're" : "Your partner is"} expecting a baby. The birth is due when you next age up.
        </Card>
      )}
      <div>
        <SectionTitle hint={`${living.length} living`}>Family & Friends</SectionTitle>
        <div className="flex flex-col gap-2">
          {RELATION_ORDER.flatMap((rel) => living.filter((r) => r.relation === rel)).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-emerald-500/60 active:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{ICONS[r.relation]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{label(r)} · {r.age}</span>
                  </div>
                  <div className="mt-1.5">
                    <MiniBar value={r.relationshipBar} color={barColor(r.relationshipBar)} />
                  </div>
                </div>
              </div>
            </button>
          ))}
          {living.length === 0 && <Card><p className="text-sm text-slate-400">You're all alone in the world. Go meet someone!</p></Card>}
        </div>
      </div>

      <div>
        <SectionTitle>Meet People</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="col-span-2" onClick={() => act((pl, rng) => adoptChild(pl, rng))} disabled={p.age < 22}>
            🍼 Adopt a Child ({`$${ADOPTION_COST.toLocaleString()}`})
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => adoptPet(pl, "dog", rng))} disabled={p.age < 8}>
            🐶 Adopt a Dog (${PET_COST})
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => adoptPet(pl, "cat", rng))} disabled={p.age < 8}>
            🐱 Adopt a Cat (${PET_COST})
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => meetSomeone(pl, "friend", rng))} disabled={p.age < 4}>
            🤝 Make a Friend
          </Button>
          <Button variant="secondary" onClick={() => act((pl, rng) => meetSomeone(pl, "date", rng))} disabled={p.age < 16 || !!partner}>
            💘 Find Love
          </Button>
        </div>
      </div>

      {mature && <PreferencesCard />}

      {mature && (
        <div>
          <SectionTitle hint="18+ · consenting adults">Meet Someone</SectionTitle>
          <Card className="mb-2 p-3">
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {(["casual", "relationship"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIntent(k)}
                  className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${intent === k ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                >
                  {k === "casual" ? "🔥 Something casual" : "💞 Something real"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Use protection
            </label>
            <p className="mt-1 text-xs text-slate-500">Protection greatly lowers the chance of pregnancy and infections. Who you meet follows your Preferences above.</p>
            {partner && !p.flags.includes("open_relationship") && !p.flags.includes("polyamorous") && (
              <p className="mt-2 text-xs font-medium text-rose-300">⚠️ You have a partner, and this would be cheating. You might be caught.</p>
            )}
          </Card>
          <div className="flex flex-col gap-2">
            {VENUES.map((v) => {
              const locked = v.requires && !p.intimacy.interests.includes(v.requires) && !p.intimacy.interests.includes("kink");
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!!locked || p.bankBalance < v.cost}
                  onClick={() => act((pl, rng) => hookUp(pl, v.id, safe, rng, intent))}
                  className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-2.5 text-left transition-colors hover:border-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="text-2xl">{v.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{v.label}{v.cost ? ` · $${v.cost}` : ""}</span>
                    <span className="block text-xs text-slate-400">{v.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => act((pl, rng) => seduce(pl, "friend", safe, rng))}>🤝 A Friend</Button>
            <Button variant="secondary" onClick={() => act((pl, rng) => seduce(pl, "ex", safe, rng))}>💔 An Ex</Button>
            <Button variant="secondary" disabled={!p.currentJob} onClick={() => act((pl, rng) => seduce(pl, "coworker", safe, rng))}>💼 A Coworker</Button>
            <Button variant="secondary" disabled={!!partner && !p.flags.includes("open_relationship") && !p.flags.includes("polyamorous")} onClick={() => act((pl, rng) => swingerClub(pl, safe, rng))}>
              🪩 Swinger Club (${SWINGER_COST})
            </Button>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <details className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-400">In memory & past relationships ({past.length})</summary>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
            {past.map((r) => (
              <li key={r.id}>
                {r.alive ? "💔" : "🕯️"} {r.name} — {r.alive ? `Ex (${r.age})` : `${label(r)}, died at ${r.deathAge ?? r.age}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PreferencesCard() {
  const { player: p, act } = useGame();
  const prefs = p.intimacy;
  const [lo, hi] = adultRange(p);
  return (
    <details className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">💞 Preferences · ages {lo}–{hi}{prefs.genders.length ? ` · ${prefs.genders.join(", ")}` : ""}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Age range (adults only)</div>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={prefs.ageAuto} onChange={() => act((pl) => setIntimacyPrefs(pl, { ageAuto: !pl.intimacy.ageAuto }))} className="h-4 w-4 accent-emerald-500" />
            Around my own age
          </label>
          {!prefs.ageAuto && (
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <label>
                From
                <input type="number" min={18} max={99} value={prefs.ageMin} onChange={(e) => act((pl) => setIntimacyPrefs(pl, { ageMin: Number(e.target.value) || 18 }))} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100" />
              </label>
              <label>
                To
                <input type="number" min={18} max={99} value={prefs.ageMax} onChange={(e) => act((pl) => setIntimacyPrefs(pl, { ageMax: Number(e.target.value) || 60 }))} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100" />
              </label>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Everyone you meet is an adult, 18 or older. Nobody younger is ever generated.</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Who you're open to</div>
          <div className="flex flex-wrap gap-1.5">
            {["Male", "Female", "Non-binary"].map((g) => (
              <button key={g} type="button" onClick={() => act((pl) => toggleGender(pl, g))} className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${prefs.genders.includes(g) ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                {g === "Male" ? "Men" : g === "Female" ? "Women" : "Non-binary people"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{prefs.genders.length === 0 ? `Nothing chosen: following your sexuality (${p.sexuality}).` : "Choose as many as you like."}</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">What you're open to exploring</div>
          <div className="flex flex-col gap-1.5">
            {INTERESTS.map((i) => (
              <label key={i.id} className={`flex items-start gap-2 rounded-xl border p-2 text-sm transition-colors ${prefs.interests.includes(i.id) ? "border-emerald-500/60 bg-emerald-950/30" : "border-slate-700/60 bg-slate-900/40"}`}>
                <input type="checkbox" checked={prefs.interests.includes(i.id)} onChange={() => act((pl) => toggleInterest(pl, i.id))} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                <span>
                  <span className="font-semibold">{i.emoji} {i.label}</span>
                  <span className="block text-xs text-slate-400">{i.blurb}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">These only unlock the options for you. Whether someone else agrees is always their choice, and a no is a no.</p>
        </div>
      </div>
    </details>
  );
}

function ExperienceMenu({ rel, safe }: { rel: Relative; safe: boolean }) {
  const { player: p, act } = useGame();
  const known = knownTastes(rel);
  return (
    <>
      <SectionTitle hint="your interests unlock these">Share an Experience</SectionTitle>
      <div className="flex flex-col gap-2">
        {EXPERIENCES.filter((e) => !(e.partnerOnly && rel.relation !== "Partner")).map((e) => {
          const optedIn = p.intimacy.interests.includes(e.tag);
          const left = e.cap - (p.annual[`exp:${e.id}:${rel.id}`] ?? 0);
          const tooEarly = rel.relationshipBar < e.minBar;
          const taste = known.find((k) => k.tag === e.tag)?.taste;
          const why = !optedIn ? `Add “${INTEREST_BY_ID[e.tag].label}” to your preferences` : tooEarly ? `Needs relationship ${e.minBar}+` : left <= 0 ? "Done this year" : p.bankBalance < e.cost ? "Can't afford it" : "";
          return (
            <button
              key={e.id}
              type="button"
              disabled={!!why}
              onClick={() => act((pl, rng) => shareExperience(pl, rel.id, e.id, safe, rng))}
              className="flex items-start gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-2.5 text-left transition-colors hover:border-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="text-2xl">{e.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{e.label}{e.cost ? ` · ${money(e.cost)}` : ""}</span>
                <span className="block text-xs text-slate-400">{e.blurb}</span>
                {why ? <span className="mt-0.5 block text-xs font-medium text-amber-300">🔒 {why}</span> : taste === "like" ? <span className="mt-0.5 block text-xs font-medium text-emerald-300">💚 They've told you they love this</span> : taste === "limit" ? <span className="mt-0.5 block text-xs font-medium text-rose-300">⛔ A limit for them. They'll say no.</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <Button variant="secondary" onClick={() => act((pl) => discussDesires(pl, rel.id))} disabled={(p.annual[`talk:${rel.id}`] ?? 0) >= 1}>
        🗣️ Talk About Desires & Limits {(p.annual[`talk:${rel.id}`] ?? 0) >= 1 ? "(done this year)" : ""}
      </Button>
      {known.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {known.map((k) => (
            <Pill key={k.tag} tone={k.taste === "like" ? "green" : k.taste === "limit" ? "red" : "slate"}>
              {INTEREST_BY_ID[k.tag]?.emoji} {INTEREST_BY_ID[k.tag]?.label}: {k.taste === "like" ? "loves" : k.taste === "limit" ? "limit" : "open"}
            </Pill>
          ))}
        </div>
      )}
    </>
  );
}

function InteractionPanel({ rel, safe, setSafe, onBack }: { rel: Relative; safe: boolean; setSafe: (b: boolean) => void; onBack: () => void }) {
  const { player: p, act } = useGame();
  const used = p.annual[`rel:${rel.id}`] ?? 0;
  const capped = used >= INTERACTION_CAP;
  const run = (a: SocialAction) => act((pl, rng) => interact(pl, rel.id, a, rng));
  const canAsk = rel.relation === "Parent" && p.age < 22;
  const mature = p.matureContent && p.age >= 18 && rel.age >= 18;
  const open = p.flags.includes("open_relationship");
  const poly = p.flags.includes("polyamorous");
  const loveLeft = LOVE_CAP - (p.annual[`love:${rel.id}`] ?? 0);
  const isPet = rel.relation === "Pet";

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-sm font-medium text-emerald-400 hover:text-emerald-300">
        ← Back
      </button>
      <Card>
        <div className="flex items-center gap-3">
          <div className="text-4xl">{ICONS[rel.relation]}</div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{rel.name}</div>
            <div className="text-sm text-slate-400">{label(rel)} · {rel.age} years old{rel.occupation ? ` · ${rel.occupation}` : ""}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Relationship</span>
            <span className="tabular-nums">{Math.round(rel.relationshipBar)}</span>
          </div>
          <MiniBar value={rel.relationshipBar} color={barColor(rel.relationshipBar)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill>Health {Math.round(rel.health)}</Pill>
          {rel.relation === "Partner" && <Pill tone="blue">{rel.partnerStatus === "married" ? `Married${rel.marriedYear ? ` ${Math.max(0, p.year - rel.marriedYear)} yrs` : ""}` : "Dating"}</Pill>}
          {rel.relation === "Partner" && rel.partnerStatus === "married" && <Pill tone="green">Adds ≈{money(Math.round(spouseIncome(rel) * 0.75))}/yr</Pill>}
          {rel.relation === "Partner" && open && <Pill tone="amber">Open relationship</Pill>}
          {rel.relation === "Partner" && p.flags.includes("polyamorous") && <Pill tone="amber">Polyamorous</Pill>}
          {(rel.relation === "Partner" || rel.relation === "Lover" || rel.relation === "Friend") && rel.traits?.map((t) => <Pill key={t} tone="slate">{t}</Pill>)}
        </div>
      </Card>

      <SectionTitle hint={capped ? "Take a breather until next year" : `${INTERACTION_CAP - used} left this year`}>Interact</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => run("spend")} disabled={capped}>{isPet ? "🦴 Play" : "🕒 Spend Time"}</Button>
        {!isPet && <Button onClick={() => run("converse")} disabled={capped}>💬 Converse</Button>}
        <Button onClick={() => run("compliment")} disabled={capped}>{isPet ? "🥰 Good Pet!" : "🌸 Compliment"}</Button>
        <Button variant="danger" onClick={() => run("insult")}>{isPet ? "😠 Scold" : "😡 Insult"}</Button>
        {canAsk && (
          <Button variant="gold" className="col-span-2" onClick={() => run("askMoney")}>
            💵 Ask for Money
          </Button>
        )}
      </div>

      {rel.relation === "Partner" && (
        <>
          <SectionTitle>Together</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => act((pl) => dateNight(pl))}>🍷 Date Night ($100)</Button>
            <Button onClick={() => act((pl) => romanticGetaway(pl, rel.id))}>🏝️ Getaway (${GETAWAY_COST.toLocaleString()})</Button>
            <Button onClick={() => act((pl, rng) => tryForBaby(pl, rng))}>🍼 Try for a Baby</Button>
            {rel.partnerStatus === "dating" && (
              <Button variant="gold" onClick={() => act((pl, rng) => propose(pl, rng))}>💍 Propose</Button>
            )}
            <Button
              variant="danger"
              className={rel.partnerStatus === "dating" ? "col-span-2" : "col-span-2"}
              onClick={() => {
                act((pl) => leavePartner(pl));
                onBack();
              }}
            >
              {rel.partnerStatus === "married" ? "⚖️ Divorce (−30% cash)" : "💔 Break Up"}
            </Button>
          </div>
        </>
      )}

      {mature && (rel.relation === "Partner" || rel.relation === "Lover") && (
        <>
          <SectionTitle hint="18+ · consent matters">Intimacy</SectionTitle>
          <Card className="p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Use protection
            </label>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" className="col-span-2" disabled={loveLeft <= 0} onClick={() => act((pl, rng) => makeLove(pl, rel.id, safe, rng))}>
              ❤️‍🔥 Make Love {loveLeft <= 0 ? "(done this year)" : ""}
            </Button>
            {rel.relation === "Partner" && (
              <>
                <Button variant="secondary" onClick={() => act((pl, rng) => spiceItUp(pl, rel.id, rng))}>🎭 Spice It Up (${SPICE_COST})</Button>
                <Button variant="secondary" onClick={() => act((pl, rng) => askThreesome(pl, safe, rng))}>👥 Ask for a Threesome</Button>
                <Button variant="secondary" disabled={open || poly} onClick={() => act((pl, rng) => proposeOpenRelationship(pl, rng, "open"))}>
                  {open ? "🔓 Open" : "🔓 Propose Open"}
                </Button>
                <Button variant="secondary" disabled={poly} onClick={() => act((pl, rng) => proposeOpenRelationship(pl, rng, "poly"))}>
                  {poly ? "💞 Polyamorous" : "💞 Propose Polyamory"}
                </Button>
                {(open || poly) && (
                  <Button variant="ghost" className="col-span-2" onClick={() => act((pl) => closeRelationship(pl))}>🔒 Return to Exclusive</Button>
                )}
              </>
            )}
          </div>
          <ExperienceMenu rel={rel} safe={safe} />
          {rel.relation === "Partner" && (
            <p className="text-xs text-slate-500">Your partner's personality ({rel.traits?.join(", ") ?? "unknown"}) shapes how they'll react. Asking is always their choice, and no means no.</p>
          )}
        </>
      )}

      {rel.relation === "Lover" && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="gold" onClick={() => { act((pl, rng) => leaveForLover(pl, rel.id, rng)); onBack(); }}>💍 Make It Official</Button>
          <Button variant="ghost" onClick={() => { act((pl) => endLover(pl, rel.id)); onBack(); }}>End It</Button>
        </div>
      )}
    </div>
  );
}
