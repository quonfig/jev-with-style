import { TypeSafeClient } from "@typesafe-ai/sdk";
const t = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY! });
const email = "We were double charged and want our money back.";
const probes: Record<string, unknown> = {
  "label with space": { topic: { type: "choice", instructions: "Topic?", criteria: { "needs refund": "wants money back", other: "anything else" } } },
  "no instructions": { urgent: { type: "noul" } },
  "two-level rubric": { mood: { type: "score", instructions: "Mood?", criteria: ["calm", "angry"] } },
  "20 questions": Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`q${i}`, { type: "noul", instructions: `Is fact ${i} true?` }])),
};
for (const [name, questions] of Object.entries(probes)) {
  try {
    const r = await t.systemOne({ state: { email }, model: "jev-latest", questions: questions as never });
    console.log(`${name}: OK`, JSON.stringify(r.answers).slice(0, 160));
  } catch (e) {
    console.log(`${name}: ERROR`, String((e as Error).message).slice(0, 200));
  }
}
