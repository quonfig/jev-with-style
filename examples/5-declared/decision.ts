/**
 * Level 5: declared in code. The TypeSafe builders ARE the schema.
 *
 * Code declares each decision once: question names, types, default wording,
 * default rubric, default thresholds. From that one declaration we derive
 *   - the TypeScript contract (inferred, nothing restated, no cast),
 *   - the JSON Schema the Quonfig form editor renders and validates against,
 *   - the default config value, so the workspace can start from the code.
 * Nothing is typed from data: `{{placeholders}}` are read off the declared
 * prompt's literal type, and the derived schema refuses any other placeholder
 * at save time.
 */
import type { NoulQuestion, Questions, ScoreCriteria, ScoreQuestion } from "@typesafe-ai/sdk";

// `{{plan}}` in a string LITERAL type becomes a required parameter. No codegen.
type Params<S extends string> = S extends `${string}{{${infer P}}}${infer R}` ? P | Params<R> : never;
type ParamsOf<Q> = Q extends { instructions: infer S extends string } ? Params<S> : never;
export type VarsOf<Q extends Questions> = [ParamsOf<Q[keyof Q]>] extends [never]
  ? Record<never, never>
  : { [K in ParamsOf<Q[keyof Q]>]: string };

// Same shape as TypeSafe's noul()/score(), but they keep the prompt's literal type.
export const noul = <const S extends string>(instructions: S, criteria?: NoulQuestion["criteria"]) =>
  ({ type: "noul", instructions, criteria }) as const satisfies NoulQuestion;
export const score = <const S extends string, const T extends ScoreCriteria>(instructions: S, criteria: T) =>
  ({ type: "score", instructions, criteria }) as const satisfies ScoreQuestion<T>;

export type Decision<Q extends Questions, Th extends Record<string, number>> = {
  questions: Q;
  thresholds: Th;
  timeoutMs?: number;
};

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** A string field that may only contain the placeholders the code will pass. */
function instructionsSchema(defaultText: string) {
  const names = [...defaultText.matchAll(PLACEHOLDER)].map((m) => m[1]);
  const allowed = names.length ? `\\{\\{\\s*(${names.join("|")})\\s*\\}\\}` : "(?!)";
  return {
    type: "string",
    description: names.length ? `Placeholders available: ${names.map((n) => `{{${n}}}`).join(", ")}` : "No placeholders.",
    pattern: `^(?:[^{]|\\{(?!\\{)|${allowed})*$`,
    default: defaultText,
  };
}

/** The JSON Schema for one decision, derived from its declaration. */
export function jsonSchema<Q extends Questions, Th extends Record<string, number>>(key: string, d: Decision<Q, Th>) {
  const questions: Record<string, unknown> = {};
  for (const [name, q] of Object.entries(d.questions)) {
    const instructions = typeof q.instructions === "string" ? instructionsSchema(q.instructions) : { type: "string" };
    if (q.type === "noul") {
      questions[name] = {
        type: "object",
        required: ["type"],
        additionalProperties: false,
        properties: {
          type: { const: "noul" },
          instructions,
          criteria: {
            type: "object",
            additionalProperties: false,
            properties: { true: { type: "string" }, false: { type: "string" } },
            default: q.criteria ?? undefined,
          },
        },
      };
    } else if (q.type === "score") {
      // The inferred answer type asserts this exact number of levels, and the
      // thresholds only mean something on this scale. Wording is live; count is code.
      questions[name] = {
        type: "object",
        required: ["type", "criteria"],
        additionalProperties: false,
        properties: {
          type: { const: "score" },
          instructions,
          criteria: {
            type: "array",
            description: `Ordered rubric, exactly ${q.criteria.length} levels. Index 0 is the lowest score.`,
            minItems: q.criteria.length,
            maxItems: q.criteria.length,
            items: { type: "string" },
            default: q.criteria,
          },
        },
      };
    } else {
      const labels = Object.keys(q.criteria);
      questions[name] = {
        type: "object",
        required: ["type", "criteria"],
        additionalProperties: false,
        properties: {
          type: { const: "choice" },
          instructions,
          criteria: {
            type: "object",
            required: labels,
            additionalProperties: false,
            properties: Object.fromEntries(labels.map((l) => [l, { type: "string" }])),
            default: q.criteria,
          },
        },
      };
    }
  }
  const thresholds = Object.fromEntries(
    Object.entries(d.thresholds).map(([k, v]) => [k, { type: "number", minimum: 0, maximum: 1, default: v }]),
  );
  return {
    title: key,
    type: "object",
    required: ["questions", "thresholds"],
    additionalProperties: false,
    properties: {
      questions: { type: "object", required: Object.keys(d.questions), additionalProperties: false, properties: questions },
      thresholds: { type: "object", required: Object.keys(d.thresholds), additionalProperties: false, properties: thresholds },
      timeoutMs: { type: "integer", minimum: 50, maximum: 5000, default: d.timeoutMs ?? 2000 },
    },
  };
}

export function defineDecision<const Q extends Questions, const Th extends Record<string, number>>(
  key: string,
  d: Decision<Q, Th>,
) {
  return {
    key,
    schema: jsonSchema(key, d),
    defaults: d,

    /**
     * Today's config value (from Quonfig) over the declared defaults, with
     * placeholders rendered, typed exactly as the declaration. The derived
     * schema already rejected anything off-shape at save time.
     */
    resolve(raw: unknown, vars: VarsOf<Q>): Decision<Q, Th> {
      const cfg = (raw && typeof raw === "object" ? raw : {}) as {
        questions?: Record<string, Partial<Questions[string]>>;
        thresholds?: Partial<Th>;
        timeoutMs?: number;
      };
      const questions = Object.fromEntries(
        Object.entries(d.questions).map(([name, q]) => {
          const o = cfg.questions?.[name] ?? {};
          const text = typeof o.instructions === "string" ? o.instructions : String(q.instructions ?? "");
          const instructions = text.replace(PLACEHOLDER, (_, p: string) => (vars as Record<string, string>)[p] ?? "");
          const criteria =
            q.type === "score"
              ? Array.isArray(o.criteria) && o.criteria.length === q.criteria.length
                ? o.criteria
                : q.criteria
              : (o.criteria ?? q.criteria);
          return [name, { ...q, instructions, criteria }];
        }),
      ) as unknown as Q;
      return { questions, thresholds: { ...d.thresholds, ...cfg.thresholds }, timeoutMs: cfg.timeoutMs ?? d.timeoutMs };
    },
  };
}
