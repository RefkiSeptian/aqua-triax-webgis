# Evidence Status — wajib terlihat dalam produk

| Item | Evidence status | UI label |
|---|---|---|
| Climate daily 1996-2025 | CHIRPS modeled gridded reanalysis | `GRIDDDED_RAINFALL_NOT_GAUGE` |
| Annual polygon RWH | Pixel CHIRPS x Google Open Buildings proxy footprint x scenario RC | `THEORETICAL_SCREENING` |
| Building detection | AI-generated Google Open Buildings v3 | `DETECTED_NOT_FIELD_VERIFIED` |
| Visual audit pilot 40 | User-supplied judgments, purposive confidence strata, small sample | `PILOT_ONLY` |
| Household population | Not available | `MISSING_HOUSEHOLD_OCCUPANCY` |
| YAS daily household reliability | AOI-mean rainfall and user-set household parameters | `SCENARIO` |
| First flush diverted volume | Daily rainfall event proxy and unvalidated depth scenarios | `HYPOTHETICAL_SENSITIVITY` |
| Water quality hazard | Literature + questionnaire hypothetical, no local lab | `UNVERIFIED_HAZARD` |
| Treatment performance | No performance or lab data Katongan | `NOT_DEMONSTRATED` |
| Drinking-water compliance | No verified legal thresholds & site samples | `NOT_CERTIFIED` |
| Proposed new waterpoints (11+3) | Scenario-only Euclidean heuristic | `MODEL_SEARCH_CENTER_UNVERIFIED` |
| New waterpoint access by roads | Not calculated | `NO_ROAD_NETWORK_VALIDATION` |
| Historical Klegung/Perbutan aid | Verified as areas in narrative only; no precise GPS | `OBSERVED_AREA_ONLY_NO_GPS` |
