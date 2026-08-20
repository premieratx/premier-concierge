import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { runAllChecks } from '../rules';
import { useLayoutStore } from '../store/useLayoutStore';
import { CAMERA_PRESETS, DEFAULT_PRESET } from './cameraPresets';
import { DecorMeshes } from './DecorMeshes';
import { Dragon } from './Dragon';
import { FirePits } from './FirePits';
import { InstancedContainers } from './InstancedContainers';
import { Lighting } from './Lighting';
import { Marina } from './Marina';
import { Stages } from './Stages';
import { StringLightsMesh } from './StringLightsMesh';
import { Terrain } from './Ground';
import { featuresOfKind } from '../domain/types';

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
  const showEdges = useLayoutStore((s) => s.showEdges);
  const layers = useLayoutStore((s) => s.layers);
  const timeOfDay = useLayoutStore((s) => s.timeOfDay);
  const select = useLayoutStore((s) => s.select);

  const night = timeOfDay !== 'day';

  const checks = useMemo(() => runAllChecks(layout), [layout]);

  const visibleContainers = useMemo(
    () =>
      layout.containers.filter((c) => {
        const zone = c.zone ?? 'castle';
        if (zone === 'lodging') return layers.lodging;
        return layers.castle;
      }),
    [layout.containers, layers.castle, layers.lodging],
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
        showEdges={showEdges}
        onSelect={(id, additive) => select(id, additive)}
      />

      {layers.decor && <DecorMeshes decor={layout.decor} />}
      {layers.marina && <Marina layout={layout} />}
      {layers.stages && <Stages layout={layout} night={night} />}
      {layers.fire && <FirePits layout={layout} night={night} />}
      {layers.lights && <StringLightsMesh layout={layout} night={night} />}
      {layers.dragon &&
        dragons.map((d) => <Dragon key={d.id} feature={d} night={night} />)}
    </group>
  );
}

export function Scene() {
  const select = useLayoutStore((s) => s.select);
  const timeOfDay = useLayoutStore((s) => s.timeOfDay);
  const cameraPreset = useLayoutStore((s) => s.cameraPreset);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      camera={{ position: DEFAULT_PRESET.position, fov: 48, near: 1, far: 60000 }}
      onPointerMissed={() => select(null)}
    >
      <ScreenshotBridge />
      <Lighting timeOfDay={timeOfDay} />
      <PropertyModel />
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
    </Canvas>
  );
}
