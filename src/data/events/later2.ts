import { ev, opt } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import { needsCare } from "@/engine/later";

// The question every family faces: who looks after you when you can't look after yourself?
export const LATER2_EVENTS: LifeEvent[] = [
  ev("care_decision", "health", 78, 110, "Who Will Look After You?", "Daily life has become hard to manage alone. The family has gathered to talk about what happens next.", [
    opt("Move into assisted living", "You moved into a pleasant place with a garden, a dining room and nurses on call. It cost a fortune, and the staff are kind.", { setFlags: ["assisted_living"], happinessDelta: -2, healthDelta: 4 }),
    opt("Hire care at home", "A carer comes every day. You stay in your own home, among your own things, at a price.", { setFlags: ["home_care"], happinessDelta: 2, healthDelta: 2 }),
    opt("Rely on your family", "{child} and the others took turns looking after you. It was lovely and exhausting for everyone, and the strain showed.", { setFlags: ["family_care"], relationshipDelta: { target: "Child", delta: -4 }, happinessDelta: 1 }),
  ], { requires: { custom: (p) => needsCare(p) && !p.flags.some((f) => ["assisted_living", "home_care", "family_care"].includes(f)) }, once: true, weight: 12 }),
];
