# AGC 2027 — Hasil optimasi jaringan jalan Katongan (v6)

**Status:** hasil komputasi OSM nyata yang diekspor pengguna dari Google Colab, 9 November 2026. **BUKAN** verifikasi lokasi fasilitas, akses truk fisik, hak lahan, atau kelayakan air.

## Ringkasan tervalidasi dengan file asli

- Sumber: OpenStreetMap melalui Overpass + OSMnx. Jalan kaki: **1.895 node / 4.740 edge**; jalan kendaraan: **1.768 node / 4.461 edge**. Edge adalah segmen graf terarah, tidak setara dengan jumlah ruas unik.
- Batas wilayah: polygon Katongan pada berkas proyek. Total: **3.583 centroid footprint** sebagai proksi permintaan, **bukan 3.583 rumah tangga**.
- Pencarian awal: **342** calon pusat grid. Screening jalan menghasilkan **148 kandidat**.
- Metode: *greedy maximum coverage* + *limited local swap*, batas **30 lokasi**, jangkauan **500 m** berdasarkan jalur berjalan OSM dengan konektor menuju node jalan yang diasumsikan lurus maksimal **125 m**.
- Hasil **30 pusat kandidat**; melayani **3.145/3.583 = 87.78%**. Target 95% **tidak tercapai**.
- **438** centroid bangunan di luar 500 m atau tidak tersambung: **418** lebih dari 125 m dari node jalan model; **20** dekat jalan tetapi tidak masuk cakupan. Dalam 20 ini, **15** dialokasikan ke pusat dengan jarak >500 m, **5** tak memiliki rute ke kandidat terpilih.
- Atas candidate set dan parameter ini, hanya **3157/3.583 = 88.11%** permintaan berpotensi terjangkau walaupun seluruh 148 kandidat dipilih. Target 95% **tidak mungkin** dengan kombinasi data/parameter ini; menaikkan batas 30 lokasi saja tidak cukup.
- Bandingkan secara adil: **11 titik lama** diuji ulang pada model OSM dan hanya mencakup **44,40%** (1.591/3.583); **11 titik versi lama = 95,84%** hanya dengan jarak garis lurus. Angka ini **bukan** perbandingan performa distribusi eksisting pemerintah.
- Demand awal **5.569 jiwa × 50% terdampak × 15 L/orang/hari = 41.767,5 L/hari** (skenario; populasi tahun acuan belum pasti). Alokasi kebutuhan tiap pusat saat ini hanya perkiraan proportional to count of footprint proxies; sumber air dan kapasitas armada belum ada.

## Batas inferensi

1. **Situs kandidat bukan lahan terverifikasi**. Seluruh titik berada pada node jaringan kendaraan OSM, sehingga sama sekali tidak membuktikan adanya bidang tanah milik publik untuk bak maupun ruang manuver kendaraan.
2. Kedekatan ke jalan OSM tidak memverifikasi legalitas jalan, akses warga, lebar jalan, gradien, penyeberangan aman atau musim. Connector 125 m adalah asumsi, bukan jalur pejalan kaki terpetakan.
3. Jaringan OSM yang tidak lengkap dapat menyebabkan underestimation cakupan. Audit 418 bangunan, termasuk jalan desa/gang yang belum terpetakan, sebelum menetapkan target final.
4. Model **belum Vehicle Routing Problem**. Tidak ada depot/sumber, kapasitas armada, waktu perjalanan ataupun jadwal. Infrastruktur ini untuk **bantuan air eksternal**, bukan penyaluran air hasil RWH.
5. *Greedy* belum memiliki sertifikat optimum global. 30 dipilih karena batas pencarian; **jangan labeli 30 sebagai jumlah fasilitas ideal**.
6. Penilaian Kesling tidak menyatakan air aman diminum tanpa pengujian mutu yang relevan.

## Prioritas verifikasi untuk menutup gap 95%

1. Periksa 418 bangunan jauh dari graf: inspeksi jalan OSM vs citra/ortofoto dan gang/jalur tidak terpetakan; jika diperbaiki, unduh graf ulang dan reoptimasi.
2. Bandingkan radius 500, 750 dan 1000 m **sebagai skenario**, bukan otomatis mengendurkan standar Sphere. Pertimbangkan kenaikan connector berdasarkan audit, bukan angka sewenang-wenang.
3. Kumpulkan lokasi tapak alternatif sekitar pusat pencarian (zona 150 m), status lahan, akses truk, bahaya lereng dan suplai harian; rerun location-allocation dengan himpunan kandidat yang benar-benar feasible.
4. Gunakan distribusi penduduk per padukuhan / rumah tangga jika ada, bukan bobot centroid seragam.
5. Jaga batas administratif AOI tetap ditelusuri (perbedaan luas pada sumber administrasi belum terselesaikan).

**File sumber hasil:** `NETWORK_OSM/results/` dan `reference_input/USER_Katongan_OSM_Network_Results.zip`. **Peta GIS:** `GIS/Katongan_AGC2027_all_layers.gpkg` memuat layer jaringan tambahan; shapefile baru di `GIS/SHAPEFILES/`.
