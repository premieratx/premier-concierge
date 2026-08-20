/**
 * Daylight rig. Phase 6 swaps this for a day/night toggle; for now it just has
 * to make the massing read — a strong key from the southwest so the boxes cast
 * shadows on one another and the stacking is legible.
 */
export function Lighting() {
  return (
    <>
      <hemisphereLight args={['#cfe3ff', '#4a4636', 0.55]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[120, 160, 80]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-camera-near={1}
        shadow-camera-far={500}
      />
      <directionalLight position={[-90, 70, -110]} intensity={0.4} />
    </>
  );
}
