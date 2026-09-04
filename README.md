# BaitBlocker

Load this folder as an unpacked extension in Chrome, Brave, or another Chromium browser
using the extensions page’s **Developer mode** and **Load unpacked** controls. After
source changes, use the extension page’s reload control. Settings now apply to pages you
already have open, so most changes need no page reload.

**Pin the toolbar icon.** Chrome folds unpinned extensions into the puzzle-piece menu,
and the badge count is invisible while it is folded away.

## What you see

The toolbar button carries the count of patterns found on the current page, and its
tooltip breaks that count down by category. A muted `off` badge means BaitBlocker is paused, either
on that site or everywhere; a blank badge means the page is clean or cannot be read.

The popup is an index of every finding: a per-category tally that filters the list,
previous and next controls, and a jump-to-mark on each row. It also carries a per-site
pause and a running count of what BaitBlocker has found since it was installed.

On the page, a thin red mark means something has been caught, and the underline style
shows the category — solid for pressure, dotted for influence, dashed for engagement
bait, wavy for framing. New marks pulse, staggered so a busy page does not
strobe. Hover or keyboard focus reveals the mechanism; framing explanations quote the
exact words that triggered the rule. Escape dismisses the explanation.

## Why

Persuasion in an interface is a documented craft. Thaler and Sunstein called the
arrangement around a decision its choice architecture: which option is preselected, what
sits in front of you, what is buried. Cialdini catalogued the levers aimed at the reader
directly — scarcity, social proof, authority, commitment, reciprocity, liking. Tversky
and Kahneman showed that two identical descriptions of a fact produce different
decisions, and Loewenstein's information gap explains the withheld headline.

Harry Brignull named the applied version dark patterns in 2010. Mathur et al. found them
on roughly one in nine of 11,000 shopping sites crawled, and the FTC and the EU's Digital
Services Act now write rules against parts of the practice. BaitBlocker matches phrasings
these mechanisms tend to produce: a rough instrument pointed at a real thing. The sources
mapped to each category sit at the top of the settings page.

## Controls

Four independently switchable categories under **Settings**: Pressure, Influence,
Engagement bait, and Framing. The sensitivity control changes how willing the scanner is
to flag lower-confidence cues. Paused sites are listed there and can be resumed one by
one.

## How it works

Version 0.5 uses a self-healing direct-content annotation engine across ordinary DOM,
dynamically inserted content, nested frames, and open Shadow DOM. It restores markings
removed by reactive page rerenders, retires stale detections when nodes are replaced, and
resolves a replacement if a listed finding changed underneath it.

The detection rules are deliberately transparent and local. This is still a rule-based
prototype: it cannot establish intent, determine political ideology, or reliably find
patterns that only emerge over a multi-step checkout or cancellation journey.

Nothing leaves the browser. No network requests, no analytics, no account. The policy
is [`site/privacy.html`](site/privacy.html); [`PRIVACY.md`](PRIVACY.md) explains where it
lives and what still needs completing.

## Identity

A paper-light reading surface, Righteous display type, Besley text, Chivo Mono readouts,
and the red dot-and-hairline signature called **the mark**. Fonts are bundled locally
under their OFL licences. The visual rules and rationale live in [`DESIGN.md`](DESIGN.md).

## Development

Run the checks — a Node harness that drives `background.js` against a stubbed `chrome`,
then the two Playwright suites:

```sh
python3 /Users/amr/.agents/skills/webapp-testing/scripts/with_server.py \
  --server "python3 -m http.server 8765 --bind 127.0.0.1" \
  --port 8765 python3 tests/run.py
```

Build the store package (allowlist based; fails if anything unexpected is included):

```sh
./build.sh
```

Regenerate the listing screenshots after the tests have run:

```sh
python3 store/shots.py
```

Submission material lives in [`STORE.md`](STORE.md); the Safari and App Store route is in
[`SAFARI.md`](SAFARI.md).
