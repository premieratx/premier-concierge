import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function hsl(h: number, s: number, l: number): THREE.Color {
  return new THREE.Color().setHSL(((h % 360) + 360) / 360, s, l);
}

export interface FlameProps {
  position: [number, number, number];
  /** Flame height in feet. */
  height: number;
  radius: number;
  /** Base hue in degrees. */
  hue: number;
  /** Drift the hue through the spectrum instead of holding it. */
  rainbow?: boolean;
  /** Seconds for a full trip round the colour wheel. */
  cyclePeriodS?: number;
  /** Phase offset so a ring of pits does not flicker in lockstep. */
  seed?: number;
  castLight?: boolean;
  lightIntensity?: number;
}

/**
 * A gas flame: two nested additive cones, the inner one hotter and paler,
 * both jittering on their own clock so no two pits move together.
 *
 * The colour lives in the flame rather than in a wash light, which is the
 * whole point of a mineral-salt burner — you see the fire change colour, not
 * a coloured light pointed at fire.
 */
export function Flame({
  position,
  height,
  radius,
  hue,
  rainbow = false,
  cyclePeriodS = 22,
  seed = 0,
  castLight = true,
  lightIntensity = 40,
}: FlameProps) {
  // Scaling happens on groups whose origin sits at the burner, so the flame
  // grows upward from the pit instead of stretching about its own middle.
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  const outerMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: hsl(hue, 0.95, 0.55),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [hue],
  );

  const innerMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: hsl(hue, 0.6, 0.85),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [hue],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed * 3.7;
    // Two incommensurate frequencies read as fire; one reads as a pulse.
    const flicker = 1 + 0.18 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 11.9 + 1.2);
    const sway = 0.06 * Math.sin(t * 2.1 + seed);

    if (outer.current) {
      outer.current.scale.set(1 + sway, flicker, 1 - sway);
      outer.current.rotation.y = t * 0.6;
    }
    if (inner.current) {
      inner.current.scale.set(1 - sway, flicker * 0.92, 1 + sway);
      inner.current.rotation.y = -t * 0.9;
    }

    const h = rainbow ? hue + (t / cyclePeriodS) * 360 : hue;
    outerMat.color.copy(hsl(h, 0.95, 0.55));
    innerMat.color.copy(hsl(h + 12, 0.6, 0.85));

    if (light.current) {
      light.current.color.copy(hsl(h, 0.85, 0.6));
      light.current.intensity = lightIntensity * flicker;
    }
  });

  return (
    <group position={position}>
      <group ref={outer}>
        <mesh position={[0, height / 2, 0]} material={outerMat}>
          <coneGeometry args={[radius, height, 10, 1, true]} />
        </mesh>
      </group>
      <group ref={inner}>
        <mesh position={[0, height * 0.35, 0]} material={innerMat}>
          <coneGeometry args={[radius * 0.55, height * 0.7, 8, 1, true]} />
        </mesh>
      </group>
      {castLight && (
        <pointLight
          ref={light}
          position={[0, height * 0.4, 0]}
          distance={radius * 26}
          decay={2}
        />
      )}
    </group>
  );
}

export interface FireBreathProps {
  /** Mouth position in the parent's local space. */
  origin: [number, number, number];
  /** Direction the jet travels. Need not be normalised. */
  direction: [number, number, number];
  /** Length of the jet at full burst, in feet. */
  lengthFt: number;
  /** Seconds between bursts. */
  periodS: number;
  /** How long each burst lasts, in seconds. */
  burstS?: number;
  seed?: number;
}

/**
 * The dragon's breath: a jet that builds, roars and dies on a timer rather
 * than burning continuously, because a jet that never stops stops reading as
 * an event.
 */
export function FireBreath({
  origin,
  direction,
  lengthFt,
  periodS,
  burstS = 2.6,
  seed = 0,
}: FireBreathProps) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  const { position, quaternion } = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    // The cone's own axis is +Y, so turn it to face the jet direction.
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { position: new THREE.Vector3(...origin), quaternion: q };
  }, [origin, direction]);

  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#fff2c4'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ff6a1a'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed;
    const phase = t % periodS;
    // Fast attack, long decay — the shape of an actual burst.
    let envelope = 0;
    if (phase < burstS) {
      const u = phase / burstS;
      envelope = Math.min(1, u * 6) * (1 - u) ** 0.6;
    }
    const roar = 1 + 0.25 * Math.sin(t * 18) + 0.12 * Math.sin(t * 29);

    coreMat.opacity = 0.95 * envelope;
    haloMat.opacity = 0.6 * envelope;

    if (group.current) group.current.visible = envelope > 0.002;
    if (core.current) core.current.scale.set(roar * 0.9, envelope * roar, roar * 0.9);
    if (halo.current) halo.current.scale.set(roar, envelope * roar * 1.05, roar);
    if (light.current) light.current.intensity = 900 * envelope * roar;
  });

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      {/* Cones are built pointing +Y from their base, so the jet is drawn
          from the mouth outward and then scaled along its own axis. */}
      <group ref={halo}>
        <mesh position={[0, lengthFt / 2, 0]} material={haloMat}>
          <coneGeometry args={[lengthFt * 0.22, lengthFt, 14, 1, true]} />
        </mesh>
      </group>
      <group ref={core}>
        <mesh position={[0, lengthFt * 0.46, 0]} material={coreMat}>
          <coneGeometry args={[lengthFt * 0.11, lengthFt * 0.92, 12, 1, true]} />
        </mesh>
      </group>
      <pointLight
        ref={light}
        position={[0, lengthFt * 0.35, 0]}
        color="#ff8a3d"
        distance={lengthFt * 4}
        decay={2}
      />
    </group>
  );
}
