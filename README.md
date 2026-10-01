# Jev, with style

[Jev](https://typesafe.ai) answers typed questions about text with calibrated
probabilities. This repo shows how to run it **with the questions, model, and
thresholds in config instead of code**, using [Quonfig](https://quonfig.com):
a git-native config and feature-flag system that is free to use from disk and
needs no account.

The blog post that walks through it: [Plugging in Jev with style](https://quonfig.com/blog/plugging-in-jev-with-style).

## Try it in 30 seconds

```sh
git clone https://github.com/quonfig/jev-with-style
cd jev-with-style
npm install
npm run demo
```

No keys needed. This is the version the blog post walks through: one pasted
`jev-questions` schema, and a `support.triage.questions` config with its own
question set per customer. The workspace is read straight from
`examples/6-live/quonfig`, and a local mock stands in for Jev (same request
shape, fake answers):

```
Acme Corp (enterprise, US)  14ms
  churn_risk       P(yes)=0.58
  frustration      score=1.15
  topic            choice=billing
  urgent           P(yes)=0.58

Globex GmbH (pro, DE)  1ms
  frustration      score=0
  language         choice=de
  topic            choice=billing
  urgent           P(yes)=0.08

Initech (free, US)  0ms
  frustration      score=0
  refund_request   P(yes)=0.08
  topic            choice=billing
  urgent           P(yes)=0.08
```

Acme (enterprise) is asked `churn_risk`, Globex is asked `language`, and
everyone else gets the default set. The post shows the same run against real
Jev (`jev-1.13.0`).

Set `TYPESAFE_API_KEY` and the same command uses real Jev. Set
`QUONFIG_BACKEND_SDK_KEY` and it reads its config live from Quonfig cloud
instead of disk. The code does not change.

## Live from Quonfig cloud, per customer

To edit the questions in a form and watch a running process pick them up:

1. In your workspace, go to **Schemas**, click **+ Add Schema**, set the key to
   `jev-questions` and paste the schema from
   [Using Jev with Quonfig](https://docs.quonfig.com/docs/how-tos/jev) (the same
   file is `examples/6-live/quonfig/schemas/jev-questions.json`).
2. On the schema's page, click **+ Add config using this schema**. Name it
   `support.triage.questions` and add your questions in the form. Add a
   `jev.model` string config set to `jev-latest`.
3. Optional: add rules on `customer.plan` or `customer.key`. Each rule holds
   its own full set of questions. Or push this repo's copy:
   `npx qfg push --dir examples/6-live/quonfig --workspace <your-org>/<your-workspace>`.
4. Run it:

```sh
export QUONFIG_BACKEND_SDK_KEY=...   # a backend SDK key for that workspace
export TYPESAFE_API_KEY=...
npm run live -- --watch
```

With `--watch` it keeps running: save a change in the app and the next run
uses the new questions, with no restart.

`examples/6-live/triage-typed.ts` is the same call with typed accessors from
`qfg generate` (`@quonfig/cli` 0.2.0 or later): the generated type is Jev's own
question union, so it passes to `systemOne` with no cast.

`examples/6-live/probe-limits.ts` checks a few edges of the Jev API (needs
only `TYPESAFE_API_KEY`).

## What's where

```
examples/6-live/                 the version in the blog post (`npm run demo`)
  quonfig/schemas/jev-questions.json          the pasted schema: any Jev question set
  quonfig/configs/support.triage.questions.json  the questions, with enterprise + globex rules
  quonfig/configs/jev.model.json              which Jev model to call
  triage.ts                      the call: context in, question set forwarded to Jev
  triage-live.ts                 the runner: three customers, optional --watch
  triage-typed.ts                the same call with generated types
examples/                        the same call at other levels of config
  1-inline/                      no config: everything inline with noul()/score()
  2-knobs/                       prompt strings, threshold, model, kill switch; no schema
  4-all-config/                  one generic Jev schema; thresholds are flag rules
  5-declared/                    declared in code with noul()/score(); schema derived from it
quonfig/, src/, generated/       a hand-written schema per decision (`npm run demo:schema-bound`)
  src/support-worker.ts          judge once at ingest, store a number on the user
src/mock-jev.ts                  keyword heuristics behind the real TypeSafe client
```

## Edit a prompt

Change the wording in `examples/6-live/quonfig/configs/support.triage.questions.json`
and run the demo again. Or push the workspace to Quonfig cloud and edit it in a form
generated from the schema:

```sh
npx qfg login
npx qfg push --dir examples/6-live/quonfig --workspace <your-org>/<your-workspace>
```

After changing a schema, regenerate the typed accessors:

```sh
npm run generate:examples
```

## Tests

```sh
npm test
```

The tests cover: each customer getting its own question set in the
`examples/6-live` workspace, typed reads from the on-disk workspace (including the
`{{plan}}` placeholder rendered into the prompt), the exact request body sent
to `/v1/systemone`, the kill switch, and the end-to-end worker flow.
