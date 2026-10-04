import os
import trimesh
import numpy as np

organs_dir = r"d:\healthguardian-ai\frontend\public\models\organs"
print("Scanning:", organs_dir)

for fname in sorted(os.listdir(organs_dir)):
    fpath = os.path.join(organs_dir, fname)
    if not fname.endswith(('.glb', '.gltf')):
        continue
    scene_or_mesh = trimesh.load(fpath, process=False)
    print(f"\n==========================================")
    print(f"FILE: {fname}")
    print(f"==========================================")
    
    if isinstance(scene_or_mesh, trimesh.Scene):
        bounds = scene_or_mesh.bounds
        extents = scene_or_mesh.extents
        total_tris = sum(len(g.faces) for g in scene_or_mesh.geometry.values() if hasattr(g, 'faces'))
        print(f"Type: Scene | Geometries: {len(scene_or_mesh.geometry)} | Total Triangles: {total_tris}")
        print(f"Bounds Min: {np.round(bounds[0], 4)}")
        print(f"Bounds Max: {np.round(bounds[1], 4)}")
        print(f"Extents:    {np.round(extents, 4)}")
        print(f"Center:     {np.round((bounds[0] + bounds[1])/2.0, 4)}")
        
        # Details of first 5 geometries
        for i, (gname, geom) in enumerate(scene_or_mesh.geometry.items()):
            if i < 8:
                fcount = len(geom.faces) if hasattr(geom, 'faces') else 0
                gbounds = geom.bounds if hasattr(geom, 'bounds') else [0,0]
                mat_name = getattr(geom.visual, 'material', None)
                if hasattr(mat_name, 'name'):
                    mat_str = mat_name.name
                else:
                    mat_str = str(type(geom.visual))
                print(f"  Geom [{i}]: {gname} | Faces: {fcount} | Mat: {mat_str}")
        if len(scene_or_mesh.geometry) > 8:
            print(f"  ... and {len(scene_or_mesh.geometry) - 8} more geometries")
    else:
        print(f"Type: Trimesh | Faces: {len(scene_or_mesh.faces)}")
        print(f"Bounds Min: {np.round(scene_or_mesh.bounds[0], 4)}")
        print(f"Bounds Max: {np.round(scene_or_mesh.bounds[1], 4)}")
        print(f"Extents:    {np.round(scene_or_mesh.extents, 4)}")
        print(f"Center:     {np.round((scene_or_mesh.bounds[0] + scene_or_mesh.bounds[1])/2.0, 4)}")
