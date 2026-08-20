import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { featuresOfKind } from '../domain/types';
import type { Layout } from '../domain/types';

const dummy = new THREE.Object3D();
const scratch = new THREE.Color();

interface Bulb {
  position: [number, number, number];
  hue: number;
  rainbow: boolean;
  /** Position along its run, 0..1, so a rainbow run reads as a gradient. */
  t: number;
}

/**
 * Party lights: every bulb on the property in one instanced draw, hung on a
 * catenary between its two posts.
 *
 * A straight line between posts reads as wire. The sag is what makes it read
 * as festoon lighting, and it costs one cosine.
 */
export function StringLightsMesh({ layout, night }: { layout: Layout; night: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const bulbs = useMemo<Bulb[]>(() => {
    const out: Bulb[] = [];
    for (const run of featuresOfKind(layout.features, 'stringLights')) {
      const dx = run.to.x - run.from.x;
      const dy = run.to.y - run.from.y;
      const dz = run.to.z - run.from.z;
      const span = Math.hypot(dx, dy, dz);
      const count = Math.max(2, Math.round(span / run.bulbSpacingFt));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        // A parabola is close enough to a catenary at these spans and is a
        // great deal cheaper to evaluate.
        const sag = run.sagFt * 4 * t * (1 - t);
        out.push({
          position: [run.from.x + dx * t, run.from.y + dy * t - sag, run.from.z + dz * t],
          hue: run.hue ?? 38,
          rainbow: run.rainbow,
          t,
        });
      }
    }
    return out;
  }, [layout.features]);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false }),
    [],
  );

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    bulbs.forEach((b, i) => {
      dummy.position.set(...b.position);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = bulbs.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [bulbs]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const time = state.clock.elapsedTime;
    const brightness = night ? 1 : 0.35;
    bulbs.forEach((b, i) => {
      const hue = b.rainbow ? b.hue + b.t * 160 + time * 26 : b.hue;
      const twinkle = 0.86 + 0.14 * Math.sin(time * 3.1 + i * 0.7);
      scratch.setHSL(
        (((hue % 360) + 360) % 360) / 360,
        b.rainbow ? 0.85 : 0.55,
        Math.min(0.95, 0.62 * brightness * twinkle + 0.12),
      );
      m.setColorAt(i, scratch);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  if (bulbs.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      key={bulbs.length}
      args={[undefined, undefined, bulbs.length]}
      material={material}
    >
      <sphereGeometry args={[0.42, 8, 8]} />
    </instancedMesh>
  );
}
