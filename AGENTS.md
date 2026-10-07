# Agent context

This file is auto-loaded by coding agents (Claude Code, Codex, Gemini CLI, and others).

## This repo

The **crawlbrulee app for n8n** (npm `n8n-nodes-crawlbrulee`). The api it calls is the
public one at <https://crawlbrulee.com/docs>; where this repo and the api disagree, the api
wins. The `crawlbrulee-ecosystem` skill in `.agents/skills/` has the wider context, and
points at the maintainer's fuller version of that skill when this checkout sits beside the
other crawlbrulee repos.

**What ships:** the `crawlbrulee` node — Scrape (Scrape URL, Scrape URL (Async), Get Scrape
Status, Get Scrape Result), Map (Map Website), Account (Get Credit Usage, Get Account Info)
— the `crawlbrulee Trigger` node (the `scrape.complete` webhook), and the `crawlbruleeApi`
credential. Programmatic node style, TypeScript, pnpm, vitest.

**Zero runtime dependencies — hard rule.** A verified n8n node may not ship any, so
`dependencies` in `package.json` must stay empty. `@crawlbrulee/sdk` is a **dev**
dependency and every import from it must be `import type`, so nothing of it reaches
`dist`. For the same reason the webhook signature check runs on the Web Crypto global
(`crypto.subtle`), never on `node:crypto`.

**License is MIT**, not the Apache-2.0 the other client tools use. n8n's verification
requires MIT. This repo is the one exception; don't "fix" it to match the others.

**The lint gate matters.** `pnpm lint` runs the same rule set as n8n's review scan
(`npx @n8n/scan-community-package`). Keep it at zero errors — a lint failure is a
verification failure. `pnpm verify` runs lint, typecheck, tests and build together.

**Releasing.** Bump the version and `CHANGELOG.md` in a commit on `main`, and bump `USER_AGENT` in
`nodes/Crawlbrulee/transport/request.ts` to match — a test fails if the two drift. The user pushes
the `vX.Y.Z` tag, which publishes to npm. After each publish, run
`npx @n8n/scan-community-package n8n-nodes-crawlbrulee` against the published package. First release
only: submit the package in the n8n Creator Portal (https://creators.n8n.io/nodes).

**Where things are written down:** `README.md` is for n8n users only, with no maintainer
steps in it. Everything else is the code and its tests — treat them as the contract, and
the public api docs at <https://crawlbrulee.com/docs> as the source of truth above both.

## releasing

a release is a `vX.Y.Z` tag pushed on a commit that is already on `main`. the publish
workflow refuses a tag whose commit is not on `origin/main` or whose version doesn't match
`package.json`, runs the checks, publishes with trusted publishing (no tokens anywhere) and
creates the GitHub release.

- bump the version in every place it lives: `package.json` and `USER_AGENT` in `nodes/Crawlbrulee/transport/request.ts`.
- add a dated `CHANGELOG.md` entry. a version that is already published is final: later
  changes get a new version, never an edit to the old entry. check the registry, not local
  tags, to see what is out.
- `@crawlbrulee/sdk` is a type-only dev dependency, but CI still installs with
  `--frozen-lockfile`: after a new sdk is on npm, raise the range and run `pnpm install` before
  you tag. the node must keep shipping no runtime dependencies.
- after the npm publish, run `npx @n8n/scan-community-package n8n-nodes-crawlbrulee@<version>`.
  a verified node must pass it to keep its badge.
