import { describe, expect, it } from "vitest";
import { initConfig } from "../src/quonfig";

describe("workspace on disk, typed accessors", () => {
  it("reads the Jev questions from config, with the placeholder rendered", async () => {
    const { config } = await initConfig();
    const decision = config.supportTriageJev({ user: { key: "u1", plan: "pro" } });

    expect(decision.variant).toBe("triage-v1");
    expect(decision.thresholds.urgent).toBe(0.8);
    expect(decision.questions.urgent.type).toBe("noul");
    expect(decision.questions.urgent.instructions({ plan: "enterprise" })).toBe(
      "The customer is on the enterprise plan. Does this email need a human reply today?",
    );
    expect(decision.questions.frustration.criteria).toEqual(["Calm", "Annoyed but civil", "Angry or threatening to leave"]);
    expect(config.jevModel()).toBe("jev-latest");
    expect(config.jevEnabled()).toBe(true);
  });

  it("targets the retention offer on the stored frustration attribute, deterministically", async () => {
    const { config } = await initConfig();
    const flag = (plan: string, frustration: number) =>
      config.promoRetention10Pct({ user: { key: "u1", plan, frustration } });

    expect(flag("pro", 2)).toBe(true);
    expect(flag("pro", 1.5)).toBe(true);
    expect(flag("pro", 1.4)).toBe(false);
    expect(flag("free", 2)).toBe(false);
  });
});
