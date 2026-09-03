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

    page.screenshot(path=str(ARTIFACTS / "marked-page.png"), full_page=True)
    browser.close()

print("PASS extension annotations, navigation recovery and hover explanation")
