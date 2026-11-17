# changelog

all notable changes to `n8n-nodes-crawlbrulee` are documented here.

this project follows [Semantic Versioning](https://semver.org).

## 1.2.0 (2026-11-18)

### added

- **PDF** on **Scrape URL** and **Scrape URL (Async)**: save the page as a pdf, with selectable text and working links. **PDF Options** sets the **Layout** (Pages, the default, or Single Page), the **Paper** (A4 or Letter), **Landscape** and the **Media** (Screen, the default, or Print); Paper and Landscape work only with Pages. the item gets `pdf` with a signed `url` that expires 24 hours after the scrape, and its size in `bytes`. it costs what a screenshot costs, and a pdf and a screenshot in one request are billed once. the new warnings `pdf_unavailable` and `pdf_single_page_overflow` pass through in `warnings`, and the new error `unsupported_pdf_output` shows the api's message. see [pdf](https://crawlbrulee.com/docs/scrape/pdf).
- **Download PDF** on **Scrape URL** and **Get Scrape Result**: attaches the pdf as binary data under `pdf`, like **Download Screenshot**. a failed download keeps the item and sets `pdf_download_error`.
- **Color Scheme** under **Screenshot Options**: Light (the default) or Dark, which asks the site for its dark theme. a pdf in the same request shows it too. no extra credits.
- **Sitemap URL**, **Depth**, **Entries** and **Modified Since** under **Options** of **Map Website**. **Sitemap URL** starts from one sitemap file on the same site, or on a host the site's robots.txt names. **Depth** sets how many levels of nested sitemaps to follow (0 to 3, 3 by default). **Entries** returns Pages (the default), Sitemaps or All. **Modified Since** keeps only entries whose `lastmod` is at or after a date and time. together they map a very large site in several calls: list its sitemap files, then read each one. every map link now carries `type` (`page` or `sitemap`) and `lastmod`, and `response_meta.truncation` carries `total_before_max_results` and `unread_sitemaps`; they pass through unchanged. see [map](https://crawlbrulee.com/docs/map).
- **Modified Since** reads a date and time with no time zone in the workflow's time zone (its setting, else the instance's), as n8n's date picker means it, and sends it in UTC. a value with its own time zone is sent as is.

### compatibility

- every new field is off or empty by default, so a saved workflow sends the same request as before, with one change: **Max URLs** on **Map Website** is now labeled **Max Results** and sends the api's new name for the same limit. the field keeps its internal name, so a saved workflow keeps its value. the node still ships no runtime dependencies.

### changed

- **Extract** now starts with **Markdown** and **Metadata** ticked, instead of **Cleaned HTML** and **Metadata**, the same default as the api.
- the readme teaches the new map fields and the several-calls flow, and says that a **Scrape URL (Async)** job that asks only for a screenshot or a pdf and gets none ends as failed and costs no credits.
- ⚠️ n8n does not save a field that still has its default value. so a **Scrape URL** or **Scrape URL (Async)** node where you never changed **Extract** now returns markdown + metadata instead of cleaned html + metadata. to keep cleaned html, open the node and tick **Cleaned HTML** under **Extract**. nodes where you changed **Extract** keep what you picked.

## 1.1.0 (2026-11-06)

### added

- **Headers** and **Cookies** under **Options** of **Scrape URL** and **Scrape URL (Async)**: send your own HTTP headers and cookies to the site, for example an `Authorization` header or a fixed `User-Agent` that a site has on its allowlist. one row per header or cookie, with a **Name** and a **Value**; header values show as typed; n8n hides cookie values in the editor. headers go only to the origin of the url (or its https version, for an http url), cookies only to its host. a request with headers or cookies is never cached, and costs the same as any fresh scrape. a blank row is skipped; a header name used twice, or a row with a name but no value, is an error. see [headers and cookies](https://crawlbrulee.com/docs/scrape/custom-headers-and-cookies).
- the `custom_user_agent` warning passes through in `warnings` when you set your own `User-Agent` header. it means this can lower the success rate.
- the Elements (JSON) description says that `:scope` in a field reads the match itself, for example the matched element's own `href`.

### compatibility

- both lists are empty by default and nothing is sent until you add a row. the node still ships no runtime dependencies.

### changed

- the elements placeholder and the readme use a made-up shop for their example (`article.book`, `.price`), instead of the markup of a scraping sandbox run by another company.
- depends on `@crawlbrulee/sdk` 1.4.0 (types only).

## 1.0.1 (2026-10-09)

### changed

- **docs only.** the readme now says what cleanup removes: ads, popups and cookie banners. the menu and the footer stay unless you exclude them with **Exclude Selectors**. no changes to the node.

## 1.0.0 (2026-10-09)

### added

- **Elements** on **Scrape URL** and **Scrape URL (Async)**: read named values from the page by CSS selector, as text, HTML or an attribute, the first match or all of them. they come back in `elements`, under the names you give, on the result and on **Get Scrape Result**. no extra credits. for a value per match, like a title and price per product card, use **Elements (JSON)** under **Options**. see [elements](https://crawlbrulee.com/docs/scrape/elements).

### changed

- the **Exclude Selectors** hint no longer says that sending selectors skips the cache. requests with the same selectors now share cached results.
- builds against `@crawlbrulee/sdk` 1.3.0 for its types. the node still ships no runtime dependencies.

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
