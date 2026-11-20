"""Verify the scroll-led quality storyboard and its existing assessment form."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check(page, url, screenshots, name):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='domcontentloaded')
    page.bring_to_front()
    expect(page.locator('#load-status')).to_be_hidden(timeout=60000)
    page.locator('.main-tabs [data-tab="quality"]').click()
    form = page.locator('#quality-form')
    canvas = page.locator('#quality-story-canvas')
    expect(canvas).to_be_visible()
    expect(page.get_by_role('button', name='Mulai tur', exact=True)).to_have_count(0)
    expect(page.locator('.quality-stage')).to_have_count(6)
    values = """() => Array.from(document.querySelectorAll('#quality-form input, #quality-form select'),
        item => [item.id, item.value, item.checked, item.disabled])"""
    before = page.evaluate(values)
    pixels = set()
    for stage in ['tank', 'odor', 'color', 'turbid', 'purpose', 'review', 'color', 'tank']:
        page.locator(f'#quality-{stage}').evaluate("el => el.scrollIntoView({block:'start',behavior:'instant'})")
        expect(form).to_have_attribute('data-story', stage)
        expect(page.locator(f'.quality-chapters a[href="#quality-{stage}"]')).to_have_attribute('aria-current', 'step')
        page.wait_for_timeout(800)
        assert abs(canvas.bounding_box()['y']) < 1, (name, stage, canvas.bounding_box())
        expect(page.locator('.masthead')).to_be_in_viewport(ratio=1)
        assert page.evaluate('document.documentElement.scrollWidth === innerWidth')
        pixels.add(page.evaluate("document.querySelector('#quality-story-canvas').toDataURL()"))
        if screenshots:
            page.screenshot(path=str(screenshots / f'quality-story-{name}-{stage}.png'))
    assert len(pixels) >= 6, 'The scene did not change between chapters'
    assert page.evaluate(values) == before, 'Scrolling modified form answers'
    expect(page.locator('#quality-next')).to_have_count(0)

    page.locator('.quality-chapters a[href="#quality-color"]').click()
    expect(page.locator('#quality-heading-color')).to_be_focused()
    expect(form).to_have_attribute('data-story', 'color')
    page.locator('#quality-source').select_option('rain')
    expect(page.locator('#quality-roof-checks')).to_be_visible()
    page.locator('#quality-roof-checks input[value="S01"]').check()
    page.locator('[data-issue="tank"]').click()
    dialog = page.locator('#quality-action-tank')
    expect(dialog).to_be_visible()
    dialog.locator('input[value="S05"]').check()
    page.keyboard.press('Escape')
    expect(dialog).to_be_hidden()
    for stage in ['odor', 'color', 'turbid']:
        button = page.locator(f'[data-issue="{stage}"]')
        button.click()
        dialog = page.locator(f'#quality-action-{stage}')
        expect(dialog).to_be_visible()
        if name == 'desktop':
            popup = dialog.locator('.quality-action-body').bounding_box()
            copy = page.locator(f'#quality-{stage} .quality-stage-copy').bounding_box()
            assert popup['x'] >= copy['x'] + copy['width'], (stage, popup, copy)
        dialog.get_by_role('button', name='Tutup panduan').click()
        expect(button).to_be_focused()
    page.locator('#use').select_option('NONPOTABLE_DOMESTIC')
    page.locator('#quality-withdrawal').select_option('dipped')
    page.locator('#quality-settings summary').click()
    page.locator('#lab-status').select_option('complete')
    review = page.locator('#quality-review')
    for key in ['tank', 'odor', 'color', 'turbid', 'S01', 'S05', 'S08']:
        expect(review.locator(f'input[value="{key}"]')).to_be_checked()
    review.locator('input[value="odor"]').uncheck()
    expect(page.locator('#quality-next')).to_have_count(0)
    page.get_by_role('button', name='Lihat rekomendasi', exact=True).click()
    expect(page.locator('#quality-next')).to_be_visible()
    expect(page.locator('#quality-next')).to_be_focused()
    expect(page.locator('#quality-next')).to_contain_text('Perubahan warna air')
    expect(page.locator('#quality-next')).not_to_contain_text('Bau tidak biasa')
    page.locator('.main-tabs [data-tab="home"]').click()
    expect(canvas).to_be_hidden()
    expect(page.locator('#home-story-canvas')).to_be_visible()
    page.locator('.main-tabs [data-tab="quality"]').click()
    expect(page.locator('#quality-source')).to_have_value('rain')
    expect(page.locator('#quality-withdrawal')).to_have_value('dipped')
    expect(review.locator('input[value="odor"]')).not_to_be_checked()
    expect(page.locator('#quality-next')).to_be_visible()
    if name == 'reduced-motion':
        page.locator('#quality-turbid').evaluate("el => el.scrollIntoView({block:'start',behavior:'instant'})")
        expect(form).to_have_attribute('data-story', 'turbid')
        page.wait_for_timeout(200)
        snapshot = page.evaluate("document.querySelector('#quality-story-canvas').toDataURL()")
        page.wait_for_timeout(300)
        assert snapshot == page.evaluate("document.querySelector('#quality-story-canvas').toDataURL()")
    assert not errors, errors
    print(f'PASS {name}: six animated chapters, reverse scroll, chapter links, no quality tour, dialogs, recap, manual results, preserved answers', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--channel', default='msedge')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    site = Path(__file__).resolve().parents[1] / 'WEBGIS_READY'
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(site))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel=args.channel, headless=True)
                for name, options in [
                    ('desktop', {'viewport': {'width': 1440, 'height': 900}}),
                    ('mobile', playwright.devices['Pixel 7']),
                    ('reduced-motion', {'viewport': {'width': 1024, 'height': 768}, 'reduced_motion': 'reduce'}),
                ]:
                    page = browser.new_page(**options)
                    check(page, f'http://127.0.0.1:{server.server_port}/', args.screenshots, name)
                    page.close()
                browser.close()
        finally:
            server.shutdown()
