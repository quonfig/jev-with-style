import { TypeSafeClient } from "@typesafe-ai/sdk";
import { mockJevFetch } from "./mock-jev";

/**
 * Two ways to reach Jev, picked by whether a key is present:
 *  - TYPESAFE_API_KEY → api.typesafe.ai
 *  - no key           → local mock, same request shape, fake answers
 */
export function createTypeSafeClient(env: NodeJS.ProcessEnv = process.env): TypeSafeClient {
  if (env.TYPESAFE_API_KEY) return new TypeSafeClient({ apiKey: env.TYPESAFE_API_KEY });
  console.warn("[jev] no TYPESAFE_API_KEY: using a local mock. Same request shape, fake answers.");
  return new TypeSafeClient({ apiKey: "mock", fetch: mockJevFetch });
}
