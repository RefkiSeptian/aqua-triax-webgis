> **PEMBARUAN v6:** Modul distribusi dalam dokumen ini mungkin masih merujuk hasil awal 11+3 titik garis lurus. **Acuan terkini adalah `docs/NETWORK_FINAL_FINDINGS_v6.md` dan `docs/NETWORK_TO_SI_CONTRACT_v6.md`: 30 pusat OSM, cakupan 87,78%, target 95% belum tercapai.**

# SCREEN SPEC v3 — WebGIS Katongan (SI)
**Prinsip visual:** profesional, mobile-responsive, data-first. Jangan membuat UI ramai dengan statistik tak fungsional. Bahasa tombol dan satuan jelas; setiap layer bisa dihidupkan/dimatikan.

## Layar 1 — Overview
- Batas Katongan; ringkasan 3.583 kandidat bangunan; luas total footprint ≈334.546 m²; RCHP RC baseline 0,80 ≈510.669 m³/tahun **teoritis**.
- Kartu cakupan distribusi skenario: 11 titik 95,84%, 11+3 titik 98,16% dalam 500 m **garis lurus**.
- Alasan penelitian, peta sumber dan label batasan data utama.

## Layar 2 — Peta RWH
- Render 3.583 poligon; klik polygon: `id`, `area_m2`, `confidence`, `rain_mm_annual`, `rwh_rcXX_m3yr`.
- Pilihan RC 0,70/0,80/0,84/0,90; slider `confidence` opsional, KPI harus mengikuti filter (bukan nilai keseluruhan saat subset).
- Legend satuan m³/tahun dan status `THEORETICAL_SCREENING`; jangan tampilkan jenis atap nyata.

## Layar 3 — Iklim & Kekeringan
- Rain annual 1996–2025, monthly SPI3/SPI6 (tampilkan NA awal, jangan menjadi nol), CDD threshold 0,5/1/2 mm.
- Sumber CHIRPS v3 dan batas resolusi/pengamatan lokal.

## Layar 4 — Simulator RWH & Kebutuhan
- Input `roof_m2` manual atau dari footprint terpilih, RC, jumlah penghuni, L/orang/hari, kapasitas tandon (L), serta first-flush (OFF default).
- Output reliabilitas waktu %, reliabilitas volume %, kekurangan, limpasan, kebutuhan musim Jul–Sep dan asumsi.
- YAS harian memakai hujan rata-rata AOI, berbeda dari peta CHIRPS piksel annual. First-flush hanya sensitivitas event-harian.

## Layar 5 — Risiko Kualitas Air & Pengolahan Adaptif
- Form tujuan air, sanitary inspection, status hasil uji lab; tampilkan bahaya potensial, teknologi kandidat, mekanisme, keterbatasan, dan pengujian.
- Output `NOT_VERIFIED` atau `NEEDS_QUALIFIED_REVIEW` saja. **Tidak ada status otomatis aman diminum, rekomendasi dosis klorin, atau klaim hasil uji aktual.**

## Layar 6 — Lokasi Calon Distribusi Air (utama)
- Layer 11 pusat model `proposed_site_search_centres_11.geojson`; opsional layer 3 tambahan `phase2_supplementary_centres.geojson`.
- Toggle **11 titik utama** / **11 utama + 3 temporer**; gunakan assignment masing-masing skenario, jangan saling mencampurkan.
- Layer 500 m **euclidean**, overlay bangunan di dalam/luar cakupan; KPI 3.434 (95,84%) atau 3.517 (98,16%); grafik p=4..16 dan perbandingan algoritma.
- Popup `site_id`, volume proksi L/hari, jumlah footprint teralokasi, status lahan/jalan/sumber = BELUM DIVERIFIKASI.
- Selalu tampilkan label `PUSAT AREA PENCARIAN HIPOTETIS`, bukan bak terpasang atau rute optimal truk.
- Pembanding eksisting Klegung/Perbutan sebagai **teks historis atau tabel**, TANPA pin koordinat dan TANPA klaim perbaikan rute.
- Tahap roadmap: OSM routable, lahan, kemiringan, sumber air, kapasitas armada, uji lokasi lapangan untuk menuju model operasional.

## QA & UX
- Loading/error/empty states, aksesibilitas keyboard dan mobile, atribusi Google Open Buildings/CHIRPS/OSM jika OSM kelak digunakan.
- Penggunaan data skenario harus jelas pada legenda, popup, judul chart, export.
- Jangan mengartikan banyaknya bangunan sebagai jumlah keluarga, jumlah warga, atau jumlah rumah penerima air.
