> **LEGACY VERSION — DEPRECATED FOR CURRENT SI HANDOFF.** See `README_START_HERE.md` and `docs/API_AND_DATA_CONTRACT_v3.md`. Prospective 11+3 sites are now primary; historical aid is comparator only.

# Backlog dan Serah Terima antar anggota

## Sprint 0 — data freeze (done in this package)
- Geografi A: annual 1996–2025, daily, SPI3/6, CDD, baseline YAS 45 benchmarks. Status: READY_FOR_INTEGRATION, not ground-validated.
- Geografi B: 3583 Google Open Buildings polygons + pixel RCHP four RC. Status: READY_FOR_INTEGRATION, roof materials & occupancy unverified.
- Kesling: 3 demand scenarios; contaminant/technology/control matrix; sanitary checklist; noncertifying decision rules. Status: READY_FOR_REVIEW_AND_INTEGRATION; legal threshold and actual system testing PENDING.
- SI: integration and QA not yet completed.

## Sprint 1 — MVP SI
A. Map and filters; IDs, 4 RC Kpis, metadata.
B. Climate dashboard and YAS baseline with 45 benchmark QA.
C. Demand scenario card and first-flush toggle (OFF by default).
D. Quality panel using checklist + rule engine; citation and limitations.
E. Screens empty-state existing aid distribution; test readiness gating.

## Sprint 2 — completeness and research quality
- Geografi B: verifiable existing aid point coords/capacity, recipient demand and road-network matrix. No coordinates without provenance. Test solver outside this package.
- Kesling: verify exact current national threshold per intended use, target contaminant and lab method, test data if available, treatment costs/maintenance if citing.
- Geografi A: roof/RC sensitivity cross-runs; scenario first-flush sensitivity cannot be validated without event-scale data; optional YAS sensitivity across area/demand/tank sizes.
- SI: data validation/admin upload, configurable metadata, versioning, accessible UI, production QA.

## Responsibility & release gates
| Gate | Responsible | Condition |
|---|---|---|
| G1 climate math | Geography A | 45 YAS tests + SPI/CDD labels + unit agreement |
| G2 spatial RWH | Geography B | 3583 ID joined + 4 RC sums + source labels |
| G3 water quality | Environmental Health | Treatment limits reviewed, health regulation status checked, no-potable assertions |
| G4 product | Information Systems | UI tests, tests passed, sources displayed, no synthetic aid data |
| G5 real distribution | Geography B + SI | Verified spatial inputs and road routes available; otherwise blocked |
