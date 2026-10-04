# Phase D Validation: Combined Asset 3

**Status:** PASS  
**Validation date:** October 3, 2026  
**Scope:** Combined Asset 3 browser validation only. Production Dashboard, backend, Firebase/Firestore, and HealthGuardian health logic were not modified.

## Asset and Viewer

- Asset 3: `3d-output/combined/healthguardian-organs-skeleton-clean-batched.glb`
- Source Asset 1: `3d-output/task2-organs/healthguardian-organs-task2.glb`
- Source Asset 2: `3d-output/skeleton/healthguardian-skeleton-clean-batched.glb`
- Viewer: isolated `3d-validation-viewer`
- Viewer-only staged copy: `3d-validation-viewer/public/models/healthguardian-organs-skeleton-clean-batched.glb`

## Load Validation

| Measure | Result |
|:---|:---|
| Successful load | PASS |
| Page/console errors | None observed |
| Semantic roots | 36/36 |
| Child geometries | 52 |
| Triangles | 657,930 |
| Materials | 22 organ materials plus `Mat_Bone_Pro` |
| File size | 11,942,248 bytes |
| Runtime transforms | Identity for all child geometries |
| Invalid metrics | No NaN or Infinity values |

The actual rendered viewer reported 657,930 triangles and 52 meshes. Structural validation independently confirmed 10 organ roots, 26 bone roots, 26 organ child meshes, 26 bone child meshes, and no geometry outside those layers.

## Required Views

All required views rendered successfully and were captured:

- `docs/3D model images/task4-combined-front.png`
- `docs/3D model images/task4-combined-back.png`
- `docs/3D model images/task4-combined-left.png`
- `docs/3D model images/task4-combined-right.png`
- `docs/3D model images/task4-combined-top.png`
- `docs/3D model images/task4-combined-bottom.png`
- `docs/3D model images/task4-combined-front-left.png`
- `docs/3D model images/task4-combined-front-right.png`
- `docs/3D model images/task4-combined-back-left.png`
- `docs/3D model images/task4-combined-back-right.png`

Close-up evidence:

- `docs/3D model images/task4-combined-close-brain.png`
- `docs/3D model images/task4-combined-close-heart.png`
- `docs/3D model images/task4-combined-close-lungs.png`
- `docs/3D model images/task4-combined-close-liver.png`
- `docs/3D model images/task4-combined-close-stomach.png`
- `docs/3D model images/task4-combined-close-pancreas.png`
- `docs/3D model images/task4-combined-close-spleen.png`
- `docs/3D model images/task4-combined-close-left-kidney.png`
- `docs/3D model images/task4-combined-close-right-kidney.png`
- `docs/3D model images/task4-combined-close-bladder.png`

## Rendered Anatomical Fidelity

Visual inspection of the rendered combined model found:

- Brain seated within the skull region; no soft-tissue shell or brain geometry protrusion was observed in normal or close-up inspection.
- Heart positioned between the lungs, with the apex toward the anatomical left.
- Lungs flank the heart; sternum and ribs are anterior/surrounding thoracic structures.
- Liver occupies the anatomical right upper abdomen.
- Stomach and spleen occupy the anatomical left region, with spleen posterior/lateral to the stomach.
- Pancreas sits deep/posterior to the stomach region.
- Kidneys are posterior near the spine, with the right kidney lower than the left.
- Bladder is contained within the pelvic region.
- Skeleton surrounds the organ layer without returning muscle, fascia, skin, shell, vessel, nerve, or decorative geometry.

## Occlusion and Layer Tests

| Test | Result |
|:---|:---:|
| Both layers visible | PASS; all 10 organ and 26 bone roots visible |
| Organs ON / Skeleton OFF | PASS; 10 organ roots visible, no bones |
| Skeleton ON / Organs OFF | PASS; 26 bone roots visible, no organs |
| Both layers OFF | PASS; no anatomy visible |
| Restore both layers | PASS |
| Front/back/3/4 organ inspection | PASS; no soft-tissue occlusion |
| Brain/skull overlap | Documented priority; skull is nearest hit when both layers are enabled |

No muscle/fascia/skin layer blocks the organs. Bone structures are intentionally rendered in front where their surfaces occupy the nearest depth. In this viewer, organ-only mode is the supported interaction priority for selecting underlying organs such as the brain; the brain becomes reachable and selectable when the skeleton layer is disabled.

## Raycasting and Semantic Resolution

- 36/36 top-level semantic roots passed actual Three.js raycast audits.
- 52/52 child meshes resolved to the correct top-level root when audited within their isolated semantic root.
- Representative organs passed: brain, heart, lungs, liver, stomach, pancreas, spleen, both kidneys, bladder.
- Representative bones passed: skull, ribcage, sternum, spine, pelvis, both femora, both humeri.
- Layer-interference audit confirmed target reachability for all tested structures except `organ_brain` in both-layer nearest-depth mode, where `bone_skull` is the expected nearest hit.
- No screen-coordinate assumptions were used for the root and child raycast audits.

## Isolation

All 36 roots were selected and isolated individually. Every case showed exactly one semantic root visible and no unrelated organ or bone roots. Restore-all returned the complete combined model.

Representative checks:

- `organ_heart`: isolated organ only, PASS
- `bone_ribcage`: isolated bone group only, PASS
- Full 36-root sweep: 36/36 PASS

## Interaction

- Hover: PASS on rendered combined geometry
- Click: PASS; front view click selected `bone_sternum`
- Root selection: PASS for all 36 roots
- Drag orbit: PASS
- Wheel zoom: PASS
- Reset: PASS
- Touch tap: PASS; headed GPU-backed context selected `bone_skull`
- Touch gesture: PASS; no pointer-capture/page errors
- Selection state remained valid through orbit, zoom, reset, layer changes, and isolation

## Performance

Measured independently against Asset 3 in headed Chromium with GPU acceleration enabled, `hasTouch: true`, `isMobile: true`, viewport `390 x 844`, and DPR `1.0`.

- WebGL renderer: `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001506) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- WebGL vendor: `Google Inc. (AMD)`
- Hardware acceleration: YES
- File size: 11,942,248 bytes
- Triangles: 657,930
- Meshes: 52
- Draw calls: 54
- Load time: 496 ms
- Parse/decode time: 320 ms
- Desktop-style orbit FPS: 61
- Real touch FPS: 60
- DPR: 1.0
- Touch tap selection: `bone_skull`, PASS
- Page errors: none
- Invalid metrics: none

The isolated viewer’s non-GPU browser page showed lower transient FPS during diagnostic raycast sweeps; the required final performance measurement uses the headed AMD GPU-backed context above.

## Known Limitation

With both layers enabled, the viewer uses nearest-depth raycast priority. In overlap areas, the skull can win over the brain and ribs/sternum can win over deeper organ surfaces. This is documented interaction priority, not returned contamination. The viewer layer controls provide organ-only and skeleton-only modes for unambiguous selection.

## Phase D Gate

**PASS.** Asset 3 is visually coherent, free of returned soft-tissue contamination, semantically selectable, isolatable, viewable from all required angles, and passes headed GPU-backed desktop/mobile performance and touch validation. Production Dashboard integration has not started.
