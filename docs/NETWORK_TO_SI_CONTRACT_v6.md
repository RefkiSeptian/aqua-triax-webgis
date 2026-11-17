# Kontrak WebGIS — Jaringan OSM (v6)

## Source of truth
- `WEBGIS_READY/data/network_summary.json`: total titik dan cakupan; `validation_status` wajib tetap `NETWORK_ANALYSIS_ONLY_NOT_OPERATIONAL_SITING`.
- `WEBGIS_READY/data/network_sites.geojson`: 30 lokasi simpul OSM untuk pencarian tapak; kunci `site_id` format `NET-S01...NET-S30`. `longitude`/`latitude` adalah WGS84.
- `WEBGIS_READY/data/network_assignments.geojson`: 3.583 centroid, `building_id`, `assigned_network_site`, `distance_network_plus_access_m` (null jika tidak tersambung), `covered_500m_network` (boolean), `building_road_access_connector_m`, `building_walk_road_nearby`.
- `WEBGIS_READY/data/network_roads_walk.geojson` dan `network_roads_drive.geojson`: graf OSM hasil ekstraksi, bukan hasil survei jalan.
- `NETWORK_OSM/results/network_greedy_coverage_curve.csv`: jumlah situs vs cakupan, p=1..30.
- `VALIDATION_AND_FIELD_GATES/SITE_VERIFICATION_REGISTER_NETWORK_30.csv`: inspeksi lapangan masih kosong, JANGAN isi otomatis dari node OSM.

## Aturan UI/API
1. **Default** = `network`; Euclidean 11/14 = pembanding historis model, tidak dipakai untuk headline validasi akses.
2. KPI network: `selected_site_count=30`, `n_covered_500m_network_plus_access=3145`, `N_building_footprint_proxies=3583`, `coverage_network_pct=87.775607...`, `target_reached=false`.
3. Marker tidak terlayani dibedakan: 418 `building_walk_road_nearby=false` dan 20 `building_walk_road_nearby=true, covered_500m_network=false`.
4. Popup lokasi menunjukkan `assigned_buildings`, `covered_within_500m_network_plus_connectors`, `screening_demand_L_day` beserta status `candidate_status`. Labeli sebagai usulan/area pencarian, bukan lokasi bak telah terpasang.
5. JANGAN menggambar garis langsung titik-bangunan sebagai rute jalan; jarak tersimpan merupakan scalar shortest-path pada graf.
6. Jangan laporkan ketepatan dan jarak akses kendaraan, waktu tempuh truk, atau penghematan ongkos tanpa sumber/depot dan jaringan yang diuji.
7. CRS semua GeoJSON EPSG:4326 (lon/lat). Analisis metrik sebelumnya EPSG:32749.
8. Indikator 500 m: jarak graf jalan kaki + connector lurus (dua sisi). Connector bukan bukti hak melintas atau jalur aktual.

## Acceptance checks
- 30 situs, 3.583 assignment, 4.740 walk edges, 4.461 drive edges.
- `sum(covered_500m_network)=3145` dan `count(uncovered)=438`.
- `sum(site.covered_within_500m_network_plus_connectors)=3145` dan `sum(site.assigned_buildings)=3160`.
- Jumlah geografis semua 30 titik harus berada pada polygon Katongan AOI.
- Browser pada tab distribusi langsung default `Jaringan OSM` dan menampilkan **BELUM** mencapai 95%.
- Mode 11/14 tetap tersedia, **tertulis hanya skenario garis lurus**.
