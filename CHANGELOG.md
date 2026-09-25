# changelog

all notable changes to `n8n-nodes-crawlbrulee` are documented here.

this project follows [Semantic Versioning](https://semver.org). while on `0.x`, minor versions may include breaking changes.

## 0.2.0 (unreleased)

the api now treats a page as data: a page the site really served comes back as a normal result, whatever its own HTTP status, and a new error covers a site we could not reach at all. this release follows it.

### added

- **Scrape URL**, **Get Scrape Result** and the **crawlbrulee Trigger** pass through `page_status_code`, the HTTP status the site answered with for the final page. a 404, 410 or 503 page is a normal item with its content, not a node error, so "On Error" does not catch it. a notice on both operations and on the trigger says where the status is; the readme shows how to branch on it with an If node.
- the new cost fields in `response_meta.usage` pass through: `total_credit_cost`, `engine_credit_cost`, `proxy_multiplier` and `screenshot_slicing_credit_cost` (map has no slicing field). the readme explains each one.
- a clear message for the new `target_unreachable` error (HTTP 502): the site could not be reached, so check the url and try again later.

### changed

- the readme uses the new cost names. `credits` and `screenshot_slices` still come through with the same values, but they are deprecated and will be removed in a future version.

### compatibility

- nothing is removed and no field is renamed. responses without the new fields still work, and the node never strips a field it does not know.

## 0.1.0 (2026-09-23)

### added

- the **crawlbrulee** node: Scrape URL, Scrape URL (Async), Get Scrape Status, Get Scrape Result (all under Scrape), Map Website, Get Credit Usage, Get Account Info. optional screenshot download into binary data. usable as an AI Agent tool.
- the **crawlbrulee Trigger** node: fires on `scrape.complete` deliveries, verifies the signature when a signing secret is set, drops repeats of the same event, and can fetch the result in the same step.
- the **crawlbrulee API** credential with a zero-cost whoami test.
