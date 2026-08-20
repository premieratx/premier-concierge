import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { TimeOfDay } from '../store/useLayoutStore';

interface Preset {
  sun: [number, number, number];
  sunIntensity: number;
  sunColor: string;
  ambient: number;
  ambientColor: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  turbidity: number;
  rayleigh: number;
  fog: [string, number, number];
  stars: boolean;
}

/**
 * Three lighting states rather than a continuous clock.
 *
 * Dusk is the default because it is the only one where the fire, the party
 * lights and the castle all read at once — daylight washes the flames out and
 * full night hides the massing.
 */
const PRESETS: Record<TimeOfDay, Preset> = {
  day: {
    sun: [420, 520, 180],
    sunIntensity: 2.2,
    sunColor: '#fff6e6',
    ambient: 0.18,
    ambientColor: '#ffffff',
    hemiSky: '#cfe3ff',
    hemiGround: '#4a4636',
    hemiIntensity: 0.7,
    turbidity: 4,
    rayleigh: 1.2,
    fog: ['#b9cbdd', 1500, 4000],
    stars: false,
  },
  dusk: {
    sun: [-620, 90, -160],
    sunIntensity: 1.7,
    sunColor: '#ffb078',
    ambient: 0.34,
    ambientColor: '#9db4d6',
    hemiSky: '#6c82b4',
    hemiGround: '#3a3225',
    hemiIntensity: 0.95,
    turbidity: 9,
    rayleigh: 3.2,
    fog: ['#8e9aae', 1200, 3400],
    stars: true,
  },
  night: {
    sun: [-420, 260, -520],
    sunIntensity: 0.55,
    sunColor: '#9fb6ff',
    ambient: 0.24,
    ambientColor: '#6a80ab',
    hemiSky: '#2b3b5e',
    hemiGround: '#14181f',
    hemiIntensity: 0.5,
    turbidity: 12,
    rayleigh: 0.35,
    fog: ['#1b2942', 1000, 3000],
    stars: true,
  },
};

export function Lighting({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const p = PRESETS[timeOfDay];
  const sun = new THREE.Vector3(...p.sun);

  return (
    <>
      <fog attach="fog" args={[p.fog[0], p.fog[1], p.fog[2]]} />
      <Sky
        distance={40000}
        sunPosition={sun}
        turbidity={p.turbidity}
        rayleigh={p.rayleigh}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />
      {p.stars && (
        <Stars radius={1600} depth={400} count={timeOfDay === 'night' ? 5000 : 1800} factor={9} fade speed={0.4} />
      )}

      <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
      <ambientLight color={p.ambientColor} intensity={p.ambient} />
      <directionalLight
        position={p.sun}
        color={p.sunColor}
        intensity={p.sunIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-520}
        shadow-camera-right={520}
        shadow-camera-top={520}
        shadow-camera-bottom={-520}
        shadow-camera-near={1}
        shadow-camera-far={2200}
        shadow-bias={-0.0006}
      />
      {/* A cool fill from the water side keeps the shadowed elevations from
          going flat black. */}
      <directionalLight position={[180, 160, 900]} color="#7fa0c8" intensity={0.35} />
    </>
  );
}
