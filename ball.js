import * as THREE from "three";

// Procedural basketball. Everything is computed from the 3D direction on the sphere,
// so the seams and pebbles never stretch near the poles.
//
// Seam layout (standard 8-panel ball): two perpendicular great circles (planes x=0, y=0)
// plus two curved seams, each a circle centred on the +x / -x axis, crossing the y=0 seam.

function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Worley-style cellular noise: distance to nearest jittered feature point (gives round pebbles)
function cellular(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let best = 9;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    const X = xi + a, Y = yi + b, Z = zi + c;
    const dx = X + hash3(X, Y, Z) - x, dy = Y + hash3(Y, Z, X) - y, dz = Z + hash3(Z, X, Y) - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function smooth(e0, e1, v) { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

export function makeBallMaterial({ size = 2048, oval = 1.06 } = {}) {
  const TW = size, TH = size / 2;
  const mk = () => { const c = document.createElement("canvas"); c.width = TW; c.height = TH; return c; };
  const colC = mk(), bumpC = mk(), roughC = mk();
  const ci = colC.getContext("2d").createImageData(TW, TH);
  const bi = bumpC.getContext("2d").createImageData(TW, TH);
  const ri = roughC.getContext("2d").createImageData(TW, TH);
  const SEAM = 0.03;       // half-width of the black rubber channel (radians)
  const GROOVE = 0.052;   // half-width of the recessed groove including its rounded edge
  const PEB = 95;          // pebble frequency
  for (let row = 0; row < TH; row++) {
    const theta = ((row + 0.5) / TH) * Math.PI, st = Math.sin(theta), y = Math.cos(theta);
    for (let col = 0; col < TW; col++) {
      const phi = ((col + 0.5) / TW) * Math.PI * 2;
      const x = -Math.cos(phi) * st, z = Math.sin(phi) * st;
      const d = Math.min(
        Math.abs(Math.asin(y)),
        Math.abs(Math.asin(Math.max(-1, Math.min(1, x)))),
        Math.abs(Math.acos(Math.min(1, Math.abs(x))) - oval));
      const seam = 1 - smooth(SEAM - 0.004, SEAM + 0.004, d);          // 1 inside rubber channel
      const groove = 1 - smooth(SEAM, GROOVE, d);                       // depth profile of the channel
      const cell = cellular(x * PEB, y * PEB, z * PEB);
      const pebble = (1 - smooth(0.15, 0.62, cell)) * (1 - groove);    // round raised bumps
      const tone = 0.96 + 0.04 * Math.sin(x * 5.3 + 1.3) * Math.sin(y * 4.7 + 0.4) * Math.sin(z * 6.1 + 2.1); // smooth subtle tone variation
      const wear = 1 - 0.18 * groove * (1 - seam);                       // slight darkening at seam edges
      const k = (row * TW + col) * 4;
      // leather: warm brown-orange; pebble tops catch a bit more light
      const L = tone * wear * (0.9 + 0.1 * pebble);
      const r = 205 * L, g = 86 * L, b = 30 * L;
      ci.data[k] = r * (1 - seam) + 22 * seam;
      ci.data[k + 1] = g * (1 - seam) + 18 * seam;
      ci.data[k + 2] = b * (1 - seam) + 16 * seam;
      ci.data[k + 3] = 255;
      const h = 150 + 70 * pebble - 140 * groove;
      bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = Math.max(0, h); bi.data[k + 3] = 255;
      const rough = seam ? 0.42 : 0.72 - 0.1 * pebble;                  // rubber seams a little shinier
      ri.data[k] = ri.data[k + 1] = ri.data[k + 2] = (seam * 0.42 + (1 - seam) * rough) * 255; ri.data[k + 3] = 255;
    }
  }
  colC.getContext("2d").putImageData(ci, 0, 0);
  bumpC.getContext("2d").putImageData(bi, 0, 0);
  roughC.getContext("2d").putImageData(ri, 0, 0);
  const map = new THREE.CanvasTexture(colC); map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bumpC), roughnessMap = new THREE.CanvasTexture(roughC);
  for (const t of [map, bumpMap, roughnessMap]) { t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  return new THREE.MeshPhysicalMaterial({
    map, bumpMap, bumpScale: 3.0, roughnessMap, roughness: 1,
    sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffb27a"),
    clearcoat: 0.12, clearcoatRoughness: 0.55,
  });
}

// The classic three-quarter view: the curved seam wraps around the visible face.
export const BALL_TILT = new THREE.Euler(0.5, 0.9, 0, "YXZ");
