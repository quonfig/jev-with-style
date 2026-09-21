/**
 * Writes the derived schema into the workspace and seeds the config from the
 * declared defaults if it doesn't exist yet. Run after changing the
 * declaration; commit the result. In CI, run it and fail if `git diff` is
 * non-empty, the same way you'd guard any generated file.
 *
 *   npx tsx examples/5-declared/sync-schema.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { triage } from "./triage";

const ws = join(dirname(fileURLToPath(import.meta.url)), "quonfig");

for (const decision of [triage]) {
  const schemaPath = join(ws, "schemas", `${decision.key}.json`);
  mkdirSync(dirname(schemaPath), { recursive: true });
  writeFileSync(schemaPath, JSON.stringify(decision.schema, null, 2) + "\n");
  console.log(`wrote ${schemaPath}`);

  const configPath = join(ws, "configs", `${decision.key}.json`);
  if (existsSync(configPath)) continue;
  const config = {
    key: decision.key,
    type: "config",
    valueType: "json",
    schemaKey: decision.key,
    description: "Seeded from the declaration in code. Edit freely; the schema keeps the shape.",
    default: {
      rules: [{ criteria: [{ operator: "ALWAYS_TRUE" }], value: { type: "json", value: decision.defaults } }],
    },
    environments: [],
    variants: [],
  };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`seeded ${configPath}`);
}
