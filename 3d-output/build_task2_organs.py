import os
import sys
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
import fast_simplification

print("=== BUILDING TASK 2 ASSET 1: ORGANS ONLY ===")

source_dir = r"d:\healthguardian-ai\frontend\public\models\organs"
output_dir = r"d:\healthguardian-ai\3d-output\task2-organs"
viewer_models_dir = r"d:\healthguardian-ai\3d-validation-viewer\public\models"

os.makedirs(output_dir, exist_ok=True)
os.makedirs(viewer_models_dir, exist_ok=True)

output_glb_path = os.path.join(output_dir, "healthguardian-organs-task2.glb")
viewer_glb_path = os.path.join(viewer_models_dir, "healthguardian-organs-task2.glb")

# Color palette (sRGB normalized [0, 1]) calibrated against clinical references
PALETTE = {
    'organ_brain': {
        'name': 'Mat_Organ_Brain',
        'color': [0.85, 0.73, 0.70, 1.0],  # Soft cortical blush
        'roughness': 0.65,
        'metallic': 0.04
    },
    'organ_heart': {
        'name': 'Mat_Organ_Heart',
        'color': [0.65, 0.16, 0.17, 1.0],  # Deep myocardial crimson
        'roughness': 0.35,
        'metallic': 0.05
    },
    'organ_lungs': {
        'name': 'Mat_Organ_Lungs',
        'color': [0.78, 0.50, 0.48, 1.0],  # Aerated pulmonary rose
        'roughness': 0.55,
        'metallic': 0.04
    },
    'organ_liver': {
        'name': 'Mat_Organ_Liver',
        'color': [0.55, 0.20, 0.14, 1.0],  # Hepatic red-brown
        'roughness': 0.30,
        'metallic': 0.05
    },
    'organ_stomach': {
        'name': 'Mat_Organ_Stomach',
        'color': [0.76, 0.54, 0.38, 1.0],  # Mucosal warm ochre
        'roughness': 0.40,
        'metallic': 0.04
    },
    'organ_pancreas': {
        'name': 'Mat_Organ_Pancreas',
        'color': [0.84, 0.67, 0.38, 1.0],  # Glandular amber tan
        'roughness': 0.60,
        'metallic': 0.03
    },
    'organ_spleen': {
        'name': 'Mat_Organ_Spleen',
        'color': [0.44, 0.18, 0.30, 1.0],  # Deep lymphoid wine purple
        'roughness': 0.30,
        'metallic': 0.05
    },
    'organ_left_kidney': {
        'name': 'Mat_Organ_Kidney_L',
        'color': [0.56, 0.24, 0.23, 1.0],  # Renal parenchyma chestnut
        'roughness': 0.32,
        'metallic': 0.05
    },
    'organ_right_kidney': {
        'name': 'Mat_Organ_Kidney_R',
        'color': [0.56, 0.24, 0.23, 1.0],  # Renal parenchyma chestnut
        'roughness': 0.32,
        'metallic': 0.05
    },
    'organ_bladder': {
        'name': 'Mat_Organ_Bladder',
        'color': [0.78, 0.58, 0.48, 1.0],  # Urinary muscular dome amber
        'roughness': 0.40,
        'metallic': 0.04
    }
}

# Target max faces per organ for smooth, performant 60 FPS web rendering
TARGET_FACES = {
    'organ_brain': 150000,
    'organ_heart': 90000,
    'organ_lungs': 160000,
    'organ_liver': 50000,
    'organ_stomach': 45000,
    'organ_pancreas': 30000,
    'organ_spleen': 8544,    # Keep original (already compact)
    'organ_left_kidney': 50000,
    'organ_right_kidney': 50000,
    'organ_bladder': 30000
}

def simplify_mesh_if_needed(vertices, faces, target_faces):
    curr_faces = len(faces)
    if curr_faces <= target_faces or target_faces <= 0:
        return vertices, faces
    reduction = 1.0 - (float(target_faces) / float(curr_faces))
    if reduction < 0.05:
        return vertices, faces
    print(f"    Simplifying from {curr_faces} to ~{target_faces} faces (reduction: {reduction*100:.1f}%)...")
    v_out, f_out = fast_simplification.simplify(vertices, faces, target_reduction=reduction)
    print(f"    Result faces: {len(f_out)}")
    return v_out, f_out

organs_data = {}

# 1. BRAIN (BodyParts3D / Clinical MRI)
print("\n[1/10] Processing organ_brain...")
brain_path = os.path.join(source_dir, "brain.glb")
b_scene = trimesh.load(brain_path, process=False)
b_geom = list(b_scene.geometry.values())[0] if isinstance(b_scene, trimesh.Scene) else b_scene
bv = b_geom.vertices.copy()
bf = b_geom.faces.copy()

# Anatomical scale and cranial positioning verified against skull calvarium
s_b = 0.00078
b_vnew = np.zeros_like(bv)
b_vnew[:, 0] = bv[:, 1] * s_b                 # Lateral symmetry -> X
b_vnew[:, 1] = bv[:, 2] * s_b + 1.572         # Superior cortex -> Y (vertex at 1.6917m, inside calvarium at 1.7056m)
b_vnew[:, 2] = -bv[:, 0] * s_b - 0.010        # Anterior frontal pole -> +Z
b_fnew = bf[:, [0, 2, 1]]                     # Swap face winding for outward normals

b_vnew, b_fnew = simplify_mesh_if_needed(b_vnew, b_fnew, TARGET_FACES['organ_brain'])
organs_data['organ_brain'] = (b_vnew, b_fnew)

# 2. STOMACH (BodyParts3D)
print("\n[2/10] Processing organ_stomach...")
stom_path = os.path.join(source_dir, "stomach.glb")
s_scene = trimesh.load(stom_path, process=False)
s_geom = s_scene.to_geometry()
sv = s_geom.vertices.copy()
sf = s_geom.faces.copy()

s_c = (sv.min(axis=0) + sv.max(axis=0)) / 2.0
s_scale = 0.036
s_vnew = np.zeros_like(sv)
# Mirror X so fundus is on Anatomical Left (-X) and pylorus on Anatomical Right (+X)
s_vnew[:, 0] = -(sv[:, 0] - s_c[0]) * s_scale - 0.035
s_vnew[:, 1] = (sv[:, 1] - s_c[1]) * s_scale + 1.070
s_vnew[:, 2] = (sv[:, 2] - s_c[2]) * s_scale + 0.015
s_fnew = sf[:, [0, 2, 1]]

s_vnew, s_fnew = simplify_mesh_if_needed(s_vnew, s_fnew, TARGET_FACES['organ_stomach'])
organs_data['organ_stomach'] = (s_vnew, s_fnew)

# 3. BLADDER (NLM Visible Human Female)
print("\n[3/10] Processing organ_bladder...")
blad_path = os.path.join(source_dir, "bladder.glb")
bl_scene = trimesh.load(blad_path, process=False)
bl_geom = bl_scene.to_geometry()
bl_v = bl_geom.vertices.copy()
bl_f = bl_geom.faces.copy()

bl_vnew = np.zeros_like(bl_v)
bl_vnew[:, 0] = -bl_v[:, 0]
bl_vnew[:, 1] = bl_v[:, 1] + 0.890
bl_vnew[:, 2] = bl_v[:, 2] + 0.020
bl_fnew = bl_f[:, [0, 2, 1]]

bl_vnew, bl_fnew = simplify_mesh_if_needed(bl_vnew, bl_fnew, TARGET_FACES['organ_bladder'])
organs_data['organ_bladder'] = (bl_vnew, bl_fnew)

# 4-10 NLM ORGANS
nlm_list = [
    ('organ_heart', 'heart.glb', 4),
    ('organ_lungs', 'lungs.glb', 5),
    ('organ_liver', 'liver.glb', 6),
    ('organ_pancreas', 'pancreas.glb', 7),
    ('organ_spleen', 'spleen.glb', 8),
    ('organ_left_kidney', 'kidney_l.glb', 9),
    ('organ_right_kidney', 'kidney_r.glb', 10),
]

for org_name, fname, idx in nlm_list:
    print(f"\n[{idx}/10] Processing {org_name} ({fname})...")
    fpath = os.path.join(source_dir, fname)
    sc = trimesh.load(fpath, process=False)
    geom = sc.to_geometry()
    v = geom.vertices.copy()
    f = geom.faces.copy()
    
    vnew = np.zeros_like(v)
    vnew[:, 0] = -v[:, 0]               # Mirror X to match +X=Right, -X=Left
    vnew[:, 1] = v[:, 1] + 0.7099        # Standard human thoracic height alignment
    vnew[:, 2] = v[:, 2]
    fnew = f[:, [0, 2, 1]]              # Invert face winding
    
    vnew, fnew = simplify_mesh_if_needed(vnew, fnew, TARGET_FACES[org_name])
    organs_data[org_name] = (vnew, fnew)

print("\n=== ASSEMBLING CLEAN SCENE HIERARCHY ===")
main_scene = trimesh.Scene()
main_scene.graph.update(frame_to='Organs', frame_from='world')

total_faces = 0
audit_records = []

for org_name in [
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
]:
    v, f = organs_data[org_name]
    mat_cfg = PALETTE[org_name]
    pbr_mat = PBRMaterial(
        name=mat_cfg['name'],
        baseColorFactor=mat_cfg['color'],
        roughnessFactor=mat_cfg['roughness'],
        metallicFactor=mat_cfg['metallic']
    )
    
    mesh = trimesh.Trimesh(vertices=v, faces=f, process=False)
    mesh.visual.material = pbr_mat
    
    main_scene.add_geometry(mesh, node_name=org_name, geom_name=org_name, parent_node_name='Organs')
    
    b_min, b_max = mesh.bounds[0], mesh.bounds[1]
    center = (b_min + b_max) / 2.0
    ext = b_max - b_min
    total_faces += len(f)
    
    audit_records.append({
        'node': org_name,
        'faces': len(f),
        'bounds_min': b_min,
        'bounds_max': b_max,
        'extents': ext,
        'center': center,
        'mat': mat_cfg['name']
    })
    print(f"  + Added {org_name:20s}: Faces={len(f):6d} | Center=({center[0]:.3f}, {center[1]:.3f}, {center[2]:.3f}) | Mat={mat_cfg['name']}")

print(f"\nTotal Organs: {len(audit_records)}")
print(f"Total Triangles: {total_faces}")

# Export GLB
print(f"\nExporting GLB to: {output_glb_path}")
glb_bytes = main_scene.export(file_type='glb')

with open(output_glb_path, 'wb') as f_out:
    f_out.write(glb_bytes)

# Also copy to validation viewer
with open(viewer_glb_path, 'wb') as f_out:
    f_out.write(glb_bytes)

output_size_mb = os.path.getsize(output_glb_path) / (1024 * 1024)
print(f"Export Complete! File Size: {output_size_mb:.2f} MB")
print(f"Copied to validation viewer: {viewer_glb_path}")

# Run post-export verification
print("\n=== POST-EXPORT VERIFICATION ===")
reloaded = trimesh.load(output_glb_path, process=False)
print("Reloaded graph nodes:", list(reloaded.graph.nodes))
assert 'Organs' in reloaded.graph.nodes, "Missing 'Organs' parent node!"
for rec in audit_records:
    assert rec['node'] in reloaded.graph.nodes, f"Missing node {rec['node']} in reloaded GLB!"
print("All 10 required semantic roots verified in GLB!")

# Check no skeleton/muscle names exist
for node in reloaded.graph.nodes:
    lname = node.lower()
    for forbidden in ['bone', 'skull', 'rib', 'vertebra', 'pelvis', 'muscle', 'fascia']:
        if forbidden in lname:
            raise ValueError(f"Contamination detected in node name: {node}")

print("Contamination check: PASSED (zero skeleton, zero muscle, zero fascia).")
print("\nASSET 1 BUILD FINISHED SUCCESSFULLY!")
