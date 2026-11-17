'use strict';

function dataTable(label, headings, rows) {
  return `<div class="table-scroll" role="region" aria-label="${esc(label)}" tabindex="0">
    <table class="data-table"><thead><tr>${headings.map(heading => `<th scope="col">${esc(heading)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </div>`;
}

const visualAuditLabels = {
  ADA: 'Tampak ada', TIDAK_ADA: 'Tidak tampak', RAGU: 'Meragukan',
  SESUAI: 'Sesuai', SEBAGIAN: 'Sesuai sebagian', TIDAK_JELAS: 'Kurang jelas',
  GENTENG_INDIKATIF: 'Indikasi genteng', LOGAM_INDIKATIF: 'Indikasi logam',
  ATAP_DATAR_INDIKATIF: 'Indikasi atap datar', TIDAK_BISA_DIPASTIKAN: 'Belum dapat dipastikan'
};

function rwhAuditPanel() {
  const rows = st.rwhAudit;
  const count = (key, value) => fmt(rows.filter(row => row[key] === value).length);
  return panel('Audit visual · ' + fmt(rows.length) + ' sampel bangunan',
    '<p>Pemeriksaan visual mencakup sampel ini. Material atap bersifat indikatif dan memerlukan verifikasi lapangan.</p>' +
    mini('Keberadaan pada citra', `${count('existence', 'ADA')} tampak ada · ${count('existence', 'TIDAK_ADA')} tidak tampak · ${count('existence', 'RAGU')} meragukan`) +
    mini('Kesesuaian footprint', `${count('footprint', 'SESUAI')} sesuai · ${count('footprint', 'SEBAGIAN')} sebagian · ${count('footprint', 'TIDAK_JELAS')} kurang jelas`) +
    `<details class="treatment"><summary>Lihat rincian sampel</summary>
      ${dataTable('Rincian audit visual', ['ID bangunan', 'Confidence', 'Keberadaan', 'Footprint', 'Indikasi atap'],
        rows.map(row => [row.id, fmt(row.confidence, 2), visualAuditLabels[row.existence], visualAuditLabels[row.footprint], visualAuditLabels[row.roof]]))}
    </details>`, true);
}

function rwhBuildingStyle(feature) {
  return {weight: 0.28, color: '#476b5d', fillColor: buildingColor(metricM3(feature)), fillOpacity: 0.82};
}

function pointInRing({lng, lat}, ring) {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = ring[i - 1];
    const [x2, y2] = ring[i];
    if ((y1 > lat) !== (y2 > lat) && lng < x1 + (lat - y1) * (x2 - x1) / (y2 - y1)) {
      inside = !inside;
    }
  }
  return inside;
}

function isInKatongan(location) {
  return st.boundary.features.some(({geometry}) => {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.some(([outer, ...holes]) =>
      pointInRing(location, outer) && !holes.some(hole => pointInRing(location, hole)));
  });
}

function cancelRwhLocationRequest() {
  if (!st.rwhLocationRequest) return;
  st.rwhLocationRequest = null;
  $('#rwh-locate').disabled = false;
  $('#rwh-location-status').textContent = '';
}

function resetRwhMap() {
  closeRwhMapTool();
  cancelRwhLocationRequest();
  st.rwhLocationMarker?.remove();
  st.rwhLocationMarker = null;
  $('#rwh-location-status').textContent = '';
  closeRwhBuilding();
  fitKatongan();
}

function locateRwhUser() {
  closeRwhMapTool();
  const status = $('#rwh-location-status');
  if (!window.isSecureContext) {
    status.textContent = 'Untuk memakai lokasi, buka WebGIS lewat HTTPS atau localhost. Anda juga bisa memilih bangunan di peta.';
    return;
  }
  if (!navigator.geolocation) {
    status.textContent = 'Peramban ini tidak mendukung lokasi. Pilih bangunan langsung di peta.';
    return;
  }

  st.rwhLocationMarker?.remove();
  st.rwhLocationMarker = null;
  const request = Symbol();
  st.rwhLocationRequest = request;
  $('#rwh-locate').disabled = true;
  status.textContent = 'Mencari lokasi Anda…';
  const finish = () => {
    if (st.rwhLocationRequest !== request) return false;
    cancelRwhLocationRequest();
    return true;
  };

  navigator.geolocation.getCurrentPosition(({coords}) => {
    if (!finish()) return;
    const location = L.latLng(coords.latitude, coords.longitude);
    if (!isInKatongan(location)) {
      resetRwhMap();
      status.textContent = 'Perkiraan lokasi Anda berada di luar Katongan. Pilih bangunan langsung di peta Katongan.';
      return;
    }
    closeRwhBuilding();
    st.map.setView(location, coords.accuracy > 100 ? 16 : 18, {animate: false});
    st.rwhLocationMarker = L.circleMarker(location, {
      radius: 7, color: '#fff', weight: 2, fillColor: '#1769a6', fillOpacity: 1, interactive: false
    }).addTo(st.map);
    status.textContent = `Titik biru menandai perkiraan lokasi Anda (±${fmt(coords.accuracy)} m).`;
    st.map.panInside(location, {
      paddingTopLeft: [20, $('.rwh-map-guide').offsetHeight + 24],
      paddingBottomRight: [20, 24],
      animate: false
    });
  }, error => {
    if (!finish()) return;
    const messages = {
      1: 'Izin lokasi belum diberikan. Izinkan lewat pengaturan peramban atau pilih bangunan langsung di peta.',
      3: 'Pencarian lokasi terlalu lama. Coba lagi atau pilih bangunan langsung di peta.'
    };
    status.textContent = messages[error.code] ?? 'Lokasi belum ditemukan. Aktifkan layanan lokasi perangkat atau pilih bangunan langsung di peta.';
  }, {enableHighAccuracy: true, timeout: 10000});
}

function closeRwhBuilding() {
  if (st.selectedBuilding) st.buildingLayer.resetStyle(st.selectedBuilding);
  st.selectedBuilding = null;
  st.quickTank = null;
  $('#rwh-building').hidden = true;
  $('#rwh-building-content').replaceChildren();
}

function selectRwhBuilding(layer, location) {
  closeRwhMapTool();
  cancelRwhLocationRequest();
  closeRwhBuilding();
  st.selectedBuilding = layer;
  showRwhPanel();
  keepRwhBuildingVisible(location);
  const panel = $('#rwh-building');
  if (window.matchMedia('(max-width: 760px)').matches) {
    panel.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }
  panel.focus({preventScroll: true});
}

function keepRwhBuildingVisible(location) {
  const panel = $('#rwh-building');
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  st.map.panInside(location, {
    paddingTopLeft: [20, 20],
    paddingBottomRight: mobile
      ? [20, st.map.getSize().y - panel.offsetTop + 12]
      : [panel.offsetWidth + 80, 20],
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  });
}

function openQuickTank() {
  closeRwhMapTool();
  cancelRwhLocationRequest();
  const building = st.selectedBuilding?.feature.properties;
  st.quickTank ??= {roof_m2: building?.area_m2 ?? '', people: 4, tank_l: 5000};
  showRwhPanel();
  const panel = $('#rwh-building');
  panel.scrollTop = 0;
  panel.scrollIntoView({block: 'nearest', inline: 'nearest'});
  panel.focus({preventScroll: true});
  if (st.selectedBuilding) keepRwhBuildingVisible(st.selectedBuilding.getCenter());
}

function showRwhPanel() {
  const feature = st.selectedBuilding?.feature;
  const building = feature?.properties;
  const content = $('#rwh-building-content');
  content.innerHTML = `<div class="rwh-building-main"></div>
    ${feature ? `<section class="rwh-calculation-basis" aria-labelledby="rwh-calculation-title">
      <h3 id="rwh-calculation-title">Dasar perhitungan</h3>
      <div class="rwh-calculation-data">${rwhBuildingData(feature)}</div>
    </section>` : ''}`;
  const main = content.querySelector('.rwh-building-main');
  if (st.quickTank) {
    renderQuickTank(main, feature);
  } else {
    main.innerHTML = `<h2 id="rwh-building-title">Bangunan terpilih</h2>
      <div class="rwh-building-estimate">
        <span>Potensi air hujan dari atap</span>
        <div><strong>${fmt(metricM3(feature) * 1000)}</strong> liter per tahun</div>
        <span>Perkiraan luas atap ${fmt(building.area_m2, 1)} m²</span>
      </div>
      <button type="button" class="primary">Hitung kebutuhan tandon</button>`;
    main.querySelector('button').onclick = openQuickTank;
  }
  st.selectedBuilding?.setStyle({color: '#092f24', weight: 3, fillColor: '#f5c560', fillOpacity: 0.9});
  st.selectedBuilding?.bringToFront();
  $('#rwh-building').hidden = false;
}

function renderQuickTank(content, feature) {
  const building = feature?.properties;
  const quick = st.quickTank;
  if (quick.params?.rc !== st.rc) {
    quick.result = null;
    quick.comparison = null;
  }
  const percap = 25;
  content.innerHTML = `<h2 id="rwh-building-title">Hitung kebutuhan tandon</h2>
    <p>Asumsi ${percap} liter/orang/hari</p>
    <form id="quick-tank-form">
      <div class="quick-tank-fields">
        <label class="quick-tank-roof" for="quick-tank-roof">Luas atap (m²)
          <input id="quick-tank-roof" name="roof_m2" type="number" min="1" max="20000" step="any" required
            aria-describedby="quick-tank-roof-hint" value="${esc(quick.roof_m2)}">
          <small id="quick-tank-roof-hint"></small>
        </label>
        <label for="quick-tank-people">Jumlah penghuni
          <input id="quick-tank-people" name="people" type="number" min="1" max="100" required value="${esc(quick.people)}">
        </label>
        <label for="quick-tank-capacity">Ukuran tandon (liter)
          <input id="quick-tank-capacity" name="tank_l" type="number" min="0" max="100000" step="any" required value="${esc(quick.tank_l)}">
        </label>
      </div>
      <button class="primary" type="submit">Hitung</button>
    </form>
    <p class="notice" id="quick-tank-error" role="alert" hidden></p>
    <div id="quick-tank-results" class="quick-tank-results" aria-live="polite"></div>
    <details class="quick-tank-comparison" hidden${quick.comparison ? ' open' : ''}>
      <summary>Bandingkan ukuran tandon</summary>
      <form id="quick-tank-compare-form" class="quick-tank-fields">
        <label for="quick-tank-compare-capacity">Ukuran pembanding (liter)
          <input id="quick-tank-compare-capacity" name="tank_l" type="number" min="0" max="100000" step="any"
            required value="${esc(quick.comparison?.capacity ?? '')}">
        </label>
        <button class="primary" type="submit">Bandingkan</button>
      </form>
      <p class="notice" id="quick-tank-compare-error" role="alert" hidden></p>
      <div id="quick-tank-compare-results" aria-live="polite"></div>
    </details>
    <button type="button" class="section-link quick-tank-detail" hidden>Lihat detail</button>`;
  const form = $('#quick-tank-form');
  const roofHint = $('#quick-tank-roof-hint');
  const showRoofHint = () => {
    roofHint.textContent = building && Number(quick.roof_m2) === Number(building.area_m2)
      ? 'Perkiraan dari peta. Ubah jika Anda tahu luas atapnya.'
      : 'Contoh: bagian atap 10 m × 6 m = 60 m².';
  };
  showRoofHint();
  const summary = $('#quick-tank-results');
  const errorNotice = $('#quick-tank-error');
  const detail = content.querySelector('.quick-tank-detail');
  const comparison = content.querySelector('.quick-tank-comparison');
  const comparisonForm = $('#quick-tank-compare-form');
  const comparisonInput = $('#quick-tank-compare-capacity');
  const comparisonError = $('#quick-tank-compare-error');
  const comparisonResults = $('#quick-tank-compare-results');
  const showComparison = () => {
    comparisonResults.innerHTML = quick.comparison ? quickTankComparison(quick) : '';
  };
  const showResult = () => {
    summary.innerHTML = quick.result ? quickTankResults(quick.result, quick.params.demand_lpd) : '';
    detail.hidden = !quick.result;
    comparison.hidden = !quick.result;
    showComparison();
  };
  showResult();
  form.oninput = event => {
    quick[event.target.name] = event.target.value;
    showRoofHint();
    quick.result = null;
    quick.comparison = null;
    comparison.open = false;
    comparisonInput.value = '';
    comparisonInput.setCustomValidity('');
    comparisonError.hidden = true;
    errorNotice.hidden = true;
    showResult();
  };
  form.onsubmit = event => {
    event.preventDefault();
    const params = {roof_m2: form.elements.roof_m2.valueAsNumber, rc: st.rc,
      people: form.elements.people.valueAsNumber, tank_l: form.elements.tank_l.valueAsNumber,
      percap, demandMode: 'per-person', dailyDemand: 100, firstFlush: 0};
    try {
      quick.result = simulateTank(params);
      quick.params = params;
    } catch (error) {
      errorNotice.textContent = `Simulasi gagal. ${error.message}`;
      errorNotice.hidden = false;
      return;
    }
    errorNotice.hidden = true;
    showResult();
    if (st.selectedBuilding) keepRwhBuildingVisible(st.selectedBuilding.getCenter());
    $('#rwh-building').scrollTop = summary.offsetTop - 10;
  };
  comparisonInput.oninput = () => {
    comparisonInput.setCustomValidity('');
    comparisonError.hidden = true;
    quick.comparison = null;
    showComparison();
  };
  comparisonForm.onsubmit = event => {
    event.preventDefault();
    const capacity = comparisonInput.valueAsNumber;
    if (capacity === quick.params.tank_l) {
      comparisonInput.setCustomValidity('Masukkan ukuran yang berbeda dari tandon awal.');
      comparisonInput.reportValidity();
      return;
    }
    try {
      quick.comparison = {capacity, result: simulateTank({...quick.params, tank_l: capacity})};
    } catch (error) {
      comparisonError.textContent = `Simulasi gagal. ${error.message}`;
      comparisonError.hidden = false;
      return;
    }
    comparisonError.hidden = true;
    showComparison();
    $('#rwh-building').scrollTop = comparisonResults.offsetTop - 10;
  };
  detail.onclick = () => {
    st.tankMapReturn = {feature, quick, center: st.map.getCenter(), zoom: st.map.getZoom()};
    st.lastSim = quick.params;
    chooseTab('tank');
    window.scrollTo(0, 0);
    const heading = $('#tab-intro h1');
    heading.tabIndex = -1;
    heading.focus({preventScroll: true});
  };
}

function quickTankResults(result, demand) {
  const cards = [
    ['Hari dengan air cukup', result.time_reliability_pct],
    ['Kebutuhan air terpenuhi', result.volume_reliability_pct]
  ];
  return `<h3>Perkiraan kecukupan tandon</h3>
    <p>Kebutuhan ${fmt(demand)} liter/hari · Simulasi hujan 1996–2025</p>
    <div class="quick-tank-metrics">${cards.map(([label, percent]) => `
      <div class="quick-tank-metric">
        <span>${label}</span>
        <strong>${fmt(percent, 2)}%</strong>
        <span class="quick-tank-bar" aria-hidden="true"><span style="width:${percent}%"></span></span>
      </div>`).join('')}</div>
    <div class="quick-tank-season">
      <span><b>Juli–September</b><br>Hari dengan air cukup</span>
      <b>${fmt(result.dry_season_time_reliability_pct, 2)}%</b>
    </div>`;
}

function quickTankComparison({params, result, comparison}) {
  const liters = capacity => capacity.toLocaleString('id-ID', {maximumFractionDigits: 20}) + ' L';
  const rows = [
    ['Hari cukup air, Juli–September', 'dry_season_time_reliability_pct', 'quick-tank-compare-season'],
    ['Hari cukup air, sepanjang tahun', 'time_reliability_pct', ''],
    ['Kebutuhan air terpenuhi', 'volume_reliability_pct', '']
  ];
  return `<table class="quick-tank-compare-table">
    <caption>Perkiraan untuk atap dan kebutuhan air yang sama</caption>
    <thead><tr>
      <td></td>
      <th scope="col">${liters(params.tank_l)}</th>
      <th scope="col">${liters(comparison.capacity)}</th>
    </tr></thead>
    <tbody>${rows.map(([label, key, className]) => `<tr class="${className}">
      <th scope="row">${label}</th><td>${fmt(result[key], 2)}%</td><td>${fmt(comparison.result[key], 2)}%</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function returnToRwhMap() {
  const {feature, quick, center, zoom} = st.tankMapReturn;
  chooseTab('rwh');
  window.scrollTo(0, 0);
  st.map.setView(center, zoom, {animate: false});
  const layer = st.buildingLayer.getLayers().find(item => item.feature === feature);
  st.selectedBuilding = layer ?? null;
  st.quickTank = quick;
  showRwhPanel();
  const panel = $('#rwh-building');
  panel.scrollTop = $('#quick-tank-results').offsetTop - 10;
  panel.focus({preventScroll: true});
}

function tankBuildingDetails(feature) {
  return panel('Data bangunan pada peta',
    mini('Perkiraan luas atap', fmt(feature.properties.area_m2, 1) + ' m²') + rwhBuildingData(feature));
}

function rwhBuildingData(feature) {
  const {properties: building} = feature;
  const audit = st.rwhAuditById.get(building.id);
  return mini('ID bangunan', building.id) +
    mini('Hujan tahunan', fmt(building.rain_mm_annual, 1) + ' mm') +
    mini('Keyakinan deteksi bangunan (confidence)', fmt(building.confidence, 2)) +
    mini('Koefisien limpasan (RC)', fmt(st.rc, 2)) +
    mini('Potensi tangkapan tahunan', fmt(metricM3(feature), 2) + ' m³/tahun') +
    (audit ? mini('Audit visual', `${visualAuditLabels[audit.existence]} · footprint ${visualAuditLabels[audit.footprint].toLowerCase()}`) : '') +
    '<p>Bangunan dan material memerlukan verifikasi lapangan.</p>';
}

function plotSeries(container, {title, points, unit, yMin = 0, yMax, reference, axisLabels}) {
  if (!points.some(point => point.value !== null)) {
    container.innerHTML = '<p class="notice">Tidak ada data untuk pilihan ini.</p>';
    return;
  }
  const values = points.map(point => point.value).filter(value => value !== null);
  const max = yMax ?? Math.max(...values, yMin + 1);
  const x = index => 6 + index / Math.max(1, points.length - 1) * 688;
  const y = value => 166 - (value - yMin) / (max - yMin) * 160;
  let path = '';
  let previousValue = null;
  points.forEach((point, index) => {
    if (point.value !== null) {
      path += `${previousValue === null ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.value).toFixed(2)} `;
    }
    previousValue = point.value;
  });
  const first = points.findIndex(point => point.value !== null);
  const referenceLine = reference
    ? `<line x1="6" x2="694" y1="${y(reference.value)}" y2="${y(reference.value)}" class="plot-reference" />`
    : '';
  const scaleLabel = value => fmt(value, Number.isInteger(value) ? 0 : 1) + (unit === '%' ? '%' : unit ? ' ' + unit : '');
  container.innerHTML = `${reference ? `<p class="plot-key">${esc(reference.label)}</p>` : ''}
    <div class="plot-frame">
    <div class="plot-scale"><span>${esc(scaleLabel(max))}</span><span>${esc(scaleLabel(yMin))}</span></div>
    <svg class="plot" viewBox="0 0 700 172" preserveAspectRatio="none" aria-hidden="true">
      <line x1="6" x2="694" y1="166" y2="166" class="plot-axis" />
      ${yMin < 0 && max > 0 ? `<line x1="6" x2="694" y1="${y(0)}" y2="${y(0)}" class="plot-axis" />` : ''}
      ${referenceLine}<path d="${path}" />
      <line x1="0" x2="0" y1="6" y2="166" class="plot-cursor" />
      <circle r="4" />
    </svg></div>
    <div class="foot-row plot-domain"><span>${esc(axisLabels?.[0] ?? points[0].label)}</span>
      <span>${esc(axisLabels?.[1] ?? points.at(-1).label)}</span></div>
    <label class="plot-picker">Pilih titik pada grafik
      <input type="range" min="0" max="${points.length - 1}" value="${first}" aria-label="${esc(title)}" />
    </label><output class="plot-reading" aria-live="polite"></output>`;
  const svg = container.querySelector('svg');
  const slider = container.querySelector('input');
  const cursor = svg.querySelector('.plot-cursor');
  const dot = svg.querySelector('circle');
  const output = container.querySelector('output');
  function select(index) {
    const point = points[index];
    const label = point.value === null
      ? `${point.label} · Data belum tersedia`
      : `${point.label} · ${fmt(point.value, Number.isInteger(point.value) ? 0 : 2)}${unit ? ' ' + unit : ''}${point.note ? ' · ' + point.note : ''}`;
    slider.value = index;
    slider.setAttribute('aria-valuetext', label);
    cursor.setAttribute('x1', x(index));
    cursor.setAttribute('x2', x(index));
    dot.style.display = point.value === null ? 'none' : '';
    dot.setAttribute('cx', x(index));
    dot.setAttribute('cy', point.value === null ? 0 : y(point.value));
    if (output.textContent !== label) output.textContent = label;
  }
  const selectAtPointer = event => {
    const bounds = svg.getBoundingClientRect();
    const ratio = ((event.clientX - bounds.left) / bounds.width * 700 - 6) / 688;
    select(Math.round(Math.max(0, Math.min(1, ratio)) * (points.length - 1)));
  };
  svg.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') selectAtPointer(event);
  });
  svg.addEventListener('click', selectAtPointer);
  slider.oninput = () => select(Number(slider.value));
  select(first);
}

function plotMonthlyRain(container, periods) {
  const max = Math.max(50, Math.ceil(Math.max(...periods.map(({value}) => value ?? 0)) / 50) * 50);
  container.innerHTML = `<div class="climate-month-chart">
    <div class="climate-month-scale" aria-hidden="true"><span>${max} mm</span><span>0</span></div>
    <div class="climate-month-bars">
      ${periods.map(({month, label, value}) => {
        const reading = value === null ? 'Data belum tersedia' : fmt(value, 1) + ' mm';
        return `<button type="button" aria-label="${label}: ${reading}" aria-pressed="false"
          data-reading="${label} · ${reading}" style="--rainfall-height:${(value ?? 0) / max * 100}%">
          <span class="climate-month-column" aria-hidden="true"><i></i></span>
          <span aria-hidden="true">${month}</span>
        </button>`;
      }).join('')}
    </div>
  </div>
  <output class="plot-reading">Pilih bulan untuk melihat curah hujannya.</output>`;
  const output = container.querySelector('output');
  const buttons = container.querySelectorAll('button');
  buttons.forEach(button => {
    button.onclick = () => {
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      output.textContent = button.dataset.reading;
    };
  });
}

function renderRwhClimate() {
  const annual = st.annual.map(row => ({label: String(Number(row.year)), value: Number(row.rain_mm)}));
  const driest = annual.reduce((a, b) => a.value < b.value ? a : b);
  const wettest = annual.reduce((a, b) => a.value > b.value ? a : b);
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const months = monthNames.map((label, index) => {
    const data = st.monthly.filter(row => Number(row.month) === index + 1 && row.rain_mm !== '');
    return {
      month: label.slice(0, 3), label,
      value: data.length ? data.reduce((sum, row) => sum + Number(row.rain_mm), 0) / data.length : null
    };
  });
  const plot = $('#climate-plot');
  const heading = $('#climate-plot-title');
  const note = $('#climate-note');
  const seriesSelect = $('#climate-series');
  const thresholdSelect = $('#cdd-threshold');
  function draw() {
    const key = seriesSelect.value;
    const threshold = thresholdSelect.value;
    const spi = key === 'SPI3' || key === 'SPI6';
    const cdd = key === 'CDD';
    $('#cdd-control').hidden = !cdd;
    if (key === 'seasonal') {
      heading.textContent = 'Rata-rata hujan per bulan';
      plotMonthlyRain(plot, months);
      note.textContent = 'Setiap batang merangkum total hujan pada bulan yang sama selama 1996–2025.';
      return;
    }
    const points = key === 'annual' ? annual : cdd
      ? st.cdd.filter(row => Number(row.threshold_mm) === Number(threshold))
        .map(row => ({label: row.year, value: Number(row.max_CDD_days)}))
      : st.monthly.map(row => ({
        label: `${row.year}-${String(row.month).padStart(2, '0')}`,
        value: row[spi ? key : 'rain_mm'] === '' ? null : Number(row[spi ? key : 'rain_mm'])
      }));
    const title = key === 'annual' ? 'Total curah hujan per tahun' : seriesSelect.selectedOptions[0].textContent;
    heading.textContent = title;
    const bounds = spi ? {
      yMin: Math.min(-3, Math.floor(Math.min(...points.map(point => point.value ?? 0)))),
      yMax: Math.max(3, Math.ceil(Math.max(...points.map(point => point.value ?? 0)))),
      reference: {value: -1, label: 'Garis putus-putus: SPI −1'}
    } : {};
    plotSeries(plot, {title, points, unit: spi ? '' : cdd ? 'hari' : 'mm', ...bounds});
    note.textContent = cdd
      ? `Deret hari kering terpanjang per tahun dengan curah hujan harian di bawah ${fmt(Number(threshold), 1)} mm.`
      : spi ? 'Indeks ini menunjukkan seberapa basah atau kering periode tersebut dibandingkan kondisi biasanya.'
        : key === 'annual' ? `Terendah ${driest.label} (${fmt(driest.value)} mm) · tertinggi ${wettest.label} (${fmt(wettest.value)} mm).`
          : 'Total curah hujan tiap bulan dari Januari 1996 sampai Desember 2025.';
  }
  seriesSelect.onchange = thresholdSelect.onchange = draw;
  draw();
}

function simulateTank(params) {
  params.demand_lpd = params.demandMode === 'total' ? params.dailyDemand : params.people * params.percap;
  return simulateYASWithFirstFlush(st.daily, params, {depth_mm: params.firstFlush});
}

function tank() {
  const defaults = {roof_m2: 100, rc: 0.8, people: 4, percap: 25, tank_l: 5000, firstFlush: 0,
    demandMode: 'per-person', dailyDemand: 100};
  const prior = {...defaults, ...st.lastSim};
  if (st.tankMapReturn) {
    const building = st.tankMapReturn.feature?.properties;
    st.simFootprint = building ? {id: building.id, area: Number(building.area_m2)} : null;
    st.yasBenchmarkIndex = '';
  }
  const demandOptions = [{label: 'Skenario dasar lama', liters_per_person_per_day: 25}, ...st.demandScenarios];
  controls.innerHTML = `<form id="tank-form">
    <div class="control"><label class="ctrl-label" for="roof">Perkiraan luas atap (m²)</label>
      <input id="roof" type="number" min="1" max="20000" step="any" required value="${prior.roof_m2}" />
      <small>Contoh: bidang atap dengan panjang 10 m dan lebar 6 m luasnya 60 m².</small>
      <small id="roof-source" hidden></small></div>
    <div class="control" data-demand-per-person><label class="ctrl-label" for="people">Berapa orang yang memakai air?</label>
      <input id="people" type="number" min="1" max="100" required value="${prior.people}" /></div>
    <div class="control" id="daily-demand-control"><label class="ctrl-label" for="daily-demand">Kebutuhan total (liter per hari)</label>
      <input id="daily-demand" type="number" min="0.01" step="any" required value="${prior.dailyDemand}" /></div>
    <div class="control"><label class="ctrl-label" for="tank-l">Ukuran tandon (liter)</label>
      <input id="tank-l" type="number" min="0" max="100000" step="any" required value="${prior.tank_l}" /></div>
    <p id="tank-assumption" class="task-assumption"></p>
    <button class="primary" type="submit">Hitung kecukupan tandon</button>
    <p id="tank-error" class="notice" role="alert" hidden></p>
    <details class="advanced-controls control" id="tank-settings">
    <summary>Ubah asumsi atau pilih skenario penelitian</summary>
    <div class="control"><label class="ctrl-label" for="demand-mode">Cara memasukkan kebutuhan</label>
      <select id="demand-mode"><option value="per-person">Per penghuni</option><option value="total">Total rumah tangga</option></select></div>
    <div class="control" data-demand-per-person><label class="ctrl-label" for="percap">Kebutuhan (L/orang/hari)</label>
      <select id="percap">${demandOptions.sort((a, b) => a.liters_per_person_per_day - b.liters_per_person_per_day)
        .map(row => `<option value="${Number(row.liters_per_person_per_day)}">${esc(row.liters_per_person_per_day)} · ${esc(row.label)}</option>`).join('')}</select></div>
    <div class="control"><label class="ctrl-label" for="tank-rc">Koefisien limpasan</label>
      <select id="tank-rc">${[0.7, 0.8, 0.84, 0.9].map(rc => `<option value="${rc}">${fmt(rc, 2)}</option>`).join('')}</select></div>
    <div class="control"><label class="ctrl-label" for="first-flush">First flush (mm)</label>
      <select id="first-flush"><option value="0">0 · tanpa pengalihan</option>
        <option value="0.5">0,5 · skenario</option><option value="1">1,0 · skenario</option></select>
      <small>Pengalihan awal hujan diperkirakan dari deret harian.</small></div>
    <div class="control"><label class="ctrl-label" for="yas-benchmark">Skenario acuan YAS</label>
      <select id="yas-benchmark"><option value="">Pilih dari ${fmt(st.yasBenchmarks.length)} skenario</option>
        ${st.yasBenchmarks.map((row, index) => `<option value="${index}">${fmt(row.roof_m2)} m² ·
          ${fmt(row.demand_lpd)} L/hari · tandon ${fmt(row.tank_l)} L · RC ${fmt(row.runoff, 2)}</option>`).join('')}</select>
      <small>Acuan memakai first flush 0 mm.</small></div>
    </details></form>`;
  $('#percap').value = prior.percap;
  $('#tank-rc').value = prior.rc;
  $('#first-flush').value = prior.firstFlush;
  $('#demand-mode').value = prior.demandMode;
  $('#yas-benchmark').value = st.yasBenchmarkIndex ?? '';
  const describeDemand = () => {
    $('#tank-assumption').textContent = $('#demand-mode').value === 'total'
      ? 'Perhitungan memakai kebutuhan total yang Anda isi.'
      : `Perkiraan ini memakai ${fmt($('#percap').value)} liter per orang per hari. Anda bisa mengubahnya di pengaturan.`;
  };
  function showDemandInputs() {
    const total = $('#demand-mode').value === 'total';
    controls.querySelectorAll('[data-demand-per-person]').forEach(group => {
      group.hidden = total;
      group.querySelector('input, select').disabled = total;
    });
    $('#daily-demand-control').hidden = !total;
    $('#daily-demand').disabled = !total;
    describeDemand();
  }
  function showFootprint() {
    const source = $('#roof-source');
    source.hidden = !st.simFootprint || Number($('#roof').value) !== st.simFootprint.area;
    source.textContent = source.hidden ? '' : `Luas diambil dari footprint bangunan ${st.simFootprint.id}.`;
  }
  showDemandInputs();
  showFootprint();
  $('#demand-mode').onchange = showDemandInputs;
  $('#percap').onchange = describeDemand;
  $('#roof').oninput = showFootprint;
  const calculate = () => {
    if (!$('#tank-form').reportValidity()) return false;
    const params = {roof_m2: Number($('#roof').value), people: Number($('#people').value),
      percap: Number($('#percap').value), rc: Number($('#tank-rc').value), tank_l: Number($('#tank-l').value),
      firstFlush: Number($('#first-flush').value), demandMode: $('#demand-mode').value,
      dailyDemand: Number($('#daily-demand').value)};
    let result;
    try {
      result = simulateTank(params);
    } catch (error) {
      $('#tank-error').textContent = `Simulasi gagal. ${error.message}`;
      $('#tank-error').hidden = false;
      return false;
    }
    $('#tank-error').hidden = true;
    st.lastSim = params;
    const volume = value => fmt(value, 2) + ' m³';
    const percent = value => fmt(value, 2) + '%';
    metrics.innerHTML =
      card('Potensi tangkapan', volume(result.total_inflow_m3 + result.first_flush_total_m3), 'Sebelum pengalihan · total 30 tahun') +
      card('Kebutuhan terpenuhi', percent(result.volume_reliability_pct), 'Persentase volume kebutuhan') +
      card('Hari dengan air cukup', percent(result.time_reliability_pct), 'Bagian dari seluruh hari simulasi') +
      card('Kekurangan pasokan', volume(result.total_unmet_m3), 'Akumulasi kebutuhan yang belum terpenuhi');
    details.innerHTML = panel('Neraca air simulasi',
      mini('Kebutuhan rumah tangga', fmt(params.demand_lpd) + ' L/hari') +
      mini('Volume masuk tandon sebelum meluap', volume(result.total_inflow_m3)) +
      mini('Limpasan berlebih', volume(result.total_spillage_m3)) +
      mini('Volume yang memenuhi kebutuhan', volume(result.total_delivered_m3)) +
      mini('Dialihkan melalui first flush', volume(result.first_flush_total_m3)) +
      mini('Reliabilitas Juli–September', percent(result.dry_season_time_reliability_pct))) +
      panel('Asumsi simulasi', `<p>YAS harian menghitung air masuk, limpasan berlebih, pemenuhan kebutuhan,
        lalu sisa simpanan. Tandon berawal kosong. Hujan memakai rata-rata wilayah kajian CHIRPS 1996–2025.</p>
        <p>First flush memakai proksi awal hujan harian. Hasil menjelaskan neraca volume dan reliabilitas, sementara mutu air memerlukan pengujian.</p>`) +
      yasBenchmarkComparison(params, result) +
      (st.tankMapReturn?.feature ? tankBuildingDetails(st.tankMapReturn.feature) : '');
    return true;
  };
  $('#yas-benchmark').onchange = event => {
    st.yasBenchmarkIndex = event.target.value;
    const row = st.yasBenchmarks[event.target.value];
    if (!row) {
      $('#yas-comparison')?.closest('article').remove();
      return;
    }
    $('#roof').value = Number(row.roof_m2);
    $('#tank-rc').value = Number(row.runoff);
    $('#tank-l').value = Number(row.tank_l);
    $('#demand-mode').value = 'total';
    $('#daily-demand').value = Number(row.demand_lpd);
    $('#first-flush').value = '0';
    st.simFootprint = null;
    showDemandInputs();
    showFootprint();
    calculate();
  };
  $('#tank-form').onsubmit = event => {
    event.preventDefault();
    if (calculate()) $('#metrics').scrollIntoView({block: 'start'});
  };
  calculate();
}

function yasBenchmarkComparison(params, result) {
  const picker = $('#yas-benchmark');
  const row = st.yasBenchmarks[picker.value];
  if (!row) return '';
  if (params.firstFlush || params.roof_m2 !== Number(row.roof_m2) || params.rc !== Number(row.runoff) ||
      params.tank_l !== Number(row.tank_l) || params.demand_lpd !== Number(row.demand_lpd)) {
    st.yasBenchmarkIndex = '';
    picker.value = '';
    return '';
  }
  const fields = [
    ['Reliabilitas harian', 'time_reliability_pct', '%'],
    ['Kebutuhan terpenuhi', 'volume_reliability_pct', '%'],
    ['Reliabilitas Juli–September', 'dry_season_time_reliability_pct', '%'],
    ['Volume masuk', 'total_inflow_m3', ' m³'],
    ['Limpasan berlebih', 'total_spillage_m3', ' m³'],
    ['Volume kebutuhan terpenuhi', 'total_delivered_m3', ' m³'],
    ['Kekurangan pasokan', 'total_unmet_m3', ' m³']
  ];
  return panel('Perbandingan dengan skenario acuan YAS',
    `<div id="yas-comparison">${dataTable('Hasil simulasi dan acuan', ['Indikator', 'Hasil simulator', 'Acuan Master v6'],
      fields.map(([label, key, unit]) => [label, fmt(result[key], 2) + unit, fmt(row[key], 2) + unit]))}</div>`, true);
}

function qualitySceneArt(id) {
  const asset = 'assets/quality-guide/';
  const cutout = {
    tank: `<img class="quality-tank-photo" src="${asset}tank-cutout.webp" alt="Tandon air hitam dengan keran kuningan di bagian bawah" />`,
    odor: `<img class="quality-odor-photo" src="${asset}odor-cutout.webp" alt="Seorang perempuan menyadari bau dari ember air yang ia pegang" loading="lazy" />`,
    color: `<div class="quality-photo-samples" role="group" aria-label="Contoh warna air">
      <figure class="quality-sample-clear"><div class="quality-sample-frame"><img src="${asset}water-samples-photo.webp" alt="" loading="lazy" /></div><figcaption>Bening</figcaption></figure>
      <figure class="quality-sample-yellow"><div class="quality-sample-frame"><img src="${asset}water-samples-photo.webp" alt="" loading="lazy" /></div><figcaption>Kekuningan</figcaption></figure>
      <figure class="quality-sample-brown"><div class="quality-sample-frame"><img src="${asset}brown-water-photo.webp" alt="" loading="lazy" /></div><figcaption>Kecokelatan</figcaption></figure>
    </div>`,
    turbid: `<svg class="quality-scene-icon" viewBox="0 0 240 210" aria-hidden="true">
      <circle class="quality-icon-halo" cx="119" cy="107" r="83" />
      <path class="quality-icon-fill" d="M65 82c12 7 24 3 38-1 12-4 27-3 38 2l-8 86H73Z" />
      <path d="M61 66h84l-10 107H71Z" />
      <circle class="quality-icon-cap" cx="156" cy="112" r="24" />
      <path d="m173 130 24 24m-52-40h1m12 9h1m5-16h1" />
      <path class="quality-icon-detail" d="M86 108h1m22 20h1m-28 20h1m25 8h1m10-48h1M37 116h14m-7-7v14m155-56h16m-8-8v16" />
    </svg>`,
    purpose: `<svg class="quality-scene-icon" viewBox="0 0 240 210" aria-hidden="true">
      <circle class="quality-icon-halo" cx="128" cy="111" r="82" />
      <path class="quality-icon-fill" d="M137 32h12v30h14c15 0 25 10 25 24v10h-14v-10c0-7-5-10-11-10h-35c-6 0-10-4-10-10v-4h19Z" />
      <path class="quality-icon-port" d="M135 32h16" />
      <path d="M128 51h30m-15 0v11m30 35h16" />
      <path class="quality-icon-detail" d="M43 91h18m-9-9v18" />
      <path class="quality-tap-water" d="M143 32v37h20c11 0 18 7 18 17v10" fill="none" />
    </svg>
    <img class="quality-glass-photo" src="${asset}glass-cutout.webp" alt="Gelas bening berisi air" loading="lazy" />
    <img class="quality-dipper-photo" src="${asset}dipper-cutout.webp" alt="Gayung mandi plastik hijau" loading="lazy" />
    <svg class="quality-pour" aria-hidden="true">
      <path class="quality-pour-stream" />
      <path class="quality-pour-sparkle" />
      <g class="quality-pour-impact">
        <ellipse class="quality-pour-ripple" rx="9" ry="2.5" />
        <ellipse class="quality-pour-ripple quality-pour-ripple-outer" rx="16" ry="4" />
        <g class="quality-pour-splash">
          <circle cx="-13" cy="-3" r="1.3" />
          <circle cx="-9" cy="-5" r="1.7" />
          <circle cx="-6" cy="-2" r="1.2" />
          <circle cx="-3" cy="-7" r="1.4" />
          <circle cx="3" cy="-4" r="1.8" />
          <circle cx="6" cy="-8" r="1.2" />
          <circle cx="9" cy="-3" r="1.5" />
          <circle cx="14" cy="-5" r="1.2" />
        </g>
      </g>
    </svg>`
  };
  return `<div class="quality-scene-art">${cutout[id]}</div>`;
}

let stopQualityPipeFlow = () => {};

function startQualityPipeFlow(form) {
  const stages = Array.from(form.querySelectorAll('.quality-stage'));
  const purpose = stages.at(-1);
  const purposeScene = purpose.querySelector('.quality-purpose-scene');
  const art = purposeScene.querySelector('.quality-scene-art');
  const tap = art.querySelector('.quality-scene-icon');
  const dipper = art.querySelector('.quality-dipper-photo');
  const streams = art.querySelectorAll('.quality-pour path');
  const impact = art.querySelector('.quality-pour-impact');
  const pipePaths = form.querySelectorAll('.quality-pipe-water');
  const listeners = new AbortController();
  let frame = 0;

  function updateFlow() {
    frame = 0;
    const readingLine = window.innerHeight * 0.52;
    const current = Math.max(0, stages.findLastIndex(stage => stage.getBoundingClientRect().top <= readingLine));
    const guideInView = purposeScene.getBoundingClientRect().bottom > readingLine;
    stages.forEach((stage, index) => {
      const state = index === current && guideInView ? 'flowing' : index <= current ? 'filled' : 'empty';
      if (stage.dataset.water === state) return;
      stage.classList.toggle('quality-water-entering', state === 'flowing' && stage.dataset.water !== 'filled');
      stage.dataset.water = state;
    });
  }

  function scheduleFlow() {
    if (!frame) frame = requestAnimationFrame(updateFlow);
  }

  function positionPour() {
    const scene = art.getBoundingClientRect();
    const tapBox = tap.getBoundingClientRect();
    const bowl = dipper.getBoundingClientRect();
    if (!scene.width || !bowl.height) return;
    const x = tapBox.left - scene.left + tapBox.width * 181 / 240;
    const fromY = tapBox.top - scene.top + tapBox.height * 96 / 210;
    const toY = Math.max(fromY + 4, bowl.top - scene.top + bowl.height * 0.24);
    streams.forEach(stream => stream.setAttribute('d', `M ${x} ${fromY} V ${toY}`));
    impact.setAttribute('transform', `translate(${x} ${toY})`);
    scheduleFlow();
  }

  function measurePipes() {
    // Non-scaling strokes take dash lengths in screen pixels, while the SVG reports its path in viewBox units.
    for (const pipe of pipePaths) {
      const matrix = pipe.getScreenCTM();
      if (!matrix || !pipe.ownerSVGElement.getBoundingClientRect().width) continue;
      const length = pipe.getTotalLength();
      const intervals = 96;
      let pixels = 0;
      let last = pipe.getPointAtLength(0);
      for (let index = 1; index <= intervals; index += 1) {
        const point = pipe.getPointAtLength(length * index / intervals);
        const x = point.x - last.x;
        const y = point.y - last.y;
        pixels += Math.hypot(matrix.a * x + matrix.c * y, matrix.b * x + matrix.d * y);
        last = point;
      }
      pipe.ownerSVGElement.style.setProperty('--pipe-length', `${Math.ceil(pixels) + 2}px`);
    }
    positionPour();
  }

  const resize = new ResizeObserver(measurePipes);
  resize.observe(art);
  resize.observe(dipper);
  for (const pipe of pipePaths) resize.observe(pipe.ownerSVGElement);
  window.addEventListener('scroll', scheduleFlow, {passive: true, signal: listeners.signal});
  window.addEventListener('resize', measurePipes, {signal: listeners.signal});
  scheduleFlow();
  stopQualityPipeFlow = () => {
    listeners.abort();
    resize.disconnect();
    cancelAnimationFrame(frame);
    stopQualityPipeFlow = () => {};
  };
}

function quality() {
  const uses = {DRINKING: 'Minum', COOKING: 'Memasak', NONPOTABLE_DOMESTIC: 'Mandi, mencuci, atau bersih-bersih', OTHER: 'Keperluan lain'};
  const riskLabels = {
    MICROBIAL_SOURCE_POSSIBLE: 'Sumber cemaran mikrobiologis potensial',
    VECTOR_AND_RECONTAMINATION_POSSIBLE: 'Risiko vektor dan kontaminasi ulang',
    MATERIAL_UNKNOWN: 'Material atap perlu diidentifikasi',
    CHEMICAL_RISK_SUSPECTED: 'Dugaan kontaminasi kimia',
    PARTICLES_TURBIDITY_POSSIBLE: 'Partikel dan kekeruhan'
  };
  const verificationLabels = {
    SANITARY_INSPECTION: 'Inspeksi sanitasi',
    MICROBIAL_TESTING: 'Pengujian mikrobiologi',
    VECTOR_INSPECTION: 'Inspeksi vektor',
    ROOF_MATERIAL_REVIEW: 'Identifikasi material atap',
    CHEMICAL_TESTING_IF_INDICATED: 'Uji kimia bila terindikasi',
    TARGETED_CHEMICAL_TESTING: 'Uji kimia terarah',
    TURBIDITY_MEASUREMENT: 'Pengukuran kekeruhan',
    E_COLI_AND_RELEVANT_POTABLE_PANEL: 'E. coli dan panel uji sesuai tujuan konsumsi',
    REGULATORY_REVIEW: 'Tinjauan standar yang berlaku oleh tenaga kompeten',
    COMPLETE_RELEVANT_LABORATORY_TESTING: 'Lengkapi uji laboratorium sesuai penggunaan'
  };
  const previous = st.qualityInput ?? {use: '', scenario: 'EMERGENCY_MIN', checked: [], lab: 'none'};
  const waterSources = {rain: 'Air hujan dari atap', well: 'Sumur atau mata air', piped: 'Air perpipaan', delivered: 'Bantuan air atau mobil tangki', other: 'Sumber lain atau campuran', unknown: 'Tidak tahu'};
  const sanitary = {
    ...Object.fromEntries(st.sanitaryChecklist.map(row => [
      row.item_id,
      [
        row.resident_label_id?.trim() || row.question_risk_if_yes,
        row.resident_action_id?.trim() || row.suggested_action
      ]
    ])),
    dirty_water: ['Air banjir atau air kotor sempat masuk', 'Tunda penggunaan air tandon sampai diperiksa dan gunakan sumber air yang sudah dipastikan layak. Sampaikan kapan air banjir atau air kotor masuk.'],
    chem: ['Ada dugaan bahan kimia masuk', 'Hentikan penggunaan air tandon untuk sementara. Pakai sumber air yang sudah dipastikan layak dan hubungi puskesmas.']
  };
  const tankChecks = ['S05', 'S07', 'dirty_water', 'S06'];
  const roofItems = ['S01', 'S03', 'S02', 'S04'];
  const chemistry = {
    id: 'chem', label: 'Dugaan bahan kimia', yes: 'Ada dugaan bahan kimia',
    action: sanitary.chem[1],
    detail: 'Catat bahan yang diduga masuk dan kapan kejadiannya, misalnya setelah tumpahan bensin atau pestisida. Merebus atau memberi disinfektan tidak dapat menghilangkan risiko dari air yang tercemar bahan kimia berbahaya.',
    source: 'https://www.cdc.gov/water-emergency/about/index.html',
    sourceLabel: 'CDC · Dugaan pencemaran bahan kimia'
  };
  const stages = [
    {
      id: 'tank', label: 'Tandon', question: 'Ada masalah pada tandon?',
      intro: 'Dari luar, periksa tutup tandon, retakan, dan apakah air banjir atau air kotor pernah masuk.',
      yes: 'Ada masalah pada tandon',
      pipe: 'M72 85.5 V100',
      mobilePipe: 'M59 85.5 V86 Q59 91 65 91 H92 Q96 91 96 96 V100',
      action: 'Gunakan sumber air yang sudah dipastikan layak untuk minum dan memasak. Jika air banjir atau air kotor masuk, hentikan penggunaan air tandon sampai diperiksa.',
      detail: 'Catat apa yang Anda temukan. Tutup tandon jika bisa dilakukan dengan aman dan minta bantuan petugas untuk memeriksa, membersihkan, atau menilai kembali tandon yang tercemar.',
      source: 'https://www.cdc.gov/water-emergency/communication-resources/fact-sheet-cleaning-and-disinfecting-water-cisterns-after-floods-and-heavy-rains-1.html',
      sourceLabel: 'CDC · Tandon setelah banjir'
    },
    {
      id: 'odor', label: 'Bau', question: 'Ada bau yang tidak biasa?',
      intro: 'Perhatikan apakah bau tercium saat membuka keran seperti biasa. Hindari mendekatkan wajah atau mencicipi air.',
      yes: 'Ada bau',
      pipe: 'M72 0 V5 Q72 9 67 9 H17 Q10 9 10 16 V75 Q10 82 17 82 H24 Q30 82 30 89 V100',
      mobilePipe: 'M96 0 V4 Q96 10 91 10 H9 Q4 10 4 16 V100',
      action: 'Gunakan sumber air yang sudah dipastikan layak untuk minum dan memasak. Jika tercium bau bensin, pelarut, atau bahan kimia, hentikan semua penggunaan air tandon dan hubungi puskesmas.',
      detail: 'Catat jenis bau dan kapan mulai tercium. Sampaikan jika ada kemungkinan bahan kimia masuk. Merebus atau memberi disinfektan tidak dapat membuat air yang tercemar bahan kimia berbahaya menjadi layak digunakan.',
      source: 'https://www.cdc.gov/water-emergency/about/',
      sourceLabel: 'CDC · Dugaan pencemaran bahan kimia'
    },
    {
      id: 'color', label: 'Warna', question: 'Apakah air tampak berwarna?',
      intro: 'Jika tidak ada dugaan bahan kimia, lihat air dari keran di gelas bening dengan latar putih. Perhatikan warna kuning, cokelat seperti karat, atau warna lain.',
      yes: 'Air tampak berwarna',
      pipe: 'M30 0 V5 Q30 10 36 10 H86 Q92 10 92 17 V68 Q92 74 93 77 Q94 80 94 85 V100',
      mobilePipe: 'M4 0 V5 Q4 11 9 11 H91 Q96 11 96 17 V100',
      action: 'Gunakan sumber air yang sudah dipastikan layak untuk minum dan memasak sambil mencari tahu penyebab perubahan warna.',
      detail: 'Catat warnanya dan apakah perubahan muncul di satu keran atau beberapa keran. Warna kuning atau cokelat bisa terkait endapan atau pipa. Minta petugas puskesmas membantu menentukan pemeriksaan yang sesuai.',
      source: 'https://www.portland.gov/water/drinking-water-quality/troubleshooting-drinking-water-quality-home/discolored-water',
      sourceLabel: 'Portland Water Bureau · Perubahan warna air'
    },
    {
      id: 'turbid', label: 'Kekeruhan', question: 'Air keruh atau ada partikel?',
      intro: 'Lihat apakah air tampak berkabut atau ada butiran, serpihan, atau endapan di dasar gelas.',
      yes: 'Keruh atau ada partikel',
      pipe: 'M94 0 V4 Q94 10 88 10 H16 Q10 10 10 17 V72 Q10 80 17 80 H26 Q32 80 32 88 V100',
      mobilePipe: 'M96 0 V4 Q96 10 91 10 H9 Q4 10 4 16 V100',
      action: 'Gunakan sumber air yang sudah dipastikan layak untuk minum dan memasak sampai kondisi air diperiksa.',
      detail: 'Catat apa yang terlihat dan kapan mulai muncul, misalnya setelah hujan. Sampaikan temuan ke petugas puskesmas agar bisa menilai sumber air, kondisi tandon, dan kebutuhan pengujian.',
      source: 'https://www.cdc.gov/drinking-water/about/collecting-rainwater-and-your-health-an-overview.html',
      sourceLabel: 'CDC · Air hujan tampungan dan kesehatan'
    }
  ];
  const checkbox = (key, label, selected, attribute) => `<label class="checkline"><input type="checkbox" value="${key}"
    ${attribute} ${selected ? 'checked' : ''} /><span>${esc(label)}</span></label>`;
  const checkItem = key => checkbox(key, sanitary[key][0], previous.checked.includes(key), 'data-sanitary');
  const reviewItem = key => checkbox(key, sanitary[key][0], previous.checked.includes(key), 'data-review-item');
  const options = choices => Object.entries(choices).map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join('');
  const pipeMarkup = (route, mobile = false) => `<svg class="quality-pipe${mobile ? ' quality-pipe-mobile' : ''}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path class="quality-pipe-outline" d="${route}" vector-effect="non-scaling-stroke" />
    <path class="quality-pipe-body" d="${route}" vector-effect="non-scaling-stroke" />
    <path class="quality-pipe-glint" d="${route}" vector-effect="non-scaling-stroke" />
    <path class="quality-pipe-water" d="${route}" vector-effect="non-scaling-stroke" />
    <path class="quality-pipe-bubbles" d="${route}" vector-effect="non-scaling-stroke" />
    <path class="quality-pipe-foam" d="${route}" vector-effect="non-scaling-stroke" />
  </svg>`;
  const issueButton = issue => `<button type="button" class="section-link quality-issue" data-issue="${issue.id}" aria-haspopup="dialog" aria-controls="quality-action-${issue.id}" aria-expanded="false">${issue.yes}</button>`;
  const issueDialog = issue => `
    <dialog class="quality-action" id="quality-action-${issue.id}" aria-labelledby="quality-action-title-${issue.id}">
      <button type="button" class="quality-action-close" aria-label="Tutup panduan">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
      <div class="quality-action-body">
        <p class="quality-action-label">${issue.label}</p>
        <h3 id="quality-action-title-${issue.id}" tabindex="-1" autofocus>Yang perlu dilakukan sekarang</h3>
        <p class="quality-action-lead">${issue.action}</p>
        <p>${issue.detail}</p>
        <p><a href="${issue.source}">${issue.sourceLabel}</a></p>
        ${issue.id === 'tank' ? `<fieldset class="checklist quality-tank-checks">
          <legend class="ctrl-label">Apa yang Anda temukan?</legend>
          ${tankChecks.slice(0,3).map(checkItem).join('')}
          <details class="quality-source-extra"><summary>Periksa kasa tandon</summary>${checkItem('S06')}</details>
        </fieldset>` : ''}
      </div>
    </dialog>`;
  const sourceControls = `
    <div class="control quality-source-control">
      <label class="ctrl-label" for="quality-source">Air ini berasal dari mana?</label>
      <select id="quality-source" name="water-source">
        <option value="">Pilih sumber air</option>
        ${options(waterSources)}
      </select>
      <fieldset class="checklist quality-roof-checks" id="quality-roof-checks" aria-labelledby="quality-roof-title" hidden disabled>
        <p class="ctrl-label quality-roof-title" id="quality-roof-title">Periksa atap, talang, dan pengalih hujan</p>
        ${roofItems.map(checkItem).join('')}
      </fieldset>
    </div>`;
  const stageMarkup = (stage, index) => `
    <section class="quality-stage" id="quality-${stage.id}" aria-labelledby="quality-heading-${stage.id}">
      ${qualitySceneArt(stage.id)}
      ${pipeMarkup(stage.pipe)}
      ${pipeMarkup(stage.mobilePipe, true)}
      <span class="quality-pipe-stem" aria-hidden="true"><span class="quality-pipe-stem-foam"></span></span>
      <div class="quality-stage-copy">
        ${index === 0 ? '<h1>Cek Kondisi Air Tandon</h1><p>Gulir ke bawah untuk mengikuti aliran air. Jika menemukan masalah, pilih tombol pada tahap itu.</p>' : ''}
        <p class="quality-stage-label">${stage.label}</p>
        <h2 id="quality-heading-${stage.id}">${stage.question}</h2>
        <p>${stage.intro}</p>
        <div class="quality-issue-row">${issueButton(stage)}</div>
        ${stage.id === 'tank' ? `<div class="quality-issue-row quality-chemical-shortcut">${issueButton(chemistry)}</div>${sourceControls}` : ''}
      </div>
      ${issueDialog(stage)}
      ${stage.id === 'tank' ? issueDialog(chemistry) : ''}
    </section>`;
  controls.innerHTML = `<form id="quality-form">
    <div class="quality-trail">
      ${stages.map(stageMarkup).join('')}
      <section class="quality-stage quality-purpose" id="quality-purpose" aria-labelledby="quality-heading-purpose">
        <div class="quality-purpose-scene">
          ${qualitySceneArt('purpose')}
          ${pipeMarkup('M32 0 V4 Q32 10 38 10 H62 Q68.3 10 68.3 17 V23.6')}
          ${pipeMarkup('M4 0 V6 Q4 12 10 12 H55 Q61 12 61 19 V23.6', true)}
          <div class="quality-stage-copy">
            <p class="quality-stage-label">Tujuan penggunaan</p>
            <h2 id="quality-heading-purpose">Untuk apa air akan dipakai?</h2>
            <p>Air yang jernih dan tidak berbau tetap perlu diperiksa sebelum dipakai untuk minum atau memasak.</p>
            <div class="control">
              <label class="ctrl-label" for="use">Penggunaan air</label>
              <select id="use" required><option value="">Pilih penggunaan air</option>
              ${options(uses)}</select>
            </div>
            <div class="control">
              <label class="ctrl-label" for="quality-withdrawal">Bagaimana air diambil dari tandon?</label>
              <select id="quality-withdrawal"><option value="">Pilih cara mengambil air</option>
                ${options({tap: 'Lewat keran atau saluran keluar', dipped: 'Gayung atau wadah dicelupkan', unknown: 'Cara lain atau tidak tahu'})}
              </select>
            </div>
            <details class="advanced-controls control" id="quality-settings">
              <summary>Perawatan dan hasil uji</summary>
              ${checkItem('S09')}
              <div class="control"><label class="ctrl-label" for="lab-status">Status laporan laboratorium</label>
                <select id="lab-status"><option value="none">Belum ada laporan</option>
                  <option value="incomplete">Ada laporan, panel belum lengkap</option>
                  <option value="complete">Panel lengkap, perlu tinjauan</option></select>
              </div>
              <div class="control"><label class="ctrl-label" for="quality-demand">Skenario kebutuhan Kesling</label>
                <select id="quality-demand">${st.demandScenarios.map(row => `<option value="${esc(row.scenario_id)}">${esc(row.label)}</option>`).join('')}</select>
              </div>
            </details>
          </div>
        </div>
        <section class="quality-review" id="quality-review" aria-label="Tinjau temuan Anda">
          <div class="quality-review-groups">
            <fieldset class="checklist">
              <legend class="ctrl-label">Kondisi air dan tandon</legend>
              ${stages.map(({id, yes}) => checkbox(id, yes, previous.observed?.includes(id), 'data-review-item')).join('')}
              ${reviewItem('chem')}
            </fieldset>
            <fieldset class="checklist">
              <legend class="ctrl-label">Rincian tandon dan perawatan</legend>
              ${[...tankChecks, 'S08', 'S09'].map(reviewItem).join('')}
            </fieldset>
            <fieldset class="checklist" id="quality-review-roof" hidden disabled>
              <legend class="ctrl-label">Atap, talang, dan pengalih hujan</legend>
              ${roofItems.map(reviewItem).join('')}
            </fieldset>
          </div>
          <button class="primary quality-submit" type="submit">Lihat rekomendasi</button>
        </section>
      </section>
    </div>
  </form>`;
  $('#use').value = previous.use;
  $('#quality-demand').value = previous.scenario;
  $('#lab-status').value = previous.lab;
  const form = $('#quality-form');
  const source = $('#quality-source');
  const roofChecks = $('#quality-roof-checks');
  const roofReview = $('#quality-review-roof');
  const withdrawal = $('#quality-withdrawal');
  const reviewItems = new Map(Array.from(form.querySelectorAll('[data-review-item]'), item => [item.value, item]));
  const stageChecks = new Map(Array.from(form.querySelectorAll('[data-sanitary]'), item => [item.value, item]));
  source.value = previous.source ?? '';
  withdrawal.value = previous.withdrawal ?? (previous.checked.includes('S08') ? 'dipped' : '');
  reviewItems.get('S08').checked = withdrawal.value === 'dipped';
  function syncRoofChecks() {
    const inactive = source.value !== 'rain';
    roofChecks.hidden = roofChecks.disabled = inactive;
    roofReview.hidden = roofReview.disabled = inactive;
  }
  syncRoofChecks();
  startQualityPipeFlow(form);
  const narrowGuide = window.matchMedia('(max-width: 760px)');
  const moveTo = element => {
    element.focus({preventScroll: true});
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth', block: 'start'});
  };
  function saveInput(submitted = false) {
    const checked = Array.from(form.querySelectorAll('[data-review-item]:checked:enabled'), item => item.value)
      .filter(key => Object.hasOwn(sanitary, key));
    st.qualityInput = {
      use: $('#use').value, scenario: $('#quality-demand').value, lab: $('#lab-status').value,
      source: source.value, withdrawal: withdrawal.value, checked,
      observed: stages.filter(({id}) => reviewItems.get(id).checked).map(({id}) => id), submitted
    };
    return st.qualityInput;
  }
  [...stages, chemistry].forEach(({id}) => {
    const dialog = $(`#quality-action-${id}`);
    const trigger = form.querySelector(`[data-issue="${id}"]`);
    const item = reviewItems.get(id);
    trigger.onclick = () => {
      if (dialog.open) {
        dialog.close();
        return;
      }
      form.querySelector('.quality-action[open]')?.close();
      if (!item.checked) {
        item.checked = true;
        saveInput();
        details.innerHTML = '';
      }
      trigger.focus({preventScroll:true});
      if (narrowGuide.matches) {
        dialog.show();
        dialog.scrollIntoView({block:'nearest'});
      } else {
        dialog.showModal();
      }
      trigger.setAttribute('aria-expanded', 'true');
    };
    dialog.onclose = () => {
      trigger.setAttribute('aria-expanded', String(dialog.open));
      if (!dialog.open && narrowGuide.matches && document.activeElement === trigger) {
        trigger.scrollIntoView({block:'nearest'});
      }
    };
    dialog.onkeydown = event => {
      if (event.key === 'Escape' && !dialog.matches(':modal')) dialog.close();
    };
    dialog.querySelector('.quality-action-close').onclick = () => dialog.close();
    dialog.onclick = event => {
      if (event.target === dialog) dialog.close();
    };
  });
  function assess() {
    const input = saveInput(true);
    const has = item => input.checked.includes(item);
    const observed = item => input.observed.includes(item);
    const tankIssue = observed('tank') && !tankChecks.some(has);
    const findingsByStage = stages.filter(({id}) => id === 'tank' ? tankIssue : observed(id));
    const assessment = assessWaterQuality({
      intended_use: input.use, has_lab_report: input.lab !== 'none', lab_complete: input.lab === 'complete',
      sanitary_flags: {
        animal_droppings: has('S01'), unknown_roof_material: has('S02'), uncovered_tank: has('S05'),
        chemical_suspected: has('chem'), turbid: observed('turbid')
      }
    });
    const scenario = st.demandScenarios.find(row => row.scenario_id === input.scenario);
    const status = assessment.approval_status === 'NEEDS_QUALIFIED_REVIEW'
      ? 'Perlu tinjauan ahli' : 'Belum terverifikasi';
    const suggestedControls = new Set(assessment.candidate_controls);
    if (has('S04')) suggestedControls.add('FIRST_FLUSH');
    const unusualWater = observed('odor') || observed('color');
    const odorTreatment = observed('odor') && st.treatments.find(row => row.technology_id === 'GAC');
    const technologies = st.treatments.filter(row => suggestedControls.has(row.technology_id));
    const list = items => items.length
      ? `<ul class="evidence-list">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '';
    metrics.innerHTML = '';
    const assessmentMetrics = card('Status kualitas', status, 'Mutu air memerlukan verifikasi') +
      card('Temuan terpilih', fmt(input.checked.length + findingsByStage.length), 'Gejala dan kondisi sarana') +
      card('Opsi pengendalian', fmt(technologies.length), 'Perlu ditinjau sesuai kondisi') +
      card('Kebutuhan skenario', fmt(scenario.liters_per_person_per_day) + ' L/orang/hari', scenario.label);
    const symptomInfrastructure = input.source === 'rain' ? 'sumber air, atap, talang, dan tandon' : 'sumber air dan tandon';
    const symptomReview = unusualWater
      ? panel('Pemeriksaan bau atau perubahan warna',
        `<p>Catat kapan gejala mulai muncul dan periksa kondisi ${symptomInfrastructure}. Bau atau warna saja belum cukup untuk menentukan penyebabnya.</p>` +
        '<p>Sampaikan temuan kepada petugas kesehatan lingkungan untuk menentukan uji yang sesuai. Untuk minum atau memasak, gunakan sumber yang sudah terverifikasi sambil menunggu pemeriksaan.</p>' +
        (odorTreatment ? mini('Opsi bersyarat setelah identifikasi sumber', odorTreatment.technology) +
          mini('Prasyarat', odorTreatment.prerequisite) + mini('Keterbatasan', odorTreatment.limitation) : ''),
        true)
      : '';
    const findings = list(assessment.risk_flags.map(key => riskLabels[key]));
    const findingsPanel = findings ? panel('Risiko yang perlu diperiksa', findings) : '';
    const potable = input.use === 'DRINKING' || input.use === 'COOKING';
    let nextStep = potable
      ? 'Pakai air dari sumber yang sudah dipastikan layak untuk minum atau memasak sambil menunggu pemeriksaan.'
      : 'Tanyakan ke puskesmas apakah air tandon dapat dipakai untuk tujuan ini berdasarkan sumber dan hasil pemeriksaan.';
    const priority = ['chem', 'dirty_water'].find(has);
    if (priority) nextStep = sanitary[priority][1];
    else if (input.checked.length || findingsByStage.length) {
      nextStep = 'Gunakan sumber air yang sudah dipastikan layak untuk minum dan memasak sambil menunggu pemeriksaan.';
    }
    const symptomFollowUps = {
      tank: ['Masalah pada tandon', 'Periksa bagian tandon yang bermasalah dan sampaikan temuan kepada petugas.'],
      odor: ['Bau tidak biasa', 'Catat jenis bau dan kapan mulai tercium.'],
      color: ['Perubahan warna air', 'Catat warna dan apakah perubahan muncul pada lebih dari satu keran.'],
      turbid: ['Air keruh atau berpartikel', 'Catat partikel yang terlihat dan kapan mulai muncul.']
    };
    const followUps = [...input.checked.filter(key => key !== priority).map(key => sanitary[key]),
      ...findingsByStage.map(stage => symptomFollowUps[stage.id])];
    const ask = 'Sampaikan perubahan yang Anda temui dan tujuan penggunaan air ke petugas kesehatan lingkungan di puskesmas.';
    details.innerHTML = panel('Langkah berikutnya',
      `<div id="quality-next" tabindex="-1">
        ${priority ? `<p><strong>${esc(sanitary[priority][0])}</strong></p>` : ''}
        <p>${esc(nextStep)}</p>
        ${followUps.length ? `<h4>Temuan dan tindak lanjut</h4>${list(followUps.map(([label, action]) => `${label}. ${action}`))}` : ''}
        <p>${ask}</p><p>Status pemeriksaan: ${status}.</p>
      </div>`, true) +
      `<details class="advanced-controls technical-results"><summary>Lihat rincian pemeriksaan dan opsi pengolahan</summary>
      <div class="metrics">${assessmentMetrics}</div><div class="details">${symptomReview + findingsPanel +
      panel('Pemeriksaan untuk tujuan penggunaan',
        `<p>Tujuan yang dipilih: ${esc(uses[input.use])}.</p>` +
        list(assessment.required_verification.map(key => verificationLabels[key]))) +
      panel('Skenario kebutuhan Kesling', `<p>${esc(scenario.application)}</p><p>${esc(scenario.caution)}</p>`, true) +
      panel('Opsi pengendalian dan pengolahan', technologies.map(row => `<details class="treatment">
        <summary>${esc(row.technology)}</summary>
        ${mini('Bahaya sasaran', row.target_hazard)}
        ${mini('Mekanisme', row.mechanism)}${mini('Prasyarat', row.prerequisite)}
        ${mini('Operasi dan pemeriksaan', row.operation_requirement)}${mini('Keterbatasan', row.limitation)}
      </details>`).join(''), true)}</div></details>`;
  }
  form.onchange = event => {
    const item = event.target;
    if (item === source) syncRoofChecks();
    if (item === withdrawal) reviewItems.get('S08').checked = withdrawal.value === 'dipped';
    if (item.matches('[data-sanitary]')) reviewItems.get(item.value).checked = item.checked;
    if (item.matches('[data-review-item]')) {
      const stageCheck = stageChecks.get(item.value);
      if (stageCheck) stageCheck.checked = item.checked;
      if (item.value === 'S08') withdrawal.value = item.checked ? 'dipped' : '';
    }
    saveInput();
    details.innerHTML = '';
  };
  form.onsubmit = event => {
    event.preventDefault();
    assess();
    moveTo($('#quality-next'));
  };
  metrics.innerHTML = '';
  details.innerHTML = '';
  if (previous.submitted && previous.use) assess();
}
