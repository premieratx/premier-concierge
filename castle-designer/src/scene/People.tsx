import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { propertyAreas, USE_COLOR } from '../domain/areas';
import type { Layout, ModelLayer } from '../domain/types';

const dummy = new THREE.Object3D();
const scratch = new THREE.Color();

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** One figure in a crowd, drawn at roughly five foot eight. */
interface Figure {
  x: number;
  y: number;
  z: number;
  facing: number;
  height: number;
  /** Colour taken from the area's occupancy use, so a crowd reads as its area. */
  color: string;
  /** Phase offset for the idle sway. */
  seed: number;
}

/** Show one figure per this many occupants, so a full house stays legible. */
const CROWD_DIVISOR = 16;
const MAX_PER_AREA = 44;

const SHIRT = ['#b9b3a8', '#8d9aa8', '#a68d6d', '#7f8f7a', '#a8837c', '#6f7c8c', '#3f4750'];

export interface PeopleProps {
  layout: Layout;
  layers: Record<ModelLayer, boolean>;
}

/**
 * People, sampled from the occupancy model.
 *
 * One figure per sixteen occupants, scattered across each area at its own
 * standing level. This is the only thing in the model that gives it scale —
 * a forty-foot container reads as a box until somebody is standing next to
 * it — and it makes the capacity numbers physical instead of abstract.
 */
export function People({ layout, layers }: PeopleProps) {
  const figures = useMemo<Figure[]>(() => {
    const out: Figure[] = [];
    for (const area of propertyAreas(layout)) {
      if (!layers[area.layer]) continue;
      // Nobody stands on a finger pier for the view, and beds are not a crowd.
      if (area.use === 'lodging') continue;
      const count = Math.min(MAX_PER_AREA, Math.round(area.capacity / CROWD_DIVISOR));
      if (count <= 0) continue;

      const random = mulberry32(hash(area.id));
      for (let i = 0; i < count; i++) {
        // Square-rooted radius keeps the scatter even rather than clustered
        // at the centre, which is what a uniform radius would give.
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * area.spreadFt;
        out.push({
          x: area.anchor.x + Math.cos(angle) * radius,
          y: area.groundY,
          z: area.anchor.z + Math.sin(angle) * radius,
          facing: random() * Math.PI * 2,
          height: 5.2 + random() * 0.9,
          color: random() < 0.35 ? USE_COLOR[area.use] : (SHIRT[Math.floor(random() * SHIRT.length)] ?? SHIRT[0]!),
          seed: random() * 10,
        });
      }
    }
    return out;
  }, [layout, layers]);

  const bodyMesh = useRef<THREE.InstancedMesh>(null);
  const headMesh = useRef<THREE.InstancedMesh>(null);

  const materials = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88 }),
      head: new THREE.MeshStandardMaterial({ color: '#a8825f', roughness: 0.85 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.body.dispose();
      materials.head.dispose();
    },
    [materials],
  );

  useLayoutEffect(() => {
    const body = bodyMesh.current;
    const head = headMesh.current;
    if (!body || !head) return;

    figures.forEach((f, i) => {
      const bodyHeight = f.height * 0.78;
      dummy.position.set(f.x, f.y + bodyHeight / 2, f.z);
      dummy.rotation.set(0, f.facing, 0);
      dummy.scale.set(1, bodyHeight / 2, 1);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      scratch.set(f.color);
      body.setColorAt(i, scratch);

      dummy.position.set(f.x, f.y + f.height - 0.42, f.z);
      dummy.rotation.set(0, f.facing, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    });

    body.count = figures.length;
    head.count = figures.length;
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    body.computeBoundingSphere();
    head.computeBoundingSphere();
  }, [figures]);

  useFrame((state) => {
    const body = bodyMesh.current;
    if (!body || figures.length === 0) return;
    // A slow sway. Static figures read as bollards; moving ones read as people,
    // and this is two trig calls per figure rather than a skeleton each.
    const t = state.clock.elapsedTime;
    figures.forEach((f, i) => {
      const bodyHeight = f.height * 0.78;
      dummy.position.set(f.x, f.y + bodyHeight / 2, f.z);
      dummy.rotation.set(0, f.facing + 0.16 * Math.sin(t * 0.7 + f.seed), 0);
      dummy.scale.set(1, bodyHeight / 2, 1);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
  });

  if (figures.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={bodyMesh}
        key={`body-${figures.length}`}
        args={[undefined, undefined, figures.length]}
        material={materials.body}
        castShadow
      >
        <capsuleGeometry args={[0.62, 1, 4, 8]} />
      </instancedMesh>
      <instancedMesh
        ref={headMesh}
        key={`head-${figures.length}`}
        args={[undefined, undefined, figures.length]}
        material={materials.head}
        castShadow
      >
        <sphereGeometry args={[0.46, 8, 8]} />
      </instancedMesh>
    </group>
  );
}
