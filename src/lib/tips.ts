import type { PlayerState, TabId } from "@/types/game.types";
import { getPartner } from "@/engine/state";

export interface Tip {
  emoji: string;
  text: string;
  tab: TabId;
}

/** Contextual nudges so a new player always has a sensible "what now?" among hundreds of options. */
export function suggestTips(p: PlayerState): Tip[] {
  const tips: Tip[] = [];
  if (p.isInPrison || p.pendingTrial) return tips;
  const studying = p.education.yearsLeft > 0 && p.education.stage !== "None";
  const invested = Object.values(p.investments).reduce((s, h) => s + h.value, 0);

  if (p.health < 45) tips.push({ emoji: "🩺", text: "Your health is slipping. See a doctor or try some wellness activities.", tab: "activities" });
  if (p.happiness < 35) tips.push({ emoji: "🫂", text: "You're miserable. Spend time with people, pick up a hobby or take a break.", tab: "activities" });
  if (p.outstandingLoans > 0 && p.bankBalance > p.outstandingLoans) tips.push({ emoji: "🏦", text: "You can clear your debt from your savings.", tab: "assets" });
  if (p.age >= 16 && p.age < 65 && !p.currentJob && !studying && !p.business && !p.isFugitive && p.specialCareerPath === "none")
    tips.push({ emoji: "💼", text: "You have no income. Browse jobs in the Career tab.", tab: "career" });
  if (p.age >= 17 && p.age <= 22 && p.education.stage === "HighSchool" && p.education.yearsLeft === 0)
    tips.push({ emoji: "🎓", text: "School's done. University, a job or something wilder?", tab: "career" });
  if (p.age >= 18 && !getPartner(p) && p.age < 70) tips.push({ emoji: "💘", text: "Single? Meet someone in the People tab.", tab: "relationships" });
  if (p.age >= 20 && p.properties.length === 0 && p.bankBalance > 60_000) tips.push({ emoji: "🏠", text: "You have savings. A home builds wealth over time.", tab: "assets" });
  if (p.bankBalance > 150_000 && invested === 0) tips.push({ emoji: "📈", text: "Idle cash loses to inflation. Consider investing.", tab: "assets" });
  if (p.age >= 60 && p.currentJob) tips.push({ emoji: "🏖️", text: "You're old enough to retire whenever you like.", tab: "career" });
  if (p.age >= 8 && p.age < 18 && Object.keys(p.hobbies).length === 0) tips.push({ emoji: "🎨", text: "Try a hobby. Skills can turn into careers later.", tab: "activities" });
  return tips.slice(0, 2);
}
