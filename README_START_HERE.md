# AGC 2027 KATONGAN — SI MASTER v6 | NETWORK OSM INTEGRATED

**Pembaruan aplikasi SI:** lihat [panduan WebGIS yang sudah diintegrasikan](WEBGIS_READY/README_WEBGIS.md) untuk cara menjalankan aplikasi, modul baru, dan pengujian. Catatan rilis di bawah mendokumentasikan paket penelitian asal.

**Mulai dari folder `WEBGIS_READY/`. Seluruh hasil Geografi A, Geografi B, Kesling serta hasil OSM yang diunggah pengguna sudah tergabung.**

**PENTING:** integrasi jaringan OSM berhasil; hasilnya **30 pusat pencarian, 87,78% bangunan tercakup dalam 500m jalan kaki plus konektor lurus**, target 95% **BELUM tercapai**. 11+3 pusat lama hanya pembanding metode garis lurus. Tidak ada klaim tapak pembangunan terverifikasi, depot teridentifikasi, VRP operasi, atau air layak minum.

## Jalankan WebGIS

1. Ekstrak ZIP master v6 sepenuhnya.
2. Buka folder `WEBGIS_READY`, jalankan `RUN_WINDOWS.bat` di Windows; atau `python -m http.server 8000` di terminal.
3. Buka `http://localhost:8000`. Basemap dan pustaka Leaflet membutuhkan koneksi internet.
4. Pilih tab **04 Distribusi air**, default **Jaringan OSM**. Peta menampilkan 30 kandidat, jalan berjalan, 438 bangunan tidak terlayani, dan angka 87,78%.
5. Ganti ke **Awal · jarak garis lurus** bila ingin membandingkan 11/14 kandidat pra-OSM. **Jangan campur angka kedua metode.**
6. Modul lain: RWH 3.583 bangunan, iklim 1996–2025, YAS tandon, dan Kesling risiko kualitas air tetap tersedia.

## Data GIS untuk QGIS/ArcGIS

- `GIS/Katongan_AGC2027_all_layers.gpkg`: **13 layer**, 8 layer lama + `osm_walk_roads`, `osm_drive_roads`, `network_sites_30`, `network_assignment_3583`, `network_screening_150m`.
- `GIS/SHAPEFILES/`: **13 set SHP** lengkap `.shp/.shx/.dbf/.prj/.cpg`, termasuk 5 set OSM baru. Pada SHP, nama kolom dipendekkan; gunakan GeoPackage untuk atribut penuh.
- `NETWORK_OSM/results/`: **10 berkas hasil Colab asli**, CSV, GeoJSON, JSON dan formulir inspeksi.
- `reference_input/USER_Katongan_OSM_Network_Results.zip`: ZIP hasil Colab asli, disimpan sebagai provenance.

## Dokumentasi yang wajib dibaca

1. `docs/NETWORK_FINAL_FINDINGS_v6.md`: **hasil, gap 95%, risiko metodologis dan agenda data**.
2. `docs/NETWORK_TO_SI_CONTRACT_v6.md`: **nama berkas, fields, aturan UI, acceptance tests**.
3. `docs/SCREEN_SPEC.md` + `docs/API_AND_DATA_CONTRACT_v3.md`: basis screen dan model terdahulu, beberapa bagian lama menyebut 11+3; untuk modul distribusi **v6 supersedes**.
4. `VALIDATION_AND_FIELD_GATES/SITE_VERIFICATION_REGISTER_NETWORK_30.csv`: inspeksi 30 lokasi masih wajib (hak lahan, akses truk, kapasitas sumber, kualitas air).

## Keterbatasan

- Tidak ada optimasi rute kendaraan operasional (VRP); tanpa depot/sumber dan armada nyata, model saat ini **location-allocation** berbasis graf berjalan.
- 418 bangunan belum dekat node jalan dalam asumsi 125 m; 20 bangunan lain tetap di luar jangkauan. Kemungkinan jalan OSM belum lengkap; audit citra/jalan sebelum memutuskan rekomendasi final.
- 30 titik adalah batas iterasi `max-sites`, bukan optimum global; bahkan seluruh 148 kandidat dalam radius/connector ini paling jauh hanya dapat mencakup **88,11%** centroid bangunan.
- 5.569 penduduk adalah angka referensi dengan tahun yang belum ditentukan; jumlah bangunan bukan jumlah rumah tangga; demanda 50% terdampak ×15L/jiwa/hari **hanya skenario**.
- Permenkes dan kualitas minum perlu review ahli Kesling sesuai kondisi dan standar yang berlaku. Jangan klaim sertifikasi air tanpa tes.

## QA

Jalankan di folder master: `python tests/verify_network_v6.py`. Pengujian browser melalui HTTP lokal terhalang pembatasan lingkungan kerja, sehingga UI tidak diklaim telah teruji end-to-end pada v6. Pemeriksaan statis aplikasi dan tes integrasi model lulus. Tes basis lama: `python tests/verify_master_v5.py`, `node --check WEBGIS_READY/app.js`, `node tests/test_integrated.js`.

Atribusi: OpenStreetMap © OpenStreetMap contributors (ODbL); Google Research Open Buildings v3; CHIRPS Climate Hazards Center; sumber lain mengikuti manifest sebelumnya. Dataset ini penelitian/prototipe, bukan pemetaan teknis konstruksi tersertifikasi.
