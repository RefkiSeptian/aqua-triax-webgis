"""AGC 2027 Katongan: road-network prospective water-point siting.

Run in Google Colab or any Python environment with an internet connection:
  python NETWORK_OSM/run_network_osm.py --project .

Authentic OSM road download via Overpass; NEVER substitutes synthetic roads.
Output is a SCENARIO OF POSSIBLE STREET NODE SEARCH CENTRES, NOT VERIFIED LAND.
"""
import argparse
from datetime import datetime,timezone
from pathlib import Path
import json,sys,math

import numpy as np
import pandas as pd
import geopandas as gpd
import networkx as nx
import shapely
from shapely.geometry import Point
from scipy.spatial import cKDTree
from pyproj import Transformer

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from network_core import service_distance_matrix,select_facilities
from network_download import acquire_osm_graphs, DEFAULT_ENDPOINTS

PARSER=argparse.ArgumentParser()
PARSER.add_argument('--project',type=Path,default=HERE.parent)
PARSER.add_argument('--radius',type=float,default=500.)
PARSER.add_argument('--target',type=float,default=.95)
PARSER.add_argument('--max-sites',type=int,default=30)
PARSER.add_argument('--max-access',type=float,default=125.)
PARSER.add_argument('--bbox-buffer-m',type=float,default=1000.,help='Outer bbox buffer around Katongan polygon in meters')
PARSER.add_argument('--endpoints',type=str,default=','.join(DEFAULT_ENDPOINTS),help='Comma-separated Overpass BASE URLs ending in /api')
PARSER.add_argument('--attempts-per-endpoint',type=int,default=2)
PARSER.add_argument('--retry-base-seconds',type=float,default=6.)
PARSER.add_argument('--request-timeout',type=int,default=120)
ARGS=PARSER.parse_args()
ROOT=ARGS.project.resolve(); OUT=ROOT/'NETWORK_OSM'/'results';OUT.mkdir(parents=True,exist_ok=True)
# Ensure a failed new run cannot be mistaken for a successful current result.
(OUT/'NETWORK_MODEL_SUMMARY.json').unlink(missing_ok=True)

def savejson(name,obj):
 (OUT/name).write_text(json.dumps(obj,indent=2,ensure_ascii=False,default=lambda o:float(o) if isinstance(o,np.floating) else int(o)),encoding='utf-8')

def file(name):
 p=ROOT/'public'/'data'/name
 if not p.exists():raise FileNotFoundError(f'Missing {p}')
 return p

try:
 import osmnx as ox
except ImportError as exc:
 raise SystemExit('Install: pip install osmnx==2.1.1 geopandas scipy networkx shapely') from exc

print('01 / Study area + 3583 building footprints')
aoi=gpd.read_file(file('katongan_boundary.geojson')).to_crs('EPSG:32749')
bld=gpd.read_file(file('katongan_buildings_rwh.geojson')).to_crs('EPSG:32749')
assert len(bld)==3583,'Expected 3583 Google building candidates'
assert bld['id'].is_unique,'Non unique building IDs'
polygon=aoi.geometry.union_all()
centroids=bld.geometry.centroid
bxy=np.c_[centroids.x.to_numpy(),centroids.y.to_numpy()]
tree=cKDTree(bxy)
spacing=185
lo,low,hi,high=polygon.bounds
hexpoints=[]
for iy,y in enumerate(np.arange(low,high,spacing*.866)):
 for x in np.arange(lo,hi,spacing)+(spacing/2 if iy%2 else 0):
  if polygon.contains(Point(x,y)) and tree.query((x,y))[0]<230 and len(tree.query_ball_point((x,y),200))>=1:
   hexpoints.append((x,y))
hexpoints=np.asarray(hexpoints,dtype=float)
print('Centroid count',len(bxy),'Hex candidates',len(hexpoints))

print('02 / Authentic OSM walk + drive graphs; 502-resilient bbox query')
# IMPORTANT: use a bounding rectangle, not a thousands-vertex polygon encoded
# into Overpass QL. The full Katongan border still filters demand and sites.
request_bbox_geom=gpd.GeoSeries([polygon.buffer(ARGS.bbox_buffer_m)],crs='EPSG:32749').to_crs(4326).iloc[0]
request_bbox=request_bbox_geom.bounds  # (west,south,east,north)
print('OSM query bbox [west,south,east,north]:',tuple(round(v,6) for v in request_bbox),flush=True)
try:
 Gwalk,Gdrive,osm_provenance=acquire_osm_graphs(
  ox,bbox=request_bbox,cache_dir=ROOT/'NETWORK_OSM'/'osm_graph_cache',
  endpoints=[x.strip() for x in ARGS.endpoints.split(',') if x.strip()],
  attempts_per_endpoint=ARGS.attempts_per_endpoint,
  retry_base_seconds=ARGS.retry_base_seconds,
  request_timeout_seconds=ARGS.request_timeout)
except Exception as e:
 error={'network_download_status':'FAILED_NO_NETWORK_RESULT','error_type':type(e).__name__,
        'detail':str(e)[:2000],
        'note':'Overpass unavailable. REAL previously fetched graphs are cached if any; rerun with v5.1. No synthetic road outputs.'}
 savejson('NETWORK_DOWNLOAD_FAILED.json',error)
 raise RuntimeError('Overpass/OSM road acquisition failed. No network optimization was computed.') from e
(OUT/'NETWORK_DOWNLOAD_FAILED.json').unlink(missing_ok=True)
Gwalk=ox.project_graph(Gwalk,to_crs='EPSG:32749')
Gdrive=ox.project_graph(Gdrive,to_crs='EPSG:32749')
print('OSM graph nodes walk/drive:',len(Gwalk),len(Gdrive))
if len(Gwalk)==0 or len(Gdrive)==0: raise RuntimeError('OSM graph empty. Stop without invented results.')

# Save observed road geometries, not a surrogate grid network.
print('03 / Export real OSM network edges')
for label,G in [('walk',Gwalk),('drive',Gdrive)]:
 roads=ox.graph_to_gdfs(G,nodes=False,edges=True)[['geometry','highway','length']].reset_index(drop=True)
 roads['road_class']=roads.highway.apply(lambda x:','.join(map(str,x)) if isinstance(x,list) else str(x))
 roads['length_m']=pd.to_numeric(roads['length'],errors='coerce')
 roads=roads[['road_class','length_m','geometry']]
 roads.to_crs(4326).to_file(OUT/f'osm_roads_{label}.geojson',driver='GeoJSON')
 print(label,'road edges:',len(roads))

# walk graph is undirected for walking distances only; vehicular one-way restriction preserved
# in drive graph for future vehicle routing when verified water-source coordinates exist.
Gw=Gwalk.to_undirected()

def points_nodes(G,xy):
 ids=list(G.nodes)
 coords=np.array([(G.nodes[k]['x'],G.nodes[k]['y']) for k in ids],dtype=float)
 dist,ix=cKDTree(coords).query(xy)
 return np.array([ids[int(i)] for i in np.atleast_1d(ix)],dtype=object),np.atleast_1d(dist),coords[np.atleast_1d(ix)]

print('04 / Snap buildings and candidate SEARCH centres to OSM')
demand_nodes,demand_access,_=points_nodes(Gw,bxy)
# street-screened site centres: point must be near real drive and pedestrian nodes.
drive_ids,drive_access,drive_xy=points_nodes(Gdrive,hexpoints)
walk_ids,walk_access,_=points_nodes(Gw,drive_xy)
valid=(drive_access<=ARGS.max_access)&(walk_access<=ARGS.max_access)&np.array([polygon.contains(Point(x,y)) for x,y in drive_xy])
site_xy,site_walk_node,site_walk_access,site_drive_node=drive_xy[valid],walk_ids[valid],walk_access[valid],drive_ids[valid]
# One proposed centre per unique OSM drive node, deterministic first encountered.
seen=set();keep=[]
for i,node in enumerate(site_drive_node):
 if node in seen:continue
 seen.add(node);keep.append(i)
site_xy=site_xy[keep];site_walk_node=site_walk_node[keep];site_walk_access=site_walk_access[keep];site_drive_node=site_drive_node[keep]
print('Candidates matched to drive+walk graph:',len(site_xy),' / ',len(hexpoints))
if not len(site_xy):raise RuntimeError('No walk+drive-accessible candidate centre; no network result created')

print('05 / Walking network distance with explicit off-road connector distances')
D=service_distance_matrix(Gw,demand_nodes,demand_access,site_walk_node,site_walk_access,
                          radius_m=ARGS.radius,max_demand_access_m=ARGS.max_access)
accessible_demand=(demand_access<=ARGS.max_access)
reachable_any=np.any(D<=ARGS.radius,axis=1)
print('Demand connected to walk graph (<125m):',int(accessible_demand.sum()))
print('Demand that CAN be served by some candidate <=500m:',int(reachable_any.sum()))

print('06 / Prospective maximal covering on WALKING network')
chosen,history,assign,dist=select_facilities(D,max_p=ARGS.max_sites,radius_m=ARGS.radius,target=ARGS.target)
covered=dist<=ARGS.radius
# Use proper network-based counts, never reuse straight-line coverage.
print('Network selected facilities:',len(chosen),'covered',int(covered.sum()),'/',len(covered))
C=len(chosen)
assign_site=np.array([f'NET-S{i+1:02d}' if np.isfinite(dist[k]) else 'UNREACHABLE_OR_UNMAPPED' for k,i in enumerate(assign)],dtype=object)
xy2ll=Transformer.from_crs(32749,4326,always_xy=True)
lon,lat=xy2ll.transform(site_xy[np.asarray(chosen),0],site_xy[np.asarray(chosen),1])
site_rows=[]
for i,ci in enumerate(chosen):
 assigned=(assign==i)&np.isfinite(dist)
 site_rows.append({'site_id':f'NET-S{i+1:02d}',
  'longitude':round(float(lon[i]),7),'latitude':round(float(lat[i]),7),
  'x_utm':round(float(site_xy[ci,0]),2),'y_utm':round(float(site_xy[ci,1]),2),
  'osm_drive_node_id':str(site_drive_node[ci]),'osm_walk_node_id':str(site_walk_node[ci]),
  'drive_road_center_screened':True,'land_rights_verified':False,'slope_verified':False,
  'truck_access_verified_on_ground':False,'water_source_verified':False,
  'health_quality_verified':False,
  'candidate_status':'OSM_ROAD_NODE_ONLY_NO_PHYSICAL_SITE_VALIDATION',
  'assigned_buildings':int(assigned.sum()),
  'covered_within_500m_network_plus_connectors':int(np.sum(assigned&covered)),
  'screening_demand_L_day':round(float(assigned.sum()*5569*.5*15/len(bld)),1)})
site_df=pd.DataFrame(site_rows);site_df.to_csv(OUT/'proposed_network_sites.csv',index=False)
gpd.GeoDataFrame(site_df,geometry=gpd.points_from_xy(site_df.longitude,site_df.latitude),crs='EPSG:4326').to_file(OUT/'proposed_network_sites.geojson',driver='GeoJSON')
# Centres and sites need physical clearance checks even when they overlap mapped OSM road nodes.
siteareas=gpd.GeoDataFrame(site_df[['site_id','candidate_status']],geometry=[Point(x,y).buffer(150) for x,y in site_xy[np.asarray(chosen)]],crs='EPSG:32749')
siteareas.to_crs(4326).to_file(OUT/'site_150m_physical_screening_zones.geojson',driver='GeoJSON')
assignment=pd.DataFrame({'building_id':bld['id'], 'assigned_network_site':assign_site,
 'distance_network_plus_access_m':np.where(np.isfinite(dist),dist,np.nan),
 'covered_500m_network':covered, 'building_road_access_connector_m':np.round(demand_access,1),
 'building_walk_road_nearby':accessible_demand,
 'status':'OSM_SCENARIO_NOT_FIELD_VERIFIED'})
assignment.to_csv(OUT/'building_to_network_site.csv',index=False)
gpd.GeoDataFrame(assignment,geometry=centroids,crs='EPSG:32749').to_crs(4326).to_file(OUT/'building_to_network_site.geojson',driver='GeoJSON')

print('07 / Compare PREVIOUS 11 straight-line centres on SAME walking network')
prior=gpd.read_file(ROOT/'public'/'data'/'distribution'/'proposed_site_search_centres_11.geojson').to_crs('EPSG:32749')
priorxy=np.c_[prior.geometry.x,prior.geometry.y]
prwalk,praccess,_=points_nodes(Gw,priorxy)
Dold=service_distance_matrix(Gw,demand_nodes,demand_access,prwalk,praccess,
  radius_m=ARGS.radius,max_demand_access_m=ARGS.max_access)
prior_covered=np.any(Dold<=ARGS.radius,axis=1)
comparator={'proposed_new_network_sites':len(chosen),'new_network_covered':int(covered.sum()),
 'new_network_coverage_pct':round(float(covered.mean()*100),4),
 'previous_11_centres_screened_over_OSM_network_coverage_pct':round(float(prior_covered.mean()*100),4),
 'prior_11_centres_covered_count_on_OSM_network':int(prior_covered.sum()),
 'prior_11_centres_near_walk_node_le125m':int(np.sum(praccess<=ARGS.max_access)),
 'caution':'Prior Euclidean locations are hypothetical; this is an apples-to-apples network scenario comparison, not baseline government operation.'}

print('08 / Outputs and explicit verification gates')
pd.DataFrame(history).to_csv(OUT/'network_greedy_coverage_curve.csv',index=False)
rows=[]
for _,s in site_df.iterrows():
 rows.append({'site_id':s.site_id,'road_graph_screened':'YES_OSM_ONLY','land_ownership':'UNKNOWN',
  'land_authority_or_document':'','slope_or_hazard':'UNKNOWN','on_site_truck_maneuver':'UNKNOWN',
  'daily_supply_capacity_L':'UNKNOWN','source_water_coordinates':'UNKNOWN',
  'water_quality_test':'NOT_AVAILABLE','site_viability':'NOT_VERIFIED',
  'team_review_notes':''})
pd.DataFrame(rows).to_csv(OUT/'SITE_FEASIBILITY_FIELD_REVIEW_REQUIRED.csv',index=False)
summary={
 'run_utc':datetime.now(timezone.utc).isoformat(),
 'data_source':'OpenStreetMap walking + driving network via Overpass / OSMnx',
 'graph_provenance':osm_provenance,
 'validation_status':'NETWORK_ANALYSIS_ONLY_NOT_OPERATIONAL_SITING',
 'N_building_footprint_proxies':len(bld),'n_hex_original':len(hexpoints),
 'n_site_candidates_walk_drive_screened':len(site_xy),
 'n_demand_near_walk_network':int(accessible_demand.sum()),
 'n_demand_any_candidate_within_500m':int(reachable_any.sum()),
 'selected_site_count':C,'n_covered_500m_network_plus_access':int(covered.sum()),
 'coverage_network_pct':float(covered.mean()*100),
 'target_reached':bool(covered.mean()>=ARGS.target),
 'search_max_sites':ARGS.max_sites,
 'service_distance_m':ARGS.radius,'max_connector_distance_m':ARGS.max_access,
 'algorithm':'greedy maximum coverage + limited local-swap heuristic, no global optimum guarantee',
 'network_details':{'walk_nodes':len(Gwalk),'walk_edges':len(Gwalk.edges),'drive_nodes':len(Gdrive),'drive_edges':len(Gdrive.edges)},
 'comparison_previous_11_straightline_centres':comparator,
 'very_important_limits':[
   'OSM road tagging may omit walkways or truck access and require verification',
   'Nearest-node connector distances are assumed straight to the network; access rights and slope unknown',
   'Sites are DRIVE-NETWORK NODES; not plots of land or buildable tanker facilities',
   'No vehicle route optimization because real source/depot, capacities and truck schedules unavailable',
   'Demand nodes are BUILDING footprint centroids, not households or drought-affected beneficiaries',
   '50% affected ×15 L/day scenario is hypothetical, not surveyed',
   'Original 11 sites and new network points must not be described as empirically verified',
   'Water safety testing and land title verification cannot be performed with remote OSM alone'
 ]
}
savejson('NETWORK_MODEL_SUMMARY.json',summary)
print(json.dumps({k:summary[k] for k in ['selected_site_count','coverage_network_pct','target_reached']},indent=2))
print('RESULTS:',OUT)
