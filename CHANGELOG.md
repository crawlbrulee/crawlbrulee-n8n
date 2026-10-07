# changelog

all notable changes to `n8n-nodes-crawlbrulee` are documented here.

this project follows [Semantic Versioning](https://semver.org). while on `0.x`, minor versions may include breaking changes.

## 0.3.1 (2026-10-07)

### changed

- **Get Scrape Result**, **Get Scrape Status** and **Download Screenshot** say that an async job answers for 24 hours after it was submitted and that screenshot links are signed and expire 24 hours after the scrape. the readme says so too.
- builds against `@crawlbrulee/sdk` 1.2.1 for its types. the node still ships no runtime dependencies.

## 0.3.0 (2026-10-05)

### added

- **zero data retention.** a **Zero Data Retention** option under **Options** of **Scrape URL**, **Scrape URL (Async)** and **Map Website**, `zero_data_retention_credit_cost` in `response_meta.usage` (part of `total_credit_cost`), and a clear message for `zero_data_retention_not_enabled` (HTTP 403). it keeps the result out of the shared cache and must be enabled for your organization. see [zero data retention](https://crawlbrulee.com/docs/zero-data-retention).

### changed

- builds against `@crawlbrulee/sdk` 1.2.0 for its types. the node still ships no runtime dependencies.

### removed

- support for the deprecated usage fields `credits` and `screenshot_slices`. they were the old names of `total_credit_cost` and `screenshot_slicing_credit_cost`. the node never read them, and it still passes the response through untouched.

### compatibility

- nothing else is removed and no field is renamed. the option is off by default and the field is only sent when it is on.

## 0.2.0 (2026-09-30)

the api now treats a page as data: a page the site really served comes back as a normal result, whatever its own HTTP status, and a new error covers a site we could not reach at all. this release follows it.

### added

- **Scrape URL**, **Get Scrape Result** and the **crawlbrulee Trigger** pass through `page_status_code`, the HTTP status the site answered with for the final page. a 404, 410 or 503 page is a normal item with its content, not a node error, so "On Error" does not catch it. a notice on both operations and on the trigger says where the status is; the readme shows how to branch on it with an If node.
- the new cost fields in `response_meta.usage` pass through: `total_credit_cost`, `engine_credit_cost`, `proxy_multiplier` and `screenshot_slicing_credit_cost` (map has no slicing field). the readme explains each one.
- a clear message for the new `target_unreachable` error (HTTP 502): the site could not be reached, so check the url and try again later.

### changed

- builds against `@crawlbrulee/sdk` 1.1.0 for its types. the node still ships no runtime dependencies.
- the readme uses the new cost names. `credits` and `screenshot_slices` still come through with the same values, but they are deprecated and will be removed in a future version.

### compatibility

- nothing is removed and no field is renamed. responses without the new fields still work, and the node never strips a field it does not know.

## 0.1.0 (2026-09-23)

### added

- the **crawlbrulee** node: Scrape URL, Scrape URL (Async), Get Scrape Status, Get Scrape Result (all under Scrape), Map Website, Get Credit Usage, Get Account Info. optional screenshot download into binary data. usable as an AI Agent tool.
- the **crawlbrulee Trigger** node: fires on `scrape.complete` deliveries, verifies the signature when a signing secret is set, drops repeats of the same event, and can fetch the result in the same step.
- the **crawlbrulee API** credential with a zero-cost whoami test.
