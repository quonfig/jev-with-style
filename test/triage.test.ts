import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { AI_GATEWAY_TYPESAFE_URL, createTriage, createTypeSafeClient } from "../src/jev";
import { mockJevFetch } from "../src/mock-jev";
import { initConfig, WORKSPACE_DIR } from "../src/quonfig";

function recordingClient() {
  const requests: { url: string; body: any; headers: Record<string, string> }[] = [];
  const client = new TypeSafeClient({
    apiKey: "test",
    fetch: async (url, init) => {
      requests.push({ url, body: JSON.parse(String(init?.body)), headers: Object.fromEntries(new Headers(init?.headers).entries()) });
      return mockJevFetch(url, init);
    },
  });
  return { client, requests };
}

describe("triage: config drives the Jev request", () => {
  it("sends the configured questions, rendered placeholder, and model to /v1/systemone", async () => {
    const { config } = await initConfig();
    const { client, requests } = recordingClient();
    const triage = createTriage(config, client);

    const result = await triage("Everything is down, ASAP please!!", { key: "u1", plan: "pro" });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(requests[0].body).toEqual({
      state: { email: "Everything is down, ASAP please!!" },
      model: "jev-latest",
      questions: {
        urgent: {
          type: "noul",
          instructions: "The customer is on the pro plan. Does this email need a human reply today?",
          criteria: {
            true: "Outage, money at risk, or an explicit deadline.",
            false: "FYI, general question, or it can wait until tomorrow.",
          },
        },
        frustration: {
          type: "score",
          instructions: "How frustrated is the customer who wrote this email?",
          criteria: ["Calm", "Annoyed but civil", "Angry or threatening to leave"],
        },
      },
    });
    expect(result?.variant).toBe("triage-v1");
    expect(result?.answers.urgent.type).toBe("noul");
    expect(result?.answers.frustration.type).toBe("score");
    expect(result?.thresholds.urgent).toBe(0.8);
  });

  it("skips Jev entirely when the kill switch is off", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jev-ws-"));
    cpSync(WORKSPACE_DIR, dir, { recursive: true });
    const flagPath = join(dir, "feature-flags", "jev.enabled.json");
    const flag = JSON.parse(readFileSync(flagPath, "utf8"));
    flag.default.rules[0].value.value = false;
    writeFileSync(flagPath, JSON.stringify(flag));

    const { config } = await initConfig({ datadir: dir });
    const { client, requests } = recordingClient();
    const triage = createTriage(config, client);

    expect(await triage("anything", { key: "u1", plan: "pro" })).toBeNull();
    expect(requests).toHaveLength(0);
  });
});

describe("client selection", () => {
  it("routes through Vercel AI Gateway when only AI_GATEWAY_API_KEY is set", () => {
    const client = createTypeSafeClient({ AI_GATEWAY_API_KEY: "vck_test" });
    expect(client.baseURL).toBe(AI_GATEWAY_TYPESAFE_URL);
  });

  it("prefers TypeSafe directly when TYPESAFE_API_KEY is set", () => {
    const client = createTypeSafeClient({ TYPESAFE_API_KEY: "ts_test", AI_GATEWAY_API_KEY: "vck_test" });
    expect(client.baseURL).toBe("https://api.typesafe.ai");
  });
});

describe("failure path", () => {
  it("returns null (non-AI path) when Jev answers with an error, instead of throwing", async () => {
    const { config } = await initConfig();
    const client = new TypeSafeClient({
      apiKey: "test",
      retry: { maxRetries: 0 },
      fetch: async () =>
        new Response(JSON.stringify({ error: { message: "nope", type: "customer_verification_required" } }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    });
    const triage = createTriage(config, client);
    await expect(triage("Everything is down!!", { key: "u1", plan: "pro" })).resolves.toBeNull();
  });
});
