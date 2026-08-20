import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { TimeOfDay } from '../store/useLayoutStore';

/**
 * Bloom and a vignette.
 *
 * The fire, the festoon bulbs and the dragon's headlights are all drawn with
 * unclamped emissive colour, which does nothing on its own — bloom is what
 * turns them into light sources you can feel. The threshold sits above
 * daylight so the castle does not glow; only things that are actually
 * emitting cross it.
 */
const SETTINGS: Record<TimeOfDay, { intensity: number; threshold: number; vignette: number }> = {
  day: { intensity: 0.3, threshold: 1.25, vignette: 0.3 },
  dusk: { intensity: 1.0, threshold: 0.85, vignette: 0.46 },
  night: { intensity: 1.7, threshold: 0.6, vignette: 0.6 },
};

export function Effects({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const s = SETTINGS[timeOfDay];
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={s.intensity}
        luminanceThreshold={s.threshold}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      <Vignette offset={0.26} darkness={s.vignette} />
    </EffectComposer>
  );
}
