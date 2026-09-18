import { initConfig } from "./quonfig";
import { createTriage, createTypeSafeClient } from "./jev";
import { createSupportWorker, type InboundEmail, type UserRecord } from "./support-worker";

const inbox: InboundEmail[] = [
  {
    id: "e1",
    user: { key: "u-acme", plan: "pro" },
    body: "Our checkout has been DOWN for an hour and we were charged twice. Fix this ASAP or we cancel. Ridiculous!!",
  },
  {
    id: "e2",
    user: { key: "u-sam", plan: "free" },
    body: "Hi! Quick question: is there a way to export my dashboard to CSV? No rush at all.",
  },
  {
    id: "e3",
    user: { key: "u-globex", plan: "enterprise" },
    body: "Third time asking about the invoice mismatch. Honestly a bit disappointed, but no deadline on our side.",
  },
];

const { config, close } = await initConfig();
const triage = createTriage(config, createTypeSafeClient());
const users = new Map<string, UserRecord>();
const pages: string[] = [];
const worker = createSupportWorker(config, triage, {
  users,
  pageOnCall: (email) => pages.push(email.id),
  log: (event, data) => console.log(`${event} ${JSON.stringify(data)}`),
});

console.log(`model: ${config.jevModel()}   jev.enabled: ${config.jevEnabled()}   variant: ${config.supportTriageJev().variant}\n`);

const rows: Record<string, unknown>[] = [];
for (const email of inbox) {
  const { paged, result } = await worker.handleInbound(email);
  const user = users.get(email.user.key) ?? email.user;
  rows.push({
    email: email.id,
    plan: email.user.plan,
    "P(urgent)": result?.answers.urgent.noul ?? "-",
    frustration: result?.answers.frustration.score ?? "-",
    paged,
    "retention offer": worker.showRetentionOffer(user),
  });
}
console.log();
console.table(rows);
close(); // end the live config stream so the script exits
