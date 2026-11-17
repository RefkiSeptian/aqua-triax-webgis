# Geografi B — Prospective Site Location-Allocation, bukan routing bantuan eksisting

**Tujuan:** menyaring calon pusat area distribusi air bersih **baru** bagi permukiman Katongan dengan objektif memperluas cakupan pada biaya jumlah lokasi terbatas. Sumber pasokan air fasilitas ini belum terverifikasi. **Tidak menyamakan distribusi dengan RWH**.

## Input teramati / proksi
- 3.583 centroid Google Open Buildings sebagai proksi sebaran permintaan (bukan warga/KK aktual).
- Batas AOI Katongan; 342 kandidat grid hex spacing 185m, disaring agar dekat bangunan.
- Target cakupan **jarak Euclidean ≤500m**, target ≥95% proksi bangunan; uji jumlah 4–16.
- Algoritma greedy maximal covering + single-swap, pemutus seri mean distance. **No exact global optimum certificate**.

## Output utama
- **11 pusat hipotetis** 3.434/3.583 bangunan proksi di 500m (95,84%); 149 di luar radius.
- **3 tambahan** menaikkan ke 3.517/3.583 (98,16%); 66 di luar radius.
- Rerata jarak garis lurus awal ≈305,36m; ini tidak mewakili perjalanan jalan kaki/truk.
- Area sekitar pusat (radius 150m) hanya **search area** untuk cek kandidat tapak; bukan bukti tanah publik, aman lereng, atau akses kendaraan.

## Skenario permintaan (Kesling ↔ Geo B)
`D_total_L_per_day = population_ref * affected_fraction * per_capita_L_day`.
`5.569 * 0,5 * 15 = 41.767,5 L/hari` (asumsi, bukan demand survei).
Pembagian demand ke site memakai bobot proksi konstan per footprint; jumlah tidak identik dengan penduduk nyata di setiap zona. 13 rit @5.000L per site dibulatkan masing-masing hanya *screening scenario*; tidak membuktikan pengiriman feasible.

## Sumber dan komparator
- Lokasi historis penyaluran Klegung, Perbutan (BPBD) tanpa koordinat bak—hanya **observed locality**.
- Tidak tersedia penilaian faktual perubahan biaya/rute/jangkauan dibanding eksisting.

## Pengembangan ilmiah berikutnya
Akses jalan OSM, validasi walking network & truck network, status lahan, slope, kapasitas/depot, tingkat kekeringan, dan distribusi populasi. Sesudahnya **rerun optimasi**, bukan menempelkan jaringan jalan ke titik 11 secara deklaratif. P-median dapat menjadi benchmark metode, tidak wajib sebagai primary objective.
