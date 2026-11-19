const HAND = "https://media.base44.com/images/public/6af073a18692ae92af878b2b/96f70d000_generated_image.png";
const MEASURE = "https://media.base44.com/images/public/6af073a18692ae92af878b2b/900d53d64_generated_image.png";
const POWER = "https://media.base44.com/images/public/6af073a18692ae92af878b2b/7b1a8cfd4_generated_image.png";
const SAFETY = "https://media.base44.com/images/public/6af073a18692ae92af878b2b/aa88638f7_generated_image.png";
const ELECTRICAL = "https://media.base44.com/images/public/6af073a18692ae92af878b2b/1457c12ac_generated_image.png";

const RULES = [
  [/measur|caliper|micromet|gauge|torque|precision/i, MEASURE],
  [/power|drill|grind|pneu|rivet|saw|cut/i, POWER],
  [/safety|ppe|protect|goggle|glove|helmet/i, SAFETY],
  [/electric|avionic|test|meter|crimp|wire/i, ELECTRICAL],
];

export function toolImage(category) {
  const name = category || "";
  const hit = RULES.find(([re]) => re.test(name));
  return hit ? hit[1] : HAND;
}
