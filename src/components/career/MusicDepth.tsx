"use client";

import { useGame } from "@/context/GameStateContext";
import {
  REHAB_COST_MEMBER,
  buyBackMasters,
  leaveBand,
  payRaise,
  raiseCost,
  resolveDispute,
  reunite,
  sellCatalogue,
  sendToRehab,
  setSplit,
  shareCredit,
  talkToMember,
} from "@/engine/music";
import { TOUR_PACES } from "@/engine/musicCore";
import { supportPreview } from "@/engine/musicTour";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle } from "../ui";

const GRIEVANCE: Record<string, string> = { credit: "wants more credit", money: "wants more money", direction: "wants a different direction", habit: "is struggling with a habit" };

/** The people side of a band: talking, credit, money, rehab, how it splits, and what's left when it ends. */
export function BandDepth() {
  const { player: p, act } = useGame();
  const m = p.music;
  const fb = m.formerBand;
  return (
    <>
      {m.status === "band" && (
        <>
          <SectionTitle hint="keep them, or lose them">Band Management</SectionTitle>
          <div className="flex flex-col gap-2">
            {m.members.map((x) => (
              <Card key={x.id} className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{x.name}</span>
                  <span className="flex gap-1">
                    {x.trait && <Pill>{x.trait}</Pill>}
                    {x.grievance && <Pill tone="red">{GRIEVANCE[x.grievance] ?? x.grievance}</Pill>}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">Credit {Math.round(x.credit ?? 0)}% of songs · {x.years ?? 0} years in</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Button variant="secondary" className="px-1 py-1.5 text-xs" disabled={!!x.talked} onClick={() => act((pl, rng) => talkToMember(pl, rng, x.id))}>{x.talked ? "Talked this year" : "Talk it through"}</Button>
                  <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={() => act((pl) => shareCredit(pl, x.id))}>Share writing credit</Button>
                  <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={() => act((pl) => payRaise(pl, x.id))}>Pay a raise ({money(raiseCost(p))})</Button>
                  {x.grievance === "habit" || x.partier ? (
                    <Button variant="secondary" className="px-1 py-1.5 text-xs" onClick={() => act((pl, rng) => sendToRehab(pl, rng, x.id))}>Send to rehab ({money(REHAB_COST_MEMBER)})</Button>
                  ) : <span />}
                </div>
              </Card>
            ))}
            <Card className="p-3">
              <div className="mb-2 text-sm font-semibold">Money split</div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant={m.split === "equal" ? "primary" : "secondary"} className="py-1.5 text-xs" onClick={() => act((pl) => setSplit(pl, "equal"))}>Equal shares</Button>
                <Button variant={m.split === "writers" ? "primary" : "secondary"} className="py-1.5 text-xs" onClick={() => act((pl) => setSplit(pl, "writers"))}>By who wrote it</Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <Button variant="ghost" className="py-1.5 text-xs" onClick={() => act((pl, rng) => leaveBand(pl, rng, true))}>Go solo, on good terms</Button>
                <Button variant="ghost" className="py-1.5 text-xs" onClick={() => act((pl, rng) => leaveBand(pl, rng, false))}>Walk out in a rage</Button>
              </div>
            </Card>
          </div>
        </>
      )}
      {fb && m.status !== "band" && (
        <>
          <SectionTitle>Your Old Band</SectionTitle>
          <Card className="p-3">
            <p className="text-sm text-slate-300">{fb.name} split {fb.split === "bitter" ? "badly" : "amicably"} in {fb.year}.</p>
            <Button variant="secondary" className="mt-2 w-full py-1.5 text-xs" disabled={p.year - fb.year < 3} onClick={() => act((pl, rng) => reunite(pl, rng))}>🎸 Try a reunion</Button>
          </Card>
        </>
      )}
    </>
  );
}

/** Rights disputes and the value of your catalogue. */
export function RightsDepth() {
  const { player: p, act } = useGame();
  const m = p.music;
  const d = m.dispute;
  if (!d && m.albums.length === 0) return null;
  return (
    <>
      <SectionTitle>Rights and Catalogue</SectionTitle>
      <Card className="p-3">
        {d && (
          <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-950/20 p-2.5">
            <div className="text-sm font-semibold">Dispute: {d.kind} claim from {d.claimant}</div>
            <div className="text-xs text-slate-300">They want {money(d.amount)}. {d.yearsLeft} year{d.yearsLeft === 1 ? "" : "s"} until it goes to court.</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Button variant="secondary" className="py-1.5 text-xs" onClick={() => act((pl, rng) => resolveDispute(pl, rng, "settle"))}>Settle</Button>
              <Button variant="secondary" className="py-1.5 text-xs" onClick={() => act((pl, rng) => resolveDispute(pl, rng, "fight"))}>Fight it</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="secondary" className="py-1.5 text-xs" disabled={m.albums.length === 0} onClick={() => act((pl) => sellCatalogue(pl))}>Sell your catalogue</Button>
          <Button variant="secondary" className="py-1.5 text-xs" disabled={!m.catalogSold} onClick={() => act((pl) => buyBackMasters(pl))}>Buy back masters</Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Selling pays a lump sum now and stops the royalties. {m.catalogSold ? `You've taken ${money(m.catalogSold)} for rights so far.` : ""}</p>
      </Card>
    </>
  );
}

/** Choose how hard to tour, and whether to headline or open for someone bigger. */
export function TourSettings({ pace, setPace, mode, setMode }: { pace: string; setPace: (p: "light" | "standard" | "punishing") => void; mode: "headline" | "support"; setMode: (m: "headline" | "support") => void }) {
  const { player: p } = useGame();
  const prev = supportPreview(p, pace as never);
  return (
    <Card className="p-3">
      <div className="mb-1.5 grid grid-cols-3 gap-1.5">
        {TOUR_PACES.map((t) => (
          <Button key={t.id} variant={pace === t.id ? "primary" : "secondary"} className="px-1 py-1.5 text-xs" title={t.blurb} onClick={() => setPace(t.id)}>{t.label.split(" ")[0]}</Button>
        ))}
      </div>
      <p className="mb-2 text-xs text-slate-400">{TOUR_PACES.find((t) => t.id === pace)?.blurb}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant={mode === "headline" ? "primary" : "secondary"} className="py-1.5 text-xs" onClick={() => setMode("headline")}>Headline</Button>
        <Button variant={mode === "support" ? "primary" : "secondary"} className="py-1.5 text-xs" onClick={() => setMode("support")}>Open for a bigger act</Button>
      </div>
      {mode === "support" && <p className="mt-2 text-xs text-slate-400">About {prev.shows} shows in front of ~{prev.headliner.toLocaleString()} fans a night. You pay about {money(prev.fee)} to be on the bill, and win new fans.</p>}
    </Card>
  );
}
