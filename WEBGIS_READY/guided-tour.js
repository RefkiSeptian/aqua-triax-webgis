'use strict';

// Coachmarks explain the real controls without changing layers or form values.
const guidedTour = (() => {
  const find = selector => document.querySelector(selector);
  const visible = element => element && element.getClientRects().length > 0;
  const layerTarget = () => visible(find('#rwh-tool-panel')) && st.rwhMapTool === 'layers'
    ? find('#rwh-tool-panel') : find('[data-map-tool="layers"]');
  const steps = [
    {
      title: 'Kenali Dashboard AQUA TRIAX',
      text: 'Ikuti tur singkat dari ringkasan wilayah sampai panduan cek air. Anda bisa mencoba bagian yang disorot, melanjutkan tanpa mencobanya, atau keluar kapan saja.'
    },
    {
      title: 'Mulai dari ringkasan wilayah',
      prepare: () => setDashboardSidebar(true),
      text: 'Lihat potensi tangkapan air hujan, jumlah bangunan, rata-rata hujan, dan cakupan acuan. Angka ini merangkum wilayah kajian; nilainya tidak mengikuti layer yang Anda nyalakan.',
      target: () => find('#dashboard-summary-content')
    },
    {
      title: 'Baca pola hujan',
      prepare: () => setDashboardSidebar(true),
      text: 'Grafik sudah tampil di panel kiri. Pilih indikator untuk melihat pola bulanan, perubahan per tahun, indeks hujan, atau hari kering. Ini data historis, bukan prakiraan cuaca.',
      target: () => find('.dashboard-data-basis')
    },
    {
      title: 'Pilih layer dan wilayah',
      prepare: () => setDashboardSidebar(false),
      text: 'Ketuk ikon tumpukan layer di kanan peta. Centang data yang ingin dilihat. Pada Batas administrasi, pilih wilayah berurutan dari provinsi sampai kalurahan. Data yang tersedia saat ini adalah Katongan.',
      target: layerTarget
    },
    {
      title: 'Ketuk bangunan di peta',
      text: 'Perbesar peta, lalu ketuk bangunan yang Anda kenali. Panelnya menampilkan luas atap, perkiraan tangkapan air hujan, dan dasar perhitungan. Cocokkan warna bangunan dengan legenda di kiri bawah.',
      target: () => visible(find('#rwh-building')) ? find('#rwh-building') : find('#map')
    },
    {
      title: 'Coba kalkulator tandon',
      text: 'Ketuk ikon kalkulator di kanan peta. Masukkan luas atap, jumlah penghuni, dan ukuran tandon untuk menghitung kecukupan air. Jika bangunan sudah dipilih, luas atapnya terisi dari peta. Hasilnya merupakan perkiraan.',
      target: () => visible(find('#rwh-building')) && st.quickTank
        ? find('#rwh-building') : find('#rwh-open-tank')
    },
    {
      title: 'Lihat bantuan dan cakupannya',
      text: 'Buka layer peta untuk menyalakan Lokasi bantuan air atau Zona cakupan distribusi air. Lokasi bantuan menunjukkan riwayat penyaluran. Lingkaran cakupan adalah simulasi radius 500 meter dari calon titik penyaluran.',
      target: layerTarget
    },
    {
      title: 'Lanjutkan ke Cek Kondisi Air',
      text: 'Pilih Cek Kondisi Air di navbar untuk mengikuti pemeriksaan dari tandon sampai penggunaan air. Catat masalah yang ditemukan, tinjau kembali checklist, lalu lihat rekomendasinya. Tur ini bisa diulang lewat Mulai tur di Dashboard.',
      target: () => find('.main-tabs [data-tab="quality"]')
    }
  ];

  let index = -1;
  let frame = 0;
  let lastTarget;
  let root;
  let card;
  let previousFocus;
  let observer;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function enable() {
    const start = find('#dashboard-start-tour');
    start.disabled = false;
    start.onclick = begin;
  }

  function mount() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'guided-tour';
    root.hidden = true;
    root.innerHTML = `
      <div class="tour-shade" data-side="top"></div>
      <div class="tour-shade" data-side="right"></div>
      <div class="tour-shade" data-side="bottom"></div>
      <div class="tour-shade" data-side="left"></div>
      <div class="tour-spotlight" aria-hidden="true"></div>
      <section class="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-description">
        <div class="tour-progress" role="progressbar" aria-label="Kemajuan tur" aria-valuemin="1" aria-valuemax="${steps.length}"><span></span></div>
        <button class="tour-close" type="button" aria-label="Tutup tur">×</button>
        <p class="tour-step"></p>
        <h2 id="tour-title" tabindex="-1"></h2>
        <p id="tour-description"></p>
        <div class="tour-navigation">
          <button class="tour-back" type="button">Kembali</button>
          <button class="tour-next" type="button">Mulai</button>
        </div>
        <p class="tour-keyboard"><kbd>←</kbd> <kbd>→</kbd> pindah langkah <span>·</span> <kbd>Esc</kbd> keluar</p>
      </section>`;
    document.body.append(root);
    card = root.querySelector('.tour-card');
    root.querySelector('.tour-close').onclick = () => close();
    root.querySelector('.tour-back').onclick = () => show(index - 1);
    root.querySelector('.tour-next').onclick = () => index === steps.length - 1 ? close() : show(index + 1);
  }

  function begin() {
    if (st.tab !== 'rwh' || index !== -1) return;
    mount();
    previousFocus = document.activeElement;
    root.hidden = false;
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    document.addEventListener('keydown', onKey, true);
    observer = new MutationObserver(schedule);
    for (const selector of ['#rwh-tool-panel', '#rwh-building']) {
      observer.observe(find(selector), {attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true});
    }
    show(0);
  }

  function show(next) {
    if (next < 0 || next >= steps.length) return;
    index = next;
    const step = steps[index];
    step.prepare?.();
    root.querySelector('.tour-step').textContent = `Langkah ${index + 1} dari ${steps.length}`;
    find('#tour-title').textContent = step.title;
    find('#tour-description').textContent = step.text;
    root.querySelector('.tour-back').disabled = index === 0;
    root.querySelector('.tour-next').textContent = index === 0 ? 'Mulai' : index === steps.length - 1 ? 'Selesai' : 'Lanjut';
    const progress = root.querySelector('.tour-progress');
    progress.setAttribute('aria-valuenow', index + 1);
    progress.firstElementChild.style.width = `${(index + 1) / steps.length * 100}%`;
    lastTarget = step.target?.();
    if (visible(lastTarget)) {
      const bounds = lastTarget.getBoundingClientRect();
      const navBottom = find('.masthead').getBoundingClientRect().bottom;
      if (bounds.top < navBottom + 20 || bounds.bottom > innerHeight - 20) {
        lastTarget.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
      }
    }
    place();
    find('#tour-title').focus({preventScroll: true});
    if (!reducedMotion.matches) card.animate([{opacity: .3, transform: 'translateY(8px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 220, easing: 'ease-out'});
  }

  function schedule() {
    if (index < 0 || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; place(); });
  }

  function place() {
    if (index < 0) return;
    const margin = 16;
    const width = innerWidth;
    const height = innerHeight;
    const target = steps[index].target?.();
    const bounds = visible(target) ? target.getBoundingClientRect() : null;
    // Clip the spotlight to the viewport when a tall map/panel extends offscreen.
    const box = bounds ? {
      left: Math.max(0, Math.min(width, bounds.left - 8)),
      top: Math.max(0, Math.min(height, bounds.top - 8)),
      right: Math.max(0, Math.min(width, bounds.right + 8)),
      bottom: Math.max(0, Math.min(height, bounds.bottom + 8))
    } : {left: 0, top: 0, right: 0, bottom: 0};
    const hasTarget = bounds && box.right > box.left && box.bottom > box.top;
    const rectangles = hasTarget ? {
      top: [0, 0, width, box.top],
      right: [box.right, box.top, width - box.right, box.bottom - box.top],
      bottom: [0, box.bottom, width, height - box.bottom],
      left: [0, box.top, box.left, box.bottom - box.top]
    } : {top: [0, 0, width, height], right: [0, 0, 0, 0], bottom: [0, 0, 0, 0], left: [0, 0, 0, 0]};
    for (const [side, [left, top, w, h]] of Object.entries(rectangles)) {
      Object.assign(root.querySelector(`[data-side="${side}"]`).style, {left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`});
    }
    const spotlight = root.querySelector('.tour-spotlight');
    spotlight.hidden = !hasTarget;
    Object.assign(spotlight.style, {left: `${box.left}px`, top: `${box.top}px`, width: `${box.right - box.left}px`, height: `${box.bottom - box.top}px`});

    const w = card.offsetWidth;
    const h = card.offsetHeight;
    let left = (width - w) / 2;
    let top = (height - h) / 2;
    if (hasTarget) {
      const gap = 18;
      const candidates = [
        [box.left - w - gap, box.top],
        [box.right + gap, box.top],
        [box.left, box.bottom + gap],
        [box.left, box.top - h - gap]
      ];
      const fit = candidates.find(([x, y]) => x >= margin && x + w <= width - margin && y >= margin && y + h <= height - margin);
      if (fit) [left, top] = fit;
      else {
        // Prefer below compact controls; large map targets keep the card in a corner.
        left = box.left < width / 2 ? width - w - margin : margin;
        top = box.bottom + gap + h <= height - margin ? box.bottom + gap
          : box.top - gap - h >= margin ? box.top - gap - h : height - h - margin;
      }
    }
    card.style.left = `${Math.max(margin, Math.min(width - w - margin, left))}px`;
    card.style.top = `${Math.max(margin, Math.min(height - h - margin, top))}px`;
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'ArrowLeft') show(index - 1);
      else if (index === steps.length - 1) close();
      else show(index + 1);
    }
  }

  function close(restoreFocus = true) {
    if (index < 0) return;
    index = -1;
    root.hidden = true;
    cancelAnimationFrame(frame);
    frame = 0;
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('scroll', schedule, true);
    document.removeEventListener('keydown', onKey, true);
    if (restoreFocus && visible(previousFocus)) previousFocus.focus({preventScroll: true});
  }

  return {enable, close};
})();
