import * as THREE from 'three';

/**
 * Procedural container skins.
 *
 * All generated in memory — the published build makes no network requests, so
 * there is nowhere to load an image from. A corrugated normal map and a
 * painted cargo-door end are enough to turn a grey box into something that
 * reads as a shipping container at any distance that matters.
 */

/** One full corrugation across the texture, so repeat count == corrugations. */
function makeCorrugationNormal(): THREE.DataTexture {
  const width = 128;
  const height = 4;
  const data = new Uint8Array(width * height * 4);
  // Slope of the profile at its steepest. Real container siding is trapezoidal;
  // a sine is close enough once it is an inch tall on screen.
  const amplitude = 1.25;

  for (let x = 0; x < width; x++) {
    const u = x / width;
    const slope = amplitude * Math.cos(u * Math.PI * 2);
    const inv = 1 / Math.hypot(slope, 1);
    const nx = -slope * inv;
    const nz = inv;
    const r = Math.round((nx * 0.5 + 0.5) * 255);
    const b = Math.round((nz * 0.5 + 0.5) * 255);
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = 128;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The door end: two leaves, four lock rods, hinges and a placard.
 *
 * Drawn light so the per-instance role colour still tints it — the map is
 * multiplied by the instance colour, not laid over it.
 */
function makeDoorEnd(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, size, size);

  // Ribbed door leaves.
  ctx.strokeStyle = '#c2c2c2';
  ctx.lineWidth = 3;
  for (let x = 8; x < size; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, size - 12);
    ctx.stroke();
  }

  // Frame and the seam between the two leaves.
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, size - 12, size - 12);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(size / 2, 10);
  ctx.lineTo(size / 2, size - 10);
  ctx.stroke();

  // Four lock rods with their cams.
  ctx.strokeStyle = '#6f6f6f';
  ctx.lineWidth = 6;
  for (const x of [size * 0.2, size * 0.38, size * 0.62, size * 0.8]) {
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x, size - 18);
    ctx.stroke();
    ctx.fillStyle = '#5c5c5c';
    ctx.fillRect(x - 9, size * 0.46, 18, 26);
  }

  // Hinges down both outer edges.
  ctx.fillStyle = '#5c5c5c';
  for (const y of [size * 0.16, size * 0.5, size * 0.84]) {
    ctx.fillRect(8, y - 8, 16, 16);
    ctx.fillRect(size - 24, y - 8, 16, 16);
  }

  // Placard.
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(size * 0.3, size * 0.12, size * 0.4, size * 0.09);
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 2;
  ctx.strokeRect(size * 0.3, size * 0.12, size * 0.4, size * 0.09);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export interface ContainerSkin {
  /** Six materials in BoxGeometry group order: +X, -X, +Y, -Y, +Z, -Z. */
  materials: THREE.Material[];
  dispose(): void;
}

/**
 * Build the six-material skin for one container type.
 *
 * BoxGeometry carries a group per face, and an InstancedMesh accepts a
 * material array against those groups, so the door end, the roof and the long
 * walls can each get their own treatment without a second draw call.
 *
 * `lengthFt` and `widthFt` set the corrugation counts: about one corrugation
 * per foot on the walls, which is roughly the real pitch.
 */
export function makeContainerSkin(lengthFt: number, widthFt: number): ContainerSkin {
  const normal = makeCorrugationNormal();
  const door = makeDoorEnd();

  const side = normal.clone();
  side.needsUpdate = true;
  side.repeat.set(Math.round(lengthFt), 1);

  const end = normal.clone();
  end.needsUpdate = true;
  end.repeat.set(Math.round(widthFt), 1);

  // The roof corrugates along the box, so its map is turned a quarter turn.
  const roof = normal.clone();
  roof.needsUpdate = true;
  roof.center.set(0.5, 0.5);
  roof.rotation = Math.PI / 2;
  roof.repeat.set(1, Math.round(widthFt));

  const wall = (map: THREE.Texture, scale: number) =>
    new THREE.MeshStandardMaterial({
      normalMap: map,
      normalScale: new THREE.Vector2(scale, scale),
      roughness: 0.68,
      metalness: 0.35,
    });

  const doorMaterial = new THREE.MeshStandardMaterial({
    ...(door ? { map: door } : {}),
    normalMap: end,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.66,
    metalness: 0.35,
  });

  const floor = new THREE.MeshStandardMaterial({
    color: '#3a3a3c',
    roughness: 0.95,
    metalness: 0.1,
  });

  const materials: THREE.Material[] = [
    doorMaterial, // +X: the door end
    wall(end, 0.75), // -X: the blind end
    wall(roof, 0.6), // +Y: roof
    floor, // -Y
    wall(side, 0.85), // +Z
    wall(side, 0.85), // -Z
  ];

  return {
    materials,
    dispose() {
      for (const m of materials) m.dispose();
      for (const t of [normal, side, end, roof]) t.dispose();
      door?.dispose();
    },
  };
}
