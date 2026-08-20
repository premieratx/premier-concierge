import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DragonFeature } from '../domain/types';
import { FireBreath } from './Fire';

type P = [number, number, number];

/**
 * Nominal dimensions the anatomy below is drawn at. Everything is scaled from
 * these to whatever the feature asks for, so a 150-foot dragon and a 40-foot
 * one are the same beast at different sizes.
 */
const NOMINAL = { lengthFt: 150, wingspanFt: 186, shoulderHeightFt: 52 };

/**
 * The spine, nose first: [x, y, z, radius] in feet, facing +Z.
 *
 * The pose is a rear — hips low and back, chest lifted, neck thrown up and
 * forward so the head clears the gatehouse and the jet goes out over open
 * water rather than over anyone's head.
 */
const SPINE: [number, number, number, number][] = [
  [0, 71, 62, 1.3],
  [0, 72.5, 56, 2.3],
  [0, 73.5, 48, 3.3],
  [0, 70, 40, 3.7],
  [0, 64, 32.5, 4.3],
  [0, 56.5, 25, 5.2],
  [0, 49, 17, 7.0],
  [0, 44, 8, 8.6],
  [0, 39, -3, 9.2],
  [0, 32, -15, 8.0],
  [0, 24, -28, 6.2],
  [0, 17, -43, 4.4],
  [0, 11, -58, 2.8],
  [0, 7, -70, 1.6],
  [0, 5, -79, 0.6],
];

/** Where the neck stops and the head begins, as an index into SPINE. */
const HEAD_INDEX = 2;
const MOUTH: P = [0, 70.6, 63];

/**
 * The wing: a heavy arm from the shoulder out to an elbow, then a spread of
 * finger spars from the elbow to the wingtips. Membrane spans between them.
 *
 * The elbow is what stops the wing reading as a flat black sheet — it puts a
 * fold in the surface so the two halves catch the light differently.
 * Mirrored for the other side.
 */
const WING_ROOT: P = [5, 49, 12];
const WING_ELBOW: P = [33, 69, 22];
const WING_SPARS: { tip: P; width: number }[] = [
  { tip: [50, 84, 32], width: 1.3 },
  { tip: [82, 78, 16], width: 1.1 },
  { tip: [96, 62, -6], width: 1.0 },
  { tip: [85, 44, -26], width: 0.9 },
  { tip: [58, 30, -40], width: 0.8 },
];

/** How far the trailing edge scallops in between two finger tips, 0..1. */
const MEMBRANE_SCALLOP = 0.14;

const LEGS: { hip: P; knee: P; foot: P; r: number }[] = [
  { hip: [7, 31, -14], knee: [15, 16, -20], foot: [17, 0, -14], r: 3.2 },
  { hip: [6.5, 40, 6], knee: [12, 22, 10], foot: [13, 0, 14], r: 2.4 },
];

const HORNS: { base: P; tip: P }[] = [
  { base: [2.4, 76, 46], tip: [7, 84, 32] },
  { base: [1.6, 73, 49], tip: [5.5, 78, 36] },
];

interface BoneProps {
  a: P;
  b: P;
  ra: number;
  rb: number;
  material: THREE.Material;
  segments?: number;
}

/** A tapered tube between two points — one vertebra, one limb, one spar. */
function Bone({ a, b, ra, rb, material, segments = 10 }: BoneProps) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    return {
      position: va.clone().add(vb).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      ),
      length: len,
    };
  }, [a, b]);

  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[rb, ra, length, segments, 1]} />
    </mesh>
  );
}

/** One triangulated panel of wing membrane. */
function Membrane({
  points,
  material,
}: {
  points: P[];
  material: THREE.Material;
}) {
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
}

/**
 * The dragon: a welded steel sculpture, not a creature model.
 *
 * It is built the way the real thing would be — a spine of tapered tube, ribs
 * and limbs hung off it, plate membrane stretched between wing spars — so
 * what you see on screen is roughly what a fabricator would be quoting. The
 * design is original: a long-necked four-limbed wyvern, not a reproduction of
 * any particular film or television creature.
 */
export function Dragon({ feature, night }: DragonProps) {
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

  const steel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4a5158',
        metalness: 0.92,
        roughness: 0.38,
      }),
    [],
  );

  const patina = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5c4a3a',
        metalness: 0.75,
        roughness: 0.62,
      }),
    [],
  );

  const membrane = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#63504a',
        metalness: 0.35,
        roughness: 0.78,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const eye = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9d2e'), toneMapped: false }),
    [],
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    // A slow settle, as if it were shifting its weight. Steel this size moves
    // a little in the wind and a lot in the imagination.
    group.current.rotation.z = 0.012 * Math.sin(t * 0.42);
    group.current.rotation.x = 0.008 * Math.sin(t * 0.31 + 1.1);
  });

  const wingPanels = useMemo(() => {
    const panels: P[][] = [];
    for (let i = 0; i < WING_SPARS.length - 1; i++) {
      const a = WING_SPARS[i]!.tip;
      const b = WING_SPARS[i + 1]!.tip;
      // Pull the trailing edge in toward the elbow so each bay scallops
      // instead of running straight from tip to tip.
      const scallop: P = [0, 1, 2].map((k) => {
        const mid = (a[k]! + b[k]!) / 2;
        return mid + (WING_ELBOW[k]! - mid) * MEMBRANE_SCALLOP;
      }) as P;
      panels.push([WING_ELBOW, a, scallop, b]);
    }
    // The sail from the last finger back to the body.
    panels.push([WING_ROOT, WING_ELBOW, WING_SPARS.at(-1)!.tip]);
    return panels;
  }, []);

  return (
    <group
      position={[feature.position.x, feature.position.y, feature.position.z]}
      rotation={[0, feature.rotationY, 0]}
    >
      <group ref={group} scale={scale}>
        {/* Spine */}
        {SPINE.slice(0, -1).map((p, i) => {
          const q = SPINE[i + 1]!;
          return (
            <Bone
              key={`spine-${i}`}
              a={[p[0], p[1], p[2]]}
              b={[q[0], q[1], q[2]]}
              ra={p[3]}
              rb={q[3]}
              material={i <= HEAD_INDEX ? steel : patina}
            />
          );
        })}

        {/* Dorsal spikes, tapering down the back and out along the tail. */}
        {SPINE.slice(4, 13).map((p, i) => (
          <mesh
            key={`spike-${i}`}
            position={[p[0], p[1] + p[3] * 0.9, p[2]]}
            rotation={[-0.5, 0, 0]}
            material={steel}
            castShadow
          >
            <coneGeometry args={[Math.max(0.5, p[3] * 0.28), Math.max(2, p[3] * 1.5), 6]} />
          </mesh>
        ))}

        {/* Jaw and head plate */}
        <Bone a={[0, 69, 48]} b={[0, 66.5, 61]} ra={2.6} rb={0.9} material={steel} />
        <mesh position={[0, 73.8, 47]} material={steel} castShadow>
          <boxGeometry args={[6.4, 3.6, 9]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={`eye-${s}`} position={[s * 2.6, 74.6, 50.5]} material={eye}>
            <sphereGeometry args={[0.85, 12, 12]} />
          </mesh>
        ))}
        {HORNS.flatMap((h, i) =>
          [h.base, mirror(h.base)].map((base, s) => (
            <Bone
              key={`horn-${i}-${s}`}
              a={base}
              b={s === 0 ? h.tip : mirror(h.tip)}
              ra={1.5}
              rb={0.25}
              material={steel}
              segments={7}
            />
          )),
        )}

        {/* Wings: spars, then the membrane stretched between them. */}
        {[1, -1].map((side) => (
          <group key={`wing-${side}`} scale={[side, 1, 1]}>
            <Bone a={WING_ROOT} b={WING_ELBOW} ra={4.2} rb={2.6} material={steel} segments={8} />
            {WING_SPARS.map((spar, i) => (
              <Bone
                key={`spar-${i}`}
                a={WING_ELBOW}
                b={spar.tip}
                ra={spar.width * 2.2}
                rb={spar.width * 0.4}
                material={steel}
                segments={7}
              />
            ))}
            {wingPanels.map((panel, i) => (
              <Membrane key={`panel-${i}`} points={panel} material={membrane} />
            ))}
          </group>
        ))}

        {/* Legs */}
        {[1, -1].map((side) =>
          LEGS.map((leg, i) => {
            const hip = side === 1 ? leg.hip : mirror(leg.hip);
            const knee = side === 1 ? leg.knee : mirror(leg.knee);
            const foot = side === 1 ? leg.foot : mirror(leg.foot);
            return (
              <group key={`leg-${side}-${i}`}>
                <Bone a={hip} b={knee} ra={leg.r} rb={leg.r * 0.7} material={patina} />
                <Bone a={knee} b={foot} ra={leg.r * 0.7} rb={leg.r * 0.5} material={patina} />
                <mesh position={[foot[0], 1.2, foot[2] + 2]} material={steel} castShadow>
                  <boxGeometry args={[leg.r * 2.6, 2.4, leg.r * 3.4]} />
                </mesh>
              </group>
            );
          }),
        )}

        {/* Tail fin */}
        <Membrane
          points={[
            [0, 9, -66],
            [0, 22, -84],
            [0, 4, -82],
          ]}
          material={membrane}
        />

        {feature.breathingFire && (
          <FireBreath
            origin={MOUTH}
            direction={[0, -0.18, 1]}
            lengthFt={feature.lengthFt * 0.62}
            periodS={feature.burstPeriodS}
            seed={0}
          />
        )}
      </group>

      {/* A low uplight on the plinth so the sculpture reads after dark. */}
      {night && (
        <>
          <pointLight position={[0, 4, 18]} color="#ff7a2e" intensity={220} distance={140} decay={2} />
          <pointLight position={[0, 4, -30]} color="#3d7bff" intensity={120} distance={120} decay={2} />
        </>
      )}

      {/* Plinth */}
      <mesh position={[0, 0.75, -8]} receiveShadow castShadow>
        <cylinderGeometry args={[42, 46, 1.5, 40]} />
        <meshStandardMaterial color="#6b6459" roughness={0.95} />
      </mesh>
    </group>
  );
}
