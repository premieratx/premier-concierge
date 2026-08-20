import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Decor, DecorKind } from '../domain/types';

const dummy = new THREE.Object3D();

const DECOR_COLOR: Record<DecorKind, string> = {
  merlon: '#8d8577',
  parapet: '#7d7669',
  bartizan: '#8d8577',
  conicalRoof: '#4c4a52',
  batter: '#6f6659',
  truss: '#3f434a',
  walkway: '#6a5a45',
  banner: '#8c2f39',
  archStone: '#98907f',
  gate: '#3f3227',
  deck: '#7d6647',
  shedRoof: '#4a4d51',
  post: '#5b4c3a',
  tent: '#d8cfbc',
  pergola: '#6a5a45',
};

const ROUGHNESS: Partial<Record<DecorKind, number>> = {
  truss: 0.45,
  conicalRoof: 0.5,
  shedRoof: 0.5,
  tent: 0.95,
};

const METALNESS: Partial<Record<DecorKind, number>> = {
  truss: 0.8,
  conicalRoof: 0.6,
  shedRoof: 0.55,
};

/** Kinds drawn as boxes, which is most of them and all the numerous ones. */
const BOX_KINDS: DecorKind[] = [
  'merlon',
  'parapet',
  'truss',
  'walkway',
  'banner',
  'archStone',
  'gate',
  'deck',
  'shedRoof',
  'post',
  'pergola',
  'batter',
];

function materialFor(kind: DecorKind): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: DECOR_COLOR[kind],
    roughness: ROUGHNESS[kind] ?? 0.9,
    metalness: METALNESS[kind] ?? 0.05,
  });
}

/**
 * All decor of one kind in a single instanced draw.
 *
 * A crenellated property runs to several hundred merlons on its own, so these
 * have to be instanced for the same reason the containers do.
 */
function BoxKind({ kind, items }: { kind: DecorKind; items: Decor[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => materialFor(kind), [kind]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    items.forEach((d, i) => {
      dummy.position.set(d.center.x, d.center.y, d.center.z);
      dummy.rotation.set(0, d.rotationY ?? 0, 0);
      // A battered panel leans outward about its own long axis; the tilt has
      // to be applied after the heading, hence the explicit order.
      if (d.slope) dummy.rotateX(d.slope);
      dummy.scale.set(d.size.x, d.size.y, d.size.z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      key={`${kind}-${items.length}`}
      args={[undefined, undefined, items.length]}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function CylinderKind({ items }: { items: Decor[] }) {
  const material = useMemo(() => materialFor('bartizan'), []);
  return (
    <group>
      {items.map((d) => (
        <mesh
          key={d.id}
          position={[d.center.x, d.center.y, d.center.z]}
          material={material}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[d.radius ?? 4, d.radius ?? 4, d.size.y, 14]} />
        </mesh>
      ))}
    </group>
  );
}

function ConeKind({ items }: { items: Decor[] }) {
  const material = useMemo(() => materialFor('conicalRoof'), []);
  return (
    <group>
      {items.map((d) => (
        <mesh
          key={d.id}
          position={[d.center.x, d.center.y, d.center.z]}
          material={material}
          castShadow
        >
          <coneGeometry args={[d.radius ?? 4.5, d.size.y, 14]} />
        </mesh>
      ))}
    </group>
  );
}

function TentKind({ items }: { items: Decor[] }) {
  const material = useMemo(() => materialFor('tent'), []);
  return (
    <group>
      {items.map((d) => (
        <mesh
          key={d.id}
          position={[d.center.x, d.center.y, d.center.z]}
          material={material}
          castShadow
          receiveShadow
        >
          {/* A four-sided cone is a bell tent from any useful distance. */}
          <coneGeometry args={[d.size.x * 0.62, d.size.y, 4]} />
        </mesh>
      ))}
    </group>
  );
}

export function DecorMeshes({ decor }: { decor: Decor[] }) {
  const byKind = useMemo(() => {
    const map = new Map<DecorKind, Decor[]>();
    for (const d of decor) {
      const list = map.get(d.kind);
      if (list) list.push(d);
      else map.set(d.kind, [d]);
    }
    return map;
  }, [decor]);

  return (
    <group>
      {BOX_KINDS.map((kind) => (
        <BoxKind key={kind} kind={kind} items={byKind.get(kind) ?? []} />
      ))}
      <CylinderKind items={byKind.get('bartizan') ?? []} />
      <ConeKind items={byKind.get('conicalRoof') ?? []} />
      <TentKind items={byKind.get('tent') ?? []} />
    </group>
  );
}
