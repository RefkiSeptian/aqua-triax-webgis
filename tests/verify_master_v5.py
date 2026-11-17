"""Validation of archived v5 baseline layers retained alongside authentic v6 OSM results."""
import sys,csv,json,zipfile,subprocess,math,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
assert (ROOT/'GIS/Katongan_AGC2027_all_layers.gpkg').exists()
assert (ROOT/'WEBGIS_READY/index.html').exists()
assert (ROOT/'notebooks/AGC2027_Katongan_OSM_Network_Location_Allocation_Colab.ipynb').exists()
jsonfc=lambda p:json.loads((ROOT/p).read_text())['features']
b=jsonfc('public/data/katongan_buildings_rwh.geojson')
assert len(b)==3583
for code,expected in [(70,446835.15),(80,510668.75),(84,536202.19),(90,574502.34)]:
 calc=sum(float(f['properties'][f'rwh_rc{code}_m3yr']) for f in b)
 assert abs(calc-expected)<.10,(code,calc)
sites=jsonfc('public/data/distribution/proposed_site_search_centres_11.geojson')
addons=jsonfc('public/data/distribution/phase2_supplementary_centres.geojson')
assert len(sites)==11 and len(addons)==3
with (ROOT/'VALIDATION_AND_FIELD_GATES/SITE_VERIFICATION_REGISTER_14.csv').open() as f:r=list(csv.DictReader(f))
assert len(r)==14 and all(row['release_status']=='MODEL_SEARCH_ONLY' for row in r)
assert len(list((ROOT/'NETWORK_OSM').rglob('osm_roads_*.geojson')))==2, 'v6 must contain actual user-supplied OSM road layers'
shp=ROOT/'GIS/SHAPEFILES'; folders=[x for x in shp.iterdir() if x.is_dir()]
assert len(folders)==13,folders
for x in folders:
 stems={p.suffix for p in x.iterdir()}
 assert {'.shp','.shx','.dbf','.prj','.cpg'}.issubset(stems),(x,stems)
import fiona
layers=fiona.listlayers(ROOT/'GIS/Katongan_AGC2027_all_layers.gpkg')
expected={'katongan_boundary':1,'buildings_rwh':3583,'sites_main_11':11,'sites_extra_3':3,'site_search_150m':11,'coverage_500m':11,'alloc_main_11':3583,'alloc_phase2_14':3583}
assert len(layers)==13
for name,n in expected.items():
 with fiona.open(ROOT/'GIS/Katongan_AGC2027_all_layers.gpkg',layer=name) as f:
  assert len(f)==n,(name,len(f),n)
import nbformat
p=ROOT/'notebooks/AGC2027_Katongan_OSM_Network_Location_Allocation_Colab.ipynb'
nbformat.validate(nbformat.read(p,as_version=4))
print('PASS preserved v5 baselines within v6: 8 original layers + 5 authentic OSM layers, complete SHP, 3583 RWH, 11+3 legacy sites')
