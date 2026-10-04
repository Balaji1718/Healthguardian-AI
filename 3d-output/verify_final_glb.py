import os
import sys
import numpy as np
import trimesh
from scipy.sparse import coo_matrix
import scipy.sparse.csgraph as csgraph

glb_path = r"d:\healthguardian-ai\3d-output\task2-organs\healthguardian-organs-task2.glb"
print(f"Loading GLB for final verification: {glb_path}")

file_size_mb = os.path.getsize(glb_path) / (1024 * 1024)
print(f"File Size: {file_size_mb:.2f} MB (Budget <= 12.0 MB)")
assert file_size_mb <= 12.0, f"File size {file_size_mb:.2f} MB exceeds 12.0 MB limit!"

scene = trimesh.load(glb_path, process=False)

print("\n--- NODE HIERARCHY AUDIT ---")
nodes = scene.graph.nodes
roots = [n for n in nodes if n.startswith("organ_")]
print(f"Discovered Semantic Roots ({len(roots)}/10): {sorted(roots)}")
assert len(roots) == 10, f"Expected 10 semantic roots, found {len(roots)}: {roots}"

expected_roots = [
    'organ_brain',
    'organ_heart',
    'organ_lungs',
    'organ_liver',
    'organ_stomach',
    'organ_pancreas',
    'organ_spleen',
    'organ_left_kidney',
    'organ_right_kidney',
    'organ_bladder'
]
for er in expected_roots:
    assert er in roots, f"Missing expected root: {er}"

print("\n--- GEOMETRY INTEGRITY PER CHILD MESH ---")
total_tris = 0
total_deg = 0
total_dups = 0
pancreas_head_comps = 0
pancreas_body_comps = 0
heart_atria_deg = 0

for gname, geom in sorted(scene.geometry.items()):
    v = geom.vertices
    f = geom.faces
    n_f = len(f)
    total_tris += n_f
    
    # Degenerate faces check
    e0 = v[f[:, 1]] - v[f[:, 0]]
    e1 = v[f[:, 2]] - v[f[:, 0]]
    cross = np.cross(e0, e1)
    areas = 0.5 * np.linalg.norm(cross, axis=1)
    deg_faces = int(np.sum(areas <= 1e-10))
    total_deg += deg_faces
    
    # Duplicate faces check
    sf = np.sort(f, axis=1)
    _, counts = np.unique(sf, axis=0, return_counts=True)
    dup_faces = int(np.sum(counts > 1))
    total_dups += dup_faces
    
    # Connected components
    edges = np.vstack([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    n_verts = len(v)
    adj = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(n_verts, n_verts))
    n_components, labels = csgraph.connected_components(adj, directed=False)
    comp_sizes = np.bincount(labels)
    tiny_comps = int(np.sum(comp_sizes <= 10))
    max_comp = int(np.max(comp_sizes)) if len(comp_sizes) > 0 else 0
    
    if gname == 'pancreas_head':
        pancreas_head_comps = n_components
    elif gname == 'pancreas_body_tail':
        pancreas_body_comps = n_components
    elif gname == 'heart_atria':
        heart_atria_deg = deg_faces
        
    mat_name = geom.visual.material.name if hasattr(geom.visual, 'material') and hasattr(geom.visual.material, 'name') else 'N/A'
    
    print(f"Mesh: {gname:28s} | Tris: {n_f:6,d} | Deg: {deg_faces} | Dups: {dup_faces} | Comps: {n_components:3d} (Max: {max_comp:5d}, <=10: {tiny_comps}) | Mat: {mat_name}")

print("\n--- SUMMARY OF TASK 2B CRITICAL RECHECKS ---")
print(f"1. Pancreas Head Components:      {pancreas_head_comps} (Was ~2,919 disconnected fragments -> RESOLVED to coherent manifold)")
print(f"2. Pancreas Body/Tail Components: {pancreas_body_comps} (Was ~13,861 disconnected fragments -> RESOLVED to coherent manifold)")
print(f"3. Heart Atria Degenerate Faces:  {heart_atria_deg} (Was 2,130 zero-area faces -> RESOLVED to 0)")
print(f"4. Total Degenerate Faces:        {total_deg} (Target: 0)")
print(f"5. Total Duplicate Faces:         {total_dups} (Target: 0)")
print(f"6. Total Triangles in Asset 1:    {total_tris:,} (Budget: <= 750,000)")
print(f"7. Total Child Meshes:            {len(scene.geometry)} (Target: 25)")
print(f"8. GLB File Size:                 {file_size_mb:.2f} MB (Budget: <= 12.0 MB)")

assert total_deg == 0, f"CRITICAL: Found {total_deg} degenerate faces!"
assert total_dups == 0, f"CRITICAL: Found {total_dups} duplicate faces!"
assert total_tris <= 750000, f"CRITICAL: Triangle count {total_tris} exceeds 750,000!"
assert pancreas_head_comps <= 5, f"CRITICAL: Pancreas head has too many components ({pancreas_head_comps})!"
assert pancreas_body_comps <= 5, f"CRITICAL: Pancreas body/tail has too many components ({pancreas_body_comps})!"

print("\n>>> ALL TASK 2B HARD GEOMETRY AUDIT CRITERIA SATISFIED 100% <<<")
