# Decision Table — Kesling (Non-Certifying)

Aturan di `src/quality_rules.js` sengaja konservatif. Status hasil adalah pendamping pengambilan keputusan, bukan pernyataan baku mutu atau dosis pengolahan.

| Input | Keluaran wajib | Jangan diklaim |
|---|---|---|
| Drinking / Cooking, tanpa hasil lab lengkap | `NOT_VERIFIED`, tes E. coli/panel yang relevan, tinjauan regulasi | Air minum aman |
| Material atap tidak diketahui | Telaah material, uji kimia bila indikasi | Semua atap desa genteng |
| Ada risiko kontaminasi kimia | Pengendalian sumber, pemeriksaan kimia terarah | Klorin/boiling menghilangkan kimia |
| Tangki terbuka/kasa rusak | Proteksi tangki dan pengendalian akses vektor | Nyamuk pasti ada |
| Air keruh | Pengukuran kekeruhan, pertimbangkan pengendapan/filtrasi | UV akan efektif tanpa evaluasi transmisi |
| Ada data lab lengkap | `NEEDS_QUALIFIED_REVIEW` sampai ahli memeriksa mutu/sumber/sampling/peraturan | Otomatis memenuhi syarat minum |

**Sanitary inspection**: checklist 10 butir adalah adaptasi operasional proyek dari prinsip WHO 2026, **bukan salinan form WHO yang tervalidasi dan bukan instrument skor risiko probabilistik**. `yes` berarti indikasi faktor risiko perlu ditindaklanjuti; tidak menghasilkan peluang kontaminasi kuantitatif.
