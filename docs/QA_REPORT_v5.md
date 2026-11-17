# QA report — Katongan v5

## Berhasil diuji lokal

- Dataset: 3.583 Google Open Buildings candidates and 4 RC scenarios; computed totals agree with GEE sensitivity CSV (up to rounding).
- 8 GeoPackage layers read correctly: AOI 1, buildings 3583, sites 11+3, site search 11, coverage buffers 11, assignments 3583 each.
- Shapefile folders: 8, all have .shp/.shx/.dbf/.prj/.cpg.
- CHIRPS 10.958 daily observations; 45 YAS reference scenarios already in preceding tests.
- Node.js `tests/test_integrated.js`: YAS, first-flush proxy, demand and treatment non-certification passed.
- Python `NETWORK_OSM/test_network_core.py`: synthetic **unit test only** for route distances, disconnected roads and greedy allocation; **not evidence of authentic Katongan road-network analysis**.
- WebGIS six sections: offline browser interaction tests with packaged data passed; RC 0.80 = 510,669 m³/yr, RC0.70 = 446,835 m³/yr; YAS 86.92% standard test; Euclidean 11 site 95.84%; 14 site 98.16%; quality status non-certified.
- `node --check` WebGIS script passed. Browser visual test of remote map tiles/CDN could **not** be completed due the current environment's network restrictions; interactive non-map UI was tested by a local Chromium browser with mocks.

## Not done, and cannot be asserted

- No real OSM road graph downloaded in this environment; the new script and Colab notebook are **execution-ready** but the full network analysis is not run on Katongan.
- No actual public-land/land-title verification, vehicle maneuvering, slope-based siting, depot supply/capacity, or lab water quality measurement.
- No household-level surveyed demand; equal weighting of building footprints is only a proxy.
- No public WebGIS deployment or uptime verification. App runs locally and can be hosted with connected authorization.

Use `README_START_HERE.md` as the authoritative release document. Old docs in this archive are historical and may contain earlier planning approaches.
