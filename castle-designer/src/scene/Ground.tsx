import { Grid, MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SNAP_ACROSS_FT } from '../domain/dimensions';
import { PARCEL, finishedGrade } from '../domain/terrain';
import type { SiteDefinition } from '../domain/types';
import type { TimeOfDay } from '../store/useLayoutStore';

const WATER_COLOR: Record<TimeOfDay, string> = {
  day: '#1b4059',
  dusk: '#1a2e43',
  night: '#0b1622',
};

/**
 * A value-noise normal map for the lake surface.
 *
 * Generated in memory and scrolled slowly in two directions, which is what
 * separates water from a mirror: the reflection has to break up and move, or
 * the lake reads as polished stone.
 */
function makeRippleNormal(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const height = (x: number, y: number) =>
    Math.sin((x / size) * Math.PI * 6) * Math.cos((y / size) * Math.PI * 4) * 0.6 +
    Math.sin(((x + y) / size) * Math.PI * 9 + 1.7) * 0.4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height((x + 1) % size, y) - height((x - 1 + size) % size, y);
      const dy = height(x, (y + 1) % size) - height(x, (y - 1 + size) % size);
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // The lake plane is tens of thousands of feet across, so the repeat has to
  // be large or one tile spans a quarter of the visible water and reads as a
  // grid. Mipmaps and anisotropy keep the far water from fizzing.
  texture.repeat.set(1600, 1200);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** The lake: a reflector with a normal map crawling across it. */
function Lake({ site, timeOfDay }: { site: SiteDefinition; timeOfDay: TimeOfDay }) {
  const ripple = useMemo(() => makeRippleNormal(), []);
  useEffect(() => () => ripple.dispose(), [ripple]);
  // MeshReflectorMaterial extends MeshStandardMaterial, but drei types the ref
  // as the concrete class; the normal scale is all this needs from it.
  const material = useRef<{ normalScale: THREE.Vector2 } | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ripple.offset.set(t * 0.0012, t * 0.0007);
    const m = material.current;
    if (m) m.normalScale.set(0.1 + 0.03 * Math.sin(t * 0.3), 0.1);
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, site.waterLevelFt, site.shorelineZ + 12 + 15000]}
      receiveShadow
    >
      <planeGeometry args={[40000, 30000]} />
      <MeshReflectorMaterial
        ref={material as never}
        color={WATER_COLOR[timeOfDay]}
        resolution={512}
        mirror={timeOfDay === 'day' ? 0.22 : 0.45}
        mixBlur={6}
        mixStrength={12}
        blur={[420, 110]}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.3}
        metalness={0.2}
        roughness={0.5}
        normalMap={ripple}
        normalScale={new THREE.Vector2(0.1, 0.1)}
      />
    </mesh>
  );
}

/**
 * The hillside itself: a displaced heightfield over the finished grade model.
 *
 * Vertex colours come from the slope and the elevation — dry grass where the
 * ground is gentle, caliche and limestone where it stands up, sand at the
 * water line — so the bluff on the east and the creek draw on the west read
 * without any texture work.
 */
function Hillside() {
  const { geometry, material } = useMemo(() => {
    const width = 6000;
    const depth = 4200;
    const segX = 300;
    const segZ = 210;

    const g = new THREE.PlaneGeometry(width, depth, segX, segZ);
    g.rotateX(-Math.PI / 2);

    const position = g.attributes.position as THREE.BufferAttribute;
    const centreZ = PARCEL.minZ + PARCEL.sizeZ / 2;
    const colors = new Float32Array(position.count * 3);

    const grass = new THREE.Color('#55643d');
    const dryGrass = new THREE.Color('#6f7549');
    const rock = new THREE.Color('#a89e86');
    const sand = new THREE.Color('#9a8a6e');
    const scratchColor = new THREE.Color();

    /**
     * Rock shows where the ground stands up, not merely where it falls.
     *
     * This hill runs at about one in four on average, so a linear map from
     * slope to rock painted the whole site as caliche. The band starts where
     * the ground gets too steep to mow and saturates at something you would
     * have to scramble up.
     */
    const rockiness = (slope: number) => {
      const t = Math.min(1, Math.max(0, (slope - 0.42) / 0.5));
      return t * t * (3 - 2 * t);
    };

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i) + centreZ;
      const h = finishedGrade(x, z);
      position.setY(i, h);
      position.setZ(i, z);

      // Central difference on the height field gives the slope.
      const d = 8;
      const dx = (finishedGrade(x + d, z) - finishedGrade(x - d, z)) / (2 * d);
      const dz = (finishedGrade(x, z + d) - finishedGrade(x, z - d)) / (2 * d);
      const steep = rockiness(Math.hypot(dx, dz));

      scratchColor.copy(grass).lerp(dryGrass, Math.min(1, h / 90));
      scratchColor.lerp(rock, steep);
      // A beach band either side of the water line.
      const shore = 1 - Math.min(1, Math.abs(h - 1) / 6);
      scratchColor.lerp(sand, shore * 0.8);

      colors[i * 3] = scratchColor.r;
      colors[i * 3 + 1] = scratchColor.g;
      colors[i * 3 + 2] = scratchColor.b;
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();

    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    return { geometry: g, material: m };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh geometry={geometry} material={material} receiveShadow castShadow />;
}

export interface TerrainProps {
  site: SiteDefinition;
  timeOfDay: TimeOfDay;
  showWater: boolean;
  showGrid: boolean;
}

/**
 * The site: hillside, lake, and the drafting grid when it is asked for.
 *
 * The lake is a reflector rather than a flat colour because at dusk the whole
 * point of a waterfront property is the second copy of the castle lying on
 * the water.
 */
export function Terrain({ site, timeOfDay, showWater, showGrid }: TerrainProps) {
  return (
    <group>
      <Hillside />

      {showWater && <Lake site={site} timeOfDay={timeOfDay} />}

      {showGrid && (
        <Grid
          args={[1200, 1200]}
          position={[0, 74.05, -80]}
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
