// The kid in the shakshuka pot, holding a tent mallet – built from simple shapes, posed every frame from physics.
import * as THREE from 'three';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildPlayer(scene) {
  const P = {};
  const metal = new THREE.MeshStandardMaterial({ color: 0xd5dce2, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.2 });
  const metalD = new THREE.MeshStandardMaterial({ color: 0x6a7278, roughness: 0.35, metalness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd29f7a, roughness: 0.7 }), shirt = new THREE.MeshStandardMaterial({ color: 0x3d6496, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x8a5d34, roughness: 0.75 }), headWood = new THREE.MeshStandardMaterial({ color: 0xb8864f, roughness: 0.7 });
  const scarfTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#a8121b'; g.fillRect(0, 0, 64, 7); g.fillStyle = '#111'; g.fillRect(0, 7, 64, 4); g.fillStyle = '#f3e03b'; g.fillRect(0, 11, 64, 5); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); return t; })();
  // --- pot (its local frame = the physics body frame; pot centre at origin) ---
  const pot = new THREE.Group(); scene.add(pot); P.pot = pot;
  const prof = [[0, -0.42], [0.5, -0.42], [0.56, -0.36], [0.6, 0], [0.62, 0.3], [0.68, 0.33], [0.68, 0.38], [0.6, 0.38], [0.58, 0.32], [0.55, -0.34], [0, -0.34]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), metal); body.castShadow = true; body.receiveShadow = true; pot.add(body);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI), metalD); h.position.set(s * 0.66, 0.12, 0); h.rotation.set(0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); pot.add(h); }
  const label = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 256, 64); g.font = '700 46px "Karantina", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(40,40,40,.75)'; g.fillText('שקשוקה', 128, 48); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.16), new THREE.MeshBasicMaterial({ map: label, transparent: true })); lab.position.set(0, 0.02, 0.6); pot.add(lab);
  // --- kid (rides in the pot) ---
  const kid = new THREE.Group(); pot.add(kid);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 6, 12), shirt); torso.position.y = 0.42; torso.castShadow = true; kid.add(torso);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), new THREE.MeshStandardMaterial({ map: scarfTex, roughness: 0.9 })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.72; kid.add(scarf);
  const head = new THREE.Group(); head.position.y = 0.98; kid.add(head);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skin); hd.castShadow = true; head.add(hd);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hr.position.y = 0.02; head.add(hr);
  const eyes = []; for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dark); e.position.set(s * 0.08, 0.02, 0.2); head.add(e); eyes.push(e); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10, Math.PI), dark); mouth.position.set(0, -0.08, 0.205); mouth.rotation.z = Math.PI; head.add(mouth);
  // --- arms + mallet (world space, posed each frame) ---
  const armMat = shirt; const arms = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), armMat); m.castShadow = true; scene.add(m); return m; });
  const hands = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin); scene.add(m); return m; });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), woodM); handle.castShadow = true; scene.add(handle);
  const mhead = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.26), headWood); mhead.castShadow = true; scene.add(mhead);
  for (const s of [-1, 1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.27), new THREE.MeshStandardMaterial({ color: 0x5a3a1c })); band.position.x = s * 0.2; mhead.add(band); }
  const up = V3(0, 1, 0), tmp = new THREE.Vector3();
  const place = (m, a, b) => { const len = a.distanceTo(b); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, Math.max(0.01, len), 1); m.quaternion.setFromUnitVectors(up, tmp.subVectors(b, a).normalize()); };
  let mood = 0;
  P.update = (potPos, potAng, pivot, headPos, headAng, t, falling) => {
    pot.position.set(potPos.x, potPos.y, 0); pot.rotation.set(0, 0, potAng);
    const look = Math.max(-1, Math.min(1, (headPos.x - potPos.x) / 2)); head.rotation.set(falling ? 0.3 : 0, look * 0.6, Math.sin(t * 1.3) * 0.04);
    mood += ((falling ? 1 : 0) - mood) * 0.1; mouth.scale.set(1, 1 - mood * 2, 1);
    const sh = new THREE.Vector3(pivot.x, pivot.y, 0), hp = new THREE.Vector3(headPos.x, headPos.y, 0);
    const dir = hp.clone().sub(sh), L = dir.length(); dir.normalize();
    const grip = sh.clone().addScaledVector(dir, Math.min(0.55, L * 0.35));
    const side = new THREE.Vector3(Math.cos(potAng), Math.sin(potAng), 0);
    for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; const shoulder = sh.clone().addScaledVector(side, s * 0.2).add(V3(0, 0.12, s * 0.08)); const hand = grip.clone().addScaledVector(dir, i * 0.14).add(V3(0, 0, s * 0.06)); place(arms[i], shoulder, hand); hands[i].position.copy(hand); }
    place(handle, grip.clone().addScaledVector(dir, -0.12), hp);
    mhead.position.copy(hp); mhead.rotation.set(0, 0, headAng);
  };
  return P;
}
