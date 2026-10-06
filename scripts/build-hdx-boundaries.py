#!/usr/bin/env python3
"""Build small, province-split web GeoJSON files from the HDX Indonesia COD-AB archive."""

import gzip
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path


TOLERANCE = 0.0005
SOURCE_NAMES = {
    2: "adm2_name",
    3: "adm3_name",
    4: "adm4_name",
}


def slugify(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def simplify_line(points, tolerance):
    if len(points) <= 2:
        return points
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        x1, y1 = points[start]
        x2, y2 = points[end]
        dx, dy = x2 - x1, y2 - y1
        denominator = dx * dx + dy * dy
        farthest, maximum = None, tolerance * tolerance
        for index in range(start + 1, end):
            x, y = points[index]
            if denominator:
                fraction = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / denominator))
                distance = (x - (x1 + fraction * dx)) ** 2 + (y - (y1 + fraction * dy)) ** 2
            else:
                distance = (x - x1) ** 2 + (y - y1) ** 2
            if distance > maximum:
                farthest, maximum = index, distance
        if farthest is not None:
            keep.add(farthest)
            stack.extend(((start, farthest), (farthest, end)))
    return [point for index, point in enumerate(points) if index in keep]


def simplify_ring(ring):
    if len(ring) < 4 or ring[0] != ring[-1]:
        return ring
    open_ring = ring[:-1]
    if len(open_ring) < 3:
        return ring
    first = open_ring[0]
    split = max(
        range(1, len(open_ring)),
        key=lambda index: (open_ring[index][0] - first[0]) ** 2
        + (open_ring[index][1] - first[1]) ** 2,
    )
    first_arc = simplify_line(open_ring[: split + 1], TOLERANCE)
    second_arc = simplify_line(open_ring[split:] + [first], TOLERANCE)
    result = first_arc[:-1] + second_arc[:-1]
    if len(result) < 3:
        return ring
    return result + [result[0]]


def simplify_geometry(geometry):
    if not geometry:
        return geometry
    kind, coordinates = geometry["type"], geometry["coordinates"]
    if kind == "Polygon":
        geometry["coordinates"] = [simplify_ring(ring) for ring in coordinates]
    elif kind == "MultiPolygon":
        geometry["coordinates"] = [
            [simplify_ring(ring) for ring in polygon] for polygon in coordinates
        ]
    return geometry


class CollectionWriter:
    def __init__(self, path):
        self.file = gzip.open(path, "wt", encoding="utf-8", compresslevel=9)
        self.file.write('{"type":"FeatureCollection","features":[')
        self.first = True
        self.count = 0

    def add(self, feature):
        if not self.first:
            self.file.write(",")
        json.dump(feature, self.file, ensure_ascii=False, separators=(",", ":"))
        self.first = False
        self.count += 1

    def close(self):
        self.file.write("]}")
        self.file.close()


def read_features(archive, level):
    filename = f"idn_admin{level}.geojson"
    with archive.open(filename) as source:
        for line_number, raw_line in enumerate(source, start=1):
            line = raw_line.decode("utf-8").strip().rstrip(",")
            if not line.startswith('{"type":"Feature"'):
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"Fitur tidak valid di {filename}, baris {line_number}"
                ) from error


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: python scripts/build-hdx-boundaries.py <hdx-geojson.zip> <output-directory>"
        )
    archive_path, output_dir = Path(sys.argv[1]), Path(sys.argv[2])
    overview_dir = output_dir / "overview"
    overview_dir.mkdir(parents=True, exist_ok=True)
    regions = {}

    with zipfile.ZipFile(archive_path) as archive:
        overview = CollectionWriter(overview_dir / "ADM1.geojson.gz")
        for feature in read_features(archive, 1):
            properties = feature.get("properties", {})
            name = properties.get("adm1_name")
            if not name:
                continue
            slug = slugify(name)
            region = regions.setdefault(
                slug,
                {
                    "slug": slug,
                    "name": name,
                    "files": {
                        f"ADM{level}": f"{slug}/ADM{level}.geojson.gz"
                        for level in (2, 3, 4)
                    },
                    "counts": {"ADM1": 1},
                },
            )
            feature["geometry"] = simplify_geometry(feature.get("geometry"))
            feature["properties"] = {
                "adm1_name": name,
                "adm1_pcode": properties.get("adm1_pcode"),
                "admin_level": "1",
            }
            overview.add(feature)
        overview.close()

        for level in (2, 3, 4):
            writers = {}
            name_key = SOURCE_NAMES[level]
            for feature in read_features(archive, level):
                source_properties = feature.get("properties", {})
                province = source_properties.get("adm1_name")
                name = source_properties.get(name_key)
                if not province or not name:
                    continue
                slug = slugify(province)
                region = regions.get(slug)
                if region is None:
                    continue
                output = output_dir / slug / f"ADM{level}.geojson.gz"
                output.parent.mkdir(parents=True, exist_ok=True)
                writer = writers.get(slug)
                if writer is None:
                    writer = writers[slug] = CollectionWriter(output)
                feature["geometry"] = simplify_geometry(feature.get("geometry"))
                feature["properties"] = {
                    f"adm{index}_name": source_properties.get(f"adm{index}_name")
                    for index in range(1, level + 1)
                }
                feature["properties"].update(
                    {
                        f"adm{index}_pcode": source_properties.get(f"adm{index}_pcode")
                        for index in range(1, level + 1)
                    }
                )
                feature["properties"]["admin_level"] = str(level)
                writer.add(feature)
            for slug, writer in writers.items():
                writer.close()
                regions[slug]["counts"][f"ADM{level}"] = writer.count

    manifest = {
        "country": "Indonesia",
        "iso3": "IDN",
        "source": "BPS - Statistics Indonesia, published by OCHA/HDX",
        "source_url": "https://data.humdata.org/dataset/cod-ab-idn",
        "dataset_reviewed_on": "2025-10-30",
        "boundary_valid_on": "2020-04-01",
        "license": "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
        "license_url": "https://creativecommons.org/licenses/by/3.0/igo/legalcode",
        "format": "Simplified, gzip-compressed GeoJSON split by province; ADM1=province, ADM2=regency/city, ADM3=subdistrict, ADM4=village/urban village.",
        "counts": {
            "ADM1": len(regions),
            **{
                f"ADM{level}": sum(
                    region["counts"].get(f"ADM{level}", 0)
                    for region in regions.values()
                )
                for level in (2, 3, 4)
            },
        },
        "regions": sorted(regions.values(), key=lambda region: region["name"]),
    }
    with (output_dir / "manifest.json").open("w", encoding="utf-8") as target:
        json.dump(manifest, target, ensure_ascii=False, indent=2)
        target.write("\n")
    print(f"Built {len(regions)} province datasets in {output_dir}")


if __name__ == "__main__":
    main()
