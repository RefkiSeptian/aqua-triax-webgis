"""Pure distance/optimizer helpers for candidate water-points; no OSM download required."""
import numpy as np
import networkx as nx


def service_distance_matrix(graph, demand_node, demand_access_m, candidate_node,
                            candidate_access_m, radius_m=500, max_demand_access_m=125):
    """Return [N buildings, C sites] walking distance incl approximate access connectors.

    If the input street network is disconnected, distances stay inf. Building access farther
    than max_demand_access_m stays inf, never interpreted as zero.
    """
    n=len(demand_node); c=len(candidate_node)
    d=np.full((n,c),np.inf,dtype=np.float32)
    by_node={}
    for i,(node,access) in enumerate(zip(demand_node,demand_access_m)):
        if access<=max_demand_access_m:
            by_node.setdefault(node,[]).append(i)
    for j,(site_node,site_access) in enumerate(zip(candidate_node,candidate_access_m)):
        if not np.isfinite(site_access) or site_access>125:continue
        cutoff=radius_m+max_demand_access_m # ensures all potentially covered found
        reachable=nx.single_source_dijkstra_path_length(graph,site_node,cutoff=cutoff,weight='length')
        for node,length in reachable.items():
            for i in by_node.get(node,()):
                d[i,j]=float(length)+float(site_access)+float(demand_access_m[i])
    return d


def select_facilities(d, max_p=30, radius_m=500., target=0.95):
    """Greedy max-coverage heuristic + 2 local swap iterations, no optimality certificate."""
    d=np.asarray(d,dtype=np.float32);n,c=d.shape
    if n==0 or c==0: raise ValueError('Missing demand or candidates')
    cover=d<=radius_m
    selection=[];curcovered=np.zeros(n,dtype=bool)
    records=[]
    for p in range(1,min(max_p,c)+1):
        gain=np.count_nonzero(cover&(~curcovered[:,None]),axis=0).astype(float)
        gain[selection]=-1
        options=np.flatnonzero(gain==gain.max())
        if not len(options):break
        # tie-break: minimum unserved distance capped at 2 km
        bestold=np.min(d[:,selection],axis=1) if selection else np.full(n,np.inf)
        targetmat=np.minimum(bestold[:,None],d[:,options])
        averages=np.minimum(targetmat,2000).mean(axis=0)
        best=int(options[np.argmin(averages)])
        selection.append(best);curcovered|=cover[:,best]
        coverage=np.count_nonzero(curcovered)/n
        records.append({'p':p,'covered':int(np.count_nonzero(curcovered)),
                        'coverage_pct':round(coverage*100,4)})
        if coverage>=target:break
    # local swap: improve coverage, then trimmed mean distance
    def score(sel):
        dd=np.min(d[:,sel],axis=1)
        return (int(np.count_nonzero(dd<=radius_m)),-float(np.minimum(dd,2000).mean()))
    bestscore=score(selection)
    for _ in range(2):
        improvement=None
        for slot in range(len(selection)):
            other=[s for j,s in enumerate(selection) if j!=slot]
            remaining_cover=np.any(cover[:,other],axis=1) if other else np.zeros(n,bool)
            coverage=np.count_nonzero(remaining_cover[:,None]|cover,axis=0)
            coverage[selection]=-1
            top=np.flatnonzero(coverage>=bestscore[0])
            if not len(top):continue
            base=np.min(d[:,other],axis=1) if other else np.full(n,np.inf)
            average=np.minimum(np.minimum(base[:,None],d[:,top]),2000).mean(axis=0)
            for i,j in enumerate(top):
                if j in selection:continue
                sc=(int(coverage[j]),-float(average[i]))
                if sc[0]>bestscore[0] or (sc[0]==bestscore[0] and sc[1]>bestscore[1]+1.e-4):
                    bestscore=sc;improvement=(slot,int(j))
        if not improvement:break
        selection[improvement[0]]=improvement[1]
    nearest=np.argmin(d[:,selection],axis=1)
    dist=d[np.arange(n),np.asarray(selection)[nearest]]
    return selection,records,nearest,dist
