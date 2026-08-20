import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { hexVertices } from '../domain/generators/hexMarina';
import { featuresOfKind } from '../domain/types';
import type { HexDockFeature, Layout, ModelLayer, WalkwayFeature } from '../domain/types';

/**
 * The hexagonal marina.
 *
 * Seven floating hexagons under one continuous roof deck each: a ring of
 * walkway with berths off its inner faces, three edges left open so boats can
 * get in, and a clear structural deck sixteen feet up with photovoltaic
 * underneath it. The walkways out to the satellites retract, which is the
 * whole reason the marina is seven separate rafts instead of one.
 */

/**
 * A hexagonal prism from `CylinderGeometry` starts its first vertex on +Z,
 * while the plan model starts its first vertex at the spec's rotation on +X.
 * This is the offset that lines the two up.
 */
function meshRotationY(rotation: number): number {
  return Math.PI / 2 - rotation;
}

function useMarinaMaterials() {
  return useMemo(() => {
    const m = {
      deck: new THREE.MeshStandardMaterial({ color: '#93805c', roughness: 0.85 }),
      frame: new THREE.MeshStandardMaterial({
        color: '#8d949c',
        roughness: 0.42,
        metalness: 0.7,
      }),
      float: new THREE.MeshStandardMaterial({ color: '#3b4149', roughness: 0.9 }),
      // Clear structural decking: you can see the array through it.
      // Clear structural decking. Kept faint and only lightly reflective: at
      // 0.34 opacity over an environment map it read as a white lid, which is
      // the opposite of the point — you are meant to see the array through it.
      clearDeck: new THREE.MeshStandardMaterial({
        color: '#a8c6d8',
        roughness: 0.06,
        metalness: 0.0,
        transparent: true,
        opacity: 0.18,
        envMapIntensity: 0.35,
        side: THREE.DoubleSide,
      }),
      solar: new THREE.MeshStandardMaterial({
        color: '#101a2f',
        roughness: 0.22,
        metalness: 0.35,
        envMapIntensity: 0.5,
      }),
      store: new THREE.MeshStandardMaterial({ color: '#b9ae95', roughness: 0.8 }),
      glass: new THREE.MeshStandardMaterial({
        color: '#5d8ba8',
        roughness: 0.15,
        metalness: 0.3,
        transparent: true,
        opacity: 0.62,
      }),
      rail: new THREE.MeshStandardMaterial({ color: '#5c6068', roughness: 0.6, metalness: 0.4 }),
      rope: new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 1 }),
      bar: new THREE.MeshStandardMaterial({ color: '#5a3f2c', roughness: 0.7 }),
    };
    return m;
  }, []);
}

type Materials = ReturnType<typeof useMarinaMaterials>;

/** The floating ring: one slab per edge, broken where an entrance is. */
function DeckRing({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const slabs = useMemo(() => {
    const R = dock.sideFt;
    const walk = dock.perimeterWalkFt;
    const centre = { x: 0, z: 0 };
    const vertices = hexVertices(centre, R, 0);
    const apothem = (R * Math.sqrt(3)) / 2;
    const out: { position: [number, number, number]; rotationY: number; length: number }[] = [];

    for (let e = 0; e < 6; e++) {
      const a = vertices[e]!;
      const b = vertices[(e + 1) % 6]!;
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      // Pull the slab in so its outer face sits on the hexagon edge.
      const inward = { x: -mid.x / apothem, z: -mid.z / apothem };
      const cx = mid.x + inward.x * (walk / 2);
      const cz = mid.z + inward.z * (walk / 2);
      const rotationY = Math.atan2(-(b.z - a.z), b.x - a.x);

      if (!dock.entranceEdges.includes(e)) {
        out.push({ position: [cx, 0, cz], rotationY, length: R });
        continue;
      }

      // An entrance splits the edge into two runs either side of the opening.
      const gap = 20;
      const runLength = (R - gap) / 2;
      const ux = (b.x - a.x) / R;
      const uz = (b.z - a.z) / R;
      for (const side of [-1, 1] as const) {
        const offset = side * (gap / 2 + runLength / 2);
        out.push({
          position: [cx + ux * offset, 0, cz + uz * offset],
          rotationY,
          length: runLength,
        });
      }
    }
    return out;
  }, [dock.sideFt, dock.perimeterWalkFt, dock.entranceEdges]);

  return (
    <group>
      {slabs.map((slab, i) => (
        <group key={i}>
          <mesh position={slab.position} rotation={[0, slab.rotationY, 0]} material={m.deck} castShadow receiveShadow>
            <boxGeometry args={[slab.length, 1.2, dock.perimeterWalkFt]} />
          </mesh>
          {/* The floats under it, which is what is actually being bought. */}
          <mesh
            position={[slab.position[0], -1.4, slab.position[2]]}
            rotation={[0, slab.rotationY, 0]}
            material={m.float}
          >
            <boxGeometry args={[slab.length, 2.67, dock.perimeterWalkFt - 0.4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Finger piers between the berths, projecting in off the ring. */
function Fingers({
  slips,
  m,
}: {
  slips: { position: THREE.Vector3Like; rotationY: number; lengthFt: number }[];
  m: Materials;
}) {
  return (
    <group>
      {slips.map((slip, i) => (
        <mesh
          key={i}
          position={[slip.position.x, 0.2, slip.position.z]}
          rotation={[0, slip.rotationY, 0]}
          material={m.deck}
        >
          {/* Runs the length of the berth, offset to its edge. */}
          <boxGeometry args={[slip.lengthFt, 0.8, 2]} />
        </mesh>
      ))}
    </group>
  );
}

/** The roof: columns, a photovoltaic layer and the clear deck over it. */
function RoofDeck({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const R = dock.sideFt;
  const h = dock.roofHeightFt;
  const columns = useMemo(() => hexVertices({ x: 0, z: 0 }, R - 3, 0), [R]);

  return (
    <group>
      {columns.map((c, i) => (
        <mesh key={i} position={[c.x, h / 2, c.z]} material={m.frame} castShadow>
          <cylinderGeometry args={[0.7, 0.7, h, 8]} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.9, 0]} material={m.solar} castShadow receiveShadow>
        <cylinderGeometry args={[R * 0.96, R * 0.96, 0.35, 6]} />
      </mesh>
      <mesh position={[0, h, 0]} material={m.clearDeck}>
        <cylinderGeometry args={[R, R, 0.5, 6]} />
      </mesh>
      {/* Guard rail round the roof edge. */}
      {hexVertices({ x: 0, z: 0 }, R, 0).map((a, i, all) => {
        const b = all[(i + 1) % 6]!;
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const rotationY = Math.atan2(-(b.z - a.z), b.x - a.x);
        return (
          <mesh
            key={`rail-${i}`}
            position={[mid.x, h + 2, mid.z]}
            rotation={[0, rotationY, 0]}
            material={m.rail}
          >
            <boxGeometry args={[R, 0.3, 0.3]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The ship store, sitting inside the hub hexagon. */
function ShipStore({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const R = dock.sideFt * 0.62;
  const height = dock.roofHeightFt - 3.5;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} material={m.store} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, height, 6]} />
      </mesh>
      {/* A band of glazing at eye level all the way round. */}
      <mesh position={[0, height * 0.62, 0]} material={m.glass}>
        <cylinderGeometry args={[R + 0.15, R + 0.15, height * 0.34, 6, 1, true]} />
      </mesh>
    </group>
  );
}

/** Jump platform, rope swing and bar on a satellite roof. */
function RoofAmenities({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const R = dock.sideFt;
  const h = dock.roofHeightFt;
  return (
    <group>
      {dock.amenities.jumpPlatform && (
        <group position={[R * 0.72, h, 0]}>
          <mesh position={[3.5, 0.9, 0]} material={m.deck} castShadow>
            <boxGeometry args={[9, 0.6, 8]} />
          </mesh>
          {[-3, 3].map((z) => (
            <mesh key={z} position={[7.5, 2.6, z]} material={m.rail}>
              <boxGeometry args={[0.25, 3.4, 0.25]} />
            </mesh>
          ))}
        </group>
      )}
      {dock.amenities.ropeSwing && (
        <group position={[0, h, R * 0.72]}>
          <mesh position={[0, 9, 3]} material={m.frame} castShadow>
            <boxGeometry args={[0.6, 0.6, 9]} />
          </mesh>
          <mesh position={[0, 4.5, 7]} material={m.rope}>
            <cylinderGeometry args={[0.1, 0.1, 9, 5]} />
          </mesh>
          <mesh position={[0, 0.4, 7]} material={m.rail}>
            <boxGeometry args={[1.8, 0.25, 0.8]} />
          </mesh>
        </group>
      )}
      {dock.amenities.bar && (
        <group position={[-R * 0.45, h, 0]}>
          <mesh position={[0, 2, 0]} material={m.bar} castShadow>
            <boxGeometry args={[4, 3.6, 18]} />
          </mesh>
          {[-6, -2, 2, 6].map((z) => (
            <mesh key={z} position={[-3.4, 1.3, z]} material={m.rail} castShadow>
              <cylinderGeometry args={[0.55, 0.45, 2.6, 8]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function Walkway({ walk, m }: { walk: WalkwayFeature; m: Materials }) {
  const dx = walk.to.x - walk.from.x;
  const dz = walk.to.z - walk.from.z;
  const length = Math.hypot(dx, dz);
  const rotationY = Math.atan2(-dz, dx);
  return (
    <group
      position={[(walk.from.x + walk.to.x) / 2, walk.from.y, (walk.from.z + walk.to.z) / 2]}
      rotation={[0, rotationY, 0]}
    >
      <mesh material={m.deck} castShadow receiveShadow>
        <boxGeometry args={[length, 1, walk.widthFt]} />
      </mesh>
      {/* Hinge and winch at the hub end: this is the bit that retracts. */}
      <mesh position={[-length / 2 + 2, 1.4, 0]} material={m.frame} castShadow>
        <boxGeometry args={[4, 2.4, walk.widthFt + 1]} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, 2, (side * walk.widthFt) / 2]} material={m.rail}>
          <boxGeometry args={[length, 0.25, 0.25]} />
        </mesh>
      ))}
    </group>
  );
}

export function HexMarina({
  layout,
  layers,
}: {
  layout: Layout;
  layers: Record<ModelLayer, boolean>;
}) {
  const m = useMarinaMaterials();
  useEffect(
    () => () => {
      for (const material of Object.values(m)) material.dispose();
    },
    [m],
  );

  const docks = featuresOfKind(layout.features, 'hexDock');
  const walkways = featuresOfKind(layout.features, 'walkway');
  const slips = featuresOfKind(layout.features, 'slip');

  if (docks.length === 0) return null;

  return (
    <group>
      {docks.map((dock) => {
        const rotation = meshRotationY(dock.rotationY);
        const mine = slips.filter(
          (s) =>
            Math.hypot(s.position.x - dock.position.x, s.position.z - dock.position.z) <
            dock.sideFt,
        );
        return (
          <group
            key={dock.id}
            position={[dock.position.x, dock.position.y, dock.position.z]}
            rotation={[0, rotation, 0]}
          >
            {layers.docks && <DeckRing dock={dock} m={m} />}
            {layers.docks && dock.role === 'hub' && (
              <mesh position={[0, 0, 0]} material={m.deck} receiveShadow>
                <cylinderGeometry args={[dock.sideFt, dock.sideFt, 1.2, 6]} />
              </mesh>
            )}
            {layers.docks &&
              mine.length > 0 && (
                <Fingers
                  m={m}
                  slips={mine.map((s) => ({
                    // Back into the module's own frame.
                    position: new THREE.Vector3(
                      s.position.x - dock.position.x,
                      0,
                      s.position.z - dock.position.z,
                    ).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotation),
                    rotationY: s.rotationY - rotation,
                    lengthFt: s.lengthFt,
                  }))}
                />
              )}
            {layers.roofDecks && <RoofDeck dock={dock} m={m} />}
            {layers.roofDecks && dock.role === 'satellite' && (
              <RoofAmenities dock={dock} m={m} />
            )}
            {layers.shipStore && dock.role === 'hub' && <ShipStore dock={dock} m={m} />}
          </group>
        );
      })}

      {layers.docks &&
        walkways.map((walk) => <Walkway key={walk.id} walk={walk} m={m} />)}
    </group>
  );
}
