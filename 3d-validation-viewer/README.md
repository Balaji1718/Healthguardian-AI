# HealthGuardian AI — Isolated 3D Asset Validation Viewer

This application is completely isolated from the main HealthGuardian AI Dashboard. Its purpose is to load, inspect, test, and validate the three anatomical GLB assets:

- `public/models/healthguardian-organs.glb`
- `public/models/healthguardian-skeleton.glb`
- `public/models/healthguardian-organs-skeleton.glb`

## Features Tested
1. Model loading & GLB / glTF 2.0 parsing.
2. Draco decompression via web assembly workers.
3. 360° camera orbit, pan, zoom, and 12 distinct anatomical view presets.
4. Raycasting & dynamic parent traversal for semantic root identification (`organ_*`, `bone_*`).
5. Real-time hover detection and click persistence with emissive highlighting.
6. Independent layer visibility & opacity control for Organs vs. Skeleton.
7. Deep zoom inspection of individual anatomical targets (heart, brain, kidneys, etc.).
8. Live performance tracking (FPS, draw calls, load time, parse time, triangle count).
9. Failure simulation and diagnostics.
