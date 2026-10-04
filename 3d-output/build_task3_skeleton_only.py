"""Build a skeleton-only GLB from the existing raw anatomical source."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import numpy as np
import trimesh


EXPECTED_ROOTS = (
    "bone_skull", "bone_cervical_spine", "bone_spine", "bone_ribcage",
    "bone_sternum", "bone_clavicles", "bone_scapulae", "bone_pelvis",
    "bone_left_humerus", "bone_right_humerus", "bone_left_radius", "bone_right_radius",
    "bone_left_ulna", "bone_right_ulna", "bone_left_hand", "bone_right_hand",
    "bone_left_femur", "bone_right_femur", "bone_left_patella", "bone_right_patella",
    "bone_left_tibia", "bone_right_tibia",
    "bone_left_fibula", "bone_right_fibula", "bone_left_foot", "bone_right_foot",
)


def classify_mesh(name: str, center_x: float = 0.0) -> str | None:
    value = name.lower().replace("_", " ")
    if any(token in value for token in ("cervical", "atlas", "axis")):
        return "bone_cervical_spine"
    if any(token in value for token in ("vertebra", "thoracic", "lumbar", "sacrum", "coccyx")):
        return "bone_spine"
    if any(token in value for token in ("sternum", "manubrium", "xiphoid")):
        return "bone_sternum"
    if any(token in value for token in ("rib", "costal")):
        return "bone_ribcage"
    if "clavicle" in value:
        return "bone_clavicles"
    if "scapula" in value or "acromion" in value:
        return "bone_scapulae"
    if any(token in value for token in ("ilium", "ischium", "pubis", "acetabul", "obturator", "pelvis", "pelvic", "hip bone")):
        return "bone_pelvis"
    if any(token in value for token in ("skull", "cranium", "mandible", "maxilla", "zygomatic", "nasal", "palatine", "lacrimal", "concha", "malleus", "incus", "stapes", "tooth", "incisor", "canine", "molar", "premolar", "frontal", "parietal", "temporal", "occipital", "sphenoid", "ethmoid", "hyoid", "alar cartilage", "thyroid cartilage", "cricoid cartilage", "arytenoid", "corniculate", "vomer")):
        return "bone_skull"

    side = "left" if any(token in value for token in (".l", " left", "_l")) else "right" if any(token in value for token in (".r", " right", "_r")) else ("right" if center_x > 0 else "left" if center_x < 0 else None)
    if "humerus" in value:
        return f"bone_{side}_humerus" if side else None
    if "radius" in value:
        return f"bone_{side}_radius" if side else None
    if "ulna" in value:
        return f"bone_{side}_ulna" if side else None
    if any(token in value for token in ("hand", "carpal", "metacarp", "phalanx", "phalange", "capitate", "hamate", "scaphoid", "trapezium", "trapezoid", "triquetrum", "lunate", "pisiform")):
        return f"bone_{side}_hand" if side else None
    if "femur" in value:
        return f"bone_{side}_femur" if side else None
    if "patella" in value:
        return f"bone_{side}_patella" if side else None
    if "tibia" in value or "knee" in value:
        return f"bone_{side}_tibia" if side else None
    if "fibula" in value:
        return f"bone_{side}_fibula" if side else None
    if any(token in value for token in ("foot", "talus", "calcaneus", "navicular", "cuboid", "cuneiform", "metatars", "sesamoid")):
        return f"bone_{side}_foot" if side else None
    return None


def material_name(geometry: trimesh.Trimesh) -> str:
    material = getattr(geometry.visual, "material", None)
    return str(getattr(material, "name", ""))


def source_label(scene: trimesh.Scene, geometry_name: str) -> str:
    labels = [
        node_name
        for node_name, data in scene.graph.transforms.node_data.items()
        if data.get("geometry") == geometry_name
    ]
    return labels[0] if labels else geometry_name


def build(source: Path, output: Path) -> None:
    source_scene = trimesh.load(source, process=False)
    if not isinstance(source_scene, trimesh.Scene):
        raise TypeError(f"Expected a scene, got {type(source_scene).__name__}")

    material_counts = Counter(material_name(geometry) for geometry in source_scene.geometry.values())
    retained = []
    unmapped = []
    for name, geometry in source_scene.geometry.items():
        if material_name(geometry) != "Mat_Bone_Pro":
            continue
        label = source_label(source_scene, name)
        center_x = float(geometry.bounds.mean(axis=0)[0]) if geometry.bounds is not None else 0.0
        root = classify_mesh(label, center_x)
        if root is None:
            unmapped.append(f"{name} ({label})")
        else:
            retained.append((name, root, geometry.copy()))

    if unmapped:
        raise RuntimeError(f"Unmapped retained bone meshes ({len(unmapped)}): {unmapped[:20]}")
    if not retained:
        raise RuntimeError("No bone geometry was retained")

    output_scene = trimesh.Scene(base_frame="world")
    identity = np.eye(4)
    for root in EXPECTED_ROOTS:
        output_scene.graph.update(root, frame_from="world", matrix=identity, metadata={"semanticRoot": root, "layer": "skeleton"})
    for mesh_name, root, geometry in retained:
        safe_name = f"{root}__{mesh_name}"
        output_scene.add_geometry(geometry, geom_name=safe_name, node_name=safe_name, parent_node_name=root, transform=identity)

    output.parent.mkdir(parents=True, exist_ok=True)
    output_scene.metadata.update({"asset": "HealthGuardian Asset 2", "content": "skeleton-only", "source": str(source), "excludedMaterials": "Mat_Muscle_Pro", "semanticRoots": ",".join(EXPECTED_ROOTS)})
    output_scene.export(output)

    exported = trimesh.load(output, process=False)
    exported_materials = {material_name(geometry) for geometry in exported.geometry.values()}
    forbidden = {"Mat_Muscle_Pro", "Mat_Skin", "Mat_Fascia"}
    if exported_materials & forbidden:
        raise RuntimeError(f"Forbidden materials exported: {sorted(exported_materials & forbidden)}")
    missing = [root for root in EXPECTED_ROOTS if root not in exported.graph.nodes]
    if missing:
        raise RuntimeError(f"Missing semantic roots after export: {missing}")

    print(f"Source geometries: {len(source_scene.geometry)}")
    print(f"Source materials: {dict(material_counts)}")
    print(f"Retained bone geometries: {len(retained)}")
    print(f"Exported geometries: {len(exported.geometry)}")
    print(f"Exported materials: {sorted(exported_materials)}")
    print(f"Output: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("frontend/public/models/body-anatomy-raw.glb"))
    parser.add_argument("--output", type=Path, default=Path("3d-output/skeleton/healthguardian-skeleton-clean.glb"))
    args = parser.parse_args()
    build(args.source, args.output)