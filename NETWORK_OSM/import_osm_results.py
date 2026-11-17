"""Integrate *successful* authentic Colab road outputs into WebGIS and GIS exports.

Usage:
    python NETWORK_OSM/import_osm_results.py --project . --results-zip Katongan_OSM_Network_Results.zip

This command NEVER creates road layers unless real OSM extraction produced them.
"""
import argparse,zipfile,tempfile,shutil,json
from pathlib import Path
from clip_webgis_roads import write_webgis_road_layers

ap=argparse.ArgumentParser()
ap.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
ap.add_argument('--results-zip',required=True,type=Path)
a=ap.parse_args()
root=a.project.resolve()
if not a.results_zip.is_file():raise FileNotFoundError(a.results_zip)
with tempfile.TemporaryDirectory() as temp:
    tmp=Path(temp)
    with zipfile.ZipFile(a.results_zip) as z:z.extractall(tmp)
    def located(name):
        match=list(tmp.rglob(name))
        if len(match)!=1:raise FileNotFoundError(f'Expected exactly one {name} in ZIP; found {len(match)}')
        return match[0]
    summary=json.loads(located('NETWORK_MODEL_SUMMARY.json').read_text())
    assert summary['data_source'].startswith('OpenStreetMap'), 'Not documented OSM result'
    assert summary['validation_status']=='NETWORK_ANALYSIS_ONLY_NOT_OPERATIONAL_SITING'
    for key in ['osm_roads_walk.geojson','osm_roads_drive.geojson','proposed_network_sites.geojson','building_to_network_site.geojson']:
        contents=json.loads(located(key).read_text())
        assert contents.get('type')=='FeatureCollection' and len(contents.get('features',[]))>0, (key,'No real features')
    files={'osm_roads_walk.geojson':'network_roads_walk.geojson',
      'osm_roads_drive.geojson':'network_roads_drive.geojson',
      'proposed_network_sites.geojson':'network_sites.geojson',
      'building_to_network_site.geojson':'network_assignments.geojson',
      'NETWORK_MODEL_SUMMARY.json':'network_summary.json'}
    for src,out in files.items():shutil.copy2(located(src),root/'WEBGIS_READY'/'data'/out)
    write_webgis_road_layers(root/'WEBGIS_READY'/'data')
    dest=root/'NETWORK_OSM'/'results';dest.mkdir(exist_ok=True)
    for f in tmp.rglob('*'):
        if f.is_file():shutil.copy2(f,dest/f.name)
    # For QGIS, create only the authentic post-run network layers
    import geopandas as gpd
    outgpkg=root/'GIS'/'Katongan_AGC2027_network_layers.gpkg'
    if outgpkg.exists():outgpkg.unlink()
    for filename,layer in [('osm_roads_walk.geojson','osm_roads_walk'),('osm_roads_drive.geojson','osm_roads_drive'),('proposed_network_sites.geojson','proposed_network_sites'),('building_to_network_site.geojson','network_assignments')]:
        gdf=gpd.read_file(located(filename)).to_crs(4326)
        gdf.to_file(outgpkg,layer=layer,driver='GPKG',mode='a' if outgpkg.exists() else 'w')
    print('IMPORTED verified-computation OSM network (not physically verified sites):',summary['selected_site_count'], 'sites;',round(summary['coverage_network_pct'],3),'% nominal network access')
    print('GIS',outgpkg)
    print('WebGIS data can now show the network mode after reload.')
