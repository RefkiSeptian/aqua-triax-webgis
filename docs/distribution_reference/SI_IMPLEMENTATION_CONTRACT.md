# Kontrak integrasi — WebGIS SI (v1, scenario-only)

## Modul baru: Prospective Communal Waterpoints

**Dilarang menamai layer sebagai “titik bantuan pemerintah eksisting”, “lokasi bak terpasang”, atau “optimasi rute kendaraan”.** Semua site baru adalah pusat *area pencarian* dari model, belum diseleksi secara fisik.

| Entitas / layer | File | Geometry | Key / atribut wajib |
|---|---|---|---|
| `candidate_site_base` | `proposed_site_search_centres_11.geojson` | Point EPSG:4326 | `site_id`, `location_status`, `latitude`, `longitude`, `site_search_radius_m` |
| `site_search_area` | `site_150m_search_areas.geojson` | Polygon EPSG:4326 | `site_id`, `buffer_radius_m`, `distance_type` |
| `coverage_radius` | `scenario_500m_radius_circles.geojson` | Polygon EPSG:4326 | `site_id`, `buffer_radius_m`, `distance_type` |
| `building_assignment_base` | `building_to_site_assignment_points.geojson` | Point EPSG:4326 | `full_plus_code`, `assigned_site_id`, `distance_straight_m`, `covered_500m_straight` |
| `site_add_on` | `phase2_supplementary_centres.geojson` | Point EPSG:4326 | `site_id`, `location_status`, `additional_buildings_covered_500m` |
| `building_assignment_phase2` | `phase2_building_assignments.geojson` | Point EPSG:4326 | `full_plus_code`, `assigned_site_id_phase2`, `covered_500m_straight_phase2` |
| `scenario_comparison` | `scenario_site_count_comparison.csv` | tabular | `method`, `site_count`, `coverage_500m_pct`, `mean_straight_distance_m` |

## Recommended UX screen

1. **Prospective Waterpoints:** peta 11 pusat pencarian dan radius 500 m, layer sisa bangunan di luar radius.
2. **Skenario komparatif:** toggle `11 Base` dan `11 Base + 3 Temporer`; jangan campur assignment dua skenario.
3. **Trade-off:** grafik kurva jumlah lokasi vs cakupan dan jarak rata-rata (`max_coverage_heuristic` vs `min_mean_distance_heuristic`).
4. **Detail site:** ID, proxy allocated building count, proxy daily L, deliveries/day scenario, status ketidakpastian.
5. **Existing comparator:** hanya Klegung dan Perbutan sebagai wilayah penerima berstatus `OBSERVED_AREA_NO_EXACT_COORDS`. Tidak diberi pin sampai GPS diverifikasi.
6. **Handoff step:** tampilkan upload jalan OSM, pertanahan, medan, dan source water untuk optimasi network versi berikut.

## Acceptance checks

- `len(base_sites) == 11`; `len(addon_sites)==3`; jumlah deteksi `3583`.
- Sebanyak `3434` assignment base `covered_500m_straight == true` (95,84%).
- Sebanyak `3517` assignment fase II `covered_500m_straight_phase2 == true` (98,16%).
- Semua `site_id` unik; semua bangunan ter-assign satu site per skenario.
- `location_status` **bukan** status verifikasi lapangan.
- Jangan label “500 m berjalan kaki”, sebab input jarak lurus. Jangan hitung durasi, biaya truk, atau optimasi actual routes.
- Tampilan volume air harus berlabel `SCENARIO_50_PERCENT_AFFECTED_15_LPCD` dan sumber data 5.569 tidak diketahui tanggalnya.
- Tidak mengklaim keamanan air untuk konsumsi.
- Ada attribution Google Open Buildings bila menggunakan footprint; atribusi OSM ketika road data digunakan kemudian.

## Contract version

`prospective_point_locations_v1_euclidean_heuristic`

UI status labels: `OBSERVED_AREA_ONLY` (bukti peristiwa), `MODEL_SEARCH_CENTRE_UNVERIFIED` (usulan), `SCENARIO_DEMAND` (estimasi).

**Upgrade:** Setelah OSM road GeoJSON tersedia, bangun graph walk/drive, snap centroid rumah dan kandidat ke node/edge, tandai node yang tidak terhubung, gunakan *shortest path* pada jalan, lalu rerun model coverage / location-allocation. Perlu cek akses truk dan kapasitas site secara terpisah. Output titik boleh berubah.
