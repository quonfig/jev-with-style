import { Quonfig } from "@quonfig/node";
import { fileURLToPath } from "node:url";
import { QuonfigTypesafeNode } from "../generated/quonfig-server";

/** The workspace checked into this repo: schemas/, configs/, feature-flags/. */
export const WORKSPACE_DIR = fileURLToPath(new URL("../quonfig", import.meta.url));

/**
 * One client, two ways to feed it, same code either way:
 *
 *  - No account: read the workspace straight from ./quonfig (datadir mode).
 *    Edit a JSON file, restart, done. Free and open source.
 *  - Quonfig cloud: set QUONFIG_BACKEND_SDK_KEY and the same keys arrive over
 *    SSE. Edit prompts and thresholds in the UI, no deploy.
 */
export function createQuonfig(overrides: { datadir?: string } = {}): Quonfig {
  const sdkKey = process.env.QUONFIG_BACKEND_SDK_KEY;
  if (sdkKey && !overrides.datadir) {
    return new Quonfig({ sdkKey });
  }
  return new Quonfig({
    datadir: overrides.datadir ?? WORKSPACE_DIR,
    environment: process.env.QUONFIG_ENVIRONMENT ?? "development",
  });
}

/**
 * Typed accessors generated from the workspace by `qfg generate`, plus a
 * `close()` that ends the SSE stream so short-lived scripts can exit.
 */
export async function initConfig(
  overrides: { datadir?: string } = {},
): Promise<{ config: QuonfigTypesafeNode; close: () => void }> {
  const client = createQuonfig(overrides);
  await client.init();
  return { config: new QuonfigTypesafeNode(client), close: () => client.close() };
}
