"""Check the running standalone WebGIS on desktop and mobile using Chromium."""
import argparse
import csv
from io import StringIO
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def tab(page, name):
    if name == "rwh":
        name = "dashboard"
    buttons = page.locator(f'[data-tab="{name}"]:visible')
    button = buttons.first
    button.click()
    expect(button).to_have_attribute("aria-current", "page")


def show_aid_layer(page):
    page.get_by_role("button", name="Layer peta").click()
    page.get_by_role("checkbox", name="Lokasi bantuan air").check()
    page.get_by_role("link", name="Lihat rincian bantuan air").click()


def tap_building(page, device, audited=False):
    page.evaluate("window.scrollTo(0, 0)")
    target = page.evaluate("""audited => {
        const layer = st.buildingLayer.getLayers().find(item =>
            !audited || st.rwhAuditById.has(item.feature.properties.id));
        const center = layer.getCenter();
        st.map.setView(center, 18, {animate: false});
        const point = st.map.latLngToContainerPoint(layer.getCenter());
        const bounds = st.map.getContainer().getBoundingClientRect();
        return {x: bounds.x + point.x, y: bounds.y + point.y, properties: layer.feature.properties};
    }""", audited)
    if device == "mobile":
        page.touchscreen.tap(target["x"], target["y"])
    else:
        page.mouse.click(target["x"], target["y"])
    expect(page.locator("#rwh-building")).to_be_visible()
    return target["properties"]


def check_rwh_location(page, url):
    locate = page.get_by_role("button", name="Lokasi saya")
    expect(page.get_by_role("button", name="Kembali ke seluruh Katongan")).to_have_count(0)
    status = page.locator("#rwh-location-status")
    overview_zoom = page.evaluate("st.map.getZoom()")
    location = page.evaluate("""() => {
        const {lat, lng} = st.buildingLayer.getLayers()[0].getCenter();
        return {latitude: lat, longitude: lng, accuracy: 25};
    }""")
    page.context.grant_permissions(["geolocation"], origin=url)
    page.context.set_geolocation(location)
    locate.click()
    expect(status).to_contain_text("±25 m")
    assert page.evaluate("""({latitude, longitude}) =>
        st.map.getZoom() === 18 &&
        st.map.distance(st.rwhLocationMarker.getLatLng(), [latitude, longitude]) < 1 &&
        st.map.distance(st.map.getCenter(), [latitude, longitude]) < 1
    """, location)
    page.evaluate("resetRwhMap()")
    expect(status).to_be_empty()
    assert page.evaluate("!st.rwhLocationMarker && st.map.getZoom()") == overview_zoom

    page.context.set_geolocation({"latitude": -6.2, "longitude": 106.8, "accuracy": 25})
    locate.click()
    expect(status).to_contain_text("berada di luar Katongan")
    assert page.evaluate("!st.rwhLocationMarker && st.map.getZoom()") == overview_zoom

    page.evaluate("""() => {
        navigator.geolocation.getCurrentPosition = (_, fail) => fail({code: 1});
    }""")
    locate.click()
    expect(status).to_contain_text("Izin lokasi belum diberikan")
    expect(locate).to_be_enabled()
    page.evaluate("""() => {
        navigator.geolocation.getCurrentPosition = success => {
            window.finishTestLocation = success;
        };
    }""")
    locate.click()
    expect(locate).to_be_disabled()
    page.evaluate("resetRwhMap()")
    page.evaluate("coords => window.finishTestLocation({coords})", location)
    expect(status).to_be_empty()
    expect(locate).to_be_enabled()
    assert page.evaluate("!st.rwhLocationMarker && st.map.getZoom()") == overview_zoom
    page.evaluate("delete navigator.geolocation.getCurrentPosition")


def check_app(page, url, screenshots, device):
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#load-status")).to_be_hidden()
    expect(page.locator('nav[aria-label="Fitur utama"] button')).to_have_text([
        "Beranda", "Dashboard", "Cek Kondisi Air", "Tentang"
    ])
    expect(page.locator("#home-view")).to_be_visible()
    expect(page.locator("#home-story-canvas")).to_be_visible()
    expect(page.locator(".home-sdg")).to_contain_text(["Target 6.1 dan 6.4", "Target 13.1"])
    expect(page.locator(".masthead")).to_be_visible()
    expect(page.locator('.main-tabs [data-tab="home"]')).to_have_attribute("aria-current", "page")
    for key in ["harvest", "storage", "distribution", "quality"]:
        page.locator(f"#story-{key}").evaluate("el => el.scrollIntoView({block: 'start'})")
        expect(page.locator("#home-story")).to_have_attribute("data-story", key)
        expect(page.locator("#home-view")).to_have_attribute("data-story", key)
        expect(page.locator("#home-view")).to_be_visible()
    page.locator('.main-tabs [data-tab="dashboard"]').click()
    expect(page.locator(".masthead")).to_be_visible()
    tab(page, "about")
    expect(page.locator("#team-title")).to_be_visible()
    page.get_by_role("button", name="Beranda", exact=True).click()
    expect(page.locator("#home-title")).to_be_visible()
    expect(page.locator(".masthead")).to_be_visible()
    page.locator('.main-tabs [data-tab="dashboard"]').click()
    expect(page.locator('.main-tabs [data-tab="dashboard"]')).to_have_attribute("aria-current", "page")
    expect(page.locator('#dashboard-maps')).to_have_count(0)
    assert page.evaluate("typeof L !== 'undefined' && Boolean(st.map)")
    top_map = page.locator("#rwh-map-slot #map")
    expect(top_map).to_be_visible()
    assert top_map.bounding_box()["y"] < 180
    expect(page.locator("#rwh-legend-slot #map-legend")).to_be_visible()
    expect(page.locator("#map-legend")).to_contain_text("m³/tahun")
    summary = page.locator("#dashboard-summary-content")
    layer_button = page.get_by_role("button", name="Layer peta")
    close_tool = page.get_by_role("button", name="Tutup alat peta")
    expect(page.get_by_role("button", name="Lihat rincian", exact=True)).to_have_count(0)
    expect(page.get_by_role("button", name="Buka pilihan layer", exact=True)).to_have_count(0)
    expect(summary).to_contain_text("510.669 m³/tahun")
    expect(summary).to_contain_text("95,84%")
    expect(summary).to_contain_text("1.899 mm/tahun")
    info_panel = page.get_by_role("complementary", name="Ringkasan Katongan")
    climate = info_panel.get_by_role("region", name="Pola hujan Katongan")
    expect(climate).to_be_visible()
    expect(page.locator(".climate-month-bars button")).to_have_count(12)
    expect(page.locator("#rainfall-legend")).to_be_hidden()
    runoff = page.get_by_role("combobox", name="Koefisien limpasan (RC)")
    expect(runoff).to_be_hidden()
    layer_button.click()
    if runoff.evaluate("el => getComputedStyle(el).appearance === 'base-select'"):
        runoff.click()
        expect(page.locator("#rwh-runoff:open")).to_have_count(1)
        page.keyboard.press("Escape")
        expect(page.locator("#rwh-runoff:open")).to_have_count(0)
        expect(close_tool).to_be_visible()
    runoff.select_option("0.7")
    expect(summary).to_contain_text("510.669 m³/tahun")
    expect(page.locator("#rwh-potential-count")).to_contain_text("446.835 m³/tahun")
    runoff.select_option("0.8")
    close_tool.click()
    expect(info_panel.locator("#dashboard-summary-content")).to_be_visible()
    info_box, map_box = info_panel.bounding_box(), top_map.bounding_box()
    if device == "desktop":
        assert info_box["x"] + info_box["width"] < map_box["x"]
    else:
        assert info_box["y"] >= map_box["y"] + map_box["height"]
    check_rwh_location(page, url)
    if screenshots:
        page.screenshot(path=screenshots / f"harvesting-{device}.png")
    expect(page.locator("#rwh-map-tools").get_by_role("button", name="Kalkulator tandon")).to_be_visible()
    expect(page.locator("#rwh-map-slot #map")).to_be_visible()
    expect(page.locator("#map-legend")).to_be_visible()
    expect(page.locator("#details")).to_contain_text("334.546 m²")
    expect(page.locator("#details")).to_contain_text("40 sampel bangunan")
    page.get_by_text("Lihat rincian sampel", exact=True).click()
    expect(page.get_by_role("region", name="Rincian audit visual").locator("tbody tr")).to_have_count(40)
    assert page.evaluate("st.buildingLayer.getLayers().length") == 3583
    layer_button.click()
    for rc, total in [("0.7", "446.835"), ("0.84", "536.202"), ("0.9", "574.502"), ("0.8", "510.669")]:
        runoff.select_option(rc)
        if rc == "0.8":
            expect(page.locator("#rwh-potential-count")).to_be_hidden()
        else:
            expect(page.locator("#rwh-potential-count")).to_contain_text(total)
    close_tool.click()
    building = tap_building(page, device)
    selection = page.locator("#rwh-building")
    expect(selection).to_contain_text("liter per tahun")
    basis = selection.get_by_role("region", name="Dasar perhitungan")
    expect(basis.get_by_text(building["id"], exact=True)).to_be_visible()
    map_box, panel_box = top_map.bounding_box(), selection.bounding_box()
    if device == "mobile":
        panel_bottom = panel_box["y"] + panel_box["height"]
        assert map_box["y"] + map_box["height"] / 2 < panel_bottom <= map_box["y"] + map_box["height"]
    else:
        assert panel_box["x"] > map_box["x"] + map_box["width"] / 2
    if screenshots:
        page.screenshot(path=screenshots / f"building-{device}.png")
    page.keyboard.press("Escape")
    expect(selection).to_be_hidden()

    expect(climate).to_contain_text("Rata-rata wilayah kajian")
    expect(climate.get_by_role("button", name="Februari: 312,3 mm")).to_be_visible()
    expect(page.locator(".climate-month-bars button")).to_have_count(12)
    climate.get_by_role("button", name="Agustus: 27,4 mm").click()
    expect(page.locator("#climate-plot output")).to_have_text("Agustus · 27,4 mm")
    selector = climate.get_by_role("combobox", name="Indikator hujan")
    threshold = climate.get_by_role("combobox", name="Ambang hujan harian")
    expect(selector).to_be_visible()
    expect(selector).to_have_value("seasonal")
    expect(threshold).to_be_hidden()
    expect(climate.get_by_text("Indikator lanjutan", exact=True)).to_have_count(0)
    if selector.evaluate("el => getComputedStyle(el).appearance === 'base-select'"):
        selector.evaluate("el => el.scrollIntoView({block: 'end', behavior: 'instant'})")
        selector.click()
        expect(page.locator("#climate-series:open")).to_have_count(1)
        page.wait_for_function("""() => {
            const select = document.querySelector('#climate-series');
            const option = select.options[1].getBoundingClientRect();
            return option.top >= select.getBoundingClientRect().bottom + 8 && option.bottom <= innerHeight;
        }""")
        selector.locator('option[value="annual"]').click()
    else:
        selector.select_option("annual")
    expect(climate.get_by_role("heading", name="Total curah hujan per tahun")).to_be_visible()
    page.locator("#climate-plot input").press("End")
    expect(page.locator("#climate-plot output")).to_contain_text("2025")
    for series, last in [("monthly", "2025-12"), ("SPI3", "2025-12"),
                         ("SPI6", "2025-12"), ("CDD", "2025")]:
        selector.select_option(series)
        slider = page.locator("#climate-plot input")
        slider.press("End")
        expect(page.locator("#climate-plot output")).to_contain_text(last)
        if series.startswith("SPI"):
            slider.press("Home")
            expect(page.locator("#climate-plot output")).to_contain_text("Data belum tersedia")
    expect(threshold).to_be_visible()
    threshold.select_option("2")
    expect(page.locator("#climate-note")).to_contain_text("2,0 mm")
    selector.select_option("seasonal")
    expect(threshold).to_be_hidden()
    expect(climate.get_by_role("heading", name="Rata-rata hujan per bulan")).to_be_visible()
    expect(page.locator('.main-tabs [data-tab="dashboard"]')).to_have_attribute("aria-current", "page")

    page.get_by_role("button", name="Kalkulator tandon").click()
    expect(selection).to_be_visible()
    expect(top_map).to_be_visible()
    expect(page.locator("#quick-tank-roof")).to_have_value("")
    selection.get_by_role("button", name="Hitung", exact=True).click()
    expect(selection.get_by_role("button", name="Lihat detail")).to_be_hidden()
    page.locator("#quick-tank-roof").fill("100")
    selection.get_by_role("button", name="Hitung", exact=True).click()
    selection.get_by_role("button", name="Lihat detail").click()
    expect(page.locator("#roof")).to_have_value("100")
    expect(page.locator("#roof-source")).to_be_hidden()
    expect(info_panel).to_be_hidden()
    expect(climate).to_be_hidden()
    expect(page.locator("#metrics")).to_contain_text("86,92%")
    expect(page.locator("#metrics")).to_contain_text("126,30 m³")
    page.locator("#back-to-rwh-map").click()
    expect(selection).to_be_visible()
    expect(page.locator("#quick-tank-roof")).to_have_value("100")
    assert page.evaluate("st.selectedBuilding === null")
    selection.get_by_role("button", name="Lihat detail").click()
    expect(page.locator("#first-flush")).to_be_hidden()
    page.locator("#tank-settings summary").click()
    page.locator("#first-flush").select_option("0.5")
    page.locator("#tank-form button").click()
    expect(page.locator("#metrics")).to_contain_text("86,31%")
    expect(page.get_by_text("Dialihkan melalui first flush").locator("..")).to_contain_text("19,40 m³")
    page.locator("#tank-l").fill("0")
    page.locator("#tank-form button").click()
    expect(page.locator("#metrics")).to_contain_text("0,00%")
    page.locator("#people").fill("1.5")
    page.locator("#tank-form button").click()
    assert not page.locator("#people").evaluate("(input) => input.validity.valid")

    tab(page, "rwh")
    sample = tap_building(page, device, audited=True)
    selection.get_by_role("button", name="Hitung kebutuhan tandon").click()
    expect(top_map).to_be_visible()
    expect(basis.get_by_text(sample["id"], exact=True)).to_be_visible()
    expect(selection).to_contain_text("25 liter/orang/hari")
    quick_roof = page.locator("#quick-tank-roof")
    expect(quick_roof).to_have_value(str(sample["area_m2"]))
    expect(page.locator("#quick-tank-roof-hint")).to_contain_text("Perkiraan dari peta")
    quick_people = page.locator("#quick-tank-people")
    quick_capacity = page.locator("#quick-tank-capacity")
    quick_result = page.locator("#quick-tank-results")
    quick_detail = selection.get_by_role("button", name="Lihat detail")
    calculate_quick = selection.get_by_role("button", name="Hitung", exact=True)
    quick_people.fill("2.5")
    calculate_quick.click()
    expect(quick_detail).to_be_hidden()
    quick_people.fill("5")
    quick_capacity.fill("4000")
    quick_roof.fill("125.5")
    calculate_quick.click()
    expect(quick_result).to_contain_text("Hari dengan air cukup")
    expect(quick_result).to_contain_text("Kebutuhan air terpenuhi")
    quick_values = quick_result.locator("strong").all_text_contents()
    expect(quick_detail).to_be_visible()
    selection.get_by_text("Bandingkan ukuran tandon", exact=True).click()
    comparison_capacity = page.locator("#quick-tank-compare-capacity")
    compare = selection.get_by_role("button", name="Bandingkan", exact=True)
    comparison_table = selection.get_by_role("table", name="Perkiraan untuk atap dan kebutuhan air yang sama")
    comparison_capacity.fill("4000")
    compare.click()
    expect(comparison_table).to_have_count(0)
    comparison_capacity.fill("0")
    compare.click()
    expect(comparison_table.get_by_role("columnheader")).to_have_text(["4.000 L", "0 L"])
    expect(comparison_table.get_by_role("row", name="Hari cukup air, Juli–September").get_by_role("cell")).to_have_text([
        quick_result.locator(".quick-tank-season > b").inner_text(), "0,00%"
    ])
    expect(comparison_table.get_by_role("row", name="Hari cukup air, sepanjang tahun").get_by_role("cell")).to_have_text([
        quick_values[0], "0,00%"
    ])
    expect(comparison_table.get_by_role("row", name="Kebutuhan air terpenuhi").get_by_role("cell")).to_have_text([
        quick_values[1], "0,00%"
    ])
    page.wait_for_function("!st.map._panAnim?._inProgress")
    map_position = """() => {
        const zoom = st.map.getZoom();
        const {x, y} = st.map.project(st.map.getCenter(), zoom);
        return [x, y, zoom];
    }"""
    original_position = page.evaluate(map_position)
    quick_detail.click()
    expect(selection).to_be_hidden()
    expect(page.locator("#roof")).to_have_value("125.5")
    expect(page.locator("#roof-source")).to_be_hidden()
    expect(page.locator("#people")).to_have_value("5")
    expect(page.locator("#tank-l")).to_have_value("4000")
    expect(page.locator("#percap")).to_have_value("25")
    expect(page.locator("#first-flush")).to_have_value("0")
    expect(page.locator("#details")).to_contain_text("Audit visual")
    expect(page.locator("#details")).to_contain_text("confidence")
    for label, value in zip(["Hari dengan air cukup", "Kebutuhan terpenuhi"], quick_values):
        expect(page.locator("#metrics .metric").filter(has_text=label)).to_contain_text(value)

    page.locator("#back-to-rwh-map").click()
    expect(top_map).to_be_visible()
    expect(selection).to_be_focused()
    assert page.evaluate("st.selectedBuilding.feature.properties.id") == sample["id"]
    restored_position = page.evaluate(map_position)
    assert restored_position[2] == original_position[2]
    assert all(abs(a - b) < 1 for a, b in zip(original_position[:2], restored_position[:2])), (
        original_position, restored_position
    )
    expect(quick_people).to_have_value("5")
    expect(quick_roof).to_have_value("125.5")
    expect(quick_capacity).to_have_value("4000")
    assert quick_result.locator("strong").all_text_contents() == quick_values
    expect(comparison_table.get_by_role("columnheader")).to_have_text(["4.000 L", "0 L"])
    quick_capacity.fill("5000")
    expect(quick_detail).to_be_hidden()
    expect(comparison_table).to_have_count(0)
    calculate_quick.click()
    quick_detail.click()

    page.locator("#tank-settings summary").click()
    expect(page.locator("#yas-benchmark option")).to_have_count(46)
    page.locator("#yas-benchmark").select_option("0")
    expect(page.locator("#demand-mode")).to_have_value("total")
    expect(page.locator("#daily-demand")).to_have_value("50")
    expect(page.locator("#first-flush")).to_have_value("0")
    expect(page.locator("#yas-comparison")).to_contain_text("78,89%")
    comparison = page.locator("#yas-comparison tbody tr").all()
    assert len(comparison) == 7
    for row in comparison:
        cells = row.locator("td").all_text_contents()
        assert cells[1] == cells[2], cells
    page.locator("#first-flush").select_option("0.5")
    page.locator("#tank-form button").click()
    expect(page.locator("#yas-comparison")).to_have_count(0)

    tab(page, "rwh")
    page.evaluate("() => { st.map.setZoom(15, {animate: false}); }")
    original_position = page.evaluate(map_position)
    page.get_by_role("button", name="Layer peta").click()
    aid_layer = page.get_by_role("checkbox", name="Lokasi bantuan air")
    roof_layer = page.get_by_role("checkbox", name="Potensi air hujan per bangunan")
    layer_legend = page.locator("#map-legend")
    expect(page.locator("#rwh-tool-legend")).to_have_count(0)
    potential_range = page.get_by_role("combobox", name="Rentang potensi tampungan")
    expect(potential_range).to_have_value("")
    potential_range.select_option("150")
    expect(summary).to_contain_text("3.583")
    expect(layer_legend).to_contain_text("150–<300 m³/tahun")
    expect(layer_legend).not_to_contain_text("80–<150")
    matching_buildings = """() => {
        const visible = st.buildingLayer.getLayers().map(layer => layer.feature);
        const expected = st.buildings.features.filter(feature => {
            const volume = metricM3(feature);
            return volume >= 150 && volume < 300;
        });
        return visible.length > 0 && visible.length < st.buildings.features.length &&
            visible.length === expected.length && visible.every((feature, index) => feature === expected[index]);
    }"""
    assert page.evaluate(matching_buildings)
    expect(page.locator("#rwh-potential-count")).to_contain_text("bangunan dalam rentang ini")
    assert page.evaluate(map_position) == original_position
    page.get_by_role("button", name="Tutup alat peta").click()
    filtered_building = tap_building(page, device)
    assert 150 <= filtered_building["rwh_rc80_m3yr"] < 300
    expect(selection).to_contain_text("liter per tahun")
    page.keyboard.press("Escape")
    layer_button.click()
    runoff.select_option("0.7")
    assert page.evaluate(matching_buildings)
    runoff.select_option("0.8")
    assert page.evaluate(matching_buildings)
    expect(potential_range).to_have_value("150")
    potential_range.select_option("")
    assert page.evaluate("st.buildingLayer.getLayers().length === st.buildings.features.length")
    page.wait_for_function("!st.map._panAnim?._inProgress")
    original_position = page.evaluate(map_position)
    road_switch = page.get_by_role("checkbox", name="Jalan", exact=True)
    walk_roads = page.get_by_role("checkbox", name="Jalan pejalan kaki")
    drive_roads = page.get_by_role("checkbox", name="Jalan kendaraan")
    expect(road_switch).to_be_checked()
    expect(walk_roads).to_be_checked()
    expect(drive_roads).to_be_checked()
    road_switch.uncheck()
    expect(walk_roads).to_be_hidden()
    road_switch.check()
    expect(walk_roads).to_be_checked()
    road_fields = page.locator("#rwh-road-fields")
    expect(road_fields.get_by_text("Jenis jalan", exact=True)).to_have_count(0)
    expect(road_fields.locator('label:has(input[data-road-type="walk"]) path')).to_have_attribute("stroke-dasharray", "8 7")
    expect(road_fields.locator('label:has(input[data-road-type="drive"]) path')).to_have_attribute("stroke-dasharray", "none")
    drive_roads.check()
    expect(page.locator("#rwh-road-region-hint")).to_be_hidden()
    expect(layer_legend.locator(".road-legend-line")).to_have_count(2)
    assert page.evaluate("st.map.hasLayer(st.roadLayers.walk) && st.map.hasLayer(st.roadLayers.drive)")
    assert page.evaluate(map_position) == original_position
    aid_layer.check()
    expect(layer_legend).to_contain_text("Lokasi bantuan terdahulu")
    expect(layer_legend.locator(".mdmc-legend-icon svg")).to_be_visible()
    expect(top_map.locator(".mdmc-pin svg")).to_have_count(1)
    assert page.evaluate("st.map.hasLayer(st.buildingLayer) && st.map.hasLayer(st.mdmcLayer)")
    roof_layer.uncheck()
    expect(potential_range).to_be_hidden()
    expect(layer_legend).not_to_contain_text("m³/tahun")
    assert page.evaluate("!st.map.hasLayer(st.buildingLayer) && st.map.hasLayer(st.mdmcLayer)")
    aid_layer.uncheck()
    expect(summary).to_contain_text("510.669 m³/tahun")
    expect(climate).to_be_visible()
    roof_layer.check()
    expect(potential_range).to_be_visible()
    expect(summary).to_contain_text("510.669 m³/tahun")
    expect(layer_legend).not_to_contain_text("Lokasi bantuan terdahulu")
    assert page.evaluate("st.map.hasLayer(st.buildingLayer) && st.mdmcLayer === null")
    assert page.evaluate(map_position) == original_position
    rainfall_layer = page.get_by_role("checkbox", name="Curah hujan rata-rata")
    rainfall_legend = page.locator("#rainfall-legend")
    expect(rainfall_layer).not_to_be_checked()
    expect(rainfall_legend).to_be_hidden()
    rainfall_layer.check()
    expect(rainfall_legend).to_be_visible()
    expect(climate).to_be_visible()
    expect(rainfall_legend).to_contain_text("mm/tahun")
    expect(rainfall_legend.locator("#rainfall-legend-values span")).to_have_text(["1.881,2", "2.079,5"])
    assert rainfall_legend.locator(".rainfall-gradient").evaluate("el => getComputedStyle(el).backgroundImage.startsWith('linear-gradient')")
    assert page.evaluate("st.rainfallLayer.getLayers().length === 3 && st.map.hasLayer(st.buildingLayer)")
    assert page.evaluate(map_position) == original_position
    boundary = page.get_by_role("checkbox", name="Batas administrasi")
    province = page.get_by_role("combobox", name="Provinsi")
    regency = page.get_by_role("combobox", name="Kabupaten/Kota")
    district = page.get_by_role("combobox", name="Kecamatan/Kapanewon")
    kalurahan = page.get_by_role("combobox", name="Desa/Kalurahan")
    expect(boundary).to_be_checked()
    expect(kalurahan).to_have_value("Katongan")
    assert page.evaluate("st.map.hasLayer(st.outline)")
    province.select_option("")
    boundary.uncheck()
    expect(province).to_be_hidden()
    boundary.check()
    expect(province).to_be_visible()
    expect(regency).to_be_disabled()
    expect(kalurahan).to_be_disabled()
    province.select_option("Daerah Istimewa Yogyakarta")
    regency.select_option("Gunungkidul")
    district.select_option("Nglipar")
    assert page.evaluate("!st.map.hasLayer(st.outline) && !st.map.hasLayer(st.roadLayers.drive)")
    kalurahan.select_option("Katongan")
    expect(page.locator("#rwh-road-region-hint")).to_be_hidden()
    expect(layer_legend.locator('.road-legend-line path[stroke-dasharray="8 7"][stroke-linecap="butt"]')).to_have_count(1)
    expect(layer_legend.locator('.road-legend-line path[stroke-dasharray="none"]')).to_have_count(1)
    assert page.evaluate("""() => st.map.hasLayer(st.roadLayers.walk) && st.map.hasLayer(st.roadLayers.drive) &&
        st.roadLayers.drive.getLayers().length === st.driveRoads.features.length""")
    kalurahan.select_option("")
    assert page.evaluate("!st.map.hasLayer(st.roadLayers.walk) && !st.map.hasLayer(st.roadLayers.drive)")
    expect(page.locator("#rwh-road-region-hint")).to_be_visible()
    kalurahan.select_option("Katongan")
    walk_roads.uncheck()
    assert page.evaluate("!st.map.hasLayer(st.roadLayers.walk) && st.map.hasLayer(st.roadLayers.drive)")
    road_switch.uncheck()
    expect(drive_roads).to_be_hidden()
    assert page.evaluate("!st.map.hasLayer(st.roadLayers.drive)")
    expect(layer_legend).to_contain_text("Batas Kalurahan Katongan")
    assert page.evaluate("""() => st.map.hasLayer(st.outline) &&
        st.map.getBounds().contains(st.outline.getBounds()) && st.outline.getLayers()[0].options.fillOpacity > 0 &&
        st.map.hasLayer(st.rainfallLayer) && st.map.hasLayer(st.buildingLayer)""")
    assert page.evaluate("st.map.getZoom()") < original_position[2]
    page.get_by_role("button", name="Tutup alat peta").click()
    legend_box, map_box = rainfall_legend.bounding_box(), top_map.bounding_box()
    assert legend_box["x"] - map_box["x"] < 20
    guide_box = page.locator(".rwh-map-guide").bounding_box()
    assert guide_box["y"] <= legend_box["y"]
    assert legend_box["y"] + legend_box["height"] <= guide_box["y"] + guide_box["height"]
    page.evaluate("""() => {
        const cell = st.rainfallLayer.getLayers().find(layer => layer.feature.properties.rain_mm_annual < 1900);
        cell.fire('click', {latlng: cell.getBounds().getCenter()});
    }""")
    expect(page.locator(".leaflet-popup-content")).to_contain_text("1.881,2 mm/tahun")
    page.get_by_role("button", name="Layer peta").click()
    expect(kalurahan).to_have_value("Katongan")
    page.wait_for_function("!st.map._panAnim?._inProgress")
    before_clear = page.evaluate(map_position)
    boundary.uncheck()
    expect(province).to_be_hidden()
    expect(layer_legend).not_to_contain_text("Batas Kalurahan Katongan")
    assert page.evaluate("!st.map.hasLayer(st.outline)")
    assert page.evaluate(map_position) == before_clear
    boundary.check()
    expect(kalurahan).to_have_value("Katongan")
    regency.select_option("")
    expect(district).to_have_value("")
    expect(kalurahan).to_be_disabled()
    assert page.evaluate("!st.map.hasLayer(st.outline)")
    boundary.uncheck()
    rainfall_layer.uncheck()
    expect(rainfall_legend).to_be_hidden()
    expect(page.locator(".leaflet-popup-content")).to_have_count(0)
    assert page.evaluate("!st.map.hasLayer(st.rainfallLayer)")
    coverage = page.get_by_role("checkbox", name="Zona cakupan distribusi air")
    original_position = page.evaluate(map_position)
    coverage.check()
    expect(page.locator("#rwh-coverage-summary")).to_contain_text("95,84%")
    expect(page.get_by_role("combobox", name="Metode cakupan")).to_have_count(0)
    expect(page.get_by_role("button", name="Bandingkan skenario")).to_have_count(0)
    expect(page.locator("#rwh-coverage-fields")).to_contain_text("Garis lurus · radius 500 m")
    expect(layer_legend).to_contain_text("Lingkaran simulasi · radius 500 m")
    expect(layer_legend.locator(".coverage-legend-circle")).to_be_visible()
    assert page.evaluate("""() => !st.mdmcLayer && st.circlesLayer.getLayers().length === 11 &&
        st.circlesLayer.getLayers().every(layer => layer.feature.properties.buffer_radius_m === 500)""")
    coverage.uncheck()
    assert page.evaluate("!st.circlesLayer && !st.assignmentLayer && !st.siteLayer")
    assert page.evaluate(map_position) == original_position
    page.get_by_role("button", name="Tutup alat peta").click()
    show_aid_layer(page)
    expect(page.locator("#distribution-details")).to_contain_text("5.000 liter")
    expect(page.locator("#distribution-details")).to_contain_text("30 September 2026")
    expect(page.locator("#distribution-actions a")).to_have_attribute("href", "https://desakatongan.gunungkidulkab.go.id/first")
    assert page.evaluate("!st.distributionUpdate && !st.siteLayer")
    page.locator("#toggle-planning").click()
    expect(page.locator("#site-method")).to_have_value("euclidean")
    page.locator("#site-method").select_option("network")
    expect(page.locator("#site-method")).to_have_value("network")
    page.get_by_role("button", name="Layer peta").click()
    coverage.check()
    expect(page.locator("#rwh-coverage-summary")).to_contain_text("95,84%")
    assert page.evaluate("st.circlesLayer.getLayers().length === 11 && !st.assignmentLayer")
    coverage.uncheck()
    expect(layer_legend).to_contain_text("Bangunan tercakup · jaringan 500 m (simulasi)")
    page.get_by_role("button", name="Tutup alat peta").click()
    expect(page.get_by_role("button", name="Kalkulator tandon")).to_be_visible()
    expect(page.locator("#scenario-selected_site_count")).to_have_value("30")
    expect(page.locator("#checklist-site option")).to_have_count(30)
    page.locator("#checklist-site").select_option("NET-S30")
    expect(page.locator("#checklist-status")).to_contain_text("Kepemilikan lahan")
    expect(page.locator("#checklist-status")).to_contain_text("Belum terverifikasi")
    mdmc_recap = page.get_by_role("region", name="Rekap historis per wilayah")
    expect(mdmc_recap.locator("tbody tr")).to_have_count(3)
    expect(mdmc_recap).to_contain_text("Gunungkidul")
    expect(mdmc_recap).to_contain_text("374")
    assert page.evaluate("st.mdmcLayer.getLayers().length") == 1
    page.evaluate("() => { st.mdmcLayer.getLayers()[0].openPopup(); }")
    expect(page.locator(".leaflet-popup-content")).to_contain_text("5.000 L")
    expect(page.locator(".leaflet-popup-content")).to_contain_text("Koordinat perkiraan")
    page.locator(".leaflet-popup-close-button").click()
    expect(page.locator(".leaflet-popup-content")).to_have_count(0)
    page.locator('[data-network-layer="mdmc"]').uncheck()
    assert page.evaluate("st.mdmcLayer === null")
    for value in ("30", "3.145", "438", "418", "20", "87,78%", "Target 95% belum tercapai"):
        expect(page.locator("#distribution-metrics")).to_contain_text(value)
    assert page.evaluate("st.siteLayer.getLayers().length") == 30
    assert page.evaluate("st.assignmentLayer.getLayers().length") == 3145
    assert page.evaluate("st.uncoveredLayer.getLayers().length") == 438
    page.locator("#assignment-site").select_option("NET-S01")
    assert page.evaluate("st.assignmentLayer.getLayers().length") == 144
    page.evaluate("() => { st.assignmentLayer.getLayers()[0].openPopup(); }")
    expect(page.locator(".leaflet-popup-content")).to_contain_text("Kandidat: NET-S01")
    page.locator(".leaflet-popup-close-button").click()
    expect(page.locator(".leaflet-popup-content")).to_have_count(0)
    page.locator('[title="NET-S01"]').click()
    expect(page.locator(".leaflet-popup-content")).to_contain_text("Bangunan teralokasi: 146")
    page.locator(".leaflet-popup-close-button").click()
    page.locator("#network-coverage-plot input").press("End")
    expect(page.locator("#network-coverage-plot output")).to_contain_text("87,61 %")
    expect(page.locator("#distribution-details")).to_contain_text("local swap")
    page.locator("#scenario-radius_m").select_option("250")
    page.locator("#scenario-connector_max_m").select_option("75")
    page.locator("#scenario-selected_site_count").select_option("5")
    expect(page.locator("#distribution-metrics")).to_contain_text("16,05%")
    expect(page.locator("#distribution-metrics")).to_contain_text("Cakupan 250 m")
    expect(page.locator("#assignment-site")).to_have_count(0)
    assert page.evaluate("st.siteLayer.getLayers().map(layer => layer.feature.properties.site_id).sort()") == [
        "NET-S01", "NET-S06", "NET-S10", "NET-S12", "NET-S13"
    ]
    assert page.evaluate("st.assignmentLayer.getLayers().length") == 575
    assert page.evaluate("st.uncoveredLayer.getLayers().length") == 3008
    page.locator('[data-network-layer="zones"]').check()
    assert page.evaluate("st.zoneLayer.getLayers().length") == 5
    page.locator("#distribution-demand").select_option("0")
    expect(page.locator("#distribution-details")).to_contain_text("20.883,8 L/hari")
    expect(page.locator("#distribution-details")).not_to_contain_text("Di area tercakup")
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    if screenshots:
        page.screenshot(path=screenshots / f"distribution-{device}.png")
    page.locator("#reset-distribution").click()
    expect(page.locator("#distribution-metrics")).to_contain_text("87,78%")
    expect(page.locator("#assignment-site")).to_be_visible()
    expect(page.locator("#distribution-details")).to_contain_text("Di area tercakup")
    page.locator("#site-method").select_option("euclidean")
    expect(page.locator("#distribution-metrics")).to_contain_text("95,84%")
    page.locator('[data-phase="14"]').click()
    expect(page.locator("#distribution-metrics")).to_contain_text("98,16%")
    layer_button.click()
    coverage.check()
    assert page.evaluate("st.circlesLayer.getLayers().length === 14")
    coverage.uncheck()
    close_tool.click()
    page.locator("#site-method").select_option("network")
    expect(page.locator("#distribution-metrics")).to_contain_text("87,78%")
    page.locator("#toggle-planning").click()
    expect(page.locator("#distribution-details")).to_contain_text("5.000 liter")
    page.get_by_role("button", name="Layer peta").click()
    coverage.uncheck()
    page.get_by_role("button", name="Tutup alat peta").click()
    assert page.evaluate("!st.siteLayer && st.mdmcLayer.getLayers().length === 1")

    tab(page, "quality")
    expect(page.locator('.quality-stage')).to_have_count(5)
    assert page.locator(".quality-stage-label").all_text_contents() == [
        "Tandon", "Bau", "Warna", "Kekeruhan", "Tujuan penggunaan"
    ]
    for stage in page.locator(".quality-stage").all():
        expect(stage).to_be_visible()
        expect(stage.locator(".quality-scene-art")).to_be_visible()
        for photo in stage.locator("img").all():
            stage.scroll_into_view_if_needed()
            assert photo.evaluate("img => img.decode().then(() => img.naturalWidth > 0)")
        assert stage.evaluate("""section => {
            const rect = section.getBoundingClientRect();
            return rect.left === 0 && Math.abs(rect.width - document.documentElement.clientWidth) < 1;
        }""")
    expect(page.locator("#use")).to_be_visible()
    expect(page.locator("#lab-status")).to_be_hidden()
    review = page.locator("#quality-purpose").get_by_role("region", name="Tinjau temuan Anda")
    recommend = review.get_by_role("button", name="Lihat rekomendasi")
    review_odor = review.locator('[data-review-item][value="odor"]')
    review_color = review.locator('[data-review-item][value="color"]')
    review_chemical = review.locator('[data-review-item][value="chem"]')
    expect(review.locator('input:checked')).to_have_count(0)
    for stage_id, filled_count in (("purpose", 4), ("odor", 1)):
        active_stage = page.locator(f"#quality-{stage_id}")
        active_stage.evaluate("stage => scrollTo(0, scrollY + stage.getBoundingClientRect().top - innerHeight * .25)")
        expect(active_stage).to_have_attribute("data-water", "flowing")
        expect(page.locator('.quality-stage[data-water="filled"]')).to_have_count(filled_count)
    expect(page.locator("#quality-purpose .quality-pour")).to_have_css("visibility", "hidden")
    if screenshots:
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=screenshots / f"quality-page-{device}.png", full_page=True)
    page.locator("#use").select_option("DRINKING")
    recommend.click()
    expect(page.locator("#quality-next")).to_contain_text("Belum terverifikasi")
    expect(page.locator("#quality-next")).to_contain_text("sudah dipastikan layak")
    odor_button = page.locator("#quality-odor .quality-issue")
    odor_button.click()
    popup = page.locator("#quality-action-odor")
    expect(popup).to_be_visible()
    expect(popup.locator("h3")).to_be_focused()
    expect(popup).to_contain_text("hentikan semua penggunaan")
    expect(popup).to_contain_text("Merebus")
    expect(popup.locator("details")).to_have_count(0)
    expect(popup.get_by_role("checkbox")).to_have_count(0)
    if screenshots:
        page.screenshot(path=screenshots / f"quality-popup-{device}.png")
    page.keyboard.press("Escape")
    expect(popup).to_be_hidden()
    expect(odor_button).to_be_focused()
    expect(page.get_by_text("Temuan dicatat", exact=True)).to_have_count(0)
    expect(review_odor).to_be_checked()
    expect(review_color).not_to_be_checked()
    expect(page.locator("#quality-next")).to_have_count(0)
    review_color.check()
    page.locator("#use").select_option("NONPOTABLE_DOMESTIC")
    page.locator('#quality-form button[type="submit"]').click()
    expect(page.locator("#quality-next")).to_be_focused()
    expect(page.locator("#quality-next")).to_contain_text("puskesmas")
    expect(page.locator("#quality-next")).to_contain_text("Perubahan warna air")
    review_color.uncheck()
    expect(page.locator("#quality-next")).to_have_count(0)
    recommend.click()
    expect(page.locator("#details")).to_contain_text("Karbon aktif granular")
    expect(page.locator("#details")).not_to_contain_text("Temuan dan tindak lanjut sanitasi")
    expect(page.locator("#quality-next")).to_contain_text("Belum terverifikasi")
    expect(page.locator("#quality-roof-checks")).to_be_hidden()
    expect(page.locator("#quality-review-roof")).to_be_hidden()
    source = page.locator("#quality-source")
    source.select_option("rain")
    roof_checks = page.locator("#quality-roof-checks")
    expect(roof_checks).to_be_visible()
    expect(page.locator("#quality-review-roof")).to_be_visible()
    roof_offset = source.evaluate("""el => {
        const trigger = el.getBoundingClientRect();
        const checklist = document.querySelector('#quality-roof-checks').getBoundingClientRect();
        return {x: checklist.left - trigger.left, y: checklist.top - trigger.bottom};
    }""")
    assert abs(roof_offset["x"]) < 1
    assert abs(roof_offset["y"] - 8) < 1, roof_offset
    expect(roof_checks.get_by_role("checkbox", name="Ada kotoran hewan, debu, atau daun di atap")).to_be_visible()
    for item in ("S01", "S03", "S02", "S04"):
        checkbox = roof_checks.locator(f'[data-sanitary][value="{item}"]')
        expect(checkbox).to_be_visible()
        checkbox.check()
        expect(review.locator(f'input[value="{item}"]')).to_be_checked()
    recap_roof = review.locator('input[value="S01"]')
    recap_roof.uncheck()
    expect(roof_checks.locator('input[value="S01"]')).not_to_be_checked()
    recap_roof.check()
    page.locator('[data-issue="tank"]').click()
    tank_popup = page.locator("#quality-action-tank")
    tank_popup.locator("summary").click()
    for item in ("S05", "S06", "S07", "dirty_water"):
        tank_popup.locator(f'[data-sanitary][value="{item}"]').check()
    expect(tank_popup.get_by_text("Sertakan temuan ini pada hasil akhir")).to_have_count(0)
    tank_popup.get_by_role("button", name="Tutup panduan").click()
    expect(review.locator('input[value="tank"]')).to_be_checked()
    expect(review.locator('input[value="S05"]')).to_be_checked()
    chemical_button = page.locator('[data-issue="chem"]')
    chemical_button.click()
    chemical_popup = page.locator("#quality-action-chem")
    expect(chemical_popup).to_contain_text("Hentikan penggunaan")
    expect(chemical_popup.get_by_role("checkbox")).to_have_count(0)
    chemical_popup.get_by_role("button", name="Tutup panduan").click()
    expect(review_chemical).to_be_checked()
    page.locator("#quality-settings summary").click()
    page.locator('[data-sanitary][value="S09"]').check()
    page.locator("#use").select_option("DRINKING")
    page.locator("#quality-withdrawal").select_option("dipped")
    review_withdrawal = review.locator('input[value="S08"]')
    expect(review_withdrawal).to_be_checked()
    review_withdrawal.uncheck()
    expect(page.locator("#quality-withdrawal")).to_have_value("")
    review_withdrawal.check()
    expect(page.locator("#quality-withdrawal")).to_have_value("dipped")
    page.locator("#lab-status").select_option("complete")
    page.locator("#quality-demand").select_option("DOMESTIC_MID")
    for stage in ("color", "turbid"):
        page.locator(f"#quality-{stage} .quality-issue").click()
        dialog = page.locator(f"#quality-action-{stage}")
        expect(dialog.get_by_role("checkbox")).to_have_count(0)
        dialog.get_by_role("button", name="Tutup panduan").click()
        expect(dialog).to_be_hidden()
        expect(review.locator(f'input[value="{stage}"]')).to_be_checked()
    page.locator('#quality-form button[type="submit"]').click()
    expect(page.locator("#quality-next")).to_contain_text("Perlu tinjauan ahli")
    expect(page.locator("#quality-next")).to_contain_text("sudah dipastikan layak")
    expect(page.locator("#quality-next strong").first).to_have_text("Ada dugaan bahan kimia masuk")
    expect(page.locator("#quality-next")).to_contain_text("Air diambil dengan mencelupkan wadah")
    expect(page.locator("#quality-next")).to_contain_text("Tutup tandon terbuka atau longgar")
    expect(page.locator("#quality-next")).not_to_contain_text("Masalah pada tandon")
    tab(page, "about")
    tab(page, "quality")
    expect(page.locator("#quality-source")).to_have_value("rain")
    expect(page.locator("#quality-withdrawal")).to_have_value("dipped")
    expect(page.locator("#quality-next strong").first).to_have_text("Ada dugaan bahan kimia masuk")
    expect(page.locator("#details")).to_contain_text("50 L/orang/hari")
    expect(page.locator("#details")).to_contain_text("E. coli")
    expect(page.locator("#details")).to_contain_text("Pemeriksaan bau atau perubahan warna")
    page.get_by_text("Lihat rincian pemeriksaan dan opsi pengolahan", exact=True).click()
    page.get_by_text("First-flush diverter", exact=True).click()
    expect(page.get_by_text("Mekanisme", exact=True).filter(visible=True)).to_be_visible()
    expect(review_chemical).to_be_checked()
    review_chemical.uncheck()
    page.locator("#quality-source").select_option("well")
    expect(page.locator("#quality-roof-checks")).to_be_hidden()
    expect(page.locator("#quality-review-roof")).to_be_hidden()
    page.locator('#quality-form button[type="submit"]').click()
    expect(page.locator("#quality-next strong").first).to_have_text("Air banjir atau air kotor sempat masuk")
    expect(page.locator("#quality-next")).not_to_contain_text("Kotoran hewan")
    review_odor.uncheck()
    expect(page.locator("#quality-next")).to_have_count(0)
    recommend.click()
    expect(page.locator("#quality-next")).not_to_contain_text("Bau tidak biasa")
    expect(page.locator("#quality-next")).to_contain_text("Perubahan warna air")
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    tab(page, "about")
    page.get_by_role("button", name="Metodologi & sumber").click()
    expect(page.locator("#details")).to_contain_text("125 m")
    assert not page_errors, page_errors
    print(f"PASS {device}: overview, RWH, climate, YAS, distribution, Kesling, methodology")


def check_failure_states(browser, url):
    page = browser.new_page()
    page.route("**/data/network_summary.json", lambda route: route.fulfill(status=404))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#load-status")).to_be_hidden()
    tab(page, "rwh")
    show_aid_layer(page)
    page.locator("#toggle-planning").click()
    expect(page.locator("#site-method")).to_have_value("euclidean")
    expect(page.locator("#distribution-details")).to_contain_text("Data jaringan OSM tidak tersedia")
    page.close()

    page = browser.new_page()
    page.route("**/data/distribution/scenarios_150.json", lambda route: route.fulfill(status=404))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#load-status")).to_be_hidden()
    tab(page, "rwh")
    show_aid_layer(page)
    expect(page.locator("#distribution-details")).to_contain_text("5.000 liter")
    page.locator("#toggle-planning").click()
    page.locator("#site-method").select_option("network")
    expect(page.locator("#retry-distribution")).to_be_visible()
    expect(page.locator("#distribution-metrics")).to_contain_text("87,78%")
    page.unroute("**/data/distribution/scenarios_150.json")
    page.locator("#retry-distribution").click()
    expect(page.locator("#scenario-selected_site_count")).to_have_value("30")
    page.close()

    page = browser.new_page()
    page.route("**/data/daily.csv", lambda route: route.fulfill(status=404))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.get_by_role("alert")).to_contain_text("data/daily.csv: 404")
    expect(page.locator("#rwh-open-tank")).to_be_disabled()
    page.close()

    page = browser.new_page()
    rainfall_path = "**/data/rainfall_chirps.geojson"
    page.route(rainfall_path, lambda route: route.fulfill(status=404))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#load-status")).to_be_hidden()
    tab(page, "dashboard")
    page.get_by_role("button", name="Layer peta").click()
    page.get_by_role("checkbox", name="Curah hujan rata-rata").check()
    expect(page.locator("#rwh-rainfall-status")).to_contain_text("belum bisa dimuat")
    expect(page.locator("#rainfall-legend")).to_be_hidden()
    page.unroute(rainfall_path)
    page.get_by_role("button", name="Muat ulang curah hujan").click()
    expect(page.locator("#rainfall-legend")).to_be_visible()
    page.close()
    print("PASS failure states: historical fallback, Page 2 retry, and core-data load error")


def check_legacy_sanitary_catalog(browser, url):
    catalog = Path(__file__).resolve().parents[1] / "WEBGIS_READY/data/sanitary_checklist.csv"
    legacy = StringIO()
    with catalog.open(encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        fields = [name for name in reader.fieldnames if not name.startswith("resident_")]
        rows = {row["item_id"]: row for row in reader}
        writer = csv.DictWriter(legacy, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows.values())

    page = browser.new_page()
    page.route("**/data/sanitary_checklist.csv", lambda route: route.fulfill(body=legacy.getvalue(), content_type="text/csv"))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#load-status")).to_be_hidden()
    tab(page, "quality")
    page.locator("#quality-source").select_option("rain")
    roof_checks = page.locator("#quality-roof-checks")
    for key in ("S01", "S02", "S03", "S04"):
        expect(roof_checks.get_by_role("checkbox", name=rows[key]["question_risk_if_yes"])).to_be_visible()
    roof_checks.get_by_role("checkbox", name=rows["S01"]["question_risk_if_yes"]).check()
    page.locator("#use").select_option("DRINKING")
    page.locator(".quality-submit").click()
    expect(page.locator("#quality-next")).to_contain_text(rows["S01"]["suggested_action"])
    page.close()
    print("PASS legacy catalog: roof checklist labels and actions")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000/")
    parser.add_argument("--channel", default="chrome", help="Installed Chromium channel, e.g. chrome or msedge")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel=args.channel)
        desktop = browser.new_page(viewport={"width": 1366, "height": 900})
        check_app(desktop, args.url, args.screenshots, "desktop")
        desktop.close()
        mobile = browser.new_page(**playwright.devices["Pixel 7"])
        check_app(mobile, args.url, args.screenshots, "mobile")
        mobile.close()
        check_failure_states(browser, args.url)
        check_legacy_sanitary_catalog(browser, args.url)
