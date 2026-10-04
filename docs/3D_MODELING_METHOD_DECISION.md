# HealthGuardian AI — 3D Anatomical Modeling Method Decision

**Document Version:** 2.0.0 (Revised)  
**Date:** September 27, 2026  
**Scope:** Feasibility analysis, technical evaluation, and engineering architecture decision for HealthGuardian interactive 3D anatomy.  
**Policy Status:** STRICT FEASIBILITY PHASE. Application code and Dashboard integration remain completely untouched.  

---

## 1. Executive Summary

This document establishes the official engineering architecture and production methodology for creating the 3D anatomical models for HealthGuardian AI. 

The primary functional objective is to deliver real 3D geometry supporting:
1. Full 360° orbital rotation, panning, and deep zoom.
2. Independently selectable internal organs (`organ_heart`, `organ_lungs`, `organ_liver`, `organ_brain`, etc.).
3. Independently selectable skeletal structures (`bone_skull`, `bone_spine`, `bone_ribcage`, `bone_pelvis`, etc.).
4. Independent visibility and opacity control for organ and skeletal layers.
5. Addressable semantic node identifiers for deterministic Three.js raycasting linked to HealthGuardian risk metrics.
6. 100% local client-side execution with **zero external anatomy APIs, zero cloud rendering services, and zero runtime API keys**.

---

## 2. Verified Host Hardware Baseline

Host hardware was verified directly on the laptop via operating system and hardware management queries:

| Component | Verified Specification | Evaluation for Local 3D AI Generation |
|:---|:---|:---|
| **Processor (CPU)** | AMD Ryzen 5 7520U with Radeon Graphics (4 Cores, 8 Threads) | Modern low-power mobile APU |
| **Graphics (GPU)** | AMD Radeon(TM) Graphics (Integrated, Device ID `0x1506`) | Integrated graphics processor sharing system RAM |
| **Dedicated VRAM** | **512 MB** (`536,870,912 bytes`) | **Severe bottleneck** for deep generative 3D models |
| **NVIDIA CUDA** | **NONE** (`nvcc` and `nvidia-smi` not installed / not present) | Cannot execute CUDA C++ extensions or Torch CUDA |
| **GPU Driver** | AMD Adrenalin `32.0.21039.2003` | Non-CUDA runtime |
| **System Memory** | 16.0 GB Total RAM (~4.2 GB free physical memory) | Standard consumer memory pool |
| **Operating System** | Windows 11 Home Single Language (64-bit, 10.0.26200) | Windows host environment |

---

## 3. Technology Options Evaluation

### 3.1 Microsoft TRELLIS (`microsoft/TRELLIS`)
- **Repository:** `https://github.com/microsoft/TRELLIS`
- **Technical Pipeline:** Uses structured latent representations (SLAT) trained on synthetic 3D assets to decode radiance fields / Gaussian splats into textured meshes.
- **Hardware Requirements:** NVIDIA GPU (minimum 16 GB VRAM recommended; 8–12 GB minimum with offloading). Requires compiling native CUDA C++ submodules (`spconv`, `nvdiffrast`, `curope`, `diffoctreerast`, `flash-attn`).
- **Local Feasibility:** **NOT SUITABLE FOR LOCAL EXECUTION.** The laptop has an AMD APU with 512 MB dedicated VRAM and no CUDA capability.
- **Semantic Part Feasibility:** Generates a unified polygon mesh from a single visual input. It does not provide the explicit, segmented anatomical hierarchy required for independent organ selection.

### 3.2 Microsoft TRELLIS.2 (`microsoft/TRELLIS.2`)
- **Repository:** `https://github.com/microsoft/TRELLIS.2`
- **Model Scale:** 4-billion parameter 3D foundation transformer model.
- **Current Platform Support:** Official setup provides a primary CUDA pipeline and an experimental HIP/ROCm pathway for supported AMD workstation/datacenter GPUs.
- **Local Feasibility:** **NOT SUITABLE FOR LOCAL EXECUTION.** While TRELLIS.2 includes HIP/ROCm development paths on high-end AMD hardware (e.g., Radeon Pro / MI series), the host hardware is an entry-level mobile APU (Ryzen 5 7520U with integrated graphics and 512 MB dedicated VRAM). Attempting to run a 4B parameter diffusion model locally is completely impractical.
- **Semantic Part Feasibility:** Although TRELLIS.2 can represent complex, non-manifold, and internal enclosed geometry, it does not guarantee the independently addressable semantic anatomical hierarchy required by HealthGuardian.

### 3.3 Generic Image-to-3D Systems
- **Evaluation:** Image-to-3D systems vary in their reconstruction capabilities, but they do not inherently guarantee the explicit organ/bone semantic segmentation and stable object identifiers required for HealthGuardian. Because HealthGuardian requires discrete objects (`organ_heart`, `bone_ribcage`) for deterministic risk mapping, relying solely on image-to-3D generation leaves the critical semantic hierarchy unresolved.

### 3.4 Structured Anatomical Datasets (Z-Anatomy & BodyParts3D)
- **Source:** [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) and [DBCLS BodyParts3D](https://lifesciencedb.jp/bp3d/).
- **Anatomical Structure:** Built upon true volumetric anatomical scans. Meshes are organized by international anatomical nomenclature (Terminologia Anatomica).
- **Segmentation:** Provides separate, discrete geometry for each bone, muscle, and organ.
- **Limitations of Raw Import:** Raw Z-Anatomy imports contain over 4,000 separate mesh nodes and millions of polygons, including opaque superficial muscle and fascial sheets (`Mat_Muscle_Pro`). As established in our browser validation testing, leaving these uncurated causes visual occlusion (muscles completely blocking the view of the heart, lungs, and ribcage).

### 3.5 Visceral Organ Data (NLM Visible Human Project)
- **Source:** National Library of Medicine (NLM), National Institutes of Health (NIH).
- **Access & Licensing (Updated July 2019):** NLM no longer requires a formal signed license agreement. Data is accessible under NLM General Terms & Conditions. Commercial use, modification, and redistribution of derived 3D polygonal geometry are permitted with customary attribution and non-endorsement compliance (see [docs/3D_SOURCE_LICENSE_AUDIT.md](file:///d:/healthguardian-ai/docs/3D_SOURCE_LICENSE_AUDIT.md)).
- **Anatomical Fidelity:** Provides discrete, anatomically detailed visceral structures (heart chambers, pulmonary lobes, liver segments, kidneys, pancreas, spleen, bladder).

---

## 4. Comprehensive Comparison Matrix

| Technical Requirement | Microsoft TRELLIS | Microsoft TRELLIS.2 | Raw Structured Anatomy | Recommended Hybrid Pipeline |
|:---|:---:|:---:|:---:|:---:|
| **Runs on Local Laptop** | **NO** (Requires NVIDIA CUDA) | **NO** (4B model / 512MB VRAM) | **YES** (Standard 3D mesh files) | **YES** (Standard 3D mesh processing & WebGL) |
| **True 3D Geometry** | YES | YES | YES | **YES** |
| **360° Viewing** | Limited/Hallucinated on unseen sides | Capable of complex shapes | Full volumetric 360° | **Full volumetric 360°** |
| **Deep Internal Inspection** | Limited internal addressability | Can represent complex internals | Full internal modeling | **Full internal modeling** |
| **Separate Organs** | No guaranteed semantic separation | No guaranteed semantic separation | Fully separated | **10 discrete `organ_*` groups** |
| **Separate Bones** | No guaranteed semantic separation | No guaranteed semantic separation | Fully separated | **22 discrete `bone_*` groups** |
| **Semantic Node Identifiers** | Missing | Missing | Needs standardization | **Standardized 33 root groups** |
| **Blender Editing Support** | High retopology effort | High retopology effort | Native Blender project | **Native Blender / glTF workflow** |
| **Web GLB Optimization** | Single large mesh | Single large mesh | Extremely heavy (>100 MB uncurated) | **Optimized glTF 2.0 + Draco (< 12 MB)** |
| **Anatomical Structure** | AI synthetic approximation | AI synthetic approximation | Anatomically detailed reference data | **Anatomically detailed reference data** |
| **Visual Similarity to References** | Moderate | Moderate | Requires custom shading | **Calibrated to match reference art** |
| **License Compliance** | Research/Commercial ambiguity | Research/Commercial ambiguity | Complex component-level licenses | **Audited & Approved (CC BY-SA / NLM)** |
| **Local Runtime Cost** | $0 (Hardware blocked) | $0 (Hardware blocked) | $0 (Open Source) | **$0.00 (Zero API keys / Zero services)** |
| **Three.js Raycasting** | **FAIL** (Cannot isolate organs) | **FAIL** (Cannot isolate organs) | Requires node cleanup | **EXCELLENT** (Direct raycasting to roots) |

---

## 5. Role of Reference Images (`C:\Users\balaj\Downloads\3D model images`)

The six reference files (`ASSET1.png`, `ASSET 1 XYZ.png`, `ASSET2.png`, `ASSET2 XYZ.png`, `ASSET3.png`, `ASSET 3 XYZ.png`) represent **visual design targets**:
- They establish the visual presentation: clean studio lighting, warm bone tones, distinct visceral hues, translucent silhouette, and front-facing orientation.
- They establish the coordinate conventions: `+X` Right, `-X` Left, `+Y` Top, `-Y` Bottom, `+Z` Front, `-Z` Back.
- They are **not geometric CAD specifications** or medical ground truth. They serve as the visual quality benchmark against which our structured 3D assets are calibrated.

---

## 6. Engineering Decisions (GO / NO-GO)

- **LOCAL MICROSOFT TRELLIS:** **NO-GO**  
  *Justification:* Hardware incompatible (no NVIDIA GPU, 512 MB VRAM). Does not guarantee independently addressable semantic anatomical hierarchy.
- **LOCAL MICROSOFT TRELLIS.2:** **NO-GO**  
  *Justification:* Hardware incompatible for 4B parameter generation on integrated Radeon APU. Does not guarantee explicit semantic node hierarchy.
- **GENERIC IMAGE-TO-3D SERVICES:** **NO-GO**  
  *Justification:* Does not inherently guarantee explicit organ/bone semantic segmentation; introduces unnecessary external cloud dependencies.
- **RAW UNFILTERED Z-ANATOMY:** **NO-GO**  
  *Justification:* Uncurated raw import causes severe muscle occlusion and prohibitive draw call overhead.
- **HYBRID STRUCTURED PIPELINE:** **GO (RECOMMENDED)**  
  *Justification:* Sourcing structured anatomical datasets (BodyParts3D for bones, NLM Visible Human for viscera), stripping occluding muscle meshes, standardizing into 33 semantic root groups, and optimizing into browser-ready GLB assets directly satisfies all HealthGuardian requirements.

---

## 7. Recommended Production Workflow

```
[BodyParts3D Skeletal Data]         [NLM Visible Human Organ Data]
           │                                       │
           ▼                                       ▼
  Strip Occluding Muscle               Normalize Scale to 1.70m
  & Fascia Meshes                      & Position into Cavities
           │                                       │
           └───────────────────┬───────────────────┘
                               │
                               ▼
                 [Semantic Scene Graph Setup]
                 - 22 Bone Root Groups
                 - 10 Organ Root Groups
                 - 1 Connective Tissue Layer
                               │
                               ▼
                 [Visual Calibration in Blender]
                 - Coordinate Axes (+Z Front, +Y Top)
                 - Calibrated to Reference Image Lighting & Colors
                 - Brain Seated Inside Cranial Vault
                               │
                               ▼
                 [glTF 2.0 Web Optimization]
                 - Draco Geometry Compression
                 - Material Consolidation (< 12 MB total)
                               │
                               ▼
                 [Isolated Browser Validation]
                 - Three.js Orbit & Raycast Testing
```

---

## 8. Summary Table of Decisions

| Parameter | Decision | Status |
|:---|:---|:---:|
| **Primary Methodology** | Hybrid Structured Pipeline (Curated Anatomical Models + Reference Calibration) | **APPROVED** |
| **Local TRELLIS / TRELLIS.2** | Excluded due to hardware incompatibility and lack of semantic hierarchy | **REJECTED (NO-GO)** |
| **Cloud 3D Services** | Excluded to preserve 0 API key / 0 cost requirement | **REJECTED (NO-GO)** |
| **Component Licenses** | Fully audited (CC BY-SA 4.0, CC BY-SA 2.1 Japan, NLM Open Terms) | **AUDITED & COMPLIANT** |
| **Task 2 Status** | Asset generation remains locked awaiting user review | **LOCKED** |
