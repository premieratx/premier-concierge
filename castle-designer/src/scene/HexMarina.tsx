import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { hexVertices, offsetHexagon, type Point2 } from '../domain/generators/hexMarina';
import { featuresOfKind } from '../domain/types';
import type { HexDockFeature, Layout, ModelLayer, WalkwayFeature } from '../domain/types';

/**
 * The hexagonal marina.
 *
 * Seven floating hexagons: a hub carrying the ship store, and six satellites
 * on retractable walkways. Each satellite is a twelve-foot walkway ring with
 * the berths hung off its *outside* and the middle left open as a swimming
 * lagoon, netted twelve feet down. The roof is a ring too — it reaches out
 * over every berth and stops at the lagoon, so the boats are shaded and the
 * water is not.
 *
 * Under the clear structural decking is the array. That is the whole idea:
 * one structure that is the shade, the deck and the power plant at once.
 */

/**
 * A hexagonal prism from `CylinderGeometry` starts its first vertex on +Z,
 * while the plan model starts its first vertex at the spec's rotation on +X.
 * This is the offset that lines the two up.
 */
function meshRotationY(rotation: number): number {
  return Math.PI / 2 - rotation;
}

const ORIGIN: Point2 = { x: 0, z: 0 };

/** Distance from the centre of a hexagon to the middle of an edge. */
function apothemOf(sideFt: number): number {
  return (sideFt * Math.sqrt(3)) / 2;
}

/**
 * A plan polygon as a `Shape`, in the plane the flat geometry is built in.
 *
 * `ExtrudeGeometry` works in XY and pushes along +Z; laying it flat is a
 * quarter turn about X, which sends +Z to +Y and shape-Y to world −Z. Feeding
 * the points in negated on Z is what makes the drawing come out the right way
 * round rather than mirrored.
 */
function shapeOf(points: Point2[], holes: Point2[][] = []): THREE.Shape {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)));
  for (const hole of holes) {
    shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, -p.z))));
  }
  return shape;
}

function flatSlab(points: Point2[], holes: Point2[][], thickness: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shapeOf(points, holes), {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Netting, drawn rather than downloaded: a transparent grid on a canvas. */
function makeNetTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(226, 236, 240, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.moveTo(size, 0);
  ctx.lineTo(0, size);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // One repeat to a four-foot square of net, which is about the mesh a
  // debris net is actually woven at.
  texture.repeat.set(24, 24);
  return texture;
}

function useMarinaMaterials() {
  return useMemo(() => {
    const net = makeNetTexture();
    const m = {
      deck: new THREE.MeshStandardMaterial({ color: '#93805c', roughness: 0.85 }),
      frame: new THREE.MeshStandardMaterial({
        color: '#8d949c',
        roughness: 0.42,
        metalness: 0.7,
      }),
      float: new THREE.MeshStandardMaterial({ color: '#3b4149', roughness: 0.9 }),
      // Clear structural decking. Kept faint and only lightly reflective: at
      // 0.34 opacity over an environment map it read as a white lid, which is
      // the opposite of the point — you are meant to see the array through it.
      clearDeck: new THREE.MeshStandardMaterial({
        color: '#a8c6d8',
        roughness: 0.06,
        metalness: 0.0,
        transparent: true,
        opacity: 0.13,
        envMapIntensity: 0.1,
        side: THREE.DoubleSide,
      }),
      solar: new THREE.MeshStandardMaterial({
        color: '#1b2a4d',
        roughness: 0.3,
        metalness: 0.25,
        envMapIntensity: 0.35,
        side: THREE.DoubleSide,
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
      // The lagoon: sheltered water, so calmer and greener than the lake.
      lagoon: new THREE.MeshStandardMaterial({
        color: '#2f7f92',
        roughness: 0.08,
        metalness: 0.15,
        transparent: true,
        opacity: 0.72,
      }),
      net: new THREE.MeshStandardMaterial({
        map: net,
        alphaMap: net,
        color: '#dbe7ec',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      umbrella: new THREE.MeshStandardMaterial({ color: '#d4694a', roughness: 0.9 }),
      table: new THREE.MeshStandardMaterial({ color: '#e6ddc8', roughness: 0.8 }),
    };
    return { ...m, _net: net };
  }, []);
}

type Materials = ReturnType<typeof useMarinaMaterials>;

/** The floating walkway ring: one slab per edge, all the way round. */
function DeckRing({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const slabs = useMemo(() => {
    const R = dock.sideFt;
    const walk = dock.perimeterWalkFt;
    const vertices = hexVertices(ORIGIN, R, 0);
    const a = apothemOf(R);
    const out: { position: [number, number, number]; rotationY: number; length: number }[] = [];

    for (let e = 0; e < 6; e++) {
      const p = vertices[e]!;
      const q = vertices[(e + 1) % 6]!;
      const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
      // Pull the slab in so its outer face sits on the hexagon edge, which is
      // the line the berths hang off.
      const inward = { x: -mid.x / a, z: -mid.z / a };
      const cx = mid.x + inward.x * (walk / 2);
      const cz = mid.z + inward.z * (walk / 2);
      const rotationY = Math.atan2(-(q.z - p.z), q.x - p.x);
      // A little long, so the corners close instead of leaving six notches.
      out.push({ position: [cx, 0, cz], rotationY, length: R + walk * 1.16 });
    }
    return out;
  }, [dock.sideFt, dock.perimeterWalkFt]);

  return (
    <group>
      {slabs.map((slab, i) => (
        <group key={i}>
          <mesh
            position={slab.position}
            rotation={[0, slab.rotationY, 0]}
            material={m.deck}
            castShadow
            receiveShadow
          >
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

/**
 * The swimming lagoon: sheltered water inside the ring, with a net twelve feet
 * down and a skirt round its edge so nothing that goes in can drift out under
 * the dock.
 */
function Lagoon({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const innerR = (apothemOf(dock.sideFt) - dock.perimeterWalkFt) / (Math.sqrt(3) / 2);
  // The lake is at zero and the deck floats a freeboard above it.
  const waterY = -dock.position.y;
  const netY = waterY - dock.netDepthFt;

  const geo = useMemo(() => {
    const surface = new THREE.CircleGeometry(innerR, 6, Math.PI / 6);
    surface.rotateX(-Math.PI / 2);
    return surface;
  }, [innerR]);
  useEffect(() => () => geo.dispose(), [geo]);

  const edges = useMemo(() => hexVertices(ORIGIN, innerR, 0), [innerR]);

  return (
    <group>
      <mesh position={[0, waterY - 0.05, 0]} geometry={geo} material={m.lagoon} />
      {/* The net itself, at depth, reading as a floor you can see through. */}
      <mesh position={[0, netY, 0]} geometry={geo} material={m.net} />
      {/* Skirt: the net carried up to the surface all the way round, so the
          lagoon is a closed bag rather than an open-bottomed ring. */}
      {edges.map((p, i) => {
        const q = edges[(i + 1) % 6]!;
        const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
        const rotationY = Math.atan2(-(q.z - p.z), q.x - p.x);
        return (
          <mesh
            key={i}
            position={[mid.x, (waterY + netY) / 2, mid.z]}
            rotation={[0, rotationY, 0]}
            material={m.net}
          >
            <planeGeometry args={[innerR, dock.netDepthFt]} />
          </mesh>
        );
      })}
      {/* Ladders down into the water, two to a lagoon. */}
      {[0, 3].map((k) => {
        const p = edges[k]!;
        const q = edges[(k + 1) % 6]!;
        const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
        return (
          <group key={k} position={[mid.x * 1.02, 0, mid.z * 1.02]}>
            {[-1.2, 1.2].map((o) => (
              <mesh key={o} position={[o * 0.4, waterY / 2 - 1.4, o * 0.4]} material={m.rail}>
                <cylinderGeometry args={[0.16, 0.16, Math.abs(waterY) + 4, 6]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Finger piers between the berths, projecting *out* from the ring.
 *
 * One finger to a berth, on its low-numbered side, plus the fingers that close
 * out each run. Every berth therefore has a walkway on at least one side,
 * which is what makes it a berth rather than a mooring.
 */
function Fingers({
  slips,
  m,
  widthFt,
}: {
  slips: { position: THREE.Vector3Like; rotationY: number; lengthFt: number }[];
  m: Materials;
  widthFt: number;
}) {
  return (
    <group>
      {slips.map((slip, i) => {
        // Local +X runs outward along the berth; the finger sits beside it.
        const sin = Math.sin(slip.rotationY);
        const cos = Math.cos(slip.rotationY);
        const off = widthFt / 2 + 1;
        return (
          <mesh
            key={i}
            position={[
              slip.position.x + off * sin,
              0.2,
              slip.position.z + off * cos,
            ]}
            rotation={[0, slip.rotationY, 0]}
            material={m.deck}
            castShadow
          >
            <boxGeometry args={[slip.lengthFt, 0.8, 2]} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * The roof: a ring of clear structural decking on columns, with the array
 * directly under it, reaching out over the berths and stopping at the lagoon.
 */
function RoofDeck({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const R = dock.sideFt;
  const h = dock.roofHeightFt;
  const hub = dock.role === 'hub';
  const innerR = (apothemOf(R) - dock.perimeterWalkFt) / (Math.sqrt(3) / 2);

  const { deckGeo, solarGeo, outline } = useMemo(() => {
    const shell = hub ? hexVertices(ORIGIN, R, 0) : offsetHexagon(ORIGIN, R, 0, dock.roofOffsetFt);
    // The hub is solid: the store is under it. A satellite is a ring, because
    // the lagoon is the point.
    const holes = hub ? [] : [hexVertices(ORIGIN, innerR, 0).slice().reverse()];
    const solarHoles = hub
      ? []
      : [hexVertices(ORIGIN, innerR + 2, 0).slice().reverse()];
    return {
      deckGeo: flatSlab(shell, holes, 0.5),
      solarGeo: flatSlab(
        shell.map((p) => ({ x: p.x * 0.97, z: p.z * 0.97 })),
        solarHoles,
        0.35,
      ),
      outline: shell,
    };
  }, [R, hub, dock.roofOffsetFt, innerR]);

  useEffect(
    () => () => {
      deckGeo.dispose();
      solarGeo.dispose();
    },
    [deckGeo, solarGeo],
  );

  // Columns: on the ring itself, and out at the roof edge where the berths
  // are, where they carry down to their own piles.
  const ringColumns = useMemo(() => hexVertices(ORIGIN, R - 3, 0), [R]);
  const outerColumns = useMemo(() => {
    if (hub) return [];
    return hexVertices(ORIGIN, R, 0).flatMap((p, i, all) => {
      const q = all[(i + 1) % 6]!;
      const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
      const len = Math.hypot(mid.x, mid.z);
      const reach = (len + dock.roofOffsetFt - 1.5) / len;
      return [{ x: mid.x * reach, z: mid.z * reach }];
    });
  }, [R, hub, dock.roofOffsetFt]);

  return (
    <group>
      {ringColumns.map((c, i) => (
        <mesh key={i} position={[c.x, h / 2, c.z]} material={m.frame} castShadow>
          <cylinderGeometry args={[0.7, 0.7, h, 8]} />
        </mesh>
      ))}
      {outerColumns.map((c, i) => (
        <group key={`outer-${i}`}>
          <mesh position={[c.x, h / 2, c.z]} material={m.frame} castShadow>
            <cylinderGeometry args={[0.6, 0.6, h, 8]} />
          </mesh>
          {/* Mooring pile: the roof's outboard edge has to land on something,
              and that something is also what the marina is tied to. */}
          <mesh position={[c.x, -14, c.z]} material={m.frame}>
            <cylinderGeometry args={[0.9, 0.9, 30, 8]} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, h - 0.9, 0]} geometry={solarGeo} material={m.solar} castShadow />
      <mesh position={[0, h, 0]} geometry={deckGeo} material={m.clearDeck} />

      {/* Rail round the outer edge, and round the hole over the lagoon: the
          middle of this roof is a seventy-foot drop into the swim area. */}
      {outline.map((p, i, all) => {
        const q = all[(i + 1) % all.length]!;
        const len = Math.hypot(q.x - p.x, q.z - p.z);
        if (len < 0.5) return null;
        const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
        const rotationY = Math.atan2(-(q.z - p.z), q.x - p.x);
        return (
          <mesh
            key={`rail-${i}`}
            position={[mid.x, h + 2, mid.z]}
            rotation={[0, rotationY, 0]}
            material={m.rail}
          >
            <boxGeometry args={[len, 0.3, 0.3]} />
          </mesh>
        );
      })}
      {!hub &&
        hexVertices(ORIGIN, innerR, 0).map((p, i, all) => {
          const q = all[(i + 1) % 6]!;
          const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
          const rotationY = Math.atan2(-(q.z - p.z), q.x - p.x);
          return (
            <mesh
              key={`hole-rail-${i}`}
              position={[mid.x, h + 2, mid.z]}
              rotation={[0, rotationY, 0]}
              material={m.rail}
            >
              <boxGeometry args={[innerR, 0.3, 0.3]} />
            </mesh>
          );
        })}
    </group>
  );
}

/** Tables and umbrellas on the roof ring: the patio the berths pay for. */
function RoofPatio({ dock, m }: { dock: HexDockFeature; m: Materials }) {
  const h = dock.roofHeightFt;
  const radius = apothemOf(dock.sideFt) + dock.roofOffsetFt * 0.45;
  const spots = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 + 0.26;
        return { x: Math.cos(a) * radius, z: Math.sin(a) * radius, tall: i % 3 === 0 };
      }),
    [radius],
  );
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, h + 0.3, s.z]}>
          <mesh position={[0, 1.3, 0]} material={m.table} castShadow>
            <cylinderGeometry args={[2.1, 2.1, 0.25, 10]} />
          </mesh>
          <mesh position={[0, 0.7, 0]} material={m.rail}>
            <cylinderGeometry args={[0.2, 0.2, 1.4, 6]} />
          </mesh>
          {s.tall && (
            <>
              <mesh position={[0, 4.4, 0]} material={m.rail}>
                <cylinderGeometry args={[0.14, 0.14, 8, 6]} />
              </mesh>
              <mesh position={[0, 8.2, 0]} material={m.umbrella} castShadow>
                <coneGeometry args={[5, 1.8, 8]} />
              </mesh>
            </>
          )}
        </group>
      ))}
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
  const ring = apothemOf(R) + dock.roofOffsetFt * 0.5;
  return (
    <group>
      {dock.amenities.jumpPlatform && (
        <group position={[ring, h, 0]}>
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
        <group position={[0, h, ring]}>
          {/* Swings out over the lagoon, which is the netted water, which is
              the only place on this property it is safe to swing into. */}
          <mesh position={[0, 9, -3]} material={m.frame} castShadow>
            <boxGeometry args={[0.6, 0.6, 9]} />
          </mesh>
          <mesh position={[0, 4.5, -7]} material={m.rope}>
            <cylinderGeometry args={[0.1, 0.1, 9, 5]} />
          </mesh>
          <mesh position={[0, 0.4, -7]} material={m.rail}>
            <boxGeometry args={[1.8, 0.25, 0.8]} />
          </mesh>
        </group>
      )}
      {dock.amenities.bar && (
        <group position={[-ring, h, 0]}>
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
      for (const [key, material] of Object.entries(m)) {
        if (key === '_net') (material as THREE.Texture).dispose();
        else (material as THREE.Material).dispose();
      }
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
        // Berths now hang outside the hexagon, so the catchment has to reach
        // past it — but not so far as to pick up the neighbour's.
        const reach = dock.sideFt + dock.roofOffsetFt + 2;
        const mine = slips.filter(
          (s) =>
            Math.hypot(s.position.x - dock.position.x, s.position.z - dock.position.z) < reach,
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
            {layers.docks && dock.role === 'satellite' && <Lagoon dock={dock} m={m} />}
            {layers.docks && mine.length > 0 && (
              <Fingers
                m={m}
                widthFt={mine[0]!.widthFt}
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
            {layers.roofDecks && dock.role === 'satellite' && <RoofAmenities dock={dock} m={m} />}
            {layers.patios && dock.role === 'satellite' && <RoofPatio dock={dock} m={m} />}
            {layers.shipStore && dock.role === 'hub' && <ShipStore dock={dock} m={m} />}
          </group>
        );
      })}

      {layers.docks && walkways.map((walk) => <Walkway key={walk.id} walk={walk} m={m} />)}
    </group>
  );
}
