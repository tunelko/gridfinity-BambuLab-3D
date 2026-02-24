import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore, type Bin } from '../store/useStore';
import { GF } from '../gridfinity/constants';
import { requestBinMesh, clearMeshCache } from '../hooks/useManifoldWorker';
import type { BinConfig } from '../gridfinity/binGeometry';

// ── Smooth camera animation ──
function animateCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  targetPos: THREE.Vector3,
  targetLook: THREE.Vector3,
  duration = 300,
) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = performance.now();

  function step() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Bin center in world coords ──
function binWorldCenter(bin: Bin, gridCols: number, gridRows: number) {
  const cx = (bin.x + bin.w / 2) * GF.CELL_SIZE - (gridCols * GF.CELL_SIZE) / 2;
  const cz = (bin.y + bin.d / 2) * GF.CELL_SIZE - (gridRows * GF.CELL_SIZE) / 2;
  const h = bin.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT;
  return { cx, cz, h };
}

interface SceneCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  binMeshes: Map<string, THREE.Mesh>;
  binEdges: Map<string, THREE.LineSegments>;
  binWireframes: Map<string, THREE.LineSegments>;
  baseplateMesh: THREE.Mesh | null;
  groundShadow: THREE.Mesh | null;
  gridHelper: THREE.GridHelper;
  ambientLight: THREE.AmbientLight;
  dirLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  clipPlane: THREE.Plane;
}

export default function Viewport3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneCtx | null>(null);
  const frameRef = useRef(0);
  const [sceneReady, setSceneReady] = useState(false);

  const bins = useStore((s) => s.bins);
  const gridCols = useStore((s) => s.gridCols);
  const gridRows = useStore((s) => s.gridRows);
  const selectedBinId = useStore((s) => s.selectedBinId);
  const showBaseplate = useStore((s) => s.showBaseplate);
  const sectionView = useStore((s) => s.sectionView);
  const renderMode = useStore((s) => s.renderMode);
  const showDimensions = useStore((s) => s.showDimensions);

  const prevCameraRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // Dimension label positions (React overlay, updated each frame)
  const dimRef = useRef<{ w: DOMRect | null; labels: { text: string; world: THREE.Vector3 }[] }>({
    w: null, labels: [],
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Init Three.js scene ──
  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;
    clearMeshCache();

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(150, 200, 250);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(100, 200, 150);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 600;
    dirLight.shadow.camera.left = -300;
    dirLight.shadow.camera.right = 300;
    dirLight.shadow.camera.top = 300;
    dirLight.shadow.camera.bottom = -300;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    rimLight.position.set(-100, 100, -100);
    scene.add(rimLight);

    const gridHelper = new THREE.GridHelper(500, 50, 0x222233, 0x151522);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(600, 600);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const groundShadow = new THREE.Mesh(groundGeo, groundMat);
    groundShadow.receiveShadow = true;
    groundShadow.position.y = -0.05;
    scene.add(groundShadow);

    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    const ctx: SceneCtx = {
      scene, camera, renderer, controls,
      binMeshes: new Map(),
      binEdges: new Map(),
      binWireframes: new Map(),
      baseplateMesh: null,
      groundShadow,
      gridHelper,
      ambientLight, dirLight, rimLight,
      clipPlane,
    };
    sceneRef.current = ctx;
    setSceneReady(true);

    // Animation loop — also updates dimension label overlay positions
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      updateDimOverlay(ctx, overlayRef.current);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // ── Camera presets ──
  useEffect(() => {
    function handlePreset(e: Event) {
      const ctx = sceneRef.current;
      if (!ctx) return;
      const preset = (e as CustomEvent).detail as string;
      const { gridCols: cols, gridRows: rows } = useStore.getState();
      const extent = Math.max(cols, rows) * GF.CELL_SIZE;
      const d = extent * 1.2;
      let pos: THREE.Vector3;
      const look = new THREE.Vector3(0, 15, 0);

      switch (preset) {
        case 'front': pos = new THREE.Vector3(0, d * 0.3, d); break;
        case 'top':   pos = new THREE.Vector3(0, d * 1.2, 0.01); break;
        case 'iso': default: pos = new THREE.Vector3(d * 0.6, d * 0.7, d * 0.8); break;
      }
      animateCamera(ctx.camera, ctx.controls, pos, look, 300);
    }
    window.addEventListener('camera-preset', handlePreset);
    return () => window.removeEventListener('camera-preset', handlePreset);
  }, []);

  // ── Double-click → focus bin ──
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onDblClick(e: MouseEvent) {
      if (!ctx) return;
      const rect = ctx.renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, ctx.camera);
      const meshes = Array.from(ctx.binMeshes.values());
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        for (const [binId, mesh] of ctx.binMeshes) {
          if (mesh === hitMesh) {
            const state = useStore.getState();
            const bin = state.bins.find((b) => b.id === binId);
            if (bin) {
              useStore.getState().selectBin(binId);
              const { cx, cz, h } = binWorldCenter(bin, state.gridCols, state.gridRows);
              const lookAt = new THREE.Vector3(cx, h * 0.4, cz);
              const camPos = new THREE.Vector3(cx + h * 2, h * 1.5, cz + h * 2);
              animateCamera(ctx.camera, ctx.controls, camPos, lookAt, 300);
            }
            break;
          }
        }
      }
    }
    ctx.renderer.domElement.addEventListener('dblclick', onDblClick);
    return () => ctx.renderer.domElement.removeEventListener('dblclick', onDblClick);
  }, []);

  // ── Render mode switching ──
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const isBlueprint = renderMode === 'blueprint';
    const isTechnical = renderMode === 'technical';
    const isNonStandard = isTechnical || isBlueprint;

    if (isBlueprint) {
      ctx.scene.background = new THREE.Color('#f0f0f0');
      ctx.ambientLight.intensity = 0.95;
      ctx.dirLight.castShadow = false;
      ctx.dirLight.intensity = 0.3;
      ctx.rimLight.visible = false;
      if (ctx.groundShadow) ctx.groundShadow.visible = false;
      ctx.gridHelper.visible = false;
    } else {
      ctx.scene.background = new THREE.Color('#0a0a0f');
      ctx.ambientLight.intensity = isTechnical ? 0.8 : 0.5;
      ctx.dirLight.castShadow = !isTechnical;
      ctx.dirLight.intensity = isTechnical ? 0.6 : 1.2;
      ctx.rimLight.visible = !isTechnical;
      if (ctx.groundShadow) ctx.groundShadow.visible = !isTechnical;
      ctx.gridHelper.visible = !isTechnical;
    }

    for (const [, mesh] of ctx.binMeshes) {
      applyRenderMode(mesh, renderMode);
    }
    for (const [, edges] of ctx.binEdges) {
      edges.visible = isNonStandard;
      if (isTechnical) (edges.material as THREE.LineBasicMaterial).color.set(0x00d4aa);
      if (isBlueprint) (edges.material as THREE.LineBasicMaterial).color.set(0x222222);
    }
  }, [renderMode, bins]);

  // ── Section view ──
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    const { binMeshes, clipPlane, camera, controls } = ctx;

    if (sectionView && bins.length > 0) {
      const targetBin = bins.find((b) => b.id === selectedBinId) || bins[0];
      const { cx: binCx, cz: binCz, h: binH } = binWorldCenter(targetBin, gridCols, gridRows);
      clipPlane.set(new THREE.Vector3(0, 0, -1), binCz);

      for (const [, mesh] of binMeshes) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.clippingPlanes = [clipPlane];
        mat.clipShadows = true;
      }
      if (ctx.baseplateMesh) {
        (ctx.baseplateMesh.material as THREE.MeshStandardMaterial).clippingPlanes = [clipPlane];
      }
      if (!prevCameraRef.current) {
        prevCameraRef.current = { pos: camera.position.clone(), target: controls.target.clone() };
      }
      animateCamera(camera, controls,
        new THREE.Vector3(binCx, binH * 0.6, binCz + 200),
        new THREE.Vector3(binCx, binH * 0.4, binCz), 300);
    } else {
      for (const [, mesh] of binMeshes) {
        (mesh.material as THREE.MeshPhysicalMaterial).clippingPlanes = [];
      }
      if (ctx.baseplateMesh) {
        (ctx.baseplateMesh.material as THREE.MeshStandardMaterial).clippingPlanes = [];
      }
      if (prevCameraRef.current) {
        animateCamera(camera, controls,
          prevCameraRef.current.pos.clone(),
          prevCameraRef.current.target.clone(), 300);
        prevCameraRef.current = null;
      }
    }
  }, [sectionView, selectedBinId, bins, gridCols, gridRows]);

  // ── Update bin meshes via Web Worker ──
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    const { scene, binMeshes, binEdges, binWireframes, clipPlane } = ctx;
    const currentSectionView = useStore.getState().sectionView;
    const currentRenderMode = useStore.getState().renderMode;
    const isNonStandard = currentRenderMode !== 'standard';
    const currentIds = new Set(bins.map((b) => b.id));

    // Remove old
    for (const [id, mesh] of binMeshes) {
      if (!currentIds.has(id)) {
        scene.remove(mesh); mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose(); binMeshes.delete(id);
      }
    }
    for (const [id, edges] of binEdges) {
      if (!currentIds.has(id)) {
        scene.remove(edges); edges.geometry.dispose();
        (edges.material as THREE.Material).dispose(); binEdges.delete(id);
      }
    }
    for (const [id, wire] of binWireframes) {
      if (!currentIds.has(id)) {
        scene.remove(wire); wire.geometry.dispose();
        (wire.material as THREE.Material).dispose(); binWireframes.delete(id);
      }
    }

    bins.forEach((bin) => {
      const outerW = bin.w * GF.CELL_SIZE - GF.TOLERANCE;
      const outerD = bin.d * GF.CELL_SIZE - GF.TOLERANCE;
      const binTotalH = bin.h * GF.HEIGHT_UNIT + GF.BASE_TOTAL_HEIGHT;
      const cx = (bin.x + bin.w / 2) * GF.CELL_SIZE - (gridCols * GF.CELL_SIZE) / 2;
      const cz = (bin.y + bin.d / 2) * GF.CELL_SIZE - (gridRows * GF.CELL_SIZE) / 2;

      if (!binMeshes.has(bin.id) && !binWireframes.has(bin.id)) {
        const boxGeo = new THREE.BoxGeometry(outerW, binTotalH, outerD);
        const edges = new THREE.EdgesGeometry(boxGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: bin.color, opacity: 0.4, transparent: true });
        const wire = new THREE.LineSegments(edges, lineMat);
        wire.position.set(cx, binTotalH / 2, cz);
        scene.add(wire); binWireframes.set(bin.id, wire); boxGeo.dispose();
      }

      const config: BinConfig = {
        w: bin.w, d: bin.d, h: bin.h,
        cornerRadius: bin.cornerRadius, wallThickness: bin.wallThickness,
        bottomThickness: bin.bottomThickness, magnets: bin.magnets, screws: bin.screws,
        labelShelf: bin.labelShelf, labelWidth: bin.labelWidth,
        dividersX: bin.dividersX, dividersY: bin.dividersY,
      };

      requestBinMesh(bin.id, config, (result) => {
        const ctx2 = sceneRef.current;
        if (!ctx2) return;

        const pos = new Float32Array(result.positions);
        const idx = new Uint32Array(result.indices);
        for (let i = 0; i < pos.length; i += 3) {
          const y = pos[i + 1]; pos[i + 1] = pos[i + 2]; pos[i + 2] = y;
        }
        for (let i = 0; i < idx.length; i += 3) {
          const tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.computeVertexNormals();

        const latestBin = useStore.getState().bins.find((b) => b.id === bin.id);
        if (!latestBin) { geo.dispose(); return; }

        const latestCx = (latestBin.x + latestBin.w / 2) * GF.CELL_SIZE - (useStore.getState().gridCols * GF.CELL_SIZE) / 2;
        const latestCz = (latestBin.y + latestBin.d / 2) * GF.CELL_SIZE - (useStore.getState().gridRows * GF.CELL_SIZE) / 2;
        const latestSV = useStore.getState().sectionView;
        const latestRM = useStore.getState().renderMode;

        let mesh = ctx2.binMeshes.get(bin.id);
        if (mesh) {
          mesh.geometry.dispose(); mesh.geometry = geo;
          updateMeshMaterial(mesh, latestBin, latestRM, latestSV ? [ctx2.clipPlane] : []);
        } else {
          const mat = createBinMaterial(latestBin, latestRM, latestSV ? [ctx2.clipPlane] : []);
          mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = latestRM === 'standard'; mesh.receiveShadow = latestRM === 'standard';
          ctx2.scene.add(mesh); ctx2.binMeshes.set(bin.id, mesh);
        }
        mesh.position.set(latestCx, 0, latestCz);
        applySelection(mesh, bin.id === useStore.getState().selectedBinId);

        // Edge lines
        const showEdges = latestRM !== 'standard';
        const edgeColor = latestRM === 'blueprint' ? 0x222222 : 0x00d4aa;
        let edgeLine = ctx2.binEdges.get(bin.id);
        const edgesGeo = new THREE.EdgesGeometry(geo, 30);
        if (edgeLine) {
          edgeLine.geometry.dispose(); edgeLine.geometry = edgesGeo;
          (edgeLine.material as THREE.LineBasicMaterial).color.set(edgeColor);
        } else {
          edgeLine = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: edgeColor, linewidth: 2 }));
          edgeLine.visible = showEdges; ctx2.scene.add(edgeLine); ctx2.binEdges.set(bin.id, edgeLine);
        }
        edgeLine.position.copy(mesh.position); edgeLine.visible = showEdges;

        const wire = ctx2.binWireframes.get(bin.id);
        if (wire) { ctx2.scene.remove(wire); wire.geometry.dispose(); (wire.material as THREE.Material).dispose(); ctx2.binWireframes.delete(bin.id); }
      }, (err) => {
        console.warn('Worker mesh gen failed for', bin.id, err);
        // Fallback: keep the wireframe box placeholder visible
        const wire = ctx.binWireframes.get(bin.id);
        if (wire) {
          (wire.material as THREE.LineBasicMaterial).color.set(0xff4466);
          (wire.material as THREE.LineBasicMaterial).opacity = 0.6;
        }
      });

      const existingMesh = binMeshes.get(bin.id);
      if (existingMesh) {
        existingMesh.position.set(cx, 0, cz);
        updateMeshMaterial(existingMesh, bin, currentRenderMode, currentSectionView ? [clipPlane] : []);
        applySelection(existingMesh, bin.id === selectedBinId);
        existingMesh.castShadow = currentRenderMode === 'standard'; existingMesh.receiveShadow = currentRenderMode === 'standard';
      }
      const existingEdge = binEdges.get(bin.id);
      if (existingEdge) { existingEdge.position.set(cx, 0, cz); existingEdge.visible = isNonStandard; }
    });
  }, [bins, selectedBinId, gridCols, gridRows, renderMode]);

  // ── Baseplate ──
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    if (ctx.baseplateMesh) {
      ctx.scene.remove(ctx.baseplateMesh); ctx.baseplateMesh.geometry.dispose();
      (ctx.baseplateMesh.material as THREE.Material).dispose(); ctx.baseplateMesh = null;
    }
    if (showBaseplate) {
      const bpW = gridCols * GF.CELL_SIZE, bpD = gridRows * GF.CELL_SIZE, bpH = GF.BASEPLATE_HEIGHT;
      const geo = new THREE.BoxGeometry(bpW, bpH, bpD);
      const mat = new THREE.MeshStandardMaterial({ color: '#333340', roughness: 0.8, metalness: 0.05, transparent: true, opacity: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, -bpH / 2, 0); mesh.receiveShadow = true;
      ctx.scene.add(mesh); ctx.baseplateMesh = mesh;
    }
  }, [showBaseplate, gridCols, gridRows]);

  // ── Compute dimension label data for selected bin ──
  const dimLabels = useMemo(() => {
    if (!showDimensions || !selectedBinId) return [];
    const bin = bins.find((b) => b.id === selectedBinId);
    if (!bin) return [];

    const { cx, cz, h } = binWorldCenter(bin, gridCols, gridRows);
    const outerW = bin.w * GF.CELL_SIZE - GF.TOLERANCE;
    const outerD = bin.d * GF.CELL_SIZE - GF.TOLERANCE;

    return [
      { text: `${outerW.toFixed(1)}mm`, world: new THREE.Vector3(cx, 1, cz + outerD / 2 + 5) },
      { text: `${outerD.toFixed(1)}mm`, world: new THREE.Vector3(cx + outerW / 2 + 5, 1, cz) },
      { text: `${h.toFixed(1)}mm`, world: new THREE.Vector3(cx + outerW / 2 + 5, h / 2, cz + outerD / 2 + 5) },
    ];
  }, [showDimensions, selectedBinId, bins, gridCols, gridRows]);

  // Store labels for the animation loop to project
  dimRef.current.labels = dimLabels;

  const totalCells = gridCols * gridRows;
  const usedCells = bins.reduce((sum, b) => sum + b.w * b.d, 0);
  const plateMM = `${gridCols * GF.CELL_SIZE}x${gridRows * GF.CELL_SIZE}mm`;

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ background: 'var(--bg-primary)' }}>
      {/* Loading skeleton while scene initializes */}
      {!sceneReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ zIndex: 5 }}>
          <div className="skeleton" style={{ width: 200, height: 120 }} />
          <div className="skeleton" style={{ width: 140, height: 12 }} />
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Loading 3D viewport...</p>
        </div>
      )}

      {/* Dimension labels overlay */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }} />

      {/* Stats bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 py-1.5 text-[10px] pointer-events-none"
        style={{
          background: 'linear-gradient(transparent, rgba(10,10,15,0.85))',
          color: 'var(--text-secondary)',
          fontFamily: 'JetBrains Mono, monospace',
          zIndex: 3,
        }}
      >
        <span>{plateMM}</span>
        <span style={{ color: usedCells > 0 ? 'var(--accent)' : undefined }}>
          {usedCells}/{totalCells} cells
        </span>
        <span style={{ color: bins.length > 0 ? 'var(--accent)' : undefined }}>
          {bins.length} {bins.length === 1 ? 'bin' : 'bins'}
        </span>
      </div>
    </div>
  );
}

// ── Project world→screen and update overlay DOM each frame ──
function updateDimOverlay(ctx: SceneCtx, overlay: HTMLDivElement | null) {
  if (!overlay) return;
  const { showDimensions, selectedBinId, bins, gridCols, gridRows } = useStore.getState();

  if (!showDimensions || !selectedBinId) {
    if (overlay.childNodes.length > 0) overlay.innerHTML = '';
    return;
  }

  const bin = bins.find((b) => b.id === selectedBinId);
  if (!bin) { overlay.innerHTML = ''; return; }

  const { cx, cz, h } = binWorldCenter(bin, gridCols, gridRows);
  const outerW = bin.w * GF.CELL_SIZE - GF.TOLERANCE;
  const outerD = bin.d * GF.CELL_SIZE - GF.TOLERANCE;

  const labels = [
    { text: `${outerW.toFixed(1)}mm`, world: new THREE.Vector3(cx, 1, cz + outerD / 2 + 5) },
    { text: `${outerD.toFixed(1)}mm`, world: new THREE.Vector3(cx + outerW / 2 + 5, 1, cz) },
    { text: `${h.toFixed(1)}mm`, world: new THREE.Vector3(cx + outerW / 2 + 5, h / 2, cz + outerD / 2 + 5) },
  ];

  const w = ctx.renderer.domElement.clientWidth;
  const ht = ctx.renderer.domElement.clientHeight;

  // Ensure we have the right number of label elements
  while (overlay.childNodes.length > labels.length) overlay.removeChild(overlay.lastChild!);
  while (overlay.childNodes.length < labels.length) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      background: 'rgba(0,212,170,0.92)',
      color: '#0a0a0f',
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '10px',
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: '600',
      whiteSpace: 'nowrap',
      lineHeight: '1.3',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    });
    overlay.appendChild(el);
  }

  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    const el = overlay.childNodes[i] as HTMLDivElement;
    el.textContent = lbl.text;

    // Project 3D → 2D
    const v = lbl.world.clone().project(ctx.camera);
    const sx = (v.x * 0.5 + 0.5) * w;
    const sy = (-v.y * 0.5 + 0.5) * ht;
    const behind = v.z > 1;

    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.display = behind ? 'none' : '';
  }
}

// ── Material helpers ──
type RenderMode = 'standard' | 'technical' | 'blueprint';

function createBinMaterial(bin: Bin, mode: RenderMode, clippingPlanes: THREE.Plane[]): THREE.MeshPhysicalMaterial {
  if (mode === 'technical') {
    return new THREE.MeshPhysicalMaterial({
      color: bin.color, transparent: true, opacity: 0.2,
      roughness: 1, metalness: 0, clearcoat: 0,
      side: THREE.DoubleSide, depthWrite: false, clippingPlanes, clipShadows: true,
    });
  }
  if (mode === 'blueprint') {
    return new THREE.MeshPhysicalMaterial({
      color: 0xf0f0f0, roughness: 1.0, metalness: 0, clearcoat: 0,
      side: THREE.DoubleSide, clippingPlanes, clipShadows: true,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: bin.color, roughness: 0.45, metalness: 0.05,
    clearcoat: 0.3, clearcoatRoughness: 0.4,
    side: THREE.DoubleSide, clippingPlanes, clipShadows: true,
  });
}

function updateMeshMaterial(mesh: THREE.Mesh, bin: Bin, mode: RenderMode, clippingPlanes: THREE.Plane[]) {
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  mat.clippingPlanes = clippingPlanes;
  if (mode === 'technical') {
    mat.color.set(bin.color);
    mat.transparent = true; mat.opacity = 0.2; mat.roughness = 1;
    mat.metalness = 0; mat.clearcoat = 0; mat.depthWrite = false;
  } else if (mode === 'blueprint') {
    mat.color.set(0xf0f0f0);
    mat.transparent = false; mat.opacity = 1.0; mat.roughness = 1.0;
    mat.metalness = 0; mat.clearcoat = 0; mat.depthWrite = true;
  } else {
    mat.color.set(bin.color);
    mat.transparent = false; mat.opacity = 1.0; mat.roughness = 0.45;
    mat.metalness = 0.05; mat.clearcoat = 0.3; mat.clearcoatRoughness = 0.4; mat.depthWrite = true;
  }
  mat.needsUpdate = true;
}

function applyRenderMode(mesh: THREE.Mesh, mode: RenderMode) {
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  if (mode === 'technical') {
    mat.transparent = true; mat.opacity = 0.2; mat.roughness = 1;
    mat.clearcoat = 0; mat.depthWrite = false;
  } else if (mode === 'blueprint') {
    mat.color.set(0xf0f0f0);
    mat.transparent = false; mat.opacity = 1.0; mat.roughness = 1.0;
    mat.metalness = 0; mat.clearcoat = 0; mat.depthWrite = true;
  } else {
    mat.transparent = false; mat.opacity = 1.0; mat.roughness = 0.45;
    mat.metalness = 0.05; mat.clearcoat = 0.3; mat.clearcoatRoughness = 0.4; mat.depthWrite = true;
  }
  mat.needsUpdate = true;
  mesh.castShadow = mode === 'standard'; mesh.receiveShadow = mode === 'standard';
}

function applySelection(mesh: THREE.Mesh, isSelected: boolean) {
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  mat.emissive.set(isSelected ? 0x004433 : 0x000000);
  mat.emissiveIntensity = isSelected ? 2.0 : 0;
}
