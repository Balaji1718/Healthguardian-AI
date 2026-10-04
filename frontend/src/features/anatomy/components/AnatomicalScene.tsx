import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type {
  AnatomicalRegionId,
  AnatomicalRegionState,
  CameraPreset,
  LayerVisibilityState,
} from "../types";
import { STATUS_COLORS } from "../config/anatomy-config";
import { LoadingOverlay } from "./LoadingOverlay";
import { AnatomyControls } from "./AnatomyControls";
import { AnatomicalFallback2D } from "./AnatomicalFallback2D";
import { BodyInformationPanel } from "./BodyInformationPanel";
import { useTranslation } from "@/locales/i18n";

interface AnatomicalSceneProps {
  regionStates: Record<AnatomicalRegionId, AnatomicalRegionState>;
  selectedRegion: AnatomicalRegionState | null;
  onSelectRegion: (region: AnatomicalRegionState | null) => void;
  className?: string;
}

const COMBINED_MODEL_PATH = "/models/healthguardian-organs-skeleton-clean-batched.glb";

const COMBINED_SEMANTIC_REGION_MAP: Record<string, AnatomicalRegionId> = {
  organ_brain: "organ_brain",
  organ_heart: "organ_heart",
  organ_lungs: "organ_lungs",
  organ_liver: "organ_liver",
  organ_stomach: "organ_stomach",
  organ_pancreas: "organ_pancreas",
  organ_spleen: "organ_spleen",
  organ_left_kidney: "organ_kidneys",
  organ_right_kidney: "organ_kidneys",
  organ_bladder: "organ_bladder",
  bone_skull: "bone_skull",
  bone_cervical_spine: "bone_spine",
  bone_spine: "bone_spine",
  bone_ribcage: "bone_ribcage",
  bone_sternum: "bone_ribcage",
  bone_clavicles: "bone_limbs",
  bone_scapulae: "bone_limbs",
  bone_pelvis: "bone_pelvis",
  bone_left_humerus: "bone_limbs",
  bone_right_humerus: "bone_limbs",
  bone_left_radius: "bone_limbs",
  bone_right_radius: "bone_limbs",
  bone_left_ulna: "bone_limbs",
  bone_right_ulna: "bone_limbs",
  bone_left_hand: "bone_limbs",
  bone_right_hand: "bone_limbs",
  bone_left_femur: "bone_limbs",
  bone_right_femur: "bone_limbs",
  bone_left_patella: "bone_limbs",
  bone_right_patella: "bone_limbs",
  bone_left_tibia: "bone_limbs",
  bone_right_tibia: "bone_limbs",
  bone_left_fibula: "bone_limbs",
  bone_right_fibula: "bone_limbs",
  bone_left_foot: "bone_limbs",
  bone_right_foot: "bone_limbs",
};

function findCombinedSemanticRoot(node: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = node;
  while (current) {
    if (COMBINED_SEMANTIC_REGION_MAP[current.name]) return current.name;
    current = current.parent;
  }
  return null;
}

function isObjectVisible(mesh: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = mesh;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function disposeLoadedModel(root: THREE.Object3D): void {
  const disposedMaterials = new Set<THREE.Material>();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

export function AnatomicalScene({
  regionStates,
  selectedRegion,
  onSelectRegion,
  className = "",
}: AnatomicalSceneProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);
  const [force2D, setForce2D] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<AnatomicalRegionState | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [underlyingSelection, setUnderlyingSelection] = useState<AnatomicalRegionState | null>(
    null,
  );
  const [activePreset, setActivePreset] = useState<CameraPreset>("front");

  const [layers, setLayers] = useState<LayerVisibilityState>({
    organs: true,
    skeleton: true,
    muscles: false,
    shell: false,
  });

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);

  const interactiveMeshesRef = useRef<Map<THREE.Mesh, AnatomicalRegionId>>(new Map());
  const regionMeshesRef = useRef<Map<AnatomicalRegionId, THREE.Mesh[]>>(new Map());
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());

  // Check WebGL availability
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) {
        setIsWebGLSupported(false);
      }
    } catch {
      setIsWebGLSupported(false);
    }
  }, []);

  // Update layer visibility in 3D scene
  useEffect(() => {
    modelRootRef.current?.traverse((child) => {
      const semanticRoot = findCombinedSemanticRoot(child);
      if (semanticRoot?.startsWith("organ_")) child.visible = layers.organs;
      if (semanticRoot?.startsWith("bone_")) child.visible = layers.skeleton;
    });
  }, [layers]);

  // Update dynamic highlights when hovered or selected regions change
  useEffect(() => {
    if (!interactiveMeshesRef.current) return;

    interactiveMeshesRef.current.forEach((regionId, mesh) => {
      const origMat = originalMaterialsRef.current.get(mesh);
      if (!origMat) return;

      const isSelected = selectedRegion?.id === regionId;
      const isHovered = hoveredRegion?.id === regionId;
      const regionState = regionStates[regionId];

      if (regionId === "body_shell") {
        return;
      }

      const hasSupportedData = Boolean(regionState?.hasData && regionState.status !== "NO_DATA");
      const statusColor = regionState ? STATUS_COLORS[regionState.status].hex : "#64748b";

      if (isSelected && hasSupportedData) {
        // Medical focus illumination
        if (!mesh.userData["selectedMaterial"]) {
          mesh.userData["selectedMaterial"] = (origMat as THREE.MeshStandardMaterial).clone();
        }
        const mat = mesh.userData["selectedMaterial"] as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(statusColor);
        mat.emissiveIntensity = 0.65;
        mat.roughness = 0.2;
        mesh.material = mat;
      } else if (isHovered && hasSupportedData) {
        // Subtle hover glow
        if (!mesh.userData["hoverMaterial"]) {
          mesh.userData["hoverMaterial"] = (origMat as THREE.MeshStandardMaterial).clone();
        }
        const mat = mesh.userData["hoverMaterial"] as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(statusColor);
        mat.emissiveIntensity = 0.35;
        mesh.material = mat;
      } else {
        // Restore base material with subtle clinical status tone if data exists
        if (hasSupportedData) {
          if (!mesh.userData["statusMaterial"]) {
            mesh.userData["statusMaterial"] = (origMat as THREE.MeshStandardMaterial).clone();
          }
          const mat = mesh.userData["statusMaterial"] as THREE.MeshStandardMaterial;
          mat.emissive = new THREE.Color(statusColor);
          mat.emissiveIntensity =
            regionState.status === "REVIEW_REQUIRED"
              ? 0.3
              : regionState.status === "ATTENTION"
                ? 0.2
                : 0.1;
          mesh.material = mat;
        } else {
          mesh.material = origMat;
        }
      }
    });
  }, [selectedRegion, hoveredRegion, regionStates]);

  // Main Three.js Scene Setup and Asset Loading
  const initScene = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;

    setIsLoading(true);
    setLoadError(null);
    setLoadingProgress(15);
    setUnderlyingSelection(null);

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 700;

    const instanceId = Math.floor(Math.random() * 10000);
    const initTimestamp = performance.now();
    console.log(
      `[AnatomicalScene#${instanceId}] initScene START at ${initTimestamp.toFixed(1)}ms. Dimensions: container=${container.clientWidth}x${container.clientHeight}, canvas=${canvasRef.current.clientWidth}x${canvasRef.current.clientHeight}`,
    );

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera: FOV 38deg, positioned close so human body is large and fills the viewport
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 0.86, 3.1);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and alpha
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      rendererRef.current = renderer;
      console.log(`[AnatomicalScene#${instanceId}] WebGLRenderer created successfully`);
    } catch (glErr) {
      console.error(`[AnatomicalScene#${instanceId}] WebGLRenderer creation FAILED:`, glErr);
      setIsWebGLSupported(false);
      setIsLoading(false);
      return;
    }

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.6;
    controls.maxDistance = 4.5;
    controls.target.set(0, 0.86, 0);
    controls.maxPolarAngle = Math.PI * 0.85; // Prevent flipping beneath feet
    controls.minPolarAngle = Math.PI * 0.15;
    controls.zoomToCursor = true;
    controls.cursor.set(0, 0.86, 0);
    controls.maxTargetRadius = 1.0;
    controlsRef.current = controls;

    // 5. Lighting: 3-point clinical setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-3, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.85);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // 6. Master Model Root
    const modelRoot = new THREE.Group();
    modelRoot.name = "HumanAnatomyMasterRoot";
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;

    // 7. Load Models
    console.log(
      `[AnatomicalScene#${instanceId}] Creating GLTFLoader and starting load of ${COMBINED_MODEL_PATH}...`,
    );
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    loader.setDRACOLoader(dracoLoader);

    let isDisposed = false;

    interactiveMeshesRef.current.clear();
    regionMeshesRef.current.clear();
    originalMaterialsRef.current.clear();

    const registerMesh = (mesh: THREE.Mesh, regionId: AnatomicalRegionId) => {
      interactiveMeshesRef.current.set(mesh, regionId);

      const list = regionMeshesRef.current.get(regionId) || [];
      list.push(mesh);
      regionMeshesRef.current.set(regionId, list);

      if (!originalMaterialsRef.current.has(mesh)) {
        originalMaterialsRef.current.set(mesh, mesh.material as THREE.Material);
      }
    };

    let meshesRegisteredCount = 0;
    loader.load(
      COMBINED_MODEL_PATH,
      (gltf) => {
        if (isDisposed) {
          console.log(
            `[AnatomicalScene#${instanceId}] GLTF load completed after scene cleanup/unmount. Discarding loaded geometry.`,
          );
          disposeLoadedModel(gltf.scene);
          return;
        }
        try {
          const loadDuration = performance.now() - initTimestamp;
          console.log(
            `[AnatomicalScene#${instanceId}] GLTF load SUCCESS in ${loadDuration.toFixed(1)}ms. Starting traverse...`,
          );
          setLoadingProgress(80);
          const combinedModel = gltf.scene;
          combinedModel.traverse((child) => {
            if (!(child as THREE.Mesh).isMesh) return;
            const mesh = child as THREE.Mesh;
            const semanticRoot = findCombinedSemanticRoot(mesh);
            const regionId = semanticRoot ? COMBINED_SEMANTIC_REGION_MAP[semanticRoot] : null;
            if (!regionId) return;
            registerMesh(mesh, regionId);
            meshesRegisteredCount++;
          });
          if (isDisposed) {
            disposeLoadedModel(combinedModel);
            return;
          }
          modelRoot.add(combinedModel);
          setLoadingProgress(100);
          setIsLoading(false);
          console.log(
            `[AnatomicalScene#${instanceId}] Traversing complete: ${meshesRegisteredCount} meshes registered. modelRoot.add done. setIsLoading(false) EXECUTED.`,
          );
        } catch (traverseErr) {
          if (isDisposed) return;
          console.error(
            `[AnatomicalScene#${instanceId}] Exception during GLTF success callback:`,
            traverseErr,
          );
          setLoadError("Error processing 3D model");
          setIsLoading(false);
        }
      },
      (xhr) => {
        if (isDisposed) return;
        if (xhr.total > 0) {
          const uiPct = Math.min(80, Math.floor((xhr.loaded / xhr.total) * 80));
          const bytesPct = Math.floor((xhr.loaded / xhr.total) * 100);
          setLoadingProgress(uiPct);
          console.log(
            `[AnatomicalScene#${instanceId}] Progress: ${xhr.loaded}/${xhr.total} bytes (${bytesPct}% bytes received, UI progress: ${uiPct}%)`,
          );
        } else {
          console.log(
            `[AnatomicalScene#${instanceId}] Progress: ${xhr.loaded} bytes received (total unknown)`,
          );
        }
      },
      (err) => {
        if (isDisposed) return;
        console.error(`[AnatomicalScene#${instanceId}] loader.load ERROR:`, err);
        setLoadError(tRef.current("dashboard.anatomy.modelLoadError") || "Model failed to load");
        setIsLoading(false);
      },
    );

    // 8. Render Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Subtle slow anatomical breathing/sway when idle
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isDisposed = true;
      console.log(
        `[AnatomicalScene#${instanceId}] CLEANUP CALLED at ${(performance.now() - initTimestamp).toFixed(1)}ms after init! Disposing Three.js resources...`,
      );
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      disposeLoadedModel(modelRoot);
      renderer.dispose();
      dracoLoader.dispose();
      interactiveMeshesRef.current.clear();
      regionMeshesRef.current.clear();
      originalMaterialsRef.current.clear();
      modelRootRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isWebGLSupported || force2D) return;
    const cleanup = initScene();
    return () => cleanup?.();
  }, [initScene, isWebGLSupported, force2D]);

  // Pointer Interaction (Hover & Click)
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    setUnderlyingSelection(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
    const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
    if (dx > 4 || dy > 4) {
      isDraggingRef.current = true;
    }

    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Raycast against interactive organs and bones, ignoring outer translucent shell
    const meshes = Array.from(interactiveMeshesRef.current.keys()).filter((m) => {
      const regId = interactiveMeshesRef.current.get(m);
      return regId !== "body_shell" && isObjectVisible(m);
    });

    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const firstIntersection = intersects[0];
      if (!firstIntersection) return;
      const hitMesh = firstIntersection.object as THREE.Mesh;
      const regionId = interactiveMeshesRef.current.get(hitMesh);
      if (regionId && regionStates[regionId]) {
        setHoveredRegion(regionStates[regionId]);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        canvasRef.current.style.cursor = "pointer";
        return;
      }
    }

    setHoveredRegion(null);
    setTooltipPos(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      setUnderlyingSelection(null);
      return;
    }

    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const meshes = Array.from(interactiveMeshesRef.current.keys()).filter((m) => {
      const regId = interactiveMeshesRef.current.get(m);
      return regId !== "body_shell" && isObjectVisible(m);
    });

    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const candidates = intersects
        .map((intersection) => {
          const regionId = interactiveMeshesRef.current.get(intersection.object as THREE.Mesh);
          return regionId ? { regionId, distance: intersection.distance } : null;
        })
        .filter((candidate): candidate is { regionId: AnatomicalRegionId; distance: number } =>
          Boolean(candidate),
        )
        .filter(
          (candidate, index, all) =>
            all.findIndex((item) => item.regionId === candidate.regionId) === index,
        );
      const nearest = candidates[0];
      const underlyingOrgan = candidates
        .slice(1)
        .map((candidate) => regionStates[candidate.regionId])
        .find((region) => region?.category === "organ");

      setUnderlyingSelection(underlyingOrgan || null);
      if (nearest && regionStates[nearest.regionId]) {
        onSelectRegion(regionStates[nearest.regionId]);
        return;
      }
    }

    // Clicking empty space deselects
    setUnderlyingSelection(null);
    onSelectRegion(null);
  };

  const handlePointerLeave = () => {
    setHoveredRegion(null);
    setTooltipPos(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    setHoveredRegion(null);
    setTooltipPos(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  // Camera preset transitions
  const handlePreset = (preset: CameraPreset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    setActivePreset(preset);

    const targetPos = new THREE.Vector3(0, 0.86, 0);
    const duration = 400;
    const startCamPos = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target.clone();
    let endCamPos = new THREE.Vector3(0, 0.86, 3.1);

    if (preset === "side") {
      endCamPos = new THREE.Vector3(3.1, 0.86, 0);
    } else if (preset === "back") {
      endCamPos = new THREE.Vector3(0, 0.86, -3.1);
    }

    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      // Smooth easeInOutQuad
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      cameraRef.current?.position.lerpVectors(startCamPos, endCamPos, ease);
      controlsRef.current?.target.lerpVectors(startTarget, targetPos, ease);
      controlsRef.current?.update();

      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    step();
  };

  const handleReset = () => {
    handlePreset("front");
    onSelectRegion(null);
    if (modelRootRef.current) {
      modelRootRef.current.rotation.set(0, 0, 0);
    }
  };

  const handleToggleLayer = (layer: keyof LayerVisibilityState) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (!isWebGLSupported || force2D) {
    return (
      <div className={`relative ${className}`}>
        <AnatomicalFallback2D
          regionStates={regionStates}
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
          onSwitchTo3D={isWebGLSupported ? () => setForce2D(false) : undefined}
        />
        {/* Floating details panel */}
        {selectedRegion && (
          <div className="absolute top-4 right-4 z-20 w-80 sm:w-96 max-h-[calc(100%-2rem)]">
            <BodyInformationPanel region={selectedRegion} onClose={() => onSelectRegion(null)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden touch-none ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        className="w-full h-full block cursor-grab active:cursor-grabbing outline-none"
        aria-label="Interactive 3D anatomical region map. Drag to orbit, use wheel or pinch to zoom, and select anatomical regions to view available health information."
      />

      {/* Loading Overlay */}
      {isLoading && (
        <LoadingOverlay
          isLoading={isLoading}
          progress={loadingProgress}
          error={loadError}
          onRetry={() => {
            initScene();
          }}
        />
      )}

      {/* Sleek Floating Secondary HUD */}
      {!isLoading && !loadError && (
        <AnatomyControls
          onReset={handleReset}
          onPreset={handlePreset}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          is2DActive={false}
          onToggle2D={() => setForce2D(true)}
          activePreset={activePreset}
          showShellToggle={false}
        />
      )}

      {/* Dynamic Hover Tooltip */}
      {hoveredRegion && tooltipPos && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-3 py-1.5 rounded-xl bg-card/95 backdrop-blur-md border border-border/80 shadow-lg text-xs animate-in fade-in zoom-in-95 duration-150"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[hoveredRegion.status].hex }}
            />
            <span>{t(hoveredRegion.nameKey) || hoveredRegion.defaultName}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t(STATUS_COLORS[hoveredRegion.status].labelKey) ||
              STATUS_COLORS[hoveredRegion.status].defaultLabel}
          </div>
        </div>
      )}

      {underlyingSelection && selectedRegion?.category === "bone" && (
        <button
          type="button"
          className="absolute bottom-14 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-primary/40 bg-background/90 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-md backdrop-blur-md touch-press"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={() => {
            onSelectRegion(underlyingSelection);
            setUnderlyingSelection(null);
          }}
          aria-label={`Select underlying ${underlyingSelection.defaultName}`}
        >
          Select underlying {t(underlyingSelection.nameKey) || underlyingSelection.defaultName}
        </button>
      )}

      {/* Subtle Floating Guidance Pill (Only when no organ is selected) */}
      {!selectedRegion && !isLoading && (
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3.5 py-1.5 rounded-full bg-background/60 backdrop-blur-md border border-border/40 text-[11px] text-muted-foreground flex items-center gap-2 shadow-xs transition-opacity duration-300">
          <span>
            {t("dashboard.anatomy.interactionHint") ||
              "Rotate • Zoom • Select an anatomical region for available health information"}
          </span>
        </div>
      )}

      {/* Dynamic Floating Contextual Info Drawer (When organ IS selected) */}
      {selectedRegion && (
        <div className="absolute top-3.5 right-3.5 bottom-3.5 z-20 w-80 sm:w-96 max-w-[calc(100%-2rem)] flex flex-col pointer-events-auto">
          <BodyInformationPanel
            region={selectedRegion}
            onClose={() => onSelectRegion(null)}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}
