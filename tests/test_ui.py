from pathlib import Path

from playwright.sync_api import sync_playwright


ARTIFACTS = Path(__file__).with_name("artifacts")
ARTIFACTS.mkdir(exist_ok=True)


POPUP_STUB = """
window.__jumps = [];
window.__sent = [];
window.__summary = {
  reachable: true,
  enabled: true,
  paused: false,
  disabledHere: false,
  host: 'example.com',
  pageTitle: 'Fixture',
  tactics: [
    {lens:'pressure', name:'Countdown pressure', trigger:'09:42', sample:'Tickets held for 09:42', index:2, frameId:0},
    {lens:'engagement', name:'Engagement bait', trigger:'Wait till the end', sample:'Wait till the end', index:5, frameId:0},
    {lens:'framing', name:'Loaded framing', trigger:'shocking', sample:'A shocking result', index:8, frameId:0}
  ]
};
window.chrome = {
  tabs: {
    query: (options, callback) => callback([{id: 42}]),
    sendMessage: (tabId, message, options, callback) => {
      window.__jumps.push({tabId, message, options});
      callback({ok: true});
    }
  },
  runtime: {
    lastError: null,
    sendMessage: (message, callback) => {
      window.__sent.push(message);
      if (message.type === 'GET_TAB_SUMMARY') return callback(window.__summary);
      if (message.type === 'GET_STATS') return callback({
        version: 1, since: '2026-01-04T00:00:00.000Z', pagesScanned: 96, totalTells: 412,
        byLens: {pressure: 180, influence: 96, engagement: 84, framing: 52}
      });
      return callback({ok: true});
    },
    openOptionsPage: () => {}
  }
};
"""

CONTROL_STUB = """
window.__saved = [];
window.__sync = {
  enabled:true, pressure:true, influence:true, engagement:true, framing:true,
  sensitivity:'balanced', disabledSites:['tickets.example.com']
};
window.chrome = {
  runtime: { getManifest: () => ({version: '0.5.0'}) },
  storage: {
    sync: {
      get: (given, callback) => callback({...given, ...window.__sync}),
      set: (value, callback) => {
        window.__saved.push(value);
        Object.assign(window.__sync, value);
        callback?.();
      }
    },
    local: {
      get: (given, callback) => callback({stats: {
        version: 1, since: '2026-01-04T00:00:00.000Z', pagesScanned: 96, totalTells: 412,
        byLens: {pressure: 180, influence: 96, engagement: 84, framing: 52}
      }})
    }
  }
};
"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    popup = browser.new_page(viewport={"width": 296, "height": 560})
    popup.add_init_script(POPUP_STUB)
    popup.goto("http://127.0.0.1:8765/popup.html", wait_until="domcontentloaded")
    popup.wait_for_function("document.fonts.status === 'loaded'")
    popup.wait_for_function("document.querySelectorAll('.finding').length === 3")

    assert popup.locator("#count").inner_text() == "3"
    assert popup.locator("#reload").is_hidden()
    assert "PATTERNS" in popup.locator("#count-label").inner_text()
    assert popup.locator("#controls").inner_text().startswith("SETTINGS")
    popup_text = popup.locator("body").inner_text().lower()
    for word in ("tell", "seam", "tune the scan", "bb://"):
        assert word not in popup_text, f"invented vocabulary back in the popup: {word}"
    assert "BAITBLOCKER" in popup.locator(".wordmark").inner_text().replace("\n", "")
    assert popup.locator("body").evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(245, 244, 239)"
    assert "Righteous" in popup.locator(".wordmark").evaluate("el => getComputedStyle(el).fontFamily")
    assert "Besley" in popup.locator(".finding-title").first.evaluate("el => getComputedStyle(el).fontFamily")
    assert "Chivo Mono" in popup.locator(".finding-lens").first.evaluate("el => getComputedStyle(el).fontFamily")

    # Lens breakdown reflects the findings and filters the list.
    assert popup.locator(".lens-chip").count() == 4
    counts = popup.locator(".lens-chip span").all_inner_texts()
    assert counts == ["1", "0", "1", "1"]
    assert popup.locator('.lens-chip[data-lens="influence"]').is_disabled()
    assert popup.locator(".lens-chip b").all_inner_texts() == ["PRESSURE", "INFLUENCE", "BAIT", "FRAMING"]
    popup.locator('.lens-chip[data-lens="framing"]').click()
    assert popup.locator(".finding").count() == 1
    assert "Loaded framing" in popup.locator(".finding-title").inner_text()
    popup.locator('.lens-chip[data-lens="framing"]').click()
    assert popup.locator(".finding").count() == 3

    # Toolbar navigation still targets the right frame and finding.
    popup.locator("#next").click()
    assert popup.locator("#position").inner_text() == "1 / 3"
    jump = popup.evaluate("window.__jumps[0]")
    assert jump["message"]["finding"]["trigger"] == "09:42"
    assert jump["options"]["frameId"] == 0

    popup.screenshot(path=str(ARTIFACTS / "popup.png"), full_page=True)

    # Per-site pause reaches the service worker with the page's own host.
    assert popup.locator("#site-host").inner_text() == "example.com"
    assert not popup.locator("#paused").is_checked()
    popup.locator("#site-pause").click()
    popup.wait_for_function("window.__sent.some(m => m.type === 'SET_SITE_PAUSED')")
    pause_message = popup.evaluate("window.__sent.find(m => m.type === 'SET_SITE_PAUSED')")
    assert pause_message["host"] == "example.com"
    assert pause_message["paused"] is True

    assert "412" in popup.locator("#stats").inner_text()
    assert "96" in popup.locator("#stats").inner_text()

    # A page the content script cannot reach says so instead of reporting zero.
    unreachable = browser.new_page(viewport={"width": 296, "height": 560})
    unreachable.add_init_script(POPUP_STUB)
    unreachable.add_init_script("window.__summary = {reachable: false, enabled: true, tactics: []};")
    unreachable.goto("http://127.0.0.1:8765/popup.html", wait_until="domcontentloaded")
    unreachable.wait_for_function("document.querySelector('#count').innerText === '—'")
    assert "NOT" in unreachable.locator("#count-label").inner_text()
    assert unreachable.locator("#paused").is_disabled()
    # It offers the fix rather than asserting a cause it cannot check.
    assert unreachable.locator("#reload").is_visible()
    assert "did not answer" in unreachable.locator("#summary").inner_text()
    assert unreachable.locator("#reload").is_hidden() is False
    unreachable.close()

    control = browser.new_page(viewport={"width": 1000, "height": 1100})
    control.add_init_script(CONTROL_STUB)
    control.goto("http://127.0.0.1:8765/control.html", wait_until="domcontentloaded")
    control.wait_for_function("document.fonts.status === 'loaded'")
    assert "BAITBLOCKER" in control.locator(".wordmark").inner_text().replace("\n", "")
    assert control.locator("body").evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(245, 244, 239)"
    assert control.locator("#version").inner_text() == "SETTINGS · V0.5.0"
    assert control.locator("h1").inner_text().replace("\n", " ") == "Control your own mind." 

    control.locator("label.pressure").click()
    assert not control.locator("#pressure").is_checked()
    assert control.evaluate("window.__saved.at(-1).pressure") is False
    control.locator("label.engagement").click()
    assert control.evaluate("window.__saved.at(-1).engagement") is False
    control.locator("label.pressure").click()
    control.locator("label.engagement").click()

    control.locator("label.master").click()
    assert not control.locator("#enabled").is_checked()
    assert control.evaluate("window.__saved.at(-1).enabled") is False
    control.locator("label.master").click()

    control.locator("#sensitivity").fill("2")
    assert control.locator("#sensitivity-label").inner_text() == "SENSITIVE"
    assert control.evaluate("window.__saved.at(-1).sensitivity") == "sensitive"
    assert control.locator("#sensitivity").evaluate(
        "el => document.querySelector('label[for=sensitivity]') !== null"
    )

    # Paused sites are visible and reversible from the control page.
    assert control.locator("#paused-list li").count() == 1
    assert "tickets.example.com" in control.locator("#paused-list li").inner_text()
    control.locator(".resume").click()
    assert control.locator(".paused-empty").count() == 1
    assert control.evaluate("window.__saved.at(-1).disabledSites") == []

    assert "412" in control.locator(".stat").nth(1).inner_text()
    assert "96" in control.locator(".stat").nth(0).inner_text()

    # The explainer and its source list sit above the controls.
    assert control.locator(".reading-list dt").all_inner_texts() == [
        "Pressure", "Influence", "Engagement bait", "Framing"
    ]
    assert "choice architecture" in control.locator(".reading-copy").inner_text()
    assert control.locator(".reading-copy p").count() == 3
    assert control.locator(".specimen").count() == 0
    assert "names a mechanism" not in control.locator("body").inner_text()
    body_text = control.locator("body").inner_text().lower()
    for word in ("tell", "lens", "tune the scan", "bb://"):
        assert word not in body_text, f"invented vocabulary back on the control page: {word}"
    # The explainer comes before the numbered control sections in the document.
    assert control.evaluate(
        "() => document.querySelector('.reading').compareDocumentPosition("
        "document.querySelector('section')) & Node.DOCUMENT_POSITION_FOLLOWING"
    ) != 0

    control.screenshot(path=str(ARTIFACTS / "control.png"), full_page=True)
    browser.close()

print("PASS popup index, lens filter, per-site pause, explainer and stats")
