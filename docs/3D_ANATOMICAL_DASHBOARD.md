# Interactive 3D Anatomical Dashboard — Architecture & Clinical Safety Guide

## 1. Executive Summary

HealthGuardian AI features a medical-grade, interactive 3D Anatomical Human Body as the **dominant visual centerpiece** of the user dashboard (`/app/dashboard`). Replacing small cards and numerical abstraction with an immersive spatial health map, the human body visually occupies the main content area, allowing users to intuitively explore how their logged lifestyle habits, daily vitals, and verified laboratory reports map directly to their physiological systems.

### Core Architecture & Non-Regression Commitments
- **Zero New APIs & Zero New API Keys:** 100% client-side WebGL rendering using local static assets in `/public/models/` and `/public/draco/`.
- **Zero Database Schema Changes:** Operates directly on canonical Firestore data models (`Checkin`, `MedicalResult`, `RiskPattern`, `ScoreBreakdown`).
- **Zero Health Calculation Alterations:** Consumes existing deterministic scoring and pattern-detection algorithms.
- **Strict Non-Diagnostic Safety:** Uses calibrated indicator states (`NO_DATA`, `STABLE`, `ATTENTION`, `REVIEW_REQUIRED`). Never infers disease, diagnoses conditions, or prescribes treatments.

---

## 2. Anatomical 3D Asset Sourcing & Licensing

The 3D anatomical geometry utilized in HealthGuardian AI is derived from validated biomedical and anatomical reference repositories, each governed by its respective documented license (including Creative Commons CC BY 4.0, CC BY 3.0, CC BY-SA 4.0, CC0 Public Domain, and MIT, as detailed per component in the catalog below and in `docs/ANATOMICAL_3D_ASSET.md`).

### Approved Production Asset

In production, the interactive dashboard loads a single, optimized, clean-batched combined glTF model:
- **Runtime Asset Path:** `/models/healthguardian-organs-skeleton-clean-batched.glb`
- **File Size:** 11,942,248 bytes
- **SHA-256 Checksum:** `B2784065E0ADB40CB6FDB47D44033DC53824FE267908695A1DBCADF187F68140`
- **Structural Composition:** 52 child meshes/geometries, 36 semantic roots, 657,930 triangles (588,922 organ + 69,008 bone), 23 materials.

### Source Geometry Reference Catalog

The combined production asset was synthesized from the following open-access source components:

| Component | Sourced From | Project / Origin | License | Pipeline/Source Path | Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Realistic Human Body Shell** | Open BioAtlas / CC0 Human Body Library | High-precision human outer body silhouette (24,461 vertices) | CC0 (Public Domain) | `/public/models/human-body-shell.glb` | 882 KB |
| **Human Skeletal System** | Z-Anatomy Open-Source Project | Complete axial & appendicular skeleton (1,872 nodes, 826 meshes) | CC-BY-SA 4.0 / CC0 | `/public/models/body-anatomy-raw.glb` | 8.25 MB |
| **Heart** | NIH 3D Print Exchange | Visible Human Project (VH_M_Heart) | Creative Commons Attribution (CC-BY) | `/public/models/organs/heart.glb` | 4.07 MB |
| **Lungs & Bronchial Tree** | HuBMAP Human Reference Atlas (HRA) | NIH CCF 3D Reference Library (VH_M_Lung) | Creative Commons Attribution (CC-BY 4.0) | `/public/models/organs/lungs.glb` | 7.15 MB |
| **Liver** | NIH 3D Print Exchange | Visible Human Project (VH_M_Liver) | Creative Commons Attribution (CC-BY) | `/public/models/organs/liver.glb` | 1.14 MB |
| **Kidneys (Left & Right)** | NIH / HuBMAP Reference Object Library | Visible Human Project (VH_M_Kidney_L & VH_M_Kidney_R) | Creative Commons Attribution (CC-BY 4.0) | `/public/models/organs/kidney_l.glb`, `kidney_r.glb` | 1.54 MB each |
| **Pancreas** | NIH 3D Print Exchange | Visible Human Project (3D_VH_M_Pancreas) | Creative Commons Attribution (CC-BY) | `/public/models/organs/pancreas.glb` | 2.11 MB |
| **Stomach** | NIH 3D Print Exchange | Anatomical Stomach Geometry | Creative Commons Attribution (CC-BY) | `/public/models/organs/stomach.glb` | 4.20 MB |
| **Bladder** | NIH 3D Print Exchange | Visible Human Project (VH_F_Urinary_Bladder) | Creative Commons Attribution (CC-BY) | `/public/models/organs/bladder.glb` | 0.76 MB |
| **Brain** | NIH 3D Print Exchange | Neuroimaging Cortical Geometry | Creative Commons Attribution (CC-BY) | `/public/models/organs/brain.glb` | 5.37 MB |

*Full license records, download URLs, and attribution texts are cataloged in [`docs/ANATOMICAL_3D_ASSET.md`](file:///d:/healthguardian-ai/docs/ANATOMICAL_3D_ASSET.md).*

---

## 3. Visual Redesign: Dominant Body & Dynamic Context

### Problem-to-Solution Mapping

| Previous Issue | Redesigned Implementation |
| :--- | :--- |
| **Body too small in a 460px card** | Full-width hero viewport (`min-h-[640px] sm:min-h-[720px] lg:min-h-[780px]`). Camera distance optimized (`Z = 1.75`, `fov = 38°`) so the human body fills ~85% of the visible vertical space. |
| **Permanent empty side panel** | Removed the permanent 4-column side card. When no organ is selected, the 3D body enjoys 100% unobstructed canvas width with a subtle floating guidance pill at the bottom. |
| **Contextual drawer when selected** | When an organ is selected, a sleek floating frosted glass panel (`bg-card/90 backdrop-blur-xl border-border/70 shadow-2xl`) slides in anchored on the right (desktop) or as a bottom sheet (mobile) without resizing or shifting the 3D body. |
| **Capsule shell primitive placeholder** | Production Asset 3 does not include a body-shell geometry. The `human-body-shell.glb` remains a reference/pipeline artifact only and is not loaded by the production Dashboard. |
| **Heavy toolbar row across the top** | Redesigned into a discreet secondary floating HUD pill in the top-left (camera presets, layer switches) and top-right (2D accessible fallback button), leaving the anatomy as the clear focus. |

---

## 4. Deterministic Evidence-Based Health Mapping

The mapping layer (`mapHealthDataToAnatomy`) bridges user health data to physical body meshes deterministically:

| Anatomical Region | Associated Health Data & Metrics | Stable Criteria | Attention Criteria | Review Required Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Heart / Cardiovascular** | Daily BP (systolic/diastolic), Resting HR, verified Lipid panel (Cholesterol, LDL, Triglycerides), BP patterns | Systolic < 120 and Diastolic < 80, HR 60-100 bpm | Systolic 120-139 or Diastolic 80-89, Elevated LDL | Systolic >= 140 or Diastolic >= 90, Rising BP pattern severity 2 |
| **Lungs / Respiratory** | Oxygen saturation (SpO2), respiratory rate, aerobic exercise minutes | SpO2 >= 96%, Exercise >= 30 min | SpO2 92-95%, Exercise < 15 min | SpO2 < 92% |
| **Brain / Nervous System** | Sleep hours, sleep consistency, subjective stress/energy, cognitive fatigue | Sleep 7-9 hours, consistent bedtime | Sleep 5-6 hours, mild sleep debt | Chronic sleep debt pattern, sleep < 5 hours |
| **Liver / Hepatic** | Verified Liver Function Tests (ALT, AST, Bilirubin, Alkaline Phosphatase) | All hepatic enzymes in laboratory reference range | Mild elevation in ALT/AST (flagged 'high') | Verified abnormal liver function test requiring clinical follow-up |
| **Kidneys / Renal** | Daily hydration (water glasses), verified eGFR, Creatinine, Blood Urea Nitrogen (BUN) | Hydration >= 8 glasses, normal creatinine/eGFR | Hydration 4-7 glasses | Flagged abnormal creatinine/eGFR, Severe dehydration pattern |
| **Pancreas / Glycemic** | Verified Fasting Blood Glucose, HbA1c, daily dietary sugar trends | Fasting Glucose 70-99 mg/dL, HbA1c < 5.7% | Fasting Glucose 100-125 mg/dL, HbA1c 5.7-6.4% | Fasting Glucose >= 126 mg/dL, HbA1c >= 6.5% |
| **Skeletal & Muscles** | Daily steps, active exercise minutes, reported musculoskeletal stiffness | Exercise >= 30 min, 8,000+ steps | Exercise 15-29 min, 4,000-7,999 steps | Prolonged sedentary inactivity (< 2,000 steps) |
| **Empty State** | User with 0 check-ins or unrecorded region | — | — | **NO_DATA** status ("No data yet recorded") |

---

## 5. Clinical Safety & Medical Guardrails

HealthGuardian strictly enforces non-diagnostic clinical safety standards:

1. **Cautious Status Semantics:**
   - `NO_DATA`: Neutral slate gray (#94A3B8). Displayed when no relevant logs or reports exist.
   - `STABLE`: Calibrated emerald teal (#10B981). Indicates recorded data falls within healthy physiological references.
   - `ATTENTION`: Warm amber (#F59E0B). Suggests minor lifestyle deviations or borderline readings.
   - `REVIEW_REQUIRED`: Clear coral/red (#EF4444). Indicates readings exceeding standard guidelines, prompting the user to discuss with their clinician.

2. **Transparent Data Attribution:** Every organ detail card clearly presents:
   - Specific recorded metric value and unit (e.g., `128/82 mmHg`, `7.5 hrs`, `94 mg/dL`).
   - Source of data (`Daily Check-in`, `Verified Medical Report`, or `Detected Pattern`).
   - Exact timestamp of recording.
   - Clinical reference benchmark range.

3. **No Automated Diagnostic Labeling:** The application never displays diagnostic labels like "Hypertension Stage 2", "Diabetic", or "Renal Failure".

---

## 6. Accessibility & 2D Fallback

- **Automated WebGL Detection:** If WebGL fails to initialize, the scene seamlessly swaps to `AnatomicalFallback2D` without crashing or throwing errors.
- **Manual 2D/3D Toggle:** Top-right accessibility button allows users on low-power mobile devices or who prefer a static view to toggle between 3D and 2D with one click.
- **Screen Reader Support:** Full ARIA landmarks (`role="region"`, `role="status"`, descriptive `aria-label` attributes) ensure complete accessibility compliance.

---

## 7. Trilingual Localization

Full parity is maintained across English, Tamil (`ta.json`), and Hindi (`hi.json`) for:
- Organ names (Heart, Lungs, Brain, Liver, Kidneys, Pancreas, Stomach, Bladder).
- Skeletal system components (Skull, Spine, Ribcage, Pelvis, Limbs).
- Status indicators and badges.
- Interaction cues ("Rotate • Zoom • Select an anatomical region for available health information").
- Secondary HUD controls and information panels.
