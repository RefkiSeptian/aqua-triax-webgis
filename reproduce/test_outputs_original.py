import json
from pathlib import Path
import pandas as pd
import geopandas as gpd

root=Path(__file__).resolve().parents[1]
o=root/'outputs'
s=json.loads((o/'model_summary.json').read_text())
base=pd.read_csv(o/'proposed_site_search_centres_11.csv')
add=pd.read_csv(o/'phase2_supplementary_centres.csv')
comp=pd.read_csv(o/'scenario_site_count_comparison.csv')
b=pd.read_csv(o/'building_to_site_assignment.csv')
assert len(base)==11 and len(add)==3
assert base.site_id.is_unique and add.site_id.is_unique
assert len(b)==3583 and b.full_plus_code.is_unique
assert set(b.assigned_site_id)==set(base.site_id)
assert sum(b.covered_500m_straight)==3434
assert round(sum(b.covered_500m_straight)/3583*100,2)==95.84
assert s['phase2_covered_500m']==3517
assert s['phase2_remaining_outside_500m']==66
assert sum(base.nearest_assigned_buildings)==3583
assert len(comp)==26
assert (base.location_status=='MODEL_SEARCH_CENTER_UNVERIFIED').all()
assert not base.road_entrance_verified.any()
assert not base.public_land_verified.any()
assert gpd.read_file(o/'proposed_site_search_centres_11.geojson').crs.to_epsg()==4326
print('PASS: baseline 11, supplementary 3, 3583 demand proxies, 3434/3517 coverage, all hypothetical flags')
