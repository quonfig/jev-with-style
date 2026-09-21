/**
 * Level 5: declared in code. One declaration is the type contract, the source
 * of the JSON Schema in quonfig/schemas/, and the default config value. See
 * decision.ts for the helper and sync-schema.ts for the step that writes the
 * workspace files.
 */
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { Quonfig } from "@quonfig/node";
import { defineDecision, noul, score } from "./decision";

// CODE owns: question names, question types, which placeholders exist, how
// many rubric levels there are, and the branches taken on the answers.
// CONFIG owns: today's wording, rubric text, yes/no criteria, thresholds, timeout.
// The SCHEMA is derived from this declaration and checked in; it is what the
// form editor renders and what a save is validated against.
export const triage = defineDecision("support.triage.jev", {
  questions: {
    urgent: noul("The customer is on the {{plan}} plan. Does this email need a human reply today?", {
      true: "Outage, money at risk, or an explicit deadline.",
      false: "FYI, general question, or it can wait until tomorrow.",
    }),
    frustration: score("How frustrated is the customer who wrote this email?", [
      "Calm",
      "Annoyed but civil",
      "Angry or threatening to leave",
    ]),
  },
  thresholds: { urgent: 0.8 },
  timeoutMs: 2000,
});

export function createTriage(quonfig: Quonfig, typesafe: TypeSafeClient) {
  return async function triage_(email: string, user: { key: string; plan: string }) {
    const ctx = { user };
    if (!quonfig.isFeatureEnabled("jev.enabled", ctx)) return null; // kill switch

    // Config value over declared defaults. `plan` is required here because the
    // declared prompt contains {{plan}}; leaving it out is a compile error.
    const d = triage.resolve(quonfig.getJSON(triage.key, ctx), { plan: user.plan });

    const result = await typesafe.systemOne(
      { state: { email }, model: quonfig.get("jev.model", ctx), questions: d.questions },
      { timeout: d.timeoutMs, retry: { maxRetries: 0 } },
    );

    // Inferred by the TypeSafe SDK from the declaration: nothing restated, no cast.
    const paged = result.answers.urgent.noul >= d.thresholds.urgent;
    return { paged, frustration: result.answers.frustration.score };
  };
}

// ---- compile-time guarantees, kept here so `npm run typecheck:examples` proves them ----
export async function _guarantees(typesafe: TypeSafeClient) {
  // @ts-expect-error the declared prompt needs {{plan}}
  triage.resolve({}, {});

  const d = triage.resolve({}, { plan: "pro" });
  const result = await typesafe.systemOne({ state: {}, questions: d.questions });
  // @ts-expect-error no such question: renaming `urgent` is a code change, as it should be
  result.answers.other;
  // The 3-level rubric survives as a tuple, so the score keys are typed.
  const angry: number = result.answers.frustration.probabilities["2"];
  return angry;
}
