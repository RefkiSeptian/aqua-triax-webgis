"""Network v6 authentic-source integration QA (not field validation)."""
from pathlib import Path
import json, geopandas as gpd, pandas as pd, fiona
ROOT=Path(__file__).resolve().parents[1]
r=ROOT/'NETWORK_OSM'/'results'
meta=json.loads((r/'NETWORK_MODEL_SUMMARY.json').read_text())
assert meta['N_building_footprint_proxies']==3583
assert meta['selected_site_count']==30
assert not meta['target_reached']
assert meta['n_site_candidates_walk_drive_screened']==148
assert meta['n_covered_500m_network_plus_access']==3145
assert meta['n_demand_any_candidate_within_500m']==3157
s=pd.read_csv(r/'proposed_network_sites.csv'); a=pd.read_csv(r/'building_to_network_site.csv')
assert len(s)==30 and len(a)==3583
assert s.site_id.is_unique and a.building_id.is_unique
assert a.covered_500m_network.sum()==3145
assert (~a.covered_500m_network).sum()==438
assert ((~a.building_walk_road_nearby)&(~a.covered_500m_network)).sum()==418
assert ((a.building_walk_road_nearby)&(~a.covered_500m_network)).sum()==20
assert s.covered_within_500m_network_plus_connectors.sum()==3145
assert s.assigned_buildings.sum()==3160
assert len(gpd.read_file(r/'osm_roads_walk.geojson'))==4740
assert len(gpd.read_file(r/'osm_roads_drive.geojson'))==4461
G=ROOT/'GIS'/'Katongan_AGC2027_all_layers.gpkg'
layers=fiona.listlayers(G)
assert len(layers)==13,(len(layers),layers)
assert len(gpd.read_file(G,layer='network_sites_30'))==30
assert len(gpd.read_file(G,layer='network_assignment_3583'))==3583
boundary=gpd.read_file(G,layer='katongan_boundary')
sites=gpd.read_file(G,layer='network_sites_30')
assert all(sites.geometry.within(boundary.geometry.union_all()))
assert len(gpd.read_file(G,layer='osm_walk_roads'))==4740
assert len(gpd.read_file(G,layer='osm_drive_roads'))==4461
assert len(gpd.read_file(G,layer='network_screening_150m'))==30
for path in ['network_sites.geojson','network_assignments.geojson','network_summary.json','network_roads_walk.geojson','network_roads_drive.geojson']:
 assert (ROOT/'WEBGIS_READY'/'data'/path).is_file()
web_data = ROOT / "WEBGIS_READY" / "data"
web_boundary = gpd.read_file(web_data / "boundary.geojson").geometry.union_all().buffer(1e-10)
for mode, full_count in (("walk", 4740), ("drive", 4461)):
    displayed = gpd.read_file(web_data / f"katongan_roads_{mode}.geojson")
    assert 0 < len(displayed) < full_count
    assert displayed.geom_type.isin(("LineString", "MultiLineString")).all()
    assert displayed.geometry.covered_by(web_boundary).all()
    assert displayed.geometry.normalize().to_wkb().is_unique
print("PASS displayed roads: both layers are clipped to Katongan")
print('PASS network v6: original source, 30 sites, 3145 covered, 438 uncovered, 13 GPKG layers')
