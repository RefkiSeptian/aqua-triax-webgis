"""AGC2027 Katongan scenario-based prospective communal waterpoint siting.

Input: 3583 Google Open Buildings polygons and Katongan AOI.
Method: 185m hex candidate grid + heuristic maximal covering location (500m) vs p-median.
These are map search-centres, NOT verified physical sites, and Euclidean distances are optimistic.
"""
from pathlib import Path
import json, math, csv, sys
import numpy as np
import pandas as pd
import geopandas as gpd
import shapely
from shapely.geometry import Point
from scipy.spatial import cKDTree, distance

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs'
OUT.mkdir(parents=True,exist_ok=True)
AOI_PATH=ROOT/'inputs'/'Katongan_AOI.geojson'
BUILDINGS_PATH=ROOT/'inputs'/'Katongan_Buildings.geojson'
EPSG_METRIC=32749
CONFIG={
  'site_search_grid_spacing_m':185,
  'site_search_grid_vertical_ratio':0.866,
  'candidate_building_proximity_m':230,
  'candidate_neighborhood_check_m':200,
  'minimum_buildings_near_candidate':1,
  'service_radius_m':500,
  'target_fraction_of_detected_buildings_covered':0.95,
  'evaluated_p_min':4,
  'evaluated_p_max':16,
  'affected_fraction_scenario':0.50,
  'target_litres_per_person_day':15,
  'population_reference_total':5569,
  'population_reference_year':'not stated on village website',
  'daily_truck_delivery_unit_litres':5000,
  'search_zone_validation_radius_m':150,
  'method':'greedy+single-swap heuristic, no global optimality certificate'
}

buildings=gpd.read_file(BUILDINGS_PATH).to_crs(EPSG_METRIC)
aoi=gpd.read_file(AOI_PATH).to_crs(EPSG_METRIC)
assert len(buildings)==3583, ('unexpected building count',len(buildings))
assert buildings['full_plus_code'].is_unique
poly=aoi.geometry.union_all()
centroids=buildings.geometry.centroid
xy=np.column_stack([centroids.x.to_numpy(),centroids.y.to_numpy()])
N=len(buildings)
tree=cKDTree(xy)
# spatially even hex search-candidate lattice
minx,miny,maxx,maxy=poly.bounds
spacing=CONFIG['site_search_grid_spacing_m']
raw_grid=[]
for iy,y in enumerate(np.arange(miny,maxy,spacing*CONFIG['site_search_grid_vertical_ratio'])):
    xs=np.arange(minx,maxx,spacing)+(0.5*spacing if iy%2 else 0)
    raw_grid.extend((x,y) for x in xs)
raw_grid=np.asarray(raw_grid,dtype=float)
inside=shapely.contains_xy(poly,raw_grid[:,0],raw_grid[:,1])
raw_grid=raw_grid[inside]
nearby=tree.query_ball_point(raw_grid,CONFIG['candidate_neighborhood_check_m'])
d_nearest=tree.query(raw_grid)[0]
mask=np.array([len(ids)>=CONFIG['minimum_buildings_near_candidate'] for ids in nearby]) & (d_nearest<CONFIG['candidate_building_proximity_m'])
candidates=raw_grid[mask]
assert len(candidates)>30
D=distance.cdist(xy,candidates).astype(np.float32)
cover=(D<=CONFIG['service_radius_m'])
C=len(candidates)

def nearest_info(selected):
    local=D[:,selected]
    nearest_index=np.argmin(local,axis=1)
    nearest_dist=local[np.arange(N),nearest_index]
    return nearest_index,nearest_dist

def score(selected):
    _, d=nearest_info(selected)
    return int(np.count_nonzero(d<=CONFIG['service_radius_m'])), float(np.mean(d))

def mclp_heuristic(p):
    # Stage 1: greedily maximize coverage at radius 500m, deterministic ties.
    selected=[]
    covered=np.zeros(N,dtype=bool)
    for _ in range(p):
        gain=(~covered).astype(np.int16)@cover.astype(np.int16)
        gain=np.asarray(gain,dtype=float)
        gain[selected]=-1
        maxgain=np.max(gain)
        options=np.flatnonzero(gain==maxgain)
        if len(options)>1:
            # secondary select candidate minimizing overall mean distance
            base=np.min(D[:,selected],axis=1) if selected else np.full(N,np.inf)
            candidate_mean=np.minimum(base[:,None],D[:,options]).mean(axis=0)
            k=int(options[int(np.argmin(candidate_mean))])
        else:k=int(options[0])
        selected.append(k)
        covered|=cover[:,k]
    # Stage 2: single-swap local refinement (coverage primary, mean distance secondary)
    for _ in range(30):
        curcov,curmean=score(selected)
        bestpair=None; best_tuple=(curcov,-curmean)
        pool=[v for v in range(C) if v not in set(selected)]
        for j in range(p):
            # efficient all-candidate coverage calculation with facility j removed
            cs=cover[:,selected]
            left=(cs.sum(axis=1)-cs[:,j].astype(int))>0
            newcov=left.sum()+np.sum((~left)[:,None]&cover,axis=0)
            candidate_idx=np.flatnonzero(newcov>=curcov)
            if len(candidate_idx)==0:continue
            others=selected[:j]+selected[j+1:]
            no_j=np.min(D[:,others],axis=1)
            means=np.minimum(no_j[:,None],D[:,candidate_idx]).mean(axis=0)
            for q,ci in enumerate(candidate_idx):
                if int(ci) not in pool:continue
                obj=(int(newcov[ci]),-float(means[q]))
                if obj[0]>best_tuple[0] or (obj[0]==best_tuple[0] and obj[1]>best_tuple[1]+1e-4):
                    best_tuple=obj;bestpair=(j,int(ci))
        if bestpair is None:break
        selected[bestpair[0]]=bestpair[1]
    return selected

def pmedian_heuristic(p):
    selected=[]; bestdist=np.full(N,np.inf,dtype=np.float32)
    for k in range(p):
        cost=np.minimum(bestdist[:,None],D).sum(axis=0)
        cost[selected]=np.inf
        chosen=int(cost.argmin())
        selected.append(chosen);bestdist=np.minimum(bestdist,D[:,chosen])
    for _ in range(30):
        dist_sel=D[:,selected];rank=np.argsort(dist_sel,axis=1)
        best=dist_sel[np.arange(N),rank[:,0]]
        second=dist_sel[np.arange(N),rank[:,1]]
        val=float(best.sum());best_gain=0.001;swap=None
        for j in range(p):
            remain=np.where(rank[:,0]==j,second,best)
            costs=np.minimum(remain[:,None],D).sum(axis=0)
            costs[selected]=np.inf
            k=int(costs.argmin());gain=val-float(costs[k])
            if gain>best_gain:best_gain=gain;swap=(j,k)
        if swap is None:break
        selected[swap[0]]=swap[1]
    return selected

comparisons=[]
model_solutions={}
for p in range(CONFIG['evaluated_p_min'],CONFIG['evaluated_p_max']+1):
    for mode,func in [('max_coverage_heuristic',mclp_heuristic),('min_mean_distance_heuristic',pmedian_heuristic)]:
        chosen=func(p)
        _, ds=nearest_info(chosen)
        metrics={
          'method':mode,'site_count':p,'buildings_total':N,
          'buildings_covered_500m':int(np.sum(ds<=500)),
          'coverage_500m_pct':float(100*np.mean(ds<=500)),
          'coverage_750m_pct':float(100*np.mean(ds<=750)),
          'mean_straight_distance_m':float(np.mean(ds)),
          'p95_straight_distance_m':float(np.percentile(ds,95)),
          'max_straight_distance_m':float(np.max(ds))
        }
        comparisons.append(metrics)
        model_solutions[(p,mode)]=chosen
comparison_df=pd.DataFrame(comparisons)
comparison_df.to_csv(OUT/'scenario_site_count_comparison.csv',index=False)
feasible=comparison_df[(comparison_df.method=='max_coverage_heuristic')&(comparison_df.coverage_500m_pct>=100*CONFIG['target_fraction_of_detected_buildings_covered'])]
assert len(feasible)
P=int(feasible.site_count.min())
chosen=model_solutions[(P,'max_coverage_heuristic')]
# Stabilize IDs by geographic location rather than heuristic selection order (north-to-south, then west)
chosen=sorted(chosen,key=lambda idx:(-candidates[idx,1],candidates[idx,0]))
assign_ix,dist_m=nearest_info(chosen)
covered=dist_m<=500
# approximate population/allocation proxy: every DETECTED building equal share of village population.
per_building_population=CONFIG['population_reference_total']/N
base_demand_per_bld=per_building_population*CONFIG['affected_fraction_scenario']*CONFIG['target_litres_per_person_day']
from pyproj import Transformer
xy_to_lonlat=Transformer.from_crs(EPSG_METRIC,4326,always_xy=True)
site_records=[]
for j,c_idx in enumerate(chosen):
    x,y=candidates[c_idx];lon,lat=xy_to_lonlat.transform(x,y)
    mask=assign_ix==j
    bcnt=int(mask.sum())
    affected_pop=bcnt*per_building_population*CONFIG['affected_fraction_scenario']
    daily_need=bcnt*base_demand_per_bld
    site_records.append({
        'site_id':f'KAT-S{j+1:02d}',
        'longitude':round(lon,6),'latitude':round(lat,6),
        'x_utm49s':round(float(x),2),'y_utm49s':round(float(y),2),
        'location_status':'MODEL_SEARCH_CENTER_UNVERIFIED',
        'site_search_radius_m':150,
        'nearest_assigned_buildings':bcnt,
        'assigned_buildings_within_500m':int(np.sum(mask & covered)),
        'assigned_buildings_outside_500m':int(np.sum(mask & ~covered)),
        'covered_assigned_fraction_pct':round(float(np.mean(covered[mask]))*100,2),
        'assigned_mean_straight_distance_m':round(float(np.mean(dist_m[mask])),1),
        'proxy_affected_people_50pct':round(float(affected_pop),1),
        'proxy_demand_L_day_50pct_15Lpcd':round(float(daily_need),1),
        'truckloads_5000L_day_scenario':int(math.ceil(daily_need/5000)),
        'tap_units_if_max250_affected_people_per_tap':int(math.ceil(affected_pop/250)),
        'road_entrance_verified':False,'public_land_verified':False,'source_water_verified':False,
        'safe_water_quality_verified':False,
        'status_note':'Lokasi pusat pencarian model, bukan rekomendasi tapak siap bangun'
    })
site_df=pd.DataFrame(site_records)
site_df.to_csv(OUT/'proposed_site_search_centres_11.csv',index=False)
site_gdf=gpd.GeoDataFrame(site_df,geometry=gpd.points_from_xy(site_df.longitude,site_df.latitude),crs='EPSG:4326')
site_gdf.to_file(OUT/'proposed_site_search_centres_11.geojson',driver='GeoJSON')
# 500m Euclidean radius circles + 150m candidate search areas for SI visualization
site_metric=site_gdf.to_crs(EPSG_METRIC)
for radius,name in [(500,'scenario_500m_radius_circles.geojson'),(150,'site_150m_search_areas.geojson')]:
    gg=site_metric[['site_id','geometry']].copy()
    gg['buffer_radius_m']=radius
    gg['distance_type']='EUCLIDEAN_NOT_ROAD_NETWORK'
    gg['geometry']=gg.geometry.buffer(radius)
    gg.to_crs('EPSG:4326').to_file(OUT/name,driver='GeoJSON')
# per building assignments: inherited full_plus_code as join key
bld=gpd.GeoDataFrame(buildings[['full_plus_code','confidence','area_in_meters']].copy(),geometry=centroids,crs=f'EPSG:{EPSG_METRIC}')
bld['assigned_site_id']=[f'KAT-S{k+1:02d}' for k in assign_ix]
bld['distance_straight_m']=np.round(dist_m,2)
bld['covered_500m_straight']=covered
bld['population_proxy_total']=round(per_building_population,6)
bld['affected_people_proxy']=round(per_building_population*CONFIG['affected_fraction_scenario'],6)
bld['water_need_L_day_proxy']=round(base_demand_per_bld,6)
bld['source_status']='BUILDING_PROXY_NOT_HOUSEHOLD'
bld.to_crs(4326).to_file(OUT/'building_to_site_assignment_points.geojson',driver='GeoJSON')
bld.drop(columns='geometry').to_csv(OUT/'building_to_site_assignment.csv',index=False)
# summary demand scenarios
scenario_records=[]
for frac in [0.25,0.50,1.00]:
    for q in [15,50]:
        L=CONFIG['population_reference_total']*frac*q
        scenario_records.append({
            'affected_fraction_HYPOTHETICAL':frac,'demand_target_L_per_person_day':q,
            'total_affected_population_proxy':CONFIG['population_reference_total']*frac,
            'total_water_demand_L_day_scenario':L,
            'minimum_5000L_truckloads_daily_ideal_no_losses':math.ceil(L/5000),
            'status':'HYPOTHETICAL_NOT_OBSERVED'
        })
pd.DataFrame(scenario_records).to_csv(OUT/'water_demand_scenarios.csv',index=False)

summary={
  'scenario_status':'HYPOTHETICAL_SITE_SEARCH_NO_ROAD_NETWORK',
  'study_area':'Katongan AOI as supplied (boundary not yet reconciled to province area)',
  'N_detected_building_footprints':N,
  'candidate_count':C,'candidate_spacing_m':spacing,
  'selected_p':P,
  'selected_model':'heuristic_maximal_coverage_at_500m_then_min_mean_distance',
  'buildings_covered_500m':int(covered.sum()),
  'buildings_uncovered_500m':int((~covered).sum()),
  'coverage_500m_pct':float(covered.mean()*100),
  'coverage_750m_pct':float((dist_m<=750).mean()*100),
  'mean_straight_distance_m':float(dist_m.mean()),
  'p95_straight_distance_m':float(np.percentile(dist_m,95)),
  'max_straight_distance_m':float(dist_m.max()),
  'population_reference':CONFIG['population_reference_total'],
  'reference_population_actual_year':'not specified',
  'affected_fraction':CONFIG['affected_fraction_scenario'],
  'per_capita_L_day':CONFIG['target_litres_per_person_day'],
  'proxy_daily_demand_L':round(CONFIG['population_reference_total']*CONFIG['affected_fraction_scenario']*CONFIG['target_litres_per_person_day'],1),
  'total_site_proxy_demand_L_day':round(site_df['proxy_demand_L_day_50pct_15Lpcd'].sum(),1),
  'minimum_total_truckloads_5000L_summed_by_site':int(site_df['truckloads_5000L_day_scenario'].sum()),
  'total_taps_by_250_affected_person_proxy':int(site_df['tap_units_if_max250_affected_people_per_tap'].sum()),
  'target_500m_benchmark':'Sphere 2018 water point <=500m; we measure Euclidean only so NOT verified compliance',
  'limitations':[
   'Building centroid demand proxy is not population or household location survey',
   'No administrative padukuhan boundaries and unequal population distribution available',
   'Grid site coordinates are hypothetical centres of 150m search areas; may be on private land, steep slope or inaccessible to trucks',
   'No OSM roads were available locally, so network distance, truck accessibility, and travel times have NOT been calculated',
   'Optimizers are deterministic greedy+swap heuristics; no global optimality certificate',
   'Capacities, storage and resupply schedules are not constrained within site selection; daily truckloads are screening estimates only',
   '2018 Sphere indicator refers to travel distance to water points; our 500m Euclidean coverage is a lower bound for walking distance',
   'Existing BPBD water drops in Klegung and Perbutan are observed localities, not verified physical comparison point coordinates',
   'Supply source and water treatment quality are unverified, drinking safety cannot be claimed',
   'AOI area from dataset differs from some government administrative area sources'
  ],'config':CONFIG
}
(OUT/'model_summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')

# independent integrity assertions
assert len(site_df)==P
assert len(bld)==N
assert bld['full_plus_code'].is_unique
assert int(sum(site_df.nearest_assigned_buildings))==N
assert int(covered.sum())==summary['buildings_covered_500m']
assert abs(float(site_df.proxy_demand_L_day_50pct_15Lpcd.sum())-CONFIG['population_reference_total']*CONFIG['affected_fraction_scenario']*CONFIG['target_litres_per_person_day'])<2
assert all(aoi.geometry.union_all().contains(pt) for pt in site_metric.geometry)

# Plot map preview in projected meters
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
fig,ax=plt.subplots(figsize=(10.4,9),dpi=170)
aoi.plot(ax=ax, facecolor='#F8F6F2',edgecolor='#495565',linewidth=1.4)
ax.scatter(xy[covered,0],xy[covered,1],s=1.6,c='#A7B8B7',alpha=0.48,rasterized=True,label='Buildings ≤500 m')
ax.scatter(xy[~covered,0],xy[~covered,1],s=5,c='#CF7A48',alpha=0.84,label='Outside 500 m')
for j,s in site_df.iterrows():
    sx,sy=s.x_utm49s,s.y_utm49s
    ax.add_patch(Circle((sx,sy),500,edgecolor='#257267',facecolor='#72B49D',alpha=0.10,linewidth=1.15))
    ax.scatter([sx],[sy],s=83,marker='o',c='#0B6155',edgecolors='white',linewidths=1.0,zorder=10)
    ax.annotate(s.site_id.replace('KAT-',''),(sx,sy),xytext=(6,6),textcoords='offset points',fontsize=8,fontweight='bold',color='#214B44')
ax.set_aspect('equal',adjustable='box')
ax.set_xlabel('Easting — UTM 49S (m)');ax.set_ylabel('Northing — UTM 49S (m)')
ax.set_title(f'KATONGAN  /  {P} CANDIDATE WATER-POINT SEARCH CENTRES',loc='left',fontsize=13,fontweight='bold',pad=36)
ax.text(0,1.012,f"{summary['coverage_500m_pct']:.1f}% detected buildings within 500 m straight-line · scenario, not verified sites",transform=ax.transAxes,fontsize=9,color='#5A6673')
ax.legend(loc='lower left',frameon=False,fontsize=8)
ax.grid(alpha=0.15)
fig.tight_layout()
fig.savefig(OUT/'proposed_site_search_map.png',bbox_inches='tight')
plt.close(fig)

# Phase 2: preserve 11 base locations, add the minimum greedy supplementary
# hypothetical mobile/temporary points until ≥98% Euclidean 500m coverage.
P2_TARGET=0.98
additional=[]
phase2_indices=chosen.copy()
phase2_covered=cover[:,phase2_indices].any(axis=1)
while np.mean(phase2_covered)<P2_TARGET and len(additional)<10:
    gain=(~phase2_covered).astype(np.int16)@cover.astype(np.int16)
    gain[phase2_indices]=-1
    ci=int(gain.argmax())
    phase2_indices.append(ci)
    additional.append(ci)
    phase2_covered|=cover[:,ci]
extra_rows=[]
for j,ci in enumerate(additional):
    x,y=candidates[ci];lon,lat=xy_to_lonlat.transform(x,y)
    extra_rows.append({
        'site_id':f'KAT-T{j+1:02d}','longitude':round(lon,6),'latitude':round(lat,6),
        'x_utm49s':round(float(x),2),'y_utm49s':round(float(y),2),
        'location_status':'MODEL_SUPPLEMENTARY_SEARCH_CENTER_UNVERIFIED',
        'site_type_scenario':'TEMPORARY_OR_MOBILE_WATERPOINT',
        'additional_buildings_covered_500m':int(np.count_nonzero(cover[:,ci]&(~cover[:,phase2_indices[:P+j]].any(axis=1)))),
        'road_entrance_verified':False, 'public_land_verified':False,
        'safe_water_quality_verified':False,
        'search_radius_m':150,
        'status_note':'Bukan titik operasional eksisting; titik tambahan hipotetis'
    })
extra_df=pd.DataFrame(extra_rows)
extra_df.to_csv(OUT/'phase2_supplementary_centres.csv',index=False)
extra_gdf=gpd.GeoDataFrame(extra_df,geometry=gpd.points_from_xy(extra_df.longitude,extra_df.latitude),crs='EPSG:4326')
extra_gdf.to_file(OUT/'phase2_supplementary_centres.geojson',driver='GeoJSON')
# Phase 2 catchment assignments over 11+T sites, for future what-if analysis.
indices2,d2=nearest_info(phase2_indices)
site_keys=list(site_df.site_id)+list(extra_df.site_id)
phase2_rows=bld[['full_plus_code','confidence','area_in_meters','geometry']].copy()
phase2_rows['assigned_site_id_phase2']=[site_keys[int(k)] for k in indices2]
phase2_rows['distance_straight_m_phase2']=np.round(d2,2)
phase2_rows['covered_500m_straight_phase2']=(d2<=500)
phase2_rows['status']='HYPOTHETICAL_NOT_ROAD_BASED'
phase2_rows.to_crs(4326).to_file(OUT/'phase2_building_assignments.geojson',driver='GeoJSON')
summary['phase2_supplementary_count']=len(additional)
summary['phase2_total_site_count']=len(phase2_indices)
summary['phase2_covered_500m']=int(phase2_covered.sum())
summary['phase2_coverage_500m_pct']=float(phase2_covered.mean()*100)
summary['phase2_remaining_outside_500m']=int((~phase2_covered).sum())
(OUT/'model_summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')

print(json.dumps({k:v for k,v in summary.items() if k not in ['limitations','config']},indent=2,ensure_ascii=False))
print('selected coordinates:')
print(site_df[['site_id','latitude','longitude','nearest_assigned_buildings','proxy_demand_L_day_50pct_15Lpcd','truckloads_5000L_day_scenario']].to_string(index=False))
