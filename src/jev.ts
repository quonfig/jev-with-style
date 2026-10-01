import { TypeSafeError, type TypeSafeClient, type NoulResponse, type ScoreCriteria, type ScoreResponse } from "@typesafe-ai/sdk";
import type { ContextObj } from "@quonfig/node";
import type { QuonfigTypesafeNode } from "../generated/quonfig-server";
export { createTypeSafeClient } from "./typesafe-client";

export type TriageUser = { key: string; plan: string };

/**
 * The contract between code and config. Code owns the question NAMES
 * (`urgent`, `frustration`) and the branches it takes on them. Config owns the
 * wording, the rubric, the model, and the thresholds. Renaming a question is a
 * code change; rewording it is a config change.
 */
export type TriageResult = {
  variant: string;
  model: string;
  answers: { urgent: NoulResponse; frustration: ScoreResponse };
  thresholds: { urgent: number };
};

/** Jev's score rubric is a tuple of at least two levels; the config stores a plain array. */
function rubric(levels: string[]): ScoreCriteria {
  if (levels.length < 2) throw new Error("score rubric needs at least two levels");
  return levels as unknown as ScoreCriteria;
}

export function createTriage(config: QuonfigTypesafeNode, typesafe: TypeSafeClient) {
  return async function triage(email: string, user: TriageUser): Promise<TriageResult | null> {
    const ctx: ContextObj = { user };

    if (!config.jevEnabled(ctx)) return null; // kill switch: skip Jev entirely

    const decision = config.supportTriageJev(ctx); // typed straight from the JSON Schema
    const { urgent, frustration } = decision.questions;

    let result;
    try {
      result = await typesafe.systemOne(
        {
        state: { email },
        model: config.jevModel(ctx),
        questions: {
          // `{{plan}}` in the stored prompt became a typed parameter in generated code.
          urgent: { type: "noul", instructions: urgent.instructions({ plan: user.plan }), criteria: urgent.criteria },
          frustration: { type: "score", instructions: frustration.instructions, criteria: rubric(frustration.criteria) },
        },
      },
        { timeout: decision.timeoutMs ?? 2000, retry: { maxRetries: 0 } },
      );
    } catch (error) {
      // Jev down, slow, or refusing: take the non-AI path, same as the kill switch.
      if (error instanceof TypeSafeError) {
        console.warn(`[jev] ${error.constructor.name}: ${error.message}`);
        return null;
      }
      throw error;
    }

    return { variant: decision.variant, model: result.model, answers: result.answers, thresholds: decision.thresholds };
  };
}
