# Phase C Validation: Asset 3 Combined Anatomy

**Status:** PASS for structural creation and validation  
**Validation date:** October 3, 2026  
**Scope:** Phase C only. Browser combined interaction validation and Dashboard integration were not started.

## Approved Inputs

- Asset 1: `3d-output/task2-organs/healthguardian-organs-task2.glb`
- Asset 2: `3d-output/skeleton/healthguardian-skeleton-clean-batched.glb`
- Asset 3: `3d-output/combined/healthguardian-organs-skeleton-clean-batched.glb`

The source assets were used as versioned artifacts and were not overwritten or modified.

## Combination Method

`3d-output/build_task4_combined_anatomy.py` combines only the approved Asset 1 and approved batched Asset 2. Existing world transforms are required to be identity transforms and are baked without applying any new translation, rotation, or scale. Each child geometry is placed beneath its existing semantic root.

The exporter fails closed if it finds:

- a missing semantic root
- a geometry outside the approved organ or bone root sets
- a non-identity source transform
- a forbidden material
- a changed triangle total
- a flattened or incomplete output hierarchy

## Structural Results

| Measure | Result |
|:---|:---|
| Asset 3 file size | 11,942,248 bytes |
| Child geometries | 52 |
| Triangles | 657,930 |
| Expected triangle sum | 588,922 organ + 69,008 bone = 657,930 |
| Semantic roots | 36/36 |
| Organ child meshes | 26 under 10 `organ_*` roots |
| Bone child meshes | 26 under 26 `bone_*` roots |
| Geometry outside semantic layers | 0 |
| Non-identity output transforms | 0 |
| Bone materials | `Mat_Bone_Pro` only |
| Muscle material present | No |
| Bounds | X `[-0.3343, 0.3343]`, Y `[0.0089, 1.7056]`, Z `[-0.1532, 0.1369]` |

## Semantic Roots Preserved

### Organs

`organ_brain`, `organ_heart`, `organ_lungs`, `organ_liver`, `organ_stomach`, `organ_pancreas`, `organ_spleen`, `organ_left_kidney`, `organ_right_kidney`, `organ_bladder`

### Skeleton

`bone_skull`, `bone_cervical_spine`, `bone_spine`, `bone_ribcage`, `bone_sternum`, `bone_clavicles`, `bone_scapulae`, `bone_pelvis`, `bone_left_humerus`, `bone_right_humerus`, `bone_left_radius`, `bone_right_radius`, `bone_left_ulna`, `bone_right_ulna`, `bone_left_hand`, `bone_right_hand`, `bone_left_femur`, `bone_right_femur`, `bone_left_patella`, `bone_right_patella`, `bone_left_tibia`, `bone_right_tibia`, `bone_left_fibula`, `bone_right_fibula`, `bone_left_foot`, `bone_right_foot`

## Coordinate and Alignment Checks

- Both source assets use identity world transforms.
- Asset 3 output geometry also uses identity transforms beneath semantic roots.
- X center remains approximately 0 and paired Asset 2 laterality is unchanged.
- Y bounds retain the full standing skeleton and torso organs without a combination offset.
- Z bounds retain the established anterior/posterior orientation.
- Asset 1 and Asset 2 source SHA-256 values were captured before combination:
  - Asset 1: `d9bb0874ddcd01e27192387d95706537dcc1974a7623f667d45eca6ae3953c78`
  - Asset 2: `68cef83a8344cb0c6c5e4a1257855dbf57ca2f923eef2cd1efba5d7734055667`

## Contamination Check

The skeleton layer contains only `Mat_Bone_Pro`. No `Mat_Muscle_Pro` or other excluded soft-tissue material returned. No geometry is outside the organ or bone semantic layers. Browser visual occlusion and runtime contamination checks belong to Phase D and remain outstanding.

## Phase C Gate

**PASS.** Asset 3 was created from the approved inputs and structurally validated. Do not begin Dashboard integration. Phase D combined browser validation is required next.
