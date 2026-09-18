import { describe, expect, it } from "vitest";
import { createTriage, createTypeSafeClient } from "../src/jev";
import { initConfig } from "../src/quonfig";
import { createSupportWorker, type UserRecord } from "../src/support-worker";

async function setup() {
  const { config } = await initConfig();
  const users = new Map<string, UserRecord>();
  const paged: string[] = [];
  const worker = createSupportWorker(config, createTriage(config, createTypeSafeClient()), {
    users,
    pageOnCall: (email) => paged.push(email.id),
    log: () => {},
  });
  return { worker, users, paged };
}

describe("support worker: judge once at ingest, target deterministically at render", () => {
  it("pages on-call and unlocks the offer for an angry, urgent, paying customer", async () => {
    const { worker, users, paged } = await setup();
    const { result } = await worker.handleInbound({
      id: "e1",
      user: { key: "u-acme", plan: "pro" },
      body: "Checkout is DOWN and we were charged twice. Fix this ASAP or we cancel. Ridiculous!!",
    });
    expect(result?.answers.urgent.noul).toBeGreaterThanOrEqual(0.8);
    expect(paged).toEqual(["e1"]);
    expect(users.get("u-acme")?.frustration).toBeGreaterThanOrEqual(1.5);
    expect(worker.showRetentionOffer(users.get("u-acme")!)).toBe(true);
  });

  it("does nothing for a calm question from a free user", async () => {
    const { worker, users, paged } = await setup();
    await worker.handleInbound({
      id: "e2",
      user: { key: "u-sam", plan: "free" },
      body: "Quick question: can I export to CSV? No rush.",
    });
    expect(paged).toEqual([]);
    expect(worker.showRetentionOffer(users.get("u-sam")!)).toBe(false);
  });
});
