'use strict';

const networkStyles = {
  assigned: '#168879', far: '#bd5959', outside: '#ad6b15',
  zone: '#9e7116'
};
const waterTruckIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <rect x="2" y="5" width="13" height="9" rx="3"/>
  <path d="M15 8h4l3 4v5h-2M7 17h9M3 14v3h1M15 12h7"/>
  <circle cx="5.5" cy="17.5" r="2"/>
  <circle cx="18" cy="17.5" r="2"/>
</svg>`;
const baselineScenarioId = 'r500_c125_p30';
const distributionFiles = {
  scenarios: 'data/distribution/scenarios_150.json',
  matrix: 'data/distribution/MATRIX_CAKUPAN_3583x150.csv',
  buildings: 'data/distribution/bangunan_status_3583.geojson',
  zones: 'data/distribution/zona_pencarian_150m.geojson',
  mdmcContext: 'data/distribution/MDMC_KONTEKS_BUKAN_GPS.csv',
  checklist: 'data/distribution/CHECKLIST_KELAYAKAN_30_TITIK.csv',
  demand: 'data/distribution/demand_scenarios_9.json',
  loads: 'data/distribution/BEBAN_30_TITIK_9_SKENARIO.csv'
};

async function loadHistoricAid() {
  if (st.historicAidLoading || st.historicAid) return;
  st.historicAidLoading = true;
  st.historicAidError = false;
  try {
    st.historicAid = await getJSON('data/distribution/existing_mdmc_katongan_1.geojson');
  } catch {
    st.historicAidError = true;
  } finally {
    st.historicAidLoading = false;
    if (st.tab === 'rwh' && st.showAidLocations) refreshDistribution();
  }
}

async function loadDistributionUpdate() {
  if (st.distributionLoading || st.distributionUpdate) return;
  st.distributionLoading = true;
  try {
    const update = await loadAssets(distributionFiles);
    update.coverageByBuilding = new Map(update.matrix.map(row => [row.building_id, row]));
    delete update.matrix;
    update.scenariosById = new Map(update.scenarios.map(scenario => [scenario.scenario_id, scenario]));
    const baseline = update.scenariosById.get(baselineScenarioId);
    if (!baseline || (st.networkSummary && baseline.covered_buildings !== st.networkSummary.n_covered_500m_network_plus_access) ||
        update.coverageByBuilding.size !== st.buildings.features.length ||
        update.buildings.features.some(feature => !update.coverageByBuilding.has(feature.properties.building_id)) ||
        !update.demand.length) {
      throw Error('Paket skenario tidak cocok dengan data dasar v6.');
    }
    st.distributionUpdate = update;
    st.distributionError = '';
  } catch (error) {
    st.distributionError = error.message;
  } finally {
    st.distributionLoading = false;
    if (st.tab === 'rwh' && (st.showAidLocations || st.showDistributionCoverage) &&
        st.distributionPlanning && st.siteMethod === 'network') refreshDistribution();
  }
}

const siteCheckFields = [
  ['Pemeriksaan jaringan jalan', 'road_graph_screened'],
  ['Kepemilikan lahan', 'land_ownership'],
  ['Izin atau dokumen lahan', 'land_authority_or_document'],
  ['Lereng atau bahaya', 'slope_or_hazard'],
  ['Ruang manuver truk di tapak', 'on_site_truck_maneuver'],
  ['Kapasitas suplai harian (L)', 'daily_supply_capacity_L'],
  ['Koordinat sumber air', 'source_water_coordinates'],
  ['Uji kualitas air', 'water_quality_test'],
  ['Kelayakan tapak', 'site_viability'],
  ['Catatan tim', 'team_review_notes']
];

function siteCheckValue(value) {
  const labels = {
    YES_OSM_ONLY: 'Ditinjau dari jaringan OSM',
    UNKNOWN: 'Belum diketahui',
    NOT_AVAILABLE: 'Belum tersedia',
    NOT_VERIFIED: 'Belum terverifikasi'
  };
  return labels[value] ?? (value || 'Belum ada catatan');
}

function siteChecklistPanel(rows) {
  if (!rows.length) return '';
  const selected = rows.some(row => row.site_id === st.checklistSiteId) ? st.checklistSiteId : rows[0].site_id;
  return panel('Checklist verifikasi tapak',
    `<p>Status pemeriksaan lapangan untuk ${fmt(rows.length)} kandidat. Pilih titik untuk melihat informasi yang masih perlu dikonfirmasi.</p>
      <div class="control"><label class="ctrl-label" for="checklist-site">Kandidat tapak</label>
        <select id="checklist-site">${rows.map(row => `<option value="${esc(row.site_id)}"
          ${row.site_id === selected ? 'selected' : ''}>${esc(row.site_id)}</option>`).join('')}</select></div>
      <div id="checklist-status" aria-live="polite"></div>`);
}

function mdmcContextPanel(rows) {
  const count = value => value === '' ? '—' : fmt(value);
  return panel('Rekap historis bantuan air',
    '<p>Angka rekap mengikuti wilayah dan kolom pada sumber. Penanda MDMC di Klegung merujuk pada satu kejadian bantuan dengan koordinat perkiraan. Klegung dan Perbutan juga tercatat dalam laporan wilayah BPBD.</p>' +
    dataTable('Rekap historis per wilayah', ['Wilayah', 'Lokasi pada peta', 'Tangki pada peta', 'Tangki pada rekap donor', 'Tanggal sumber'],
      rows.map(row => [row.geography, count(row.locations_detail_map), count(row.tanks_detail_map), count(row.tanks_donor_recap), row.source_as_of])) +
    '<p>Tanda — berarti angka tidak tercantum pada rekap.</p>', true);
}

function currentNetworkScenario() {
  return st.scenarioId && st.scenarioId !== baselineScenarioId
    ? st.distributionUpdate?.scenariosById.get(st.scenarioId)
    : undefined;
}

function currentDistributionDemand() {
  const demand = st.distributionUpdate?.demand;
  return demand?.[st.distributionDemandIndex] ?? demand?.find(row => row.affected_fraction === 0.5 && row.liters_person_day === 15);
}

function bindDistributionPopup(layer, content) {
  layer.bindPopup(content, {
    maxWidth: Math.min(300, st.map.getSize().x - 120),
    autoPanPaddingTopLeft: [14, 16],
    autoPanPaddingBottomRight: [76, 18]
  });
}

function distributionScenarioControls() {
  const update = st.distributionUpdate;
  if (!update) {
    return st.distributionError
      ? `<div class="notice">Data skenario tambahan belum bisa dimuat. ${esc(st.distributionError)}
        <button class="section-link" id="retry-distribution">Coba lagi</button></div>`
      : '<p class="notice" role="status">Memuat skenario distribusi tambahan…</p>';
  }
  const active = currentNetworkScenario() ?? update.scenariosById.get(baselineScenarioId);
  const fields = [
    ['radius_m', 'Jarak layanan', ' m'],
    ['connector_max_m', 'Batas konektor', ' m'],
    ['selected_site_count', 'Jumlah titik kandidat', '']
  ];
  return `<fieldset class="checklist scenario-fields"><legend class="ctrl-label">Skenario jaringan OSM</legend>
    ${fields.map(([key, label, unit]) => {
      const values = Array.from(new Set(update.scenarios.map(row => row[key]))).sort((a, b) => a - b);
      return `<div class="control"><label class="ctrl-label" for="scenario-${key}">${label}</label>
        <select id="scenario-${key}" data-scenario-field="${key}">${values.map(value =>
          `<option value="${value}" ${value === active[key] ? 'selected' : ''}>${fmt(value)}${unit}</option>`
        ).join('')}</select></div>`;
    }).join('')}
    <button type="button" class="section-link" id="reset-distribution" ${active.scenario_id === baselineScenarioId ? 'disabled' : ''}>Kembali ke skenario dasar</button>
  </fieldset>`;
}

const euclideanRadius = 500;
const euclideanCoverageStyle = {color: '#478774', weight: 1.5, fillColor: '#76bc9c', fillOpacity: 0.22};

function drawEuclideanMap() {
  const siteOptions = extra => ({
    pointToLayer: ({properties}, point) => L.marker(point, {
      title: properties.site_id,
      icon: L.divIcon({
        className: '',
        html: `<span class="site-pin${extra ? ' extra' : ''}">${extra ? 'T' : esc(properties.site_id.split('-').pop())}</span>`,
        iconSize: [28, 28], iconAnchor: [14, 14]
      })
    }),
    onEachFeature: ({properties: site}, layer) => bindDistributionPopup(layer,
      extra ? `<b>${esc(site.site_id)}</b><br>Usulan titik sementara, belum diverifikasi.`
        : `<strong>${esc(site.site_id)}</strong><br>Bangunan teralokasi: ${fmt(site.nearest_assigned_buildings)}
          <br>Kebutuhan proksi: ${fmt(site.proxy_demand_L_day_50pct_15Lpcd, 1)} L/hari
          <br><i>Pusat pencarian hipotetis. Akses jalan dan lahan belum diverifikasi.</i>`)
  });
  st.siteLayer = L.geoJSON(st.sites11, siteOptions(false)).addTo(st.map);
  if (st.phase === 14) st.extraLayer = L.geoJSON(st.extras, siteOptions(true)).addTo(st.map);
  if (st.showDistributionCoverage) {
    st.circlesLayer = L.geoJSON(st.circles, {interactive: false, style: euclideanCoverageStyle}).addTo(st.map);
    st.extraLayer?.eachLayer(marker => L.circle(marker.getLatLng(), {
      ...euclideanCoverageStyle, radius: euclideanRadius, interactive: false
    }).addTo(st.circlesLayer));
  }
}

function drawNetworkMap() {
  const layers = st.networkLayers;
  const net = st.networkSummary;
  const update = st.distributionUpdate;
  const scenario = currentNetworkScenario();
  const activeSites = new Set(scenario?.site_ids ?? st.networkSites.features.map(feature => feature.properties.site_id));
  const demand = currentDistributionDemand();
  const renderer = st.networkRenderer ??= L.canvas({padding: 0.3});
  const bySite = feature => !st.assignmentSite || feature.properties.assigned_network_site === st.assignmentSite;
  const pointOptions = covered => ({
    pointToLayer: (feature, point) => L.circleMarker(point, {
      renderer,
      radius: covered ? 3 : 4,
      weight: 0,
      fillColor: covered ? networkStyles.assigned
        : feature.properties.building_walk_road_nearby ? networkStyles.outside : networkStyles.far,
      fillOpacity: covered ? 0.72 : 0.94
    }),
    onEachFeature: (feature, layer) => {
      const data = feature.properties;
      const status = covered ? 'Dalam jangkauan model'
        : data.building_walk_road_nearby ? 'Dekat jaringan, belum tercakup' : 'Jauh dari node jalan OSM';
      const site = data.assigned_network_site === 'UNREACHABLE_OR_UNMAPPED' ? 'Belum teralokasi' : data.assigned_network_site;
      const distance = data.distance_network_plus_access_m;
      bindDistributionPopup(layer, `<b>${status}</b><br>Bangunan ${esc(data.building_id)}
        <br>Kandidat: ${esc(site)}<br>Jarak model: ${distance === null ? 'Tidak tersedia' : fmt(distance, 1) + ' m'}
        <br><i>Jarak jaringan dan konektor masih berupa hasil model.</i>`);
    }
  });
  if (scenario) {
    const drawBuildings = (covered, color) => L.geoJSON(update.buildings, {
      filter: ({properties}) => update.coverageByBuilding.get(properties.building_id)[scenario.scenario_id] === (covered ? '1' : '0'),
      style: {renderer, weight: 0.6, color, fillOpacity: 0.65},
      onEachFeature: ({properties}, layer) => {
        bindDistributionPopup(layer, `<b>${covered ? 'Dalam cakupan skenario' : 'Di luar cakupan skenario'}</b>
          <br>Bangunan ${esc(properties.building_id)}<br>Jarak layanan: ${fmt(scenario.radius_m)} m
          <br>Konektor maksimal: ${fmt(scenario.connector_max_m)} m`);
      }
    }).addTo(st.map);
    st.assignmentLayer = drawBuildings(true, networkStyles.assigned);
    if (layers.uncovered) st.uncoveredLayer = drawBuildings(false, networkStyles.outside);
  } else {
    st.assignmentLayer = L.geoJSON(st.networkAssignments, {
      ...pointOptions(true), filter: feature => bySite(feature) && feature.properties.covered_500m_network === true
    }).addTo(st.map);
  }
  if (!scenario && layers.uncovered) {
    st.uncoveredLayer = L.geoJSON(st.networkAssignments, {
      ...pointOptions(false), filter: feature => bySite(feature) && feature.properties.covered_500m_network !== true
    }).addTo(st.map);
  }
  if (update && layers.zones) {
    st.zoneLayer = L.geoJSON(update.zones, {
      filter: ({properties}) => activeSites.has(properties.site_id),
      interactive: false,
      style: {color: networkStyles.zone, weight: 1.4, fillOpacity: 0.08, dashArray: '5 4'}
    }).addTo(st.map);
  }
  if (layers.sites) {
    st.siteLayer = L.geoJSON(st.networkSites, {
      filter: ({properties}) => activeSites.has(properties.site_id),
      pointToLayer: (feature, point) => {
        const id = feature.properties.site_id;
        const selected = id === st.assignmentSite;
        return L.marker(point, {
          title: id, alt: id, zIndexOffset: selected ? 1000 : 0,
          icon: L.divIcon({
            className: '', html: `<span class="site-pin${selected ? ' selected' : ''}">${esc(id.slice(-2))}</span>`,
            iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -12]
          })
        });
      },
      onEachFeature: (feature, layer) => {
        const data = feature.properties;
        const load = demand && update.loads.find(row => row.site_id === data.site_id &&
          Number(row.scenario_affected_fraction) === demand.affected_fraction &&
          Number(row.scenario_liters_person_day) === demand.liters_person_day);
        const baselineDetails = `<br>Bangunan teralokasi: ${fmt(data.assigned_buildings)}
          <br>Tercakup ≤${fmt(net.service_distance_m)} m: ${fmt(data.covered_within_500m_network_plus_connectors)}
          <br>Kebutuhan skenario: ${fmt(load?.demand_proxy_liters_day ?? data.screening_demand_L_day, 1)} L/hari`;
        const verification = update?.checklist.find(row => row.site_id === data.site_id);
        bindDistributionPopup(layer, `<b>${esc(data.site_id)}</b>
          ${scenario ? '<br>Kandidat aktif pada skenario terpilih.' : baselineDetails}
          ${verification ? '<br>Status tapak: ' + esc(siteCheckValue(verification.site_viability)) : ''}
          <br><i>Calon pusat pencarian. Lahan, akses truk, dan sumber air belum diverifikasi.</i>`);
      }
    }).addTo(st.map);
  }
}

function drawHistoricAidMap() {
  if (st.historicAid) {
    st.mdmcLayer = L.geoJSON(st.historicAid, {
      pointToLayer: ({properties}, point) => L.marker(point, {
        title: `Lokasi bantuan terdahulu · ${properties.location_label}`,
        zIndexOffset: 1100,
        icon: L.divIcon({
          className: 'mdmc-pin', html: waterTruckIcon,
          iconSize: [32, 32], iconAnchor: [16, 16]
        })
      }),
      onEachFeature: ({properties: record}, layer) => bindDistributionPopup(layer, `<b>Bantuan MDMC · historis</b>
        <br>${esc(record.location_label)} · ${esc(record.event_date)}
        <br>Volume tercatat: ${fmt(record.reported_volume_litres_at_popup)} L
        <br>Donor: ${esc(record.donor)}<br>Koordinat perkiraan dari penanda peta MDMC.
        <br><a href="${esc(record.source_url)}" target="_blank" rel="noopener noreferrer">Sumber catatan MDMC</a>`)
    }).addTo(st.map);
  }
}

function residentDistribution() {
  distributionControls.innerHTML = `<div class="control"><strong>Untuk menanyakan bantuan</strong>
    <p>Sampaikan nama padukuhan dan keadaan persediaan air kepada Dukuh atau Pemerintah Kalurahan.</p></div>`;
  distributionMetrics.innerHTML = '';
  const formatDate = date => new Intl.DateTimeFormat('id-ID', {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(date));
  distributionDetails.innerHTML = st.historicAid
    ? st.historicAid.features.map(({properties: event}) => panel('Bantuan terdahulu · ' + event.location_label,
      mini('Tanggal penyaluran', formatDate(event.event_date)) +
      mini('Volume tercatat', fmt(event.reported_volume_litres_at_popup) + ' liter') +
      mini('Donor', event.donor) +
      '<p>Catatan ini membantu melihat riwayat bantuan. Informasi penyaluran terbaru dapat ditanyakan ke kalurahan.</p>', true)).join('')
    : panel('Riwayat bantuan', st.historicAidError
      ? '<p>Riwayat bantuan belum bisa dimuat.</p><button class="section-link" id="retry-historic-aid">Coba lagi</button>'
      : '<p role="status">Memuat riwayat bantuan…</p>', true);
  const retry = $('#retry-historic-aid');
  if (retry) retry.onclick = () => {
    loadHistoricAid();
    refreshDistribution();
  };
}

function networkDistribution() {
  const net = st.networkSummary;
  const sum = st.summary;
  const update = st.distributionUpdate;
  const scenario = currentNetworkScenario();
  const demand = currentDistributionDemand();
  const radius = scenario?.radius_m ?? net.service_distance_m;
  const connector = scenario?.connector_max_m ?? net.max_connector_distance_m;
  const served = scenario?.covered_buildings ?? net.n_covered_500m_network_plus_access;
  const total = net.N_building_footprint_proxies;
  const unserved = total - served;
  const far = total - net.n_demand_near_walk_network;
  const target = sum.config.target_fraction_of_detected_buildings_covered * 100;
  distributionMetrics.innerHTML =
    card('Kandidat jaringan OSM', fmt(scenario?.selected_site_count ?? net.selected_site_count), 'Simpul OSM untuk pencarian tapak') +
    card(`Cakupan ${fmt(radius)} m`, fmt(scenario?.coverage_pct ?? net.coverage_network_pct, 2) + '%',
      `Target ${fmt(target)}% ${served / total * 100 >= target ? 'tercapai dalam model' : 'belum tercapai'}`) +
    card('Proksi bangunan tercakup', fmt(served), 'Dari ' + fmt(total) + ' proksi bangunan') +
    card('Proksi belum tercakup', fmt(unserved), scenario
      ? 'Berdasarkan skenario terpilih' : `${fmt(far)} jauh dari node · ${fmt(unserved - far)} dekat jaringan`);
  const layerNames = {
    sites: 'Kandidat distribusi',
    uncovered: 'Bangunan belum tercakup',
    ...(update ? {zones: 'Zona pencarian tapak 150 m'} : {}),
    ...(st.showAidLocations && st.historicAid ? {mdmc: 'Bantuan MDMC · historis'} : {})
  };
  distributionControls.innerHTML = siteMethodControl(true) + distributionScenarioControls() +
    (st.showDistributionCoverage ? '<p>Matikan zona cakupan garis lurus untuk melihat hasil jaringan di peta.</p>' : '') +
    `<fieldset class="checklist"><legend class="ctrl-label">Layer distribusi</legend>
    ${Object.entries(layerNames).map(([key, name]) => `<label class="checkline">
      <input type="checkbox" data-network-layer="${key}" ${st.networkLayers[key] ? 'checked' : ''} />${name}</label>`).join('')}
    </fieldset>${scenario ? '' : `<div class="control"><label class="ctrl-label" for="assignment-site">Filter alokasi bangunan</label>
      <select id="assignment-site"><option value="">Semua bangunan</option>
      ${st.networkSites.features.map(({properties}) => `<option value="${esc(properties.site_id)}">${esc(properties.site_id)}</option>`).join('')}
      </select><small>Pilih kandidat untuk melihat centroid yang teralokasi ke titik itu.</small></div>`}
    ${update ? `<div class="control"><label class="ctrl-label" for="distribution-demand">Skenario kebutuhan air</label>
      <select id="distribution-demand">${update.demand.map((row, index) =>
        `<option value="${index}" ${row === demand ? 'selected' : ''}>${fmt(row.affected_fraction * 100)}% terdampak · ${fmt(row.liters_person_day)} L/orang/hari</option>`
      ).join('')}</select></div>` : ''}
    <div class="notice">Jarak layanan mencakup jaringan jalan kaki OSM dan konektor lurus hingga
      ${fmt(connector)} m. Kelayakan tapak, akses truk, dan sumber air masih perlu verifikasi.</div>`;
  $('#site-method').onchange = event => setDistributionMethod(event.target.value);
  if (update) {
    distributionControls.querySelectorAll('[data-scenario-field]').forEach(input => {
      input.onchange = () => {
        st.scenarioId = `r${$('#scenario-radius_m').value}_c${$('#scenario-connector_max_m').value}_p${$('#scenario-selected_site_count').value}`;
        st.assignmentSite = '';
        refreshDistribution();
        document.getElementById(input.id).focus({preventScroll: true});
      };
    });
    $('#reset-distribution').onclick = () => {
      st.scenarioId = baselineScenarioId;
      refreshDistribution();
      $('#scenario-radius_m').focus({preventScroll: true});
    };
    $('#distribution-demand').onchange = event => {
      st.distributionDemandIndex = Number(event.target.value);
      refreshDistribution();
      $('#distribution-demand').focus({preventScroll: true});
    };
  }
  const retry = $('#retry-distribution');
  if (retry) retry.onclick = () => {
    st.distributionError = '';
    refreshDistribution();
    loadDistributionUpdate();
  };
  const assignment = $('#assignment-site');
  if (assignment) {
    assignment.value = st.assignmentSite;
    assignment.onchange = event => {
      st.assignmentSite = event.target.value;
      updateDistributionMap();
      updateLegend();
      const marker = st.siteLayer?.getLayers().find(layer => layer.feature.properties.site_id === st.assignmentSite);
      if (marker) st.map.panInside(marker.getLatLng(), {padding: [20, 20]});
    };
  }
  distributionControls.querySelectorAll('[data-network-layer]').forEach(input => {
    input.onchange = () => {
      st.networkLayers[input.dataset.networkLayer] = input.checked;
      updateDistributionMap();
      updateLegend();
    };
  });
  const finalGreedy = st.coverageCurve.at(-1);
  const chartNote = scenario
    ? `<p>Perbandingan jumlah kandidat pada jarak ${fmt(radius)} m dan konektor ${fmt(connector)} m. Hasil memakai pilihan dari 30 kandidat v6.</p>`
    : `<p>Kurva mencatat tahap greedy. Pada ${esc(finalGreedy.p)} kandidat, cakupannya
      ${fmt(finalGreedy.coverage_pct, 2)}% (${fmt(finalGreedy.covered)} proksi).
      Setelah penyempurnaan pertukaran lokasi (local swap), hasil akhir v6 mencapai
      ${fmt(net.coverage_network_pct, 2)}% (${fmt(served)} proksi).
      Setiap centroid mendapat bobot yang sama.</p>`;
  distributionDetails.innerHTML = panel('Jumlah kandidat dan cakupan jaringan',
    '<div id="network-coverage-plot"></div>' + chartNote, true) +
    panel('Batas skenario OSM', (scenario
      ? mini('Jumlah kandidat tersedia untuk skenario', fmt(net.selected_site_count))
      :
      mini('Maksimum dengan seluruh ' + fmt(net.n_site_candidates_walk_drive_screened) + ' kandidat',
        fmt(net.n_demand_any_candidate_within_500m / total * 100, 2) + '%')) +
      mini('Konektor lurus maksimum', fmt(connector) + ' m') +
      '<p>Jaringan jalan kendaraan memberi konteks lokasi. Jarak pelayanan memakai graf pejalan kaki.</p>') +
    panel('Kebutuhan bantuan air eksternal',
      mini('Penduduk referensi', fmt(demand?.population_reference ?? sum.population_reference) + ' jiwa · tahun acuan belum tercatat') +
      mini('Fraksi terdampak (asumsi)', fmt((demand?.affected_fraction ?? sum.affected_fraction) * 100) + '%') +
      mini('Kebutuhan per kapita', fmt(demand?.liters_person_day ?? sum.per_capita_L_day) + ' L/hari') +
      mini('Total skenario', fmt(demand?.total_liters_day_hypothetical ?? sum.proxy_daily_demand_L, 1) + ' L/hari') +
      (demand && !scenario ? mini('Di area tercakup', fmt(demand.demand_in_covered_service_areas_liters, 1) + ' L/hari') +
        mini('Di luar area tercakup', fmt(demand.demand_outside_service_areas_liters, 1) + ' L/hari') : '') +
      '<p>Estimasi memakai proksi bangunan dan asumsi penduduk terdampak.</p>') +
    (update ? siteChecklistPanel(update.checklist) + mdmcContextPanel(update.mdmcContext) : '');
  const checklist = $('#checklist-site');
  if (checklist) {
    const drawChecklist = () => {
      st.checklistSiteId = checklist.value;
      const row = update.checklist.find(item => item.site_id === st.checklistSiteId);
      $('#checklist-status').innerHTML = siteCheckFields
        .map(([label, field]) => mini(label, siteCheckValue(row[field]))).join('');
    };
    checklist.onchange = drawChecklist;
    drawChecklist();
  }
  const points = scenario ? update.scenarios
    .filter(row => row.radius_m === radius && row.connector_max_m === connector)
    .sort((a, b) => a.selected_site_count - b.selected_site_count)
    .map(row => ({label: `${row.selected_site_count} kandidat`, value: row.coverage_pct, note: fmt(row.covered_buildings) + ' proksi tercakup'}))
    : st.coverageCurve.map(row => ({
    label: `${row.p} kandidat`, value: Number(row.coverage_pct), note: fmt(row.covered) + ' proksi tercakup'
  }));
  plotSeries($('#network-coverage-plot'), {
    title: scenario ? 'Cakupan jaringan berdasarkan jumlah kandidat' : 'Cakupan tahap greedy berdasarkan jumlah kandidat',
    points, unit: '%', yMax: 100,
    reference: {value: target, label: `Garis putus-putus: target ${fmt(target)}%`}
  });
}
