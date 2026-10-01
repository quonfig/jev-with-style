/**
 * The runner behind `npm run demo`: three sample emails from three customers, each asked its own
 * question set. Reads ./quonfig on disk with a mock Jev by default; set QUONFIG_BACKEND_SDK_KEY
 * (and QUONFIG_DOMAIN if not quonfig.com) to read live from Quonfig cloud, and TYPESAFE_API_KEY
 * to call real Jev. With --watch (cloud mode) it re-runs whenever the config changes.
 *
 *   npx tsx examples/6-live/triage-live.ts [--watch]
 */
import { CONFIG_KEY, createLiveClients, inbox, triage } from "./triage";

let watching = false;
const { quonfig, typesafe } = await createLiveClients(process.env, {
  onConfigUpdate: () => {
    if (watching) console.log(`\n[quonfig] config update received ${new Date().toISOString()}`);
  },
});

function fmt(answer: { type: string; noul?: number; score?: number; choice?: string }) {
  if (answer.type === "noul") return `P(yes)=${answer.noul?.toFixed(2)}`;
  if (answer.type === "score") return `score=${answer.score}`;
  return `choice=${answer.choice}`;
}

async function run(item: (typeof inbox)[number]) {
  const { answers, ms } = await triage(quonfig, typesafe, item);
  const { customer } = item;
  console.log(`\n${customer.name} (${customer.plan}, ${customer.country})  ${ms}ms`);
  for (const [name, answer] of Object.entries(answers).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${name.padEnd(16)} ${fmt(answer as never)}`);
  }
}

for (const item of inbox) await run(item);

if (process.argv.includes("--watch")) {
  watching = true;
  let last = JSON.stringify(inbox.map((i) => quonfig.getJSON(CONFIG_KEY, { customer: i.customer })));
  console.log("\n[watch] edit support.triage.questions in the UI; re-running on change...");
  setInterval(async () => {
    const now = JSON.stringify(inbox.map((i) => quonfig.getJSON(CONFIG_KEY, { customer: i.customer })));
    if (now === last) return;
    last = now;
    for (const item of inbox) await run(item);
  }, 1000);
} else {
  quonfig.close();
}
