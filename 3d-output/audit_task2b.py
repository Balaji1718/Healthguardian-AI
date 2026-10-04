import trimesh
import numpy as np
import os
import scipy.sparse.csgraph as csgraph
from scipy.sparse import coo_matrix

def audit_mesh_topology(name, v, f):
    # Zero area faces
    e0 = v[f[:, 1]] - v[f[:, 0]]
    e1 = v[f[:, 2]] - v[f[:, 0]]
    cross = np.cross(e0, e1)
    areas = 0.5 * np.linalg.norm(cross, axis=1)
    deg_idx = np.where(areas <= 1e-12)[0]
    
    # Accidental duplicate faces (ignoring winding)
    sf = np.sort(f, axis=1)
    _, unique_idx, counts = np.unique(sf, axis=0, return_index=True, return_counts=True)
    dup_face_count = np.sum(counts > 1)
    
    # Connected components using scipy graph on shared edges
    # Build face adjacency
    # Edges from faces
    edges = np.vstack([
        f[:, [0, 1]],
        f[:, [1, 2]],
        f[:, [2, 0]]
    ])
    sorted_edges = np.sort(edges, axis=1)
    # Map edges to faces
    face_ids = np.repeat(np.arange(len(f)), 3)
    
    # We can also compute connected components of vertices directly:
    n_verts = len(v)
    adj = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(n_verts, n_verts))
    n_components, labels = csgraph.connected_components(adj, directed=False)
    
    # Histogram of component sizes (by face count or vertex count)
    comp_sizes = np.bincount(labels)
    # Count how many components are tiny (<= 10 vertices)
    tiny_comps = np.sum(comp_sizes <= 10)
    max_comp = np.max(comp_sizes) if len(comp_sizes) > 0 else 0
    
    print(f"--- {name} ---")
    print(f"  Faces: {len(f):,}, Verts: {len(v):,}")
    print(f"  Zero-area / Degenerate faces: {len(deg_idx):,}")
    print(f"  Duplicate faces: {dup_face_count:,}")
    print(f"  Connected components: {n_components:,} (Max size: {max_comp:,} verts, <=10 verts: {tiny_comps:,})")
    return {
        'faces': len(f),
        'verts': len(v),
        'degenerate': len(deg_idx),
        'duplicates': dup_face_count,
        'components': n_components,
        'max_comp': max_comp,
        'tiny_comps': tiny_comps
    }

print("==================================================")
print("AUDITING CURRENT TASK 2 GLB:")
print("==================================================")
glb_path = r"d:\healthguardian-ai\3d-output\task2-organs\healthguardian-organs-task2.glb"
scene = trimesh.load(glb_path, process=False)

for name, geom in sorted(scene.geometry.items()):
    audit_mesh_topology(name, geom.vertices, geom.faces)

print("\n==================================================")
print("AUDITING RAW SOURCE FILES (pancreas, heart, lungs):")
print("==================================================")
raw_pancreas = trimesh.load(r"d:\healthguardian-ai\frontend\public\models\organs\pancreas.glb", process=False)
if isinstance(raw_pancreas, trimesh.Scene):
    for name, geom in raw_pancreas.geometry.items():
        audit_mesh_topology(f"RAW_PANCREAS_{name}", geom.vertices, geom.faces)

raw_heart = trimesh.load(r"d:\healthguardian-ai\frontend\public\models\organs\heart.glb", process=False)
if isinstance(raw_heart, trimesh.Scene):
    for name, geom in raw_heart.geometry.items():
        if 'atrium' in name.lower():
            audit_mesh_topology(f"RAW_HEART_{name}", geom.vertices, geom.faces)
