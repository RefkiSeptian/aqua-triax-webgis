'use strict';

function setDashboardSidebar(open, focus = false) {
  const layout = $('#dashboard-map-layout');
  const sidebar = $('#dashboard-sidebar');
  const toggle = $('#dashboard-toggle-sidebar');
  layout.dataset.sidebar = open ? 'open' : 'closed';
  sidebar.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', `${open ? 'Sembunyikan' : 'Buka'} ringkasan wilayah`);
  if (focus) $(open ? '#dashboard-summary-title' : '#dashboard-toggle-sidebar').focus({preventScroll: true});
}

function bindDashboardSidebar() {
  const layout = $('#dashboard-map-layout');
  setDashboardSidebar(!matchMedia('(max-width:760px)').matches);
  $('#dashboard-toggle-sidebar').onclick = () => setDashboardSidebar(layout.dataset.sidebar !== 'open', true);
  $('#dashboard-close-sidebar').onclick = () => setDashboardSidebar(false, true);
  $('#dashboard-sidebar').addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (CSS.supports('selector(select:open)') && event.target.closest('select:open')) return;
    event.preventDefault();
    setDashboardSidebar(false, true);
  });
  const resize = new ResizeObserver(() => {
    if (st.tab === 'rwh' && st.map) st.map.invalidateSize({animate: false, debounceMoveend: true});
  });
  resize.observe($('#rwh-map-slot'));
}

function renderDashboardSummary() {
  const region = st.boundary.features[0].properties;
  const meanRain = st.annual.reduce((sum, row) => sum + Number(row.rain_mm), 0) / st.annual.length;
  const capture = st.buildings.features.reduce((sum, {properties}) => sum + Number(properties.rwh_rc80_m3yr), 0);
  const coverage = st.summary;
  $('#dashboard-summary-context').textContent = `Luas wilayah kajian ${fmt(region.luas_ha_sumber, 1)} ha`;
  $('#dashboard-summary-content').innerHTML =
    `<div class="dashboard-lead">
      <span>Potensi tangkapan</span>
      <strong>${fmt(capture)} <small>m³/tahun</small></strong>
      <span>RC acuan 0,80</span>
    </div>
    <div class="dashboard-summary-rows">
      ${mini('Bangunan terpetakan', fmt(st.buildings.features.length))}
      ${mini('Rata-rata hujan wilayah', fmt(meanRain) + ' mm/tahun')}
      ${mini('Cakupan acuan garis lurus', fmt(coverage.coverage_500m_pct, 2) + '%')}
    </div>`;
}

function openDashboardDistribution() {
  if (st.distributionPlanning) {
    st.distributionPlanning = false;
    refreshDistribution();
  }
  const title = $('#dashboard-distribution-title');
  title.focus({preventScroll: true});
  title.scrollIntoView({block: 'start'});
}
