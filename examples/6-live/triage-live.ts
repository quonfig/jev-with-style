/**
 * Level 6: one pasted schema, live from Quonfig cloud, targeted per customer.
 *
 * The config `support.triage.questions` is bound to the generic `jev-questions`
 * schema. Code never names a question: it forwards whatever question set the
 * customer's context evaluates to, and prints the answers. Edit the config in
 * the UI while this runs with --watch and the next email uses the new questions.
 *
 *   QUONFIG_BACKEND_SDK_KEY=... QUONFIG_DOMAIN=quonfig-staging.com \
 *   TYPESAFE_API_KEY=... npx tsx examples/6-live/triage-live.ts [--watch]
 */
import { Quonfig } from "@quonfig/node";
import { TypeSafeClient, type Questions } from "@typesafe-ai/sdk";

const CONFIG_KEY = "support.triage.questions";

type Customer = { key: string; name: string; plan: string; country: string };

const inbox: { customer: Customer; email: string }[] = [
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

const quonfig = new Quonfig({
  sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY!,
  onConfigUpdate: () => {
    if (watching) console.log(`\n[quonfig] config update received ${new Date().toISOString()}`);
  },
});
const typesafe = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY! });
let watching = false;

function fmt(answer: { type: string; noul?: number; score?: number; choice?: string }) {
  if (answer.type === "noul") return `P(yes)=${answer.noul?.toFixed(2)}`;
  if (answer.type === "score") return `score=${answer.score}`;
  return `choice=${answer.choice}`;
}

async function triage({ customer, email }: (typeof inbox)[number]) {
  const ctx = { customer };
  const { questions } = quonfig.getJSON(CONFIG_KEY, ctx) as { questions: Questions };
  const started = Date.now();
  const { answers } = await typesafe.systemOne({
    state: { email, plan: customer.plan, country: customer.country },
    model: quonfig.getString("jev.model", ctx) ?? "jev-latest",
    questions,
  });
  const ms = Date.now() - started;
  console.log(`\n${customer.name} (${customer.plan}, ${customer.country})  ${ms}ms`);
  for (const [name, answer] of Object.entries(answers)) {
    console.log(`  ${name.padEnd(16)} ${fmt(answer as never)}`);
  }
}

await quonfig.init();
for (const item of inbox) await triage(item);

if (process.argv.includes("--watch")) {
  watching = true;
  let last = JSON.stringify(inbox.map((i) => quonfig.getJSON(CONFIG_KEY, { customer: i.customer })));
  console.log("\n[watch] edit support.triage.questions in the UI; re-running on change...");
  setInterval(async () => {
    const now = JSON.stringify(inbox.map((i) => quonfig.getJSON(CONFIG_KEY, { customer: i.customer })));
    if (now === last) return;
    last = now;
    for (const item of inbox) await triage(item);
  }, 1000);
} else {
  quonfig.close();
}
