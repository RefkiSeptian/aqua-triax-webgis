from pathlib import Path
import csv, json, math
R=Path(__file__).resolve().parents[1]
def rows(path):
 with (R/path).open(newline='',encoding='utf8') as f:return list(csv.DictReader(f))
meta=json.loads((R/'docs/MODEL_METADATA.json').read_text())
polys=json.loads((R/'public/data/katongan_buildings_rwh.geojson').read_text())['features']
source=rows('data/katongan_rwh_pixel_scenarios_source.csv')
rain=rows('data/katongan_daily_rain_1996_2025.csv')
month=rows('data/katongan_monthly_spi_1996_2025.csv')
cdd=rows('data/katongan_cdd_sensitivity.csv')
assert len(polys)==3583 and len(source)==3583 and len(rain)==10958 and len(month)==360 and len(cdd)==90
ids=[r['id'] for r in source]
assert len(ids)==len(set(ids))
assert len({f['properties']['id'] for f in polys})==3583
assert all(f['geometry'] and f['geometry']['type'] in ('Polygon','MultiPolygon') for f in polys)
for key,rc in [('RCHP_RC70',.70),('RCHP_RC80',.80),('RCHP_RC84',.84),('RCHP_RC90',.90)]:
 value=sum(float(s[key]) for s in source)
 expected=meta['volume_m3_yr_theoretical'][key]
 assert abs(value-expected)<.01,(key,value,expected)
 for s in source:
  calc=float(s['rain_mm'])*float(s['area_m2'])*rc/1000
  assert abs(calc-float(s[key]))<1e-7
assert all(float(r['rain_mm'])>=0 for r in rain)
assert not month[0]['SPI3'] and not month[0]['SPI6']
print('PASS: 3583 polygons, 10958 days, 360 SPI months, 90 CDD rows, 4 RWH scenario sums')
