# AQUA TRIAX | WebGIS Katongan v6

## Menjalankan aplikasi

1. Di Windows, jalankan `RUN_WINDOWS.bat`. Di macOS atau Linux, jalankan `sh RUN_MAC_LINUX.sh` dari folder ini. Alternatifnya, jalankan `python -m http.server 8000 --bind 127.0.0.1` di folder `WEBGIS_READY`.
2. Buka [127.0.0.1:8000](http://127.0.0.1:8000/). Python diperlukan untuk server lokal. Peta memakai Leaflet dan peta dasar Esri melalui internet. Peta jalan Esri dipilih secara bawaan.
3. **Dashboard** langsung menampilkan **Ringkasan Katongan** dan **Pola hujan Katongan** di kiri peta pada desktop. Di layar sempit, panel muncul setelah peta. Gunakan **Layer & legenda** untuk mengatur layer, rentang tampungan, dan koefisien limpasan. Ketuk bangunan untuk melihat estimasi dalam liter per tahun.
4. Di **Solusi Kualitas Air**, pilih tujuan penggunaan, gejala seperti keruh atau berbau, dan temuan sanitasi. Hasilnya menampilkan langkah pemeriksaan dan opsi penanganan sesuai informasi yang tersedia.

Bagian **Sumber dan cara hitung** menampilkan total luas footprint. Panel **Audit visual** menampilkan ringkasan dan rincian 40 sampel. Dari panel bangunan, pilih **Hitung kebutuhan tandon** untuk mengisi luas dan RC yang sedang dipilih. Di simulator, menu **Skenario acuan YAS** memuat satu dari 45 input acuan dan menampilkan perbandingan hasil per indikator dengan Master v6.

Aktifkan **Curah hujan rata-rata tahunan** di **Layer & legenda**. Gradasi biru di kiri bawah peta memakai satuan mm/tahun. Ketuk area berwarna untuk membaca nilainya. Layer ini memakai tiga sel grid CHIRPS v3 (0,05°) yang teridentifikasi dari sampel centroid di `buildings.geojson`. Setiap sel memakai nilai `rain_mm_annual` untuk periode 1996–2025 dan dipotong sesuai `boundary.geojson`.

Grafik **Pola hujan Katongan** langsung menampilkan rata-rata Januari–Desember di wilayah kajian. Pilih **Per tahun** untuk melihat total curah hujan tiap tahun. Deret bulanan, SPI, dan hari kering berturut-turut tersedia di **Indikator lanjutan**.

Di panel yang sama, centang **Batas administrasi**. Pilih **Daerah Istimewa Yogyakarta → Gunungkidul → Nglipar → Katongan** untuk menyorot area Katongan dan menampilkan seluruh kalurahan. Hapus centang untuk menyembunyikan sorotan.

Saat **Potensi air hujan per bangunan** aktif, gunakan **Rentang potensi tampungan** untuk menyaring bangunan di peta berdasarkan estimasi pada koefisien limpasan yang dipilih. Pilih **Semua rentang** untuk menampilkan seluruh bangunan kembali.

## Membaca distribusi air

- Aktifkan **Lokasi bantuan air** di panel **Layer & legenda**, lalu pilih **Lihat rincian bantuan air** untuk menuju catatan bantuan dan kontak kalurahan di bawah peta. Pilih **Lihat usulan lokasi bantuan** untuk membuka skenario penelitian.
- Centang **Zona cakupan distribusi air** di panel **Layer & legenda**. **Garis lurus** (pilihan awal) menggambar lingkaran transparan beradius 500 m di sekitar kandidat. **Jaringan jalan kaki** menyorot bangunan tercakup berdasarkan skenario model yang dipilih.
- Pada skenario dasar **Jaringan OSM**, **30 kandidat** mencakup **3.145 dari 3.583 proksi bangunan (87,78%)** dalam jarak model 500 m, termasuk konektor lurus ke jaringan. Dari **438** yang belum tercakup, **418** jauh dari node jalan OSM dan **20** dekat jaringan.
- Centang **Jalan** di panel **Layer & legenda** untuk melihat jaringan OpenStreetMap. **Jalan pejalan kaki** memakai garis biru utuh dan **Jalan kendaraan** memakai garis ungu putus-putus. Di skenario distribusi, pilih NET-S01 sampai NET-S30 untuk memfilter centroid yang teralokasi, lalu klik titik untuk membuka detail.
- Tiga pilihan skenario jaringan memuat 150 kombinasi jumlah titik, jarak layanan, dan batas konektor. Pada skenario alternatif, peta menampilkan titik aktif dan status cakupan dari matriks per bangunan. Rincian alokasi per titik tersedia pada skenario dasar.
- Sembilan skenario kebutuhan air menampilkan perkiraan total. Rincian kebutuhan di dalam dan di luar area cakupan mengikuti skenario dasar. Layer **Bantuan MDMC · historis** mencatat satu kejadian bantuan 5.000 L di Klegung dengan koordinat perkiraan.
- Panel **Checklist verifikasi tapak** menampilkan status tiap kandidat, termasuk lahan, akses truk, suplai, dan uji kualitas air. Panel **Rekap historis bantuan air** menampilkan angka berdasarkan wilayah dan tanggal sumber.
- Kurva p=1–30 mencatat tahap greedy. Pada p=30, tahap ini mencapai **87,61% (3.139)**. Hasil akhir **87,78% (3.145)** sudah mencakup perbaikan local swap. Target 95% belum tercapai.
- Mode **Awal · jarak garis lurus** mempertahankan pembanding historis 11 dan 14 titik. Kelayakan lahan, akses truk, dan sumber air masih memerlukan verifikasi. Kontrak v6 dan temuan lengkap tersedia di [folder dokumentasi](../docs).

## Sumber dan pengujian

- `app.js` menangani navigasi, pemuatan data, dan peta. `analysis-views.js` menangani Ringkasan, Iklim, YAS, dan Kesling. `distribution.js` menangani layer dan panel OSM.
- `models/` serta tabel CDD, kebutuhan, sanitasi, pengolahan, dan kurva cakupan di `data/` disalin dari sumber Master. Setelah sumber diperbarui, jalankan `python reproduce/sync_webgis.py` dari folder Master. Arsip ZIP v6 menyimpan paket penelitian asal.
- Aset skenario dan penanda MDMC disalin dari arsip Page 2 ke `data/distribution/`. Untuk menyinkronkan arsip, jalankan `python reproduce/sync_webgis.py --distribution-zip ../Katongan_Page2_DATA_SI_Update_MDMC.zip` dari folder Master.
- Dari folder Master, jalankan `python tests/verify_data.py`, `node tests/test_integrated.js`, dan `node tests/test_quality_catalog.js`. Tes GIS `python tests/verify_network_v6.py` memerlukan GeoPandas dan Fiona. Jalankan `python tests/test_webgis_browser.py` dengan server lokal aktif, Python Playwright, dan Chrome. Tambahkan `--channel msedge` untuk Microsoft Edge.

Pengujian lokal 10 November 2026 lulus untuk validasi dataset dan 13 layer GeoPackage, 45 skenario YAS, first flush, aturan Kesling, serta komponen optimasi dan fallback unduhan OSM dengan data uji. Ketujuh tab juga lulus pengujian Chrome pada desktop 1366 × 900 dan emulasi Pixel 7, termasuk pergantian RC, grafik iklim, popup peta, pilihan layer, filter kandidat, skenario pembanding, status kualitas, dan kondisi ketika data gagal dimuat.

## Publikasi dan batas interpretasi

Folder `WEBGIS_READY` berisi semua aset aplikasi statis yang dibutuhkan hosting. Sajikan folder ini melalui HTTP(S), dengan `index.html` sebagai halaman awal dan jalur relatif tetap sama.

Footprint adalah proksi bangunan dan CHIRPS memberi konteks meteorologis untuk wilayah kajian. Simulasi first flush memakai proksi peristiwa hujan harian. Mutu air memerlukan uji laboratorium dan tinjauan ahli. Distribusi memerlukan pemeriksaan kelengkapan jalur, tapak dan lahan, sumber pasokan, dan kebutuhan aktual sebelum dipakai untuk keputusan operasional.
