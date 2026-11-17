# Data dictionary — Katongan AGC 2027

## `public/data/katongan_buildings_rwh.geojson`
GeoJSON FeatureCollection dengan **3.583 polygon**; EPSG:4326 (koordinat `[longitude, latitude]`). Polygon merupakan output Google Open Buildings, bukan batas bidang atap terverifikasi.

| Properti | Tipe | Makna |
|---|---|---|
| `id` | string | ID `full_plus_code` dari Google Open Buildings. Perlakukan sebagai STRING, bukan identitas rumah tangga. |
| `area_m2` | number | `area_in_meters` pada Open Buildings. Proksi luas tangkapan proyeksi mendatar. |
| `confidence` | number | Skor model deteksi, **bukan** probabilitas akurasi lokal yang terkalibrasi. |
| `rain_mm_annual` | number | Rata-rata curah hujan tahunan piksel CHIRPS di centroid bangunan, 1996–2025. |
| `rwh_rc70_m3yr` | number | Potensi tahunan teoritis jika RC = 0,70 (m³/tahun). |
| `rwh_rc80_m3yr` | number | Potensi tahunan teoritis jika RC = 0,80 (m³/tahun). |
| `rwh_rc84_m3yr` | number | Potensi tahunan teoritis jika RC = 0,84 (m³/tahun). |
| `rwh_rc90_m3yr` | number | Potensi tahunan teoritis jika RC = 0,90 (m³/tahun). |
| `source` | string | Asal footprint. |
| `rain_method` | string | Metode assignment hujan. |
| `validation` | string | `NOT_FIELD_VERIFIED`. |

Formula: `rwh_m3yr = rain_mm_annual × area_m2 × RC / 1000`.

## `public/data/katongan_boundary.geojson`
Batas AOI studi; source/version administrasi perlu dicantumkan pada metadata final. Jangan klaim versi batas resmi sudah diverifikasi bila belum.

## `data/katongan_daily_rain_1996_2025.csv`
10.958 tanggal; kolom `date` (YYYY-MM-DD), `year`, `month`, `rain_mm` (AOI-aggregated). Ini input untuk model tandon harian YAS, **bukan** curah hujan harian piksel atap.

## `data/katongan_monthly_spi_1996_2025.csv`
360 baris; kolom `year`, `month`, `rain_mm`, `rain_3month_mm`, `SPI3`, `rain_6month_mm`, `SPI6`, `date`; beberapa nilai SPI di awal kosong karena rolling window. SPI indeks anomali hujan, bukan status bantuan air per rumah.

## `data/katongan_cdd_sensitivity.csv`
90 baris (30 tahun × 3 ambang); `year`, `threshold_mm` (0,5; 1; 2 mm/hari), `max_CDD_days`, `dry_days`. CDD berubah saat threshold diubah.

## `data/katongan_yas_scenario_matrix.csv`
45 kombinasi skenario tandon; kolom `roof_m2`, `runoff`, `demand_lpd`, `tank_l`, `time_reliability_pct`, `volume_reliability_pct`, `dry_season_time_reliability_pct`, serta indikator volume 30 tahun. Semua dibuat dengan `runoff=0.80` dan hujan AOI, bukan seluruh RC pilihan.

## `data/katongan_rwh_pixel_scenarios_source.csv`
CSV asli dari GEE berisi `id`, `area_m2`, `confidence`, `rain_mm`, empat `RCHP_RC..`, `status`; matching dengan GeoJSON melalui `id`.

## Interpretasi wajib
- **Potensi RWH tahunan teoritis ≠ ketersediaan air aktual ≠ air layak minum.**
- Atap rumah vs bangunan lain tidak dibedakan. `area_m2` tidak sama dengan luas bidang miring yang diukur lapangan.
- Nilai hujan CHIRPS tidak memiliki resolusi per atap. Banyak rumah berbagi nilai yang sama pada pikselnya.
- Tidak ada pengukuran kualitas air atau bukti material atap.
- Jangan menggabungkan distribusi bantuan air eksisting dengan hasil RWH seolah satu sistem fisik.
