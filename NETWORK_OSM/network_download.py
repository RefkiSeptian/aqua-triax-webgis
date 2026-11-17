"""Overpass 502-resilient authentic OSM graph acquisition for Katongan.

Uses a small rectangular bbox rather than thousands of polygon vertices, multiple
actual Overpass providers, controlled retries, and an OSMnx GraphML cache.
Does not generate fake roads or synthetic distance outputs when Overpass fails.
"""
from __future__ import annotations
import json
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_ENDPOINTS = (
    'https://overpass.private.coffee/api',
    'https://overpass-api.de/api',
)


def _valid_graph(graph, label):
    if not hasattr(graph, 'number_of_nodes') or graph.number_of_nodes() < 2:
        raise ValueError(f'{label}: downloaded graph has fewer than 2 nodes')
    if graph.number_of_edges() < 1:
        raise ValueError(f'{label}: downloaded graph has no edges')
    return graph


def acquire_osm_graphs(ox, *, bbox, cache_dir, endpoints=DEFAULT_ENDPOINTS,
                       attempts_per_endpoint=2, retry_base_seconds=6,
                       request_timeout_seconds=120, sleep_fn=time.sleep):
    """Get authentic walk/drive graphs; cache each as soon as downloaded.

    Parameters:
        bbox: (west, south, east, north), EPSG:4326.
        cache_dir: path for genuine OSMnx GraphML, persisted across attempts.
    Returns:
        (walk_graph, drive_graph, provenance_dict)
    Raises:
        RuntimeError only after all configured endpoints fail (no fake outputs).
    """
    west, south, east, north = map(float, bbox)
    if not (-180 < west < east < 180 and -90 < south < north < 90):
        raise ValueError('Invalid WGS84 bbox order; expected west,south,east,north')
    if attempts_per_endpoint < 1:
        raise ValueError('attempts_per_endpoint must be at least 1')
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    ox.settings.use_cache = True
    ox.settings.log_console = False
    ox.settings.overpass_rate_limit = True
    ox.settings.requests_timeout = request_timeout_seconds
    ox.settings.cache_folder = str(cache_dir / 'overpass_response_cache')
    graphs = {}
    provenance = {'bbox_wsen': [west,south,east,north],
                  'acquired_utc': datetime.now(timezone.utc).isoformat(),
                  'graphs':{}, 'providers_tried': list(endpoints)}
    for mode in ('walk', 'drive'):
        graphfile = cache_dir / f'{mode}.graphml'
        if graphfile.exists():
            try:
                cached = _valid_graph(ox.load_graphml(filepath=str(graphfile)), mode)
                graphs[mode] = cached
                provenance['graphs'][mode] = {'source':'cached_real_osm_graphml',
                                              'path':str(graphfile),
                                              'nodes':cached.number_of_nodes(),
                                              'edges':cached.number_of_edges()}
                print(f'Using cached REAL OSM {mode} graph: {cached.number_of_nodes()} nodes', flush=True)
                continue
            except Exception as exc:
                print(f'Ignoring damaged {mode} graph cache: {type(exc).__name__}', flush=True)
                graphfile.unlink(missing_ok=True)
        last_error = None
        for endpoint in endpoints:
            if mode in graphs:
                break
            ox.settings.overpass_url = endpoint
            for attempt in range(1, attempts_per_endpoint+1):
                print(f'Fetching REAL OSM {mode} bbox via {endpoint} '
                      f'(attempt {attempt}/{attempts_per_endpoint})', flush=True)
                try:
                    graph = _valid_graph(ox.graph_from_bbox(
                        (west,south,east,north), network_type=mode,
                        simplify=True, retain_all=True, truncate_by_edge=True), mode)
                    ox.save_graphml(graph, filepath=str(graphfile))
                    graphs[mode] = graph
                    provenance['graphs'][mode] = {
                        'source':'overpass_api', 'endpoint':endpoint,
                        'path':str(graphfile),'nodes':graph.number_of_nodes(),
                        'edges':graph.number_of_edges()}
                    print(f'Fetched REAL {mode}: {graph.number_of_nodes()} nodes, '
                          f'{graph.number_of_edges()} edges; saved GraphML', flush=True)
                    break
                except Exception as exc:
                    last_error=exc
                    print(f'Overpass error: {type(exc).__name__}: {str(exc)[:300]}', flush=True)
                    if attempt < attempts_per_endpoint:
                        delay=retry_base_seconds*(2**(attempt-1))
                        print(f'Retry same provider after {delay:.0f}s', flush=True)
                        sleep_fn(delay)
        if mode not in graphs:
            error={'status':'FAILED_NO_ROAD_GRAPH',
                   'failed_mode':mode,'last_error':str(last_error)[:900],
                   'graphs_obtained':list(graphs), 'bbox_wsen':list(bbox),
                   'providers_tried':list(endpoints),
                   'note':'No synthetic roads were created. Try providers later or use genuine cached OSM GraphML.'}
            (cache_dir/'DOWNLOAD_ERROR.json').write_text(json.dumps(error,indent=2))
            raise RuntimeError(f'Failed downloading authentic OSM {mode} from all endpoints. '
                               'Previous successful graph is cached. '
                               'Try the notebook again or supply a genuine OSM GraphML.') from last_error
    (cache_dir/'DOWNLOAD_ERROR.json').unlink(missing_ok=True)
    (cache_dir/'OSM_GRAPH_SOURCES.json').write_text(json.dumps(provenance,indent=2))
    return graphs['walk'], graphs['drive'], provenance
