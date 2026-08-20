import { useMemo } from 'react';
import * as THREE from 'three';
import { featuresOfKind } from '../domain/types';
import type { Layout, ModelLayer, StageRoof } from '../domain/types';

function useStageMaterials() {
  return useMemo(
    () => ({
      deck: new THREE.MeshStandardMaterial({ color: '#4a4033', roughness: 0.9 }),
      skirt: new THREE.MeshStandardMaterial({ color: '#23201c', roughness: 0.95 }),
      truss: new THREE.MeshStandardMaterial({ color: '#3d4147', metalness: 0.8, roughness: 0.4 }),
      roof: new THREE.MeshStandardMaterial({
        color: '#2c3138',
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
      speaker: new THREE.MeshStandardMaterial({ color: '#181a1d', roughness: 0.85 }),
      backdrop: new THREE.MeshStandardMaterial({ color: '#5d4b3a', roughness: 0.9 }),
    }),
    [],
  );
}

type Materials = ReturnType<typeof useStageMaterials>;

const STAGE_LIGHT_COLORS = ['#ff2f6d', '#2fd0ff', '#ffd12f', '#7c3cff'];

interface StageBodyProps {
  widthFt: number;
  depthFt: number;
  heightFt: number;
  roof: StageRoof;
  m: Materials;
  night: boolean;
}

/**
 * A small stage: deck, skirt, a truss goalpost with a light bar, and a pair of
 * speaker stacks. Enough to read as a stage from anywhere on the property
 * without pretending to be a lighting plot.
 */
function StageBody({ widthFt, depthFt, heightFt, roof, m, night }: StageBodyProps) {
  const postHeight = 16;
  const half = widthFt / 2;

  return (
    <group>
      <mesh position={[0, heightFt - 0.3, 0]} material={m.deck} castShadow receiveShadow>
        <boxGeometry args={[widthFt, 0.6, depthFt]} />
      </mesh>
      <mesh position={[0, (heightFt - 0.6) / 2, 0]} material={m.skirt}>
        <boxGeometry args={[widthFt - 0.5, heightFt - 0.6, depthFt - 0.5]} />
      </mesh>

      {roof === 'container' && (
        <mesh position={[0, heightFt + 10, -depthFt / 2 + 1]} material={m.backdrop} castShadow>
          <boxGeometry args={[widthFt + 4, 9.5, 8]} />
        </mesh>
      )}

      {/* Truss goalpost. */}
      {[1, -1].map((side) => (
        <mesh
          key={`post-${side}`}
          position={[side * half, heightFt + postHeight / 2, -depthFt / 2 + 0.8]}
          material={m.truss}
          castShadow
        >
          <boxGeometry args={[1.1, postHeight, 1.1]} />
        </mesh>
      ))}
      <mesh
        position={[0, heightFt + postHeight, -depthFt / 2 + 0.8]}
        material={m.truss}
        castShadow
      >
        <boxGeometry args={[widthFt + 1.1, 1.1, 1.1]} />
      </mesh>

      {roof === 'truss' && (
        <mesh position={[0, heightFt + postHeight + 1.6, 0]} material={m.roof} castShadow>
          <boxGeometry args={[widthFt + 5, 0.3, depthFt + 5]} />
        </mesh>
      )}

      {/* Light bar. Emissive fixtures plus a couple of real spots at night. */}
      {STAGE_LIGHT_COLORS.map((color, i) => {
        const x = -half + (widthFt * (i + 0.5)) / STAGE_LIGHT_COLORS.length;
        return (
          <group key={color} position={[x, heightFt + postHeight - 1.2, -depthFt / 2 + 0.8]}>
            <mesh>
              <sphereGeometry args={[0.55, 10, 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            {night && i % 2 === 0 && (
              <pointLight color={color} intensity={45} distance={70} decay={2} />
            )}
          </group>
        );
      })}

      {[1, -1].map((side) => (
        <mesh
          key={`stack-${side}`}
          position={[side * (half + 2.6), heightFt + 4.5, -depthFt / 4]}
          material={m.speaker}
          castShadow
        >
          <boxGeometry args={[3, 9, 3]} />
        </mesh>
      ))}
    </group>
  );
}

export function Stages({
  layout,
  night,
  layers,
}: {
  layout: Layout;
  night: boolean;
  layers: Record<ModelLayer, boolean>;
}) {
  const m = useStageMaterials();
  const stages = featuresOfKind(layout.features, 'stage');
  const overwater = featuresOfKind(layout.features, 'overwaterStage');

  return (
    <group>
      {layers.stages && stages.map((s) => (
        <group key={s.id} position={[s.position.x, s.position.y, s.position.z]} rotation={[0, s.rotationY, 0]}>
          <StageBody
            widthFt={s.widthFt}
            depthFt={s.depthFt}
            heightFt={s.heightFt}
            roof={s.roof}
            m={m}
            night={night}
          />
        </group>
      ))}

      {layers.overwaterStage && overwater.map((s) => (
        <group key={s.id} position={[s.position.x, s.position.y, s.position.z]} rotation={[0, s.rotationY, 0]}>
          {/* Pilings, because this one is standing in the lake. */}
          {[
            [-s.widthFt / 2 + 2, -s.depthFt / 2 + 2],
            [s.widthFt / 2 - 2, -s.depthFt / 2 + 2],
            [-s.widthFt / 2 + 2, s.depthFt / 2 - 2],
            [s.widthFt / 2 - 2, s.depthFt / 2 - 2],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x!, -6, z!]} material={m.truss} castShadow>
              <cylinderGeometry args={[0.8, 0.8, 22, 8]} />
            </mesh>
          ))}
          <StageBody
            widthFt={s.widthFt}
            depthFt={s.depthFt}
            heightFt={s.deckHeightFt}
            roof={s.roof}
            m={m}
            night={night}
          />
        </group>
      ))}
    </group>
  );
}
