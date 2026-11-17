# GIS Katongan — 13 layers (v6)

Buka `Katongan_AGC2027_all_layers.gpkg` pada QGIS/ArcGIS Pro. Semua layer EPSG:4326. Perhitungan jarak/luas memakai EPSG:32749.

## 8 layer awal (arsip komparatif dan RWH)
- `katongan_boundary` (1)
- `buildings_rwh` (3583)
- `sites_main_11` (11, skenario jarak lurus)
- `sites_extra_3` (3, skenario tambahan garis lurus)
- `site_search_150m` (11, skenario lama)
- `coverage_500m` (11, lingkaran jarak lurus; BUKAN cakupan jalan)
- `alloc_main_11` (3583, jarak lurus)
- `alloc_phase2_14` (3583, jarak lurus)

## 5 layer baru (hasil OSMnx dari unggahan Colab 9 Nov 2026)
- `osm_walk_roads` (4740 directed graph edges)
- `osm_drive_roads` (4461 directed graph edges)
- `network_sites_30` (30 kandidat pada node jalan OSM; tidak terverifikasi sebagai lahan)
- `network_assignment_3583` (3583 centroid dengan status jangkauan 500m jaringan + konektor)
- `network_screening_150m` (30 zona pencarian/inspeksi tapak, BUKAN bukti bahwa lokasi layak)

Format ESRI Shapefile tersedia di `SHAPEFILES/` (13 subfolder). Atribut SHP dipendekkan jadi maks 10 karakter; gunakan GeoPackage untuk atribut penuh.

**Jangan menggambar coverage network dari buffer 500m Euclidean; gunakan atribut `covered_500m_network` dalam `network_assignment_3583`.**

Lihat `../docs/NETWORK_FINAL_FINDINGS_v6.md` dan `../docs/NETWORK_TO_SI_CONTRACT_v6.md`.
