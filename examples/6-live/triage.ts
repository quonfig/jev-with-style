/**
 * Level 6: one pasted schema, targeted per customer. The version the blog post walks through.
 *
 * The config `support.triage.questions` is bound to the generic `jev-questions` schema. Code
 * never names a question: it forwards whatever question set the customer's context evaluates
 * to. Both ends switch on an env var, and the code does not change:
 *
 *  - QUONFIG_BACKEND_SDK_KEY set → live from Quonfig cloud over SSE; otherwise ./quonfig on disk
 *  - TYPESAFE_API_KEY set        → real Jev; otherwise the local mock
 */
import { Quonfig, type QuonfigOptions } from "@quonfig/node";
import type { Questions, TypeSafeClient } from "@typesafe-ai/sdk";
import { fileURLToPath } from "node:url";
import { createTypeSafeClient } from "../../src/typesafe-client";

export const CONFIG_KEY = "support.triage.questions";
export const WORKSPACE_DIR = fileURLToPath(new URL("./quonfig", import.meta.url));

export type Customer = { key: string; name: string; plan: string; country: string };

export const inbox: { customer: Customer; email: string }[] = [
  {
    customer: { key: "acme", name: "Acme Corp", plan: "enterprise", country: "US" },
    email:
      "Our checkout has been DOWN for an hour and we were charged twice. We have a board demo at 3pm. Fix this or we are moving to a competitor.",
  },
  {
    customer: { key: "globex", name: "Globex GmbH", plan: "pro", country: "DE" },
    email:
      "Hallo, die Rechnung für September stimmt nicht mit unserem Vertrag überein. Bitte prüfen Sie das bis Ende der Woche.",
  },
  {
    customer: { key: "initech", name: "Initech", plan: "free", country: "US" },
    email: "Hi! Is there a way to export my dashboard to CSV? No rush at all, thanks.",
  },
];

export async function createLiveClients(
  env: NodeJS.ProcessEnv = process.env,
  options: Pick<QuonfigOptions, "onConfigUpdate"> = {},
): Promise<{ quonfig: Quonfig; typesafe: TypeSafeClient }> {
  const quonfig = env.QUONFIG_BACKEND_SDK_KEY
    ? new Quonfig({ sdkKey: env.QUONFIG_BACKEND_SDK_KEY, ...options })
    : new Quonfig({ datadir: WORKSPACE_DIR, environment: env.QUONFIG_ENVIRONMENT ?? "development", ...options });
  await quonfig.init();
  return { quonfig, typesafe: createTypeSafeClient(env) };
}

export async function triage(quonfig: Quonfig, typesafe: TypeSafeClient, { customer, email }: (typeof inbox)[number]) {
  const ctx = { customer }; // the rules target customer.plan and customer.key
  const { questions } = quonfig.getJSON(CONFIG_KEY, ctx) as { questions: Questions };
  const started = Date.now();
  const { answers } = await typesafe.systemOne({
    state: { email, plan: customer.plan, country: customer.country },
    model: quonfig.getString("jev.model", ctx) ?? "jev-latest",
    questions,
  });
  return { answers, ms: Date.now() - started };
}
