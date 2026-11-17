> **LEGACY VERSION — DEPRECATED FOR CURRENT SI HANDOFF.** See `README_START_HERE.md` and `docs/API_AND_DATA_CONTRACT_v3.md`. Prospective 11+3 sites are now primary; historical aid is comparator only.

# API / Data contracts (data-first, backend optional)

## Static inputs
`GET /data/katongan_boundary.geojson` => EPSG4326 polygon.
`GET /data/katongan_buildings_rwh.geojson` => 3583 Features.
Required polygon properties: `id`, `area_m2`, `confidence`, `rain_mm_annual`, `rwh_rc70_m3yr`, `rwh_rc80_m3yr`, `rwh_rc84_m3yr`, `rwh_rc90_m3yr`.

## Dynamic front-end modules (pure JS)
- `householdDemand(persons, litersPerPersonPerDay)` from `src/demand.js`.
- `simulateYAS(rainRows,{roof_m2,rc,demand_lpd,tank_l})` baseline from `src/yas.js`.
- `simulateYASWithFirstFlush(rainRows,scenario,firstFlush)` optional. Default `depth_mm:0` matches YAS.
- `assessWaterQuality({intended_use,has_lab_report,lab_complete,sanitary_flags})` from `src/quality_rules.js`.
- `validateDistributionReadiness({sites,demandNodes,roadCosts})` from `src/distribution_readiness.js`.

## Suggested API endpoints
- `GET /api/v1/metadata`
- `GET /api/v1/buildings?bbox=&minConfidence=&rc=`
- `GET /api/v1/climate/annual`, `/monthly`, `/cdd?threshold_mm=1`
- `POST /api/v1/rwh/yas`: `{roof_m2,rc,demand_lpd,tank_l,first_flush?:{depth_mm,dry_gap_days,dry_day_threshold_mm}}`
- `POST /api/v1/demand`: `{persons,demand_lpcd}`
- `POST /api/v1/water-quality/assessment`: see `schemas/quality_decision_contract.json`
- `GET /api/v1/water-aid/readiness`: missing inputs, no fabricated features.

## Error semantics
- `400`: invalid numeric parameter, unsupported use, missing flags.
- `422`: inputs missing before solver or threshold could be applied.
- `200` (advisory): `NOT_VERIFIED` for missing labs, not successful approval.
- `503/NOT_READY`: verified aid network absent; use informative not-ready state.

## UOM and invariants
- EPSG4326 lon/lat; area square meters; rain mm/year or mm/day as explicit field; volume m³/year or L/day. JS YAS internally uses liters. Do not mix total RWH annual pixel output and AOI daily rain stream as if same resolution. Dates YYYY-MM-DD no timezone offset.
