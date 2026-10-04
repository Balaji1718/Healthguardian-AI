"""Combine the approved organs and batched skeleton assets without reauthoring geometry."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import trimesh


ORGAN_ROOTS = (
    "organ_brain", "organ_heart", "organ_lungs", "organ_liver", "organ_stomach",
    "organ_pancreas", "organ_spleen", "organ_left_kidney", "organ_right_kidney", "organ_bladder",
)
SKELETON_ROOTS = (
    "bone_skull", "bone_cervical_spine", "bone_spine", "bone_ribcage", "bone_sternum",
    "bone_clavicles", "bone_scapulae", "bone_pelvis", "bone_left_humerus", "bone_right_humerus",
    "bone_left_radius", "bone_right_radius", "bone_left_ulna", "bone_right_ulna", "bone_left_hand",
    "bone_right_hand", "bone_left_femur", "bone_right_femur", "bone_left_patella", "bone_right_patella",
    "bone_left_tibia", "bone_right_tibia", "bone_left_fibula", "bone_right_fibula", "bone_left_foot",
    "bone_right_foot",
)
ALL_ROOTS = ORGAN_ROOTS + SKELETON_ROOTS
FORBIDDEN_MATERIAL_TOKENS = ("muscle", "fascia", "skin", "shell", "vessel", "nerve", "organ")


def material_name(geometry: trimesh.Trimesh) -> str:
    material = getattr(geometry.visual, "material", None)
    return str(getattr(material, "name", ""))


def semantic_root(scene: trimesh.Scene, geometry_name: str) -> str:
    path = scene.graph.transforms.shortest_path(scene.graph.base_frame, geometry_name)
    roots = [node for node in path if node in ALL_ROOTS]
    if len(roots) != 1:
        raise RuntimeError(f"Expected one semantic root for {geometry_name}, path={path}")
    return roots[0]


def add_asset(output: trimesh.Scene, source: trimesh.Scene, expected_roots: tuple[str, ...], source_label: str) -> int:
    seen = set()
    triangles = 0
    for geometry_name, geometry in source.geometry.items():
        root = semantic_root(source, geometry_name)
        if root not in expected_roots:
            raise RuntimeError(f"{source_label} geometry resolved outside its asset roots: {geometry_name} -> {root}")
        transform, _ = source.graph.get(geometry_name)
        if not np.allclose(transform, np.eye(4), atol=1e-7):
            raise RuntimeError(f"{source_label} geometry has a non-identity world transform: {geometry_name}")
        copied = geometry.copy()
        copied.apply_transform(transform)
        output.add_geometry(
            copied,
            geom_name=geometry_name,
            node_name=geometry_name,
            parent_node_name=root,
            transform=np.eye(4),
        )
        seen.add(root)
        triangles += len(copied.faces)
    missing = [root for root in expected_roots if root not in seen]
    if missing:
        raise RuntimeError(f"{source_label} missing roots with geometry: {missing}")
    return triangles


def validate(output: Path, organs: trimesh.Scene, skeleton: trimesh.Scene) -> None:
    scene = trimesh.load(output, process=False)
    if not isinstance(scene, trimesh.Scene):
        raise TypeError("Combined output is not a scene")
    missing = [root for root in ALL_ROOTS if root not in scene.graph.nodes]
    if missing:
        raise RuntimeError(f"Combined output missing semantic roots: {missing}")
    if len(scene.geometry) != len(organs.geometry) + len(skeleton.geometry):
        raise RuntimeError(f"Unexpected combined geometry count: {len(scene.geometry)}")

    materials = {material_name(geometry) for geometry in scene.geometry.values()}
    contaminated = [material for material in materials if any(token in material.lower() for token in FORBIDDEN_MATERIAL_TOKENS)]
    if contaminated:
        raise RuntimeError(f"Forbidden combined materials: {contaminated}")
    if "Mat_Muscle_Pro" in materials:
        raise RuntimeError("Muscle material returned to combined asset")

    triangles = sum(len(geometry.faces) for geometry in scene.geometry.values())
    expected_triangles = sum(len(geometry.faces) for geometry in organs.geometry.values()) + sum(len(geometry.faces) for geometry in skeleton.geometry.values())
    if triangles != expected_triangles:
        raise RuntimeError(f"Triangle count changed during combination: {triangles} != {expected_triangles}")

    for geometry_name in scene.geometry:
        transform, _ = scene.graph.get(geometry_name)
        if not np.allclose(transform, np.eye(4), atol=1e-7):
            raise RuntimeError(f"Combined geometry transform is not identity: {geometry_name}")

    print(f"Combined file bytes: {output.stat().st_size}")
    print(f"Combined geometries: {len(scene.geometry)}")
    print(f"Combined triangles: {triangles}")
    print(f"Combined roots: {len(ALL_ROOTS)}/{len(ALL_ROOTS)}")
    print(f"Combined materials: {sorted(materials)}")
    print(f"Combined bounds: {scene.bounds.tolist()}")
    print("Coordinate frame: shared identity transforms; +X right, +Y superior, +Z anterior")


def build(organs_path: Path, skeleton_path: Path, output_path: Path) -> None:
    organs = trimesh.load(organs_path, process=False)
    skeleton = trimesh.load(skeleton_path, process=False)
    if not isinstance(organs, trimesh.Scene) or not isinstance(skeleton, trimesh.Scene):
        raise TypeError("Both approved inputs must be GLB scenes")

    output = trimesh.Scene(base_frame="world")
    identity = np.eye(4)
    for root in ALL_ROOTS:
        layer = "organs" if root.startswith("organ_") else "skeleton"
        output.graph.update(root, frame_from="world", matrix=identity, metadata={"semanticRoot": root, "layer": layer})

    organ_triangles = add_asset(output, organs, ORGAN_ROOTS, "Asset 1")
    skeleton_triangles = add_asset(output, skeleton, SKELETON_ROOTS, "Asset 2")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.metadata.update({
        "asset": "HealthGuardian Asset 3",
        "content": "approved organs + approved batched skeleton",
        "sourceOrgans": str(organs_path),
        "sourceSkeleton": str(skeleton_path),
        "coordinateSystem": "+X anatomical right, +Y superior, +Z anterior",
        "semanticRoots": ",".join(ALL_ROOTS),
        "organTriangles": str(organ_triangles),
        "skeletonTriangles": str(skeleton_triangles),
    })
    output.export(output_path)
    validate(output_path, organs, skeleton)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--organs", type=Path, default=Path("3d-output/task2-organs/healthguardian-organs-task2.glb"))
    parser.add_argument("--skeleton", type=Path, default=Path("3d-output/skeleton/healthguardian-skeleton-clean-batched.glb"))
    parser.add_argument("--output", type=Path, default=Path("3d-output/combined/healthguardian-organs-skeleton-clean-batched.glb"))
    args = parser.parse_args()
    build(args.organs, args.skeleton, args.output)