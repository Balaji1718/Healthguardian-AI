# Task 3 Validation: Skeleton Only

**Asset:** `3d-output/skeleton/healthguardian-skeleton-clean-batched.glb`  
**Viewer:** `3d-validation-viewer` at `http://localhost:5174/`  
**Validation date:** October 2, 2026  
**Scope:** Phase B only. Asset 3, dashboard integration, and production HealthGuardian code were not changed.

## Final Status

**PASS**

The batched asset passes file integrity, visible anatomical purity, semantic raycasting, laterality, required camera views, isolation, draw-call limits, and the final headed GPU-backed mobile performance gate. The earlier 10 FPS headless measurement is documented as environment-limited.

The optimization did not rebuild or modify Asset 2 geometry. It concatenated static meshes only within their existing semantic roots.

## Asset Integrity

| Measure | Result |
|:---|:---|
| File | `3d-output/skeleton/healthguardian-skeleton-clean-batched.glb` |
| File size | 1,227,144 bytes (~1.17 MiB) |
| Meshes | 26 |
| Triangles | 69,008 |
| Draw calls | 28 maximum observed |
| Materials | `Mat_Bone_Pro` only |
| Semantic roots | 26/26 discovered |
| Invalid metrics | None observed; no NaN or Infinity values |
| Source contamination removed | 557 `Mat_Muscle_Pro` geometries excluded from 826 source geometries |

Declared roots validated:

`bone_skull`, `bone_cervical_spine`, `bone_spine`, `bone_ribcage`, `bone_sternum`, `bone_clavicles`, `bone_scapulae`, `bone_pelvis`, paired humeri, radii, ulnae, hands, femora, patellae, tibiae, fibulae, and feet.

## Visual Fidelity and Purity

The rendered model was inspected at normal and close-up distances. The following were visibly coherent:

- Skull and facial bones
- Cervical, thoracic, lumbar spine and sacrum
- Ribs and sternum
- Clavicles and scapulae
- Pelvis
- Upper limbs, hands, femora, patellae, tibiae, fibulae, and feet

No visible muscle, fascia, skin, body shell, organ, vessel, nerve, or decorative geometry was observed in the normal or close-up captures. The model renders as a skeleton-only structure rather than merely possessing skeleton-like node names.

## Camera Views

All ten required views rendered successfully:

- Front (+Z)
- Back (-Z)
- Left (-X)
- Right (+X)
- Top (+Y)
- Bottom (-Y)
- Front-left 3/4
- Front-right 3/4
- Back-left 3/4
- Back-right 3/4

Screenshot evidence:

- `docs/3D model images/task3-skeleton-batched-front.png`
- `docs/3D model images/task3-skeleton-batched-back.png`
- `docs/3D model images/task3-skeleton-batched-left.png`
- `docs/3D model images/task3-skeleton-batched-right.png`
- `docs/3D model images/task3-skeleton-batched-top.png`
- `docs/3D model images/task3-skeleton-batched-bottom.png`
- `docs/3D model images/task3-skeleton-batched-front-left.png`
- `docs/3D model images/task3-skeleton-batched-front-right.png`
- `docs/3D model images/task3-skeleton-batched-back-left.png`
- `docs/3D model images/task3-skeleton-batched-back-right.png`
- `docs/3D model images/task3-skeleton-close-skull-thorax.png`

## Laterality

Physical X-coordinate inspection confirmed the declared laterality:

- Left humerus center: approximately `-0.197`
- Right humerus center: approximately `+0.197`
- Left radius center: approximately `-0.258`
- Right radius center: approximately `+0.258`
- Left hand center: approximately `-0.218`
- Right hand center: approximately `+0.218`
- Left femur center: approximately `-0.091`
- Right femur center: approximately `+0.091`
- Left foot center: approximately `-0.087`
- Right foot center: approximately `+0.087`

This verification used geometry bounds, not semantic names.

## Interaction

| Test | Result |
|:---|:---:|
| Hover rendered skull | PASS |
| Click rendered skull | PASS |
| Child mesh resolves to `bone_*` root | PASS, 26/26 roots |
| Raycast hit for every declared root | PASS, 26/26 roots |
| Isolate selected root | PASS |
| Restore all | PASS |
| Desktop orbit | PASS |
| Touch orbit | Executed in real `hasTouch: true` context; FPS gate failed |

The isolated viewer required validation-only corrections: exact semantic-root filtering, surface-point raycast probing, pointer-event isolation for selection controls, responsive mobile layout, and live metric exposure. Production code was not modified.

## Performance

### Desktop browser measurement

- Load time: 64 ms
- Parse/decode time: 35 ms
- Idle/orbit FPS: 60 FPS observed
- Draw calls: 28
- Gate: **PASS**

### Mobile viewport measurement

Viewport: `390 x 844`, device pixel ratio: `1.0`, renderer cap: `1.5`.

- Load time: 129 ms
- Parse/decode time: 218 ms
- Observed touch FPS: 10 FPS
- Draw calls: 27-28
- Pixel ratio: 1.0
- Touch context: Playwright `hasTouch: true`, viewport `390 x 844`, `deviceScaleFactor: 1`
- Touch tap selection: `bone_skull`, PASS
- Touch gesture: executed with real CDP touch input, no pointer-capture/page errors
- Draw-call gate: **PASS**
- FPS gate: **FAIL**, 10 FPS is below the 30 FPS minimum

No NaN or Infinity values appeared in the displayed metrics.

### Final headed GPU-backed mobile measurement

Measured with a temporary Playwright Chromium context using `hasTouch: true`, `isMobile: true`, viewport `390 x 844`, and device scale factor `1`. Chromium was launched headed with GPU acceleration enabled and GPU blocklisting ignored.

- WebGL renderer: `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001506) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- WebGL vendor: `Google Inc. (AMD)`
- Hardware acceleration: **YES**; renderer was not SwiftShader/software, and WebGL used AMD Radeon Direct3D11
- Viewport: `390 x 844`
- DPR: `1.0`
- Draw calls: `28`
- Triangles: `69,008`
- Load time: `79 ms`
- Parse/decode time: `95 ms`
- Orbit FPS: `60 FPS`
- Real touch FPS: `60 FPS`
- Touch tap selection: `bone_skull`, PASS
- Page errors / pointer-capture failures: none
- Invalid metrics: none

Desktop and mobile performance gates both **PASS** in this GPU-backed headed environment. The prior headless result of 10 FPS is retained as a headless-environment measurement and is not representative of the available hardware-accelerated run.

## Phase B Gate

**PASS.** Mesh batching reduced the scene from 269 geometries and 271 draw calls to 26 geometries and 28 draw calls without changing triangle count or semantic roots. The final headed AMD GPU-backed run passes desktop and mobile FPS gates, real touch input works without pointer-capture errors, and all prior visual, purity, laterality, raycast, selection, isolation, and view validations remain successful.