> **PEMBARUAN v6:** Modul distribusi dalam dokumen ini mungkin masih merujuk hasil awal 11+3 titik garis lurus. **Acuan terkini adalah `docs/NETWORK_FINAL_FINDINGS_v6.md` dan `docs/NETWORK_TO_SI_CONTRACT_v6.md`: 30 pusat OSM, cakupan 87,78%, target 95% belum tercapai.**

# API & DATA CONTRACT v3 (otoritatif untuk SI)

## A. Aset statis / frontend
Base public assets: file dalam `public/` disajikan pada `/` oleh frontend.

| URL contoh | Tipe | Keperluan |
|---|---|---|
| `/data/metadata.json` | JSON | angka kanonik, status bukti |
| `/data/katongan_boundary.geojson` | Polygon EPSG:4326 | batas analisis |
| `/data/katongan_buildings_rwh.geojson` | 3.583 polygons | RWH & RC switch |
| `/data/distribution/proposed_site_search_centres_11.geojson` | 11 points | usulan titik utama |
| `/data/distribution/phase2_supplementary_centres.geojson` | 3 points | skenario tambahan |
| `/data/distribution/site_150m_search_areas.geojson` | 11 polygons | zona pencarian, bukan lahan layak |
| `/data/distribution/scenario_500m_radius_circles.geojson` | 11 buffers | cakupan garis lurus |
| `/data/distribution/building_to_site_assignment_points.geojson` | 3.583 points | assignment skenario 11 |
| `/data/distribution/phase2_building_assignments.geojson` | 3.583 points | assignment skenario 14 |
| `/data/distribution/scenario_site_count_comparison.csv` | CSV | kurva tradeoff metode dan jumlah titik |
| `/data/distribution/model_summary.json` | JSON | parameter pencarian & disclaimer |

**Kunci gabung:** fitur RWH `properties.id` = assignment `properties.full_plus_code` (Open Buildings plus-code); tempatkan data dengan keyed index, bukan asumsi urutan fitur. **Point Koordinat:** GeoJSON [longitude, latitude] EPSG:4326. Radius 500 m dihitung pada proyeksi metrik di tahap model, bukan derajat GPS.

**RWH attributes:** `id`, `area_m2`, `confidence`, `rain_mm_annual`, `rwh_rc70_m3yr`, `rwh_rc80_m3yr`, `rwh_rc84_m3yr`, `rwh_rc90_m3yr`, `validation`. RC = sensitivitas, bukan class jenis atap. GeoJSON RWH sudah hasil per-piksel native grid CHIRPS.

**Prospective point attributes:** `site_id` dan `location_status = MODEL_SEARCH_CENTER_UNVERIFIED` (atau supplementary). Jangan mengubahnya menjadi `VERIFIED` tanpa bukti berkoordinat dan kelayakan jalan/lahan/suplai.

**Table data lainnya:** `data/katongan_annual_rain_1996_2025.csv`, `data/katongan_monthly_spi_1996_2025.csv`, `data/katongan_cdd_sensitivity.csv`, `data/katongan_daily_rain_1996_2025.csv`, `data/kesling/*`.

## B. Engine yang tersedia (Node/CommonJS, adaptasi import bila proyek memakai TypeScript ESM)
- `src/demand.js` → `householdDemand(persons, litersPerPersonPerDay)`.
- `src/yas.js` → `simulateYAS(rainRows,{roof_m2,rc,demand_lpd,tank_l})`.
- `src/yas_first_flush.js` → `simulateYASWithFirstFlush(rainRows,scenario,firstFlush)`; OFF sebagai default, parameter sensitivity only.
- `src/quality_rules.js` → `assessWaterQuality({intended_use,has_lab_report,lab_complete,sanitary_flags})`; selalu noncertifying.
- `src/distribution_readiness.js` → **legacy optional**, validasi kelengkapan input untuk pembanding bantuan eksisting, BUKAN solver titik baru.

## C. Suggested endpoints (hanya spesifikasi, backend BELUM dibuat)
- `GET /api/v1/metadata`
- `GET /api/v1/buildings?bbox=...&minConfidence=0.70&rc=0.80`
- `GET /api/v1/climate/{annual,spi,cdd}`
- `POST /api/v1/rwh/yas`: `{roof_m2,rc,demand_lpd,tank_l,first_flush?}`
- `POST /api/v1/demand`: `{persons,demand_lpcd}`
- `POST /api/v1/water-quality/assessment`: lihat `schemas/quality_decision_contract.json`.
- `GET /api/v1/prospective-sites?scenario=base11|base11_plus3`: return lokasi+assignment yang sesuai.
- `GET /api/v1/prospective-sites/model-comparison`: return `scenario_site_count_comparison.csv`.
- `GET /api/v1/historical-aid-evidence`: Klegung/Perbutan wilayah tanpa koordinat bak.

## D. Units & error semantics
- Curah hujan annual mm/tahun, daily mm/hari, tapak m², RWH tahunan m³/tahun, simulasi L/hari dan tank L; hindari 100 L/hari/rumah disamakan dengan 100 L/orang/hari.
- Error 400 invalid numeric; 422 input tidak lengkap; 200 `NOT_VERIFIED` untuk rekomendasi Kesling bukan persetujuan kesehatan.
- Pemodelan lokasi statis v1 **EUCLIDEAN_HEURISTIC_NO_ROADS**; tidak boleh klaim 500 m jalan kaki atau waktu tempuh truk.
- Jika pengguna ingin rerun dengan jumlah lokasi/radius/penduduk berbeda: gunakan notebook/Python di `reproduce` lalu impor hasil **versi baru**, jangan mengubah label data hardcoded tanpa recalculation.
