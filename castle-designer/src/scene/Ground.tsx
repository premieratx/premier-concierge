import { Grid, MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SNAP_ACROSS_FT } from '../domain/dimensions';
import type { SiteDefinition } from '../domain/types';
import type { TimeOfDay } from '../store/useLayoutStore';

const LAND_COLOR = '#4a5340';
const LAWN_COLOR = '#53613f';
const BANK_COLOR = '#6c6252';

const WATER_COLOR: Record<TimeOfDay, string> = {
  day: '#1b4059',
  dusk: '#1a2e43',
  night: '#0b1622',
};

/**
 * Ground cover: a small tiling noise map so the terrain is not one flat sheet
 * of colour. Two octaves is plenty at the distance anyone looks at it from.
 */
function makeGroundTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const noise = (x: number, y: number) =>
    Math.sin(x * 0.31) * Math.cos(y * 0.27) * 0.5 +
    Math.sin((x + y) * 0.13 + 2.1) * 0.3 +
    Math.sin(x * 1.7 + y * 1.3) * 0.2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = 0.5 + noise(x, y) * 0.5;
      const i = (y * size + x) * 4;
      // Bias toward the green channel: dry grass over caliche.
      data[i] = Math.round(150 + n * 70);
      data[i + 1] = Math.round(170 + n * 60);
      data[i + 2] = Math.round(135 + n * 55);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(700, 520);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A radial fade, so the mown lawn meets the rough ground on a soft edge
 * instead of a hard rectangle.
 */
function makeFadeMask(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / (size - 1)) * 2 - 1;
      const v = (y / (size - 1)) * 2 - 1;
      const r = Math.min(1, Math.hypot(u, v));
      const alpha = Math.round(255 * Math.max(0, 1 - Math.pow(r, 3)));
      const i = (y * size + x) * 4;
      // three reads an alphaMap from the green channel, not from alpha, so the
      // mask has to be written as greyscale or every texel comes back opaque.
      data[i] = alpha;
      data[i + 1] = alpha;
      data[i + 2] = alpha;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

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
  const groundMap = useMemo(() => makeGroundTexture(), []);
  const fadeMask = useMemo(() => makeFadeMask(), []);
  useEffect(
    () => () => {
      groundMap.dispose();
      fadeMask.dispose();
    },
    [groundMap, fadeMask],
  );

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
        <meshStandardMaterial color={LAND_COLOR} map={groundMap} roughness={1} />
      </mesh>

      {/* The party lawn between the gate and the water reads greener. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 252]} receiveShadow>
        <planeGeometry args={[880, 240]} />
        <meshStandardMaterial
          color={LAWN_COLOR}
          alphaMap={fadeMask}
          transparent
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      <Bank site={site} />

      {showWater && <Lake site={site} timeOfDay={timeOfDay} />}

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
