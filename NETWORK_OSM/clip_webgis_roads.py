"""Build display-only WebGIS road layers inside the Katongan boundary."""

import json
from pathlib import Path

from shapely.geometry import MultiLineString, mapping, shape
from shapely.ops import unary_union


def line_parts(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "LineString":
        yield geometry
    else:
        for part in getattr(geometry, "geoms", ()):
            yield from line_parts(part)


def write_webgis_road_layers(data_dir):
    boundary = json.loads((data_dir / "boundary.geojson").read_text(encoding="utf-8"))
    area = unary_union([shape(feature["geometry"]) for feature in boundary["features"]])
    for mode in ("walk", "drive"):
        source = data_dir / f"network_roads_{mode}.geojson"
        roads = json.loads(source.read_text(encoding="utf-8"))
        features = []
        seen = set()
        for feature in roads["features"]:
            clipped = shape(feature["geometry"]).intersection(area)
            parts = list(line_parts(clipped))
            if not parts:
                continue
            geometry = parts[0] if len(parts) == 1 else MultiLineString(parts)
            # The source graph can carry the same road in both directions.
            key = geometry.normalize().wkb
            if key in seen:
                continue
            seen.add(key)
            features.append({**feature, "geometry": mapping(geometry)})
        result = {"type": "FeatureCollection", "features": features}
        target = data_dir / f"katongan_roads_{mode}.geojson"
        target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{target.name}: {len(features)} of {len(roads['features'])} road features")


if __name__ == "__main__":
    write_webgis_road_layers(Path(__file__).resolve().parents[1] / "WEBGIS_READY" / "data")
