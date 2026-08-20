import { Edges } from '@react-three/drei';
import { dimsOf } from '../domain/dimensions';
import { centerOf, rotationRadians } from '../domain/geometry';
import type { Container } from '../domain/types';
import {
  EDGE_COLOR,
  ROLE_COLOR,
  SELECTED_COLOR,
  SELECTED_EDGE_COLOR,
  VIOLATION_COLOR,
} from './palette';

export interface ContainerMeshProps {
  container: Container;
  selected: boolean;
  /** Drawn red — currently means "overlaps another container". */
  violating: boolean;
  showEdges: boolean;
  onSelect(id: string): void;
}

/**
 * One container as a correctly dimensioned box.
 *
 * Above roughly fifty containers this should become an InstancedMesh per type
 * with a single merged LineSegments for the outlines; per-mesh Edges falls over
 * somewhere around eighty units. Phase 1 layouts are small enough that the
 * simple path is the right one.
 */
export function ContainerMesh({
  container,
  selected,
  violating,
  showEdges,
  onSelect,
}: ContainerMeshProps) {
  const d = dimsOf(container.type);
  const c = centerOf(container);

  const color = violating
    ? VIOLATION_COLOR
    : selected
      ? SELECTED_COLOR
      : ROLE_COLOR[container.role];

  return (
    <mesh
      position={[c.x, c.y, c.z]}
      rotation={[0, rotationRadians(container.rotation), 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect(container.id);
      }}
    >
      {/* Local frame: length along X, height along Y, width along Z. */}
      <boxGeometry args={[d.length, d.height, d.width]} />
      <meshStandardMaterial
        color={color}
        roughness={container.finish === 'stone' ? 0.95 : 0.6}
        metalness={container.finish === 'stone' ? 0.0 : 0.15}
      />
      {showEdges && (
        <Edges
          linewidth={selected ? 2 : 1}
          color={selected ? SELECTED_EDGE_COLOR : EDGE_COLOR}
        />
      )}
    </mesh>
  );
}
