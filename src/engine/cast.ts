/**
 * Picks the specific person an event is about ("the teenager", "your best friend", "your ex") so event
 * text and event effects always agree on who that is.
 */
import type { PlayerState, Relative } from "@/types/game.types";

const alive = (r: Relative) => r.alive && r.partnerStatus !== "ex";
const kids = (p: PlayerState) => p.relatives.filter((r) => r.relation === "Child" && r.alive).sort((a, b) => b.age - a.age);

export const teenOf = (p: PlayerState): Relative | undefined => kids(p).find((k) => k.age >= 12 && k.age < 18);
export const littleOf = (p: PlayerState): Relative | undefined => kids(p).find((k) => k.age >= 3 && k.age < 12);
export const grownOf = (p: PlayerState): Relative | undefined => kids(p).find((k) => k.age >= 20);
export const bestFriendOf = (p: PlayerState): Relative | undefined =>
  p.relatives.filter((r) => r.relation === "Friend" && alive(r)).sort((a, b) => b.relationshipBar - a.relationshipBar)[0];
export const exOf = (p: PlayerState): Relative | undefined =>
  p.relatives.filter((r) => r.relation === "Partner" && r.partnerStatus === "ex" && r.alive).sort((a, b) => (b.lostYear ?? 0) - (a.lostYear ?? 0))[0];
export const coParentOf = (p: PlayerState): Relative | undefined => {
  const kid = kids(p).find((k) => k.age < 18 && k.custody);
  return kid ? p.relatives.find((r) => r.relation !== "Child" && r.partnerStatus === "ex" && r.alive && r.name === kid.otherParent) : undefined;
};
export const inLawOf = (p: PlayerState) => {
  const partner = p.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus === "married");
  return partner?.inLaws?.find((l) => l.alive);
};

const first = (r: { name: string } | undefined, fallback: string) => (r ? r.name.split(" ")[0] : fallback);

/** {teen} {kid} {grownchild} {bestie} {ex} {coparent} {inlaw} */
export function fillFamilyTokens(text: string, p: PlayerState): string {
  if (!text.includes("{")) return text;
  return text
    .replaceAll("{teen}", first(teenOf(p), "your teenager"))
    .replaceAll("{kid}", first(littleOf(p), "your little one"))
    .replaceAll("{grownchild}", first(grownOf(p), "your grown child"))
    .replaceAll("{bestie}", first(bestFriendOf(p), "your friend"))
    .replaceAll("{ex}", first(exOf(p), "your ex"))
    .replaceAll("{coparent}", first(coParentOf(p), "your ex"))
    .replaceAll("{inlaw}", inLawOf(p) ? inLawOf(p)!.name.split(" ")[0] : "your in-law");
}
