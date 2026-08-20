import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { CONTAINER_TYPES, dimsOf } from '../domain/dimensions';
import { centerOf, rotationRadians } from '../domain/geometry';
import type { Container, ContainerType } from '../domain/types';
import { EDGE_COLOR, ROLE_COLOR, SELECTED_COLOR, VIOLATION_COLOR } from './palette';

export interface InstancedContainersProps {
  containers: Container[];
  selectedIds: string[];
  flaggedIds: Set<string>;
  showEdges: boolean;
  onSelect(id: string, additive: boolean): void;
}

const dummy = new THREE.Object3D();
const colorScratch = new THREE.Color();

/**
 * Every container of one type drawn in a single draw call.
 *
 * Above roughly fifty boxes, one mesh each is the wrong shape: the draw calls
 * dominate and the frame rate falls off a cliff around eighty. An
 * InstancedMesh per type holds a whole property at sixty frames, and the
 * outlines come along as one merged LineSegments rather than one per box,
 * which is the other half of the same problem.
 */
function TypeInstances({
  type,
  containers,
  selectedIds,
  flaggedIds,
  onSelect,
}: {
  type: ContainerType;
  containers: Container[];
  selectedIds: string[];
  flaggedIds: Set<string>;
  onSelect(id: string, additive: boolean): void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const subset = useMemo(() => containers.filter((c) => c.type === type), [containers, type]);
  const d = dimsOf(type);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    subset.forEach((c, i) => {
      const centre = centerOf(c);
      dummy.position.set(centre.x, centre.y, centre.z);
      dummy.rotation.set(0, rotationRadians(c.rotation), 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);

      const selected = selectedIds.includes(c.id);
      const flagged = flaggedIds.has(c.id);
      colorScratch.set(
        flagged ? VIOLATION_COLOR : selected ? SELECTED_COLOR : ROLE_COLOR[c.role],
      );
      m.setColorAt(i, colorScratch);
    });
    m.count = subset.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [subset, selectedIds, flaggedIds]);

  if (subset.length === 0) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined) return;
    const hit = subset[e.instanceId];
    if (!hit) return;
    e.stopPropagation();
    onSelect(hit.id, e.shiftKey);
  };

  return (
    <instancedMesh
      ref={mesh}
      // The key forces a fresh buffer when the count grows; instanced meshes
      // cannot be resized in place.
      key={`${type}-${subset.length}`}
      args={[undefined, undefined, subset.length]}
      castShadow
      receiveShadow
      onClick={handleClick}
    >
      <boxGeometry args={[d.length, d.height, d.width]} />
      <meshStandardMaterial roughness={0.72} metalness={0.12} />
    </instancedMesh>
  );
}

/** Every container outline as one merged line buffer. */
function MergedEdges({ containers }: { containers: Container[] }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const c of containers) {
      const centre = centerOf(c);
      const d = dimsOf(c.type);
      const hx = d.length / 2;
      const hy = d.height / 2;
      const hz = d.width / 2;
      const angle = rotationRadians(c.rotation);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const local: [number, number, number][] = [];
      for (const sx of [-hx, hx])
        for (const sy of [-hy, hy])
          for (const sz of [-hz, hz]) local.push([sx, sy, sz]);

      // Rotating about Y sends (x, z) to (x cos + z sin, -x sin + z cos).
      const world = local.map(([x, y, z]) => [
        centre.x + x * cos + z * sin,
        centre.y + y,
        centre.z - x * sin + z * cos,
      ]);

      // Indices into the 2x2x2 corner ordering above.
      const edges: [number, number][] = [
        [0, 1], [2, 3], [4, 5], [6, 7],
        [0, 2], [1, 3], [4, 6], [5, 7],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      for (const [a, e] of edges) {
        positions.push(...(world[a] as number[]), ...(world[e] as number[]));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [containers]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.55} />
    </lineSegments>
  );
}

export function InstancedContainers({
  containers,
  selectedIds,
  flaggedIds,
  showEdges,
  onSelect,
}: InstancedContainersProps) {
  return (
    <group>
      {CONTAINER_TYPES.map((type) => (
        <TypeInstances
          key={type}
          type={type}
          containers={containers}
          selectedIds={selectedIds}
          flaggedIds={flaggedIds}
          onSelect={onSelect}
        />
      ))}
      {showEdges && <MergedEdges containers={containers} />}
    </group>
  );
}
