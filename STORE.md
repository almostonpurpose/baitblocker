# Chrome Web Store submission pack

Everything the listing form asks for. Copy from here; do not retype.

Build the upload with `./build.sh` — it writes `dist/baitblocker-<version>.zip` from an
allowlist and fails if anything unexpected got in.

## Listing fields

**Name** — `BaitBlocker`

**Short description** (132 char limit; this is the `description` in `manifest.json`, 81 chars)

> Marks the places where online writing is working on you rather than informing you.

**Category** — Productivity › Workflow & Planning

**Language** — English (United Kingdom)

**Detailed description**

> BaitBlocker marks the places where a page is working on you rather than informing you.
>
> It reads the page you are already reading and draws a thin red line under the moments
> where the writing is doing something: a countdown that makes a decision feel urgent, a
> stock number that pushes you to hurry, a headline built to withhold its own point, a
> charged word placed before the evidence. Hover a mark and BaitBlocker names the
> mechanism in one sentence. Framing marks quote the exact words that set them off.
>
> The toolbar button carries a count of what was found on the page. Open it for an index
> of every mark, filterable by category, with previous and next controls that walk you
> through the page one at a time.
>
> Four categories, each switchable on its own:
>
> • Pressure — urgency, scarcity, price anchoring, preselected options, hidden renewals
> • Influence — social proof, authority cues, identity appeals
> • Engagement bait — clickbait, search bait, reaction farming
> • Framing — loaded language, over-certainty, unnamed sources
>
> A sensitivity control decides how willing it is to flag lower-confidence cues. Pause it
> on any site from the toolbar. Settings apply straight away, on pages you already have
> open.
>
> The rules are plain pattern matching, run locally: no network requests, no account, no
> analytics, nothing leaves your browser.
>
> Honest about its limits: this is a rule-based tool. It cannot establish intent, judge
> political ideology, or catch patterns that only emerge across a multi-step checkout or
> cancellation flow.

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

**Remote code** — None. All scripts, styles, rules, and fonts ship inside the package.

## Data usage disclosure

Tick nothing under "collected data". Then certify all three:

- Not being sold to third parties
- Not being used or transferred for purposes unrelated to the single purpose
- Not being used or transferred to determine creditworthiness or for lending

**Privacy policy URL** — required. The policy is `site/privacy.html`, published with the
landing page. Paste the live URL (`https://baitblocker.org/privacy.html`, or the
`*.pages.dev` equivalent while the domain is still propagating).

The policy is written against the UK and EU GDPR: named controller, legal basis and
retention for the only processing that occurs (host server logs), processor and
international-transfer disclosure for Cloudflare, the full list of data subject rights,
and the right to complain to the ICO or a local supervisory authority. The site sets no
cookies and makes no third-party requests, verified in a browser, so no consent banner is
required.

## Assets

| Asset | Size | Where |
| --- | --- | --- |
| Store icon | 128×128 | `icons/baitblocker-128.png` |
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

## Known review friction

Broad host permissions on a content script that runs in all frames of all sites usually
draws a longer review than a narrow-scope extension. The justification above is the
argument; expect days rather than hours, and expect a follow-up question about why the
content script needs `all_frames`. The answer: booking timers and engagement bait are
routinely rendered inside iframes, and a mark inside a frame is reported to the popup
with its frame id so navigation still works.
