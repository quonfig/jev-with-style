/**
 * Level 4: all config. The config holds the whole question set in Jev's own
 * request shape, validated by ONE generic schema shared by every Jev call in
 * the codebase. Code never names a question: it forwards the questions to
 * Jev and stores each answer as a `jev.<name>` context attribute. Every
 * threshold is a feature-flag rule, so adding a question or moving a
 * threshold never touches code.
 */
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { QuonfigTypesafeNode } from "./generated/quonfig-server";

export type JevContext = { user: { key: string; plan: string }; jev: Record<string, number | string> };

export function createTriage(config: QuonfigTypesafeNode, typesafe: TypeSafeClient) {
  return async function triage(email: string, user: { key: string; plan: string }): Promise<JevContext | null> {
    const ctx = { user };
    if (!config.jevEnabled(ctx)) return null; // kill switch

    // The schema is a tagged oneOf, so the generated type is Jev's own
    // `Questions` shape and passes straight through with no cast.
    const { questions } = config.supportTriageJev(ctx);
    const result = await typesafe.systemOne({
      state: { email, plan: user.plan }, // no placeholders: facts go in the state
      model: config.jevModel(ctx),
      questions,
    });

    // Each answer becomes a number (or label) on the context. Flags do the rest.
    const jev: JevContext["jev"] = {};
    for (const [name, answer] of Object.entries(result.answers)) {
      if (answer.type === "noul") jev[name] = answer.noul;
      else if (answer.type === "score") jev[name] = answer.score;
      else jev[name] = answer.choice;
    }
    return { user, jev };
  };
}

/** Both thresholds live in flag rules: oncall.page (jev.urgent >= 0.8) and promo.retention-10pct (jev.frustration >= 1.5). */
export function decide(config: QuonfigTypesafeNode, ctx: JevContext) {
  return { paged: config.oncallPage(ctx), retentionOffer: config.promoRetention10Pct(ctx) };
}
