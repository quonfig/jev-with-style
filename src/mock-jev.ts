import type { Fetch } from "@typesafe-ai/sdk";

/**
 * A stand-in for api.typesafe.ai so the demo runs without an API key.
 *
 * It is handed to the REAL TypeSafe client as its `fetch`, so the request the
 * SDK builds (state, questions, model, headers) is exactly what production
 * would send. Only the answers are fake: keyword heuristics that return the
 * same response shape Jev does (`noul` probability, `score` with legend and
 * probabilities, `choice` with confidence). Swap in TYPESAFE_API_KEY and the
 * rest of the code does not change.
 */

const URGENT = [/\basap\b/, /\burgent/, /outage/, /\bdown\b/, /\btoday\b/, /deadline/, /right now/];
const MONEY = [/charged/, /refund/, /invoice/, /\bmoney\b/, /double[- ]bill/];
const ANGRY = [/furious/, /unacceptable/, /\bcancel/, /ridiculous/, /pissed/, /!!/, /\bworst\b/, /disappointed/, /fed up/, /competitor/];

const hits = (text: string, patterns: RegExp[]) => patterns.filter((p) => p.test(text)).length;
const round = (n: number) => Math.round(n * 1000) / 1000;

type MockQuestion =
  | { type: "noul"; instructions?: unknown; criteria?: { true?: unknown; false?: unknown } | null }
  | { type: "score"; instructions?: unknown; criteria: unknown[] }
  | { type: "choice"; instructions?: unknown; criteria: Record<string, unknown> };

function answer(question: MockQuestion, text: string) {
  const urgent = hits(text, URGENT);
  const angry = hits(text, ANGRY);

  if (question.type === "noul") {
    const p = Math.min(0.99, 0.08 + 0.42 * Math.min(urgent, 2) + 0.08 * Math.min(hits(text, MONEY), 1));
    return { type: "noul", noul: round(p) };
  }

  if (question.type === "score") {
    const top = question.criteria.length - 1;
    const score = Math.min(top, (Math.min(angry, 2) / 2) * top + 0.15 * Math.min(urgent, 1));
    const lo = Math.floor(score);
    const hi = Math.min(top, lo + 1);
    const frac = score - lo;
    const probabilities: Record<string, number> = {};
    const legend: Record<string, unknown> = {};
    question.criteria.forEach((label, i) => {
      legend[String(i)] = label;
      probabilities[String(i)] = i === lo ? round(1 - frac) : i === hi ? round(frac) : 0;
    });
    return { type: "score", score: round(score), confidence: 0.85, legend, probabilities };
  }

  const labels = Object.keys(question.criteria);
  const scored = labels.map((label) => {
    const haystack = `${label} ${JSON.stringify(question.criteria[label] ?? "")}`.toLowerCase();
    // Match on word stems, so "charges" in a label counts "charged" in the email.
    const stems = (haystack.match(/[a-z]{5,}/g) ?? []).map((w) => w.slice(0, 5));
    return { label, n: stems.filter((stem) => text.includes(stem)).length };
  });
  const winner = scored.reduce((a, b) => (b.n > a.n ? b : a), scored[0]);
  const probabilities: Record<string, number> = {};
  for (const { label } of scored) probabilities[label] = label === winner.label ? 0.7 : round(0.3 / Math.max(1, labels.length - 1));
  return { type: "choice", choice: winner.label, confidence: 0.7, probabilities };
}

export const mockJevFetch: Fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    state?: unknown;
    model?: string;
    questions?: Record<string, MockQuestion>;
  };
  const text = JSON.stringify(body.state ?? "").toLowerCase();
  const answers: Record<string, unknown> = {};
  for (const [name, question] of Object.entries(body.questions ?? {})) {
    answers[name] = answer(question, text);
  }
  const payload = {
    model: `${body.model ?? "jev-latest"} (mock)`,
    answers,
    usage: { input_tokens: Math.ceil(text.length / 4), output_tokens: 0 },
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "x-typesafe-request-id": `mock-${Date.now()}` },
  });
};
