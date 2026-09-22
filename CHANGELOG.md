# changelog

all notable changes to `n8n-nodes-crawlbrulee` are documented here.

this project follows [Semantic Versioning](https://semver.org). while on `0.x`, minor versions may include breaking changes.

## 0.1.0 (2026-09-22)

### added

- the **crawlbrulee** node: Scrape URL, Scrape URL (Async), Get Scrape Status, Get Scrape Result (all under Scrape), Map Website, Get Credit Usage, Get Account Info. optional screenshot download into binary data. usable as an AI Agent tool.
- the **crawlbrulee Trigger** node: fires on `scrape.complete` deliveries, verifies the signature when a signing secret is set, drops repeats of the same event, and can fetch the result in the same step.
- the **crawlbrulee API** credential with a zero-cost whoami test.
