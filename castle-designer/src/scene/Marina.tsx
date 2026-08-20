import { useMemo } from 'react';
import * as THREE from 'three';
import { featuresOfKind } from '../domain/types';
import type { BoatKind, DockFeature, Layout, PatioBarFeature, SlipFeature } from '../domain/types';

const DECK_COLOR = '#8a7452';
const PILE_COLOR = '#4c4238';
const CANOPY_COLOR = '#2f4f5c';
const RAIL_COLOR = '#5c5245';

function useMarinaMaterials() {
  return useMemo(
    () => ({
      deck: new THREE.MeshStandardMaterial({ color: DECK_COLOR, roughness: 0.88 }),
      pile: new THREE.MeshStandardMaterial({ color: PILE_COLOR, roughness: 0.95 }),
      canopy: new THREE.MeshStandardMaterial({
        color: CANOPY_COLOR,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
      rail: new THREE.MeshStandardMaterial({ color: RAIL_COLOR, roughness: 0.9 }),
      rope: new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 1 }),
      hull: new THREE.MeshStandardMaterial({ color: '#e6e8ea', roughness: 0.42, metalness: 0.15 }),
      trim: new THREE.MeshStandardMaterial({ color: '#243444', roughness: 0.5 }),
      bar: new THREE.MeshStandardMaterial({ color: '#5a3f2c', roughness: 0.7 }),
    }),
    [],
  );
}

type Materials = ReturnType<typeof useMarinaMaterials>;

function Dock({ dock, m }: { dock: DockFeature; m: Materials }) {
  const deckThickness = 0.8;
  const pileRows = Math.max(2, Math.round(dock.lengthFt / 26));
  const isGangway = dock.role === 'gangway';

  return (
    <group position={[dock.position.x, dock.position.y, dock.position.z]} rotation={[0, dock.rotationY, 0]}>
      <mesh material={m.deck} castShadow receiveShadow>
        <boxGeometry args={[dock.lengthFt, deckThickness, dock.widthFt]} />
      </mesh>
      {!isGangway &&
        Array.from({ length: pileRows }, (_, i) => {
          const x = -dock.lengthFt / 2 + (dock.lengthFt * (i + 0.5)) / pileRows;
          return [1, -1].map((side) => (
            <mesh
              key={`pile-${i}-${side}`}
              position={[x, 4, (side * dock.widthFt) / 2 + side * 0.5]}
              material={m.pile}
              castShadow
            >
              <cylinderGeometry args={[0.55, 0.55, 18, 8]} />
            </mesh>
          ));
        })}
      {dock.role === 'main' && (
        // A low rail down each side of the spine.
        [1, -1].map((side) => (
          <mesh
            key={`rail-${side}`}
            position={[0, 1.9, (side * dock.widthFt) / 2]}
            material={m.rail}
          >
            <boxGeometry args={[dock.lengthFt, 0.35, 0.35]} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Boat({ kind, m }: { kind: BoatKind; m: Materials }) {
  if (kind === 'none') return null;

  if (kind === 'pontoon') {
    return (
      <group>
        {[1, -1].map((side) => (
          <mesh key={side} position={[0, 0.3, side * 3]} rotation={[0, 0, Math.PI / 2]} material={m.hull} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 20, 10]} />
          </mesh>
        ))}
        <mesh position={[0, 1.5, 0]} material={m.deck} castShadow>
          <boxGeometry args={[19, 0.4, 7.4]} />
        </mesh>
        <mesh position={[-1, 5.2, 0]} material={m.canopy} castShadow>
          <boxGeometry args={[11, 0.25, 7]} />
        </mesh>
        {[[-6, 3], [-6, -3], [4, 3], [4, -3]].map(([x, z], i) => (
          <mesh key={i} position={[x!, 3.4, z!]} material={m.trim}>
            <cylinderGeometry args={[0.14, 0.14, 3.6, 6]} />
          </mesh>
        ))}
      </group>
    );
  }

  const long = kind === 'cruiser' ? 27 : 19;
  const beam = kind === 'cruiser' ? 8.4 : 6.6;

  return (
    <group>
      <mesh position={[0, 1.1, 0]} material={m.hull} castShadow>
        <boxGeometry args={[long * 0.78, 3.2, beam]} />
      </mesh>
      {/* Bow: a four-sided cone laid on its side reads as a stem. */}
      <mesh
        position={[long * 0.5, 1.1, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        material={m.hull}
        castShadow
      >
        <coneGeometry args={[beam / 2, long * 0.32, 4]} />
      </mesh>
      <mesh position={[-long * 0.1, 3.4, 0]} material={m.trim} castShadow>
        <boxGeometry args={[long * 0.34, 2.2, beam * 0.78]} />
      </mesh>
      {kind === 'cruiser' && (
        <mesh position={[-long * 0.1, 5.4, 0]} material={m.canopy} castShadow>
          <boxGeometry args={[long * 0.36, 0.24, beam * 0.86]} />
        </mesh>
      )}
    </group>
  );
}

/**
 * A premier berth: the shade patio over the slip, the bar on it, the rope
 * swing off the outboard post, and the jump platform at the end of the
 * finger.
 *
 * This is the part of the marina that is actually the product. A berth is a
 * commodity; a berth with a deck, a roof, furniture, a bar and somewhere to
 * jump from is a different thing being sold at a different price.
 */
function PremierPatio({ slip, m }: { slip: SlipFeature; m: Materials }) {
  const w = slip.widthFt;
  const l = slip.lengthFt;
  const deckY = 3.2;
  const canopyY = 12.5;

  return (
    <group>
      {/* Walk-around deck on the outboard half, so the berth stays usable. */}
      <mesh position={[l * 0.28, deckY, 0]} material={m.deck} castShadow receiveShadow>
        <boxGeometry args={[l * 0.44, 0.6, w - 1.5]} />
      </mesh>

      {/* Shade canopy on four posts. */}
      <mesh position={[0, canopyY, 0]} material={m.canopy} castShadow>
        <boxGeometry args={[l * 0.92, 0.4, w + 1.5]} />
      </mesh>
      {[[-l * 0.44, w / 2], [-l * 0.44, -w / 2], [l * 0.44, w / 2], [l * 0.44, -w / 2]].map(
        ([x, z], i) => (
          <mesh key={i} position={[x!, canopyY / 2, z!]} material={m.pile} castShadow>
            <cylinderGeometry args={[0.4, 0.4, canopyY, 8]} />
          </mesh>
        ),
      )}

      {slip.bar && (
        <group position={[l * 0.34, deckY + 0.3, 0]}>
          <mesh position={[0, 1.9, 0]} material={m.bar} castShadow>
            <boxGeometry args={[3, 3.6, w - 3]} />
          </mesh>
          {[-2.5, 0, 2.5].map((z, i) => (
            <mesh key={i} position={[-2.6, 1.3, z]} material={m.trim} castShadow>
              <cylinderGeometry args={[0.55, 0.45, 2.6, 8]} />
            </mesh>
          ))}
        </group>
      )}

      {slip.ropeSwing && (
        <group position={[-l * 0.4, 0, 0]}>
          <mesh position={[0, canopyY + 2.5, 0]} material={m.pile} castShadow>
            <boxGeometry args={[7, 0.5, 0.5]} />
          </mesh>
          <mesh position={[-2.6, canopyY - 3.5, 0]} material={m.rope}>
            <cylinderGeometry args={[0.09, 0.09, 12, 5]} />
          </mesh>
          <mesh position={[-2.6, canopyY - 9.6, 0]} material={m.trim}>
            <boxGeometry args={[1.6, 0.25, 0.7]} />
          </mesh>
        </group>
      )}

      {slip.jumpPlatform && (
        <group position={[l * 0.5, 0, 0]}>
          <mesh position={[0, 9, 0]} material={m.deck} castShadow>
            <boxGeometry args={[6, 0.6, 6]} />
          </mesh>
          {[[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].map(([x, z], i) => (
            <mesh key={i} position={[x!, 4.5, z!]} material={m.pile} castShadow>
              <cylinderGeometry args={[0.32, 0.32, 9, 6]} />
            </mesh>
          ))}
          {/* Ladder back up out of the water. */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={`rung-${i}`} position={[-3.2, 1 + i * 1.4, 0]} material={m.rail}>
              <boxGeometry args={[0.9, 0.16, 1.8]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function Bar({ bar, m }: { bar: PatioBarFeature; m: Materials }) {
  const stoolCount = Math.max(2, Math.round(bar.widthFt / 4));
  return (
    <group position={[bar.position.x, bar.position.y, bar.position.z]} rotation={[0, bar.rotationY, 0]}>
      <mesh position={[0, bar.heightFt / 2, 0]} material={m.bar} castShadow>
        <boxGeometry args={[bar.widthFt, bar.heightFt, bar.depthFt]} />
      </mesh>
      <mesh position={[0, bar.heightFt + 0.15, 0]} material={m.deck} castShadow>
        <boxGeometry args={[bar.widthFt + 1.4, 0.3, bar.depthFt + 1.6]} />
      </mesh>
      {Array.from({ length: stoolCount }, (_, i) => (
        <mesh
          key={i}
          position={[
            -bar.widthFt / 2 + (bar.widthFt * (i + 0.5)) / stoolCount,
            1.1,
            bar.depthFt / 2 + 2,
          ]}
          material={m.trim}
          castShadow
        >
          <cylinderGeometry args={[0.55, 0.45, 2.4, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export function Marina({ layout }: { layout: Layout }) {
  const m = useMarinaMaterials();
  const docks = featuresOfKind(layout.features, 'dock');
  const slips = featuresOfKind(layout.features, 'slip');
  const bars = featuresOfKind(layout.features, 'patioBar');

  return (
    <group>
      {docks.map((d) => (
        <Dock key={d.id} dock={d} m={m} />
      ))}
      {slips.map((slip) => (
        <group
          key={slip.id}
          position={[slip.position.x, slip.position.y, slip.position.z]}
          rotation={[0, slip.rotationY, 0]}
        >
          {slip.patio && <PremierPatio slip={slip} m={m} />}
          <Boat kind={slip.boat} m={m} />
        </group>
      ))}
      {bars.map((b) => (
        <Bar key={b.id} bar={b} m={m} />
      ))}
    </group>
  );
}
