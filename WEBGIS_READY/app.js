/* AGC 2027 Katongan — science-first static WebGIS. No fabricated field observations. */
'use strict';
const $=s=>document.querySelector(s);
const fmt=(n,d=0)=>Number(n).toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const st = {
  tab: 'home', rc: 0.8, phase: 11, siteMethod: 'euclidean', showAidLocations: false,
  showRwhBuildings: true, showRainfall: false,
  showAdministrativeBoundary: true, selectedRegionLevels: 4,
  buildingPotentialRange: '',
  showRoads: true, roadTypes: {walk: true, drive: true},
  showDistributionCoverage: false,
  networkLayers: {sites: true, uncovered: true, zones: false, mdmc: true},
  assignmentSite: '', map: null
};
const paths = {
  boundary: 'data/boundary.geojson', buildings: 'data/buildings.geojson',
  sites11: 'data/sites11.geojson', extras: 'data/sitesextra.geojson', circles: 'data/circles11.geojson',
  summary: 'data/distribution_summary.json',
  annual: 'data/annual.csv', monthly: 'data/monthly_spi.csv', daily: 'data/daily.csv',
  cdd: 'data/cdd.csv', demandScenarios: 'data/demand_scenarios.csv',
  rwhAudit: 'data/rwh_visual_audit.csv', yasBenchmarks: 'data/yas_benchmarks.csv',
  sanitaryChecklist: 'data/sanitary_checklist.csv', treatments: 'data/treatments.csv'
};
const networkPaths = {
  networkSummary: 'data/network_summary.json', networkSites: 'data/network_sites.geojson',
  walkRoads: 'data/katongan_roads_walk.geojson', driveRoads: 'data/katongan_roads_drive.geojson',
  networkAssignments: 'data/network_assignments.geojson', coverageCurve: 'data/network_coverage_curve.csv'
};
async function getJSON(url){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);return r.json()}
async function getCSV(url){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);const text=await r.text();const rows=[];let row=[],value='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){value+='"';i++}else quote=!quote}else if(c===','&&!quote){row.push(value);value=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);value='';if(row.some(s=>s!==''))rows.push(row);row=[]}else{value+=c}}if(value||row.length){row.push(value);rows.push(row)}const names=rows.shift()||[];return rows.map(r=>Object.fromEntries(names.map((k,i)=>[k,r[i]??''])))}
const controls=$('#controls'),metrics=$('#metrics'),details=$('#details');
const distributionControls = $('#distribution-controls');
const distributionMetrics = $('#distribution-metrics');
const distributionDetails = $('#distribution-details');
const runoffCoefficients = [0.7, 0.8, 0.84, 0.9];
function card(label,value,sub){return `<article class="metric"><div class="label">${esc(label)}</div><div class="number">${esc(value)}</div><div class="sub">${esc(sub)}</div></article>`}
function panel(title,body,wide=false){return `<article class="panel ${wide?'wide':''}"><h3>${esc(title)}</h3>${body}</article>`}
function mini(k,v){return `<div class="mini-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`}
function metricM3(f){return Number(f.properties['rwh_rc'+Math.round(st.rc*100)+'_m3yr'])||0}
const buildingPotentialRanges = [
  {min: 0, max: 30, label: '<30', color: '#d0a3e8'},
  {min: 30, max: 80, label: '30–<80', color: '#b374d5'},
  {min: 80, max: 150, label: '80–<150', color: '#9145bc'},
  {min: 150, max: 300, label: '150–<300', color: '#6b2399'},
  {min: 300, max: Infinity, label: '≥300', color: '#400e65'}
];
function buildingColor(volume) {
  return (buildingPotentialRanges.find(range => volume < range.max) ?? buildingPotentialRanges.at(-1)).color;
}

function activeBuildingRange() {
  return buildingPotentialRanges.find(range => String(range.min) === st.buildingPotentialRange);
}

function syncBuildingFeatures() {
  const range = activeBuildingRange();
  const filterKey = range ? `${range.min}:${st.rc}` : '';
  if (st.buildingFilterKey !== filterKey) {
    const selected = st.selectedBuilding?.feature;
    const features = range ? st.buildings.features.filter(feature => {
      const volume = metricM3(feature);
      return volume >= range.min && volume < range.max;
    }) : st.buildings.features;
    if (selected && !features.includes(selected)) closeRwhBuilding();
    st.buildingLayer.clearLayers().addData(features);
    if (st.selectedBuilding) {
      st.selectedBuilding = st.buildingLayer.getLayers().find(layer => layer.feature === selected);
    }
    st.buildingFilterKey = filterKey;
  }
  const count = $('#rwh-potential-count');
  if (count) {
    if (range || st.rc !== 0.8) {
      const layers = st.buildingLayer.getLayers();
      const total = layers.reduce((sum, {feature}) => sum + metricM3(feature), 0);
      count.textContent = range
        ? `${fmt(layers.length)} bangunan dalam rentang ini · ${fmt(total)} m³/tahun`
        : `Potensi pada RC aktif · ${fmt(total)} m³/tahun`;
    } else count.textContent = '';
  }
}
function ensureMap() {
  if (st.map || typeof L === 'undefined') return;
  st.map = L.map('map', {zoomControl: false, preferCanvas: true, maxZoom: 19}).setView([-7.87, 110.65], 13);
  st.map.attributionControl.setPrefix(false);
  $('#map-credits').append(st.map.attributionControl.getContainer());
  st.zoomControl = L.control.zoom({position: 'bottomright'});
  const labels = st.map.createPane('basemap-labels');
  labels.style.zIndex = 250;
  labels.style.pointerEvents = 'none';
  const roads = st.map.createPane('road-network');
  roads.style.zIndex = 405;
  roads.style.pointerEvents = 'none';
  const boundary = st.map.createPane('administrative-boundary');
  boundary.style.zIndex = 390;
  boundary.style.pointerEvents = 'none';
  st.map.createPane('rainfall').style.zIndex = 380;
  st.basemaps = {};
  st.map.on('click', event => {
    if (st.rwhMapTool !== 'measure' || rwhMeasurement.finished) return;
    rwhMeasurement.points.push(event.latlng);
    updateRwhMeasurement();
  });
}
function clearDistributionLayers() {
  for (const key of ['siteLayer', 'circlesLayer', 'extraLayer',
    'assignmentLayer', 'uncoveredLayer', 'zoneLayer', 'mdmcLayer']) {
    st[key]?.remove();
    st[key] = null;
  }
}
function fitKatongan() {
  st.map.fitBounds(st.outline.getBounds(), {padding: [20, 20], animate: false});
}
const boundaryColor = '#a46c0b';
function boundaryLayer() {
  if (st.outline) return;
  st.outline = L.geoJSON(st.boundary, {
    pane: 'administrative-boundary',
    interactive: false,
    style: {color: boundaryColor, weight: 2, fillColor: boundaryColor, fillOpacity: 0.24}
  });
  fitKatongan();
}
function updateMap(){
  ensureMap();
  if(!st.map){$('#map-warning').hidden=false;return}
  const harvestingMap = st.tab === 'rwh';
  const mapLayoutChanged = st.lastHarvestingMap !== harvestingMap;
  if (mapLayoutChanged) {
    if (harvestingMap) st.zoomControl.remove();
    else st.zoomControl.addTo(st.map);
    st.lastHarvestingMap = harvestingMap;
  }
  syncRwhBasemap();
  st.map.invalidateSize({animate: false});
  if (mapLayoutChanged && st.outline) fitKatongan();
  else boundaryLayer();
  document.querySelectorAll('.rwh-map-actions button').forEach(button => { button.disabled = false; });
  if(st.tab==='rwh'){
    if (!st.buildingLayer) {
      st.buildingLayer = L.geoJSON(null, {
        attribution: 'Open Buildings (Google Research)',
        style: rwhBuildingStyle,
        onEachFeature: (feature, layer) => layer.on('click', event => {
          if (st.rwhMapTool !== 'measure') selectRwhBuilding(layer, event.latlng);
        })
      });
    }
    syncBuildingFeatures();
    st.buildingLayer.setStyle(rwhBuildingStyle);
    syncRwhLayers();
    if (st.selectedBuilding || st.quickTank) showRwhPanel();
    st.rwhLocationMarker?.addTo(st.map);
  } else {
    st.buildingLayer?.remove();
    st.outline.addTo(st.map);
  }
  syncRoadLayers();
  updateDistributionMap();
  updateLegend();
  requestAnimationFrame(() => st.map.invalidateSize());
}

function updateDistributionMap() {
  clearDistributionLayers();
  if (st.tab !== 'rwh') return;
  const planning = st.distributionPlanning && (st.showAidLocations || st.showDistributionCoverage);
  const network = st.siteMethod === 'network';
  if (st.showDistributionCoverage || (planning && !network)) drawEuclideanMap();
  else if (planning) drawNetworkMap();
  if (st.showAidLocations && (!planning || !network || st.networkLayers.mdmc)) drawHistoricAidMap();
}

function chooseTab(key) {
  guidedTour.close(false);
  if (key === 'dashboard') key = 'rwh';
  if (st.tab === 'rwh' && key !== 'rwh') {
    closeRwhMapTool();
    closeRwhBuilding();
    cancelRwhLocationRequest();
    st.rwhLocationMarker?.remove();
    Object.values(st.roadLayers ?? {}).forEach(layer => layer.remove());
    st.rainfallPopup?.remove();
    st.rainfallLayer?.remove();
  }
  if (st.tab === 'tank' && key !== 'tank') st.tankMapReturn = null;
  st.tab = key;
  const dashboard = key === 'rwh' || key === 'tank';
  document.querySelectorAll('button[data-tab]').forEach(button => {
    const tab = button.dataset.tab;
    const current = tab === key || (tab === 'dashboard' && dashboard);
    button.classList.toggle('active', current);
    if (current) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  render();
  if (key === 'home') {
    window.scrollTo(0, 0);
    $('#home-title').focus({preventScroll: true});
  }
  if (key === 'rwh' && st.showAidLocations) {
    loadHistoricAid();
    if (st.distributionPlanning && st.networkSummary) loadDistributionUpdate();
  }
}
function rwh() {
  controls.replaceChildren();
  metrics.replaceChildren();
  details.innerHTML = panel('Sumber dan cara hitung',
    mini('Curah hujan', 'CHIRPS v3, rata-rata tahunan 1996–2025 pada piksel centroid') +
    mini('Total luas footprint', fmt(st.totalFootprint) + ' m²') +
    mini('Rumus', 'P(mm) × A(m²) × RC / 1000')) +
    panel('Batas penggunaan', '<p>Tangkapan teoritis dihitung dari footprint Google Open Buildings. Volume yang bisa digunakan bergantung pada kehilangan, kapasitas tandon, kebutuhan, dan kualitas air.</p>') +
    rwhAuditPanel();
}

function siteMethodControl(network) {
  return `<div class="control"><label class="ctrl-label" for="site-method">Metode lokasi</label>
    <select id="site-method"><option value="euclidean" ${network ? '' : 'selected'}>Awal · jarak garis lurus</option>
    ${st.networkSummary ? `<option value="network" ${network ? 'selected' : ''}>Jaringan OSM</option>` : ''}</select></div>`;
}

function setDistributionMethod(method) {
  st.siteMethod = method;
  refreshDistribution();
  if (method === 'network' && st.distributionPlanning) loadDistributionUpdate();
}

function renderDistribution() {
  $('#dashboard-distribution').hidden = st.tab !== 'rwh' ||
    !(st.showAidLocations || (st.showDistributionCoverage && st.distributionPlanning));
  if ($('#dashboard-distribution').hidden) return;
  const planning = st.distributionPlanning;
  $('#dashboard-distribution-title').textContent = planning ? 'Simulasi cakupan distribusi' : 'Lokasi Bantuan Air';
  $('#dashboard-aid-contact').hidden = planning && !st.showAidLocations;
  $('#distribution-actions').innerHTML = planning && !st.showAidLocations ? '' : planning
    ? '<button class="section-link" id="toggle-planning">Kembali ke informasi bantuan</button>'
    : '<a class="primary" href="https://desakatongan.gunungkidulkab.go.id/first" target="_blank" rel="noopener noreferrer">Buka situs Kalurahan Katongan</a><button class="section-link" id="toggle-planning">Lihat usulan lokasi bantuan</button>';
  const planningToggle = $('#toggle-planning');
  if (planningToggle) planningToggle.onclick = () => {
    st.distributionPlanning = !st.distributionPlanning;
    refreshDistribution();
    if (st.distributionPlanning && st.networkSummary) loadDistributionUpdate();
    $('#toggle-planning').focus({preventScroll: true});
  };
  if (!st.distributionPlanning) {
    residentDistribution();
    return;
  }
  if (st.siteMethod === 'network') {
    networkDistribution();
    return;
  }
  const sum = st.summary;
  const main = st.phase === 11;
  const covered = main ? sum.buildings_covered_500m : sum.phase2_covered_500m;
  const pct = main ? sum.coverage_500m_pct : sum.phase2_coverage_500m_pct;
  const total = sum.N_detected_building_footprints;
  distributionMetrics.innerHTML =
    card('Pusat hipotetis', fmt(st.phase), 'Pembanding historis') +
    card('Cakupan garis lurus 500 m', fmt(pct, 2) + '%', 'Radius garis lurus') +
    card('Proksi tercakup', fmt(covered), 'Dari ' + fmt(total) + ' proksi bangunan') +
    card('Proksi belum tercakup', fmt(total - covered), 'Di luar radius garis lurus');
  distributionControls.innerHTML = siteMethodControl(false) +
    `<div class="control"><span class="ctrl-label">Skenario lokasi</span><div class="choices phase-choices">
      ${[[11, '11 utama'], [14, '11 + 3']].map(([phase, label]) => `<button
        class="choice ${phase === st.phase ? 'active' : ''}" data-phase="${phase}"
        aria-pressed="${phase === st.phase}">${label}</button>`).join('')}</div></div>`;
  $('#site-method').onchange = event => setDistributionMethod(event.target.value);
  distributionControls.querySelectorAll('[data-phase]').forEach(button => {
    button.onclick = () => { st.phase = Number(button.dataset.phase); refreshDistribution(); };
  });
  distributionDetails.innerHTML = panel('Pembanding historis',
    '<p>Cakupan dihitung berdasarkan radius garis lurus dari titik pencarian hipotetis. Akses jalan, lahan, dan pasokan masih memerlukan verifikasi.</p>') +
    (st.networkError ? panel('Data jaringan OSM tidak tersedia',
      `<p class="notice">${esc(st.networkError)}</p>`) : '');
}

function refreshDistribution() {
  renderDistribution();
  if (st.tab !== 'rwh' || !st.map) return;
  updateDistributionMap();
  updateLegend();
}

function updateLegend() {
  const dashboard = st.tab === 'rwh';
  const buildings = dashboard && st.showRwhBuildings !== false;
  const items = st.map.hasLayer(st.outline)
    ? [[boundaryColor, dashboard ? 'Batas Kalurahan Katongan' : 'Batas kajian']] : [];
  if (buildings) {
    const active = activeBuildingRange();
    const ranges = active ? [active] : buildingPotentialRanges;
    items.push(...ranges.map(({color, label}) => [color, label + ' m³/tahun']));
  }
  if (dashboard && st.showAidLocations && st.mdmcLayer) items.push([null, 'Lokasi bantuan terdahulu']);
  if (dashboard) {
    for (const [type, {label, style}] of Object.entries(roadTypes)) {
      const layer = st.roadLayers?.[type];
      if (layer && st.map.hasLayer(layer)) items.push([style.color, label, style]);
    }
  }
  if (dashboard && st.siteLayer) {
    items.push(['#245c4d', st.siteMethod === 'network' ? 'Kandidat lokasi' : 'Kandidat utama']);
    if (st.extraLayer) items.push(['#d6a545', 'Kandidat tambahan']);
  }
  if (dashboard && st.circlesLayer) {
    items.push([euclideanCoverageStyle.color, `Lingkaran simulasi · radius ${euclideanRadius} m`, {circle: true}]);
  }
  if (dashboard && st.assignmentLayer) {
    const radius = currentNetworkScenario()?.radius_m ?? st.networkSummary.service_distance_m;
    items.push([networkStyles.assigned, `Bangunan tercakup · jaringan ${fmt(radius)} m (simulasi)`]);
  }
  if (dashboard && st.uncoveredLayer) {
    if (currentNetworkScenario()) items.push([networkStyles.outside, 'Di luar cakupan skenario']);
    else items.push([networkStyles.far, 'Jauh dari node OSM'], [networkStyles.outside, 'Dekat jaringan, belum tercakup']);
  }
  if (dashboard && st.zoneLayer) items.push([networkStyles.zone, 'Zona pencarian 150 m']);
  const legend = items.map(([color, label, style]) => {
    let symbol = `<i style="background:${color}" aria-hidden="true"></i>`;
    if (style?.circle) {
      symbol = `<i class="coverage-legend-circle" style="border-color:${color};background:${euclideanCoverageStyle.fillColor}" aria-hidden="true"></i>`;
    } else if (style) {
      symbol = roadLineSymbol(style);
    } else if (!color) {
      symbol = `<span class="mdmc-legend-icon" aria-hidden="true">${waterTruckIcon}</span>`;
    }
    return `<span>${symbol}${esc(label)}</span>`;
  }).join('');
  $('#map-legend').innerHTML = legend;
  $('.rwh-legend').hidden = items.length === 0;
  $('#map-caption').textContent = [
    buildings ? 'Potensi atap: Google Open Buildings dan CHIRPS.' : '',
    st.mdmcLayer ? 'Catatan historis MDMC ditampilkan pada koordinat perkiraan.' : '',
    dashboard && (st.circlesLayer || st.assignmentLayer || st.uncoveredLayer) ? 'Cakupan distribusi dihitung dari model penelitian.' : '',
    dashboard ? '' : 'Sumber batas: data kajian Katongan.'
  ].filter(Boolean).join(' ');
  $('#map-caption').hidden = !$('#map-caption').textContent;
  updateCoverageSummary();
}
function methods(){const net=st.networkSummary;metrics.innerHTML=card('Kandidat bangunan','3.583','Google Open Buildings v3')+card('Data iklim','30 tahun','CHIRPS 1996–2025')+card('Pusat kandidat jaringan',net?fmt(net.selected_site_count):'—','Semua belum diverifikasi sebagai lahan')+card('Cakupan OSM',net?fmt(net.coverage_network_pct,2)+'%':'—','500m berjalan + konektor');controls.innerHTML=`<div class="control"><span class="ctrl-label">Status kajian</span>${mini('RWH & iklim','Model skenario tersedia')}${mini('Jaringan jalan',net?'OSM diperoleh, hasil siap':'Belum diimpor')}${mini('Lokasi kandidat',net?'30 simpul OSM':'Model lama 11+3')}${mini('Kelayakan fisik','Belum terverifikasi')}${mini('Kualitas minum','Belum ada uji lab')}</div><div class="notice">Target layanan 95% belum tercapai. Pastikan sumber pasokan, jalan lokal yang belum dipetakan, hak lahan, kapasitas bak/truk, dan kebutuhan riil. Tidak ada bukti distribusi RWH ke titik-titik ini.</div>`;details.innerHTML=panel('Metodologi utama',mini('Data spasial','CHIRPS, Open Buildings, batas Katongan, OSM')+mini('Cakupan bangunan',net?'3.145/3.583 pada 500 m jaringan':'Belum ada jaringan')+mini('Batas konektor OSM','125 m, asumsi akses lurus')+mini('Algoritma','Maximal covering greedy + local swap'))+panel('Perbedaan skenario',`<p>Optimasi jaringan jalan untuk <strong>lokasi baru bantuan air eksternal</strong> berbeda dari peta potensi RWH atap.</p><p>11+3 titik lama memakai garis lurus dan tetap tersedia hanya sebagai pembanding metodologis. Lokasi bantuan pemerintah adalah pembanding historis tanpa titik GPS resmi.</p><p>Semua rekomendasi jaringan adalah <strong>simpul OSM untuk pencarian lokasi</strong>, bukan tanah/struktur yang siap dibangun.</p>`) +
  panel('Kredit foto Cek Kondisi Air', `
    <p>Foto tandon oleh <a href="https://commons.wikimedia.org/wiki/File:Water_Tank_with_Erosion_Below_Spigot_(32992438294).jpg">Chris Hunkeler</a> (<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>).</p>
    <p>Foto gayung oleh <a href="https://commons.wikimedia.org/wiki/File:Gayung.jpg">Harditaher</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>). Latar kedua foto dihapus untuk tampilan.</p>
    <p>Foto sampel air dari <a href="https://www.usgs.gov/media/images/aquatic-remote-sensing-image-water-glasses">USGS</a> dan <a href="https://catalog.archives.gov/id/554798">Erik Calonius, EPA/NARA</a> (domain publik).</p>
  `, true);
}

function render() {
  stopQualityStory();
  const home = st.tab === 'home';
  const about = st.tab === 'about';
  $('.masthead').classList.toggle('masthead-home', home || st.tab === 'quality');
  $('#home-view').hidden = !home;
  if (home) homeStory.start();
  else homeStory.stop();
  aboutView.hidden = !about;
  syncTeamPhotoRotation();
  $('#dashboard-map-layout').hidden = st.tab !== 'rwh';
  $('#dashboard-details').hidden = home || about;
  if (home || about) {
    $('.task-intro').hidden = true;
    $('#rwh-rain-background').hidden = true;
    $('#workspace-map-slot').append($('#map-wrap'));
    $('#map-wrap').hidden = true;
    syncRain();
    syncRainLightning();
    return;
  }
  const harvestingMap = st.tab === 'rwh';
  const qualityGuide = st.tab === 'quality';
  const views = {
    rwh: [rwh, 'Berapa air hujan yang bisa saya tampung?',
      'Perbesar peta, lalu ketuk bangunan yang Anda kenali. Dari hasilnya, lanjutkan ke hitung tandon.', 'Perkiraan dari atap di Katongan'],
    tank: [tank, 'Apakah tandon saya cukup?', st.tankMapReturn
      ? 'Lihat hasil simulasi untuk bangunan yang dipilih. Isian dan asumsi dapat disesuaikan di sini.'
      : 'Isi luas atap, jumlah penghuni, dan ukuran tandon. Lalu lihat perkiraan kebutuhan yang terpenuhi.', 'Perkiraan kecukupan tandon'],
    quality: [quality, '', '', ''],
    methods: [methods, 'Metodologi & transparansi', 'Telusuri sumber, asumsi, dan batas model.', 'Kesiapan data dan batas interpretasi']
  };
  const [view, title, description, headline] = views[st.tab];
  $('#tab-intro').innerHTML = `<h1>${title}</h1><p>${description}</p>`;
  $('.task-intro').hidden = harvestingMap || qualityGuide;
  $('#headline').textContent = headline;
  $('#workspace-head').hidden = harvestingMap || qualityGuide;
  const controlsSlot = $(qualityGuide ? '#quality-guide-slot' : '#view-sidebar');
  if (controls.parentElement !== controlsSlot) controlsSlot.append(controls);
  $('#quality-guide-slot').hidden = !qualityGuide;
  $('#map-title').textContent = harvestingMap ? 'Peta Ketahanan Air' : 'Batas kajian Kalurahan Katongan';
  $('#map-key').textContent = harvestingMap ? '' : 'EPSG:4326';
  view();
  renderDistribution();
  const actions = $('#task-actions');
  actions.innerHTML = st.tab === 'tank' && st.tankMapReturn
        ? '<button class="section-link" id="back-to-rwh-map">← Kembali ke peta</button>'
        : '';
  actions.hidden = !actions.innerHTML;
  const backToMap = $('#back-to-rwh-map');
  if (backToMap) backToMap.onclick = returnToRwhMap;
  const showMap = harvestingMap || st.tab === 'methods';
  const map = $('#map-wrap');
  const mapSlot = $(harvestingMap ? '#rwh-map-slot' : '#workspace-map-slot');
  if (map.parentElement !== mapSlot) mapSlot.append(map);
  const legend = $('#map-legend');
  const legendSlot = $(harvestingMap ? '#rwh-legend-slot' : '#map-legend-slot');
  if (legend.parentElement !== legendSlot) legendSlot.append(legend);
  $('#rwh-map-tools').hidden = !harvestingMap;
  $('#view-sidebar').hidden = harvestingMap || qualityGuide;
  $('.layout').classList.toggle('rwh-layout', harvestingMap);
  $('.layout').classList.toggle('quality-layout', qualityGuide);
  $('#rwh-rain-background').hidden = !harvestingMap;
  syncRain();
  syncRainLightning();
  map.hidden = !showMap;
  if (showMap) updateMap();
}

async function loadAssets(files) {
  const entries = Object.entries(files);
  const assets = {};
  // Limit concurrent requests for the local Python HTTP server.
  for (let index = 0; index < entries.length; index += 4) {
    await Promise.all(entries.slice(index, index + 4).map(async ([key, path]) => {
      try {
        assets[key] = await (path.endsWith('.csv') ? getCSV(path) : getJSON(path));
      } catch (error) {
        if (error.message.startsWith(path)) throw error;
        throw Error(`${path}: ${error.message}`);
      }
    }));
  }
  return assets;
}

const rainMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const aboutView = $('#about-view');
const teamPhotoNext = $('#team-photo-next');
let teamPhotoTimer;

function nextTeamPhoto() {
  aboutView.dataset.teamPhoto = Number(aboutView.dataset.teamPhoto) % 3 + 1;
}

function syncTeamPhotoRotation() {
  clearInterval(teamPhotoTimer);
  if (aboutView.hidden) return;
  teamPhotoNext.hidden = !rainMotionPreference.matches;
  if (!rainMotionPreference.matches && !document.hidden) teamPhotoTimer = setInterval(nextTeamPhoto, 5000);
}

let lightningTimer;
let lightningAnimation;
const rainCanvas = $('.rain-background-fall');
const rainContext = rainCanvas.getContext('2d');
const rainGround = $('.rain-ground');
let rainFrame;
let previousRainFrame;
let rainWidth = 0;
let rainHeight = 0;
let rainPixelRatio = 0;
let rainDrops = [];
let rainImpacts = [];

function rainIsRunning() {
  const background = $('#rwh-rain-background');
  return !background.hidden && !rainMotionPreference.matches && !document.hidden;
}

function makeRainDrop(y) {
  return {
    x: Math.random() * rainWidth, y, length: 7 + Math.random() * 12,
    speed: 150 + Math.random() * 150, opacity: 0.19 + Math.random() * 0.2
  };
}

function drawRain(time) {
  const width = rainCanvas.clientWidth;
  const height = rainCanvas.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const groundY = rainGround.getBoundingClientRect().bottom - 22;
  if (width !== rainWidth || height !== rainHeight || pixelRatio !== rainPixelRatio) {
    rainWidth = width;
    rainHeight = height;
    rainPixelRatio = pixelRatio;
    rainCanvas.width = Math.round(width * pixelRatio);
    rainCanvas.height = Math.round(height * pixelRatio);
    rainContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const dropCount = Math.max(14, Math.min(220, Math.round(width * height / 15000)));
    rainDrops = Array.from({length: dropCount},
      () => makeRainDrop(Math.random() * Math.min(height, groundY)));
    rainImpacts = [];
  }
  const elapsed = Math.min((time - (previousRainFrame ?? time)) / 1000, 0.05);
  previousRainFrame = time;
  rainContext.clearRect(0, 0, width, height);
  rainContext.lineCap = 'round';
  rainContext.strokeStyle = '#397b88';
  for (let i = 0; i < rainDrops.length; i++) {
    const drop = rainDrops[i];
    drop.y += drop.speed * elapsed;
    if (drop.y >= groundY) {
      rainImpacts.push({x: drop.x, age: 0});
      rainDrops[i] = makeRainDrop(-20 - Math.random() * 180);
      continue;
    }
    if (drop.y - drop.length > height) {
      rainDrops[i] = makeRainDrop(-20 - Math.random() * 180);
      continue;
    }
    rainContext.globalAlpha = drop.opacity;
    rainContext.lineWidth = 1.1;
    rainContext.beginPath();
    rainContext.moveTo(drop.x, drop.y - drop.length);
    rainContext.lineTo(drop.x, drop.y);
    rainContext.stroke();
  }
  for (const impact of rainImpacts) {
    impact.age += elapsed;
    const progress = impact.age / 0.48;
    if (progress >= 1) continue;
    rainContext.globalAlpha = 0.52 * (1 - progress);
    rainContext.lineWidth = 1.25;
    rainContext.beginPath();
    rainContext.ellipse(impact.x, groundY, 2 + progress * 15, 0.9 + progress * 3, 0, 0, Math.PI * 2);
    rainContext.stroke();
  }
  rainImpacts = rainImpacts.filter(impact => impact.age < 0.48);
  rainFrame = requestAnimationFrame(drawRain);
}

function syncRain() {
  if (rainContext && rainIsRunning()) {
    rainFrame ??= requestAnimationFrame(drawRain);
  } else {
    cancelAnimationFrame(rainFrame);
    rainFrame = undefined;
    previousRainFrame = undefined;
  }
}

function syncRainLightning() {
  const background = $('#rwh-rain-background');
  if (!rainIsRunning()) {
    clearTimeout(lightningTimer);
    lightningTimer = undefined;
    lightningAnimation?.cancel();
    return;
  }
  if (lightningTimer !== undefined) return;

  lightningTimer = setTimeout(() => {
    lightningTimer = undefined;
    const light = background.querySelector('.rain-background-lightning');
    light.style.setProperty('--lightning-x', `${20 + Math.random() * 60}%`);
    lightningAnimation = light.animate([
      {opacity: 0},
      {opacity: 0.85, offset: 0.22},
      {opacity: 0}
    ], {duration: 680, easing: 'ease-out'});
    syncRainLightning();
  }, 8000 + Math.random() * 10000);
}

async function start() {
  const status = $('#load-status');
  if (CSS.supports('selector(select:open)')) {
    document.addEventListener('focusin', event => {
      if (event.target.tagName !== 'OPTION' || event.relatedTarget?.tagName === 'OPTION') return;
      const select = event.target.closest('select:open');
      if (!select || innerHeight - select.getBoundingClientRect().bottom >= 120) return;
      select.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
    });
  }
  rainMotionPreference.addEventListener('change', syncRain);
  document.addEventListener('visibilitychange', syncRain);
  rainMotionPreference.addEventListener('change', syncRainLightning);
  document.addEventListener('visibilitychange', syncRainLightning);
  teamPhotoNext.onclick = nextTeamPhoto;
  rainMotionPreference.addEventListener('change', syncTeamPhotoRotation);
  document.addEventListener('visibilitychange', syncTeamPhotoRotation);
  $('#rwh-locate').onclick = locateRwhUser;
  $('#rwh-open-tank').onclick = openQuickTank;
  bindRwhMapTools();
  bindDashboardSidebar();
  $('#rwh-close').onclick = () => {
    const returnFocus = st.quickTank ? $('#rwh-open-tank') : $('#map');
    closeRwhBuilding();
    returnFocus.focus({preventScroll: true});
  };
  $('.map-stage').addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (CSS.supports('selector(select:open)') && event.target.closest('select:open')) return;
    if (st.rwhMapTool) {
      event.preventDefault();
      closeRwhMapTool(true);
      return;
    }
    if (!$('#rwh-building').hidden) {
      event.preventDefault();
      $('#rwh-close').click();
    }
  });
  const buttons = document.querySelectorAll('button[data-tab]');
  buttons.forEach(button => {
    const key = button.dataset.tab;
    button.disabled = key !== 'home' && key !== 'about';
    button.onclick = () => {
      const destination = key === 'dashboard' ? 'rwh' : key;
      const changed = st.tab !== destination;
      chooseTab(key);
      window.scrollTo(0, 0);
      if (changed && !rainMotionPreference.matches) {
        document.querySelectorAll('#dashboard-map-layout, .task-intro, .layout').forEach(section => {
          section.getAnimations().filter(animation => animation.id === 'feature-entry')
            .forEach(animation => animation.cancel());
          section.animate([{opacity: 0.72}, {opacity: 1}],
            {id: 'feature-entry', duration: 220, easing: 'ease-out'});
        });
      }
    };
  });
  homeStory.start();
  try {
    const core = await loadAssets(paths);
    if (core.buildings.features.length !== 3583 || core.daily.length !== 10958 ||
        !core.annual.length || !core.monthly.length || !core.demandScenarios.length) {
      throw Error('Data inti kosong atau jumlah data berbeda dari Master v6.');
    }
    const network = await loadAssets(networkPaths).catch(error => ({networkError: error.message}));
    Object.assign(st, core, network);
    st.totalFootprint = st.buildings.features.reduce((sum, {properties}) => sum + Number(properties.area_m2), 0);
    st.rwhAuditById = new Map(st.rwhAudit.map(row => [row.id, row]));
    if (st.networkSummary && !st.coverageCurve.length) {
      st.networkSummary = null;
      st.networkError = 'Kurva cakupan OSM kosong.';
    }
    renderDashboardSummary();
    renderRwhClimate();
    render();
    status.hidden = true;
    buttons.forEach(button => { button.disabled = false; });
    guidedTour.enable();
  } catch (error) {
    status.setAttribute('role', 'alert');
    status.textContent = `Gagal memuat WebGIS. Buka melalui RUN_WINDOWS.bat atau server HTTP lokal. ${error.message}`;
    console.error(error);
  }
}
start();
