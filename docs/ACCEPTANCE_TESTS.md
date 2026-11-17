# Acceptance Tests — Master v3

## Wajib
1. 3.583 GeoJSON building footprints, properti `id`, luas/curah hujan/4 RC, no duplicate; source CSV menghasilkan 4 RCHP total sesuai metadata.
2. Harian 10.958, bulanan SPI 360, sensitivitas CDD 90; YAS memenuhi 45 benchmark.
3. 11 lokasi utama dan 3 tambahan dengan status `*_UNVERIFIED`; tidak ada pin eksisting palsu.
4. 3.583 assignment base, 3.583 phase II; cakupan 500m Euclidean **3434** (95,84%) dan **3517** (98,16%); join berdasarkan plus code.
5. UI tidak menyatakan bangunan = rumah, potensi RWH = pasokan aman, jarak lurus = jarak tempuh, atau algorithm = global optimum.
6. Qualitative Kesling rules returns `NOT_VERIFIED` atau `NEEDS_QUALIFIED_REVIEW` dan `safe_to_drink_claim=false`.

## Run commands (from package root)
```bash
python tests/test_master_handoff.py
python tests/verify_data.py
node src/test_yas.js data/katongan_daily_rain_1996_2025.csv data/katongan_yas_scenario_matrix.csv
node tests/test_integrated.js
node tests/test_quality_catalog.js
```

## Yang tidak diuji di sini
Browser/frontend belum ada, kinerja client mobile belum diuji, road-routing belum dihitung, kondisi fisik calon tapak belum dicek, hasil kualitas air aktual tidak tersedia.
