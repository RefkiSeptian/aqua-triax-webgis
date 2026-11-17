import numpy as np
import networkx as nx
from network_core import service_distance_matrix, select_facilities

G=nx.Graph()
G.add_edge(0,1,length=150);G.add_edge(1,2,length=150);G.add_edge(2,3,length=150)
G.add_node(9) # deliberately unreachable
B=[0,1,2,3,9]
A=[0,0,0,0,0]
C=[1,3]
D=service_distance_matrix(G,B,A,C,[0,0],radius_m=250)
assert np.isinf(D[4]).all(), 'disconnected node must remain unreachable'
assert D.shape==(5,2)
assert D[0,0]==150 and np.isinf(D[0,1])
sel,history,ass,dist=select_facilities(D,max_p=2,radius_m=250,target=.8)
assert len(sel)<=2 and np.count_nonzero(dist<=250)==4,(sel,dist)
assert np.isinf(dist[4])
print('PASS: disconnected network, service distance, facility selection, coverage 4/5')
