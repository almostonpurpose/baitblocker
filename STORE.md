# Chrome Web Store submission pack

Everything the listing form asks for. Copy from here; do not retype.

Build the upload with `./build.sh` — it writes `dist/baitblocker-<version>.zip` from an
allowlist and fails if anything unexpected got in.

## Listing fields

**Name** — `BaitBlocker`

**Short description** (132 char limit; this is the `description` in `manifest.json`, 81 chars)

> Marks the places where online writing is working on you rather than informing you.

**Category** — Privacy & Security

That is where the comparable extensions sit and where the audience browses. It draws more
review scrutiny than most categories, which combined with `<all_urls>` across all frames
means a longer review; the permission justifications below are written for that question.
Well-being is the honest lower-friction alternative if the wait matters more than the
traffic.

**Language** — English (United Kingdom)

**Detailed description**

> BaitBlocker underlines the sales tactics and clickbait on a web page, so you can see
> them while you read.
>
> When it finds one, it underlines it in red. Hover over the underline and it tells you
> what the tactic is called and how it works. The toolbar button shows how many it found
> on the page. Click the button for a list, and click any item to jump to it.
>
> What it looks for:
>
> • Pressure — countdown timers, "only 3 left", "was £89, now £49", pre-ticked boxes,
> auto-renewal mentioned in small print
> • Influence — "join 40,000 customers", "doctor recommended", "for people who care about"
> • Engagement bait — "you won't believe what happened next", "wait for the end",
> "comment below if you agree"
> • Framing — "shocking", "proves that", "experts say", "everyone knows"
>
> You can switch any of the four off. A sensitivity setting controls how much it flags.
> You can pause it on a site you don't want it running on. Changes take effect
> immediately, without reloading the page.
>
> It works by matching phrases, so it will miss things, and it will sometimes underline
> something harmless. It can't tell you what anyone intended.
>
> No account, no tracking, nothing sent anywhere. It runs entirely in your browser and
> makes no network requests at all.

## Single purpose statement

> BaitBlocker annotates the page you are reading to show where its wording uses a known
> persuasion pattern, and explains each one in place.

## Permission justifications

**Host permissions — `<all_urls>` content script**
> The extension's only function is annotating the page the user is reading. Persuasion
> patterns appear on any site — retail, news, social, booking — so the user cannot be
> asked to predeclare where to look. The content script reads visible text in the page
> and marks it there. No page content is stored, transmitted, or sent off the device.

**`storage`**
> Saves the user's own settings (which categories are on, sensitivity, and the list of sites
> they have paused) and a local count of pages scanned and patterns found. No page
> content and no URLs beyond the user's own pause list.

**`activeTab`**
> Lets the toolbar popup message the page the user is currently looking at, so clicking
> an entry in the index scrolls to that mark. Used only while the popup is open.

**`webNavigation`**
> Detects top-level and subframe navigation so the toolbar count resets on a new page and
> findings for frames that no longer exist are retired instead of being reported.

**Remote code** — select "No, I am not using remote code." If a text box appears:
> No remote code. All scripts, styles, detection rules and fonts ship inside the package.
> The extension loads nothing at runtime and makes no network requests.

**Publisher contact email** — set on the Settings page, not the listing, and it must be
verified by clicking the link Google sends. It is displayed publicly on the listing, so it
should match the address in the privacy policy.

## Data usage disclosure

Tick nothing under "collected data". Then certify all three:

- Not being sold to third parties
- Not being used or transferred for purposes unrelated to the single purpose
- Not being used or transferred to determine creditworthiness or for lending

**Privacy policy URL** — required. Paste `https://baitblocker.org/privacy` once the
custom domain is attached, or `https://baitblocker.pages.dev/privacy` in the meantime.
Both are live. Note the extensionless path: Pages 308-redirects `/privacy.html`, so use
`/privacy` to avoid handing the reviewer a redirect.

The policy is written against the UK and EU GDPR: named controller, legal basis and
retention for the only processing that occurs (host server logs), processor and
international-transfer disclosure for Cloudflare, the full list of data subject rights,
and the right to complain to the ICO or a local supervisory authority. The site sets no
cookies and makes no third-party requests, verified in a browser, so no consent banner is
required.

## Assets

| Asset | Size | Where |
| --- | --- | --- |
| Store icon | 128×128 | `store/store-icon-monogram.png` (the shipped mark, repadded to the 96×96-inside-128×128 the store asks for) |
| Screenshots ×3 | 1280×800 | `store/screenshots/` |
| Small promo tile | 440×280 | `store/promo-440x280.png` |

Regenerate the screenshots with `python3 tests/run.py` (under the local server) then
`python3 store/shots.py`.

## Deploy chain

Already run:

- Repo: `almostonpurpose/baitblocker` (private). Note that `gh auth status` reports the
  stored account as `rafiqigpt`, but the token belongs to `almostonpurpose` — always name
  the owner explicitly rather than using the bare form.
- Pages project: `baitblocker`, production branch `production`.
- Repo secret `CLOUDFLARE_ACCOUNT_ID` set.
- Staged to the preview branch, not live.
- `baitblocker.org` is registered through Cloudflare Registrar and its nameservers already
  point at Cloudflare, so the zone exists and the custom domain can be attached from the
  CLI at go-live.

Still needed, all requiring Amr:

1. `gh auth refresh -h github.com -s workflow` — the current token has `gist`, `read:org`,
   `repo` only, and GitHub rejects the whole push if `.github/workflows/deploy.yml` is in
   it. The workflow file is written and committed locally, waiting on this.
2. Create a Cloudflare API token with Pages edit rights and set it:
   `gh secret set CLOUDFLARE_API_TOKEN --repo almostonpurpose/baitblocker`
3. Fill in the `[LEGAL NAME]` marker in `site/privacy.html`. It must not go live with the
   placeholder in it.

Then going live is one command:
`wrangler pages deploy site --project-name=baitblocker --branch=production`
followed by `wrangler pages domain add baitblocker.org --project-name=baitblocker`.

## Pre-submit checklist

- [ ] `./build.sh` clean — it checks the zip against an exact file manifest and fails on
      anything extra or missing, so concept art and working files cannot slip in
- [ ] Test suite passing (`tests/run.py`: background harness + three browser suites)
- [ ] Version in `manifest.json` higher than the last published version
- [ ] Privacy policy live at a public URL, pasted into the listing
- [ ] Screenshots regenerated from the current build
- [ ] Loaded unpacked and checked by hand: badge count, per-site pause, live category toggle

## Other stores

**Firefox (addons.mozilla.org)** — `./build.sh firefox` writes
`dist/baitblocker-<version>-firefox.zip`. The manifest is derived from the Chrome one by
`store/firefox_manifest.py`, so the two cannot drift: it swaps the service worker for an
event page (`background.scripts`, with `config.js` loaded ahead of `background.js`, since
an event page has no `importScripts`), and adds the `browser_specific_settings.gecko` id
and a 115.0 minimum for `storage.session`.

One behaviour differs and should be declared rather than discovered: `location.ancestorOrigins`
is not implemented in Gecko, and it is what keys the per-site pause to the top-level host.
On Firefox a cross-origin subframe falls back to its own hostname, so pausing a site does
not silence third-party iframes embedded in it. It degrades; it does not break.

`web-ext lint` reports zero errors and two warnings, both expected: the required
`data_collection_permissions` key is only understood from Firefox 140, while the minimum
is 115 for `storage.session`. Older Firefox ignores keys it does not recognise, and AMO
blocks on errors rather than warnings, so the trade is two warnings against not excluding
Firefox 115-139.

The same listing copy, screenshots and privacy URL apply. AMO review is usually much
faster than Chrome's.

**Edge (Partner Center)** — takes the Chrome zip unchanged, no code differences.

**Safari / App Store** — see [`SAFARI.md`](SAFARI.md). The review is quick; the runway to
it is not, because the extension has to ship inside a native wrapper app.

## Known review friction

Broad host permissions on a content script that runs in all frames of all sites usually
draws a longer review than a narrow-scope extension. The justification above is the
argument; expect days rather than hours, and expect a follow-up question about why the
content script needs `all_frames`. The answer: booking timers and engagement bait are
routinely rendered inside iframes, and a mark inside a frame is reported to the popup
with its frame id so navigation still works.
