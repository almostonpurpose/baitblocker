from pathlib import Path

from playwright.sync_api import sync_playwright


ARTIFACTS = Path(__file__).with_name("artifacts")
ARTIFACTS.mkdir(exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    popup = browser.new_page(viewport={"width": 390, "height": 650})
    popup.add_init_script(
        """
        window.__jumps = [];
        window.chrome = {
          tabs: {
            query: (options, callback) => callback([{id: 42, title: 'Fixture'}]),
            sendMessage: (tabId, message, options, callback) => {
              window.__jumps.push({tabId, message, options});
              callback({ok: true});
            }
          },
          runtime: {
            lastError: null,
            sendMessage: (message, callback) => callback({
              pageTitle: 'Fixture',
              tactics: [
                {lens:'pressure', name:'Countdown pressure', trigger:'09:42', sample:'Tickets held for 09:42', index:2, frameId:0},
                {lens:'engagement', name:'Engagement bait', trigger:'Wait till the end', sample:'Wait till the end', index:5, frameId:0},
                {lens:'framing', name:'Loaded framing', trigger:'shocking', sample:'A shocking result', index:8, frameId:0}
              ]
            }),
            openOptionsPage: () => {}
          }
        };
        """
    )
    popup.goto("http://127.0.0.1:8765/popup.html", wait_until="domcontentloaded")
    popup.wait_for_function("document.fonts.status === 'loaded'")
    assert popup.locator(".finding").count() == 3
    assert popup.locator("#count").inner_text() == "3"
    assert "BAITBLOCKER" in popup.locator(".wordmark").inner_text().replace("\n", "")
    assert popup.locator("body").evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(245, 244, 239)"
    assert "Righteous" in popup.locator(".wordmark").evaluate("el => getComputedStyle(el).fontFamily")
    assert "Besley" in popup.locator(".finding-title").first.evaluate("el => getComputedStyle(el).fontFamily")
    assert "Chivo Mono" in popup.locator(".finding-lens").first.evaluate("el => getComputedStyle(el).fontFamily")
    popup.locator("#next").click()
    assert popup.locator("#position").inner_text() == "1 / 3"
    jump = popup.evaluate("window.__jumps[0]")
    assert jump["message"]["finding"]["trigger"] == "09:42"
    assert jump["options"]["frameId"] == 0
    popup.screenshot(path=str(ARTIFACTS / "popup.png"), full_page=True)

    control = browser.new_page(viewport={"width": 1000, "height": 900})
    control.add_init_script(
        """
        window.__saved = [];
        const defaults = {enabled:true,pressure:true,influence:true,engagement:true,framing:true,sensitivity:'balanced'};
        window.chrome = {storage:{sync:{
          get:(given, callback)=>callback({...given,...defaults}),
          set:(value, callback)=>{window.__saved.push(value); callback?.();}
        }}};
        """
    )
    control.goto("http://127.0.0.1:8765/control.html", wait_until="domcontentloaded")
    control.wait_for_function("document.fonts.status === 'loaded'")
    assert "BAITBLOCKER" in control.locator(".wordmark").inner_text().replace("\n", "")
    assert control.locator("body").evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(245, 244, 239)"
    assert control.locator("#pressure").is_checked()
    control.locator("label.pressure").click()
    assert not control.locator("#pressure").is_checked()
    assert control.evaluate("window.__saved.at(-1).pressure") is False
    control.locator("label.engagement").click()
    assert not control.locator("#engagement").is_checked()
    assert control.evaluate("window.__saved.at(-1).engagement") is False
    control.locator("label.master").click()
    assert not control.locator("#enabled").is_checked()
    assert control.evaluate("window.__saved.at(-1).enabled") is False
    control.locator("#sensitivity").fill("2")
    assert control.locator("#sensitivity-label").inner_text() == "SENSITIVE"
    assert control.evaluate("window.__saved.at(-1).sensitivity") == "sensitive"
    control.screenshot(path=str(ARTIFACTS / "control.png"), full_page=True)
    browser.close()

print("PASS popup design, navigation and control persistence")
