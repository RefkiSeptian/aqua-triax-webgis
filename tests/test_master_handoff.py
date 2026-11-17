"""Master v3 integration checks using Python standard library only."""
import csv, json, math
from pathlib import Path
R = Path(__file__).resolve().parents[1]

def FC(rel):
    with (R/rel).open(encoding='utf8') as f: return json.load(f)['features']
def J(rel):
    with (R/rel).open(encoding='utf8') as f: return json.load(f)
def C(rel):
    with (R/rel).open(newline='',encoding='utf-8-sig') as f: return list(csv.DictReader(f))

meta = J('public/data/metadata.json')
buildings = FC('public/data/katongan_buildings_rwh.geojson')
assert len(buildings) == 3583
bp = [b['properties'] for b in buildings]
ids = [p['id'] for p in bp]
assert len(ids) == len(set(ids))
assert all(p['area_m2'] > 0 and 0.7 <= p['confidence'] <= 1 for p in bp)
assert set(p['validation'] for p in bp) == {'NOT_FIELD_VERIFIED'}
for code,expected in meta['rwh']['total_rwh_scenarios_m3_yr'].items():
    rwhkey = 'rwh_rc'+code.replace('RCHP_RC','').lower()+'_m3yr'
    calc = sum(float(p[rwhkey]) for p in bp)
    assert abs(calc-expected)<0.05, (code,calc,expected)
for rel,n in [('data/katongan_daily_rain_1996_2025.csv',10958),('data/katongan_monthly_spi_1996_2025.csv',360),('data/katongan_cdd_sensitivity.csv',90)]:
    assert len(C(rel)) == n,rel

base = FC('public/data/distribution/proposed_site_search_centres_11.geojson')
addon = FC('public/data/distribution/phase2_supplementary_centres.geojson')
assert (len(base), len(addon)) == (11,3)
assert len({i['properties']['site_id'] for i in base+addon}) == 14
assert all('UNVERIFIED' in i['properties']['location_status'] for i in base+addon)
assign = FC('public/data/distribution/building_to_site_assignment_points.geojson')
phase2 = FC('public/data/distribution/phase2_building_assignments.geojson')
assert len(assign) == len(phase2) == 3583
assert len({f['properties']['full_plus_code'] for f in assign}) == 3583
assert len({f['properties']['full_plus_code'] for f in phase2}) == 3583
assert {f['properties']['full_plus_code'] for f in assign} == set(ids)
assert {f['properties']['full_plus_code'] for f in phase2} == set(ids)
assert sum(f['properties']['covered_500m_straight'] in [True,1,'True','true'] for f in assign) == 3434
assert sum(f['properties']['covered_500m_straight_phase2'] in [True,1,'True','true'] for f in phase2) == 3517
assert meta['prospective_sites']['distance_type'] == 'EUCLIDEAN'
assert meta['kesling']['has_local_laboratory_data'] is False
assert meta['kesling']['potability_assertion_allowed'] is False
print('PASS MASTER V3:', len(buildings),'buildings;',len(base),'+',len(addon),'proposed centres; 3434/3517 covered; RWH RC sums match.')
