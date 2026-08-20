import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { findIntersections } from '../domain/geometry';
import { useLayoutStore } from '../store/useLayoutStore';
import { ContainerMesh } from './ContainerMesh';
import { Ground } from './Ground';
import { Lighting } from './Lighting';

function CastleModel() {
  const containers = useLayoutStore((s) => s.layout.containers);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const showEdges = useLayoutStore((s) => s.showEdges);
  const select = useLayoutStore((s) => s.select);

  // Containers sharing volume read as an error immediately, before any of the
  // structural rules in Phase 4 get a say.
  const overlapping = useMemo(() => {
    const ids = new Set<string>();
    for (const [i, j] of findIntersections(containers)) {
      const a = containers[i];
      const b = containers[j];
      if (a) ids.add(a.id);
      if (b) ids.add(b.id);
    }
    return ids;
  }, [containers]);

  return (
    <group>
      {containers.map((container) => (
        <ContainerMesh
          key={container.id}
          container={container}
          selected={selectedIds.includes(container.id)}
          violating={overlapping.has(container.id)}
          showEdges={showEdges}
          onSelect={select}
        />
      ))}
    </group>
  );
}

export function Scene() {
  const select = useLayoutStore((s) => s.select);

  return (
    <Canvas
      shadows
      camera={{ position: [95, 72, 115], fov: 45, near: 0.5, far: 3000 }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#aebfd4']} />
      <fog attach="fog" args={['#aebfd4', 400, 1400]} />
      <Lighting />
      <Ground />
      <CastleModel />
      <OrbitControls
        makeDefault
        target={[16, 8, 28]}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={12}
        maxDistance={900}
        enableDamping
        dampingFactor={0.1}
      />
    </Canvas>
  );
}
