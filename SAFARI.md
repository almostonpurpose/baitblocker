# Getting BaitBlocker onto the App Store

Safari extensions are not uploaded as a zip. They ship inside a native app wrapper:
Apple's converter turns the extension folder into an Xcode project that builds a macOS
app (and optionally an iOS app) whose only job is to host the extension. That app is what
goes through App Store review.

The tooling is present on this machine — Xcode 26.4.1, and
`/Applications/Xcode.app/Contents/Developer/usr/bin/safari-web-extension-converter`.
The conversion has **not** been run yet, deliberately: it should happen against the final
Chrome package, after hands-on testing, or the two targets drift apart.

## The command

Run it against a staged copy, not the repo root, so the tests, docs, and store assets
stay out of the app bundle:

```bash
./build.sh && mkdir -p dist/safari-src && unzip -q -o dist/baitblocker-0.5.0.zip -d dist/safari-src
```

```bash
xcrun safari-web-extension-converter dist/safari-src --project-location ./safari --app-name BaitBlocker --bundle-identifier com.aswad.baitblocker --swift --copy-resources --no-prompt
```

Then open `safari/BaitBlocker/BaitBlocker.xcodeproj`, set the signing team, and build.
For a quick local try without going through signing: Safari → Settings → Advanced →
*Show features for web developers*, then Develop → *Allow Unsigned Extensions*. That
setting resets every time Safari restarts.

## What it takes

Signing and submission are already available — the Apple Developer Program membership is
in place. What is left:

- **The wrapper app.** It needs its own icon set, a launch screen for iOS, and a short
  "what this app does" screen. Apple rejects wrapper apps that open to a blank window.
- **App review**, slower and pickier than Chrome's, and applied to the wrapper as well as
  the extension.
- A separate App Store listing, screenshots at Apple's sizes, and its own privacy
  disclosure (App Privacy "Data Not Collected" across the board).

## What to expect from the port

Checked against the current source; none of these are blockers, but they are where it
will differ:

| Area | Status on Safari |
| --- | --- |
| `chrome.storage.session` (service worker state) | Supported from Safari 16.4. Older Safari falls back to an empty map, which the popup's live re-publish already covers. |
| `chrome.action.setBadgeTextColor` | Not implemented. Already called optionally (`?.`), so it no-ops rather than throwing. Badge text takes Safari's own default colour. |
| Service worker lifetime | Safari suspends the background service worker more aggressively than Chrome. This is exactly the area the popup re-publish path was built for, so the badge/popup desync should not reappear — but it is the first thing to check by hand. |
| `chrome.webNavigation` | Supported, and it is a separately-prompted permission in Safari's UI. |
| `location.ancestorOrigins` | Supported; the per-site pause keying works unchanged. |
| Bundled fonts via `web_accessible_resources` | Supported. |
| `<all_urls>` content script | Safari surfaces this to the user per-site, with an "Allow for One Day" default. Expect a materially lower always-on rate than Chrome, and expect App Review to ask about it. |

## Order of operations

1. Ship the Chrome package first and let it settle.
2. Run the converter against that exact package.
3. Test in Safari with unsigned extensions allowed.
4. Sign with the real team, build the wrapper's screens, submit.

## The cheaper second target

Firefox Add-ons takes the same MV3 zip with two changes: a `browser_specific_settings.gecko.id`
key in the manifest, and `background.scripts` instead of `background.service_worker`
(or both, since Firefox now accepts the service worker key). Review is faster, listing is
free, and it does not need a native wrapper. If the goal is "more than one store", that is
a day of work against Safari's several.
