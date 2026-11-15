// תקוע בסיר (3D) – controls (mouse / finger), camera, sound, the tribe's comments, saving, the summit.
import * as THREE from 'three';
import { makeTextures, buildWorld3D } from './world3d.js';
import { buildPlayer } from './player3d.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
(() => {
const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('takua:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('takua:' + k, JSON.stringify(v)); } catch { } } };
const cv = $('gl'), fx = $('fx'), ctx = fx.getContext('2d');
const touch = matchMedia('(pointer:coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touch ? 1.6 : 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); fx.width = W * DPR; fx.height = H * DPR; fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
addEventListener('resize', resize); resize();

// ---------- world ----------
const PH = createPhys(planck);
let S = null, L = null;
function buildWorld() { S = PH.create(); L = buildLevel(S); }
buildWorld();

// ---------- state ----------
const G = { playing: false, mode: store.get('mode', 'kid'), t: 0, best: 0, falls: 0, maxH: 0, peakSinceLand: 0, won: false, cp: 0, startT: 0, elapsed: 0, paused: false };
const CAMD = () => touch && W < H ? 15 : 12.5;                                          // camera distance (m)
const PPM = () => H / (2 * CAMD() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));   // pixels per metre on the play plane
const cam = { x: 0, y: 3 };
const aim = { x: 1.4, y: 0.2 };                // aim offset (metres) from the shoulders
let lastSave = 0;

// ---------- input ----------
// desktop: the mallet goes where the mouse is (relative to the kid). phone: drag anywhere = trackpad.
let mouse = null, drag = null;
addEventListener('mousemove', e => { if (touch) return; mouse = { x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch { } } });
cv.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const k = 1 / PPM() * 1.35; aim.x += (e.clientX - drag.x) * k; aim.y -= (e.clientY - drag.y) * k; const L2 = Math.hypot(aim.x, aim.y), m = PH.P.reachMax + 0.3; if (L2 > m) { aim.x *= m / L2; aim.y *= m / L2; } drag.x = e.clientX; drag.y = e.clientY; });
const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
addEventListener('keydown', e => { if (e.code === 'Escape' && G.playing) togglePause(); if (e.code === 'KeyR' && G.playing && G.mode === 'kid') toCheckpoint(); });

// ---------- sound (synth) ----------
let ac = null, master = null, windG = null, soundOn = store.get('sound', true);
function audioInit() { if (ac) { ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = soundOn ? 0.7 : 0; master.connect(ac.destination);
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = l * 3; }
  const s = ac.createBufferSource(); s.buffer = b; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; windG = ac.createGain(); windG.gain.value = 0; s.connect(f); f.connect(windG); windG.connect(master); s.start(); } catch { } }
function tone(freq, dur, type = 'triangle', vol = 0.2, at = 0, f2) { if (!ac) return; const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05); }
function knock(mat, power) { const v = Math.min(0.35, power / 60); if (v < 0.02) return;
  if (mat === 'metal' || mat === 'pot') { tone(620 + Math.random() * 80, 0.35, 'triangle', v * 0.8); tone(1240, 0.2, 'sine', v * 0.3); }
  else if (mat === 'rope') tone(180, 0.12, 'sine', v);
  else if (mat === 'rock' || mat === 'ground') tone(110, 0.16, 'square', v * 0.5, 0, 60);
  else tone(240 + Math.random() * 40, 0.12, 'square', v * 0.6, 0, 140); }

// ---------- the tribe talks ----------
const FALL_LINES = [
  ['השביעסט', 'אל תדאג, גם אני נפלתי פה. שלוש פעמים. היום.'], ['הרכזת', 'מי שם את הסיר הזה באמצע המטבח?!'], ['תורן מטבח', 'הסיר הזה היה אמור להיות לשקשוקה…'],
  ['מדריך', 'נשימה עמוקה. הפטיש הוא חבר שלך.'], ['חניך מהשכבה הצעירה', 'וואו! עוד פעם! עוד פעם!'], ['ראש השבט', 'כל מטפס אמיתי נופל. השאלה היא אם קמים.'],
  ['השביעסט', 'זוכר את המתקן של 1991? גם אותו בנינו פעמיים.'], ['אחראי המחסן', 'רק שלא תשבור לי את הג׳ריקנים.'], ['הרכזת', 'אני רושמת את זה ביומן הפעולה.'],
  ['מדריך', 'הכל טוב. מה שעולה – נופל. ומה שנופל – עולה שוב.'], ['חניכה', 'ראיתי! זה היה כמעט!'], ['השביעסט', 'טוב, לפחות הסיר שלם.'],
  ['ראש השבט', 'בשבט שלנו לא מוותרים. גם לא בתוך סיר.'], ['תורן מטבח', 'אם אתה כבר למטה – תביא לי בצל.'], ['מדריך', 'חזק ואמץ. ובעיקר – לאט.'],
  ['הרכזת', 'תזכור: הפטיש מושך אותך, לא אתה את הפטיש.'], ['השביעסט', 'אם תגיע לפסגה – אני עושה שקשוקה לכל השבט.'], ['חניך', 'אני כבר הייתי מוותר. אבל אני לא בסיר.'],
];
const SECTION_LINES = { tents: ['מדריך', 'האוהלים! זהירות – הבד חלקלק.'], store: ['אחראי המחסן', 'ברוך הבא למחסן. לא לגעת בכלום.'], facility: ['השביעסט', 'המתקן! מעמודים וחבלים – כמו שאנחנו אוהבים.'], bigben: ['ראש השבט', 'ביג בן של 1991. רק הטובים הגיעו לכאן.'], pole: ['כל השבט', 'התורן! עוד קצת! הדגל מחכה!'] };
let lineT = 0, lastLine = -1;
function say(who, text, secs = 4) { $('lineWho').textContent = who; $('lineText').textContent = text; $('line').classList.add('on'); lineT = secs; }

// ---------- checkpoints / saving ----------
function toCheckpoint() { const c = L.checkpoints[G.cp]; S.place(c.x, c.y); aim.x = 1.2; aim.y = 0.3; G.peakSinceLand = c.y; tone(523, 0.12); tone(784, 0.15, 'triangle', 0.15, 0.08); }
function saveRun() { if (!G.playing || G.won) return; const p = S.pot.getPosition(); store.set('run', { x: p.x, y: p.y, a: S.pot.getAngle(), mode: G.mode, cp: G.cp, falls: G.falls, elapsed: G.elapsed, maxH: G.maxH }); }

// ---------- 3D scene ----------
const LOGO = new Image(); LOGO.src = 'logo.webp';
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uNight: { value: 0 } };
const dome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }',
  fragmentShader: 'uniform vec3 uTop,uHor; uniform float uNight; varying vec3 vD; float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }\n' +
    'void main(){ vec3 d = normalize(vD); float h = d.y; vec3 col = mix(uHor, uTop, pow(max(h,0.), 0.5)); if (h < 0.) col = uHor*0.8;\n' +
    ' if (uNight > 0.) { vec2 g = floor(vec2(atan(d.z, d.x)*160., h*160.)); col += vec3(step(0.995, h21(g)) * smoothstep(0.02, 0.25, h)) * uNight; }\n' +
    ' gl_FragColor = vec4(col, 1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }));
dome.frustumCulled = false; dome.renderOrder = -10; scene.add(dome);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6a5a40, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
scene.fog = new THREE.Fog(0xcfdde8, 40, 220);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; }
const TX = makeTextures(); let W3 = null; const PL = buildPlayer(scene);
function build3D() { W3 = buildWorld3D(scene, L, TX, LOGO); }
build3D();
LOGO.onload = () => { if (W3 && W3.redrawFlag) W3.redrawFlag(LOGO); };
const C = h => new THREE.Color(h);
const SKY = [[0, C('#5d8fc8'), C('#d4e3ee'), C('#cfdde8'), 2.6, 1.15, 0], [55, C('#4a74b8'), C('#f0c89a'), C('#e2c6a6'), 2.3, 1.0, 0], [95, C('#2c3f78'), C('#f6a46c'), C('#e2a888'), 1.7, 0.8, 0.2], [125, C('#070b1c'), C('#3a3a66'), C('#26284a'), 0.7, 0.5, 1]];
function skyAt(y) { let i = 0; while (i < SKY.length - 2 && y > SKY[i + 1][0]) i++; const a = SKY[i], b = SKY[i + 1], k = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0]))); return { top: a[1].clone().lerp(b[1], k), hor: a[2].clone().lerp(b[2], k), fog: a[3].clone().lerp(b[3], k), si: a[4] + (b[4] - a[4]) * k, hi: a[5] + (b[5] - a[5]) * k, night: a[6] + (b[6] - a[6]) * k }; }
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
function screenToPlane(x, y) { ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
function render3D(dt) {
  const st = skyAt(cam.y); skyU.uTop.value.copy(st.top); skyU.uHor.value.copy(st.hor); skyU.uNight.value = st.night; scene.fog.color.copy(st.fog); sun.intensity = st.si; hemi.intensity = st.hi;
  // camera: from the side, a little to the right and above, so the depth shows
  const d = CAMD(); camera.position.set(cam.x + d * 0.16, cam.y + d * 0.12, d); camera.lookAt(cam.x, cam.y, 0); dome.position.copy(camera.position);
  sun.position.set(cam.x + 8, cam.y + 16, 14); sun.target.position.set(cam.x, cam.y, 0);
  const p = S.pot.getPosition(), v = S.pot.getLinearVelocity();
  PL.update(p, S.pot.getAngle(), S.pivot(), S.head.getPosition(), S.head.getAngle(), G.t, v.y < -6);
  for (const f of W3.animated) f(G.t);
  renderer.render(scene, camera);
}
// ---------- loop ----------
let acc = 0, lastT = performance.now(), landT = 0, onGround = false;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.playing && !G.paused && !G.won) {
    G.t += dt; G.elapsed += dt;
    // aim from the mouse (desktop)
    if (!touch && mouse) { const pv = S.pivot(), w = screenToPlane(mouse.x, mouse.y); if (w) { aim.x = w.x - pv.x; aim.y = w.y - pv.y; } }
    S.setAim(aim.x, aim.y);
    acc += dt; let n = 0; while (acc >= 1 / 120 && n < 8) { S.step(1 / 120); acc -= 1 / 120; n++; }
    // impacts → sound
    if (S.impacts.length) { const big = S.impacts.reduce((a, b) => b.n > a.n ? b : a); knock(big.who === 'pot' ? 'pot' : big.mat, big.n); S.impacts.length = 0; }
    const p = S.pot.getPosition(), v = S.pot.getLinearVelocity();
    // falling / landing → a line from the tribe
    if (p.y > G.peakSinceLand) G.peakSinceLand = p.y;
    const resting = Math.abs(v.y) < 0.6 && Math.abs(v.x) < 0.8;
    if (resting) { landT += dt; if (landT > 0.35 && G.peakSinceLand - p.y > 5.5) { G.falls++; let k; do { k = Math.floor(Math.random() * FALL_LINES.length); } while (k === lastLine); lastLine = k; say(...FALL_LINES[k]); tone(330, 0.3, 'sawtooth', 0.08, 0, 160); } if (landT > 0.35) G.peakSinceLand = p.y; } else landT = 0;
    // progress, sections, checkpoints
    if (p.y > G.maxH) { G.maxH = p.y; }
    if (p.y > G.best) { G.best = p.y; store.set('best', G.best); }
    for (let i = G.cp + 1; i < L.checkpoints.length; i++) { const c = L.checkpoints[i]; if (p.y > c.y - 0.2 && Math.abs(p.x - c.x) < 3) { G.cp = i; const ln = SECTION_LINES[c.sec]; if (ln) say(ln[0], ln[1], 4.5); toast(G.mode === 'kid' ? `נקודת שמירה: ${c.name}` : c.name); tone(660, 0.12); tone(990, 0.18, 'triangle', 0.15, 0.1); } }
    // summit
    if (p.y > L.summitY + 0.3 && Math.abs(p.x - L.flag.x) < 2.2 && resting && landT > 0.25) win();
    if (windG && ac) windG.gain.setTargetAtTime(Math.min(0.25, 0.02 + p.y / 500 + Math.hypot(v.x, v.y) / 120), ac.currentTime, 0.3);
    if (now - lastSave > 3000) { lastSave = now; saveRun(); }
    // HUD
    $('hNow').textContent = Math.max(0, p.y - 0.45).toFixed(1); $('hBest').textContent = Math.max(0, G.best - 0.45).toFixed(1);
    $('hTime').textContent = fmtT(G.elapsed); $('hSec').textContent = L.secAt(p.y).name; $('hBar').style.height = Math.min(100, (p.y / (L.summitY + 1)) * 100) + '%';
  }
  if (lineT > 0) { lineT -= dt; if (lineT <= 0) $('line').classList.remove('on'); }
  // camera
  const p = S.pot.getPosition(); const k = 1 - Math.exp(-(G.playing ? 5 : 1) * dt);
  const tx = G.playing ? p.x : Math.sin(G.t * 0.1) * 4, ty = G.playing ? p.y + 0.8 : 4 + Math.sin(G.t * 0.07) * 2;
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; if (!G.playing) G.t += dt;
  // draw
  render3D(dt);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); if (fwT > 0 || sparks.length) fireworks(dt);
}
const fmtT = s => { s = Math.floor(s); const h = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
let toastT = 0; function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }

// ---------- summit ----------
let fwT = 0, sparks = [];
function win() {
  G.won = true; store.set('run', null); const prev = store.get('bestTime', null); const t = G.elapsed; if (prev == null || t < prev) store.set('bestTime', t);
  const wins = store.get('wins', 0) + 1; store.set('wins', wins);
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.6, 'triangle', 0.2, i * 0.14));
  say('כל השבט', 'הוא בפסגה!!! מה שבונים ביחד – חי!', 6); fwT = 7;
  setTimeout(() => { $('winTime').textContent = fmtT(t); $('winFalls').textContent = G.falls; $('winBest').textContent = fmtT(Math.min(t, prev ?? t)); $('winMode').textContent = G.mode === 'kid' ? 'מצב חניך' : 'מצב בוגר – בלי נקודות שמירה'; show('win'); }, 3200);
}
function fireworks(dt) {
  fwT -= dt; if (Math.random() < dt * 6) { const x = W * (0.2 + Math.random() * 0.6), y = H * (0.15 + Math.random() * 0.3), c = ['#a8121b', '#F3E03B', '#f1efeb', '#4fc39a'][Math.floor(Math.random() * 4)]; for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 140; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1.2, c }); } }
  for (const s of sparks) { s.vy += 120 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt; ctx.globalAlpha = Math.max(0, s.l); ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 3, 3); } ctx.globalAlpha = 1; sparks = sparks.filter(s => s.l > 0);
}

// ---------- menus ----------
const SCREENS = ['menu', 'help', 'pause', 'win'];
function show(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); $('hud').classList.toggle('hidden', !!id || !G.playing); }
function refreshMenu() {
  const run = store.get('run', null), best = store.get('best', 0), bt = store.get('bestTime', null);
  $('btnCont').classList.toggle('hidden', !run); if (run) $('btnCont').textContent = `להמשיך מ־${Math.max(0, run.y - 0.45).toFixed(0)} מ׳`;
  $('menuBest').textContent = best > 1 ? `השיא שלך: ${Math.max(0, best - 0.45).toFixed(1)} מ׳` + (bt != null ? ` · הגעת לפסגה ב־${fmtT(bt)}` : '') : '';
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === G.mode));
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { G.mode = b.dataset.mode; store.set('mode', G.mode); refreshMenu(); tone(880, 0.05); });
function start(cont) {
  audioInit(); buildWorld(); G.won = false; G.paused = false; sparks = []; fwT = 0;
  const run = cont ? store.get('run', null) : null;
  if (run) { G.mode = run.mode || G.mode; S.place(run.x, run.y + 0.05); G.cp = run.cp || 0; G.falls = run.falls || 0; G.elapsed = run.elapsed || 0; G.maxH = run.maxH || run.y; }
  else { S.place(L.startX, 0.45); G.cp = 0; G.falls = 0; G.elapsed = 0; G.maxH = 0; store.set('run', null); }
  G.best = store.get('best', 0); G.peakSinceLand = S.pot.getPosition().y; G.playing = true; aim.x = 1.2; aim.y = 0.3;
  $('btnCp').classList.toggle('hidden', G.mode !== 'kid'); $('hMode').textContent = G.mode === 'kid' ? 'חניך' : 'בוגר';
  show(null);
  if (!run) setTimeout(() => say('תורן מטבח', 'נכנסת לסיר של השקשוקה ונתקעת? יופי. הדרך היחידה החוצה – למעלה, עד הדגל על התורן.', 6), 600);
}
function togglePause() { G.paused = !G.paused; if (G.paused) { saveRun(); show('pause'); } else show(null); }
$('btnStart').onclick = () => start(false); $('btnCont').onclick = () => start(true);
$('btnHelp').onclick = () => show('help'); $('btnHelpBack').onclick = () => show(G.playing ? 'pause' : 'menu'); $('btnPHelp').onclick = () => show('help');
$('btnPause').onclick = togglePause; $('btnResume').onclick = togglePause; $('btnCp').onclick = () => toCheckpoint();
$('btnQuit').onclick = () => { saveRun(); G.playing = false; refreshMenu(); show('menu'); };
$('btnAgain').onclick = () => start(false); $('btnWinMenu').onclick = () => { G.playing = false; refreshMenu(); show('menu'); };
$('btnSound').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); if (master) master.gain.value = soundOn ? 0.7 : 0; $('btnSound').textContent = soundOn ? 'צליל: פועל' : 'צליל: כבוי'; };
$('btnSound').textContent = soundOn ? 'צליל: פועל' : 'צליל: כבוי';
addEventListener('pagehide', saveRun); document.addEventListener('visibilitychange', () => { if (document.hidden) saveRun(); });
$('ctlHint').textContent = touch ? 'גוררים את האצבע על המסך – הפטיש זז איתה. דוחפים את הקרקע כדי לעלות, ותופסים קצוות עם ראש הפטיש.' : 'מזיזים את העכבר – הפטיש הולך אחריו. דוחפים את הקרקע כדי לעלות, ותופסים קצוות עם ראש הפטיש.';
refreshMenu(); show('menu'); requestAnimationFrame(frame);
window.__T = { G, get S() { return S; }, get L() { return L; }, aim, start, win };
})();
