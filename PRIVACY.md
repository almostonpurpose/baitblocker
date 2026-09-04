# BaitBlocker privacy policy

Last updated: 4 September 2026.

## The short version

BaitBlocker does not collect, transmit, or sell any data. Everything it does happens
inside your browser, on your own machine.

## What BaitBlocker reads

To mark manipulative patterns, the extension reads the visible text of pages you open.
That reading happens in the page itself and the text is never copied off your device,
never written to disk, and never sent anywhere. When you close a tab, the extension's
record of that page is gone.

## What BaitBlocker stores

Two things, both local to your browser:

- **Your settings** — which categories are on, the sensitivity level, and the list of sites
  you have paused. These live in Chrome's synced extension storage, so they follow your
  Chrome profile if you have Chrome Sync switched on. They are readable only by this
  extension.
- **A running tally** — how many pages have been scanned and how many patterns were
  marked, split by category. These are counters only. No URLs, no page text, no titles, and
  no timestamps of individual visits are kept. You can zero the tally by removing and
  reinstalling the extension.

## What BaitBlocker never does

- No analytics, telemetry, crash reporting, or advertising identifiers.
- No network requests of any kind. The extension makes none; the fonts and rules are
  bundled in the package.
- No account, no sign-in, no personal information.
- No selling or sharing of data with third parties, because no data leaves your device.

## Permissions, and why each one exists

| Permission | Why |
| --- | --- |
| Access to the sites you visit | The extension has to read page text to mark patterns in it. The reading is local and nothing is retained. |
| `storage` | Saves your settings and the running tally described above. |
| `activeTab` | Lets the toolbar popup talk to the page you are looking at when you open it. |
| `webNavigation` | Detects page and frame navigation so counts reset and stale marks are retired. |

## Contact

Questions or corrections: aswad.amr@gmail.com
