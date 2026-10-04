# HealthGuardian AI — 3D Model Browser Validation & Deep Inspection Report

**Document Version:** 1.0.0  
**Date:** September 27, 2026  
**Test Environment:** Isolated 3D Validation Viewer (`http://localhost:5174/`)  
**Engine:** Three.js r186 + DRACOLoader WebAssembly  
**Application Scope:** HealthGuardian Dashboard integration FROZEN. Main application code untouched.  

---

> [!NOTE]
> **Historical Archive Notice & Baseline Reconciliation:**
> The metrics recorded below reflect the early unbatched prototype models tested during Task 1 (September 27, 2026). In subsequent refinement phases (Task 2B, Task 3, and Task 4), muscle/fascia occlusions were removed, draw calls batched, and the asset architecture was unified into the approved production baseline:
> - **Production Asset 3:** `frontend/public/models/healthguardian-organs-skeleton-clean-batched.glb` (11,942,248 bytes, SHA-256: `B2784065E0ADB40CB6FDB47D44033DC53824FE267908695A1DBCADF187F68140`)
> - **Production Geometry Baseline:** 52 child meshes/geometries (26 organ, 26 bone), 36 semantic roots, and 657,930 triangles (588,922 organ + 69,008 bone).
> See [TASK4_COMBINED_ANATOMY_VALIDATION.md](file:///d:/healthguardian-ai/docs/TASK4_COMBINED_ANATOMY_VALIDATION.md) and [3D_ANATOMY_RELEASE_READINESS.md](file:///d:/healthguardian-ai/docs/3D_ANATOMY_RELEASE_READINESS.md) for the active production baseline.

---

## 1. FILE VALIDATION

| Attribute | Asset 1: Organs Only | Asset 2: Skeleton Only | Asset 3: Combined (Organs + Skeleton) |
|:---|:---|:---|:---|
| **File Path** | `d:\healthguardian-ai\3d-output\organs\healthguardian-organs.glb` | `d:\healthguardian-ai\3d-output\skeleton\healthguardian-skeleton.glb` | `d:\healthguardian-ai\3d-output\combined\healthguardian-organs-skeleton.glb` |
| **File Size** | 27,385,056 bytes (26.12 MB) | 8,296,132 bytes (7.91 MB) | 11,693,820 bytes (11.15 MB) |
| **glTF Version** | 2.0 | 2.0 | 2.0 |
| **Scenes Count** | 1 | 1 | 1 |
| **Nodes Count** | 10 | 1,895 | 1,905 |
| **Meshes Count** | 10 | 826 | 836 |
| **Materials Count**| 8 | 2 (`Mat_Bone_Pro`, `Mat_Muscle_Pro`) | 10 |
| **Textures Count** | 9 | 0 | 9 |
| **Images Count** | 9 | 0 | 9 |
| **Animations** | 0 | 0 | 0 |
| **Primitives** | 10 | 826 | 836 |
| **Triangles** | 1,155,002 | 290,886 | 1,445,014 |
| **Extensions Used**| None (Standard binary glTF) | `KHR_draco_mesh_compression` | `KHR_draco_mesh_compression` |
| **Extensions Req.** | None | `KHR_draco_mesh_compression` | `KHR_draco_mesh_compression` |
| **Bounding Box Min**| `[-0.1333, 0.8684, -0.1532]` | `[-0.3343, 0.0081, -0.1301]` | `[-0.3343, 0.0081, -0.1532]` |
| **Bounding Box Max**| `[0.1344, 1.7150, 0.1122]` | `[0.3343, 1.7075, 0.1369]` | `[0.3343, 1.7150, 0.1369]` |
| **Dimensions (X,Y,Z)**| `[0.2677 m, 0.8466 m, 0.2654 m]` | `[0.6687 m, 1.6994 m, 0.2670 m]` | `[0.6687 m, 1.7069 m, 0.2901 m]` |
| **Anatomical Center**| `[0.0006, 1.2917, -0.0205]` | `[0.0000, 0.8578, 0.0034]` | `[-0.0000, 0.8616, -0.0081]` |

---

## 2. SEMANTIC VALIDATION

### A. Organs Hierarchy (Asset 1 & Asset 3)
| Expected Semantic Root | Found in GLB? | Selectable via Raycast? | Verification Result |
|:---|:---:|:---:|:---|
| `organ_brain` | **YES** | **YES** | MATCH |
| `organ_heart` | **YES** | **YES** | MATCH |
| `organ_lungs` | **YES** | **YES** | MATCH |
| `organ_liver` | **YES** | **YES** | MATCH |
| `organ_stomach` | **YES** | **YES** | MATCH |
| `organ_pancreas` | **YES** | **YES** | MATCH |
| `organ_spleen` | **YES** | **YES** | MATCH |
| `organ_left_kidney` | **YES** | **YES** | MATCH |
| `organ_right_kidney`| **YES** | **YES** | MATCH |
| `organ_bladder` | **YES** | **YES** | MATCH |

### B. Skeleton Hierarchy (Asset 2 & Asset 3)
| Expected Semantic Root | Found in GLB? | Selectable via Raycast? | Verification Result |
|:---|:---:|:---:|:---|
| `bone_skull` | **YES** | **YES** | MATCH |
| `bone_cervical_spine` | **YES** | **YES** | MATCH |
| `bone_spine` | **YES** | **YES** | MATCH |
| `bone_ribcage` | **YES** | **YES** | MATCH |
| `bone_sternum` | **YES** | **YES** | MATCH |
| `bone_clavicles` | **YES** | **YES** | MATCH |
| `bone_scapulae` | **YES** | **YES** | MATCH |
| `bone_pelvis` | **YES** | **YES** | MATCH |
| `bone_left_humerus` | **YES** | **YES** | MATCH |
| `bone_right_humerus` | **YES** | **YES** | MATCH |
| `bone_left_forearm` | **YES** | **YES** | MATCH |
| `bone_right_forearm` | **YES** | **YES** | MATCH |
| `bone_left_hand` | **YES** | **YES** | MATCH |
| `bone_right_hand` | **YES** | **YES** | MATCH |
| `bone_left_femur` | **YES** | **YES** | MATCH |
| `bone_right_femur` | **YES** | **YES** | MATCH |
| `bone_left_patella` | **YES** | **YES** | MATCH |
| `bone_right_patella` | **YES** | **YES** | MATCH |
| `bone_left_tibia_fibula` | **YES** | **YES** | MATCH |
| `bone_right_tibia_fibula`| **YES** | **YES** | MATCH |
| `bone_left_foot` | **YES** | **YES** | MATCH |
| `bone_right_foot` | **YES** | **YES** | MATCH |
| `skeleton_ligaments_cartilage` | **YES** | **YES** | MATCH (Contains muscles/fascia that cause occlusion) |

**Total Semantic Groups:** 33 / 33 Present. Semantic Match = **YES**.

---

## 3. ORIENTATION & COORDINATE AXES

| Axis | Specified Meaning | Actual Coordinate Sign in Models | Verification Result |
|:---:|:---|:---|:---:|
| **+X** | Anatomical Right | Positive X (Right humerus `X = +0.248 m`) | **PASS** |
| **-X** | Anatomical Left | Negative X (Left humerus `X = -0.248 m`) | **PASS** |
| **+Y** | Superior / Cranial (Top) | Positive Y (Skull top `Y = +1.708 m`) | **PASS** |
| **-Y** | Inferior / Caudal (Bottom)| Ground level (Feet soles `Y = +0.008 m`) | **PASS** |
| **+Z** | Anterior / Ventral (Front)| Positive Z (Sternum `Z = +0.074 m`) | **PASS** |
| **-Z** | Posterior / Dorsal (Back) | Negative Z (Vertebrae `Z = -0.044 m`) | **PASS** |

The models open facing directly forward along +Z into the primary camera viewport.

---

## 4. ALIGNMENT & CO-REGISTRATION

- **Organs vs. Skeleton:**
  - Common coordinate frame verified; quantitative anatomical registration accuracy not established.
  - Heart sits at `Y = 1.186 m` (sternum / thoracic cavity is `Y = 1.056 m` to `1.447 m`).
  - Lungs sit at `Y = 1.253 m` (enclosed within the ribcage bounds `X = [-0.142, 0.142]`).
  - Kidneys sit at `Y = 0.995 - 1.013 m` retroperitoneally at vertebral level T12–L3.
  - Bladder sits at `Y = 0.895 m` resting in the pelvic bowl (`Y = 0.85 - 0.95 m`).
  - Brain sits at `Y = 1.648 m` inside the cranial cavity.
- **Combined Model Co-registration:**
  - Scale factor: Exactly 1.0x (1.708 m total human standing height across all assets).

---

## 5. INTERACTION TESTS

| Interaction Feature | Implementation & Test Details | Result |
|:---|:---|:---:|
| **Hover Detection** | Pointer movement triggers raycasting; floating tooltip displays candidate semantic node; unhover restores original material. | **PASS** |
| **Click Selection** | Clicking any mesh ascends parent tree to root (`organ_*` or `bone_*`); persists selection; highlights with cyan emissive glow. | **PASS** |
| **Rotation (360°)** | Left-mouse drag and touch-drag rotate around anatomical center `[0, 0.86, 0]`. | **PASS** |
| **Zoom** | Wheel scroll and pinch-to-zoom allow transition from full body (2.8m) to organ micro-depth (0.2m). | **PASS** |
| **Pan** | Right-click drag translates camera target smoothly across the vertical body axis. | **PASS** |
| **Reset** | Restores default anterior perspective framing the entire 1.70m silhouette. | **PASS** |
| **Layer Visibility** | Toggling Organs drops draw calls from 838 to 828; toggling Skeleton drops draw calls from 838 to 12. | **PASS** |

---

## 6. DEEP INSPECTION & ANATOMICAL DEFECT AUDIT

| Anatomical Structure | Visual Findings & Depth Relationship | Defect / Issue Discovered |
|:---|:---|:---|
| **Heart** (`organ_heart`) | Anatomically centered with left ventricular tilt behind sternum. | **OCCLUSION DEFECT:** When skeleton is visible, opaque brown pectoral muscle sheets (`skeleton_ligaments_cartilage`) completely block the anterior view of the heart. |
| **Lungs** (`organ_lungs`) | Bilateral lobes with bronchial arborization and trachea. | **OCCLUSION DEFECT:** Blocked anteriorly by thoracic wall muscle meshes unless skeleton layer is toggled off. |
| **Liver** (`organ_liver`) | Massive right lobe under right hemidiaphragm. | Correct anatomical placement; partially visible beneath lower ribs. |
| **Stomach** (`organ_stomach`) | Left epigastric / hypochondriac placement. | Scaled appropriately to 17cm; sits medial to spleen. |
| **Spleen** (`organ_spleen`) | Posterolateral to stomach under ribs 9–11. | Deep placement is anatomically sound. |
| **Pancreas** (`organ_pancreas`)| Transverse retro-gastric transpyloric orientation. | Enclosed behind stomach and duodenum. |
| **Kidneys** (`organ_kidneys`) | Right kidney lower than left kidney; posterior abdominal wall. | **OCCLUSION DEFECT:** Back view is covered by latissimus dorsi and erector spinae muscle meshes. |
| **Brain** (`organ_brain`) | Sits inside cranial vault. | **PROTRUSION & MATERIAL DEFECT:** Superior cerebral gyri protrude ~1.5 cm above the parietal skull bone; mesh has no PBR texture (renders untextured grey). Also covered anteriorly by facial/epicranial muscles. |
| **Spine** (`bone_spine`) | Presacral vertebrae and sacrum. | Good bony detail, but intervertebral discs and bursae have opaque brown coloring. |
| **Ribcage** (`bone_ribcage`)| Ribs 1–12 with costal cartilages. | Obscured from front and back by superficial muscle meshes. |
| **Skull** (`bone_skull`) | Cranium, zygomatic arches, maxilla, mandible. | Bony skull is covered by facial muscles in the raw skeleton dataset. |
| **Pelvis** (`bone_pelvis`)| Ilium, ischium, pubis, acetabula. | Correct width; bladder nestled inside. Gluteal muscles cover the posterior pelvis. |

---

## 7. PERFORMANCE MEASUREMENTS

### Desktop Performance (AMD Ryzen 5 7520U + Radeon Graphics / Chrome WebGL 2.0)
- **Initial File Load Time:** 1,317 ms (Combined), 544 ms (Organs), 738 ms (Skeleton)
- **GLB / Draco Parse Time:** 298 ms (Combined), 1 ms (Organs), 64 ms (Skeleton)
- **Total Triangles Rendered:** 1,445,014 (Combined), 1,155,002 (Organs), 290,886 (Skeleton)
- **Draw Calls:** 838 calls (Combined), 12 calls (Organs), 828 calls (Skeleton)
- **Observed Idle Frame Rate:** 58–60 FPS
- **Observed Orbit/Rotate Frame Rate:** 48–55 FPS (minor GPU frame drops due to 838 draw calls on integrated Radeon APU)
- **Texture Memory Usage:** ~18 MB VRAM for 9 organ maps

### Mobile Emulation Performance (Pixel 7 / iPhone 14 Pro User-Agent & Touch Emulation)
- **Load Time:** ~2,400 ms
- **Touch Gestures:** Touch-orbit, pinch-zoom, and tap-selection functional
- **Observed Draw Call Impact:** High draw call count (838) is borderline for low-tier mobile devices; batching/joining bone meshes will be required for smooth 60 FPS on budget mobile phones.

---

## 8. ANATOMICAL QUALITY EVALUATION

**Evaluation: PARTIAL**

### Positive Validations:
1. All 10 internal organs are present, spatially co-registered, and scaled realistically relative to a standard 1.70m human body.
2. The coordinate system (+X right, -X left, +Y top, +Z front) is unified across all assets.
3. Organs layer and Skeleton layer can be independently toggled.

### Deficiencies Requiring Remediation Before Dashboard Deployment:
1. **Severe Muscle/Fascia Occlusion:** The skeleton source (`body-anatomy-raw.glb`) contained 1,026 unassigned meshes representing superficial muscles, bursae, and fascial sheets colored dark brown (`Mat_Muscle_Pro`). In the combined model, these meshes form an opaque wall over the chest, abdomen, back, and face, occluding the bones and internal organs.
2. **Brain Mesh Protrusion & Lack of Texture:** The brain mesh gyri stick out ~1.5 cm past the superior calvarium, and the brain has no assigned PBR material.
3. **Raycast Interference:** Because the opaque muscle layer is positioned outward, raycasts on the chest hit `skeleton_ligaments_cartilage` rather than `organ_heart` or `organ_lungs`.

---

## 9. MODEL LIMITATIONS SUMMARY

1. **Muscle Layer Contamination:** The skeleton asset is not "skeleton only"; it includes superficial muscular anatomy that must be stripped out so only true bone structures remain.
2. **Draw Call Overhead:** 826 separate mesh primitives in the skeleton result in 838 draw calls. Merging static bone geometries by region will dramatically improve low-end mobile performance.
3. **Brain Vertical Alignment:** Brain needs to be lowered by ~18 mm and assigned a soft cortical PBR material.

---

## 10. FINAL ASSET STATUS

| Asset | Evaluation | Status | Action Required |
|:---|:---:|:---:|:---|
| **Asset 1: Organs Only** | PARTIAL | **NEEDS WORK** | Fix brain vertical offset (-18 mm) and add cortical PBR material. |
| **Asset 2: Skeleton Only** | PARTIAL | **NEEDS WORK** | Strip out the 1,026 muscle/fascia meshes (`Mat_Muscle_Pro`); keep pure bone geometry. |
| **Asset 3: Combined** | PARTIAL | **NEEDS WORK** | Re-merge purified skeleton with textured organs to eliminate occlusion. |

---

## 11. DASHBOARD INTEGRATION RECOMMENDATION

**DASHBOARD INTEGRATION: NOT APPROVED**

*Stopping condition triggered as instructed. The assets must undergo mesh cleanup (stripping occluding muscle geometry and seating the brain inside the calvarium) before being integrated into `/app/dashboard`.*
