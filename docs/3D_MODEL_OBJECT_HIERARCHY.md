# HealthGuardian AI — 3D Model Object Hierarchy & Semantic Node Map

**Document Version:** 1.0.0  
**Date:** September 27, 2026  
**Status:** PRODUCTION ASSET SPECIFICATION  
**Scope:** Three.js / React Three Fiber Raycasting, Selection, and Visibility Architecture  

---

## 1. Overview

This document specifies the exact semantic object hierarchy, node identifiers, anatomical functions, selectability flags, and visibility layer assignments for all three production GLB models located in `d:\healthguardian-ai\3d-output\`:

1. `3d-output/organs/healthguardian-organs.glb`
2. `3d-output/skeleton/healthguardian-skeleton.glb`
3. `3d-output/combined/healthguardian-organs-skeleton.glb`

By structuring each model with explicit, semantic naming (e.g., `organ_heart`, `bone_skull`, `bone_ribcage`), the HealthGuardian 3D interaction layer can perform direct raycasting and deterministic mapping to clinical biomarkers and risk categories without relying on generic or arbitrary identifiers (e.g., `Mesh_001`).

---

## 2. Asset 1: Organs Only (`healthguardian-organs.glb`)

| Object / Group Name | Anatomical Meaning | Parent Collection | Selectable? | Visibility Layer | HealthGuardian Health Mapping |
|:---|:---|:---|:---:|:---:|:---|
| `organ_brain` | Cerebrum, Cerebellum, Brainstem | `organs_neuro` | **YES** | Layer 1 (Organs) | Sleep, stress, cognitive fatigue, neurological check-in |
| `organ_lungs` | Right (3 lobes) & Left (2 lobes) Lungs, Tracheobronchial tree | `organs_respiratory` | **YES** | Layer 1 (Organs) | Respiratory rate, SpO2, shortness of breath, asthma indicators |
| `organ_heart` | Left/right atria, ventricles, coronary sulci, valves | `organs_cardio` | **YES** | Layer 1 (Organs) | Resting heart rate, HRV, blood pressure, cardio risk |
| `organ_liver` | Right, left, caudate, and quadrate hepatic lobes | `organs_digestive` | **YES** | Layer 1 (Organs) | Hepatic enzymes (ALT/AST), metabolic health, alcohol consumption |
| `organ_stomach` | Fundus, body, antrum, pylorus | `organs_digestive` | **YES** | Layer 1 (Organs) | GI symptoms, nutrition, hydration, indigestion |
| `organ_pancreas` | Head, uncinate process, body, and tail of pancreas | `organs_endocrine` | **YES** | Layer 1 (Organs) | Fasting glucose, HbA1c, metabolic syndrome |
| `organ_spleen` | Gastric, diaphragmatic, and colic splenic surfaces | `organs_immune` | **YES** | Layer 1 (Organs) | Immune response, systemic inflammation, hematology |
| `organ_left_kidney` | Left renal cortex, medulla, hilum | `organs_renal` | **YES** | Layer 1 (Organs) | Hydration status, eGFR, creatinine, renal filtration |
| `organ_right_kidney` | Right renal cortex, medulla, hilum | `organs_renal` | **YES** | Layer 1 (Organs) | Hydration status, eGFR, creatinine, renal filtration |
| `organ_bladder` | Fundus, body, and neck of urinary bladder | `organs_renal` | **YES** | Layer 1 (Organs) | Hydration compliance, urinary symptoms |

---

## 3. Asset 2: Skeleton Only (`healthguardian-skeleton.glb`)

| Object / Group Name | Anatomical Meaning | Parent Collection | Selectable? | Visibility Layer | HealthGuardian Health Mapping |
|:---|:---|:---|:---:|:---:|:---|
| `bone_skull` | Cranium (Frontal, Parietal, Temporal, Occipital, Mandible, Facial bones) | `skeleton_axial` | **YES** | Layer 2 (Skeleton) | Head injury, TMJ, headaches, cranial posture |
| `bone_cervical_spine` | C1 (Atlas) through C7 vertebrae | `skeleton_axial` | **YES** | Layer 2 (Skeleton) | Neck strain, screen time ergonomics, cervical posture |
| `bone_spine` | Thoracic (T1–T12), Lumbar (L1–L5), Sacrum, Coccyx | `skeleton_axial` | **YES** | Layer 2 (Skeleton) | Lower back pain, sitting duration, spinal mobility |
| `bone_ribcage` | True, false, and floating ribs (1–12 bilateral), costal cartilages | `skeleton_axial` | **YES** | Layer 2 (Skeleton) | Chest wall expansion, respiratory mechanics |
| `bone_sternum` | Manubrium, sternal body, xiphoid process | `skeleton_axial` | **YES** | Layer 2 (Skeleton) | Anterior chest trauma, costochondritis |
| `bone_clavicles` | Left and right clavicles | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Shoulder girdle symmetry, clavicular mobility |
| `bone_scapulae` | Left and right scapulae | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Upper back posture, shoulder blade mobility |
| `bone_pelvis` | Ilium, ischium, pubis, sacroiliac joints | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Pelvic alignment, core stability, gait symmetry |
| `bone_left_humerus` | Left arm (humerus) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Upper limb strength, exercise tracking |
| `bone_right_humerus` | Right arm (humerus) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Upper limb strength, exercise tracking |
| `bone_left_forearm` | Left radius and ulna | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Repetitive strain, wrist ergonomics |
| `bone_right_forearm` | Right radius and ulna | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Repetitive strain, mouse ergonomics |
| `bone_left_hand` | Left carpals, metacarpals, phalanges | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Fine motor tracking, arthritis markers |
| `bone_right_hand` | Right carpals, metacarpals, phalanges | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Fine motor tracking, keyboard strain |
| `bone_left_femur` | Left thigh bone (femur) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Lower body exertion, bone density |
| `bone_right_femur` | Right thigh bone (femur) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Lower body exertion, bone density |
| `bone_left_patella` | Left kneecap (patella) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Knee joint health, runner's knee, mobility |
| `bone_right_patella` | Right kneecap (patella) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Knee joint health, mobility markers |
| `bone_left_tibia_fibula` | Left shin bones (tibia and fibula) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Step count stress, shin splints |
| `bone_right_tibia_fibula` | Right shin bones (tibia and fibula) | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Step count stress, gait asymmetry |
| `bone_left_foot` | Left tarsals, metatarsals, phalanges, calcaneus | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Plantar pressure, daily step impact |
| `bone_right_foot` | Right tarsals, metatarsals, phalanges, calcaneus | `skeleton_appendicular` | **YES** | Layer 2 (Skeleton) | Plantar pressure, daily step impact |
| `skeleton_ligaments_cartilage` | Intervertebral discs, articular capsules, bursae, tendon sheaths | `skeleton_soft_tissue` | NO (Passive) | Layer 2 (Skeleton) | Joint flexibility, disc compression |

---

## 4. Asset 3: Combined Model (`healthguardian-organs-skeleton.glb`)

In the combined production asset, all 33 semantic root groups are preserved in a unified coordinate frame:

| Root Node Index | Root Object Identifier | Anatomical System | Direct Selection Target | Toggle Visibility Layer |
|:---:|:---|:---|:---:|:---:|
| 0 | `bone_skull` | Skeletal (Cranial) | **YES** | Skeleton Layer |
| 1 | `bone_cervical_spine` | Skeletal (Cervical) | **YES** | Skeleton Layer |
| 2 | `bone_spine` | Skeletal (Thoracolumbar) | **YES** | Skeleton Layer |
| 3 | `bone_ribcage` | Skeletal (Thoracic cage) | **YES** | Skeleton Layer |
| 4 | `bone_sternum` | Skeletal (Anterior thorax) | **YES** | Skeleton Layer |
| 5 | `bone_clavicles` | Skeletal (Shoulder girdle) | **YES** | Skeleton Layer |
| 6 | `bone_scapulae` | Skeletal (Shoulder girdle) | **YES** | Skeleton Layer |
| 7 | `bone_pelvis` | Skeletal (Pelvic girdle) | **YES** | Skeleton Layer |
| 8 | `bone_left_humerus` | Skeletal (Upper limb) | **YES** | Skeleton Layer |
| 9 | `bone_right_humerus` | Skeletal (Upper limb) | **YES** | Skeleton Layer |
| 10 | `bone_left_forearm` | Skeletal (Forearm) | **YES** | Skeleton Layer |
| 11 | `bone_right_forearm` | Skeletal (Forearm) | **YES** | Skeleton Layer |
| 12 | `bone_left_hand` | Skeletal (Hand/Wrist) | **YES** | Skeleton Layer |
| 13 | `bone_right_hand` | Skeletal (Hand/Wrist) | **YES** | Skeleton Layer |
| 14 | `bone_left_femur` | Skeletal (Lower limb) | **YES** | Skeleton Layer |
| 15 | `bone_right_femur` | Skeletal (Lower limb) | **YES** | Skeleton Layer |
| 16 | `bone_left_patella` | Skeletal (Knee joint) | **YES** | Skeleton Layer |
| 17 | `bone_right_patella` | Skeletal (Knee joint) | **YES** | Skeleton Layer |
| 18 | `bone_left_tibia_fibula` | Skeletal (Lower leg) | **YES** | Skeleton Layer |
| 19 | `bone_right_tibia_fibula` | Skeletal (Lower leg) | **YES** | Skeleton Layer |
| 20 | `bone_left_foot` | Skeletal (Foot/Ankle) | **YES** | Skeleton Layer |
| 21 | `bone_right_foot` | Skeletal (Foot/Ankle) | **YES** | Skeleton Layer |
| 22 | `skeleton_ligaments_cartilage` | Articular & connective tissue | NO (Passive) | Skeleton Layer |
| 23 | `organ_brain` | Nervous / Central | **YES** | Organs Layer |
| 24 | `organ_heart` | Circulatory / Cardiovascular | **YES** | Organs Layer |
| 25 | `organ_lungs` | Respiratory / Pulmonary | **YES** | Organs Layer |
| 26 | `organ_liver` | Digestive / Hepatic | **YES** | Organs Layer |
| 27 | `organ_stomach` | Digestive / Gastric | **YES** | Organs Layer |
| 28 | `organ_pancreas` | Endocrine / Exocrine | **YES** | Organs Layer |
| 29 | `organ_spleen` | Lymphatic / Immune | **YES** | Organs Layer |
| 30 | `organ_left_kidney` | Urinary / Renal | **YES** | Organs Layer |
| 31 | `organ_right_kidney` | Urinary / Renal | **YES** | Organs Layer |
| 32 | `organ_bladder` | Urinary / Excretory | **YES** | Organs Layer |

---

## 5. Three.js / React Three Fiber Integration Protocol

When the Dashboard integration phase begins, Three.js interaction handlers can query and control these nodes with zero string ambiguity:

```javascript
// Example: Selecting an organ or bone via raycasting
function onPointerDown(event) {
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    let current = intersects[0].object;
    // Ascend to top-level semantic parent
    while (current.parent && !current.name.startsWith('organ_') && !current.name.startsWith('bone_')) {
      current = current.parent;
    }
    const anatomicalId = current.name;
    console.log('Selected anatomical entity:', anatomicalId);
    // highlight selected entity
    highlightEntity(anatomicalId);
  }
}

// Example: Independent layer opacity toggle
function setLayerVisibility(layer, visible, opacity = 1.0) {
  scene.traverse((node) => {
    if (layer === 'skeleton' && node.name.startsWith('bone_')) {
      node.visible = visible;
      if (node.material) node.material.opacity = opacity;
    }
    if (layer === 'organs' && node.name.startsWith('organ_')) {
      node.visible = visible;
      if (node.material) node.material.opacity = opacity;
    }
  });
}
```
