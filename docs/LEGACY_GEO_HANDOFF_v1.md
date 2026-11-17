> **LEGACY VERSION — DEPRECATED FOR CURRENT SI HANDOFF.** See `README_START_HERE.md` and `docs/API_AND_DATA_CONTRACT_v3.md`. Prospective 11+3 sites are now primary; historical aid is comparator only.

# HANDOFF — AGC 2027 Katongan: Geografi → Sistem Informasi

## Keputusan desain
**Gunakan Google Open Buildings v3 saja** sebagai footprint kandidat, threshold `confidence >= 0.70`, pusat poligon di dalam AOI Katongan. **Tidak mengerjakan digitasi ulang berbasis AI.** Materi pilot visual 40 bangunan bukan validasi luas/material keseluruhan populasi.

## Goal SI
Membangun WebGIS yang menjelaskan **(A) potensi pemanenan air hujan**, **(B) kekeringan meteorologis**, serta kemudian, bila data sudah valid, **(C) optimasi distribusi bantuan air eksisting** dan **(D) panduan treatment skenario**. Modul B bantuan air eksisting BUKAN sistem distribusi dari tandon RWH.

## Data yang sudah dapat diimplementasikan sekarang

| File | Muatan | Sumber/ketentuan |
|---|---|---|
| `public/data/katongan_boundary.geojson` | Poligon batas studi | CRS EPSG:4326; sumber administratif untuk laporan final perlu dikonfirmasi |
| `public/data/katongan_buildings_rwh.geojson` | 3.583 poligon + 4 potensi RWH per RC | Geometri Open Buildings digabung CSV GEE **CHIRPS native pixel** |
| `data/katongan_rwh_pixel_scenarios_source.csv` | CSV model RWH per bangunan | Dapat dipakai untuk join/backup tabel |
| `data/katongan_daily_rain_1996_2025.csv` | 10.958 hari hujan AOI | Kalkulator YAS dinamis |
| `data/katongan_monthly_spi_1996_2025.csv` | 360 bulan SPI-3 dan SPI-6 | Grafik kekeringan |
| `data/katongan_cdd_sensitivity.csv` | CDD 1996–2025, 3 threshold | Grafik durasi tanpa hujan |
| `data/katongan_annual_rain_1996_2025.csv` | 30 tahun total hujan | Grafik tahunan |
| `data/katongan_yas_scenario_matrix.csv` | 45 kombinasi tandon dan kebutuhan | Benchmark kalkulator (RC0,80; hujan AOI) |
| `docs/MODEL_METADATA.json` | Ringkasan sumber dan QA | Tampilkan dalam panel "Metode & keterbatasan" |

**Jangan pakai** file potensi lama yang tertulis `rain_data_method=aoi_mean_rainfall_proxy` sebagai angka RWH spasial per bangunan. Model referensi lama memang memakai CHIRPS rata-rata AOI, sedangkan paket ini memakai pengambilan sampel CHIRPS per piksel pada centroid tiap bangunan.

## MVP — halaman dan perilaku

### Halaman 1: Ringkasan penelitian
Judul, peta lokasi Katongan, KPI: 3.583 kandidat, luas footprint, dan total potensi tahunan untuk **RC yang sedang aktif**. Label KPI "potensi tangkapan teoritis", bukan "air bersih tersedia". Grafik seri hujan tahunan dan penjelasan CHIRPS 1996–2025.

### Halaman 2: Peta RWH
- Basemap, batas Katongan, 3.583 polygon; klik polygon buka side-panel properti.
- Kontrol RC 0.70, 0.80, 0.84, 0.90; UI menghitung jumlah/sum yang relevan.
- Legend m³/tahun per bangunan; filter confidence; pencarian ID; tombol reset.
- Warning model: material atap/akses tandon/hunian **belum diverifikasi**.

### Halaman 3: Iklim dan Kekeringan
- Grafik hujan tahunan 1996–2025; klimatologi bulanan; SPI-3/SPI-6 (dari file, tidak harus dihitung ulang di frontend); CDD tahunan untuk threshold 0.5/1/2 mm.
- Tidak menggambarkan CHIRPS sebagai data meteran air desa.

### Halaman 4: Simulasi Tandon RWH (YAS)
- Input ukuran bidang tangkapan, RC, kebutuhan L/hari, tandon L. Bisa prefill dari `area_m2` bangunan terpilih, **user boleh koreksi**.
- Output persen hari kebutuhan terpenuhi, persen volume kebutuhan terpenuhi, reliabilitas Juli–September, total overflow, dan unmet demand; jelaskan sumber hujan daily **rata-rata AOI** (tidak per bangunan).
- Verifikasi kalkulator terhadap 45 baris `katongan_yas_scenario_matrix.csv`; kondisi awal tandon kosong.

### Halaman 5: Bantuan Air Eksisting — belum dipublikasikan sebagai peta rekomendasi
Data titik bak/drop, permintaan, kapasitas truk, dan jalur belum tervalidasi. SI boleh bikin placeholder struktur layer/endpoint, tetapi **jangan membuat titik contoh yang menyerupai lokasi nyata** atau rekomendasi operasional. Saat data valid masuk: peta titik yang telah diverifikasi, analisis akses jaringan jalan, dan optimasi existing water aid (`p-median`/maximal covering) oleh Geografi B + SI.

### Halaman 6: Water Treatment — berbasis skenario Kesling
Belum ada data laboratorium lokal. UI hanya menyajikan skenario risiko dan rangkaian treatment yang dirumuskan anggota Kesling, dengan label **tidak menggantikan pengujian kualitas air**.

## Urutan kerja yang efisien
1. **Hari 1–2:** SI setup repo, load GeoJSON, baseline map/feature tooltip, validasi 3.583 poligon dan 4 skenario RC.
2. **Hari 3–4:** bangun dashboard iklim (annual, SPI3/SPI6, CDD), kontrol filter dan grafik.
3. **Hari 5–6:** kalkulator YAS (JS function atau backend kecil) + validasi terhadap 45 skenario referensi.
4. **Hari 7:** integrasi UI responsif, handling loading/error, dokumentasi metode, uji performa, publish MVP.
5. **Sprint berikutnya:** dataset distribusi air bantuan pemerintah yang benar-benar terverifikasi, analisis jalan, treatment scenario, laporan kualitas.

## Pembagian penanggung jawab
- **Geografi A:** konsistensi rumus CHIRPS, SPI, CDD, YAS, parameter/toleransi model; sign-off kalkulator.
- **Geografi B:** CRS/batas, 3.583 geometri, join ID, RCHP spasial, bantuan air eksisting + jalan bila tersedia; sign-off peta.
- **Kesling:** treatment scenario, daftar kontaminan hipotetis, disclaimer keamanan.
- **SI:** UI/UX, map layers, validasi input, integrasi data/API, pengujian, deployment, dokumentasi.

## Acceptance criteria (yang harus bisa didemokan)
- Semua 3.583 poligon tampil dan bisa diinspeksi, tanpa geometri kosong/ID ganda.
- Pindah RC mengubah potensi masing-masing polygon + total KPI secara konsisten.
- Total RC0,80 sesuai nilai di `MODEL_METADATA.json` (toleransi pembulatan <=1 m³ untuk agregasi).
- Grafik SPI/CDD dapat ditampilkan dengan datum yang benar dan nilai kosong tidak jadi nol.
- Kalkulator YAS cocok dengan 45 kombinasi referensi (toleransi 1e-5 poin persen untuk reliabilitas, atau toleransi numerik masuk akal).
- UI jelas menyebut RWH sebagai **potensi teoritis**, material atap belum terverifikasi, dan hasil bukan bukti air aman diminum.
- Tidak ada peta/rute bantuan air bersih palsu.
- Responsive: mobile dashboard tetap dapat dioperasikan; peta dapat dipan/zoom, tooltip dan layer dapat dimatikan.

## Arsitektur minimum
- Frontend: React + MapLibre GL JS/Leaflet + chart library sesuai skill SI.
- MVP dapat di-host statis: `public/data/*.geojson` + ringkasan JSON. Untuk YAS, data hujan harian CSV boleh diproses client-side (10.958 baris) atau backend.
- PostGIS dan FastAPI/Node **opsional** di MVP; layak saat query spasial, histori, user-generated scenarios, network optimization berkembang.
- File boundary dan geometri berbeda peran; satuan dibaca eksplisit. Tetapkan timezone UTC untuk pemrosesan tanggal historis murni (YYYY-MM-DD), tanpa konversi zona jam pada timestamp date-only.

## Risiko & batasan yang harus dicantumkan
1. Google Open Buildings terdeteksi model, belum seluruhnya tervalidasi; mungkin ada omission/commission dan perbedaan batas atap.
2. Angka RWH tidak sama dengan air ditampung; overflow, first flush, kesehatan, biaya, dan rumah tangga tidak disertakan pada potensi tahunan.
3. Hanya tiga nilai hujan unik pada titik sampel karena piksel CHIRPS coarse; bukan pengukuran mikroklimat atap.
4. Simulasi YAS berbasis deret hujan rata-rata AOI, tidak boleh dicampur sebagai seri harian per-bangunan dengan RCHP annual pixel.
5. Tidak ada pengukuran kualitas air, dan titik distribusi bantuan eksisting belum terverifikasi.

Lihat `docs/DATA_DICTIONARY.md`, `docs/API_CONTRACT.md`, `docs/MODEL_METADATA.json`, dan `src/yas.js` sebelum mulai implementasi.
