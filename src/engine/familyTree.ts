/**
 * The family tree and line of succession as plain data, for the Family view. Pure: reads the player's state.
 *
 * Layers, top to bottom: earlier generations of your own line (the chronicle), the elders who raised you,
 * your own generation (partner, siblings), their children, and your children and grandchildren.
 */
import type { GenerationRecord, PlayerState, Relation, Relative } from "@/types/game.types";
import { royalChain, royalStyleText, sovereignOf, successionOrder } from "./royalty";
import { dynastyScore, dynastyTier } from "./dynasty";
import { hydrateDynasty } from "./dynastyState";

export interface TreeNode {
  id: string;
  name: string;
  label: string;
  relation: Relation | "You";
  age: number;
  alive: boolean;
  gender: string;
  /** Royal style, if any. */
  title?: string;
  /** One line of what they did or are doing. */
  note?: string;
  tags: string[];
  parentId?: string;
  wealth?: number;
}

export interface SuccessionEntry {
  id: string;
  name: string;
  /** Position among the living (1 = next in line). */
  place: number;
  you: boolean;
  label: string;
  age: number;
  title?: string;
}

export interface FamilyTree {
  chronicle: GenerationRecord[];
  elders: TreeNode[];
  you: TreeNode;
  partner: TreeNode | null;
  siblings: TreeNode[];
  nephews: TreeNode[];
  children: TreeNode[];
  grandchildren: TreeNode[];
  succession: { sovereign: string | null; line: SuccessionEntry[]; note: string } | null;
  standing: { score: number; tier: string; blurb: string; generation: number };
}

const isSovTitle = (t?: string) => t === "King" || t === "Queen";

/** "Father", "Stepmother", "Great-grandmother", "Niece"... */
export function relationLabel(r: Relative): string {
  const f = r.gender === "Female";
  const m = r.gender === "Male";
  if (r.relation === "Partner") return r.partnerStatus === "married" ? (f ? "Wife" : m ? "Husband" : "Spouse") : "Partner";
  if (r.relation === "Lover") return r.partnerStatus === "affair" ? "Secret lover" : "Fling";
  if (r.relation === "Pet") return r.species === "cat" ? "Cat" : "Dog";
  if (r.relation === "Parent") {
    const word = f ? "Mother" : m ? "Father" : "Parent";
    return r.traits?.includes("Step-parent") ? `Step${word.toLowerCase()}` : word;
  }
  if (r.relation === "Sibling") return f ? "Sister" : m ? "Brother" : "Sibling";
  if (r.relation === "Child") return f ? "Daughter" : m ? "Son" : "Child";
  if (r.relation === "Grandparent") {
    const word = f ? "grandmother" : "grandfather";
    return r.traits?.includes("Great-grandparent") ? `Great-${word}` : word.replace(/^./, (c) => c.toUpperCase());
  }
  if (r.relation === "Grandchild") return "Grandchild";
  if (r.relation === "Nephew") return f ? "Niece" : m ? "Nephew" : "Niece or nephew";
  return r.relation;
}

function node(r: Relative): TreeNode {
  const tags: string[] = [];
  if (r.groom) tags.push(`Raised for ${r.groom.track} ${r.groom.level}/100`);
  if (r.relation === "Child" && r.alive && r.age < 18) tags.push("Minor");
  if (r.willHeirId === "self") tags.push("Named you heir");
  if (r.traits?.includes("In prison")) tags.push("In prison");
  if (r.traits?.includes("On the run")) tags.push("On the run");
  const note = r.legacyNote ? `${r.occupation ?? ""}${r.occupation ? ": " : ""}${r.legacyNote}` : r.occupation;
  return {
    id: r.id,
    name: r.name,
    label: relationLabel(r),
    relation: r.relation,
    age: r.alive ? r.age : r.deathAge ?? r.age,
    alive: r.alive,
    gender: r.gender,
    title: r.royalTitle,
    note: note || undefined,
    tags,
    parentId: r.parentId,
    wealth: r.wealth,
  };
}

const byAge = (a: Relative, b: Relative) => b.age - a.age;

function succession(p: PlayerState): FamilyTree["succession"] {
  const r = p.royal;
  if (!r) return null;
  const year = p.year;
  const kids = p.relatives.filter((x) => x.relation === "Child");
  const grandkids = p.relatives.filter((x) => x.relation === "Grandchild" && x.parentId);
  const sibs = p.relatives.filter((x) => x.relation === "Sibling" && x.royalTitle);
  const nephews = p.relatives.filter((x) => x.relation === "Nephew" && x.parentId);
  const me: Relative = {
    id: "__me", relation: "Sibling", name: `${p.firstName} ${p.lastName}`, age: p.age, relationshipBar: 0, health: 0, alive: true, incomeTier: 0, gender: p.gender, smarts: 0, looks: 0,
    royalTitle: royalStyleText(p) || undefined,
  };
  // Your own children stand directly behind you, so they count as your descendants in the same ordering.
  const myKids = kids.map((k) => ({ ...k, parentId: "__me" }));
  const grandOfMine = grandkids.map((g) => g);
  let sovereign: string | null = null;
  let order: Relative[] = [];
  let note = "";
  const sov = sovereignOf(p);

  if (r.crown === "self") {
    sovereign = `${royalStyleText(p) || "You"} (you)`;
    order = [...successionOrder(kids, grandOfMine, year), ...successionOrder(sibs, nephews, year)];
    note = "You reign. The crown follows birth order through your children, then your brothers and sisters.";
  } else if (r.crown === "parent" && sov) {
    sovereign = `${sov.royalTitle} ${sov.name}`;
    order = successionOrder([me, ...sibs], [...nephews, ...myKids, ...grandOfMine], year);
    note = "Absolute primogeniture: each child of the sovereign is followed by their own children before the next sibling.";
  } else if (r.crown === "grandparent" && sov) {
    sovereign = `${sov.royalTitle} ${sov.name}`;
    const chain = royalChain(p).filter((c) => c.alive).sort((a, b) => (a.royalLine ?? 0) - (b.royalLine ?? 0));
    order = [...chain, ...successionOrder([me, ...sibs], [...nephews, ...myKids, ...grandOfMine], year)];
    note = "Your parent (and any royal ancestors between you and the crown) stand ahead of you.";
  } else if (r.crown === "sibling") {
    const sibSov = p.relatives.find((x) => x.relation === "Sibling" && x.alive && isSovTitle(x.royalTitle));
    sovereign = sibSov ? `${sibSov.royalTitle} ${sibSov.name}` : null;
    const rest = sibs.filter((s) => s.id !== sibSov?.id);
    order = [...nephews.filter((n) => n.parentId === sibSov?.id).sort(byAge), ...successionOrder([me, ...rest], [...nephews.filter((n) => n.parentId !== sibSov?.id), ...myKids, ...grandOfMine], year)];
    note = "Your sibling reigns. Their children stand ahead of you, then the rest of the family in birth order.";
  } else {
    const other = p.relatives.find((x) => x.alive && isSovTitle(x.royalTitle));
    sovereign = other ? `${other.royalTitle} ${other.name}` : null;
    order = successionOrder([me, ...sibs], [...nephews, ...myKids, ...grandOfMine], year);
    note = "The crown sits with another branch of the family, so only your own branch is shown here.";
  }

  const living = order.filter((x) => x.alive);
  const line: SuccessionEntry[] = living.map((x, i) => {
    const you = x.id === "__me";
    const isMyKid = x.relation === "Child" || (x.parentId === "__me");
    return {
      id: x.id,
      name: you ? `${p.firstName} ${p.lastName}` : x.name,
      place: i + 1,
      you,
      label: you ? "You" : isMyKid ? (x.gender === "Female" ? "Your daughter" : "Your son") : relationLabel(x),
      age: x.age,
      title: x.royalTitle,
    };
  });
  return { sovereign, line: line.slice(0, 14), note };
}

export function buildFamilyTree(p: PlayerState): FamilyTree {
  const d = hydrateDynasty(p);
  const rel = p.relatives;
  const elders = [
    ...rel.filter((r) => r.relation === "Grandparent").sort(byAge),
    ...rel.filter((r) => r.relation === "Parent").sort((a, b) => Number(b.alive) - Number(a.alive) || b.age - a.age),
  ].map(node);
  const partner = rel.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");
  const you: TreeNode = {
    id: "__you",
    name: `${p.firstName} ${p.lastName}`,
    label: "You",
    relation: "You",
    age: p.age,
    alive: p.alive,
    gender: p.gender,
    title: p.royal ? royalStyleText(p) || undefined : undefined,
    note: p.currentJob?.title ?? (p.business ? `Owner, ${p.business.name}` : undefined),
    tags: [`Generation ${p.generation}`],
  };
  const score = dynastyScore(p);
  const [, tier, blurb] = dynastyTier(score);
  return {
    chronicle: d.chronicle,
    elders,
    you,
    partner: partner ? node(partner) : null,
    siblings: rel.filter((r) => r.relation === "Sibling").sort(byAge).map(node),
    nephews: rel.filter((r) => r.relation === "Nephew").sort(byAge).map(node),
    children: rel.filter((r) => r.relation === "Child").sort(byAge).map(node),
    grandchildren: rel.filter((r) => r.relation === "Grandchild").sort(byAge).map(node),
    succession: succession(p),
    standing: { score, tier, blurb, generation: p.generation },
  };
}
