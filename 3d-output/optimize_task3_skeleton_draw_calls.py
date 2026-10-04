"""Batch Asset 2 meshes within their existing semantic roots."""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

import numpy as np
import trimesh


EXPECTED_ROOTS = (
    "bone_skull", "bone_cervical_spine", "bone_spine", "bone_ribcage",
    "bone_sternum", "bone_clavicles", "bone_scapulae", "bone_pelvis",
    "bone_left_humerus", "bone_right_humerus", "bone_left_radius", "bone_right_radius",
    "bone_left_ulna", "bone_right_ulna", "bone_left_hand", "bone_right_hand",
    "bone_left_femur", "bone_right_femur", "bone_left_patella", "bone_right_patella",
    "bone_left_tibia", "bone_right_tibia", "bone_left_fibula", "bone_right_fibula",
    "bone_left_foot", "bone_right_foot",
)


def material_name(geometry: trimesh.Trimesh) -> str:
    material = getattr(geometry.visual, "material", None)
    return str(getattr(material, "name", ""))


def build(source: Path, output: Path) -> None:
    source_scene = trimesh.load(source, process=False)
    if not isinstance(source_scene, trimesh.Scene):
        raise TypeError(f"Expected a scene, got {type(source_scene).__name__}")

    grouped: dict[str, list[trimesh.Trimesh]] = defaultdict(list)
    for name, geometry in source_scene.geometry.items():
        root = name.split("__", 1)[0]
        if root not in EXPECTED_ROOTS:
            raise RuntimeError(f"Geometry is outside a declared semantic root: {name}")
        if material_name(geometry) != "Mat_Bone_Pro":
            raise RuntimeError(f"Unexpected material on {name}: {material_name(geometry)}")
        grouped[root].append(geometry)

    missing = [root for root in EXPECTED_ROOTS if not grouped[root]]
    if missing:
        raise RuntimeError(f"Cannot batch missing semantic roots: {missing}")

    output_scene = trimesh.Scene(base_frame="world")
    identity = np.eye(4)
    for root in EXPECTED_ROOTS:
        output_scene.graph.update(root, frame_from="world", matrix=identity, metadata={"semanticRoot": root, "layer": "skeleton"})
        merged = trimesh.util.concatenate(grouped[root])
        merged.visual = grouped[root][0].visual.copy()
        output_scene.add_geometry(merged, geom_name=f"{root}__batched", node_name=f"{root}__batched", parent_node_name=root, transform=identity)

    output.parent.mkdir(parents=True, exist_ok=True)
    output_scene.metadata.update({
        "asset": "HealthGuardian Asset 2",
        "content": "skeleton-only, semantically batched",
        "source": str(source),
        "batching": "one static mesh per semantic root",
        "semanticRoots": ",".join(EXPECTED_ROOTS),
    })
    output_scene.export(output)

    exported = trimesh.load(output, process=False)
    exported_materials = {material_name(geometry) for geometry in exported.geometry.values()}
    if exported_materials != {"Mat_Bone_Pro"}:
        raise RuntimeError(f"Unexpected exported materials: {sorted(exported_materials)}")
    missing = [root for root in EXPECTED_ROOTS if root not in exported.graph.nodes]
    if missing:
        raise RuntimeError(f"Missing semantic roots after batching: {missing}")
    if len(exported.geometry) != len(EXPECTED_ROOTS):
        raise RuntimeError(f"Expected {len(EXPECTED_ROOTS)} batched geometries, found {len(exported.geometry)}")

    print(f"Input geometries: {len(source_scene.geometry)}")
    print(f"Output geometries: {len(exported.geometry)}")
    print(f"Output triangles: {sum(len(geometry.faces) for geometry in exported.geometry.values())}")
    print(f"Output materials: {sorted(exported_materials)}")
    print(f"Output: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("3d-output/skeleton/healthguardian-skeleton-clean.glb"))
    parser.add_argument("--output", type=Path, default=Path("3d-output/skeleton/healthguardian-skeleton-clean-batched.glb"))
    args = parser.parse_args()
    build(args.source, args.output)