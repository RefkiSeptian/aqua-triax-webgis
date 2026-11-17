'use strict';

const esriTileRoot = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const esriImagery = 'World_Imagery';
const esriGray = 'Canvas/World_Light_Gray_Base';
const esriLabels = 'Reference/World_Boundaries_and_Places';
const esriRoads = 'Reference/World_Transportation';
const esriStreets = 'World_Street_Map';
const esriTopography = 'World_Topo_Map';
const esriImageryCredit = 'Esri, Vantor, Earthstar Geographics, dan GIS User Community';
const esriReferenceCredit = 'Esri, HERE, Garmin, OpenStreetMap contributors, dan GIS User Community';
const esriStreetCredit = 'Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, © OpenStreetMap contributors, dan GIS User Community';
const esriTopographyCredit = 'Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), © OpenStreetMap contributors, dan GIS User Community';
const esriTile = (service, tile) => `${esriTileRoot}/${service}/MapServer/tile/${tile}`;
const katonganPreview = '14/8550/13227';
const defaultBasemap = 'esriStreets';
const rwhBasemaps = {
  esriStreets: {label: 'Peta jalan', preview: esriTile(esriStreets, katonganPreview)},
  gray: {label: 'Abu-abu terang', preview: esriTile(esriGray, katonganPreview)},
  satellite: {label: 'Citra satelit', preview: esriTile(esriImagery, katonganPreview)},
  hybrid: {label: 'Satelit dengan label', preview: esriTile(esriImagery, katonganPreview)},
  topo: {label: 'Topografi', preview: esriTile(esriTopography, katonganPreview)}
};
const rwhToolTitles = {basemap: 'Peta dasar', layers: 'Layer & legenda', measure: 'Alat ukur'};
const rwhMeasurement = {points: [], finished: false};
const roadTypes = {
  walk: {label: 'Jalan pejalan kaki', data: 'walkRoads', style: {color: '#227bb4', weight: 3, opacity: 0.9, dashArray: '8 7', lineCap: 'butt'}},
  drive: {label: 'Jalan kendaraan', data: 'driveRoads', style: {color: '#8549b7', weight: 2, opacity: 0.95}}
};
const roadNetworkCredit = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (jaringan jalan)';

function roadLineSymbol(style) {
  return `<svg class="road-legend-line" viewBox="0 0 26 10" aria-hidden="true" focusable="false">
    <path d="M1 5h24" stroke="${style.color}" stroke-width="${style.weight}" stroke-dasharray="${style.dashArray ?? 'none'}"
      stroke-linecap="${style.lineCap ?? 'butt'}"/>
  </svg>`;
}

function syncRoadLayers() {
  const regionSelected = hasSelectedKalurahan();
  const hint = $('#rwh-road-region-hint');
  if (hint) hint.hidden = regionSelected;
  st.roadLayers ??= {};
  for (const [type, {data, style}] of Object.entries(roadTypes)) {
    if (st.tab === 'rwh' && regionSelected && st.showRoads && st.roadTypes[type] && st[data]?.features.length) {
      st.roadLayers[type] ??= L.geoJSON(st[data], {
        pane: 'road-network', interactive: false, attribution: roadNetworkCredit, style
      });
      st.roadLayers[type].addTo(st.map).bringToFront();
    } else {
      st.roadLayers[type]?.remove();
    }
  }
}

function makeRwhBasemap(key) {
  const tiles = (name, attribution, maxNativeZoom = 19, pane = 'tilePane') => L.tileLayer(
    esriTile(name, '{z}/{y}/{x}'), {attribution, maxNativeZoom, maxZoom: 19, pane}
  );
  if (key === 'gray') {
    return L.layerGroup([
      tiles(esriGray, esriReferenceCredit, 16),
      tiles('Canvas/World_Light_Gray_Reference', '', 16, 'basemap-labels')
    ]);
  }
  if (key === 'esriStreets') return tiles(esriStreets, esriStreetCredit, 16);
  if (key === 'topo') return tiles(esriTopography, esriTopographyCredit, 16);
  const imagery = tiles(esriImagery, esriImageryCredit, 18);
  if (key === 'satellite') return imagery;
  return L.layerGroup([
    imagery,
    tiles(esriRoads, esriReferenceCredit, 17, 'basemap-labels'),
    tiles(esriLabels, '', 16, 'basemap-labels')
  ]);
}

function syncRwhBasemap() {
  const key = st.tab === 'rwh' ? st.rwhBasemap ?? defaultBasemap : defaultBasemap;
  if (st.activeBasemap === key) return;
  const layers = st.basemaps;
  layers[key] ??= makeRwhBasemap(key);
  layers[st.activeBasemap]?.remove();
  layers[key].addTo(st.map);
  st.activeBasemap = key;
}

function syncRwhLayers() {
  if (st.showRwhBuildings === false) st.buildingLayer.remove();
  else st.buildingLayer.addTo(st.map);
  syncRainfallLayer();
  syncKalurahanBoundary();
}

const regionLevels = [
  ['provinsi', 'Provinsi'],
  ['kabupaten', 'Kabupaten/Kota'],
  ['kapanewon', 'Kecamatan/Kapanewon'],
  ['kalurahan', 'Desa/Kalurahan']
];

function hasSelectedKalurahan() {
  return st.selectedRegionLevels === regionLevels.length;
}

function syncKalurahanBoundary() {
  if (st.showAdministrativeBoundary && hasSelectedKalurahan()) st.outline.addTo(st.map);
  else st.outline.remove();
}

function syncRegionFields() {
  const fields = $('#rwh-region-fields');
  fields.hidden = !st.showAdministrativeBoundary;
  fields.querySelectorAll('select').forEach((select, index) => {
    select.disabled = !st.showAdministrativeBoundary || index > st.selectedRegionLevels;
    select.value = index < st.selectedRegionLevels ? select.options[1].value : '';
  });
}

async function loadRainfallLayer() {
  if (st.rainfallLoading || st.rainfallLayer) return;
  st.rainfallLoading = true;
  st.rainfallError = false;
  updateRainfallStatus();
  try {
    const data = await getJSON('data/rainfall_chirps.geojson');
    const values = data.features.map(({properties}) => properties.rain_mm_annual);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) throw Error('Rentang curah hujan tidak valid.');

    const light = [187, 222, 250];
    const dark = [24, 80, 148];
    const colorAt = fraction => `rgb(${light.map((value, index) =>
      Math.round(value + fraction * (dark[index] - value))).join(',')})`;
    st.rainfallLayer = L.geoJSON(data, {
      style: ({properties}) => ({
        color: '#255c85', weight: 1, fillOpacity: 0.74,
        fillColor: colorAt((properties.rain_mm_annual - min) / (max - min))
      }),
      onEachFeature: ({properties}, layer) => layer.on('click', event => {
        if (st.rwhMapTool === 'measure') return;
        closeRwhBuilding();
        st.rainfallPopup ??= L.popup({
          maxWidth: 200, autoPanPaddingTopLeft: [12, 16], autoPanPaddingBottomRight: [76, 18]
        });
        st.rainfallPopup
          .setLatLng(event.latlng)
          .setContent(`<strong>Curah hujan rata-rata tahunan</strong><br>
            ${fmt(properties.rain_mm_annual, 1)} mm/tahun<br>
            CHIRPS v3 · 1996–2025<br>Estimasi untuk piksel 0,05°.`)
          .openOn(st.map);
      })
    });
    $('.rainfall-gradient').style.backgroundImage = `linear-gradient(90deg, ${colorAt(0)}, ${colorAt(1)})`;
    $('#rainfall-legend-values').innerHTML = `<span>${fmt(min, 1)}</span><span>${fmt(max, 1)}</span>`;
    if (st.tab === 'rwh') {
      syncRainfallLayer();
      updateLegend();
    }
  } catch (error) {
    st.rainfallError = true;
    console.error('Gagal memuat layer curah hujan.', error);
  } finally {
    st.rainfallLoading = false;
    updateRainfallStatus();
  }
}

function syncRainfallLayer() {
  const visible = st.tab === 'rwh' && st.showRainfall && Boolean(st.rainfallLayer);
  if (visible && !st.map.hasLayer(st.rainfallLayer)) st.rainfallLayer.addTo(st.map).bringToBack();
  if (!visible) {
    st.rainfallLayer?.remove();
    st.rainfallPopup?.remove();
  }
  $('#rainfall-legend').hidden = !visible;
}

function updateRainfallStatus() {
  const status = $('#rwh-rainfall-status');
  if (!status) return;
  status.textContent = st.showRainfall && st.rainfallLoading ? 'Memuat layer curah hujan…'
    : st.showRainfall && st.rainfallError ? 'Layer curah hujan belum bisa dimuat.' : '';
  $('#retry-rainfall-layer').hidden = !(st.showRainfall && st.rainfallError);
}

function closeRwhMapTool(restoreFocus = false) {
  const active = st.rwhMapTool;
  if (!active) return;
  const button = $(`[data-map-tool="${active}"]`);
  button.setAttribute('aria-expanded', 'false');
  $('#rwh-tool-panel').hidden = true;
  st.rwhMapTool = null;
  if (active === 'measure') {
    rwhMeasurement.points = [];
    rwhMeasurement.finished = false;
    rwhMeasurement.layer?.remove();
    st.map.getContainer().classList.remove('rwh-measuring');
  }
  if (restoreFocus) button.focus({preventScroll: true});
}

function openRwhMapTool(key) {
  const alreadyOpen = st.rwhMapTool === key;
  closeRwhMapTool(alreadyOpen);
  if (alreadyOpen) return;
  cancelRwhLocationRequest();
  closeRwhBuilding();
  st.rwhMapTool = key;
  $(`[data-map-tool="${key}"]`).setAttribute('aria-expanded', 'true');
  const title = $('#rwh-tool-title');
  title.textContent = rwhToolTitles[key];
  const content = $('#rwh-tool-content');
  if (key === 'basemap') {
    content.innerHTML = `<div class="rwh-basemap-group" role="radiogroup" aria-label="Pilihan peta dasar Esri">
      <h3>Esri</h3>
      <div class="rwh-basemap-grid">
      ${Object.entries(rwhBasemaps).map(([id, {label, preview}]) => `
        <label class="rwh-basemap-card">
          <span class="rwh-basemap-preview">
            <img src="${preview}" alt="" width="256" height="256">
            ${id === 'hybrid' ? `<img class="rwh-basemap-reference" src="${esriTile(esriRoads, katonganPreview)}" alt="" width="256" height="256">` : ''}
            <small class="rwh-basemap-credit" aria-hidden="true">© Esri</small>
          </span>
          <span class="rwh-basemap-caption"><input type="radio" name="rwh-basemap" value="${id}"
            ${(st.rwhBasemap ?? defaultBasemap) === id ? 'checked' : ''}>
            <span>${label}</span>
          </span>
        </label>`).join('')}</div></div>`;
    content.onchange = event => {
      st.rwhBasemap = event.target.value;
      syncRwhBasemap();
    };
  } else if (key === 'layers') {
    const region = st.boundary.features[0].properties;
    const roadsAvailable = Object.values(roadTypes).some(({data}) => st[data]?.features.length);
    content.innerHTML = `<label class="checkline"><input type="checkbox" name="showRwhBuildings" aria-controls="rwh-potential-filter"
      ${st.showRwhBuildings === false ? '' : 'checked'}> Potensi air hujan per bangunan</label>
      <div class="control rwh-potential-filter" id="rwh-potential-filter" ${st.showRwhBuildings === false ? 'hidden' : ''}>
        <label class="ctrl-label" for="rwh-potential-range">Rentang potensi tampungan</label>
        <select id="rwh-potential-range" name="buildingPotentialRange">
          <option value="">Semua rentang</option>
          ${buildingPotentialRanges.map(({min, label}) => `<option value="${min}" ${String(min) === st.buildingPotentialRange ? 'selected' : ''}>${esc(label)} m³/tahun</option>`).join('')}
        </select>
        <p id="rwh-potential-count" role="status"></p>
        <label class="ctrl-label" for="rwh-runoff">Koefisien limpasan (RC)</label>
        <select id="rwh-runoff" name="runoffCoefficient">
          ${runoffCoefficients.map(rc => `<option value="${rc}" ${rc === st.rc ? 'selected' : ''}>${fmt(rc, 2)}</option>`).join('')}
        </select>
      </div>
      <label class="checkline"><input type="checkbox" name="showRainfall"
      ${st.showRainfall ? 'checked' : ''}> Curah hujan rata-rata tahunan</label>
      <p id="rwh-rainfall-status" role="status"></p>
      <button class="section-link" id="retry-rainfall-layer" type="button" hidden>Muat ulang curah hujan</button>
      <label class="checkline"><input type="checkbox" name="showAidLocations"
      ${st.showAidLocations ? 'checked' : ''}> Lokasi bantuan air</label>
      <a class="section-link" id="rwh-aid-details" href="#dashboard-distribution-title" ${st.showAidLocations ? '' : 'hidden'}>Lihat rincian bantuan air</a>
      <label class="checkline"><input type="checkbox" name="showDistributionCoverage" aria-controls="rwh-coverage-fields"
        ${st.showDistributionCoverage ? 'checked' : ''}> Zona cakupan distribusi air</label>
      <div class="control rwh-coverage-fields" id="rwh-coverage-fields" ${st.showDistributionCoverage ? '' : 'hidden'}>
        <small>Garis lurus · radius ${euclideanRadius} m dari calon titik penyaluran.</small>
        <p id="rwh-coverage-summary" role="status"></p>
      </div>
      <label class="checkline"><input type="checkbox" name="showRoads" aria-controls="rwh-road-fields"
        ${st.showRoads ? 'checked' : ''} ${roadsAvailable ? '' : 'disabled aria-describedby="rwh-road-status"'}> Jalan</label>
      ${roadsAvailable ? '' : '<p class="rwh-road-status" id="rwh-road-status">Data jaringan jalan belum tersedia.</p>'}
      <fieldset id="rwh-road-fields" class="rwh-road-fields" aria-label="Pilihan jalan" ${st.showRoads ? '' : 'hidden'}>
        ${Object.entries(roadTypes).map(([type, {label, data, style}]) => `<label class="checkline">
          <input type="checkbox" data-road-type="${type}" ${st.roadTypes[type] ? 'checked' : ''}
            ${st[data]?.features.length ? '' : 'disabled'}>
          ${roadLineSymbol(style)}<span>${label}</span>
        </label>`).join('')}
        <small id="rwh-road-region-hint" role="status" ${hasSelectedKalurahan() ? 'hidden' : ''}>Pilih desa atau kalurahan di Batas administrasi untuk melihat jalan.</small>
      </fieldset>
      <label class="checkline"><input type="checkbox" name="showAdministrativeBoundary" aria-controls="rwh-region-fields"
        ${st.showAdministrativeBoundary ? 'checked' : ''}> Batas administrasi</label>
      <fieldset id="rwh-region-fields" class="rwh-area-filter" hidden>
        <legend>Pilih wilayah</legend>
        <p>Data batas tersedia untuk Kalurahan Katongan.</p>
        ${regionLevels.map(([key, label], index) => `<div class="control">
          <label class="ctrl-label" for="rwh-region-${key}">${label}</label>
          <select id="rwh-region-${key}" data-region-level="${index}">
            <option value="">Pilih ${label.toLowerCase()}</option>
            <option value="${esc(region[key])}">${esc(region[key])}</option>
          </select>
        </div>`).join('')}
      </fieldset>
      <h3 class="rwh-tool-legend-title">Legenda layer aktif</h3>
      <div class="map-legend" id="rwh-tool-legend"></div>`;
    $('#retry-rainfall-layer').onclick = () => {
      $('[name="showRainfall"]').focus();
      loadRainfallLayer();
    };
    updateRainfallStatus();
    syncRegionFields();
    syncBuildingFeatures();
    const aidDetails = $('#rwh-aid-details');
    aidDetails.onclick = event => {
      event.preventDefault();
      closeRwhMapTool();
      openDashboardDistribution();
    };
    content.onchange = event => {
      const {name, value, checked, dataset} = event.target;
      if (name === 'runoffCoefficient') {
        st.rc = Number(value);
        render();
        return;
      }
      if (name === 'showDistributionCoverage') {
        st.showDistributionCoverage = checked;
        $('#rwh-coverage-fields').hidden = !checked;
        refreshDistribution();
        return;
      }
      if (name === 'showRoads' || dataset.roadType) {
        if (name === 'showRoads') {
          st.showRoads = checked;
          $('#rwh-road-fields').hidden = !checked;
        } else {
          st.roadTypes[dataset.roadType] = checked;
        }
        syncRoadLayers();
        updateLegend();
        return;
      }
      if (name === 'buildingPotentialRange') {
        st.buildingPotentialRange = value;
        syncBuildingFeatures();
        updateLegend();
        return;
      }
      if (dataset.regionLevel !== undefined || name === 'showAdministrativeBoundary') {
        if (name === 'showAdministrativeBoundary') st.showAdministrativeBoundary = checked;
        else st.selectedRegionLevels = Number(dataset.regionLevel) + (value ? 1 : 0);
        syncRegionFields();
        syncKalurahanBoundary();
        syncRoadLayers();
        if (st.map.hasLayer(st.outline)) fitKatongan();
        updateLegend();
        return;
      }
      st[name] = checked;
      if (name === 'showRainfall') {
        if (checked) loadRainfallLayer();
        syncRainfallLayer();
        updateLegend();
        updateRainfallStatus();
        return;
      }
      if (name === 'showAidLocations') {
        aidDetails.hidden = !checked;
        refreshDistribution();
        if (checked) {
          loadHistoricAid();
          if (st.distributionPlanning && st.networkSummary) loadDistributionUpdate();
        }
        return;
      }
      if (st.showRwhBuildings === false && st.selectedBuilding) closeRwhBuilding();
      $('#rwh-potential-filter').hidden = st.showRwhBuildings === false;
      syncRwhLayers();
      updateLegend();
    };
    updateLegend();
  } else {
    content.onchange = null;
    openRwhMeasurement(content);
  }
  $('#rwh-tool-panel').hidden = false;
  title.focus({preventScroll: true});
}

function updateCoverageSummary() {
  const element = $('#rwh-coverage-summary');
  if (!element || !st.showDistributionCoverage) return;
  const total = st.summary.N_detected_building_footprints;
  const covered = st.phase === 11 ? st.summary.buildings_covered_500m : st.summary.phase2_covered_500m;
  element.textContent = `${fmt(covered)} dari ${fmt(total)} bangunan tercakup (${fmt(covered / total * 100, 2)}%).`;
}

function openRwhMeasurement(content) {
  content.innerHTML = `<label class="ctrl-label" for="rwh-measure-mode">Jenis pengukuran</label>
    <select id="rwh-measure-mode"><option value="distance">Jarak</option><option value="area">Luas</option></select>
    <p id="rwh-measure-hint"></p>
    <output id="rwh-measure-result" aria-live="polite"></output>
    <div class="rwh-measure-actions">
      <button type="button" class="section-link" id="rwh-measure-undo">Urungkan titik</button>
      <button type="button" class="section-link" id="rwh-measure-clear">Hapus</button>
      <button type="button" class="primary" id="rwh-measure-finish">Selesai</button>
    </div>`;
  rwhMeasurement.layer ??= L.layerGroup();
  rwhMeasurement.layer.addTo(st.map);
  const clear = () => {
    rwhMeasurement.points = [];
    rwhMeasurement.finished = false;
    updateRwhMeasurement();
  };
  $('#rwh-measure-mode').onchange = clear;
  $('#rwh-measure-clear').onclick = clear;
  $('#rwh-measure-undo').onclick = () => {
    rwhMeasurement.points.pop();
    rwhMeasurement.finished = false;
    updateRwhMeasurement();
  };
  $('#rwh-measure-finish').onclick = () => {
    rwhMeasurement.finished = true;
    updateRwhMeasurement();
    $('#rwh-measure-clear').focus({preventScroll: true});
  };
  clear();
}

function measureRwhArea(points) {
  // Spherical area from the sum along the polygon edges, using Leaflet's Earth radius.
  const radians = Math.PI / 180;
  let sum = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    sum += (next.lng - point.lng) * radians *
      (2 + Math.sin(point.lat * radians) + Math.sin(next.lat * radians));
  });
  return Math.abs(sum) * L.CRS.Earth.R ** 2 / 2;
}

function updateRwhMeasurement() {
  const {points, layer, finished} = rwhMeasurement;
  const area = $('#rwh-measure-mode').value === 'area';
  const enough = points.length >= (area ? 3 : 2);
  st.map.getContainer().classList.toggle('rwh-measuring', !finished);
  $('#rwh-measure-hint').textContent = area
    ? 'Ketuk minimal tiga sudut area di peta.'
    : 'Ketuk minimal dua titik di peta.';
  $('#rwh-measure-undo').disabled = points.length === 0;
  $('#rwh-measure-clear').disabled = points.length === 0;
  $('#rwh-measure-finish').disabled = !enough || finished;
  layer.clearLayers();
  const style = {color: '#126a98', weight: 3, fillOpacity: .18, interactive: false};
  if (points.length >= 2) {
    (area && enough ? L.polygon(points, style) : L.polyline(points, style)).addTo(layer);
  }
  points.forEach(point => L.circleMarker(point, {...style, radius: 4, fillOpacity: 1}).addTo(layer));
  const result = $('#rwh-measure-result');
  if (!enough) {
    result.textContent = '';
    return;
  }
  const length = points.slice(1).reduce((total, point, index) => total + st.map.distance(points[index], point), 0);
  const value = area ? fmt(measureRwhArea(points), 2) + ' m²'
    : length < 1000 ? fmt(length, 1) + ' m' : fmt(length / 1000, 2) + ' km';
  result.textContent = `${area ? 'Perkiraan luas' : 'Perkiraan jarak'} ${value}`;
}

function bindRwhMapTools() {
  document.querySelectorAll('[data-map-tool]').forEach(button => {
    button.onclick = () => openRwhMapTool(button.dataset.mapTool);
  });
  $('#rwh-close-tool').onclick = () => closeRwhMapTool(true);
  $('#rwh-zoom-in').onclick = () => st.map.zoomIn(1, {animate: false});
  $('#rwh-zoom-out').onclick = () => st.map.zoomOut(1, {animate: false});
}
