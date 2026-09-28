import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// qfg-q5f6.14: `qfg generate` emits the Jev schema's tagged oneOf as a union and the score rubric
// (`minItems: 2`, no `maxItems`) as a tuple with a rest element. `tsc -p examples/4-all-config`
// proves the type is assignable to `Questions` with no cast, but tsc would still pass if the rest
// element were dropped (`[string, string]` is assignable too), so check the emitted text as well.
const example = new URL("../examples/4-all-config/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, example), "utf8");

describe("examples/4-all-config generated types", () => {
  it("types the score rubric as a tuple with a rest element", () => {
    expect(read("generated/quonfig-server-types.d.ts")).toContain('"criteria": [string, string, ...string[]]');
  });

  it("types each question as a union of the three Jev question shapes", () => {
    const types = read("generated/quonfig-server-types.d.ts");
    expect(types).toContain('"type": "noul"');
    expect(types).toContain('"type": "score"');
    expect(types).toContain('"type": "choice"');
  });

  it("passes the questions to Jev with no cast", () => {
    expect(read("triage.ts")).not.toMatch(/as unknown as Questions/);
  });
});
