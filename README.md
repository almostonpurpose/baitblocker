# BaitBlocker

> The hook is the message.

Load this folder as an unpacked extension in Chrome, Brave, or another Chromium browser using the extensions page’s **Developer mode** and **Load unpacked** controls. After source changes, use the extension page’s reload control, then reload the webpage.

The extension has four independently switchable lenses under **Tune the scan**: Pressure, Influence, Engagement bait, and Framing. A thin red mark means something has been caught; underline styles distinguish the lenses. Its sensitivity control changes how willing it is to flag lower-confidence cues.

Version 0.4 uses a self-healing direct-content annotation engine across ordinary DOM, dynamically inserted content, nested frames, and open Shadow DOM. It restores markings removed by reactive page rerenders, retires stale detections when nodes are replaced, and resolves a replacement if a listed finding changed underneath it.

The BaitBlocker identity uses a paper-light reading surface, Righteous display type, Besley text, Chivo Mono readouts, and the red dot-and-hairline signature called **The Tell**. Fonts are bundled locally under their OFL licences. Page annotations remain in the lead-red family and adjust only when the local surface would make that red illegible. New marks pulse three times and explanations appear on hover or keyboard focus. Framing explanations quote the exact words that triggered the rule. The toolbar popup is a compact detection index with previous/next controls as well as direct navigation.

The detection rules are deliberately transparent and local. This is still a rule-based prototype: it cannot establish intent, determine political ideology, or reliably find patterns that only emerge over a multi-step checkout or cancellation journey.

The visual rules and rationale live in [`DESIGN.md`](DESIGN.md). Run the local browser checks with:

```sh
python3 /Users/amr/.agents/skills/webapp-testing/scripts/with_server.py \
  --server "python3 -m http.server 8765 --bind 127.0.0.1" \
  --port 8765 python3 tests/run.py
```
