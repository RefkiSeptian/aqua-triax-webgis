"""Deterministic offline tests: provider fallback and genuine-graph cache reuse."""
import tempfile
from pathlib import Path
import networkx as nx
from network_download import acquire_osm_graphs

class Settings:
    pass
class MockOSMnx:
    def __init__(self):
        self.settings=Settings()
        self.calls=[]
        self.files={}
    def graph_from_bbox(self,bbox,**kw):
        self.calls.append((self.settings.overpass_url, kw['network_type'], tuple(bbox)))
        if 'private.coffee' in self.settings.overpass_url:
            raise RuntimeError('502 simulated')
        G=nx.MultiDiGraph()
        G.add_node(1,x=110.6,y=-7.85)
        G.add_node(2,x=110.61,y=-7.85)
        G.add_edge(1,2,length=1000)
        return G
    def save_graphml(self, graph, filepath):
        nx.write_graphml(graph,filepath)
    def load_graphml(self,filepath):
        return nx.read_graphml(filepath)

with tempfile.TemporaryDirectory() as td:
    ox=MockOSMnx()
    args=dict(bbox=(110.6,-7.9,110.7,-7.8),cache_dir=td,
              endpoints=['https://overpass.private.coffee/api','https://overpass-api.de/api'],
              attempts_per_endpoint=1, retry_base_seconds=0, sleep_fn=lambda x:None)
    walk,drive,prov=acquire_osm_graphs(ox,**args)
    assert walk.number_of_nodes()==2 and drive.number_of_edges()==1
    assert len(ox.calls)==4
    assert all(len(t[2])==4 for t in ox.calls),'bbox must be short, not polygon coordinates'
    assert all(prov['graphs'][x]['endpoint'].endswith('overpass-api.de/api') for x in ('walk','drive'))
    ox2=MockOSMnx()
    walk2,drive2,prov2=acquire_osm_graphs(ox2,**args)
    assert not ox2.calls,'cached graph must avoid re-downloading'
    assert prov2['graphs']['walk']['source']=='cached_real_osm_graphml'
print('PASS: short bbox, 502 fallback, both graph caches and metadata')
