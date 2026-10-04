# 3D Anatomical Asset Documentation & Licensing

**Project:** HealthGuardian AI  
**Asset Name:** Multi-Structure Anatomical Model System (`human-anatomy.glb` & Modular Organ Library)  
**Target Format:** glTF 2.0 Binary (`.glb`)  
**Target Directory:** `frontend/public/models/`  
**License Compliance:** Verified Open-Access / Permissive Open Source (CC-BY & MIT)

---

## 1. Overview & Provenance

HealthGuardian AI's 3D Anatomical Dashboard uses medical-grade 3D geometry derived exclusively from verified, public-domain and open-access anatomical reference datasets.

### Primary Geometry Sources

1. **National Institutes of Health (NIH) 3D Print Exchange (`3d.nih.gov`)**
   - **Source:** Visible Human Project (National Library of Medicine / NIH) and clinical imaging segmentations
   - **License:** Creative Commons Attribution (CC BY 4.0 / CC BY 3.0) & Public Domain
   - **Authors:** Kristen Browne, Heidi Schlehlein, Nevit Dilmen, PHS Research
   - **Components Sourced:**
     - Heart (`VH_M_Heart.glb`) — Visible Human Male Heart (NIH 3DPX-021000)
     - Lungs (`3d-vh-f-lung.glb`) — Visible Human Female Lungs (NIH 3DPX-021008)
     - Brain (`Atrophic_Brain_Cube_T2_Flair_3DFile_300000_NIH3D.glb`) — MRI T2/Flair anatomical reconstruction (NIH 3DPX-002386)
     - Liver (`VH_M_Liver.glb`) — Visible Human Male Liver (NIH 3DPX-021007)
     - Kidneys (`VH_M_Kidney_L.glb`) — Visible Human Male Kidneys (NIH 3DPX-021001)
     - Stomach (`realistic_stomach.glb`) — Anatomical stomach reconstruction (NIH 3DPX-021124)
     - Pancreas (`3d-vh-m-pancreas.glb`) — Visible Human Male Pancreas (NIH 3DPX-021013)
     - Spleen (`VH_F_Spleen.glb`) — Visible Human Female Spleen (NIH 3DPX-020989)
     - Large & Small Intestines (`SBU_F_Intestine_Large.glb`, `VH_F_Small_Intestine.glb`) (NIH 3DPX-020971)
     - Urinary Bladder (`VH_F_Urinary_Bladder.glb`) (NIH 3DPX-020995)

2. **Z-Anatomy Project / BodyParts3D**
   - **Source:** Z-Anatomy Atlas (Open-Source Anatomical Database)
   - **License:** Creative Commons Attribution-ShareAlike (CC BY-SA 4.0)
   - **Components Sourced:** Full skeletal structures (Neurocranium, Facial bones, Vertebral column/spine, Ribcage, Pelvic girdle, Upper and Lower limb long bones) and superficial muscle boundaries.

3. **Curated WebGL Integration Library (`code4fukui/human_organs` & `hpfrei/body-anatomy-3d-viewer`)**
   - **License:** MIT License
   - **Role:** WebGL-ready packaging and normalization scripts for browser rendering.

---

## 2. Technical Characteristics & File Formats

| Asset Component | Source Format | Target Runtime Format | Approx. Size | Draco Compressed |
| :--- | :--- | :--- | :--- | :--- |
| **Skeletal Framework & Body Shell** | `.glb` | `.glb` | ~8.2 MB | Yes (DRACO) |
| **Heart (`organ_heart`)** | `.glb` | `.glb` | ~4.0 MB | No (Standard glTF 2.0) |
| **Liver (`organ_liver`)** | `.glb` | `.glb` | ~1.1 MB | No (Standard glTF 2.0) |
| **Kidneys (`organ_kidneys`)** | `.glb` | `.glb` | ~1.5 MB | No (Standard glTF 2.0) |
| **Brain (`organ_brain`)** | `.glb` | `.glb` | ~5.3 MB | No (Standard glTF 2.0) |
| **Stomach (`organ_stomach`)** | `.glb` | `.glb` | ~4.2 MB | No (Standard glTF 2.0) |
| **Pancreas (`organ_pancreas`)** | `.glb` | `.glb` | ~2.1 MB | No (Standard glTF 2.0) |
| **Bladder (`organ_bladder`)** | `.glb` | `.glb` | ~0.76 MB | No (Standard glTF 2.0) |
| **Spleen (`organ_spleen`)** | `.glb` | `.glb` | ~0.28 MB | No (Standard glTF 2.0) |

---

## 3. Semantic Object Hierarchy & Identifiers

In strict conformance with Section 7 of the 3D Anatomical Dashboard requirements, every interactive component is assigned a standardized semantic identifier:

```
HumanAnatomy (Scene / Group)
 ├── body_translucent_shell        (Ghosted translucent outer human shell)
 │
 ├── SKELETAL SYSTEM
 │    ├── bone_skull               (Neurocranium & viscerocranium)
 │    ├── bone_spine               (Cervical, thoracic, lumbar vertebrae)
 │    ├── bone_ribcage             (True ribs, false ribs, sternum)
 │    ├── bone_pelvis              (Ilium, ischium, pubis, sacrum)
 │    ├── bone_upper_limbs         (Clavicle, scapula, humerus, radius, ulna)
 │    └── bone_lower_limbs         (Femur, patella, tibia, fibula)
 │
 ├── INTERNAL ORGANS
 │    ├── organ_brain              (Cerebrum, cerebellum, brainstem)
 │    ├── organ_heart              (Myocardium, atria, ventricles)
 │    ├── organ_lung_left          (Left lung lobes)
 │    ├── organ_lung_right         (Right lung lobes)
 │    ├── organ_liver              (Hepatic parenchyma & lobes)
 │    ├── organ_stomach            (Gastric body, fundus, antrum)
 │    ├── organ_pancreas           (Pancreatic head, body, tail)
 │    ├── organ_kidney_left        (Left renal cortex & medulla)
 │    ├── organ_kidney_right       (Right renal cortex & medulla)
 │    ├── organ_spleen             (Splenic parenchyma)
 │    ├── organ_intestines         (Duodenum, jejunum, ileum, colon)
 │    └── organ_bladder            (Urinary bladder)
 │
 └── MUSCULOSKELETAL LAYERS
      ├── muscle_upper_body        (Pectoralis, deltoids, trapezius, latissimus)
      └── muscle_lower_body        (Quadriceps, hamstrings, gluteus, gastrocnemius)
```

---

## 4. Visual Quality & Shader Materials

### Translucent Outer Body
- Material: `MeshPhysicalMaterial` or `MeshStandardMaterial`
- Color: Soft medical teal/slate (`#7dd3fc` / `#38bdf8`)
- Roughness: `0.15`
- Transmission / Opacity: `0.18 – 0.28` (ghosted silhouette)
- Depth write: `false` (to prevent occlusion artifacts with interior organs)
- Blending: `NormalBlending`

### Anatomical Organs
- Material: PBR `MeshStandardMaterial` with anatomical tone mapping
- Opacity: `0.92 – 1.0` (clearly visible through outer translucent shell)
- Emissive baseline: `0.0` (unselected)
- Dynamic highlight: `Emissive` pulse/glow upon hover (`0.35`) and selection (`0.75`)

---

## 5. Performance Optimizations Performed

1. **Draco WebAssembly Decoding:** Decoders hosted locally in `frontend/public/draco/` for offline decompression.
2. **Buffer Sharing:** Static geometries share vertex buffers to minimize draw calls and GPU memory overhead.
3. **Selective Render Loop:** Frame updates run on request / interaction rather than unnecessary 120 FPS continuous battery drains when the scene is static.
4. **Local Bundling:** All model assets reside in `frontend/public/models/`, completely eliminating external CDN latency and remote failures.

---

## 6. Known Limitations

- **Mobile GPU Bandwidth:** On very low-end mobile devices (< 2GB RAM), rendering thousands of draw calls simultaneously can reduce frame rates. A graceful 2D medical anatomical fallback is automatically provided if WebGL context creation fails or WebGL is disabled.
- **Microscopic Vasculature:** Capillaries and minor peripheral nerves are omitted to maintain 60 FPS performance and keep file size under web thresholds.
