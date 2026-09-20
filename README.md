# Jev, with style

[Jev](https://typesafe.ai) answers typed questions about text with calibrated
probabilities. This repo shows how to run it **with the questions, model, and
thresholds in config instead of code**, using [Quonfig](https://quonfig.com):
a git-native config and feature-flag system that is free to use from disk and
needs no account.

The blog post that walks through it: _Plugging in Jev with style_ (link TBD).

## Try it in 30 seconds

```sh
git clone https://github.com/quonfig/jev-with-style
cd jev-with-style
npm install
npm run demo
```

No keys needed. The Quonfig workspace is read straight from `./quonfig`, and a
local mock stands in for Jev (same request shape, fake answers).

```
model: jev-latest   jev.enabled: true   variant: triage-v1

┌─────────┬───────┬──────────────┬───────────┬─────────────┬───────┬─────────────────┐
│ (index) │ email │ plan         │ P(urgent) │ frustration │ paged │ retention offer │
├─────────┼───────┼──────────────┼───────────┼─────────────┼───────┼─────────────────┤
│ 0       │ 'e1'  │ 'pro'        │ 0.94      │ 2           │ true  │ true            │
│ 1       │ 'e2'  │ 'free'       │ 0.06      │ 0           │ false │ false           │
│ 2       │ 'e3'  │ 'enterprise' │ 0.21      │ 1           │ false │ false           │
└─────────┴───────┴──────────────┴───────────┴─────────────┴───────┴─────────────────┘
```

(Those are real Jev answers, via Vercel AI Gateway, 276 to 429 ms per email. The
mock's numbers are in the same ballpark by construction.)

Set `TYPESAFE_API_KEY` and the same command uses real Jev. Set
`AI_GATEWAY_API_KEY` instead to reach Jev through
[Vercel AI Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe)
(its model id is `typesafe-ai/jev`; `jev.model` is the config for that). Set
`QUONFIG_BACKEND_SDK_KEY` and the same command reads its config live from
Quonfig cloud instead of disk. The code does not change.

## What's where

```
quonfig/                         the workspace (plain JSON in git)
  schemas/jev-triage.json        JSON Schema for a Jev decision: questions + thresholds
  configs/support.triage.jev.json  the questions, rubric, timeout, thresholds
  configs/jev.model.json         which Jev model to call (pin prod, ride latest in dev)
  feature-flags/jev.enabled.json kill switch
  feature-flags/promo.retention-10pct.json  ordinary targeting on a stored attribute
generated/                       typed accessors from `qfg generate` (checked in)
src/jev.ts                       the glue: config -> Jev request
src/support-worker.ts            judge once at ingest, store a number on the user
src/mock-jev.ts                  keyword heuristics behind the real TypeSafe client
src/demo.ts                      three sample emails through the whole flow
```

## Edit a prompt

Change the wording in `quonfig/configs/support.triage.jev.json` and run the
demo again. Or push the workspace to Quonfig cloud and edit it in a form
generated from the schema:

```sh
npx qfg login
npx qfg push --dir quonfig --workspace <your-org>/<your-workspace>
```

After changing the schema, regenerate the typed accessors:

```sh
npm run generate
```

## Tests

```sh
npm test
```

The tests cover: typed reads from the on-disk workspace (including the
`{{plan}}` placeholder rendered into the prompt), the exact request body sent
to `/v1/systemone`, the kill switch, and the end-to-end worker flow.
