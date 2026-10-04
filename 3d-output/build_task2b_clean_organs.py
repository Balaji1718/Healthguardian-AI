import os
import sys
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
import fast_simplification
import scipy.sparse.csgraph as csgraph
from scipy.sparse import coo_matrix

print("=== BUILDING TASK 2B: ASSET 1 GEOMETRY INTEGRITY & VISUAL FIDELITY ===")

source_dir = r"d:\healthguardian-ai\frontend\public\models\organs"
output_dir = r"d:\healthguardian-ai\3d-output\task2-organs"
viewer_models_dir = r"d:\healthguardian-ai\3d-validation-viewer\public\models"

os.makedirs(output_dir, exist_ok=True)
os.makedirs(viewer_models_dir, exist_ok=True)

output_glb_path = os.path.join(output_dir, "healthguardian-organs-task2.glb")
viewer_glb_path = os.path.join(viewer_models_dir, "healthguardian-organs-task2.glb")

# High-fidelity PBR Materials Palette
MATS = {
    # Brain
    'mat_brain_cortex': PBRMaterial(name='Mat_Brain_Cortex', baseColorFactor=[0.86, 0.74, 0.71, 1.0], roughnessFactor=0.65, metallicFactor=0.03),
    'mat_brain_cerebellum': PBRMaterial(name='Mat_Brain_Cerebellum', baseColorFactor=[0.80, 0.65, 0.62, 1.0], roughnessFactor=0.60, metallicFactor=0.03),
    'mat_brain_stem': PBRMaterial(name='Mat_Brain_Stem', baseColorFactor=[0.88, 0.82, 0.76, 1.0], roughnessFactor=0.55, metallicFactor=0.04),

    # Heart
    'mat_heart_myocardium': PBRMaterial(name='Mat_Heart_Myocardium', baseColorFactor=[0.65, 0.16, 0.17, 1.0], roughnessFactor=0.35, metallicFactor=0.05),
    'mat_heart_atria': PBRMaterial(name='Mat_Heart_Atria', baseColorFactor=[0.72, 0.22, 0.22, 1.0], roughnessFactor=0.40, metallicFactor=0.04),
    'mat_heart_valves': PBRMaterial(name='Mat_Heart_Valves', baseColorFactor=[0.90, 0.88, 0.85, 1.0], roughnessFactor=0.25, metallicFactor=0.08),
    'mat_heart_papillary': PBRMaterial(name='Mat_Heart_Papillary', baseColorFactor=[0.58, 0.14, 0.15, 1.0], roughnessFactor=0.38, metallicFactor=0.04),

    # Lungs & Airway
    'mat_lung_parenchyma': PBRMaterial(name='Mat_Lung_Parenchyma', baseColorFactor=[0.78, 0.50, 0.48, 1.0], roughnessFactor=0.55, metallicFactor=0.04),
    'mat_cartilage_rings': PBRMaterial(name='Mat_Cartilage_Rings', baseColorFactor=[0.93, 0.91, 0.87, 1.0], roughnessFactor=0.35, metallicFactor=0.05),
    'mat_trachea_mucosa': PBRMaterial(name='Mat_Trachea_Mucosa', baseColorFactor=[0.85, 0.68, 0.65, 1.0], roughnessFactor=0.45, metallicFactor=0.03),
    'mat_larynx_cartilage': PBRMaterial(name='Mat_Larynx_Cartilage', baseColorFactor=[0.90, 0.87, 0.82, 1.0], roughnessFactor=0.38, metallicFactor=0.05),

    # Liver
    'mat_liver_parenchyma': PBRMaterial(name='Mat_Liver_Parenchyma', baseColorFactor=[0.55, 0.20, 0.14, 1.0], roughnessFactor=0.30, metallicFactor=0.05),
    'mat_liver_ligament': PBRMaterial(name='Mat_Liver_Ligament', baseColorFactor=[0.86, 0.83, 0.77, 1.0], roughnessFactor=0.38, metallicFactor=0.05),

    # Stomach
    'mat_stomach_mucosa': PBRMaterial(name='Mat_Stomach_Mucosa', baseColorFactor=[0.76, 0.54, 0.38, 1.0], roughnessFactor=0.40, metallicFactor=0.04),

    # Pancreas
    'mat_pancreas_head': PBRMaterial(name='Mat_Pancreas_Head', baseColorFactor=[0.86, 0.69, 0.39, 1.0], roughnessFactor=0.55, metallicFactor=0.03),
    'mat_pancreas_body': PBRMaterial(name='Mat_Pancreas_Body', baseColorFactor=[0.82, 0.65, 0.36, 1.0], roughnessFactor=0.55, metallicFactor=0.03),

    # Spleen
    'mat_spleen_parenchyma': PBRMaterial(name='Mat_Spleen_Parenchyma', baseColorFactor=[0.44, 0.18, 0.30, 1.0], roughnessFactor=0.30, metallicFactor=0.05),

    # Kidneys
    'mat_kidney_capsule': PBRMaterial(name='Mat_Kidney_Capsule', baseColorFactor=[0.56, 0.24, 0.23, 1.0], roughnessFactor=0.32, metallicFactor=0.05),
    'mat_kidney_cortex': PBRMaterial(name='Mat_Kidney_Cortex', baseColorFactor=[0.68, 0.36, 0.32, 1.0], roughnessFactor=0.45, metallicFactor=0.03),
    'mat_kidney_pyramids': PBRMaterial(name='Mat_Kidney_Pyramids', baseColorFactor=[0.48, 0.18, 0.18, 1.0], roughnessFactor=0.50, metallicFactor=0.04),

    # Bladder
    'mat_bladder_dome': PBRMaterial(name='Mat_Bladder_Dome', baseColorFactor=[0.78, 0.58, 0.48, 1.0], roughnessFactor=0.40, metallicFactor=0.04),
    'mat_bladder_trigone': PBRMaterial(name='Mat_Bladder_Trigone', baseColorFactor=[0.72, 0.50, 0.42, 1.0], roughnessFactor=0.45, metallicFactor=0.03),
}

def clean_mesh_hard(vertices, faces, min_comp_faces=15, weld_tol=1e-4):
    """
    Performs hard geometry clean:
    1. Welds coincident vertices within tolerance (e.g. pancreas duplicate vertices).
    2. Removes exact zero-area/degenerate faces (e.g. heart right atrium).
    3. Removes accidental duplicate faces.
    4. Removes unreferenced vertices.
    5. Filters out spurious tiny disconnected shards (<= min_comp_faces).
    6. Fixes normals to ensure consistent outward orientation.
    """
    v = vertices.copy()
    f = faces.copy()
    
    # 1. Weld coincident vertices if requested
    if weld_tol > 0:
        decimals = int(-np.log10(weld_tol))
        rounded = np.round(v, decimals)
        _, u_v_idx, inv = np.unique(rounded, axis=0, return_index=True, return_inverse=True)
        f = inv[f]
        v = v[u_v_idx]

    # 2. Remove degenerate / zero-area faces
    # Check for identical vertex indices in a face
    non_deg = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 2] != f[:, 0])
    f = f[non_deg]
    
    # Check actual geometric area
    e0 = v[f[:, 1]] - v[f[:, 0]]
    e1 = v[f[:, 2]] - v[f[:, 0]]
    cross = np.cross(e0, e1)
    areas = 0.5 * np.linalg.norm(cross, axis=1)
    valid_area = areas > 1e-10
    f = f[valid_area]

    # 3. Remove duplicate faces (independent of winding)
    sf = np.sort(f, axis=1)
    _, u_f_idx = np.unique(sf, axis=0, return_index=True)
    f = f[u_f_idx]

    # 4. Remove unreferenced vertices
    used_v = np.unique(f)
    v_map = np.full(len(v), -1, dtype=int)
    v_map[used_v] = np.arange(len(used_v))
    v = v[used_v]
    f = v_map[f]

    # 5. Filter out tiny disconnected components
    m = trimesh.Trimesh(vertices=v, faces=f, process=False)
    if min_comp_faces > 0:
        comps = m.split(only_watertight=False)
        valid_comps = [c for c in comps if len(c.faces) > min_comp_faces]
        if len(valid_comps) > 0:
            m = trimesh.util.concatenate(valid_comps)

    # 6. Fix normals and remove any newly induced zero-area faces
    m.fix_normals()
    
    # Final check on degenerate & duplicate faces
    e0 = m.vertices[m.faces[:, 1]] - m.vertices[m.faces[:, 0]]
    e1 = m.vertices[m.faces[:, 2]] - m.vertices[m.faces[:, 0]]
    areas = 0.5 * np.linalg.norm(np.cross(e0, e1), axis=1)
    m = m.submesh([areas > 1e-10], append=True)
    
    return m

def simplify_mesh_if_needed(mesh, target_faces):
    curr_faces = len(mesh.faces)
    if curr_faces <= target_faces or target_faces <= 0:
        return mesh
    reduction = 1.0 - (float(target_faces) / float(curr_faces))
    if reduction < 0.05:
        return mesh
    v_out, f_out = fast_simplification.simplify(mesh.vertices, mesh.faces, target_reduction=reduction)
    # Clean again after simplification to ensure no boundary duplicate/degenerate faces were created
    return clean_mesh_hard(v_out, f_out, min_comp_faces=10, weld_tol=0)

def transform_nlm(mesh):
    v = mesh.vertices.copy()
    v_new = np.zeros_like(v)
    v_new[:, 0] = -v[:, 0]          # +X = Right, -X = Left
    v_new[:, 1] = v[:, 1] + 0.7099   # Superior offset to standard human height
    v_new[:, 2] = v[:, 2]           # +Z = Front
    f_new = mesh.faces[:, [0, 2, 1]] # Swap winding for outward normals
    return trimesh.Trimesh(vertices=v_new, faces=f_new, process=False)

main_scene = trimesh.Scene()
main_scene.graph.update(frame_to='Organs', frame_from='world')

organ_roots = [
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

for r in organ_roots:
    main_scene.graph.update(frame_to=r, frame_from='Organs')

total_tris = 0
audit_results = []

# =========================================================================
# 1. BRAIN (BodyParts3D: Cortex, Cerebellum, Brainstem)
# =========================================================================
print("\n[1/10] Building high-fidelity organ_brain...")
b_scene = trimesh.load(os.path.join(source_dir, "brain.glb"), process=False)
bg = list(b_scene.geometry.values())[0] if isinstance(b_scene, trimesh.Scene) else b_scene
bv = bg.vertices.copy()
bf = bg.faces.copy()

# Centroids in raw coordinates
fc = bv[bf].mean(axis=1)
is_brainstem = (fc[:, 2] < 50) & (np.abs(fc[:, 1]) <= 16) & (fc[:, 0] >= -10) & (fc[:, 0] <= 30)
is_cerebellum = (fc[:, 0] > 16) & (fc[:, 2] < 68) & ~is_brainstem
is_cortex = ~(is_cerebellum | is_brainstem)

m_cortex = clean_mesh_hard(bg.submesh([is_cortex], append=True).vertices, bg.submesh([is_cortex], append=True).faces, min_comp_faces=15)
m_cereb = clean_mesh_hard(bg.submesh([is_cerebellum], append=True).vertices, bg.submesh([is_cerebellum], append=True).faces, min_comp_faces=15)
m_stem = clean_mesh_hard(bg.submesh([is_brainstem], append=True).vertices, bg.submesh([is_brainstem], append=True).faces, min_comp_faces=5)

s_b = 0.00078
def transform_brain_part(m):
    v = m.vertices
    v_new = np.zeros_like(v)
    v_new[:, 0] = v[:, 1] * s_b
    v_new[:, 1] = v[:, 2] * s_b + 1.572
    v_new[:, 2] = -v[:, 0] * s_b - 0.010
    f_new = m.faces[:, [0, 2, 1]]
    return trimesh.Trimesh(vertices=v_new, faces=f_new, process=False)

mb_cortex = simplify_mesh_if_needed(transform_brain_part(m_cortex), 100000)
mb_cortex = clean_mesh_hard(mb_cortex.vertices, mb_cortex.faces, min_comp_faces=15, weld_tol=0)
mb_cortex.visual.material = MATS['mat_brain_cortex']

mb_cereb = simplify_mesh_if_needed(transform_brain_part(m_cereb), 25000)
mb_cereb = clean_mesh_hard(mb_cereb.vertices, mb_cereb.faces, min_comp_faces=15, weld_tol=0)
mb_cereb.visual.material = MATS['mat_brain_cerebellum']

mb_stem = transform_brain_part(m_stem)
mb_stem = clean_mesh_hard(mb_stem.vertices, mb_stem.faces, min_comp_faces=5, weld_tol=0)
mb_stem.visual.material = MATS['mat_brain_stem']

main_scene.add_geometry(mb_cortex, node_name='brain_cerebral_cortex', geom_name='brain_cerebral_cortex', parent_node_name='organ_brain')
main_scene.add_geometry(mb_cereb, node_name='brain_cerebellum', geom_name='brain_cerebellum', parent_node_name='organ_brain')
main_scene.add_geometry(mb_stem, node_name='brain_brainstem', geom_name='brain_brainstem', parent_node_name='organ_brain')

# =========================================================================
# 2. HEART (NLM: Ventricles, Atria, Valves, Papillary Muscles)
# =========================================================================
print("\n[2/10] Building high-fidelity organ_heart...")
h_scene = trimesh.load(os.path.join(source_dir, "heart.glb"), process=False)
ventricle_geoms = []
atria_geoms = []
valve_geoms = []
papillary_geoms = []

for name, g in h_scene.geometry.items():
    lname = name.lower()
    if 'valve' in lname:
        valve_geoms.append(g)
    elif 'atrium' in lname:
        atria_geoms.append(g)
    elif 'ventricle' in lname or 'septum' in lname:
        ventricle_geoms.append(g)
    elif 'papillary' in lname:
        papillary_geoms.append(g)

m_ventricles = transform_nlm(trimesh.util.concatenate(ventricle_geoms))
m_ventricles = simplify_mesh_if_needed(m_ventricles, 40000)
m_ventricles = clean_mesh_hard(m_ventricles.vertices, m_ventricles.faces, min_comp_faces=15, weld_tol=0)
m_ventricles.visual.material = MATS['mat_heart_myocardium']

# Clean heart atria specifically to remove all degenerate/zero-area faces
raw_atria_concat = trimesh.util.concatenate(atria_geoms)
clean_atria = clean_mesh_hard(raw_atria_concat.vertices, raw_atria_concat.faces, min_comp_faces=15, weld_tol=1e-5)
m_atria = transform_nlm(clean_atria)
m_atria = simplify_mesh_if_needed(m_atria, 35000)
m_atria = clean_mesh_hard(m_atria.vertices, m_atria.faces, min_comp_faces=15, weld_tol=0)
m_atria.visual.material = MATS['mat_heart_atria']

m_valves = transform_nlm(trimesh.util.concatenate(valve_geoms))
m_valves = clean_mesh_hard(m_valves.vertices, m_valves.faces, min_comp_faces=10, weld_tol=0)
m_valves.visual.material = MATS['mat_heart_valves']

m_papillary = transform_nlm(trimesh.util.concatenate(papillary_geoms))
m_papillary = clean_mesh_hard(m_papillary.vertices, m_papillary.faces, min_comp_faces=10, weld_tol=0)
m_papillary.visual.material = MATS['mat_heart_papillary']

main_scene.add_geometry(m_ventricles, node_name='heart_ventricles', geom_name='heart_ventricles', parent_node_name='organ_heart')
main_scene.add_geometry(m_atria, node_name='heart_atria', geom_name='heart_atria', parent_node_name='organ_heart')
main_scene.add_geometry(m_valves, node_name='heart_valves', geom_name='heart_valves', parent_node_name='organ_heart')
main_scene.add_geometry(m_papillary, node_name='heart_papillary_muscles', geom_name='heart_papillary_muscles', parent_node_name='organ_heart')

# =========================================================================
# 3. LUNGS (NLM: Parenchyma, Tracheal Cartilage Rings, Bronchi, Larynx)
# =========================================================================
print("\n[3/10] Building high-fidelity organ_lungs...")
l_scene = trimesh.load(os.path.join(source_dir, "lungs.glb"), process=False)
l_parenchyma = []
l_tracheal_cart = []
l_bronchial_cart = []
l_trachea_tube = []
l_larynx_cart = []

for name, g in l_scene.geometry.items():
    lname = name.lower()
    if 'tracheal_cartilage' in lname:
        l_tracheal_cart.append(g)
    elif 'bronchial_cartilage' in lname or 'carina' in lname:
        l_bronchial_cart.append(g)
    elif any(k in lname for k in ['thyroid_cartilage', 'cricoid_cartilage', 'epiglottic', 'arytenoid']):
        l_larynx_cart.append(g)
    elif any(k in lname for k in ['trachea', 'bronchus', 'mucosa']):
        l_trachea_tube.append(g)
    elif any(k in lname for k in ['segment', 'hilum']):
        l_parenchyma.append(g)

m_l_parenchyma = transform_nlm(trimesh.util.concatenate(l_parenchyma))
m_l_parenchyma = clean_mesh_hard(m_l_parenchyma.vertices, m_l_parenchyma.faces, min_comp_faces=15, weld_tol=0)
m_l_parenchyma.visual.material = MATS['mat_lung_parenchyma']

m_l_tracheal_cart = transform_nlm(trimesh.util.concatenate(l_tracheal_cart))
m_l_tracheal_cart = simplify_mesh_if_needed(m_l_tracheal_cart, 20000)
m_l_tracheal_cart = clean_mesh_hard(m_l_tracheal_cart.vertices, m_l_tracheal_cart.faces, min_comp_faces=10, weld_tol=0)
m_l_tracheal_cart.visual.material = MATS['mat_cartilage_rings']

m_l_bronchial_cart = transform_nlm(trimesh.util.concatenate(l_bronchial_cart))
m_l_bronchial_cart = simplify_mesh_if_needed(m_l_bronchial_cart, 30000)
m_l_bronchial_cart = clean_mesh_hard(m_l_bronchial_cart.vertices, m_l_bronchial_cart.faces, min_comp_faces=10, weld_tol=0)
m_l_bronchial_cart.visual.material = MATS['mat_cartilage_rings']

m_l_trachea_tube = transform_nlm(trimesh.util.concatenate(l_trachea_tube))
m_l_trachea_tube = simplify_mesh_if_needed(m_l_trachea_tube, 20000)
m_l_trachea_tube = clean_mesh_hard(m_l_trachea_tube.vertices, m_l_trachea_tube.faces, min_comp_faces=10, weld_tol=0)
m_l_trachea_tube.visual.material = MATS['mat_trachea_mucosa']

m_l_larynx_cart = transform_nlm(trimesh.util.concatenate(l_larynx_cart))
m_l_larynx_cart = simplify_mesh_if_needed(m_l_larynx_cart, 10000)
m_l_larynx_cart = clean_mesh_hard(m_l_larynx_cart.vertices, m_l_larynx_cart.faces, min_comp_faces=10, weld_tol=0)
m_l_larynx_cart.visual.material = MATS['mat_larynx_cartilage']

main_scene.add_geometry(m_l_parenchyma, node_name='lungs_pulmonary_parenchyma', geom_name='lungs_pulmonary_parenchyma', parent_node_name='organ_lungs')
main_scene.add_geometry(m_l_tracheal_cart, node_name='lungs_tracheal_cartilage', geom_name='lungs_tracheal_cartilage', parent_node_name='organ_lungs')
main_scene.add_geometry(m_l_bronchial_cart, node_name='lungs_bronchial_cartilage', geom_name='lungs_bronchial_cartilage', parent_node_name='organ_lungs')
main_scene.add_geometry(m_l_trachea_tube, node_name='lungs_trachea_airway', geom_name='lungs_trachea_airway', parent_node_name='organ_lungs')
main_scene.add_geometry(m_l_larynx_cart, node_name='lungs_laryngeal_cartilages', geom_name='lungs_laryngeal_cartilages', parent_node_name='organ_lungs')

# =========================================================================
# 4. LIVER (NLM: Lobes, Segments, Falciform & Peritoneal Ligaments)
# =========================================================================
print("\n[4/10] Building high-fidelity organ_liver...")
liv_scene = trimesh.load(os.path.join(source_dir, "liver.glb"), process=False)
liv_parenchyma = []
liv_ligaments = []

for name, g in liv_scene.geometry.items():
    lname = name.lower()
    if 'ligament' in lname:
        liv_ligaments.append(g)
    else:
        liv_parenchyma.append(g)

m_liv_par = transform_nlm(trimesh.util.concatenate(liv_parenchyma))
m_liv_par = simplify_mesh_if_needed(m_liv_par, 45000)
m_liv_par = clean_mesh_hard(m_liv_par.vertices, m_liv_par.faces, min_comp_faces=15, weld_tol=0)
m_liv_par.visual.material = MATS['mat_liver_parenchyma']

m_liv_lig = transform_nlm(trimesh.util.concatenate(liv_ligaments))
m_liv_lig = clean_mesh_hard(m_liv_lig.vertices, m_liv_lig.faces, min_comp_faces=10, weld_tol=0)
m_liv_lig.visual.material = MATS['mat_liver_ligament']

main_scene.add_geometry(m_liv_par, node_name='liver_parenchyma', geom_name='liver_parenchyma', parent_node_name='organ_liver')
main_scene.add_geometry(m_liv_lig, node_name='liver_falciform_ligaments', geom_name='liver_falciform_ligaments', parent_node_name='organ_liver')

# =========================================================================
# 5. STOMACH (BodyParts3D: Cardia, Fundus, Curvatures, Pylorus)
# =========================================================================
print("\n[5/10] Building high-fidelity organ_stomach...")
stom_scene = trimesh.load(os.path.join(source_dir, "stomach.glb"), process=False)
sm = stom_scene.to_geometry()
sv = sm.vertices.copy()
sf = sm.faces.copy()

s_c = (sv.min(axis=0) + sv.max(axis=0)) / 2.0
s_scale = 0.036
s_vnew = np.zeros_like(sv)
s_vnew[:, 0] = -(sv[:, 0] - s_c[0]) * s_scale - 0.035
s_vnew[:, 1] = (sv[:, 1] - s_c[1]) * s_scale + 1.070
s_vnew[:, 2] = (sv[:, 2] - s_c[2]) * s_scale + 0.015
s_fnew = sf[:, [0, 2, 1]]

m_stomach = trimesh.Trimesh(vertices=s_vnew, faces=s_fnew, process=False)
m_stomach = simplify_mesh_if_needed(m_stomach, 45000)
m_stomach = clean_mesh_hard(m_stomach.vertices, m_stomach.faces, min_comp_faces=15, weld_tol=0)
m_stomach.visual.material = MATS['mat_stomach_mucosa']

main_scene.add_geometry(m_stomach, node_name='stomach_mucosa', geom_name='stomach_mucosa', parent_node_name='organ_stomach')

# =========================================================================
# 6. PANCREAS (NLM: Welded Coherent Manifold Head, Uncinate, Body, Tail)
# =========================================================================
print("\n[6/10] Building high-fidelity organ_pancreas with welded topology...")
p_scene = trimesh.load(os.path.join(source_dir, "pancreas.glb"), process=False)
p_head_geoms = [p_scene.geometry['VH_M_head_of_pancreas'], p_scene.geometry['VH_M_uncinate_process_of_the_pancreas']]
p_body_geoms = [p_scene.geometry['VH_M_neck_of_pancreas'], p_scene.geometry['VH_M_body_of_pancreas'], p_scene.geometry['VH_M_tail_of_pancreas']]

# Pre-weld coincident vertices to eliminate fragmented 2-triangle pieces
head_concat = trimesh.util.concatenate(p_head_geoms)
clean_head = clean_mesh_hard(head_concat.vertices, head_concat.faces, min_comp_faces=20, weld_tol=1e-4)
m_p_head = transform_nlm(clean_head)
m_p_head = clean_mesh_hard(m_p_head.vertices, m_p_head.faces, min_comp_faces=20, weld_tol=0)
m_p_head.visual.material = MATS['mat_pancreas_head']

body_concat = trimesh.util.concatenate(p_body_geoms)
clean_body = clean_mesh_hard(body_concat.vertices, body_concat.faces, min_comp_faces=20, weld_tol=1e-4)
m_p_body = transform_nlm(clean_body)
m_p_body = simplify_mesh_if_needed(m_p_body, 22000)
m_p_body = clean_mesh_hard(m_p_body.vertices, m_p_body.faces, min_comp_faces=20, weld_tol=0)
m_p_body.visual.material = MATS['mat_pancreas_body']

main_scene.add_geometry(m_p_head, node_name='pancreas_head', geom_name='pancreas_head', parent_node_name='organ_pancreas')
main_scene.add_geometry(m_p_body, node_name='pancreas_body_tail', geom_name='pancreas_body_tail', parent_node_name='organ_pancreas')

# =========================================================================
# 7. SPLEEN (NLM: Diaphragmatic, Gastric, Renal Surfaces, Hilum)
# =========================================================================
print("\n[7/10] Building high-fidelity organ_spleen...")
spl_scene = trimesh.load(os.path.join(source_dir, "spleen.glb"), process=False)
m_spleen = transform_nlm(spl_scene.to_geometry())
m_spleen = clean_mesh_hard(m_spleen.vertices, m_spleen.faces, min_comp_faces=10, weld_tol=0)
m_spleen.visual.material = MATS['mat_spleen_parenchyma']

main_scene.add_geometry(m_spleen, node_name='spleen_parenchyma', geom_name='spleen_parenchyma', parent_node_name='organ_spleen')

# =========================================================================
# 8 & 9. KIDNEYS (NLM: Capsule, Hilum, Cortex, Columns, Pyramids, Papillae)
# =========================================================================
for side, fname, root_name in [
    ('l', 'kidney_l.glb', 'organ_left_kidney'),
    ('r', 'kidney_r.glb', 'organ_right_kidney')
]:
    print(f"\n[{8 if side=='l' else 9}/10] Building high-fidelity {root_name}...")
    k_scene = trimesh.load(os.path.join(source_dir, fname), process=False)
    k_capsule = []
    k_cortex = []
    k_pyramids = []

    for name, g in k_scene.geometry.items():
        lname = name.lower()
        if 'capsule' in lname or 'hilum' in lname:
            k_capsule.append(g)
        elif 'pyramid' in lname or 'papilla' in lname:
            k_pyramids.append(g)
        else:
            k_cortex.append(g)

    m_k_cap = transform_nlm(trimesh.util.concatenate(k_capsule))
    m_k_cap = clean_mesh_hard(m_k_cap.vertices, m_k_cap.faces, min_comp_faces=15, weld_tol=0)
    m_k_cap.visual.material = MATS['mat_kidney_capsule']

    m_k_cor = transform_nlm(trimesh.util.concatenate(k_cortex))
    m_k_cor = simplify_mesh_if_needed(m_k_cor, 20000)
    m_k_cor = clean_mesh_hard(m_k_cor.vertices, m_k_cor.faces, min_comp_faces=15, weld_tol=0)
    m_k_cor.visual.material = MATS['mat_kidney_cortex']

    m_k_pyr = transform_nlm(trimesh.util.concatenate(k_pyramids))
    m_k_pyr = simplify_mesh_if_needed(m_k_pyr, 15000)
    m_k_pyr = clean_mesh_hard(m_k_pyr.vertices, m_k_pyr.faces, min_comp_faces=15, weld_tol=0)
    m_k_pyr.visual.material = MATS['mat_kidney_pyramids']

    main_scene.add_geometry(m_k_cap, node_name=f'kidney_{side}_capsule_hilum', geom_name=f'kidney_{side}_capsule_hilum', parent_node_name=root_name)
    main_scene.add_geometry(m_k_cor, node_name=f'kidney_{side}_cortex_columns', geom_name=f'kidney_{side}_cortex_columns', parent_node_name=root_name)
    main_scene.add_geometry(m_k_pyr, node_name=f'kidney_{side}_pyramids_papillae', geom_name=f'kidney_{side}_pyramids_papillae', parent_node_name=root_name)

# =========================================================================
# 10. BLADDER (NLM: Dome, Neck, Base, Trigone, Ureteral Orifices)
# =========================================================================
print("\n[10/10] Building high-fidelity organ_bladder...")
bld_scene = trimesh.load(os.path.join(source_dir, "bladder.glb"), process=False)
bld_dome = []
bld_neck = []

for name, g in bld_scene.geometry.items():
    lname = name.lower()
    if 'dome' in lname or 'fundus' in lname:
        bld_dome.append(g)
    else:
        bld_neck.append(g)

def transform_bladder_part(mesh):
    v = mesh.vertices.copy()
    v_new = np.zeros_like(v)
    v_new[:, 0] = -v[:, 0]
    v_new[:, 1] = v[:, 1] + 0.890
    v_new[:, 2] = v[:, 2] + 0.020
    f_new = mesh.faces[:, [0, 2, 1]]
    return trimesh.Trimesh(vertices=v_new, faces=f_new, process=False)

m_bld_dome = transform_bladder_part(trimesh.util.concatenate(bld_dome))
m_bld_dome = simplify_mesh_if_needed(m_bld_dome, 20000)
m_bld_dome = clean_mesh_hard(m_bld_dome.vertices, m_bld_dome.faces, min_comp_faces=10, weld_tol=0)
m_bld_dome.visual.material = MATS['mat_bladder_dome']

m_bld_neck = transform_bladder_part(trimesh.util.concatenate(bld_neck))
m_bld_neck = clean_mesh_hard(m_bld_neck.vertices, m_bld_neck.faces, min_comp_faces=10, weld_tol=0)
m_bld_neck.visual.material = MATS['mat_bladder_trigone']

main_scene.add_geometry(m_bld_dome, node_name='bladder_muscular_dome', geom_name='bladder_muscular_dome', parent_node_name='organ_bladder')
main_scene.add_geometry(m_bld_neck, node_name='bladder_neck_trigone', geom_name='bladder_neck_trigone', parent_node_name='organ_bladder')

# =========================================================================
# RIGOROUS HARD GEOMETRY AUDIT ON FINAL SCENE
# =========================================================================
print("\n=== RUNNING MANDATORY HARD GEOMETRY AUDIT ON SCENE ===")
all_clean = True
total_faces = 0

for gname, geom in sorted(main_scene.geometry.items()):
    v = geom.vertices
    f = geom.faces
    total_faces += len(f)
    
    # 1. Zero area faces
    e0 = v[f[:, 1]] - v[f[:, 0]]
    e1 = v[f[:, 2]] - v[f[:, 0]]
    cross = np.cross(e0, e1)
    areas = 0.5 * np.linalg.norm(cross, axis=1)
    deg_faces = np.sum(areas <= 1e-10)
    
    # 2. Duplicate faces
    sf = np.sort(f, axis=1)
    _, counts = np.unique(sf, axis=0, return_counts=True)
    dup_faces = np.sum(counts > 1)
    
    # 3. Connected components
    edges = np.vstack([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    n_verts = len(v)
    adj = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(n_verts, n_verts))
    n_components, labels = csgraph.connected_components(adj, directed=False)
    comp_sizes = np.bincount(labels)
    tiny_comps = np.sum(comp_sizes <= 10)
    max_comp = np.max(comp_sizes) if len(comp_sizes) > 0 else 0
    
    status = "OK"
    if deg_faces > 0 or dup_faces > 0:
        status = "FAIL"
        all_clean = False
        
    print(f"  [{status}] {gname:30s} | Faces: {len(f):6,d} | Degenerate: {deg_faces} | Dups: {dup_faces} | Comps: {n_components:4d} (Max: {max_comp:6d}, <=10: {tiny_comps})")

if not all_clean:
    raise ValueError("HARD GEOMETRY AUDIT FAILED! Degenerate or duplicate faces detected!")

print(f"\nHARD GEOMETRY AUDIT: PASSED 100%! Zero degenerate faces, Zero duplicate faces.")
print(f"TOTAL ASSET 1 FACES: {total_faces:,}")

# Export to GLB
print(f"\nExporting GLB to: {output_glb_path}")
glb_bytes = main_scene.export(file_type='glb')

with open(output_glb_path, 'wb') as f_out:
    f_out.write(glb_bytes)

with open(viewer_glb_path, 'wb') as f_out:
    f_out.write(glb_bytes)

size_mb = os.path.getsize(output_glb_path) / (1024 * 1024)
print(f"Export Complete! File Size: {size_mb:.2f} MB")
print(f"Copied to validation viewer: {viewer_glb_path}")

print("\nTASK 2B BUILD FINISHED SUCCESSFULLY!")
