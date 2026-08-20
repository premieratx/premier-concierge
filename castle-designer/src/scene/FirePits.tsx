import { useMemo } from 'react';
import * as THREE from 'three';
import { featuresOfKind } from '../domain/types';
import type { Layout } from '../domain/types';
import { Flame } from './Fire';

/**
 * The rainbow fire pits: a stone ring, a bed of media, and a flame whose
 * colour drifts round the wheel. Each pit starts at a different hue and runs
 * on its own clock, so the ring never lines up.
 */
export function FirePits({ layout, night }: { layout: Layout; night: boolean }) {
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7b7364', roughness: 0.98 }),
    [],
  );
  const media = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1c1a19', roughness: 0.9 }),
    [],
  );

  const pits = featuresOfKind(layout.features, 'firePit');

  return (
    <group>
      {pits.map((pit, i) => (
        <group key={pit.id} position={[pit.position.x, pit.position.y, pit.position.z]}>
          <mesh material={stone} position={[0, 0.9, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[pit.radiusFt, pit.radiusFt + 0.6, 1.8, 20]} />
          </mesh>
          <mesh material={media} position={[0, 1.75, 0]}>
            <cylinderGeometry args={[pit.radiusFt - 0.7, pit.radiusFt - 0.7, 0.2, 20]} />
          </mesh>
          <Flame
            position={[0, 1.8, 0]}
            height={pit.radiusFt * 1.9}
            radius={pit.radiusFt * 0.72}
            hue={pit.hue}
            rainbow={pit.rainbow}
            seed={i}
            castLight={night}
            lightIntensity={night ? 90 : 30}
          />
        </group>
      ))}
    </group>
  );
}
