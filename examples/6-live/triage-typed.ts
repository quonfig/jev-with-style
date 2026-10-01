/**
 * The typed version of triage-live.ts: the accessor generated from the pasted
 * jev-questions schema returns Jev's own question union, so it passes to
 * systemOne with no cast.
 */
import { Quonfig } from "@quonfig/node";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const quonfig = new QuonfigTypesafeNode(new Quonfig({ sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY! }));
const typesafe = new TypeSafeClient();

export async function triage(email: string, customer: { key: string; plan: string; country: string }) {
  const ctx = { customer };
  const { questions } = quonfig.supportTriageQuestions(ctx);
  const { answers } = await typesafe.systemOne({
    state: { email, plan: customer.plan, country: customer.country },
    model: quonfig.jevModel(ctx),
    questions,
  });
  return answers;
}
