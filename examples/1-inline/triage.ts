/**
 * Level 1: no config at all. Everything inline, exactly as the TypeSafe README
 * shows it. Shortest possible code; every tweak is a deploy.
 */
import { noul, score, type TypeSafeClient } from "@typesafe-ai/sdk";

export function createTriage(typesafe: TypeSafeClient) {
  return async function triage(email: string, user: { key: string; plan: string }) {
    const result = await typesafe.systemOne({
      state: { email },
      model: "jev-latest",
      questions: {
        urgent: noul(
          `The customer is on the ${user.plan} plan. Does this email need a human reply today?`,
          {
            true: "Outage, money at risk, or an explicit deadline.",
            false: "FYI, general question, or it can wait until tomorrow.",
          },
        ),
        frustration: score("How frustrated is the customer who wrote this email?", [
          "Calm",
          "Annoyed but civil",
          "Angry or threatening to leave",
        ]),
      },
    });

    const paged = result.answers.urgent.noul >= 0.8;
    return { paged, frustration: result.answers.frustration.score };
  };
}
