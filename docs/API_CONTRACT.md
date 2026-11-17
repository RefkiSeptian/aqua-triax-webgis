> **LEGACY VERSION — DEPRECATED FOR CURRENT SI HANDOFF.** See `README_START_HERE.md` and `docs/API_AND_DATA_CONTRACT_v3.md`. Prospective 11+3 sites are now primary; historical aid is comparator only.

# Rancangan kontrak data/API untuk SI

**MVP direkomendasikan tanpa backend kompleks**: aplikasi memuat `public/data/katongan_boundary.geojson` dan `katongan_buildings_rwh.geojson` secara lokal/static hosting. Backend opsional untuk kalkulator YAS dinamis, proses impor dan analisis jaringan. Jangan melakukan query CHIRPS atau Google Earth Engine dari browser pengguna.

## State UI (minimum)
- `rc`: enum `0.70 | 0.80 | 0.84 | 0.90` (awal `0.80`).
- `selectedBuildingId`: string atau null.
- `minimumConfidence`: number awal 0.70; jika diubah, pembilang dan penyebut KPI harus dihitung ulang sesuai filter.
- `roofAreaM2`, `demandLitersPerDay`, `tankCapacityLiters` untuk kalkulator; default dari sampel/skenario jelas.
- `droughtIndex`: `SPI3`/`SPI6`; `cddThresholdMm`: 0.5/1/2.

## Peta bangunan
- Baca dari `katongan_buildings_rwh.geojson`.
- Hover/tap poligon: ID, confidence, luas, hujan tahunan piksel, RWH tahun sesuai RC.
- Choropleth RWH harus jelas apakah warna merepresentasikan total m³/bangunan atau per m². Jangan memakai warna sebagai bukti kekurangan air.
- KPI total RWH dihitung dengan menjumlahkan bangunan yang masih terlihat sesuai filter.

## Contoh endpoint backend bila dibutuhkan
- `GET /api/v1/metadata`: ringkasan source, periodisasi, batasan model.
- `GET /api/v1/buildings?bbox=minLon,minLat,maxLon,maxLat&minConfidence=0.70`: GeoJSON terfilter; nanti gunakan PostGIS/vector tiles bila perlu.
- `GET /api/v1/buildings/{id}`: properti + geometri satu bangunan.
- `GET /api/v1/climate/monthly`: array `date, rain_mm, SPI3, SPI6`.
- `GET /api/v1/climate/cdd?threshold_mm=1`: array `year, max_CDD_days`.
- `POST /api/v1/rwh/yas`: body `{ "roof_m2": 100, "rc": 0.8, "demand_lpd": 100, "tank_l": 5000 }`.
  Response `{ "time_reliability_pct": number, "volume_reliability_pct": number, "dry_season_time_reliability_pct": number, "total_spillage_m3": number, "total_delivered_m3": number, "total_unmet_m3": number, "scenario": {...}, "method": "YAS_AOI_DAILY_1996_2025" }`.
- `GET /api/v1/water-aid/sites`: **jangan publikasikan titik seolah aktual sebelum sumber lokasi tervalidasi**; sementara respon `[]` dan metadata `data_status=NOT_VERIFIED`.

## Validasi input kalkulator YAS
- `roof_m2 > 0` dan bukan otomatis dianggap luas atap layak panen.
- `0 < rc <= 1` dengan pilihan baseline/sensitivitas 0.70/0.80/0.84/0.90.
- `demand_lpd > 0`, `tank_l >= 0`.
- Urutan model per hari **hujan masuk → overflow → kebutuhan dipenuhi → sisa disimpan**. Tandon awal kosong.
- Formula `inflow_L = rain_mm × roof_m2 × rc` (1 mm pada 1 m² = 1 L).
- `storageAfterRain = storageBefore + inflow_L`; `overflow = max(0,storageAfterRain - tank_l)`; `available = storageAfterRain - overflow`; `yield = min(demand_lpd,available)`; `endStorage = available - yield`; `unmet = demand_lpd - yield`.
- `time_reliability_pct = 100 × count(unmet = 0) / jumlah_hari`; `volume_reliability_pct = 100 × sum(yield)/sum(demand)`.
- Kemarau untuk metrik `dry_season_time_reliability_pct` pada model awal adalah Juli–September; jangan otomatis menyatakan ini definisi resmi musim kemarau Gunungkidul.
- Output dapat berbeda jika periode simulasi, kondisi awal, batasan kapasitas, dan frekuensi permintaan diubah. Labelkan seluruhnya **skenario**, bukan perhitungan debit baku PDAM.

## Layanan/data yang belum ada
- Titik reservoir/bak dan histori distribusi air bantuan dengan koordinat terverifikasi.
- Jumlah kebutuhan warga/penduduk per titik atau padukuhan yang tervalidasi.
- Jaringan jalan OSM routable serta validasi akses truk; optimizer belum boleh memberi rute operasional nyata.
- Pengukuran parameter kualitas air; modul treatment hanya scenario guidance dari ahli Kesling, bukan kelayakan minum.
