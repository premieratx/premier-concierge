import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { finishedGrade, shorelineZAt } from '../domain/terrain';
import type { SiteDefinition } from '../domain/types';

/** Eye height, in feet. */
const EYE_HEIGHT = 5.6;
const WALK_SPEED = 9;
const RUN_SPEED = 26;

/**
 * Where you land when you enter walk mode: in the courtyard between the great
 * hall and the keep, on the axis that runs out through the gate to the dragon,
 * the lawn and the water. Standing inside the compound looking out is the shot
 * the whole plan is organised around.
 */
export const WALK_START = new THREE.Vector3(0, EYE_HEIGHT, 126);

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * First-person walkthrough.
 *
 * No collision: you can walk through the curtain wall into the great hall,
 * which is a feature in a design tool rather than a bug. The floor follows
 * the site — grade on land, dock deck once you are past the shoreline — so
 * walking out along the pier puts you at the right height above the water.
 */
export function WalkControls({ site }: { site: SiteDefinition }) {
  const camera = useThree((s) => s.camera);
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const start = WALK_START.clone();
    start.y = finishedGrade(start.x, start.z) + EYE_HEIGHT;
    camera.position.copy(start);
    camera.lookAt(0, start.y - 12, 400);
  }, [camera]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      // The browser scrolls on space and the arrows; in here they are controls.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, delta) => {
    const held = keys.current;
    const ahead = Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown'));
    const side = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
    if (ahead === 0 && side === 0) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, UP).normalize();

    move.set(0, 0, 0).addScaledVector(forward, ahead).addScaledVector(right, side).normalize();

    const speed = held.has('ShiftLeft') || held.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    camera.position.addScaledVector(move, speed * Math.min(delta, 0.1));

    // The floor follows the hill, and past the shoreline you are on the dock
    // rather than in the lake.
    const { x, z } = camera.position;
    const floor =
      z > shorelineZAt(x) ? site.waterLevelFt + 1.9 : finishedGrade(x, z);
    camera.position.y = floor + EYE_HEIGHT;
  });

  return <PointerLockControls makeDefault />;
}
