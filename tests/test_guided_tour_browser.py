"""Exercise the Dashboard tour against real controls on desktop and mobile."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check_sidebar(page, screenshots, name):
    panel = page.locator('#dashboard-sidebar')
    toggle = page.locator('#dashboard-toggle-sidebar')
    if panel.is_visible():
        page.get_by_role('button', name='Tutup ringkasan wilayah', exact=True).click()
    expect(panel).to_be_hidden()
    expect(toggle).to_have_attribute('aria-expanded', 'false')
    page.wait_for_timeout(150)
    wide = page.locator('#map').bounding_box()['width']
    view = page.evaluate('({center: st.map.getCenter(), zoom: st.map.getZoom()})')
    toggle.click()
    expect(panel).to_be_visible()
    expect(page.locator('#dashboard-summary-title')).to_be_focused()
    expect(toggle).to_have_attribute('aria-expanded', 'true')
    page.wait_for_timeout(150)
    narrow = page.locator('#map').bounding_box()['width']
    if name == 'mobile':
        assert narrow == wide
        assert panel.bounding_box()['width'] <= page.viewport_size['width']
    else:
        assert narrow < wide - 200
    page.locator('#climate-series').select_option('annual')
    if screenshots:
        page.screenshot(path=str(screenshots / f'sidebar-{name}-open.png'))
    page.get_by_role('button', name='Tutup ringkasan wilayah', exact=True).click()
    expect(panel).to_be_hidden()
    expect(toggle).to_be_focused()
    page.wait_for_timeout(150)
    assert page.evaluate('''view => st.map.getZoom() === view.zoom &&
        st.map.distance(st.map.getCenter(), view.center) < 30 &&
        Math.abs(st.map.getSize().x - document.querySelector('#map').clientWidth) <= 1''', view)
    if screenshots:
        page.screenshot(path=str(screenshots / f'sidebar-{name}-closed.png'))
    toggle.click()
    expect(page.locator('#climate-series')).to_have_value('annual')
    page.locator('#dashboard-summary-title').press('Escape')
    expect(panel).to_be_hidden()
    page.locator('.main-tabs [data-tab="about"]').click()
    page.locator('.main-tabs [data-tab="dashboard"]').click()
    expect(panel).to_be_hidden()
    assert page.evaluate('document.documentElement.scrollWidth === innerWidth')
    print(f'PASS sidebar {name}: collapse, reopen, chart value, map resize/center, Escape, navigation', flush=True)


def check_tour(page, url, screenshots, name):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url, wait_until="domcontentloaded")
    page.bring_to_front()
    expect(page.locator("#load-status")).to_be_hidden(timeout=60000)
    page.locator('.main-tabs [data-tab="dashboard"]').click()
    check_sidebar(page, screenshots, name)
    starter = page.get_by_role("button", name="Mulai tur", exact=True)
    before = page.evaluate("""() => JSON.stringify({
        buildings: st.showRwhBuildings, rainfall: st.showRainfall,
        aid: st.showAidLocations, coverage: st.showDistributionCoverage,
        roads: st.showRoads, roadTypes: st.roadTypes,
        boundary: st.showAdministrativeBoundary, region: st.selectedRegionLevels
    })""")
    starter.click()
    dialog = page.get_by_role("dialog", name="Kenali Dashboard AQUA TRIAX")
    expect(dialog).to_be_visible()
    expect(page.locator(".tour-back")).to_be_disabled()
    page.locator(".tour-next").click()

    for step in range(1, 8):
        expect(page.locator(".tour-step")).to_have_text(f"Langkah {step + 1} dari 8")
        expect(page.locator("#tour-title")).to_be_focused()
        page.wait_for_timeout(260)
        assert page.evaluate("""() => {
            const r = document.querySelector('.tour-card').getBoundingClientRect();
            return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        }"""), f"{name} step {step + 1}: card outside viewport"
        if screenshots:
            page.screenshot(path=str(screenshots / f"tour-{name}-{step + 1}.png"))
        if step in (3, 6):
            if step == 6:
                # Moving to the next coachmark preserves the calculator fields.
                expect(page.locator("#quick-tank-roof")).to_have_value("120")
                expect(page.locator("#quick-tank-people")).to_have_value("7")
            # The highlighted control stays clickable through the overlay.
            page.get_by_role("button", name="Layer peta", exact=True).click()
            expect(page.locator("#rwh-tool-panel")).to_be_visible()
            page.wait_for_timeout(100)
            assert page.evaluate("""() => {
                const a = document.querySelector('.tour-spotlight').getBoundingClientRect();
                const b = document.querySelector('#rwh-tool-panel').getBoundingClientRect();
                return a.left <= b.left && a.right >= b.right;
            }""")
            page.get_by_role("button", name="Tutup alat peta").click()
        if step == 5:
            page.get_by_role("button", name="Kalkulator tandon", exact=True).click()
            expect(page.locator("#quick-tank-form")).to_be_visible()
            page.locator("#quick-tank-roof").fill("120")
            page.locator("#quick-tank-people").fill("6")
            # Arrow keys inside a number input keep their native behavior.
            page.locator("#quick-tank-people").press("ArrowUp")
            expect(page.locator(".tour-step")).to_have_text("Langkah 6 dari 8")
            expect(page.locator("#quick-tank-people")).to_have_value("7")
        if step == 7:
            # Previous and next work with the keyboard, then Selesai closes.
            page.locator("#tour-title").press("ArrowLeft")
            expect(page.locator(".tour-step")).to_have_text("Langkah 7 dari 8")
            page.locator("#tour-title").press("ArrowRight")
            expect(page.locator(".tour-step")).to_have_text("Langkah 8 dari 8")
        page.locator(".tour-next").click()

    expect(page.locator("#guided-tour")).to_be_hidden()
    expect(starter).to_be_focused()
    after = page.evaluate("""() => JSON.stringify({
        buildings: st.showRwhBuildings, rainfall: st.showRainfall,
        aid: st.showAidLocations, coverage: st.showDistributionCoverage,
        roads: st.showRoads, roadTypes: st.roadTypes,
        boundary: st.showAdministrativeBoundary, region: st.selectedRegionLevels
    })""")
    assert before == after, "Tour changed layer selections"

    starter.click()
    page.keyboard.press("Escape")
    expect(page.locator("#guided-tour")).to_be_hidden()
    expect(starter).to_be_focused()
    starter.click()
    page.get_by_role("button", name="Tutup tur").click()
    expect(page.locator("#guided-tour")).to_be_hidden()
    starter.click()
    for _ in range(7):
        page.locator(".tour-next").click()
    page.locator('.main-tabs [data-tab="quality"]').click()
    expect(page.locator("#guided-tour")).to_be_hidden()
    expect(page.locator("#quality-form")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    assert not errors, errors
    print(f"PASS {name}: 8 steps, real controls, keyboard, restart, exit, navigation, preserved input/layers")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--channel", default="msedge")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    site = Path(__file__).resolve().parents[1] / "WEBGIS_READY"
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(site))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel=args.channel, headless=True)
                for name, options in [
                    ("desktop", {"viewport": {"width": 1440, "height": 900}}),
                    ("mobile", playwright.devices["Pixel 7"]),
                    ("reduced-motion", {"viewport": {"width": 1024, "height": 768}, "reduced_motion": "reduce"}),
                ]:
                    page = browser.new_page(**options)
                    check_tour(page, f"http://127.0.0.1:{server.server_port}/", args.screenshots, name)
                    page.close()
                browser.close()
        finally:
            server.shutdown()
