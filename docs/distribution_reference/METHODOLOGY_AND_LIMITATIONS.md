# Metode dan batas inferensi

## Masalah optimasi yang dijawab

"Di mana **pusat pencarian** untuk titik distribusi air komunal sementara, sehingga proporsi footprint bangunan yang mempunyai **jarak garis lurus** <=500 m ke pusat pelayanan maksimal, pada jumlah fasilitas tertentu?"

Bukan "di mana lokasi tepat bak air yang bisa dilewati truk" dan bukan "di mana data titik distribusi eksisting".

## Formulasi model

Kandidat lokasi j = grid hex 185 m di dalam AOI, berdekatan dengan footprint. Proksi kebutuhan i = centroid 3.583 poligon Google Open Buildings; bobot tiap i = 1. Definisikan `a_ij=1` jika jarak Euclidean i ke j <=500 m, 0 selainnya.

MCLP baku:

- pilih `p` pusat (`x_j` ∈ {0,1});
- tiap permintaan i dinyatakan tercakup (`z_i` ∈ {0,1}) hanya jika minimal satu site terpilih dalam radius 500 m;
- maksimalkan `sum_i z_i` dengan `z_i <= sum_j a_ij * x_j` dan `sum_j x_j = p`.

Implementasi sekarang **bukan exact MILP**. Ia memakai *greedy facility selection* dan *single-swap local improvement* (cakupan dulu, rata-rata jarak sebagai tie-break), lalu menguji p=4..16. Dengan begitu istilah "11 lokasi paling optimal" harus selalu diperjelas: **11 lokasi kandidat terbaik yang ditemukan heuristik pada skenario dan kandidat yang diuji**, bukan sertifikat optimum global.

Pembanding p-median meminimalkan `sum_i min_j d_ij` untuk alternatif lokasi, juga heuristik.

Target 500m berasal dari Sphere Handbook 2018 untuk jarak ke titik air, **namun penelitian ini belum memiliki network distance, dan tidak mengukur jalan kaki aktual maupun antrean**.

## Model permintaan

Total populasi 5.569 dari situs Kalurahan Katongan, **tanggal acuan tidak tersedia**. Simulasi `affected=0.5`, `target=15 L/person/day`, sehingga D=41.767,5 L/day.

Waktu distribusi dan proporsi penduduk terdampak tidak berasal dari survei. Proksi permintaan `D_i=D / 3583` dibagi rata ke seluruh footprint, **bukan estimasi kepadatan hunian per padukuhan**. Penggunaan non-rumah (gudang, sekolah, pasar) menyebabkan bias.

Volume site = jumlah footprint terdekat × D_i. Asumsi 5.000 liter / rit hanyalah contoh throughput angkut untuk rencana skenario; belum memasukkan status jalan, sumber pasokan, atau frekuensi aktual. Distribusi kebutuhan per titik akan berubah jika data populasi lokal atau bak eksisting tersedia.

## Status data

- `OBSERVED`: 3.583 polygon deteksi (bukan validasi bangunan), polygon AOI, wilayah penerima bantuan Klegung dan Perbutan dari BPBD.
- `DERIVED`: pusat grid, jarak Euclidean, 11+3 lokasi model, cakupan bangunan.
- `HYPOTHETICAL`: 50% terdampak, 15 Lpcd, 5000 L per rit, 500m target model, 150m area pencarian, kebutuhan per site.
- `MISSING`: jaringan jalan, izin lahan, suplai air, kapasitas tandon, kondisi medan, lokasi rumah nyata, GPS bak eksisting.

## Perubahan ke model berbasis jalan

1. Ambil jalan OSM yang membedakan `highway`, `surface`, `access`, `tracktype`, kondisi koneksi; ini tetap membutuhkan validasi lokal.
2. Simpan graph kendaraan untuk distribusi dan graph akses pejalan kaki untuk penerima sebagai dua graph berbeda.
3. Lokasi grid yang tak punya akses jalan truk harus dikeluarkan atau digeser dalam area pencarian setelah pemeriksaan legalitas/kesesuaian.
4. Hitung jarak network shortest-path; bangunan tanpa akses dicatat explicit unreachable.
5. Alokasikan beban dengan batas kapasitas dan kebutuhan; rerun location-allocation.
6. Bandingkan *baseline* 11 titik heuristik garis lurus dengan hasil baru; jika GPS historis tersedia, tambahkan pembanding operasional nyata.

## Keputusan ilmiah lanjutan

Sebelum pelaporan AGC 2027, audit cakupan batas AOI (luas dari boundary data ~12,06 km² vs publikasi 13,56 km²) dan hasil validasi 40 footprint pilot (sebagian hanya sesuai sebagian). Hasil ini belum cukup untuk menyimpulkan coverage seluruh rumah tangga Katongan.
