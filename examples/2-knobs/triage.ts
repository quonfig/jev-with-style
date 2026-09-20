/**
 * Level 2: just the knobs. The questions stay inline with TypeSafe's builders,
 * so answer types are still inferred. Only the things you'll actually want
 * to tweak move to config: prompt text, threshold, model, kill switch.
 * No schema, no JSON config.
 */
import { noul, score, type TypeSafeClient } from "@typesafe-ai/sdk";
import type { QuonfigTypesafeNode } from "./generated/quonfig-server";

export function createTriage(config: QuonfigTypesafeNode, typesafe: TypeSafeClient) {
  return async function triage(email: string, user: { key: string; plan: string }) {
    const ctx = { user };
    if (!config.jevEnabled(ctx)) return null; // kill switch

    const result = await typesafe.systemOne({
      state: { email },
      model: config.jevModel(ctx),
      questions: {
        // `{{plan}}` in the stored prompt became a typed parameter.
        urgent: noul(config.jevUrgentPrompt(ctx)({ plan: user.plan }), {
          true: "Outage, money at risk, or an explicit deadline.",
          false: "FYI, general question, or it can wait until tomorrow.",
        }),
        frustration: score(config.jevFrustrationPrompt(ctx), [
          "Calm",
          "Annoyed but civil",
          "Angry or threatening to leave",
        ]),
      },
    });

    const paged = result.answers.urgent.noul >= config.jevUrgentThreshold(ctx);
    return { paged, frustration: result.answers.frustration.score };
  };
}
