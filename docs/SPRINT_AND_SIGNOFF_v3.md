# Sprint & Definition of Done — SI

## Sprint 0: import, test, data QA (mulai hari pertama)
- Baca `README_START_HERE.md`; jalankan 5 smoke tests; semua PASS.
- Tampilkan `public/data/metadata.json` dan metadata sumber/metode pada antarmuka.
- Load boundary, 3.583 poligon, dan 11+3 titik. Verifikasi ID dan satuan geometri.

## Sprint 1: MVP peta dan grafik
- RWH layer, RC dropdown 0,70/0,80/0,84/0,90, total & filter confidence sinkron.
- SPI/CDD/rain charts, tidak mengisi missing SPI=0.
- Prospective points layer, mode 11 dan 14, choropleth cakupan, grafik trade-off model.
- Grafik dibuat dari dataset, tidak dari angka contoh statis.

## Sprint 2: simulator + Kesling
- YAS (daily AOI mean), demand 15/50/100 liter per kapita menurut skenario; input penghuni eksplisit.
- First flush hanya opsi OFF default dengan label proxy events.
- Form sanitary flags + treatment matrix; status selalu NON-CERTIFYING.

## Sprint 3: QA, UI, release demo
- Mobile, keyboard, loading/error, unit & source attribution, MapLibre/Leaflet GeoJSON loading, export scenario hasil.
- Tests CI; source docs; guide manual untuk pengguna. Jangan dipromosikan sebagai platform operasional pemerintah.

## Tanggung jawab / signoff
- Geografi A: hasil iklim, metadata native grid, SPI/CDD, YAS.
- Geografi B: polygon joined, hasil 11+3 lokasi skenario, verifikasi jalan/lahan sebagai future step.
- Kesling: literatur/matriks, pemutakhiran hukum & cara verifikasi parameter, QA keamanan hasil.
- SI: semua UI, integrasi, test, versioning/deployment dan dokumentasi.
