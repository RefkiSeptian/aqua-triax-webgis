# Model, Persamaan, dan Pembatasan

## Data baseline
- CHIRPS V3 daily 1996–2025, 10.958 hari; keterbatasan spasial: hanya tiga nilai hujan tahunan unik pada centroid bangunan akibat coarse native pixels.
- Google Open Buildings v3, 3.583 kandidat, confidence≥0,70, centroid AOI; luas footprint dari atribut `area_in_meters` sebagai **proxy proyeksi atap**, bukan atap terukur. Beberapa polygon batas tidak di-clip; luas atribut seluruh poligon digunakan. Tidak semua bangunan terbukti hunian.
- Peta RCHP per bangunan menggunakan hujan tahunan piksel; YAS memakai **deret hujan harian agregat AOI**. Jangan mengklaim simulasi YAS terukur per rumah.

## Geografi A: hujan, SPI, CDD
Annual rain = jumlah curah hujan harian, dengan konsistensi native grid GEE. SPI-3/6 telah dihitung dari akumulasi rolling berdasarkan bulan kalender; untuk implementasi UI gunakan file hasil final, bukan fit ulang di browser. CDD menurut threshold harian 0,5/1/2 mm; label threshold wajib muncul dan CHIRPS bukan stasiun curah hujan lokal.

## RWH teoritis
`RCHP_i_m3_per_year = rain_annual_pixel_i_mm * footprint_i_m2 * RC_scenario / 1000`.
RC 0,70/0,80/0,84/0,90 adalah sensitivitas, bukan hasil klasifikasi genteng/logam. Tidak mengurangi air first flush, overflow, keterbatasan kualitas, pemeliharaan, atau biaya.

## Demand
`demand_household_L/day = persons * L_per_person_per_day`; nominal 15 emergency Sphere; 50/100 skenario eksperimen bukan data kebutuhan riil. `building count != household count`, `footprint count != population`.

## YAS harian dasar
`inflow_L = rain_mm * roof_m2 * rc`. `pre = storage + inflow`. `overflow = max(pre - capacity,0)`. `available = pre-overflow`. `delivered = min(available,demand_lpd)`. `end_storage=available-delivered`. `unmet=demand-delivered`. Kondisi awal 0. Kebutuhan dihitung sekali per hari setelah overflow. Juli–September sebagai jendela analitik, bukan kalender kemarau resmi.

## First flush (eksperimental)
Pada event hujan harian baru setelah `dry_gap_days` berturut-turut hari hujan < `dry_day_threshold_mm`, jika intensitas hari sekarang >= threshold, diverter mengurangi `min(gross_L, first_flush_depth_mm*roof_m2)` tepat sekali untuk event tersebut. Kedalaman 0/0,5/1,0 mm hanyalah **analisis sensitivitas**, bukan ukuran perangkat yang disarankan. CHIRPS tidak menyajikan jam/kejadian hujan internal; gunakan label `DAILY_EVENT_PROXY`. Jangan menganggap RC sekaligus sudah memasukkan kehilangan first flush yang sama.

## Risiko kualitas & treatment
Data air hujan lokal dari laboratorium belum ada. Keluaran aturan hanya mengarahkan sanitary inspection, kontrol risiko, dan pengujian; tidak menyatakan pengolahan efektif pada rumah tertentu. Tidak ada hardcoded ambang nasional dalam file registry karena harus diperiksa legal applicability dan tujuan penggunaan.


## Prospective distribution site selection (replaces old existing-aid goal)
Primary objective is **scenario-based candidate locations**, not an existing-government-aid VRP. Spatial demand proxy: 3.583 building centroids; location candidates: 342 hexagonal candidates; maximal covering greedy+swap; radius 500m Euclidean and 95% target; 11 core + 3 supplementary hypothetical centres. These are search coordinates, not verified sites and not global optimality proof. Network distance, access trucks, land status, resupply and source quality unknown. Historical Klegung/Perbutan aid only area-level comparator, not actual benchmark. **No geographic or physical link is asserted between RWH rooftops and delivered water at centres.**
