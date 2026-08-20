import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { runAllChecks } from '../rules';
import { useLayoutStore, type TimeOfDay } from '../store/useLayoutStore';
import { CAMERA_PRESETS, DEFAULT_PRESET } from './cameraPresets';
import { KEEP_CLEAR } from '../domain/property';
import { CapacityLabels } from './CapacityLabels';
import { Contours, TerraceOutlines } from './Contours';
import { DecorMeshes } from './DecorMeshes';
import { Effects } from './Effects';
import { HexMarina } from './HexMarina';
import { People } from './People';
import { Vegetation } from './Vegetation';
import { WalkControls } from './WalkControls';
import { SceneEnvironment } from './Environment';
import { Dragon } from './Dragon';
import { FirePits } from './FirePits';
import { InstancedContainers } from './InstancedContainers';
import { Lighting } from './Lighting';
import { Marina } from './Marina';
import { Stages } from './Stages';
import { StringLightsMesh } from './StringLightsMesh';
import { Terrain } from './Ground';
import { featuresOfKind, layerOfContainer, layerOfDecor } from '../domain/types';

/** Set by the canvas so the toolbar can grab a frame without a context. */
let capture: (() => string | null) | null = null;

export function captureScreenshot(): string | null {
  return capture ? capture() : null;
}

function ScreenshotBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    capture = () => {
      // Re-render immediately before reading: the drawing buffer is not
      // preserved between frames, so a stale read comes back blank.
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    };
    return () => {
      capture = null;
    };
  }, [gl, scene, camera]);

  return null;
}

/** Eases the camera to whichever preset is selected. */
function CameraRig({ presetKey }: { presetKey: string }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const first = useRef(true);

  useEffect(() => {
    const preset = CAMERA_PRESETS.find((p) => p.key === presetKey) ?? DEFAULT_PRESET;
    const target = new THREE.Vector3(...preset.target);
    const position = new THREE.Vector3(...preset.position);

    if (first.current || !controls) {
      camera.position.copy(position);
      if (controls) {
        controls.target.copy(target);
        controls.update();
      }
      first.current = false;
      return;
    }

    // A short manual tween keeps the move legible without pulling in an
    // animation library for one transition.
    const from = camera.position.clone();
    const fromTarget = controls.target.clone();
    const start = performance.now();
    const duration = 900;
    let frame = 0;

    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      camera.position.lerpVectors(from, position, eased);
      controls.target.lerpVectors(fromTarget, target, eased);
      controls.update();
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [presetKey, camera, controls]);

  return null;
}

function PropertyModel() {
  const layout = useLayoutStore((s) => s.layout);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const layers = useLayoutStore((s) => s.layers);
  const timeOfDay = useLayoutStore((s) => s.timeOfDay);
  const select = useLayoutStore((s) => s.select);

  const night = timeOfDay !== 'day';

  const checks = useMemo(() => runAllChecks(layout), [layout]);

  const visibleContainers = useMemo(
    () => layout.containers.filter((c) => layers[layerOfContainer(c)]),
    [layout.containers, layers],
  );

  const visibleDecor = useMemo(
    () => layout.decor.filter((d) => layers[layerOfDecor(d)]),
    [layout.decor, layers],
  );

  const dragons = featuresOfKind(layout.features, 'dragon');

  return (
    <group>
      <Terrain
        site={layout.site}
        timeOfDay={timeOfDay}
        showWater={layers.water}
        showGrid={layers.grid}
      />

      <InstancedContainers
        containers={visibleContainers}
        selectedIds={selectedIds}
        flaggedIds={checks.errorContainerIds}
        showEdges={layers.edges}
        onSelect={(id, additive) => select(id, additive)}
      />

      <DecorMeshes decor={visibleDecor} />
      <Marina layout={layout} layers={layers} />
      <HexMarina layout={layout} layers={layers} />
      <Stages layout={layout} night={night} layers={layers} />
      {layers.firePits && <FirePits layout={layout} night={night} />}
      {layers.stringLights && <StringLightsMesh layout={layout} night={night} />}
      {layers.dragon &&
        dragons.map((d) => (
          <Dragon key={d.id} feature={d} night={night} showFire={layers.dragonFire} />
        ))}
      {layers.contours && <Contours />}
      {layers.terraces && <TerraceOutlines />}
      {layers.trees && <Vegetation exclusions={KEEP_CLEAR} />}
      {layers.people && <People layout={layout} layers={layers} />}
      {layers.capacity && <CapacityLabels layout={layout} layers={layers} />}
    </group>
  );
}

/**
 * How much the procedural environment contributes at each time of day. Metals
 * need something to reflect even at night, or they go black.
 */
const ENVIRONMENT_INTENSITY: Record<TimeOfDay, number> = {
  day: 0.55,
  dusk: 0.32,
  night: 0.16,
};

export function Scene() {
  const select = useLayoutStore((s) => s.select);
  const timeOfDay = useLayoutStore((s) => s.timeOfDay);
  const cameraPreset = useLayoutStore((s) => s.cameraPreset);
  const mode = useLayoutStore((s) => s.mode);
  const site = useLayoutStore((s) => s.layout.site);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      // ACES maps anything over about 1.0 to white, and an unexposed sky sits
      // well over it — the daytime sky was rendering as a flat white sheet.
      gl={{ antialias: true, preserveDrawingBuffer: false, toneMappingExposure: 0.8 }}
      camera={{ position: DEFAULT_PRESET.position, fov: 48, near: 1, far: 60000 }}
      onPointerMissed={() => select(null)}
    >
      <ScreenshotBridge />
      <SceneEnvironment intensity={ENVIRONMENT_INTENSITY[timeOfDay]} />
      <Lighting timeOfDay={timeOfDay} />
      <PropertyModel />
      {mode === 'walk' ? (
        <WalkControls site={site} />
      ) : (
        <>
          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2 - 0.015}
            minDistance={18}
            maxDistance={2400}
            enableDamping
            dampingFactor={0.08}
            target={DEFAULT_PRESET.target}
          />
          <CameraRig presetKey={cameraPreset} />
        </>
      )}
      <Effects timeOfDay={timeOfDay} />
    </Canvas>
  );
}
