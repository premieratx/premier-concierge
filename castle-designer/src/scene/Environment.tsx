import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A procedural environment map.
 *
 * Metallic materials in a physically-based renderer get almost all of their
 * colour from what they reflect. With no environment to reflect, every metal
 * in the scene renders near black — the containers go flat, and a dragon
 * welded out of chrome rims and exhaust pipe disappears entirely.
 *
 * `RoomEnvironment` ships with three and is generated in memory, so this costs
 * one render at start-up and no network request — which matters, because the
 * published build has to run with no outbound requests at all.
 */
export function SceneEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  return null;
}
