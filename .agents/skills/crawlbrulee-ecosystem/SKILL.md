---
name: crawlbrulee-ecosystem
description: Use when working in this repo to recall it is the n8n integration for crawlbrulee, and where the api contract and the official client libraries live.
---

# crawlbrulee ecosystem (pointer)

This repository is the **n8n integration** for [crawlbrulee](https://crawlbrulee.com), an
EU-native web scraping api. It ships as the npm package `n8n-nodes-crawlbrulee`: two nodes
and one credential, MIT, with no runtime dependencies.

**The api is the contract.** Everything this node sends and receives is the public api,
documented at <https://crawlbrulee.com/docs>, with the OpenAPI spec at
<https://crawlbrulee.com/docs/openapi.json>. When behaviour here and the api disagree, the
api wins.

**Official client libraries**, if you need a reference implementation of the same
endpoints:

| tool | package |
|---|---|
| TypeScript/JavaScript SDK | npm `@crawlbrulee/sdk` |
| Python SDK | PyPI `crawlbrulee` |
| MCP server | npm `@crawlbrulee/mcp` |
| CLI | npm `crawlbrulee` |
| agent skills | <https://github.com/crawlbrulee/crawlbrulee-skills> |

This repo depends on `@crawlbrulee/sdk` for **types only**, as a dev dependency, because a
verified n8n node may not ship runtime dependencies.

If this checkout sits next to the maintainer's other crawlbrulee repos, a wider
`crawlbrulee-ecosystem` skill is available one level up and is the better source for
anything spanning repos. It is absent from a standalone clone, which is fine: everything
this repo needs is in this repo.

Read `AGENTS.md` for the rules that apply inside this repo.
