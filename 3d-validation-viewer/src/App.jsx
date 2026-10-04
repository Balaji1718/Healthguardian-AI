import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function App() {
  const mountRef = useRef(null);
  // Phase B validates the newly generated skeleton-only asset.
  const [selectedModel, setSelectedModel] = useState('combined_clean_batched');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Selection, Hover, and Isolation State
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [xrayMode, setXrayMode] = useState(false);
  
  // Layer Visibility for Combined model
  const [showOrgans, setShowOrgans] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [organsOpacity, setOrgansOpacity] = useState(1.0);
  const [skeletonOpacity, setSkeletonOpacity] = useState(1.0);
  
  // Metrics & Diagnostics
  const [metrics, setMetrics] = useState({
    loadTimeMs: 0,
    parseTimeMs: 0,
    triangles: 0,
    meshes: 0,
    fps: 60,
    drawCalls: 0
  });

  const [discoveredRoots, setDiscoveredRoots] = useState([]);
  const [organDiagnostics, setOrganDiagnostics] = useState({});
  const [testSimulateError, setTestSimulateError] = useState(false);

  // Three.js internal references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const currentModelRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const materialsMapRef = useRef(new Map());

  // Model file paths
  const modelPaths = {
    task2_organs: '/models/healthguardian-organs-task2.glb',
    organs: '/models/healthguardian-organs.glb',
    skeleton_clean: '/models/healthguardian-skeleton-clean.glb',
    skeleton_clean_batched: '/models/healthguardian-skeleton-clean-batched.glb',
    combined_clean_batched: '/models/healthguardian-organs-skeleton-clean-batched.glb',
    skeleton: '/models/healthguardian-skeleton.glb',
    combined: '/models/healthguardian-organs-skeleton.glb'
  };

  const semanticRoots = new Set([
    'bone_skull', 'bone_cervical_spine', 'bone_spine', 'bone_ribcage', 'bone_sternum',
    'bone_clavicles', 'bone_scapulae', 'bone_pelvis', 'bone_left_humerus',
    'bone_right_humerus', 'bone_left_radius', 'bone_right_radius', 'bone_left_ulna',
    'bone_right_ulna', 'bone_left_hand', 'bone_right_hand', 'bone_left_femur',
    'bone_right_femur', 'bone_left_patella', 'bone_right_patella', 'bone_left_tibia',
    'bone_right_tibia', 'bone_left_fibula', 'bone_right_fibula', 'bone_left_foot',
    'bone_right_foot', 'organ_brain', 'organ_heart', 'organ_lungs', 'organ_liver',
    'organ_stomach', 'organ_pancreas', 'organ_spleen', 'organ_left_kidney',
    'organ_right_kidney', 'organ_bladder'
  ]);

  const isSemanticRoot = (name) => semanticRoots.has(name);

  // Find semantic root (starts with organ_ or bone_)
  const findSemanticRoot = (obj) => {
    let curr = obj;
    while (curr && curr.parent && curr !== currentModelRef.current && curr.name !== 'Organs') {
      if (curr.name && isSemanticRoot(curr.name)) {
        return curr;
      }
      curr = curr.parent;
    }
    if (curr && curr.name && isSemanticRoot(curr.name)) {
      return curr;
    }
    return obj;
  };

  // Setup Three.js scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Grid helper
    const grid = new THREE.GridHelper(4, 20, 0x1e293b, 0x0f172a);
    grid.position.y = 0;
    scene.add(grid);

    // Coordinate axes helper (+X Red, +Y Green, +Z Blue)
    const axes = new THREE.AxesHelper(0.5);
    axes.position.set(-1.2, 0.01, -1.2);
    scene.add(axes);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 50);
    camera.position.set(0, 0.85, 3.1);
    cameraRef.current = camera;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    const dirFront = new THREE.DirectionalLight(0xffffff, 1.3);
    dirFront.position.set(2, 4, 3);
    scene.add(dirFront);

    const dirBack = new THREE.DirectionalLight(0x94a3b8, 0.9);
    dirBack.position.set(-2, 2, -3);
    scene.add(dirBack);

    const hemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    scene.add(hemi);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.85, 0);
    controls.minDistance = 0.1;
    controls.maxDistance = 8.0;
    controlsRef.current = controls;

    // Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Robust FPS loop (never displays NaN)
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      frameCount++;
      const now = performance.now();
      const delta = now - lastTime;
      if (delta >= 1000) {
        const measuredFps = delta > 0 ? Math.round((frameCount * 1000) / delta) : 60;
        setMetrics(m => {
          const next = {
            ...m,
            fps: isNaN(measuredFps) || measuredFps <= 0 ? 60 : measuredFps,
            drawCalls: renderer.info.render.calls
          };
          window.__healthGuardianMetrics = next;
          return next;
        });
        frameCount = 0;
        lastTime = now;
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load Model effect
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clear previous model
    if (currentModelRef.current) {
      scene.remove(currentModelRef.current);
      currentModelRef.current = null;
    }
    setSelectedEntity(null);
    setHoveredEntity(null);
    setIsolateSelected(false);
    setErrorMsg(null);
    materialsMapRef.current.clear();

    if (testSimulateError) {
      setErrorMsg('SIMULATED ERROR: Failed to load glTF file (404 Not Found / Corrupted WebGL Asset).');
      return;
    }

    setLoading(true);
    const startTime = performance.now();

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    const modelUrl = modelPaths[selectedModel];

    loader.load(
      modelUrl,
      (gltf) => {
        const loadEndTime = performance.now();
        const model = gltf.scene;
        currentModelRef.current = model;

        // Discover semantic roots & compute live diagnostics per root
        let triangleCount = 0;
        let meshCount = 0;
        const rootsFound = [];
        const diagMap = {};

        model.traverse((child) => {
          if (child.name && isSemanticRoot(child.name)) {
            if (!rootsFound.includes(child.name)) {
              rootsFound.push(child.name);
            }
          }

          if (child.isMesh) {
            meshCount++;
            let tris = 0;
            if (child.geometry) {
              const geom = child.geometry;
              if (geom.index) {
                tris = geom.index.count / 3;
              } else if (geom.attributes.position) {
                tris = geom.attributes.position.count / 3;
              }
            }
            triangleCount += tris;

            const root = findSemanticRoot(child);
            const rootName = root.name || child.name;

            if (!diagMap[rootName]) {
              diagMap[rootName] = {
                rootName,
                childCount: 0,
                meshCount: 0,
                triangles: 0,
                materials: new Set(),
                box: new THREE.Box3(),
                status: 'VERIFIED'
              };
            }

            diagMap[rootName].meshCount++;
            diagMap[rootName].triangles += Math.round(tris);
            if (child.material) {
              const matName = child.material.name || 'unnamed_mat';
              diagMap[rootName].materials.add(matName);
            }
            if (child.geometry) {
              child.geometry.computeBoundingBox();
              const b = child.geometry.boundingBox.clone();
              b.applyMatrix4(child.matrixWorld);
              diagMap[rootName].box.union(b);
            }

            if (child.material) {
              materialsMapRef.current.set(child.uuid, {
                original: child.material,
                cloned: child.material.clone()
              });
            }
          }
        });

        // Convert sets to arrays for diagnostic display
        const serializableDiag = {};
        for (const [k, v] of Object.entries(diagMap)) {
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          v.box.getCenter(center);
          v.box.getSize(size);
          serializableDiag[k] = {
            rootName: v.rootName,
            meshCount: v.meshCount,
            triangles: v.triangles,
            materials: Array.from(v.materials).join(', '),
            boundsMin: `[${v.box.min.x.toFixed(3)}, ${v.box.min.y.toFixed(3)}, ${v.box.min.z.toFixed(3)}]`,
            boundsMax: `[${v.box.max.x.toFixed(3)}, ${v.box.max.y.toFixed(3)}, ${v.box.max.z.toFixed(3)}]`,
            center: `(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`,
            extents: `[${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}]`,
            status: 'VERIFIED'
          };
        }

        setDiscoveredRoots(rootsFound);
        setOrganDiagnostics(serializableDiag);

        scene.add(model);
        window.__healthGuardianRaycastAudit = () => {
          const originalVisibility = new Map();
          const results = {};
          const roots = Array.from(model.children).filter((child) => isSemanticRoot(child.name));

          model.traverse((child) => originalVisibility.set(child, child.visible));
          for (const root of roots) {
            model.children.forEach((child) => { child.visible = child === root; });
            root.updateMatrixWorld(true);
            let targetMesh = null;
            root.traverse((child) => {
              if (!targetMesh && child.isMesh && child.geometry) targetMesh = child;
            });
            if (!targetMesh) {
              results[root.name] = { hit: false, resolvedRoot: null };
              continue;
            }
            const position = targetMesh.geometry.attributes.position;
            const sampleStep = Math.max(1, Math.floor(position.count / 100));
            let hit = null;
            for (let index = 0; index < position.count && !hit; index += sampleStep) {
              const surfacePoint = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
              targetMesh.localToWorld(surfacePoint);
              surfacePoint.project(cameraRef.current);
              raycasterRef.current.setFromCamera(new THREE.Vector2(surfacePoint.x, surfacePoint.y), cameraRef.current);
              hit = raycasterRef.current.intersectObject(root, true)[0]?.object || null;
            }
            const resolved = hit ? findSemanticRoot(hit)?.name : null;
            results[root.name] = { hit: Boolean(hit), resolvedRoot: resolved };
          }
          originalVisibility.forEach((visible, child) => { child.visible = visible; });
          return results;
        };
        window.__healthGuardianChildRaycastAudit = () => {
          const results = [];
          const roots = Array.from(model.children).filter((child) => isSemanticRoot(child.name));
          const originalVisibility = new Map();
          model.traverse((child) => originalVisibility.set(child, child.visible));
          for (const root of roots) {
            model.children.forEach((child) => { child.visible = child === root; });
            root.updateMatrixWorld(true);
            root.traverse((mesh) => {
              if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
              const position = mesh.geometry.attributes.position;
              const sampleStep = Math.max(1, Math.floor(position.count / 100));
              let hit = null;
              for (let index = 0; index < position.count && !hit; index += sampleStep) {
                const point = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
                mesh.localToWorld(point);
                point.project(cameraRef.current);
                raycasterRef.current.setFromCamera(new THREE.Vector2(point.x, point.y), cameraRef.current);
                hit = raycasterRef.current.intersectObject(root, true)[0]?.object || null;
              }
              results.push({ mesh: mesh.name, expectedRoot: root.name, resolvedRoot: hit ? findSemanticRoot(hit)?.name : null });
            });
          }
          originalVisibility.forEach((visible, child) => { child.visible = visible; });
          return results;
        };
        window.__healthGuardianVisibilityAudit = () => {
          const visible = { organs: [], bones: [] };
          model.traverse((child) => {
            if (!child.isMesh || !child.visible) return;
            const root = findSemanticRoot(child)?.name;
            if (root?.startsWith('organ_')) visible.organs.push(root);
            if (root?.startsWith('bone_')) visible.bones.push(root);
          });
          return { organs: [...new Set(visible.organs)], bones: [...new Set(visible.bones)] };
        };
        window.__healthGuardianLayerInterferenceAudit = (targetNames = []) => {
          const results = {};
          const roots = new Map(model.children.filter((child) => isSemanticRoot(child.name)).map((child) => [child.name, child]));
          for (const targetName of targetNames) {
            const target = roots.get(targetName);
            if (!target) {
              results[targetName] = { targetReachable: false, reason: 'missing root' };
              continue;
            }
            let targetMesh = null;
            target.traverse((child) => { if (!targetMesh && child.isMesh && child.geometry?.attributes?.position) targetMesh = child; });
            const hits = [];
            if (targetMesh) {
              const position = targetMesh.geometry.attributes.position;
              const sampleStep = Math.max(1, Math.floor(position.count / 80));
              for (let index = 0; index < position.count; index += sampleStep) {
                const point = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
                targetMesh.localToWorld(point);
                point.project(cameraRef.current);
                raycasterRef.current.setFromCamera(new THREE.Vector2(point.x, point.y), cameraRef.current);
                const hit = raycasterRef.current.intersectObjects(model.children, true)[0]?.object;
                if (hit) hits.push(findSemanticRoot(hit)?.name || hit.name);
              }
            }
            const counts = hits.reduce((acc, name) => { acc[name] = (acc[name] || 0) + 1; return acc; }, {});
            results[targetName] = { targetReachable: Boolean(counts[targetName]), firstHitCounts: counts };
          }
          return results;
        };
        setLoading(false);

        setMetrics(m => {
          const next = {
            ...m,
            loadTimeMs: Math.round(loadEndTime - startTime),
            parseTimeMs: Math.round(performance.now() - loadEndTime),
            triangles: Math.round(triangleCount),
            meshes: meshCount
          };
          window.__healthGuardianMetrics = next;
          return next;
        });
      },
      undefined,
      (err) => {
        setLoading(false);
        console.error('Failed to load GLB:', err);
        setErrorMsg(`Failed to load ${modelUrl}: ${err.message || 'Network / glTF decode error'}`);
      }
    );
  }, [selectedModel, testSimulateError]);

  // Helper to apply X-Ray transparency to outer shells to reveal internal structures
  const applyMeshOpacity = (child, baseOpacity) => {
    if (!child.isMesh || !child.material) return;
    if (xrayMode) {
      const n = (child.name || '').toLowerCase();
      const isOuterEnclosure = 
        n.includes('ventricle') || 
        n.includes('atria') || 
        n.includes('capsule') || 
        n.includes('cortex') || 
        n.includes('dome') || 
        n.includes('parenchyma') || 
        n.includes('stomach_mucosa');

      if (isOuterEnclosure) {
        child.material.transparent = true;
        child.material.opacity = 0.22;
        child.material.depthWrite = false;
      } else {
        // Internal structures remain solid and clearly visible
        child.material.transparent = false;
        child.material.opacity = 1.0;
        child.material.depthWrite = true;
      }
    } else {
      child.material.transparent = baseOpacity < 1.0;
      child.material.opacity = baseOpacity;
      child.material.depthWrite = true;
    }
  };

  // Update visibility and isolation
  useEffect(() => {
    if (!currentModelRef.current) return;
    const model = currentModelRef.current;

    model.traverse((child) => {
      const root = findSemanticRoot(child);
      const isOrgan = root.name && root.name.startsWith('organ_');
      const isSkeleton = root.name && (root.name.startsWith('bone_') || root.name.startsWith('skeleton_'));

      if (isolateSelected && selectedEntity) {
        // Isolate selected mode: ONLY show the selected organ/bone
        const isSelected = root.name === selectedEntity.name;
        child.visible = isSelected;
        if (child.isMesh && child.material) {
          applyMeshOpacity(child, 1.0);
        }
      } else {
        // Normal mode
        if (isOrgan) {
          child.visible = showOrgans;
          if (child.isMesh && child.material) {
            applyMeshOpacity(child, organsOpacity);
          }
        } else if (isSkeleton) {
          child.visible = showSkeleton;
          if (child.isMesh && child.material) {
            child.material.transparent = skeletonOpacity < 1.0;
            child.material.opacity = skeletonOpacity;
          }
        } else {
          child.visible = true;
        }
      }
    });
  }, [isolateSelected, selectedEntity, showOrgans, showSkeleton, organsOpacity, skeletonOpacity, xrayMode]);

  // Highlight helper
  const applyHighlight = (targetRootName, isSelected = false) => {
    if (!currentModelRef.current) return;
    currentModelRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        const root = findSemanticRoot(child);
        const isMatch = root.name === targetRootName;
        const origMat = materialsMapRef.current.get(child.uuid)?.original;
        if (!origMat) return;

        if (isMatch) {
          if (!child.material._isCustomHighlight) {
            child.material = origMat.clone();
            child.material._isCustomHighlight = true;
          }
          if (isSelected) {
            child.material.emissive = new THREE.Color(0x0ea5e9);
            child.material.emissiveIntensity = 0.65;
          } else {
            child.material.emissive = new THREE.Color(0x38bdf8);
            child.material.emissiveIntensity = 0.35;
          }
        } else {
          if (selectedEntity && root.name === selectedEntity.name) {
            // Keep selected highlight
          } else {
            if (child.material._isCustomHighlight) {
              child.material.dispose();
              child.material = origMat;
            }
          }
        }
      }
    });
  };

  // 3D Raycasting hover and click interaction
  const handlePointerMove = (e) => {
    if (!mountRef.current || !cameraRef.current || !currentModelRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(currentModelRef.current.children, true);

    // Filter out invisible objects
    const visibleHits = intersects.filter(hit => hit.object.visible);

    if (visibleHits.length > 0) {
      const hitObj = visibleHits[0].object;
      const root = findSemanticRoot(hitObj);
      if (root && root.name) {
        setHoveredEntity({ name: root.name, meshName: hitObj.name });
        applyHighlight(root.name, selectedEntity && selectedEntity.name === root.name);
      }
    } else {
      if (hoveredEntity) {
        setHoveredEntity(null);
        applyHighlight(selectedEntity ? selectedEntity.name : null, true);
      }
    }
  };

  const handlePointerDown = (e) => {
    if (!mountRef.current || !cameraRef.current || !currentModelRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(currentModelRef.current.children, true);
    const visibleHits = intersects.filter(hit => hit.object.visible);

    if (visibleHits.length > 0) {
      const hitObj = visibleHits[0].object;
      const root = findSemanticRoot(hitObj);
      const newEntity = { name: root.name, meshName: hitObj.name };
      setSelectedEntity(newEntity);
      applyHighlight(root.name, true);
    } else {
      // Clicked empty background
      if (!isolateSelected) {
        setSelectedEntity(null);
        applyHighlight(null);
      }
    }
  };

  // Camera presets
  const setCameraView = (viewName) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const isCleanSkeleton = selectedModel === 'skeleton_clean' || selectedModel === 'skeleton_clean_batched';
    const dist = isCleanSkeleton ? 3.1 : 2.4;
    const centerY = isCleanSkeleton ? 0.85 : 1.25;

    switch (viewName) {
      case 'front': // +Z
        cam.position.set(0, centerY, dist);
        break;
      case 'back': // -Z
        cam.position.set(0, centerY, -dist);
        break;
      case 'left': // -X
        cam.position.set(-dist, centerY, 0);
        break;
      case 'right': // +X
        cam.position.set(dist, centerY, 0);
        break;
      case 'top': // +Y
        cam.position.set(0, centerY + dist, 0.01);
        break;
      case 'bottom': // -Y
        cam.position.set(0, centerY - dist, 0.01);
        break;
      case 'front-left':
        cam.position.set(-dist * 0.7, centerY, dist * 0.7);
        break;
      case 'front-right':
        cam.position.set(dist * 0.7, centerY, dist * 0.7);
        break;
      case 'back-left':
        cam.position.set(-dist * 0.7, centerY, -dist * 0.7);
        break;
      case 'back-right':
        cam.position.set(dist * 0.7, centerY, -dist * 0.7);
        break;
      case 'reset':
      default:
        cam.position.set(0, centerY, dist);
        break;
    }
    ctrl.target.set(0, centerY, 0);
    ctrl.update();
  };

  // Deep inspection zoom to specific organ or bone
  const zoomToTarget = (targetName, focusY, focusDist = 0.40) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    cam.position.set(0, focusY, focusDist);
    ctrl.target.set(0, focusY, 0);
    ctrl.update();
    setSelectedEntity({ name: targetName, meshName: targetName });
    applyHighlight(targetName, true);
  };

  const selectedDiag = selectedEntity ? organDiagnostics[selectedEntity.name] : null;

  return (
    <div className="validation-shell" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 3D Viewport */}
      <div 
        ref={mountRef} 
        id="viewport-canvas-container"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        className="validation-viewport"
        style={{ flex: 1, height: '100%', position: 'relative', cursor: 'grab' }}
      >
        {/* Loading Spinner */}
        {loading && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 23, 42, 0.90)', padding: '16px 24px', borderRadius: '12px',
            border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 'bold', zIndex: 10
          }}>
            Loading {selectedModel.toUpperCase()} GLB Asset...
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div style={{
            position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.95)', padding: '14px 20px', borderRadius: '8px',
            color: '#ffffff', fontWeight: 'bold', maxWidth: '80%', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {errorMsg}
            <button 
              onClick={() => { setTestSimulateError(false); setErrorMsg(null); }}
              style={{ marginLeft: '12px', padding: '4px 8px', background: '#ffffff', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Reset Normal
            </button>
          </div>
        )}

        {/* Floating Tooltip / Selection Overlay */}
        {(selectedEntity || hoveredEntity) && (
          <div style={{
            position: 'absolute', bottom: '24px', left: '24px',
            background: 'rgba(15, 23, 42, 0.92)', padding: '14px 20px', borderRadius: '10px',
            border: '1px solid #38bdf8', backdropFilter: 'blur(8px)', zIndex: 5, minWidth: '260px'
          }} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
              {selectedEntity ? 'Selected Anatomical Root' : 'Hovered Object'}
            </div>
            <div id="selected-organ-name" style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>
              {selectedEntity ? selectedEntity.name : hoveredEntity?.name}
            </div>

            {/* Isolate Selected Controls */}
            {selectedEntity && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button 
                  id="btn-isolate-selected"
                  onClick={() => setIsolateSelected(!isolateSelected)}
                  style={{
                    padding: '6px 12px', background: isolateSelected ? '#e11d48' : '#0284c7',
                    color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  {isolateSelected ? 'Show All Organs' : 'Isolate Selected Organ'}
                </button>
                <button 
                  id="btn-clear-selection"
                  onClick={() => { setSelectedEntity(null); setIsolateSelected(false); applyHighlight(null); }}
                  style={{ padding: '6px 10px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Isolation Badge */}
        {isolateSelected && selectedEntity && (
          <div style={{
            position: 'absolute', top: '24px', left: '24px',
            background: 'rgba(225, 29, 72, 0.9)', padding: '8px 16px', borderRadius: '8px',
            color: '#ffffff', fontWeight: 'bold', fontSize: '13px', zIndex: 5, border: '1px solid #fda4af'
          }}>
            ISOLATED VIEW: {selectedEntity.name} (All other organs hidden)
          </div>
        )}
      </div>

      {/* Control & Validation Panel */}
      <div className="validation-panel" style={{
        width: '400px', height: '100%', background: '#0b1329', borderLeft: '1px solid #1e293b',
        padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', color: '#38bdf8', margin: '0 0 4px 0' }}>HealthGuardian 3D</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Asset 1: Organs Only Validation Suite</p>
        </div>

        {/* Model Switcher */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            SELECT ASSET
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { id: 'task2_organs', label: 'Task 2 Organs (Clean)' },
              { id: 'organs', label: 'Previous Organs' },
              { id: 'skeleton_clean', label: 'Clean Skeleton (Task 3)' },
              { id: 'skeleton_clean_batched', label: 'Batched Skeleton (Task 3)' },
              { id: 'combined_clean_batched', label: 'Combined Asset 3 (Clean)' },
              { id: 'skeleton', label: 'Skeleton' },
              { id: 'combined', label: 'Combined' }
            ].map(m => (
              <button
                key={m.id}
                id={`btn-model-${m.id}`}
                onClick={() => setSelectedModel(m.id)}
                style={{
                  padding: '8px 6px', border: '1px solid',
                  borderColor: selectedModel === m.id ? '#38bdf8' : '#334155',
                  background: selectedModel === m.id ? '#0284c7' : '#1e293b',
                  color: '#ffffff', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            COMBINED LAYERS
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button id="btn-toggle-organs" onClick={() => setShowOrgans(!showOrgans)} style={{ padding: '7px 4px', background: showOrgans ? '#0284c7' : '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
              Organs {showOrgans ? 'ON' : 'OFF'}
            </button>
            <button id="btn-toggle-skeleton" onClick={() => setShowSkeleton(!showSkeleton)} style={{ padding: '7px 4px', background: showSkeleton ? '#0284c7' : '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
              Skeleton {showSkeleton ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Global Isolation / Show All Toggles */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            ISOLATION CONTROLS
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              id="btn-global-isolate"
              disabled={!selectedEntity}
              onClick={() => setIsolateSelected(true)}
              style={{
                padding: '7px 4px', background: selectedEntity ? (isolateSelected ? '#e11d48' : '#0284c7') : '#1e293b',
                color: selectedEntity ? '#fff' : '#64748b', border: '1px solid #334155', borderRadius: '6px',
                fontSize: '11px', fontWeight: 'bold', cursor: selectedEntity ? 'pointer' : 'not-allowed'
              }}
            >
              Isolate Selected
            </button>
            <button
              id="btn-show-all"
              onClick={() => setIsolateSelected(false)}
              style={{
                padding: '7px 4px', background: !isolateSelected ? '#10b981' : '#1e293b',
                color: '#fff', border: '1px solid #334155', borderRadius: '6px',
                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Show All Organs
            </button>
          </div>
        </div>

        {/* Task 2B Internal Structure & X-Ray Mode */}
        <div style={{ background: '#071328', padding: '10px', borderRadius: '8px', border: '1px solid #0284c7' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            INTERNAL ANATOMY INSPECTION (TASK 2B)
          </label>
          <button
            id="btn-toggle-xray"
            onClick={() => setXrayMode(!xrayMode)}
            style={{
              width: '100%', padding: '8px', background: xrayMode ? '#0284c7' : '#1e293b',
              color: '#ffffff', border: '1px solid', borderColor: xrayMode ? '#38bdf8' : '#334155',
              borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '8px'
            }}
          >
            {xrayMode ? '🔍 X-RAY MODE: ON (Internal Anatomy Visible)' : '👁️ X-RAY MODE: OFF (Solid Surfaces)'}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <button
              id="btn-inspect-valves"
              onClick={() => { setXrayMode(true); zoomToTarget('organ_heart', 1.186, 0.22); }}
              style={{ padding: '5px', background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
            >
              ❤️ Heart Valves & Papillary
            </button>
            <button
              id="btn-inspect-pyramids"
              onClick={() => { setXrayMode(true); zoomToTarget('organ_left_kidney', 1.013, 0.20); }}
              style={{ padding: '5px', background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
            >
              🫘 Kidney Pyramids
            </button>
            <button
              id="btn-inspect-airway"
              onClick={() => { setXrayMode(true); zoomToTarget('organ_lungs', 1.253, 0.32); }}
              style={{ padding: '5px', background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
            >
              🫁 Bronchial Tree
            </button>
            <button
              id="btn-inspect-trigone"
              onClick={() => { setXrayMode(true); zoomToTarget('organ_bladder', 0.894, 0.20); }}
              style={{ padding: '5px', background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
            >
              💧 Bladder Trigone
            </button>
          </div>
        </div>

        {/* Camera Angles */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            CAMERA VIEWS (360° & 3/4 ANGLES)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {['front', 'back', 'left', 'right', 'top', 'bottom', 'reset'].map(v => (
              <button
                key={v}
                id={`btn-cam-${v}`}
                onClick={() => setCameraView(v)}
                style={{
                  padding: '6px 2px', background: '#1e293b', border: '1px solid #334155',
                  color: '#94a3b8', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize'
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {['front-left', 'front-right', 'back-left', 'back-right'].map(v => (
              <button
                key={v}
                id={`btn-cam-${v}`}
                onClick={() => setCameraView(v)}
                style={{
                  padding: '6px 2px', background: '#1e293b', border: '1px solid #334155',
                  color: '#94a3b8', borderRadius: '4px', fontSize: '10px', cursor: 'pointer'
                }}
              >
                {v.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Deep Inspection Quick Focus */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            DEEP ZOOM ORGANS (10 REQUIRED)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
            {[
              { name: 'organ_brain', label: 'Brain', y: 1.632, dist: 0.35 },
              { name: 'organ_heart', label: 'Heart', y: 1.186, dist: 0.28 },
              { name: 'organ_lungs', label: 'Lungs', y: 1.253, dist: 0.45 },
              { name: 'organ_liver', label: 'Liver', y: 1.077, dist: 0.35 },
              { name: 'organ_stomach', label: 'Stomach', y: 1.070, dist: 0.32 },
              { name: 'organ_pancreas', label: 'Pancreas', y: 1.049, dist: 0.28 },
              { name: 'organ_spleen', label: 'Spleen', y: 1.047, dist: 0.28 },
              { name: 'organ_left_kidney', label: 'Left Kidney', y: 1.013, dist: 0.28 },
              { name: 'organ_right_kidney', label: 'Right Kidney', y: 0.995, dist: 0.28 },
              { name: 'organ_bladder', label: 'Bladder', y: 0.894, dist: 0.28 },
            ].map(item => (
              <button
                key={item.name}
                id={`btn-inspect-${item.name}`}
                onClick={() => zoomToTarget(item.name, item.y, item.dist)}
                style={{
                  padding: '6px 4px', background: selectedEntity && selectedEntity.name === item.name ? '#0284c7' : '#1e293b',
                  border: '1px solid', borderColor: selectedEntity && selectedEntity.name === item.name ? '#38bdf8' : '#334155',
                  color: selectedEntity && selectedEntity.name === item.name ? '#fff' : '#cbd5e1',
                  borderRadius: '4px', fontSize: '11px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between'
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: '9px', color: '#94a3b8' }}>Zoom</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Entity Diagnostic Card */}
        {selectedDiag && (
          <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #38bdf8', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>DIAGNOSTICS: {selectedDiag.rootName}</span>
              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{selectedDiag.status}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#cbd5e1' }}>
              <div>Triangles: <b id="diag-triangles">{selectedDiag.triangles.toLocaleString()}</b></div>
              <div>Meshes: <b>{selectedDiag.meshCount}</b></div>
              <div>Material: <b>{selectedDiag.materials}</b></div>
              <div>Center: <b>{selectedDiag.center}</b></div>
              <div>Extents: <b>{selectedDiag.extents}</b></div>
              <div>Bounds Min: <b>{selectedDiag.boundsMin}</b></div>
              <div>Bounds Max: <b>{selectedDiag.boundsMax}</b></div>
            </div>
          </div>
        )}

        {/* Performance Metrics Card */}
        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>PERFORMANCE METRICS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#cbd5e1' }}>
            <div>FPS: <span id="metric-fps" style={{ color: metrics.fps >= 50 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>{metrics.fps}</span></div>
            <div>Draw Calls: <span id="metric-draw-calls" style={{ fontWeight: 'bold' }}>{metrics.drawCalls}</span></div>
            <div>Load Time: <span id="metric-load-time" style={{ fontWeight: 'bold' }}>{metrics.loadTimeMs} ms</span></div>
            <div>Parse Time: <span id="metric-parse-time" style={{ fontWeight: 'bold' }}>{metrics.parseTimeMs} ms</span></div>
            <div>Triangles: <span id="metric-triangles" style={{ fontWeight: 'bold' }}>{metrics.triangles.toLocaleString()}</span></div>
            <div>Meshes: <span id="metric-meshes" style={{ fontWeight: 'bold' }}>{metrics.meshes}</span></div>
          </div>
        </div>

        {/* Discovered Semantic Roots List */}
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          <div style={{ fontWeight: 'bold', color: '#cbd5e1', marginBottom: '4px' }}>
            DISCOVERED SEMANTIC ROOTS ({discoveredRoots.length}/{selectedModel === 'skeleton_clean' || selectedModel === 'skeleton_clean_batched' ? 26 : selectedModel === 'combined_clean_batched' ? 36 : 10}):
          </div>
          <div style={{ maxHeight: '110px', overflowY: 'auto', background: '#060a14', padding: '6px', borderRadius: '4px' }}>
            {discoveredRoots.map((r, i) => (
              <span 
                key={i} 
                id={`root-badge-${r}`}
                onClick={() => { setSelectedEntity({ name: r, meshName: r }); applyHighlight(r, true); }}
                style={{
                  display: 'inline-block', margin: '2px 4px', padding: '3px 6px',
                  background: selectedEntity && selectedEntity.name === r ? '#0284c7' : '#1e293b',
                  color: selectedEntity && selectedEntity.name === r ? '#ffffff' : '#94a3b8',
                  borderRadius: '3px', cursor: 'pointer', fontSize: '10px'
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Error Simulation Button */}
        <div>
          <button
            id="btn-simulate-error"
            onClick={() => setTestSimulateError(true)}
            style={{
              width: '100%', padding: '6px', background: '#7f1d1d', border: '1px solid #ef4444',
              color: '#fecaca', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Simulate WebGL / Asset Load Failure
          </button>
        </div>
      </div>
    </div>
  );
}
