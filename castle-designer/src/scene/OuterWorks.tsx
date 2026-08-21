import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { finishedGrade } from '../domain/terrain';
import { featuresOfKind } from '../domain/types';
import type {
  BridgeFeature,
  EnceinteFeature,
  KnightFeature,
  Layout,
  ModelLayer,
  MoatFeature,
  Point2,
  TorchFeature,
} from '../domain/types';

/**
 * The outer works: enceinte, moat, crossings, guard and torches.
 *
 * Three things here are doing real work rather than decoration:
 *
 *  - The wall follows grade. Every panel stands on the ground under it, so on
 *    the road face it steps down the hill the way a wall on a hill does.
 *  - The drawbridge is a counterweighted bascule and the model runs it. The
 *    sandbag crate drops as the leaf comes up, because that is the mechanism:
 *    the bags are the power, the chain is the linkage, and the leaf is the
 *    load. The number of bags came out of the leaf's own weight.
 *  - The torches are instanced. Sixty-eight open flames drawn one at a time
 *    would cost more than the entire marina; drawn as four instanced meshes
 *    with the colour in the instance buffer they cost almost nothing.
 */

const UP = new THREE.Vector3(0, 1, 0);

function hsl(h: number, s: number, l: number): THREE.Color {
  return new THREE.Color().setHSL(((h % 360) + 360) / 360, s, l);
}

function useOuterMaterials() {
  return useMemo(
    () => ({
      stone: new THREE.MeshStandardMaterial({ color: '#9a958a', roughness: 0.95 }),
      darkStone: new THREE.MeshStandardMaterial({ color: '#7c776d', roughness: 0.97 }),
      roofSlate: new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.8 }),
      timber: new THREE.MeshStandardMaterial({ color: '#6b4d32', roughness: 0.85 }),
      iron: new THREE.MeshStandardMaterial({
        color: '#4b4f55',
        roughness: 0.5,
        metalness: 0.75,
      }),
      sandbag: new THREE.MeshStandardMaterial({ color: '#b8a883', roughness: 1 }),
      water: new THREE.MeshStandardMaterial({
        color: '#25566b',
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.82,
      }),
      armour: new THREE.MeshStandardMaterial({
        color: '#b9c0c8',
        roughness: 0.35,
        metalness: 0.85,
      }),
      flesh: new THREE.MeshStandardMaterial({ color: '#c69a7b', roughness: 0.9 }),
      brass: new THREE.MeshStandardMaterial({
        color: '#8a6b32',
        roughness: 0.4,
        metalness: 0.8,
      }),
    }),
    [],
  );
}

type Materials = ReturnType<typeof useOuterMaterials>;

function headingOfSegment(a: Point2, b: Point2): number {
  return Math.atan2(-(b.z - a.z), b.x - a.x);
}

/* ------------------------------------------------------------------ *
 * The wall
 * ------------------------------------------------------------------ */

interface Panel {
  x: number;
  z: number;
  y: number;
  length: number;
  rotationY: number;
}

function useWallPanels(wall: EnceinteFeature) {
  return useMemo(() => {
    const panels: Panel[] = [];
    const merlons: Panel[] = [];
    const step = 11;

    for (let e = 0; e < wall.vertices.length; e++) {
      const a = wall.vertices[e]!;
      const b = wall.vertices[(e + 1) % wall.vertices.length]!;
      const run = Math.hypot(b.x - a.x, b.z - a.z);
      const rotationY = headingOfSegment(a, b);
      const count = Math.max(1, Math.round(run / step));
      const seg = run / count;

      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        // Skip the panels that would stand in a gate opening.
        const inGate = wall.gates.some(
          (g) =>
            g.edgeIndex === e && Math.hypot(x - g.centre.x, z - g.centre.z) < g.widthFt / 2,
        );
        if (inGate) continue;
        panels.push({ x, z, y: finishedGrade(x, z), length: seg + 0.4, rotationY });
      }

      // Crenellation, on its own spacing so the teeth do not follow the
      // panel joints.
      const teeth = Math.max(1, Math.round(run / wall.merlonEveryFt));
      for (let i = 0; i < teeth; i++) {
        const t = (i + 0.5) / teeth;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const inGate = wall.gates.some(
          (g) =>
            g.edgeIndex === e && Math.hypot(x - g.centre.x, z - g.centre.z) < g.widthFt / 2 + 2,
        );
        if (inGate) continue;
        merlons.push({ x, z, y: finishedGrade(x, z), length: wall.merlonEveryFt * 0.55, rotationY });
      }
    }
    return { panels, merlons };
  }, [wall]);
}

function InstancedPanels({
  panels,
  height,
  thickness,
  yOffset,
  material,
}: {
  panels: Panel[];
  height: number;
  thickness: number;
  yOffset: (p: Panel) => number;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (const [i, p] of panels.entries()) {
      quaternion.setFromAxisAngle(UP, p.rotationY);
      matrix.compose(
        new THREE.Vector3(p.x, yOffset(p), p.z),
        quaternion,
        new THREE.Vector3(p.length, height, thickness),
      );
      mesh.setMatrixAt(i, matrix);
    }
    mesh.count = panels.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [panels, height, thickness, yOffset]);

  if (panels.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, panels.length]}
      castShadow
      receiveShadow
    />
  );
}

function Enceinte({ wall, m }: { wall: EnceinteFeature; m: Materials }) {
  const { panels, merlons } = useWallPanels(wall);
  const wallY = useMemo(() => (p: Panel) => p.y + wall.wallHeightFt / 2, [wall.wallHeightFt]);
  const merlonY = useMemo(
    () => (p: Panel) => p.y + wall.wallHeightFt + 1.9,
    [wall.wallHeightFt],
  );

  return (
    <group>
      <InstancedPanels
        panels={panels}
        height={wall.wallHeightFt}
        thickness={wall.wallThicknessFt}
        yOffset={wallY}
        material={m.stone}
      />
      <InstancedPanels
        panels={merlons}
        height={3.8}
        thickness={wall.wallThicknessFt * 0.8}
        yOffset={merlonY}
        material={m.darkStone}
      />

      {/* Corner drums. */}
      {wall.vertices.map((v, i) => {
        const base = wall.vertexY[i]!;
        return (
          <group key={i} position={[v.x, base, v.z]}>
            <mesh position={[0, wall.towerHeightFt / 2, 0]} material={m.stone} castShadow receiveShadow>
              <cylinderGeometry
                args={[wall.towerRadiusFt, wall.towerRadiusFt * 1.12, wall.towerHeightFt, 14]}
              />
            </mesh>
            <mesh position={[0, wall.towerHeightFt + 1.4, 0]} material={m.darkStone} castShadow>
              <cylinderGeometry
                args={[wall.towerRadiusFt + 1.6, wall.towerRadiusFt + 1.6, 2.8, 14]}
              />
            </mesh>
            <mesh position={[0, wall.towerHeightFt + 8, 0]} material={m.roofSlate} castShadow>
              <coneGeometry args={[wall.towerRadiusFt + 2.2, 11, 14]} />
            </mesh>
          </group>
        );
      })}

      {/* Gatehouses: two piers, a lintel, and the winch loft over it. */}
      {wall.gates.map((gate) => (
        <group
          key={gate.id}
          position={[gate.centre.x, gate.sillY, gate.centre.z]}
          rotation={[0, gate.rotationY, 0]}
        >
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[0, wall.wallHeightFt / 2 + 2, (side * (gate.widthFt + 7)) / 2]}
              material={m.stone}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[wall.wallThicknessFt + 6, wall.wallHeightFt + 4, 7]} />
            </mesh>
          ))}
          <mesh
            position={[0, wall.wallHeightFt + 6.5, 0]}
            material={m.stone}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[wall.wallThicknessFt + 6, 5, gate.widthFt + 14]} />
          </mesh>
          {/* Merlons on the gatehouse head. */}
          {[-1, 0, 1].map((k) => (
            <mesh
              key={k}
              position={[0, wall.wallHeightFt + 11, k * (gate.widthFt / 2 + 2)]}
              material={m.darkStone}
              castShadow
            >
              <boxGeometry args={[wall.wallThicknessFt + 6, 4, 5]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * The moat
 * ------------------------------------------------------------------ */

/** The water surface of one basin, and the weir that holds it. */
function Moat({ basins, m }: { basins: MoatFeature[]; m: Materials }) {
  const geometries = useMemo(
    () =>
      basins.map((b) => {
        const quad = [b.inner[0]!, b.inner[1]!, b.outer[1]!, b.outer[0]!];
        const shape = new THREE.Shape(quad.map((p) => new THREE.Vector2(p.x, -p.z)));
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        return geo;
      }),
    [basins],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return (
    <group>
      {basins.map((basin, i) => {
        const corner = basin.inner[1]!;
        const outerCorner = basin.outer[1]!;
        const mid = {
          x: (corner.x + outerCorner.x) / 2,
          z: (corner.z + outerCorner.z) / 2,
        };
        const rotationY = headingOfSegment(corner, outerCorner);
        const span = Math.hypot(outerCorner.x - corner.x, outerCorner.z - corner.z);
        return (
          <group key={basin.id}>
            <mesh position={[0, basin.waterY, 0]} geometry={geometries[i]!} material={m.water} />
            {/* Built bank. On a hill a level basin is half cut and half wall:
                this is the wall, and without it the water runs downhill. */}
            {([
              ['inner', basin.inner, basin.innerBankHeightFt] as const,
              ['outer', basin.outer, basin.outerBankHeightFt] as const,
            ]).map(([side, edge, height]) => {
              if (height < 0.6) return null;
              const a = edge[0]!;
              const b = edge[1]!;
              const centre = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
              const run = Math.hypot(b.x - a.x, b.z - a.z);
              return (
                <mesh
                  key={side}
                  position={[centre.x, basin.bankTopY - (height + 3) / 2, centre.z]}
                  rotation={[0, headingOfSegment(a, b), 0]}
                  material={m.darkStone}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[run, height + 3, 5]} />
                </mesh>
              );
            })}

            {/* The weir at the low end of this run. Where the ground is level
                between two basins this is a nub; on the hill it is a dam. */}
            {basin.weirHeightFt > 0.3 && (
              <mesh
                position={[mid.x, basin.waterY - basin.weirHeightFt / 2 + 0.4, mid.z]}
                rotation={[0, rotationY, 0]}
                material={m.darkStone}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[span, basin.weirHeightFt + 3.6, 4]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * The crossings
 * ------------------------------------------------------------------ */

/**
 * A drawbridge, run by its counterweight.
 *
 * The leaf is hinged at the sill. Chains from its outer end pass over a gaff
 * above the gate and down to a crate of sandbags in a guide frame. Let the
 * crate go and it drops; the leaf comes up. Winch it back and the leaf goes
 * down. The cycle below is slow enough to read as machinery.
 */
function Bridge({ bridge, m }: { bridge: BridgeFeature; m: Materials }) {
  const leaf = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);
  const crate = useRef<THREE.Group>(null);
  const chainL = useRef<THREE.Mesh>(null);
  const chainR = useRef<THREE.Mesh>(null);

  const dx = bridge.from.x - bridge.to.x;
  const dz = bridge.from.z - bridge.to.z;
  const span = Math.hypot(dx, dz);
  // Local +X runs out across the moat from the hinge.
  const rotationY = Math.atan2(-dz, dx);

  const pivotY = bridge.gaffHeightFt;
  const outerArmFt = 17;
  const innerArmFt = bridge.counterweightArmFt;
  const hangFt = 5;
  const swing = 0.4;

  useFrame((state) => {
    if (!bridge.drawbridge) return;
    const period = 26;
    const t = (state.clock.elapsedTime % period) / period;
    // Down, rising, up, lowering. Slow enough to read as machinery.
    const raised =
      t < 0.34 ? 0 : t < 0.46 ? (t - 0.34) / 0.12 : t < 0.86 ? 1 : 1 - (t - 0.86) / 0.14;
    const angle = raised * (Math.PI / 2) * 0.94;
    // The rocking beam: crate end high with the bridge down, and it drops as
    // the leaf comes up. The bags are the power; the chain is the linkage.
    const beamAngle = -swing + raised * swing * 2;

    if (leaf.current) leaf.current.rotation.z = angle;
    if (beam.current) beam.current.rotation.z = beamAngle;
    if (crate.current) {
      crate.current.position.set(
        -2 - Math.cos(beamAngle) * innerArmFt,
        pivotY - Math.sin(beamAngle) * innerArmFt - hangFt,
        0,
      );
    }

    // Chains run from the beam's outer end to the leaf's outer end, wherever
    // the two of them happen to be.
    const headX = -2 + Math.cos(beamAngle) * outerArmFt;
    const headY = pivotY + Math.sin(beamAngle) * outerArmFt;
    const tipX = Math.cos(angle) * span;
    const tipY = Math.sin(angle) * span;
    for (const ref of [chainL, chainR]) {
      const mesh = ref.current;
      if (!mesh) continue;
      const from = new THREE.Vector3(headX, headY, mesh.position.z);
      const to = new THREE.Vector3(tipX, tipY, mesh.position.z);
      const middle = from.clone().add(to).multiplyScalar(0.5);
      mesh.position.set(middle.x, middle.y, mesh.position.z);
      mesh.scale.y = from.distanceTo(to);
      mesh.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    }
  });

  const half = bridge.widthFt / 2;
  // How far the far bank sits below the sill, which is what the abutment has
  // to make up before the leaf can be level.
  const drop = bridge.from.y - bridge.to.y;

  return (
    <group position={[bridge.to.x, bridge.to.y, bridge.to.z]} rotation={[0, rotationY, 0]}>
      {/* Abutment under the far end.

          A bascule leaf has to be level with its own sill, and on this hill
          the far bank of the moat is not: at the water gate the ground falls
          twenty-odd feet between the two. So the landing is a masonry
          abutment carried up from grade, and the causeway meets it there. */}
      <mesh
        position={[span - 1, (drop - 5) / 2, 0]}
        material={m.darkStone}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[7, Math.abs(drop) + 5, bridge.widthFt + 4]} />
      </mesh>

      <group ref={leaf}>
        <mesh position={[span / 2, 0.3, 0]} material={m.timber} castShadow receiveShadow>
          <boxGeometry args={[span, 1, bridge.widthFt]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[span / 2, 2.2, side * half]}
            material={m.timber}
            castShadow
          >
            <boxGeometry args={[span, 0.5, 0.5]} />
          </mesh>
        ))}
      </group>

      {bridge.drawbridge && (
        <group>
          {/* The frame the rocking beam pivots on, standing over the gate. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[-2, pivotY / 2, side * (half + 2)]}
              material={m.timber}
              castShadow
            >
              <boxGeometry args={[1.8, pivotY, 1.8]} />
            </mesh>
          ))}
          <mesh position={[-2, pivotY, 0]} material={m.timber} castShadow>
            <boxGeometry args={[3, 2, bridge.widthFt + 7]} />
          </mesh>

          {/* The beam itself: long arm over the bridge, short arm inboard
              carrying the sandbags. */}
          <group ref={beam} position={[-2, pivotY, 0]}>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[(outerArmFt - innerArmFt) / 2, 0, side * 3.6]}
                material={m.timber}
                castShadow
              >
                <boxGeometry args={[outerArmFt + innerArmFt, 1.5, 1.5]} />
              </mesh>
            ))}
          </group>

          {[chainL, chainR].map((ref, i) => (
            <mesh
              key={i}
              ref={ref}
              position={[0, pivotY, (i === 0 ? -1 : 1) * (half - 0.6)]}
              material={m.iron}
            >
              <cylinderGeometry args={[0.22, 0.22, 1, 6]} />
            </mesh>
          ))}

          {/* The sandbag crate. It drops to lift the bridge and is winched
              back up to lower it — the whole mechanism in one moving box. */}
          <group ref={crate} position={[-2 - innerArmFt, pivotY - hangFt, 0]}>
            <mesh material={m.timber} castShadow>
              <boxGeometry args={[6.5, 5, 7]} />
            </mesh>
            {[-2, 0, 2].map((z) =>
              [-1.6, 1.6].map((x) =>
                [0, 1].map((tier) => (
                  <mesh
                    key={`${x}:${z}:${tier}`}
                    position={[x, 2.9 + tier * 0.95, z + (tier ? 0.5 : 0)]}
                    material={m.sandbag}
                    castShadow
                  >
                    <boxGeometry args={[2.7, 0.9, 1.8]} />
                  </mesh>
                )),
              ),
            )}
            {/* The hanger, so the crate reads as hung rather than floating. */}
            <mesh position={[0, hangFt / 2 + 2.5, 0]} material={m.iron}>
              <cylinderGeometry args={[0.24, 0.24, hangFt, 6]} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * The guard
 * ------------------------------------------------------------------ */

function Knight({ knight, m }: { knight: KnightFeature; m: Materials }) {
  const h = knight.heightFt;
  const livery = useMemo(
    () => new THREE.MeshStandardMaterial({ color: hsl(knight.hue, 0.55, 0.42), roughness: 0.8 }),
    [knight.hue],
  );
  useEffect(() => () => livery.dispose(), [livery]);

  return (
    <group
      position={[knight.position.x, knight.position.y, knight.position.z]}
      rotation={[0, knight.rotationY, 0]}
    >
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, h * 0.22, side * 0.5]} material={m.armour} castShadow>
          <cylinderGeometry args={[0.32, 0.28, h * 0.44, 7]} />
        </mesh>
      ))}
      <mesh position={[0, h * 0.62, 0]} material={m.armour} castShadow>
        <boxGeometry args={[1.1, h * 0.36, 1.9]} />
      </mesh>
      {/* Surcoat in the livery of the gate this one is posted on. */}
      <mesh position={[0.62, h * 0.6, 0]} material={livery} castShadow>
        <boxGeometry args={[0.16, h * 0.3, 1.7]} />
      </mesh>
      <mesh position={[0, h * 0.86, 0]} material={m.armour} castShadow>
        <cylinderGeometry args={[0.46, 0.5, h * 0.16, 8]} />
      </mesh>
      <mesh position={[0.34, h * 0.87, 0]} material={m.brass}>
        <boxGeometry args={[0.2, 0.16, 0.7]} />
      </mesh>
      {/* Pike, butt on the ground, and a shield on the off arm. */}
      <mesh position={[0.1, h * 0.62, -1.15]} rotation={[0.1, 0, 0]} material={m.timber} castShadow>
        <cylinderGeometry args={[0.11, 0.11, h * 1.5, 6]} />
      </mesh>
      <mesh position={[0.1, h * 1.42, -1.15]} material={m.armour} castShadow>
        <coneGeometry args={[0.22, 1.5, 6]} />
      </mesh>
      <mesh position={[-0.1, h * 0.6, 1.25]} rotation={[0, 0, 0.12]} material={livery} castShadow>
        <boxGeometry args={[0.24, 2.5, 1.7]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * The torches
 * ------------------------------------------------------------------ */

const FLAME_SEGMENTS = 7;

/**
 * Every torch on the property in four instanced meshes: post, bowl, and two
 * nested flame cones. Colour rides in the instance buffer, so a rainbow run of
 * seventy torches costs the same as one.
 */
function Torches({ torches, night }: { torches: TorchFeature[]; night: boolean }) {
  const postRef = useRef<THREE.InstancedMesh>(null);
  const bowlRef = useRef<THREE.InstancedMesh>(null);
  const outerRef = useRef<THREE.InstancedMesh>(null);
  const innerRef = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);

  const geometry = useMemo(
    () => ({
      post: new THREE.CylinderGeometry(0.2, 0.28, 1, 6),
      bowl: new THREE.CylinderGeometry(0.62, 0.36, 0.8, 8),
      outer: new THREE.ConeGeometry(1, 1, FLAME_SEGMENTS, 1, true),
      inner: new THREE.ConeGeometry(0.55, 0.7, FLAME_SEGMENTS, 1, true),
    }),
    [],
  );

  const material = useMemo(
    () => ({
      post: new THREE.MeshStandardMaterial({ color: '#4b4038', roughness: 0.9 }),
      bowl: new THREE.MeshStandardMaterial({
        color: '#7a6134',
        roughness: 0.42,
        metalness: 0.7,
      }),
      outer: new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      inner: new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      for (const g of Object.values(geometry)) g.dispose();
      for (const mat of Object.values(material)) mat.dispose();
    },
    [geometry, material],
  );

  /* Static parts: post and bowl never move. */
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scratch = new THREE.Vector3();
    for (const [i, t] of torches.entries()) {
      quaternion.identity();
      matrix.compose(
        scratch.set(t.position.x, t.position.y + t.heightFt / 2, t.position.z),
        quaternion,
        new THREE.Vector3(1, t.heightFt, 1),
      );
      postRef.current?.setMatrixAt(i, matrix);
      matrix.compose(
        scratch.set(t.position.x, t.position.y + t.heightFt + 0.3, t.position.z),
        quaternion,
        new THREE.Vector3(1, 1, 1),
      );
      bowlRef.current?.setMatrixAt(i, matrix);
    }
    if (postRef.current) postRef.current.instanceMatrix.needsUpdate = true;
    if (bowlRef.current) bowlRef.current.instanceMatrix.needsUpdate = true;
  }, [torches]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      colour: new THREE.Color(),
    }),
    [],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    for (const [i, torch] of torches.entries()) {
      const seed = i * 1.37;
      const t = time + seed;
      const flicker = 1 + 0.2 * Math.sin(t * 7.9) + 0.12 * Math.sin(t * 12.3 + seed);
      // A kerosene flame is taller and narrower than a gas pan fire, and a
      // torch that burns more fuel burns bigger — which is why the ones on the
      // drums and the gates read from across the property and the ones along
      // the wall head only pick out the line of it.
      const height = (1.7 + torch.gphKerosene * 9) * flicker;
      const radius = 0.5 + torch.gphKerosene + 0.06 * Math.sin(t * 5.1);
      const base = torch.position.y + torch.heightFt + 0.8;

      scratch.quaternion.setFromAxisAngle(UP, t * 0.7);
      scratch.matrix.compose(
        scratch.position.set(torch.position.x, base + height / 2, torch.position.z),
        scratch.quaternion,
        scratch.scale.set(radius, height, radius),
      );
      outer.setMatrixAt(i, scratch.matrix);

      scratch.quaternion.setFromAxisAngle(UP, -t * 0.9);
      scratch.matrix.compose(
        scratch.position.set(torch.position.x, base + height * 0.36, torch.position.z),
        scratch.quaternion,
        scratch.scale.set(radius, height, radius),
      );
      inner.setMatrixAt(i, scratch.matrix);

      const hue = torch.rainbow ? torch.hue + (time / 19) * 360 : torch.hue;
      outer.setColorAt(i, scratch.colour.setHSL((((hue % 360) + 360) / 360) % 1, 0.95, 0.5));
      inner.setColorAt(i, scratch.colour.setHSL(((((hue + 16) % 360) + 360) / 360) % 1, 0.5, 0.82));

      const light = lights.current[i];
      if (light) light.intensity = (night ? 130 : 34) * flicker;
    }
    outer.instanceMatrix.needsUpdate = true;
    inner.instanceMatrix.needsUpdate = true;
    if (outer.instanceColor) outer.instanceColor.needsUpdate = true;
    if (inner.instanceColor) inner.instanceColor.needsUpdate = true;
  });

  if (torches.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={postRef}
        args={[geometry.post, material.post, torches.length]}
        castShadow
      />
      <instancedMesh ref={bowlRef} args={[geometry.bowl, material.bowl, torches.length]} />
      <instancedMesh ref={outerRef} args={[geometry.outer, material.outer, torches.length]} />
      <instancedMesh ref={innerRef} args={[geometry.inner, material.inner, torches.length]} />
      {torches.map((torch, i) =>
        torch.castLight ? (
          <pointLight
            key={torch.id}
            ref={(node) => {
              lights.current[i] = node;
            }}
            position={[torch.position.x, torch.position.y + torch.heightFt + 2, torch.position.z]}
            color={hsl(torch.hue, 0.8, 0.6)}
            distance={70}
            decay={2}
          />
        ) : null,
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */

export function OuterWorks({
  layout,
  layers,
  night,
}: {
  layout: Layout;
  layers: Record<ModelLayer, boolean>;
  night: boolean;
}) {
  const m = useOuterMaterials();
  useEffect(
    () => () => {
      for (const material of Object.values(m)) material.dispose();
    },
    [m],
  );

  const walls = featuresOfKind(layout.features, 'enceinte');
  const basins = featuresOfKind(layout.features, 'moat');
  const bridges = featuresOfKind(layout.features, 'bridge');
  const knights = featuresOfKind(layout.features, 'knight');
  const torches = featuresOfKind(layout.features, 'torch');

  return (
    <group>
      {layers.outerWall && walls.map((w) => <Enceinte key={w.id} wall={w} m={m} />)}
      {layers.moat && basins.length > 0 && <Moat basins={basins} m={m} />}
      {layers.bridges && bridges.map((b) => <Bridge key={b.id} bridge={b} m={m} />)}
      {layers.knights && knights.map((k) => <Knight key={k.id} knight={k} m={m} />)}
      {layers.torches && <Torches torches={torches} night={night} />}
    </group>
  );
}
