"""A page that rerenders constantly must not grow the finding table without bound."""
from playwright.sync_api import sync_playwright


READ = """() => {
  const ids = [...document.querySelectorAll('[data-baitblocker-id]')]
    .map(el => Number(el.dataset.baitblockerId));
  return {marks: ids.length, highest: ids.length ? Math.max(...ids) : -1};
}"""


def sample(page, count):
    """Peak values over several reads — a single read can land mid-repaint."""
    marks = highest = -1
    for _ in range(count):
        reading = page.evaluate(READ)
        marks = max(marks, reading["marks"])
        highest = max(highest, reading["highest"])
        page.wait_for_timeout(120)
    return {"marks": marks, "highest": highest}


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    page.goto("http://127.0.0.1:8765/tests/churn.html", wait_until="domcontentloaded")

    page.wait_for_function("document.querySelectorAll('[data-baitblocker-id]').length > 0")
    early = sample(page, 8)
    page.wait_for_function("window.__rounds > 45")
    late = sample(page, 12)

    assert early["marks"] > 0, "the fixture should be producing findings"
    assert late["marks"] > 0, "findings should still be produced after many repaints"

    # Retired slots are reused, so the table stays the size of what is on screen
    # rather than the size of everything ever seen. Without reuse this reaches the
    # number of repaints times the findings per repaint.
    rounds = page.evaluate("window.__rounds")
    assert late["highest"] < 40, (
        f"finding table reached index {late['highest']} after {rounds} repaints "
        f"(was {early['highest']} early on) — retired slots are not being reused"
    )

    browser.close()

print(f"PASS finding table stays bounded under rerender "
      f"(peak index {late['highest']} after {rounds} repaints)")
