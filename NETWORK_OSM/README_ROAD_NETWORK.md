# KATONGAN OSM NETWORK — OVERPASS 502 FIX v5.1

## Why the old notebook failed
The Overpass endpoint `overpass-api.de` returned HTTP 502 (all query workers busy) during the **driving** graph download. The old code sent an overly detailed polygon with hundreds/thousands of boundary vertices. No network optimization was computed.

## What changed
- `graph_from_bbox()` uses a simple buffered rectangle instead of the long polygon in the Overpass request; original boundary still constrains buildings and site candidates.
- Try `https://overpass.private.coffee/api` then `https://overpass-api.de/api`; each failure uses a limited retry.
- Genuine `walk.graphml` and `drive.graphml` are saved separately as soon as retrieved in `NETWORK_OSM/osm_graph_cache`.
- Failure never generates synthetic roads; error JSON is saved.
- All outputs explicitly state provenance and are still proposals, not field-verified sites.

## Execute in Google Colab
1. Open `notebooks/AGC2027_Katongan_OSM_Network_Location_Allocation_Colab.ipynb` from this **v5.1 ZIP**.
2. Upload the **v5.1 master ZIP** when the notebook asks. Do not upload the original v5.
3. Run cells in order; the download cell streams status messages.
4. If both public servers are busy, run the download cell again later. Existing genuine graph files are reused during the same session.
5. When the model succeeds, download `Katongan_OSM_Network_Results.zip`; then use `NETWORK_OSM/import_osm_results.py` per the final notebook cell.

## Other provider
To use another documented OSM Overpass instance with authorization, change `--endpoints` at cell 5. Values must be base URL paths ending with `/api`, **not** `/api/interpreter` (OSMnx adds the interpreter suffix).

## Independent tests (without internet)
`python NETWORK_OSM/test_network_core.py`
`python NETWORK_OSM/test_network_download.py`

## Limitations
The model uses road network geometry, approximate last-mile straight connectors, and building centroid DEMAND PROXIES. Road-distance coverage is not a field-verified walking distance. Road nodes are not buildable sites and vehicle access is not verified. Original 95.84% is 500 m Euclidean coverage, **not** network coverage. Real OSM downloading remains mandatory.
