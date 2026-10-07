import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Old age (60+)
export const LATER_EVENTS: LifeEvent[] = [
  ev("retirement_party", "career", 60, 72, "Retirement Party", "Your colleagues organised a farewell party. Cake and speeches abound.", [
    opt("Give an emotional speech", "You gave a tearful speech. Everyone cheered.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 4 } }),
    opt("Keep it short and sweet", "You thanked everyone and went home early.", { happinessDelta: 2 }),
    opt("Tell off the boss", "You told your boss exactly what you thought. Priceless.", { happinessDelta: 8, karmaDelta: -2 }),
  ], { requires: { hasJob: true }, once: true }),
  ev("grandkids_visit", "family", 55, 100, "Grandkids Visit", "Your grandchildren are coming for the weekend.", [
    opt("Spoil them with sweets", "The kids were over the moon. Their parents were less enthused.", { happinessDelta: 8, relationshipDelta: { target: "Child", delta: -2 } }),
    opt("Tell them old stories", "You told them stories of your wild youth. They were mesmerised.", { happinessDelta: 7, smartsDelta: 1 }),
    opt("Teach them to fish", "You taught them to fish. A lasting memory.", { happinessDelta: 8, healthDelta: 1 }),
  ], { requires: { hasChildren: true }, cooldown: 3 }),
  ev("hearing_loss", "health", 62, 100, "What Did You Say?", "People keep telling you to turn the TV down.", [
    opt("Get hearing aids ($2,000)", "The world is suddenly full of sound again.", { bankBalanceDelta: -2000, happinessDelta: 6 }),
    opt("Pretend you can hear fine", "You nodded along to every conversation. Many misunderstandings ensued.", { happinessDelta: -4, relationshipDelta: { target: "All", delta: -3 } }),
  ], { once: true }),
  ev("fall_at_home", "health", 68, 100, "A Nasty Fall", "You slipped on a rug at home.", [
    opt("Go to the ER", "You were treated and sent home with a cane.", { bankBalanceDelta: -1500, healthDelta: -5 }),
    opt("Shake it off", "You shook it off. It hurt for months.", { healthDelta: -10 }),
    risk("Call for help and stay in bed", 0.9, ["You rested up and recovered nicely.", { healthDelta: -3 }], ["Complications set in during your recovery.", { diseaseTrigger: "pneumonia", healthDelta: -8 }]),
  ], { cooldown: 5 }),
  ev("old_friend_dies", "family", 62, 100, "Another Goodbye", "An old friend passed away.", [
    opt("Give a eulogy", "You gave a moving eulogy. Everyone cried.", { happinessDelta: -6, karmaDelta: 3 }),
    opt("Grieve privately", "You mourned in your own way.", { happinessDelta: -8 }),
    opt("Honour them with a trip they always wanted", "You took the trip in their memory. It healed something.", { happinessDelta: 4, bankBalanceDelta: -3000 }),
  ], { requires: { hasFriend: true }, cooldown: 5 }),
  ev("phone_scam", "money", 60, 100, "Suspicious Call", "A caller claims to be from the tax office and demands immediate payment.", [
    risk("Pay what they ask", 0.2, ["It turned out to be legitimate. Phew.", {}], ["It was a scam. You lost $3,500.", { bankBalanceDelta: -3500, happinessDelta: -8 }]),
    opt("Hang up", "You hung up. Smart.", { smartsDelta: 1 }),
    opt("Waste their time", "You kept the scammer on the line for three hours. Hero.", { happinessDelta: 5, karmaDelta: 2 }),
  ], { cooldown: 6 }),
  ev("bucket_list", "general", 60, 95, "The Bucket List", "You've put off a few dreams. Time is short.", [
    opt("See the Northern Lights ($5,000)", "You watched the aurora dance across the sky. Unforgettable.", { bankBalanceDelta: -5000, happinessDelta: 14 }),
    opt("Skydive", "You jumped out of a plane at 70. It was exhilarating.", { happinessDelta: 12, healthDelta: -1 }),
    opt("Write a letter to everyone you love", "You wrote heartfelt letters. Several people cried.", { happinessDelta: 6, relationshipDelta: { target: "All", delta: 8 } }),
  ], { cooldown: 5 }),
  ev("last_will", "family", 65, 100, "The Will", "You sit down with a lawyer to write your will.", [
    opt("Leave everything to your family", "You left everything to your family.", { relationshipDelta: { target: "Child", delta: 8 }, karmaDelta: 2 }),
    opt("Donate a chunk to charity", "You donated a big chunk to charity. Your name is on a wing of a hospital.", { karmaDelta: 12, bankBalanceDelta: -50000, happinessDelta: 6 }),
    opt("Spend it all while you can", "You decided to spend it all on yourself. YOLO.", { bankBalanceDelta: -25000, happinessDelta: 10 }),
  ], { once: true, requires: { minBank: 100000 } }),
  ev("old_flame", "romance", 60, 100, "A Familiar Face", "Your first love shows up at the grocery store.", [
    opt("Reconnect over coffee", "You talked for hours over coffee. Some sparks never die.", { happinessDelta: 8, addRelative: { relation: "Friend", ageOffset: [-2, 2] } }),
    opt("Say hello and move on", "You smiled and moved on. Bittersweet.", { happinessDelta: 1 }),
    opt("Hide behind the cereal boxes", "You hid behind the cereal boxes. They didn't spot you.", {}),
  ], { once: true }),
  ev("cruise_romance", "romance", 62, 100, "Love on the Lido Deck", "On a cruise, a charming widow/widower keeps catching your eye.", [
    risk("Ask them to dinner", 0.6, ["You had a lovely dinner. Romance in the golden years!", { happinessDelta: 10, addRelative: { relation: "Partner", ageOffset: [-6, 6], partnerStatus: "dating" } }], ["They declined politely. The buffet consoled you.", { happinessDelta: -3 }]),
    opt("Enjoy the cruise solo", "You enjoyed the sunset alone.", { happinessDelta: 4 }),
  ], { requires: { hasPartner: false, minBank: 5000 }, cooldown: 8 }),
  ev("nursing_home", "family", 75, 100, "A Conversation About Care", "Your family brings up assisted living.", [
    opt("Move to a care home ($20,000)", "You moved into a care home. The staff were kind.", { bankBalanceDelta: -20000, healthDelta: 4, happinessDelta: 2 }),
    opt("Insist on staying home", "You stayed home, stubborn as ever.", { happinessDelta: 3, healthDelta: -3 }),
    opt("Move in with your children", "You moved in with your kids. Family dinners every night.", { happinessDelta: 5, relationshipDelta: { target: "Child", delta: 8 } }),
  ], { once: true }),
  ev("garden_club", "general", 55, 100, "Green Thumb", "The neighbourhood garden club is recruiting.", [
    opt("Join and grow prize tomatoes", "Your tomatoes won second place. You're still furious about first.", { happinessDelta: 6, healthDelta: 2, relationshipDelta: { target: "Friend", delta: 4 } }),
    opt("Garden alone", "You gardened alone. The roses were gorgeous.", { happinessDelta: 4, healthDelta: 2 }),
    opt("Turn the lawn into a golf course", "You turned your lawn into a mini golf course. The neighbours are divided.", { happinessDelta: 5, bankBalanceDelta: -800 }),
  ], { cooldown: 8 }),
  ev("memoir_urge", "general", 60, 100, "Stories to Tell", "Your family insists you should write your life story.", [
    opt("Write your autobiography", "You wrote your story. Even a few strangers bought it.", { happinessDelta: 8, smartsDelta: 2, bankBalanceDelta: 600 }),
    opt("Record audio stories for the grandkids", "You recorded your stories. A priceless family heirloom.", { happinessDelta: 6, relationshipDelta: { target: "Child", delta: 6 } }),
    opt("Take your secrets to the grave", "You decided some stories should stay buried.", {}),
  ], { once: true }),
  ev("health_scare_old", "health", 65, 100, "Chest Pains", "You feel a sudden pain in your chest.", [
    risk("Call an ambulance", 0.85, ["It was a minor scare. Your heart's fine, just stressed.", { bankBalanceDelta: -1800, healthDelta: -2 }], ["It was a heart attack. Doctors saved you, but your heart is damaged.", { bankBalanceDelta: -9000, diseaseTrigger: "heart_disease", healthDelta: -10 }]),
    risk("Lie down and wait", 0.5, ["It passed on its own.", {}], ["It was a major heart attack.", { die: "a heart attack" }]),
  ], { cooldown: 8, weight: 0.6, requires: { maxStat: { health: 70 } } }),
  ev("nostalgia_trip", "general", 62, 100, "Walk Down Memory Lane", "You find a box of old photographs in the attic.", [
    opt("Spend the day reminiscing", "You looked at every photo and laughed and cried.", { happinessDelta: 6 }),
    opt("Share them with family", "You shared the photos at dinner. Everyone shared stories.", { happinessDelta: 7, relationshipDelta: { target: "All", delta: 5 } }),
    opt("Burn them", "You burned them in the fireplace. A new chapter.", { happinessDelta: -2 }),
  ], { cooldown: 8 }),
  ev("lonely_evening", "health", 60, 100, "Quiet House", "The house is very quiet tonight.", [
    opt("Call an old friend", "You called an old friend. You talked until midnight.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 8 } }),
    opt("Adopt a pet", "You adopted an elderly cat. A perfect companion.", { happinessDelta: 8, bankBalanceDelta: -150 }),
    opt("Watch TV alone", "You watched TV until you fell asleep.", { happinessDelta: -2 }),
  ], { cooldown: 5, requires: { maxStat: { happiness: 60 } } }),
];
