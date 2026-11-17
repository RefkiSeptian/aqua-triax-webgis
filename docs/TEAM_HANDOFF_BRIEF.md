> **PEMBARUAN v6:** Modul distribusi dalam dokumen ini mungkin masih merujuk hasil awal 11+3 titik garis lurus. **Acuan terkini adalah `docs/NETWORK_FINAL_FINDINGS_v6.md` dan `docs/NETWORK_TO_SI_CONTRACT_v6.md`: 30 pusat OSM, cakupan 87,78%, target 95% belum tercapai.**

# Brief siap kirim ke anggota Sistem Informasi

Bangun WebGIS decision-support Katongan dengan empat domain: (1) RWH teoritis dan sensitivitas RC pada 3.583 kandidat footprint; (2) iklim CHIRPS, SPI, CDD dan simulator tandon YAS; (3) kebutuhan air dan saran penanganan risiko kualitas dari Kesling **non-certifying**; (4) penentuan **lokasi baru pusat distribusi air** berbasis skenario, dengan 11 titik utama + opsi 3 titik temporer.

Semua data dan kode ada dalam paket ini. Frontend belum dibangun. Data yang paling mudah dimuat terdapat dalam `public/data/`. **Halaman distribusi yang utama adalah titik usulan, BUKAN data bantuan air eksisting.** Laporan eksisting Klegung/Perbutan hanya pembanding historis yang belum punya GPS bak; jangan ditampilkan sebagai pin atau dibandingkan angka rute aktual.

Target acceptance pertama: 3.583 bangunan, empat nilai RC per poligon, RCHP RC0,80 ≈510.668,75 m³/tahun; 10.958 hari CHIRPS; YAS 45 benchmark; 11 titik skenario mencapai 3.434/3.583 bangunan dengan radius 500 m lurus, ditambah 3 titik mencapai 3.517/3.583; halaman kualitas tidak pernah menyatakan aman diminum. Titik model, jarak lurus dan seluruh nilai kebutuhan harus diberi label skenario.

Baca `README_START_HERE.md` → `docs/SCREEN_SPEC.md` → `docs/API_AND_DATA_CONTRACT_v3.md` → `docs/SPRINT_AND_SIGNOFF_v3.md`. Uji dengan `python tests/test_master_handoff.py`, `node tests/test_integrated.js`.
