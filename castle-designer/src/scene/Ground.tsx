import { Grid, MeshReflectorMaterial } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SNAP_ACROSS_FT } from '../domain/dimensions';
import type { SiteDefinition } from '../domain/types';
import type { TimeOfDay } from '../store/useLayoutStore';

const LAND_COLOR = '#4a5340';
const LAWN_COLOR = '#53613f';
const BANK_COLOR = '#6c6252';

const WATER_COLOR: Record<TimeOfDay, string> = {
  day: '#28506b',
  dusk: '#20374f',
  night: '#0d1a2a',
};

/**
 * The bank: a sloped strip from grade down to the water line, so the land
 * does not simply stop in mid-air at the shore.
 */
function Bank({ site }: { site: SiteDefinition }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const x0 = -20000;
    const x1 = 20000;
    const z0 = site.shorelineZ;
    const z1 = site.shorelineZ + 12;
    const y1 = site.waterLevelFt - 1;
    const verts = [
      x0, 0, z0, x1, 0, z0, x1, y1, z1,
      x0, 0, z0, x1, y1, z1, x0, y1, z1,
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [site.sizeX, site.shorelineZ, site.waterLevelFt]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={BANK_COLOR} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

export interface TerrainProps {
  site: SiteDefinition;
  timeOfDay: TimeOfDay;
  showWater: boolean;
  showGrid: boolean;
}

/**
 * Grade, lawn, bank and lake.
 *
 * The lake is a reflector rather than a flat colour because at dusk the whole
 * point of a waterfront property is the second copy of the castle lying on
 * the water.
 */
export function Terrain({ site, timeOfDay, showWater, showGrid }: TerrainProps) {
  // Grade runs miles past the site boundary. Fog hides everything beyond a
  // few thousand feet anyway, but a flat plane's far edge always draws a line
  // in perspective: the further away it is, the closer that line sits to the
  // true horizon and the more it reads as one rather than as the edge of the
  // survey. Two triangles, so the size costs nothing.
  const landDepth = 30000;
  const landCentreZ = site.shorelineZ - landDepth / 2;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.03, landCentreZ]}
        receiveShadow
      >
        <planeGeometry args={[40000, landDepth]} />
        <meshStandardMaterial color={LAND_COLOR} roughness={1} />
      </mesh>

      {/* The party lawn between the gate and the water reads greener. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 252]} receiveShadow>
        <planeGeometry args={[760, 200]} />
        <meshStandardMaterial color={LAWN_COLOR} roughness={1} />
      </mesh>

      <Bank site={site} />

      {showWater && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, site.waterLevelFt, site.shorelineZ + 12 + 15000]}
          receiveShadow
        >
          <planeGeometry args={[40000, 30000]} />
          <MeshReflectorMaterial
            color={WATER_COLOR[timeOfDay]}
            resolution={512}
            mirror={timeOfDay === 'day' ? 0.35 : 0.6}
            mixBlur={5}
            mixStrength={22}
            blur={[380, 90]}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            metalness={0.55}
            roughness={0.28}
          />
        </mesh>
      )}

      {showGrid && (
        <Grid
          args={[900, 900]}
          position={[0, 0.02, 100]}
          cellSize={SNAP_ACROSS_FT}
          cellThickness={0.55}
          cellColor="#6b7a63"
          sectionSize={40}
          sectionThickness={1.1}
          sectionColor="#9fb18f"
          fadeDistance={1400}
          fadeStrength={1.2}
          infiniteGrid
        />
      )}
    </group>
  );
}
