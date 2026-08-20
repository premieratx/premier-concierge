import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DragonFeature } from '../domain/types';
import { FireBreath } from './Fire';

type P = [number, number, number];

/**
 * Nominal dimensions the anatomy below is drawn at. Everything scales from
 * these, so the same beast works at any size the feature asks for.
 */
const NOMINAL = { lengthFt: 48, wingspanFt: 58, shoulderHeightFt: 14 };

/**
 * The spine, tail first: [x, y, z, radius] in feet, facing +Z.
 *
 * Used pipe, swaged down as it runs out to the tail, with wheel rims welded on
 * at the joints. The pose is a rear — hips low and back, chest lifted, neck
 * thrown up and forward so the head clears the gatehouse and the jet goes out
 * over open water rather than over anyone's head.
 */
const SPINE: [number, number, number, number][] = [
  [0, 2.0, -26, 0.35],
  [0, 3.4, -20, 0.6],
  [0, 5.2, -14, 1.0],
  [0, 8.0, -8.5, 1.7],
  [0, 10.8, -3.0, 2.4],
  [0, 12.8, 1.5, 2.3],
  [0, 14.5, 4.5, 1.7],
  [0, 18.0, 6.5, 1.1],
  [0, 21.5, 8.5, 0.9],
  [0, 24.0, 11.0, 0.8],
  [0, 25.0, 14.0, 0.7],
  [0, 24.4, 17.0, 0.5],
];

/** Spine indices that get a wheel rim welded round the joint. */
const RIM_JOINTS = [1, 2, 3, 6, 7, 8, 9];
/** Spine indices that get a hubcap stood on edge as a dorsal scale. */
const SCALE_JOINTS = [3, 4, 5, 6, 7, 8, 9];

const MOUTH: P = [0, 24.0, 19.2];

/**
 * The wing: exhaust pipe for the arm and the fingers, car hoods and doors
 * stretched between them. The elbow puts a fold in the surface so the two
 * halves catch the light differently and it stops reading as one flat sheet.
 */
const WING_ROOT: P = [1.7, 14.0, 3.5];
const WING_ELBOW: P = [9.5, 21.5, 5.5];
const WING_TIPS: P[] = [
  [15, 27.5, 9],
  [24, 25.0, 3],
  [29, 19.0, -4.5],
  [25, 13.0, -11.0],
  [17, 9.0, -15.0],
];

const LEGS: { hip: P; knee: P; foot: P; r: number }[] = [
  { hip: [2.2, 7.8, -8], knee: [4.6, 3.6, -10.5], foot: [5.2, 0.6, -7], r: 0.85 },
  { hip: [2.0, 12.0, 1.5], knee: [3.8, 5.6, 3.6], foot: [4.4, 0.6, 5.2], r: 0.65 },
];

const HORNS: { base: P; tip: P }[] = [
  { base: [0.9, 26.0, 14.2], tip: [3.1, 29.8, 9.6] },
  { base: [0.7, 25.0, 15.4], tip: [2.4, 27.4, 11.2] },
];

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

function between(a: P, b: P) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const length = dir.length();
  return { mid: va.clone().add(vb).multiplyScalar(0.5), dir: dir.normalize(), length };
}

/** A length of pipe or exhaust tube between two points. */
function Pipe({
  a,
  b,
  ra,
  rb,
  material,
  segments = 9,
}: {
  a: P;
  b: P;
  ra: number;
  rb: number;
  material: THREE.Material;
  segments?: number;
}) {
  const { mid, dir, length } = useMemo(() => between(a, b), [a, b]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, dir),
    [dir],
  );
  return (
    <mesh position={mid} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[rb, ra, length, segments, 1]} />
    </mesh>
  );
}

/** A wheel rim, welded round a joint. */
function Rim({
  center,
  axis,
  radius,
  tube,
  material,
}: {
  center: P;
  axis: THREE.Vector3;
  radius: number;
  tube: number;
  material: THREE.Material;
}) {
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(FORWARD, axis.clone().normalize()),
    [axis],
  );
  return (
    <mesh position={center} quaternion={quaternion} material={material} castShadow>
      <torusGeometry args={[radius, tube, 8, 16]} />
    </mesh>
  );
}

/** A brake disc or a hubcap: a short cylinder on an arbitrary axis. */
function Disc({
  center,
  axis,
  radius,
  thickness,
  material,
}: {
  center: P;
  axis: THREE.Vector3;
  radius: number;
  thickness: number;
  material: THREE.Material;
}) {
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().normalize()),
    [axis],
  );
  return (
    <mesh position={center} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[radius, radius, thickness, 14]} />
    </mesh>
  );
}

/** A flat panel — a hood, a door, a leaf off a spring pack. */
function Plate({
  center,
  size,
  rotation,
  material,
}: {
  center: P;
  size: P;
  rotation?: P;
  material: THREE.Material;
}) {
  return (
    <mesh position={center} rotation={rotation ?? [0, 0, 0]} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** One bay of wing membrane, cut from whatever panel came off the donor. */
function Membrane({ points, material }: { points: P[]; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      verts.push(...points[0]!, ...points[i]!, ...points[i + 1]!);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [points]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

function mirror(p: P): P {
  return [-p[0], p[1], p[2]];
}

export interface DragonProps {
  feature: DragonFeature;
  /** Dimmed in daylight, blazing at night. */
  night: boolean;
  /** The flame is its own layer, so it can be turned off on its own. */
  showFire: boolean;
}

/**
 * The dragon: a scrap-metal beast, not a fabricated sculpture.
 *
 * Every part is something that was already manufactured and then thrown away
 * — hoods, doors, wheel rims, leaf springs, exhaust tube, brake discs,
 * headlights, chain — welded onto a used-pipe spine and left in the donor
 * cars' own faded paint. That mixed-paint patchwork is the whole visual idea:
 * it is what tells you at fifty yards that this thing was assembled out of a
 * junkyard rather than ordered from a foundry.
 */
export function Dragon({ feature, night, showFire }: DragonProps) {
  const group = useRef<THREE.Group>(null);

  const scale = useMemo(
    () =>
      new THREE.Vector3(
        feature.wingspanFt / NOMINAL.wingspanFt,
        feature.shoulderHeightFt / NOMINAL.shoulderHeightFt,
        feature.lengthFt / NOMINAL.lengthFt,
      ),
    [feature.wingspanFt, feature.shoulderHeightFt, feature.lengthFt],
  );

  const m = useMemo(() => {
    const paint = (color: string, roughness = 0.68, side: THREE.Side = THREE.FrontSide) =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness, side });
    const donorColors = ['#8f3f34', '#6b6e73', '#c2bba6', '#7d4a29', '#3f5668', '#94794a'];
    return {
      // Whatever colour the donor arrived in.
      donor: donorColors.map((c) => paint(c, c === '#7d4a29' ? 0.85 : 0.68)),
      /**
       * The same paints for the wing membrane. A panel cut from a car door is
       * a single surface you can stand on either side of, so these have to
       * render both ways or the wing vanishes from behind.
       */
      donorPanel: donorColors.map((c) => paint(c, 0.72, THREE.DoubleSide)),
      pipe: new THREE.MeshStandardMaterial({ color: '#8a8f97', metalness: 0.55, roughness: 0.52 }),
      rust: new THREE.MeshStandardMaterial({ color: '#8c5730', metalness: 0.25, roughness: 0.9 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#cfd4da', metalness: 0.9, roughness: 0.22 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#1d1f22', metalness: 0.1, roughness: 0.95 }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347'), toneMapped: false }),
    };
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    // A slow settle, as if it were shifting its weight. Steel this size moves
    // a little in the wind and a lot in the imagination.
    group.current.rotation.z = 0.014 * Math.sin(t * 0.42);
    group.current.rotation.x = 0.009 * Math.sin(t * 0.31 + 1.1);
  });

  const wingBays = useMemo(() => {
    const bays: P[][] = [];
    for (let i = 0; i < WING_TIPS.length - 1; i++) {
      const a = WING_TIPS[i]!;
      const b = WING_TIPS[i + 1]!;
      // Pull the trailing edge in toward the elbow so each bay scallops rather
      // than running straight from tip to tip.
      const scallop: P = [0, 1, 2].map((k) => {
        const mid = (a[k]! + b[k]!) / 2;
        return mid + (WING_ELBOW[k]! - mid) * 0.14;
      }) as P;
      bays.push([WING_ELBOW, a, scallop, b]);
    }
    bays.push([WING_ROOT, WING_ELBOW, WING_TIPS.at(-1)!]);
    return bays;
  }, []);

  /** Direction of the spine at a given point, for orienting rims and caps. */
  const spineAxis = (i: number) => {
    const a = SPINE[Math.max(0, i - 1)]!;
    const b = SPINE[Math.min(SPINE.length - 1, i + 1)]!;
    return new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  };

  return (
    <group
      position={[feature.position.x, feature.position.y, feature.position.z]}
      rotation={[0, feature.rotationY, 0]}
    >
      <group ref={group} scale={scale}>
        {/* Spine: pipe, swaged down toward the tail. */}
        {SPINE.slice(0, -1).map((p, i) => {
          const q = SPINE[i + 1]!;
          return (
            <Pipe
              key={`spine-${i}`}
              a={[p[0], p[1], p[2]]}
              b={[q[0], q[1], q[2]]}
              ra={p[3]}
              rb={q[3]}
              material={i < 3 ? m.rust : m.pipe}
            />
          );
        })}

        {/* Wheel rims welded round the joints. */}
        {RIM_JOINTS.map((i) => {
          const p = SPINE[i]!;
          return (
            <Rim
              key={`rim-${i}`}
              center={[p[0], p[1], p[2]]}
              axis={spineAxis(i)}
              radius={p[3] + 0.55}
              tube={0.28}
              material={i % 2 === 0 ? m.chrome : m.rust}
            />
          );
        })}

        {/* Hubcaps stood on edge down the back. */}
        {SCALE_JOINTS.map((i) => {
          const p = SPINE[i]!;
          return (
            <Disc
              key={`scale-${i}`}
              center={[p[0], p[1] + p[3] + 0.7, p[2]]}
              axis={new THREE.Vector3(1, 0, 0)}
              radius={0.55 + p[3] * 0.3}
              thickness={0.16}
              material={m.chrome}
            />
          );
        })}

        {/* Body: an old tank, with door skins hung off the flanks as ribs. */}
        <Disc
          center={[0, 11, -0.5]}
          axis={new THREE.Vector3(0, 0, 1)}
          radius={3.5}
          thickness={11}
          material={m.donor[3]!}
        />
        {[1, -1].map((side) =>
          [0, 1, 2].map((i) => (
            <Plate
              key={`flank-${side}-${i}`}
              center={[side * 3.3, 10.4 - i * 0.4, -4 + i * 3.6]}
              size={[0.25, 4.4, 3.2]}
              rotation={[0, 0, side * 0.12]}
              material={m.donor[i % m.donor.length]!}
            />
          )),
        )}

        {/* Head: a hood for a skull, headlights for eyes, chain for teeth. */}
        <Plate
          center={[0, 25.3, 15.2]}
          size={[2.6, 1.3, 4.4]}
          rotation={[0.12, 0, 0]}
          material={m.donor[0]!}
        />
        <Plate
          center={[0, 24.0, 15.8]}
          size={[2.1, 0.6, 3.6]}
          rotation={[-0.16, 0, 0]}
          material={m.donor[1]!}
        />
        <Plate center={[0, 24.7, 17.7]} size={[1.7, 1.1, 0.3]} material={m.chrome} />
        {[1, -1].map((side) => (
          <mesh key={`eye-${side}`} position={[side * 0.95, 25.9, 16.5]} material={m.lamp}>
            <sphereGeometry args={[0.5, 12, 12]} />
          </mesh>
        ))}
        {Array.from({ length: 6 }, (_, i) => {
          const side = i < 3 ? 1 : -1;
          const k = i % 3;
          return (
            <mesh
              key={`tooth-${i}`}
              position={[side * (0.5 + k * 0.25), 24.45, 16.8 - k * 0.9]}
              rotation={[Math.PI, 0, 0]}
              material={m.chrome}
              castShadow
            >
              <coneGeometry args={[0.16, 0.75, 5]} />
            </mesh>
          );
        })}
        {HORNS.flatMap((h, i) =>
          [1, -1].map((side) => (
            <Pipe
              key={`horn-${i}-${side}`}
              a={side === 1 ? h.base : mirror(h.base)}
              b={side === 1 ? h.tip : mirror(h.tip)}
              ra={0.42}
              rb={0.14}
              material={m.chrome}
              segments={7}
            />
          )),
        )}

        {/* Wings: exhaust-tube frame, donor panels stretched between. */}
        {[1, -1].map((side) => (
          <group key={`wing-${side}`} scale={[side, 1, 1]}>
            <Pipe a={WING_ROOT} b={WING_ELBOW} ra={0.85} rb={0.6} material={m.pipe} />
            {WING_TIPS.map((tip, i) => (
              <Pipe
                key={`finger-${i}`}
                a={WING_ELBOW}
                b={tip}
                ra={0.5}
                rb={0.14}
                material={m.pipe}
                segments={7}
              />
            ))}
            <Rim
              center={WING_ELBOW}
              axis={new THREE.Vector3(0.2, 0.4, 1)}
              radius={1.15}
              tube={0.24}
              material={m.chrome}
            />
            {wingBays.map((bay, i) => (
              <Membrane
                key={`bay-${i}`}
                points={bay}
                material={m.donorPanel[i % m.donorPanel.length]!}
              />
            ))}
          </group>
        ))}

        {/* Legs: leaf-spring thighs, rim knees, brake-disc feet. */}
        {[1, -1].map((side) =>
          LEGS.map((leg, i) => {
            const hip = side === 1 ? leg.hip : mirror(leg.hip);
            const knee = side === 1 ? leg.knee : mirror(leg.knee);
            const foot = side === 1 ? leg.foot : mirror(leg.foot);
            const thigh = between(hip, knee);
            const thighQ = new THREE.Quaternion().setFromUnitVectors(UP, thigh.dir);
            return (
              <group key={`leg-${side}-${i}`}>
                {[0, 1, 2].map((leaf) => (
                  <mesh
                    key={`leaf-${leaf}`}
                    position={thigh.mid.clone().addScaledVector(
                      new THREE.Vector3(side * 0.35, 0, 0),
                      leaf - 1,
                    )}
                    quaternion={thighQ}
                    material={m.rust}
                    castShadow
                  >
                    <boxGeometry args={[0.28, thigh.length * (1 - leaf * 0.13), leg.r * 1.9]} />
                  </mesh>
                ))}
                <Rim
                  center={knee}
                  axis={new THREE.Vector3(1, 0, 0)}
                  radius={leg.r * 1.5}
                  tube={0.26}
                  material={m.rubber}
                />
                <Pipe a={knee} b={foot} ra={leg.r * 0.9} rb={leg.r * 0.6} material={m.pipe} />
                <Disc
                  center={[foot[0], 0.35, foot[2] + 0.6]}
                  axis={UP}
                  radius={leg.r * 2.1}
                  thickness={0.5}
                  material={m.chrome}
                />
                {[-0.8, 0, 0.8].map((dx, c) => (
                  <mesh
                    key={`claw-${c}`}
                    position={[foot[0] + dx, 0.4, foot[2] + leg.r * 2.4]}
                    rotation={[Math.PI / 2.2, 0, 0]}
                    material={m.chrome}
                    castShadow
                  >
                    <coneGeometry args={[0.2, 1.4, 5]} />
                  </mesh>
                ))}
              </group>
            );
          }),
        )}

        {/* Tail fan: three spring leaves splayed off the last joint. */}
        {[-0.5, 0, 0.5].map((tilt, i) => (
          <Plate
            key={`tailfan-${i}`}
            center={[0, 3.4 + i * 0.6, -27.5]}
            size={[0.22, 3.6, 5.4]}
            rotation={[0.3, 0, tilt]}
            material={m.donor[(i + 2) % m.donor.length]!}
          />
        ))}

        {feature.breathingFire && showFire && (
          <FireBreath
            origin={MOUTH}
            direction={[0, -0.12, 1]}
            lengthFt={feature.lengthFt * 0.75}
            periodS={feature.burstPeriodS}
            seed={0}
          />
        )}
      </group>

      {/* A low uplight on the plinth so the thing reads after dark. */}
      {night && (
        <>
          <pointLight position={[0, 2, 8]} color="#ff7a2e" intensity={90} distance={70} decay={2} />
          <pointLight position={[0, 2, -12]} color="#3d7bff" intensity={55} distance={60} decay={2} />
        </>
      )}

      {/* Plinth */}
      <mesh position={[0, 0.6, -2]} receiveShadow castShadow>
        <cylinderGeometry args={[13, 14.5, 1.2, 32]} />
        <meshStandardMaterial color="#6b6459" roughness={0.95} />
      </mesh>
    </group>
  );
}
