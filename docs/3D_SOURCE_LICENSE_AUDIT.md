# HealthGuardian AI — 3D Anatomical Source License Audit

**Document Version:** 1.0.0  
**Date:** September 27, 2026  
**Status:** COMPLETED COMPONENT AUDIT  
**Scope:** Legal compliance, commercial rights, redistribution, and attribution requirements for all candidate 3D anatomical components.  

---

## 1. Executive Summary

This audit establishes the exact intellectual property provenance, licensing terms, commercial rights, and redistribution permissions for every anatomical mesh component evaluated or intended for the HealthGuardian AI 3D asset pipeline.

**Core Policy:**
1. Any asset carrying a Non-Commercial (`NC`) restriction (e.g., `CC BY-NC-SA`) is **strictly barred from inclusion** in the final production assets.
2. Only components with explicit commercial, modification, and redistribution rights under recognized open licenses (e.g., `CC BY-SA 4.0`, `CC BY-SA 2.1 Japan`, or `NLM Public Data Terms`) are permitted.
3. Proper dual attribution must be maintained in the project documentation and application legal notices.
4. The HealthGuardian AI application code (frontend, backend, logic, clinical algorithms) remains proprietary; the `CC BY-SA` ShareAlike requirement applies strictly to the derivative 3D anatomical model files (`.glb`) distributed with the application.

---

## 2. Component-by-Component License Matrix

| Component / Structure | Exact Source / Provenance | License | Commercial Use Permitted? | Modification Permitted? | Redistribution Permitted? | Attribution Required? | Share-Alike Required? | Additional Restrictions | Approved for Final Asset? |
|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|:---:|
| **Full Skeletal Framework** (Skull, spine, ribs, pelvis, limbs) | BodyParts3D (Database Center for Life Science - DBCLS, Japan) via Z-Anatomy | CC BY-SA 2.1 Japan | **YES** | **YES** | **YES** | **YES** | **YES** | Must cite DBCLS BodyParts3D; cannot imply endorsement. | **YES** |
| **Visceral Organs** (Heart, Lungs, Liver, Kidneys, Pancreas, Spleen, Bladder) | NIH National Library of Medicine (NLM) Visible Human Project (VH_M / VH_F) | NLM Terms & Conditions (Open Government Data) | **YES** | **YES** | **YES** | **YES** | **NO** | No formal license required (updated July 2019). Must cite NLM; no endorsement. | **YES** |
| **Brain Volumetric Model** | BodyParts3D / Z-Anatomy Neurocranium dataset | CC BY-SA 4.0 / CC BY-SA 2.1 Japan | **YES** | **YES** | **YES** | **YES** | **YES** | Dual attribution to Z-Anatomy and BodyParts3D. | **YES** |
| **Stomach Mesh (Alternative)** | Sketchfab public domain / CC-BY anatomical scan | CC BY 4.0 | **YES** | **YES** | **YES** | **YES** | **NO** | Must credit original scan author. If provenance unclear, fall back to BodyParts3D stomach. | **CONDITIONAL** (Use BodyParts3D stomach for unified provenance) |
| **Superficial Muscle & Fascia Meshes** | Z-Anatomy Musculoskeletal collection (`Mat_Muscle_Pro`) | CC BY-SA 4.0 | **YES** | **YES** | **YES** | **YES** | **YES** | Excluded for engineering/anatomical reasons (causes visual occlusion of organs). | **NO (EXCLUDED)** |
| **Third-Party Sketchfab Models with NC tags** | Various online 3D repositories (CC BY-NC 3.0/4.0) | CC BY-NC-SA | **NO** | YES | YES | YES | YES | **Commercial restriction violates HealthGuardian deployment.** | **REJECTED / BANNED** |

---

## 3. Detailed Audit of Primary Data Sources

### 3.1 BodyParts3D (DBCLS, Japan)
- **Institution:** Database Center for Life Science (DBCLS), Research Organization of Information and Systems (ROIS), Japan.
- **Access URL:** `https://lifesciencedb.jp/bp3d/`
- **License:** Creative Commons Attribution-ShareAlike 2.1 Japan (`CC BY-SA 2.1 JP`).
- **Commercial Deployment:** Fully permitted. Commercial entities are free to incorporate, modify, and redistribute derivative 3D meshes.
- **Mandatory Attribution String:**
  > "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan."

### 3.2 Z-Anatomy Project
- **Project Lead:** Benjamin Fourcroy / Z-Anatomy Community.
- **Repository:** `https://github.com/Z-Anatomy/Models-of-human-anatomy`
- **License:** Creative Commons Attribution-ShareAlike 4.0 International (`CC BY-SA 4.0`).
- **Scope:** The project standardizes, rigs, and aggregates anatomical meshes primarily from BodyParts3D into an organized Blender hierarchy with Terminologia Anatomica labeling.
- **Commercial Deployment:** Permitted under CC BY-SA 4.0 terms.
- **Mandatory Attribution String:**
  > "Z-Anatomy, The libre 3D atlas of human anatomy, licensed under Creative Commons Attribution-ShareAlike 4.0 International."

### 3.3 National Library of Medicine (NLM) Visible Human Project (VHP)
- **Institution:** U.S. National Library of Medicine, National Institutes of Health (NIH), Bethesda, MD.
- **Access URL:** `https://www.nlm.nih.gov/research/visible/`
- **Current Legal Status (Updated July 2019):**
  - The NLM **no longer requires a signed license agreement** to access, use, or redistribute VHP datasets.
  - Provided under open government terms as a public service for scientific, educational, and commercial applications.
  - **Commercial Use:** Permitted.
  - **Redistribution of Derived 3D Geometry:** Permitted.
  - **Attribution Expectation:** Customary academic/technical acknowledgment.
  - **Non-Endorsement Clause:** Use of data must not state or imply that the NLM or NIH endorses HealthGuardian AI.
- **Mandatory Attribution String:**
  > "Anatomical organ geometries derived from data provided by the National Library of Medicine's Visible Human Project."

---

## 4. Legal Isolation of Application Code

A critical concern with `CC BY-SA` (ShareAlike) is ensuring that the copyleft provision does not extend to the proprietary application logic of HealthGuardian AI:

1. **Separation of Assets:** The 3D models are static `.glb` data files located in the public assets directory (`/models/`). They are read-only assets loaded by standard WebGL loaders (Three.js).
2. **Compilation Boundary:** The 3D `.glb` assets are not compiled, bundled, or statically linked into the JavaScript/TypeScript application source code.
3. **Derivative Scope:** Under Section 3(b) of CC BY-SA 4.0, the ShareAlike obligation applies strictly to the **Adapted Material** (the modified 3D model files themselves). Distributing derivative `.glb` files under CC BY-SA satisfies all legal requirements without licensing the surrounding HealthGuardian software, databases, or AI models under CC BY-SA.

---

## 5. Compliance Checklist

- [x] All candidate sources audited for commercial usage rights.
- [x] No `NC` (Non-Commercial) licensed meshes included in the production asset plan.
- [x] NLM Visible Human Project terms verified against current 2019+ open terms.
- [x] BodyParts3D attribution string prepared.
- [x] Z-Anatomy attribution string prepared.
- [x] Legal boundary between proprietary application code and CC BY-SA asset confirmed.

---

## 6. Audit Conclusion

**LICENSE AUDIT STATUS: COMPLETE & APPROVED**

All approved components (BodyParts3D skeleton, NLM Visible Human viscera) permit commercial deployment, modification, and web redistribution. Attribution notices have been standardized for inclusion in the HealthGuardian documentation and legal notices.
