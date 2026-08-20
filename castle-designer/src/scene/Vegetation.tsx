import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Rect } from '../domain/generators/common';
import type { SiteDefinition } from '../domain/types';

const dummy = new THREE.Object3D();
const scratch = new THREE.Color();

/**
 * A small deterministic generator, so the trees land in the same places on
 * every load and every machine. Nothing about a site plan should shuffle
 * itself between refreshes.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Plant {
  x: number;
  z: number;
  /** 0 is a live oak, 1 an Ashe juniper, 2 a shrub clump. */
  species: 0 | 1 | 2;
  scale: number;
  rotation: number;
  tint: number;
}

function inside(rect: Rect, x: number, z: number, margin = 0): boolean {
  return (
    x > rect.x - margin &&
    x < rect.x + rect.sizeX + margin &&
    z > rect.z - margin &&
    z < rect.z + rect.sizeZ + margin
  );
}

/**
 * Where the planting can go: everywhere that is not building, lawn, water,
 * lodging pad, drive or fire clearance.
 */
function scatter(site: SiteDefinition, exclusions: Rect[], count: number): Plant[] {
  const random = mulberry32(0x0a5eed);
  const plants: Plant[] = [];
  let guard = 0;

  while (plants.length < count && guard < count * 30) {
    guard += 1;
    const x = -940 + random() * 1880;
    const z = -560 + random() * (site.shorelineZ + 560 - 14);
    if (exclusions.some((rect) => inside(rect, x, z))) continue;

    // Thin the planting out as it approaches the water, the way a bank does.
    const nearShore = 1 - Math.max(0, (z - 140) / (site.shorelineZ - 140));
    if (random() > 0.35 + 0.65 * nearShore) continue;

    const roll = random();
    const species: Plant['species'] = roll < 0.42 ? 0 : roll < 0.78 ? 1 : 2;
    plants.push({
      x,
      z,
      species,
      scale: 0.65 + random() * 0.8,
      rotation: random() * Math.PI * 2,
      tint: random(),
    });
  }

  return plants;
}

/** Live oak: broad, low, dark. Ashe juniper: conical and blue-green. */
const OAK_CANOPY = ['#3f5a33', '#47623a', '#374f2c'];
const CEDAR_CANOPY = ['#33483a', '#3c5442', '#2c3f34'];
const SHRUB_CANOPY = ['#4d5c37', '#57663f'];

export interface VegetationProps {
  site: SiteDefinition;
  /** Footprints to keep clear: compound, lawn, lodging, drive. */
  exclusions: Rect[];
  count?: number;
}

/**
 * Hill Country planting.
 *
 * Live oaks and Ashe junipers, instanced and deterministic. This is the single
 * cheapest thing that stops the property reading as a model on a green sheet
 * of paper: it is what tells you the site is in central Texas rather than
 * anywhere else.
 */
export function Vegetation({ site, exclusions, count = 420 }: VegetationProps) {
  const plants = useMemo(() => scatter(site, exclusions, count), [site, exclusions, count]);

  const oaks = useMemo(() => plants.filter((p) => p.species === 0), [plants]);
  const cedars = useMemo(() => plants.filter((p) => p.species === 1), [plants]);
  const shrubs = useMemo(() => plants.filter((p) => p.species === 2), [plants]);

  const trunkMesh = useRef<THREE.InstancedMesh>(null);
  const oakMesh = useRef<THREE.InstancedMesh>(null);
  const cedarMesh = useRef<THREE.InstancedMesh>(null);
  const shrubMesh = useRef<THREE.InstancedMesh>(null);

  const materials = useMemo(
    () => ({
      bark: new THREE.MeshStandardMaterial({ color: '#4a3f34', roughness: 0.95 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, flatShading: true }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.bark.dispose();
      materials.leaf.dispose();
    },
    [materials],
  );

  // Trunks for the oaks and the cedars, in that order.
  const trunkPlants = useMemo(() => [...oaks, ...cedars], [oaks, cedars]);

  useLayoutEffect(() => {
    const m = trunkMesh.current;
    if (!m) return;
    trunkPlants.forEach((p, i) => {
      const height = (p.species === 0 ? 9 : 6) * p.scale;
      dummy.position.set(p.x, height / 2, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.set(p.scale, height, p.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.count = trunkPlants.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [trunkPlants]);

  useLayoutEffect(() => {
    const m = oakMesh.current;
    if (!m) return;
    let i = 0;
    for (const p of oaks) {
      // Three overlapping lobes make a live oak's spreading crown.
      const lobes: [number, number, number, number][] = [
        [0, 13, 0, 1],
        [4.6, 10.5, 1.8, 0.72],
        [-3.8, 11.2, -2.6, 0.66],
      ];
      for (const [dx, dy, dz, r] of lobes) {
        const s = p.scale;
        dummy.position.set(p.x + dx * s, dy * s, p.z + dz * s);
        dummy.rotation.set(p.tint * 2, p.rotation, 0);
        dummy.scale.set(9 * r * s, 6.2 * r * s, 9 * r * s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        scratch.set(OAK_CANOPY[Math.floor(p.tint * OAK_CANOPY.length)] ?? OAK_CANOPY[0]!);
        m.setColorAt(i, scratch);
        i += 1;
      }
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [oaks]);

  useLayoutEffect(() => {
    const m = cedarMesh.current;
    if (!m) return;
    cedars.forEach((p, i) => {
      const s = p.scale;
      dummy.position.set(p.x, 12 * s, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.set(5.4 * s, 16 * s, 5.4 * s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      scratch.set(CEDAR_CANOPY[Math.floor(p.tint * CEDAR_CANOPY.length)] ?? CEDAR_CANOPY[0]!);
      m.setColorAt(i, scratch);
    });
    m.count = cedars.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [cedars]);

  useLayoutEffect(() => {
    const m = shrubMesh.current;
    if (!m) return;
    shrubs.forEach((p, i) => {
      const s = p.scale;
      dummy.position.set(p.x, 1.6 * s, p.z);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.set(5 * s, 3 * s, 5 * s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      scratch.set(SHRUB_CANOPY[Math.floor(p.tint * SHRUB_CANOPY.length)] ?? SHRUB_CANOPY[0]!);
      m.setColorAt(i, scratch);
    });
    m.count = shrubs.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [shrubs]);

  if (plants.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={trunkMesh}
        key={`trunk-${trunkPlants.length}`}
        args={[undefined, undefined, Math.max(1, trunkPlants.length)]}
        material={materials.bark}
        castShadow
      >
        <cylinderGeometry args={[0.5, 0.85, 1, 6]} />
      </instancedMesh>

      <instancedMesh
        ref={oakMesh}
        key={`oak-${oaks.length}`}
        args={[undefined, undefined, Math.max(1, oaks.length * 3)]}
        material={materials.leaf}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[0.5, 1]} />
      </instancedMesh>

      <instancedMesh
        ref={cedarMesh}
        key={`cedar-${cedars.length}`}
        args={[undefined, undefined, Math.max(1, cedars.length)]}
        material={materials.leaf}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[0.5, 1, 7]} />
      </instancedMesh>

      <instancedMesh
        ref={shrubMesh}
        key={`shrub-${shrubs.length}`}
        args={[undefined, undefined, Math.max(1, shrubs.length)]}
        material={materials.leaf}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[0.5, 0]} />
      </instancedMesh>
    </group>
  );
}
