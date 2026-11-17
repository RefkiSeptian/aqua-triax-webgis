# Provenance and file index

| Data | Lokasi | Basis/validitas |
|---|---|---|
| AOI Katongan | `public/data/katongan_boundary.geojson` | Data AOI yang dipakai tim; batas legal/luas resmi perlu harmonisasi |
| Footprint + potensi RWH | `public/data/katongan_buildings_rwh.geojson` | Google Open Buildings v3 confidence≥0,70, CHIRPS v3 native pixel, empat RC scenario |
| Hujan harian | `data/katongan_daily_rain_1996_2025.csv` | CHIRPS v3 1996–2025 agregat AOI, bukan hujan rumah secara aktual |
| Curah hujan & SPI/CDD | `data/katongan_annual_rain_1996_2025.csv`, `data/katongan_monthly_spi_1996_2025.csv`, `data/katongan_cdd_sensitivity.csv` | Analisis Geografi A; tanggal & threshold ada dalam tabel |
| Simulator benchmark | `data/katongan_yas_scenario_matrix.csv` | 45 skenario hasil simulasi; reproducible via Node |
| Kesling | `data/kesling/*.csv`, `src/quality_rules.js` | Matriks literatur/skenario, no Katongan lab results |
| Titik usulan 11+3 | `public/data/distribution/*.geojson` dan `model_summary.json` | Heuristic site-search, belum diverifikasi lahan/jalan/sumber |
| Pembanding historis | `data/geoB_distribution/existing_aid_evidence_area_NO_GPS.csv` | Klegung/Perbutan sebagai area (tanpa GPS fasilitas) |
| Open Buildings + CHIRPS export asli | `reference_input/USER_Katongan_CHIRPS_and_OpenBuildings_GEE_Exports.zip` | Data user asli untuk reproduksi |
| CSV sumber RWH | `reference_input/GEE_Katongan_RCHP_RC_Sensitivity.csv` | Ekspor GEE hasil RC scenarios |
| Audit visual 40 | `reference_input/USER_VisualQA_40_records.csv` | Pilot judgment user; bukan koreksi rooftop seluruh populasi |

## Sumber eksternal utama
- CHIRPS v3: Earth Engine `UCSB-CHC/CHIRPS/V3/DAILY_RNL`
- Google Open Buildings v3: Earth Engine `GOOGLE/Research/open-buildings/v3/polygons` (atribusi data wajib saat ditampilkan)
- WHO sanitary inspection rainwater & SDG 6 references: `docs/SOURCES_AND_LEGAL_STATUS.md`
- Sphere Handbook 2018: benchmarks kuantitas darurat dan lokasi titik air; 500 m *Euclidean* hanya proksi analitik, **bukan kepatuhan terhadap standar jalan kaki**.
- BPBD DIY laporan bantuan Klegung/Perbutan: lihat `docs/distribution_reference/METHODOLOGY_AND_LIMITATIONS.md`.

**Keputusan:** Gunakan `docs/MASTER_MODEL_METADATA.json` sebagai registry versi 3. File `SHA256SUMS.txt` memuat integritas seluruh berkas.
