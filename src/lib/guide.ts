import type { PlayerState, TabId } from "@/types/game.types";
import { getPartner } from "@/engine/state";
import { INTERACTION_CAP } from "@/engine/social";
import { suggestTips } from "./tips";

export type GuideKind = "urgent" | "chance" | "routine";

export interface GuideItem {
  id: string;
  emoji: string;
  title: string;
  /** One line on why, or what it does. */
  detail: string;
  kind: GuideKind;
  /** Higher sorts first. */
  priority: number;
  tab: TabId;
  /** Section chip to open inside the tab (see lib/nav.ts). */
  section?: string;
}

export interface LifeStage {
  label: string;
  blurb: string;
}

export function lifeStage(p: PlayerState): LifeStage {
  const a = p.age;
  if (a < 3) return { label: "Infant", blurb: "Nothing to decide yet. Your parents shape these years." };
  if (a < 6) return { label: "Little kid", blurb: "Play, learn and grow. School starts soon." };
  if (a < 13) return { label: "Child", blurb: "Schoolwork, friends and finding what you love." };
  if (a < 18) return { label: "Teenager", blurb: "Grades, first jobs, first loves and the choices that stick." };
  if (a < 30) return { label: "Young adult", blurb: "Build your career, your money and your people." };
  if (a < 50) return { label: "Adult", blurb: "Peak earning years. Family, wealth and health all need tending." };
  if (a < 65) return { label: "Midlife", blurb: "Consolidate, protect your health and plan the exit." };
  return { label: "Later life", blurb: "Health, family and what you leave behind." };
}

const done = (p: PlayerState, key: string) => (p.annual[key] ?? 0) >= 1;

/**
 * The most useful things to do right now, in order. Pure and cheap, so the Life tab can recompute it on every render.
 * Deliberately conservative: it only mentions actions that are available this year and that help the current state.
 */
export function yearGuide(p: PlayerState): GuideItem[] {
  if (!p.alive || p.isInPrison || p.pendingTrial) return [];
  const out: GuideItem[] = [];
  const add = (i: GuideItem) => out.push(i);
  const a = p.age;
  const studying = p.education.yearsLeft > 0 && p.education.stage !== "None";
  const partner = getPartner(p);
  const invested = Object.values(p.investments).reduce((s, h) => s + h.value, 0);
  const kids = p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age < 18);
  const rel = (r: { id: string }) => p.annual[`rel:${r.id}`] ?? 0;

  // ---- Urgent: things that get worse if ignored ----
  const sick = p.diseases.filter((d) => !done(p, `doctor:${d.id}`));
  if (sick.length > 0) {
    const fatal = sick.find((d) => d.severity === "fatal");
    add({
      id: "treat",
      emoji: "🩺",
      title: fatal ? `See a doctor about ${fatal.name}` : `Treat ${sick[0].name}`,
      detail: fatal ? "A fatal condition has a countdown. Treatment is your best chance." : "Untreated illness drains health and happiness every year.",
      kind: "urgent",
      priority: fatal ? 100 : 80,
      tab: "activities",
      section: "medical",
    });
  } else if (p.health < 45) {
    add({ id: "health-low", emoji: "❤️", title: "Your health is low", detail: "A check-up, the gym or a better diet will help.", kind: "urgent", priority: 78, tab: "activities", section: "wellness" });
  }
  const vice = (Object.entries(p.vices) as [string, number][]).sort((x, y) => y[1] - x[1])[0];
  if (vice && vice[1] >= 50) {
    add({ id: "vice", emoji: "🚬", title: `${vice[0][0].toUpperCase()}${vice[0].slice(1)} has a hold on you`, detail: "Try to quit or enter rehab before it costs more than money.", kind: "urgent", priority: 76, tab: "activities", section: "medical" });
  }
  if (p.bankBalance < 0) {
    add({ id: "overdrawn", emoji: "📉", title: "You're overdrawn", detail: p.currentJob ? "Ask for a raise or cut your living costs." : "You need income. Look for work.", kind: "urgent", priority: 90, tab: "career", section: "work" });
  }
  if (p.outstandingLoans > 0 && p.bankBalance > p.outstandingLoans * 1.2) {
    add({ id: "debt", emoji: "🏦", title: "Pay off your loan", detail: "You can clear it from savings and stop the interest.", kind: "chance", priority: 62, tab: "assets", section: "bank" });
  }
  if (p.happiness < 35) {
    add({ id: "mood", emoji: "🫂", title: "You're struggling emotionally", detail: "Therapy, a holiday, time with people you love, or a hobby.", kind: "urgent", priority: 74, tab: "activities", section: "leisure" });
  }

  // ---- Childhood ----
  if (a < 6) {
    add({ id: "tot", emoji: "🧸", title: "Just grow up for now", detail: "Tap Age Up. Events will come to you.", kind: "routine", priority: 10, tab: "dashboard" });
  }
  if (a >= 6 && a < 18 && studying && !done(p, "study")) {
    add({ id: "study", emoji: "📖", title: "Hit the books", detail: "Good grades open university, scholarships and better jobs.", kind: "chance", priority: 55, tab: "career", section: "school" });
  }
  if (a >= 6 && Object.keys(p.hobbies).length === 0 && a < 40) {
    add({ id: "hobby", emoji: "🎨", title: "Pick up a hobby", detail: "Skills build slowly and can become a career or side income.", kind: "chance", priority: 45, tab: "activities", section: "hobbies" });
  }
  if (a >= 6 && !done(p, "wellness:library") && p.smarts < 90) {
    add({ id: "library", emoji: "📚", title: "Visit the library", detail: "+4 Smarts. Free, once a year.", kind: "routine", priority: 30, tab: "activities", section: "wellness" });
  }

  // ---- Work and study ----
  if (a >= 15 && a < 65 && !p.currentJob && !studying && !p.business && !p.isFugitive && p.specialCareerPath === "none" && p.royalRank === "none") {
    add({ id: "job", emoji: "💼", title: a < 18 ? "Get a part-time job" : "Find a job", detail: "No income means savings only go one way.", kind: "chance", priority: 66, tab: "career", section: "work" });
  }
  if (a >= 16 && a <= 22 && p.education.stage === "HighSchool" && p.education.yearsLeft === 0) {
    add({ id: "next", emoji: "🎓", title: "School's done. What's next?", detail: "University, a trade, a job, or something wilder.", kind: "chance", priority: 70, tab: "career", section: "school" });
  }
  if (p.currentJob && !done(p, "work") && !p.currentJob.partTime) {
    add({ id: "work", emoji: "🛠️", title: "Work harder this year", detail: "Better performance means raises and promotions.", kind: "routine", priority: 40, tab: "career", section: "work" });
  }
  if (p.currentJob && !done(p, "raise") && p.currentJob.performance >= 65) {
    add({ id: "raise", emoji: "💵", title: "Ask for a raise", detail: `Your performance (${Math.round(p.currentJob.performance)}) gives you a fair shot.`, kind: "chance", priority: 52, tab: "career", section: "work" });
  }
  if (a >= 60 && p.currentJob) {
    add({ id: "retire", emoji: "🏖️", title: "You can retire", detail: "Your pension and savings pay out whenever you stop working.", kind: "chance", priority: 35, tab: "career", section: "work" });
  }
  if (p.business) {
    add({ id: "biz", emoji: "🏢", title: `Check on ${p.business.name}`, detail: "Businesses need a hand on the wheel each year.", kind: "routine", priority: 48, tab: "career", section: "business" });
  }

  // ---- People ----
  if (kids.length > 0) {
    const k = [...kids].sort((x, y) => x.relationshipBar - y.relationshipBar)[0];
    if (rel(k) < INTERACTION_CAP) {
      add({ id: "kid", emoji: "👨‍👧", title: `Spend time with ${k.name.split(" ")[0]}`, detail: k.relationshipBar < 50 ? "Your bond is thin. Neglected kids act out." : "Childhood only happens once. Parenting options live on their page.", kind: k.relationshipBar < 50 ? "chance" : "routine", priority: k.relationshipBar < 50 ? 58 : 36, tab: "relationships" });
    }
  }
  if (partner && partner.relationshipBar < 55 && rel(partner) < INTERACTION_CAP) {
    add({ id: "partner", emoji: "💞", title: `Invest in ${partner.name.split(" ")[0]}`, detail: "Your relationship is cooling. Time together protects it.", kind: "chance", priority: 57, tab: "relationships" });
  } else if (partner && !done(p, "date") && partner.relationshipBar < 85 && a >= 16) {
    add({ id: "date", emoji: "🌹", title: "Plan a date night", detail: "A small, regular investment keeps a relationship healthy.", kind: "routine", priority: 28, tab: "relationships" });
  }
  if (a >= 18 && !partner && a < 70) {
    add({ id: "meet", emoji: "💘", title: "Meet someone", detail: "Dating, friends and family all live in People.", kind: "routine", priority: 32, tab: "relationships" });
  }
  const parent = p.relatives.find((r) => (r.relation === "Parent" || r.relation === "Grandparent") && r.alive && r.age >= 70 && r.relationshipBar < 60);
  if (parent && rel(parent) < INTERACTION_CAP) {
    add({ id: "elder", emoji: "🧓", title: `Call ${parent.name.split(" ")[0]}`, detail: "They won't be around forever.", kind: "routine", priority: 34, tab: "relationships" });
  }

  // ---- Money ----
  if (a >= 20 && p.properties.length === 0 && p.bankBalance > 60_000) {
    add({ id: "home", emoji: "🏠", title: "Think about buying a home", detail: "Property tends to grow and replaces rent.", kind: "chance", priority: 44, tab: "assets", section: "homes" });
  }
  if (p.bankBalance > 150_000 && invested === 0) {
    add({ id: "invest", emoji: "📈", title: "Put idle cash to work", detail: "Cash loses to inflation. Even a cautious portfolio beats it.", kind: "chance", priority: 46, tab: "assets", section: "invest" });
  }
  if (a >= 16 && p.vehicles.length === 0 && p.bankBalance > 20_000 && !p.isFugitive) {
    add({ id: "car", emoji: "🚗", title: "Buy a car", detail: "Wheels make work and life easier.", kind: "routine", priority: 20, tab: "assets", section: "cars" });
  }

  // ---- Body and mind ----
  if (a >= 12 && !done(p, "wellness:gym") && (p.health < 85 || p.looks < 70)) {
    add({ id: "gym", emoji: "🏋️", title: "Hit the gym", detail: "+3 Health, +2 Looks. Once a year.", kind: "routine", priority: 38, tab: "activities", section: "wellness" });
  }
  if (a >= 12 && !done(p, "wellness:meditate") && p.happiness < 70) {
    add({ id: "meditate", emoji: "🧘", title: "Take a quiet moment", detail: "+5 Happiness, free.", kind: "routine", priority: 37, tab: "activities", section: "wellness" });
  }
  if (a >= 40 && !p.flags.includes(`checkup_${p.year}`) && p.diseases.length === 0) {
    add({ id: "checkup", emoji: "🩻", title: "Get a check-up", detail: "Catching illness early is cheaper than treating it late.", kind: "routine", priority: 26, tab: "activities", section: "medical" });
  }

  // Anything the older tip engine knows that isn't covered above.
  for (const t of suggestTips(p)) {
    if (!out.some((i) => i.tab === t.tab && i.emoji === t.emoji)) {
      add({ id: `tip:${t.text}`, emoji: t.emoji, title: t.text, detail: "", kind: "routine", priority: 25, tab: t.tab });
    }
  }

  out.sort((x, y) => y.priority - x.priority);
  return out;
}
