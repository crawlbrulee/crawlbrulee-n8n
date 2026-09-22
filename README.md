# 🍮 crawlbrulee for n8n

[![npm](https://img.shields.io/npm/v/n8n-nodes-crawlbrulee?style=flat-square&label=npm)](https://www.npmjs.com/package/n8n-nodes-crawlbrulee)
[![license](https://img.shields.io/npm/l/n8n-nodes-crawlbrulee?style=flat-square&label=license)](./LICENSE)

**EU-native web scraping for AI agents & developers.**

put crawlbrulee in your n8n workflows. this community node package turns any url into clean markdown, html, links, images, metadata or a screenshot, maps a site's urls, and starts a workflow when a background scrape finishes. it also works as an [AI Agent](https://docs.n8n.io/advanced-ai/) tool, so an agent in n8n can scrape a page on its own.

- **everything runs in the EU.** the fetch, the render, the cache and your result never leave EU servers. the proxy exit is the one hop you choose: pick an EU exit and nothing leaves at all. gdpr-aligned, with a data processing agreement.
- **output made for models.** markdown with the page chrome stripped and the links kept, ready for the prompt. full-page screenshots can come back as tiles sized for an image model.
- **the hard parts, handled.** headless Chrome when a page needs it, rotating proxies with country selection, automatic retries, ad and cookie-banner removal, caching, background jobs and signed webhooks.
- **start free.** 750 credits, no credit card.

**get a free api key** → [dashboard.crawlbrulee.com](https://dashboard.crawlbrulee.com)

the package ships the **crawlbrulee** node (7 operations), the **crawlbrulee Trigger** node, and the **crawlbrulee API** credential. this readme covers them. for how the api behaves — endpoints, parameters, limits and errors — see the [api docs](https://crawlbrulee.com/docs).

---

## install

**n8n Cloud:** once the node is verified, open the node panel, search for "crawlbrulee", and pick the node. n8n installs it for you.

**self-hosted:** go to **Settings → Community Nodes → Install**, enter `n8n-nodes-crawlbrulee`, and confirm.

on self-hosted n8n, an AI Agent can only use a community node as a tool when the env var `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` is `true`.

## credentials

create an api key in the [dashboard](https://dashboard.crawlbrulee.com), then add a **crawlbrulee API** credential in n8n:

| field | what to put in it |
|---|---|
| API Key | your key, starting with `cwbl_`. required. |
| Base URL | leave as is. |
| Webhook Signing Secret | optional. starts with `whsec_`, from the dashboard under **Account → Webhooks**. |

the **crawlbrulee Trigger** checks deliveries against that secret; leave it empty and it takes them as they come. saving the credential makes a whoami call, so a bad key fails right there, at no credit cost.

## the crawlbrulee node

pick a resource, then an operation:

| resource | operation | what it does |
|---|---|---|
| Scrape | Scrape URL | fetch one url, get back the content you asked for |
| Scrape | Scrape URL (Async) | start a background job, get back its job id |
| Scrape | Get Scrape Status | pending, running, done or failed |
| Scrape | Get Scrape Result | the content of a finished job |
| Map | Map Website | a site's urls, from its sitemap and its homepage links |
| Account | Get Credit Usage | credits used and left this billing cycle, plus your concurrency limit |
| Account | Get Account Info | the organization and token behind the api key |

### scrape fields

every field has a hint in n8n. three things the hints don't tell you:

- **Extract** gives you exactly what you tick: the node sends every output you left unticked as an explicit "no", so the api's own defaults never add one.
- a **Screenshot** renders the page in a real browser and is billed at the screenshot rate, the priciest one — leave it on None when you don't need the image.
- **Scrape URL (Async)** takes the same fields as **Scrape URL**, minus **Download Screenshot** (a submit gives you a job id, not an image), plus **Webhook URL** and **Webhook Metadata**.

### screenshots as files

turn on **Download Screenshot** — it's on **Scrape URL** and on **Get Scrape Result** — and the node attaches the image as binary data under `screenshot`, plus one key per tile (`screenshot_slice_0`, `screenshot_slice_1`, …) when you set Slice Height. the urls stay in the json too. a download can fail, since a signed url can expire; the item still comes through with its page content and the reason lands on the json as `screenshot_download_error`.

### what comes back

one item in, one item out: the api's json body becomes the item's `json`, unchanged. scrape, map and finished-job responses carry `response_meta.usage`, so the credits a call cost are in front of you. **Map Website** adds `pagination` and `truncation` there, and its **Limit** starts at 50 in n8n, not the api's 5000 — n8n's rule for a field named Limit sets that, so raising it is usually the first thing you do. the [api docs](https://crawlbrulee.com/docs) have the full response shape.

set the node's "On Error" setting to continue and a failed item comes back as `{ "error": "…" }` instead of stopping the run.

## the crawlbrulee Trigger

use it to react to a background scrape instead of polling for it:

1. add a **crawlbrulee Trigger**, give it the same credential, and copy the webhook url it shows.
2. paste that url into the **Webhook URL** field of a **Scrape URL (Async)** operation.
3. when the job finishes, we post one `scrape.complete` event there and the trigger fires.

the item carries the event id, the timestamp and the job data. turn on **Fetch Result** and, for a job that succeeded, the trigger fetches the page content into `result`; if that fetch fails, the reason lands in `result_error` and the item still comes through.

with the secret set, the trigger checks the HMAC-SHA256 signature on every delivery. it drops one that fails the check, one that isn't a `scrape.complete` event, and one whose event id is among the last 500 it saw: nothing runs, and we still answer 200 so it is not retried. that id list lives in the node's workflow data, so a fresh copy of the workflow starts empty.

## errors

the node turns api errors into messages you can act on: a rate limit says how long to wait, out of credits and concurrency limit are each named, an anti-bot block says so with no retry hint, and a scrape error points you at the Advanced proxy tier and at Require JS. the raw response stays on the error for the n8n error view, and every error name is in the [error reference](https://crawlbrulee.com/docs/errors).

## development

```bash
pnpm install
pnpm lint     # the same rule set n8n's verification scan runs
pnpm verify   # lint, format, typecheck, tests, build
pnpm dev      # local n8n with this node linked, rebuilt on every change
```

`pnpm dev` links the package into its own n8n under `~/.n8n-node-cli` and starts it on `localhost:5678` — the first run downloads n8n, so give it a while; press `o` to open it. add `--external-n8n` when you run n8n yourself, with `N8N_DEV_RELOAD=true` set there.

the package has **zero runtime dependencies**, because a verified n8n node may not ship any: `@crawlbrulee/sdk` is a types-only dev dependency, and the signature check uses the Web Crypto global.

## part of the crawlbrulee toolkit

one api, many ways to call it:

- **[js/ts sdk](https://github.com/crawlbrulee/crawlbrulee-js)** — `@crawlbrulee/sdk`
- **[python sdk](https://github.com/crawlbrulee/crawlbrulee-py)** — `crawlbrulee` on pypi
- **[cli](https://github.com/crawlbrulee/crawlbrulee-cli)** — `npx crawlbrulee`
- **[mcp server](https://github.com/crawlbrulee/crawlbrulee-mcp)** — `@crawlbrulee/mcp`
- **[agent skills](https://github.com/crawlbrulee/crawlbrulee-skills)** — for skills-aware coding agents

docs: [crawlbrulee.com/docs](https://crawlbrulee.com/docs) · dashboard: [dashboard.crawlbrulee.com](https://dashboard.crawlbrulee.com)

## license

[MIT](./LICENSE)
