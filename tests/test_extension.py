from pathlib import Path

from playwright.sync_api import sync_playwright


ARTIFACTS = Path(__file__).with_name("artifacts")
ARTIFACTS.mkdir(exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    page.goto("http://127.0.0.1:8765/tests/fixture.html", wait_until="domcontentloaded")
    page.wait_for_function(
        """() =>
          document.querySelector('#urgency')?.classList.contains('baitblocker-mark') &&
          document.querySelector('#booking .timer')?.classList.contains('baitblocker-mark') &&
          document.querySelector('#dark-urgency')?.classList.contains('baitblocker-mark') &&
          document.querySelector('#red-urgency')?.classList.contains('baitblocker-mark') &&
          document.querySelector('#framing-copy')?.classList.contains('baitblocker-mark') &&
          document.querySelector('#late-bait-replacement')?.classList.contains('baitblocker-mark') &&
          document.querySelector('#shadow-host').shadowRoot.querySelector('#shadow-bait')?.classList.contains('baitblocker-mark')
        """
    )

    assert not page.locator("body.baitblocker-mark, main.baitblocker-mark").count()
    assert page.locator("#urgency").get_attribute("data-baitblocker-kind") == "pressure"
    assert page.locator("#urgency").evaluate("el => el.style.getPropertyPriority('text-decoration-color')") == "important"
    assert page.locator("#late-bait-replacement").evaluate("el => getComputedStyle(el).textDecorationThickness") == "1.5px"
    page.wait_for_function(
        "document.querySelector('#late-bait-replacement')?.classList.contains('baitblocker-new')"
    )
    assert page.locator("#late-bait-replacement").evaluate("el => getComputedStyle(el).animationIterationCount") == "3"
    assert "underline" in page.locator("#shadow-host").evaluate(
        "el => getComputedStyle(el.shadowRoot.querySelector('#shadow-bait')).textDecorationLine"
    )

    brand_red = page.locator("#urgency").evaluate("el => getComputedStyle(el).textDecorationColor")
    adapted_red = page.locator("#red-urgency").evaluate("el => getComputedStyle(el).textDecorationColor")
    assert brand_red == "rgb(221, 60, 60)"
    assert adapted_red != brand_red

    page.wait_for_function(
        """() => {
          const latest = [...window.__baitBlockerMessages].reverse().find(message => message.type === 'BAITBLOCKER_COUNT');
          return window.__oldLateFinding && latest &&
            !latest.tactics.some(item => item.index === window.__oldLateFinding.index);
        }"""
    )
    latest = page.evaluate(
        "[...window.__baitBlockerMessages].reverse().find(message => message.type === 'BAITBLOCKER_COUNT')"
    )
    assert latest["count"] == 7
    assert page.evaluate("window.__oldLateFinding.index") not in [item["index"] for item in latest["tactics"]]

    stale_jump = page.evaluate(
        """() => new Promise(resolve => window.__baitBlockerListener(
          {type:'JUMP_TO_FINDING', index:window.__oldLateFinding.index, finding:window.__oldLateFinding},
          {},
          resolve
        ))"""
    )
    assert stale_jump["ok"]
    assert page.locator("#late-bait-replacement").evaluate("el => el.classList.contains('baitblocker-focus')")

    page.locator("#urgency").dispatch_event("pointerover")
    page.wait_for_function(
        "document.querySelector('#baitblocker-tooltip:not([hidden])')?.innerText.includes('Scarcity pressure')"
    )
    tooltip = page.locator("#baitblocker-tooltip")
    assert "Scarcity pressure" in tooltip.inner_text()
    assert "bb / pressure" in tooltip.inner_text().lower()
    assert tooltip.locator(".baitblocker-tell").count() == 1
    assert tooltip.evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(245, 244, 239)"

    page.locator("#framing-copy").dispatch_event("pointerover")
    page.wait_for_function(
        "document.querySelector('#baitblocker-tooltip:not([hidden]) q')?.innerText.toLowerCase().includes('shocking')"
    )
    assert "shocking" in tooltip.inner_text().lower()

    assert page.locator("#urgency").get_attribute("aria-describedby") is None
    page.locator("#urgency").dispatch_event("pointerover")
    page.wait_for_function(
        "document.querySelector('#urgency')?.getAttribute('aria-describedby') === 'baitblocker-tooltip'"
    )
    page.keyboard.press("Escape")
    page.wait_for_function("document.querySelector('#baitblocker-tooltip').hidden === true")
    assert page.locator("#urgency").get_attribute("aria-describedby") is None

    page.screenshot(path=str(ARTIFACTS / "marked-page.png"), full_page=True)

    # A lens switched off clears its marks on the open page, and switching it back on
    # restores them, without a reload.
    page.evaluate(
        """() => window.__baitBlockerSettingsListener(
          {framing: {newValue: false, oldValue: true}}, 'sync')"""
    )
    page.wait_for_function(
        "!document.querySelector('#framing-copy').classList.contains('baitblocker-mark')"
    )
    assert page.locator("#framing-copy").get_attribute("data-baitblocker-kind") is None
    assert page.locator("#framing-copy").get_attribute("style") in (None, "")
    assert page.locator("#urgency").evaluate("el => el.classList.contains('baitblocker-mark')")

    page.evaluate(
        """() => window.__baitBlockerSettingsListener(
          {framing: {newValue: true, oldValue: false}}, 'sync')"""
    )
    page.wait_for_function(
        "document.querySelector('#framing-copy').classList.contains('baitblocker-mark')"
    )

    # A paused site drops every mark on the page.
    page.evaluate(
        """() => window.__baitBlockerSettingsListener(
          {disabledSites: {newValue: [location.hostname], oldValue: []}}, 'sync')"""
    )
    page.wait_for_function("!document.querySelectorAll('.baitblocker-mark').length")
    page.wait_for_function(
        """() => {
          const latest = [...window.__baitBlockerMessages].reverse().find(m => m.type === 'BAITBLOCKER_COUNT');
          return latest && latest.count === 0;
        }"""
    )
    republished = page.evaluate(
        "[...window.__baitBlockerMessages].reverse().find(m => m.type === 'BAITBLOCKER_COUNT')"
    )
    assert republished["count"] == 0
    assert republished["host"] == "127.0.0.1"

    browser.close()

print("PASS extension annotations, recovery, hover explanation and live settings")
