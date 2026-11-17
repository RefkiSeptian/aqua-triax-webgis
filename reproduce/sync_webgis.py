"""Publish model scripts and research tables inside the standalone WebGIS folder."""
from argparse import ArgumentParser
from pathlib import Path
from shutil import copyfile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "WEBGIS_READY"
DATA_FILES = {
    "data/katongan_cdd_sensitivity.csv": "cdd.csv",
    "data/katongan_yas_scenario_matrix.csv": "yas_benchmarks.csv",
    "reference_input/USER_VisualQA_40_records.csv": "rwh_visual_audit.csv",
    "data/kesling/water_demand_scenarios.csv": "demand_scenarios.csv",
    "data/kesling/sanitary_inspection_checklist.csv": "sanitary_checklist.csv",
    "data/kesling/treatment_technology_matrix.csv": "treatments.csv",
    "NETWORK_OSM/results/network_greedy_coverage_curve.csv": "network_coverage_curve.csv",
}
PAGE2_FILES = (
    "csv/MATRIX_CAKUPAN_3583x150.csv",
    "csv/BEBAN_30_TITIK_9_SKENARIO.csv",
    "csv/CHECKLIST_KELAYAKAN_30_TITIK.csv",
    "csv/MDMC_KONTEKS_BUKAN_GPS.csv",
    "geojson/bangunan_status_3583.geojson",
    "geojson/zona_pencarian_150m.geojson",
    "geojson/existing_mdmc_katongan_1.geojson",
    "json/scenarios_150.json",
    "json/demand_scenarios_9.json",
)

if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--distribution-zip", type=Path, help="Optional Katongan Page 2 MDMC update archive")
    args = parser.parse_args()
    models = WEB / "models"
    models.mkdir(exist_ok=True)
    for name in ("yas.js", "yas_first_flush.js", "quality_rules.js"):
        copyfile(ROOT / "src" / name, models / name)
    for source, name in DATA_FILES.items():
        copyfile(ROOT / source, WEB / "data" / name)
    if args.distribution_zip:
        with ZipFile(args.distribution_zip) as archive:
            assets = {
                Path(path).name: archive.read(f"Katongan_Page2_DATA_SI/{path}")
                for path in PAGE2_FILES
            }
        destination = WEB / "data" / "distribution"
        destination.mkdir(exist_ok=True)
        for name, contents in assets.items():
            (destination / name).write_bytes(contents)
