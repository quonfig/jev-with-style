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
│ 2       │ 'e3'  │ 'enterprise' │ 0.22      │ 1           │ false │ false           │
└─────────┴───────┴──────────────┴───────────┴─────────────┴───────┴─────────────────┘
```

(Those are real Jev answers from model `jev-1.13.0`, 160 to 290 ms per email.
The mock's numbers are in the same ballpark by construction.)

Set `TYPESAFE_API_KEY` and the same command uses real Jev. Set
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
examples/                        the same call at five levels of config (see the post's addendum)
  1-inline/                      no config: everything inline with noul()/score()
  2-knobs/                       prompt strings, threshold, model, kill switch; no schema
  4-all-config/                  one generic Jev schema; thresholds are flag rules
  6-live/                        the pasted jev-questions schema, live from Quonfig cloud, targeted per customer
  (level 3, the schema-bound decision, is the main workspace above)
```

## Live from Quonfig cloud, per customer (examples/6-live)

This is the version the blog post walks through. It needs a Quonfig workspace
and a Jev key.

1. In your workspace, go to **Schemas**, click **+ Add Schema**, set the key to
   `jev-questions` and paste the schema from
   [Using Jev with Quonfig](https://docs.quonfig.com/docs/how-tos/jev) (the same
   file is `examples/4-all-config/quonfig/schemas/jev-questions.json`).
2. On the schema's page, click **+ Add config using this schema**. Name it
   `support.triage.questions` and add your questions in the form. Add a
   `jev.model` string config set to `jev-latest`.
3. Optional: add rules on `customer.plan` or `customer.key`. Each rule holds
   its own full set of questions.
4. Run it:

```sh
export QUONFIG_BACKEND_SDK_KEY=...   # a backend SDK key for that workspace
export TYPESAFE_API_KEY=...
npm run live -- --watch
```

The runner sends three sample emails from three customers (Acme, enterprise;
Globex, pro; Initech, free) and prints each answer. With `--watch` it keeps
running: save a change in the app and the next run uses the new questions,
with no restart.

`examples/6-live/triage-typed.ts` is the same call with typed accessors. Its
`generated/` folder was generated from our demo workspace; regenerate it from
yours with `@quonfig/cli` 0.2.0 or later:

```sh
npx @quonfig/cli@latest generate --targets node-ts -w <your-org>/<your-workspace> -o examples/6-live/generated
```

`examples/6-live/probe-limits.ts` checks a few edges of the Jev API (needs
only `TYPESAFE_API_KEY`).

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
