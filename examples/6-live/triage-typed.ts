/**
 * The typed version of triage-live.ts: the accessor generated from the pasted
 * jev-questions schema returns Jev's own question union, so it passes to
 * systemOne with no cast.
 */
import { Quonfig } from "@quonfig/node";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const client = new Quonfig({ sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY! });
await client.init();
const quonfig = new QuonfigTypesafeNode(client);
const typesafe = new TypeSafeClient(); // reads TYPESAFE_API_KEY

export async function triage(email: string, customer: { key: string; plan: string; country: string }) {
  const ctx = { customer }; // the rules target customer.plan and customer.key
  const { questions } = quonfig.supportTriageQuestions(ctx);
  const { answers } = await typesafe.systemOne({
    state: { email, plan: customer.plan, country: customer.country },
    model: quonfig.jevModel(ctx),
    questions, // no cast
  });
  return answers;
}
