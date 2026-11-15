// תקוע בסיר – the 3D look. Physics stays on the z = 0 plane; everything here is how it looks:
// solid pieces get real depth, the dim structure stands behind them, and the camp, the hills and the sky
// fill the distance. Static pieces are merged per material so the whole climb is a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function canvasTex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; }
function noise(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }

export function makeTextures() {
  const wood = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#a9794a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(70,40,15,${0.12 + Math.random() * 0.22})`; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); g.stroke(); } noise(g, w, h, 600, 0.06); });
  const crate = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b58550'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6e4a2a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.lineWidth = 8; g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.stroke(); for (let y = 30; y < h; y += 30) { g.strokeStyle = 'rgba(70,40,15,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y); g.stroke(); } noise(g, w, h, 500, 0.07); });
  const canvasF = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#b8452a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(x, 0, 2, h); } for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, y, w, 2); } }, [2, 2]);
  const canvasG = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#5f6e3b'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x, 0, 2, h); } }, [2, 2]);
  const rock = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a4e3c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 60); g.stroke(); } noise(g, w, h, 4000, 0.1); }, [3, 30]);
  const grass = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7d8a4e'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.12); }, [40, 40]);
  const jerry = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#3f6a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, 20); g.lineTo(w - 8, h - 20); g.moveTo(w - 8, 20); g.lineTo(8, h - 20); g.stroke(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(6, 6, w - 12, 8); });
  const clock = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f2ead8'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#2a1a0a'; g.lineWidth = 10; g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#2a1a0a'; g.fillRect(128 + Math.cos(a) * 98 - 6, 128 + Math.sin(a) * 98 - 6, 12, 12); } g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 52); g.moveTo(128, 128); g.lineTo(184, 128); g.stroke(); });
  return { wood, crate, canvasF, canvasG, rock, grass, jerry, clock };
}

export function buildWorld3D(scene, L, TX, logoImg) {
  const W = { animated: [] };
  const M = {
    wood: new THREE.MeshStandardMaterial({ map: TX.wood, roughness: 0.8 }), woodD: new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.9 }),
    crate: new THREE.MeshStandardMaterial({ map: TX.crate, roughness: 0.85 }), counter: new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb7c0c8, roughness: 0.28, metalness: 0.85 }), gas: new THREE.MeshStandardMaterial({ color: 0x2e6ca8, roughness: 0.4, metalness: 0.4 }),
    tentF: new THREE.MeshStandardMaterial({ map: TX.canvasF, roughness: 0.95, side: THREE.DoubleSide }), tentG: new THREE.MeshStandardMaterial({ map: TX.canvasG, roughness: 0.95 }),
    bag: new THREE.MeshStandardMaterial({ color: 0x7a3a8a, roughness: 0.8 }), jerry: new THREE.MeshStandardMaterial({ map: TX.jerry, roughness: 0.6 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xd8bd84, roughness: 1 }), rock: new THREE.MeshStandardMaterial({ map: TX.rock, roughness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa8121b, roughness: 0.7 }), chalk: new THREE.MeshStandardMaterial({ color: 0xf1efeb, roughness: 0.8 }),
    back: new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 1, transparent: true, opacity: 0.55 }), crateB: new THREE.MeshStandardMaterial({ map: TX.crate, color: 0x8a8a8a, roughness: 1, transparent: true, opacity: 0.6 }), woodB: new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 1, transparent: true, opacity: 0.7 }), clock: new THREE.MeshStandardMaterial({ map: TX.clock, roughness: 0.7 }),
  };
  W.M = M;
  const groups = {}; const add = (mat, geo) => { (groups[mat] = groups[mat] || []).push(geo); };
  const boxG = (w, h, d, x, y, z, ang = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateZ(ang); g.translate(x, y, z); return g; };
  const cyl = (r, a, b, seg = 8) => { const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r, r, len, seg); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g; };
  const DEP = 1.6;                                                                  // depth of solid pieces
  for (const it of L.items) {
    if (it.t === 'box') {
      const w = it.hw * 2, h = it.hh * 2, x = it.cx, y = it.cy, a = it.ang || 0;
      const k = it.kind;
      if (k === 'crate') { add('crate', boxG(w, h, Math.min(DEP, w), x, y, 0, a)); }
      else if (k === 'counter') { add('counter', boxG(w, h, DEP, x, y, 0, a)); add('red', boxG(w, 0.05, DEP + 0.02, x, y - h / 2, 0)); }
      else if (k === 'cookpot') { const g = new THREE.CylinderGeometry(it.hw, it.hw * 0.92, h, 20); g.translate(x, y, 0); add('metal', g); const r = new THREE.TorusGeometry(it.hw, 0.03, 6, 20); r.rotateX(Math.PI / 2); r.translate(x, y + h / 2, 0); add('metal', r); }
      else if (k === 'tentfloor') add('tentG', boxG(w, h, DEP, x, y, 0, a));
      else if (k === 'jerry') add('jerry', boxG(w, h, 0.35, x, y, 0, a));
      else if (k === 'pole' || k === 'beam' && h > w) { const dir = V3(-Math.sin(a), Math.cos(a), 0).multiplyScalar(h / 2); add('wood', cyl(Math.max(0.07, w / 2), V3(x, y, 0).sub(dir), V3(x, y, 0).add(dir), 10)); const n = Math.max(1, Math.floor(h)); for (let i = 0; i < n; i++) { const p = V3(x, y, 0).add(dir.clone().multiplyScalar(-1 + (i + 0.5) * 2 / n)); const t = new THREE.TorusGeometry(w / 2 + 0.03, 0.03, 4, 10); t.rotateX(Math.PI / 2); t.rotateZ(a); t.translate(p.x, p.y, p.z); add('rope', t); } }
      else if (k === 'logs' || k === 'summit') { const n = Math.max(2, Math.round(DEP / 0.22)); for (let i = 0; i < n; i++) { const z = -DEP / 2 + (i + 0.5) * DEP / n; add('wood', cyl(h / 2 + 0.02, V3(x - w / 2, y, z), V3(x + w / 2, y, z), 8)); } for (const ex of [x - w / 2 + 0.15, x + w / 2 - 0.15]) add('rope', boxG(0.08, h + 0.08, DEP + 0.04, ex, y, 0)); }
      else if (k === 'rope') add('rope', cyl(0.05, V3(x - w / 2, y, 0), V3(x + w / 2, y, 0), 6));
      else if (k === 'knob') { add('wood', boxG(w, h, 0.5, x, y, 0)); add('rope', boxG(0.06, h + 0.04, 0.54, x + (x < L.flag.x ? w / 2 - 0.1 : -w / 2 + 0.1), y, 0)); }
      else add('wood', boxG(w, h, DEP, x, y, 0, a));
    } else if (it.t === 'circ') {
      if (it.kind === 'gas') { const g = new THREE.CylinderGeometry(it.r, it.r, 0.9, 18); g.rotateX(Math.PI / 2); g.translate(it.cx, it.cy, 0); add('gas', g); }
      else { const g = new THREE.CylinderGeometry(it.r, it.r, 1.4, 18); g.rotateX(Math.PI / 2); g.translate(it.cx, it.cy, 0); add('bag', g); }
    } else if (it.t === 'poly') { // tents: a triangular prism
      const [a, b, c] = it.pts, sh = new THREE.Shape(); sh.moveTo(a[0], a[1]); sh.lineTo(b[0], b[1]); sh.lineTo(c[0], c[1]); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: DEP, bevelEnabled: false }); g.translate(0, 0, -DEP / 2); add('tentF', g);
    }
  }
  // dim structure behind (decoration only)
  for (const d of L.deco) {
    const x = d.x, y = d.y, w = d.w || 1, h = d.h || 0, z = -2.6;
    if (d.kind === 'cratestack') { for (let k = 0; k < Math.min(h, 4); k++) add('crateB', boxG(w - 0.1, 0.96, 0.8, x + (k % 2) * 0.08, y - k - 0.5, z)); }
    else if (d.kind === 'legs' || d.kind === 'shelfback') { for (const sx of [-1, 1]) add('woodD', cyl(0.06, V3(x + sx * (w / 2 - 0.2), y, 0.6), V3(x + sx * (w / 2 - 0.2), y - h, 0.6), 6)); }
    else if (d.kind === 'tentback') { const sh = new THREE.Shape(); sh.moveTo(x - w / 2, y); sh.lineTo(x + w / 2, y); sh.lineTo(x, y + 1.9); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }); g.translate(0, 0, z - 1); add('tentG', g); }
    else if (d.kind === 'lattice' || d.kind === 'bigben') { const x0 = x - w / 2 + 0.2, x1 = x + w / 2 - 0.2; for (const zz of [z - 0.6, z + 0.6]) { add('woodD', cyl(0.07, V3(x0, y, zz), V3(x0, y - h, zz))); add('woodD', cyl(0.07, V3(x1, y, zz), V3(x1, y - h, zz))); add('woodD', cyl(0.045, V3(x0, y, zz), V3(x1, y - h, zz))); add('woodD', cyl(0.045, V3(x1, y, zz), V3(x0, y - h, zz))); }
      if (d.kind === 'bigben') { const c = new THREE.CircleGeometry(Math.min(w, h) * 0.22, 24); c.translate(x, y - h * 0.5, z + 0.62); add('clock', c); } }
    else if (d.kind === 'cpflag') { add('woodD', cyl(0.04, V3(x, y, 0.5), V3(x, y + 1.2, 0.5), 6)); add('red', boxG(0.55, 0.36, 0.02, x + 0.28, y + 1.02, 0.5)); add('chalk', boxG(0.55, 0.1, 0.025, x + 0.28, y + 1.02, 0.5)); }
  }
  for (const k in groups) { const geos = groups[k].map(g => g.index ? g.toNonIndexed() : g); geos.forEach(g => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); });
    const m = new THREE.Mesh(mergeGeometries(geos), M[k]); m.castShadow = k !== 'back'; m.receiveShadow = true; scene.add(m); }

  // ground, cliffs, the far camp
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshStandardMaterial({ map: TX.grass, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -60); ground.receiveShadow = true; scene.add(ground);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(10, 150, 30), M.rock); c.position.set(sx * 20.5, 75, -8); c.receiveShadow = true; scene.add(c); }
  // far scenery: hills, trees, tents of the camp, a few tribe facilities in the distance
  const hillM = new THREE.MeshStandardMaterial({ color: 0x6d7a4a, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(30 + i * 4, 18 + (i % 3) * 10, 6), hillM); h.position.set(-120 + i * 32, 6, -90 - (i % 2) * 30); scene.add(h); }
  const treeT = new THREE.MeshStandardMaterial({ color: 0x5a3e26 }), treeC = new THREE.MeshStandardMaterial({ color: 0x4a6e2e, flatShading: true });
  for (let i = 0; i < 70; i++) { const x = (Math.random() - 0.5) * 160, z = -14 - Math.random() * 60; if (Math.abs(x) < 16 && z > -20) continue; const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), treeT); tr.position.y = 1.5; const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + Math.random(), 0), treeC); cr.position.y = 4; t.add(tr, cr); t.position.set(x, 0, z); scene.add(t); }
  const tentCols = [0xb8582a, 0x5f6e3b, 0xa8121b]; for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(2, 2.4, 4), new THREE.MeshStandardMaterial({ color: tentCols[i % 3], roughness: 0.9 })); t.position.set(-30 + i * 4.6 + (i % 2) * 1.5, 1.2, -18 - (i % 3) * 4); t.rotation.y = i; t.castShadow = true; scene.add(t); }
  // the camp's flag on its tall mast far behind, and a lashed tower silhouette
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 26, 8), M.woodD); mast.position.set(26, 13, -36); scene.add(mast);
  // the summit flag (waving plane with the tribe logo)
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 160;
  const drawFlag = img => { const g = fc.getContext('2d'); g.fillStyle = '#f1efeb'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#a8121b'; g.fillRect(0, 0, 256, 18); g.fillRect(0, 142, 256, 18); if (img && img.complete && img.naturalWidth) { const s = 110, hh = s * img.height / img.width; g.drawImage(img, 128 - s / 2, 80 - hh / 2, s, hh); } };
  drawFlag(logoImg); const flagTex = new THREE.CanvasTexture(fc); flagTex.colorSpace = THREE.SRGBColorSpace;
  W.flagTex = flagTex;
  const f = L.flag; const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, f.top - f.y + 0.4, 8), M.woodD); pole.position.set(f.x, (f.y + f.top) / 2, 0); pole.castShadow = true; scene.add(pole);
  const fg = new THREE.PlaneGeometry(2.0, 1.25, 16, 6); fg.translate(1.0, 0, 0); const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(f.x, f.top - 0.6, 0); flag.castShadow = true; scene.add(flag);
  const fBase = Float32Array.from(fg.attributes.position.array);
  W.animated.push(t => { const pa = fg.attributes.position; for (let i = 0; i < pa.count; i++) { const x = fBase[i * 3]; pa.array[i * 3 + 2] = Math.sin(x * 2.2 - t * 5) * 0.14 * (x / 2); } pa.needsUpdate = true; });
  W.redrawFlag = img => { drawFlag(img); flagTex.needsUpdate = true; };
  return W;
}
