# Status Bukti, Kekurangan, dan Klaim yang Diizinkan (v3)

| Modul | Ada hasil? | Boleh diklaim | Belum boleh diklaim |
|---|---|---|---|
| CHIRPS 1996–2025 | 10.958 hari, 360 bulan, SPI/CDD | indikator kekeringan dari gridded rainfall | observasi stasiun lokal atau lokasi sumur kering |
| Footprint | 3.583 kandidat Google Open Buildings v3 | proksi bidang atap/posisi bangunan | 3.583 rumah atau 3.583 KK |
| RWH | RC0,80 510.668,75 m³/tahun teoritis | annual theoretical roof catchment screening | volume aman dipakai, tangki tersedia, kebutuhan air terpenuhi |
| YAS | model simulasi & 45 benchmark | reliabilitas pada parameter input dan CHIRPS AOI | keandalan aktual rumah tertentu tanpa observasi |
| First flush | simulasi 0/0,5/1 mm berdasarkan proxy hujan harian | trade-off hipotesis volume air | tingkat penghilangan kontaminan terbukti |
| Kesling | matriks dan decision rules | kandidat kontrol dan daftar uji lanjutan | aman diminum, teknologi telah terbukti efektif di Katongan |
| 11 pusat baru | optimasi heuristik cakupan 500 m lurus | 3.434 dari 3.583 footprint proksi tercakup, 95,84% | fasilitas siap bangun, akses truk feasible, optimum global |
| 3 pusat temporer | skenario tambahan | 3.517 dari 3.583, 98,16% | titik mobil/tandon aktif, cakupan jalan kaki |
| Kebutuhan distribusi | total 5.569 jiwa referensi, fraksi terdampak 50% hipotesis | 41.767,5 L/hari skenario minimum 15 L/kapita | demand nyata, penerima bantuan riil per lokasi |
| Pembanding eksisting | laporan bantuan pada Klegung dan Perbutan | bukti historis penyaluran di wilayah | koordinat bak, rute aktual, angka perbaikan baseline |

## RELEASE GATE ke operasional
1. Jaringan jalan OSM yang dapat dilalui pejalan kaki/truk, topologi, hambatan akses; rerun network-constrained solver.
2. Status dan hak guna lahan, kemiringan dan kesesuaian tapak, radius pencarian yang dapat ditinjau.
3. Sumber pengisian air, debit, kapasitas tangki, biaya dan logistik armada.
4. Data demand penerima terdampak yang lebih baik daripada meratakan bobot ke footprint; pertimbangkan padukuhan/KK aktual.
5. Uji kualitas air dan review regulasi/teknologi Kesling; jangan otomatis sertifikasi air minum.
6. Verifikasi batas AOI; luas digital ~12,06 km² berbeda dengan beberapa rujukan luas administratif.

**No false precision:** 11 pusat = hasil pencarian terbaik pada 342 kandidat dan rentang p=4..16 serta algoritma heuristik; tidak ada bukti optimum universal. Kebutuhan 41.767,5 L/hari bukan volume yang benar-benar kekurangan di Katongan. Pembanding eksisting belum dapat dibandingkan secara kuantitatif.
