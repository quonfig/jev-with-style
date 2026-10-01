import { describe, expect, it } from "vitest";
import { createLiveClients, inbox, triage } from "../examples/6-live/triage";

// `npm run demo` is the version the blog post walks through: the pasted jev-questions schema and
// a per-customer question set, read from examples/6-live/quonfig on disk, with the mock Jev.
describe("examples/6-live offline", () => {
  it("asks each customer its own question set", async () => {
    const { quonfig, typesafe } = await createLiveClients({});
    try {
      const asked: Record<string, string[]> = {};
      for (const item of inbox) {
        const { answers } = await triage(quonfig, typesafe, item);
        asked[item.customer.key] = Object.keys(answers).sort();
      }
      expect(asked).toEqual({
        acme: ["churn_risk", "frustration", "topic", "urgent"],
        globex: ["frustration", "language", "topic", "urgent"],
        initech: ["frustration", "refund_request", "topic", "urgent"],
      });
    } finally {
      quonfig.close();
    }
  });
});
