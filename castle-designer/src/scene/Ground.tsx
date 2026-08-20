import { Grid } from '@react-three/drei';
import { SNAP_ACROSS_FT } from '../domain/dimensions';

/**
 * Grade plane plus the castle grid: one cell per container width (8'), one
 * heavier section line every 40' — a full high-cube length.
 */
export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#3f4a3c" roughness={1} />
      </mesh>
      <Grid
        args={[600, 600]}
        cellSize={SNAP_ACROSS_FT}
        cellThickness={0.6}
        cellColor="#5c6b58"
        sectionSize={40}
        sectionThickness={1.2}
        sectionColor="#8fa384"
        fadeDistance={700}
        fadeStrength={1.5}
        infiniteGrid
        followCamera={false}
      />
    </group>
  );
}
