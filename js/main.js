// תקוע בסיר – drawing, controls (mouse / finger), camera, sound, the tribe's comments, saving, the summit.
(() => {
const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('takua:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('takua:' + k, JSON.stringify(v)); } catch { } } };
const cv = $('gl'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
addEventListener('resize', resize); resize();
const touch = matchMedia('(pointer:coarse)').matches;

// ---------- world ----------
const PH = createPhys(planck);
let S = null, L = null;
function buildWorld(mode, first) { S = PH.create(); L = buildLevel(S, { easy: mode !== 'pro' }); if (!first && typeof build3D === 'function') build3D(); }
buildWorld(store.get('mode', 'kid'), true);

// ---------- state ----------
const G = { playing: false, mode: store.get('mode', 'kid'), t: 0, best: 0, falls: 0, maxH: 0, peakSinceLand: 0, won: false, cp: 0, startT: 0, elapsed: 0, paused: false };
const w2s = (x, y) => toS(x, y);
const PPM = () => Math.max(38, Math.min(84, Math.min(W / (touch ? 8 : 12.5), H / 9.5)));   // pixels per metre
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
function saveRun() { if (!G.playing || G.won) return; const p = S.pot.getPosition(); store.set('run', { lv: 2, x: p.x, y: p.y, a: S.pot.getAngle(), mode: G.mode, cp: G.cp, falls: G.falls, elapsed: G.elapsed, maxH: G.maxH }); }

// ---------- drawing ----------
const COL = { wood: '#a9794a', woodD: '#6e4a2a', rope: '#d8bd84', crate: '#b58550', red: '#a8121b', red2: '#d42a2f', chalk: '#f1efeb', ink: '#111', green: '#4f6e34', canvas1: '#b8452a', canvas2: '#5f6e3b', metal: '#9aa3ab', metalD: '#5c646b', jerry: '#3f6a3a', yellow: '#F3E03B' };
const toS = (x, y) => [(x - cam.x) * PPM() + W / 2, H / 2 - (y - cam.y) * PPM()];
function sky() {
  const h = cam.y, k = Math.min(1, h / 125);
  const top = lerpC([93, 143, 200], [10, 16, 40], Math.max(0, (k - 0.55) / 0.45)), mid = lerpC([212, 227, 238], [246, 164, 108], Math.min(1, k * 1.6));
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${mid})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  if (k > 0.6) { ctx.fillStyle = `rgba(255,255,255,${(k - 0.6) * 1.8})`; for (let i = 0; i < 90; i++) { const sx = (i * 137.5 + Math.floor(cam.x * 2)) % W, sy = (i * 71.3) % (H * 0.7); ctx.fillRect(sx, sy, 1.6, 1.6); } }
  // far hills + the camp below (parallax)
  const par = (f, yb, col, amp, seed) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) { const wx = x / PPM() / f + cam.x / f; ctx.lineTo(x, H / 2 + (cam.y * PPM()) / f - (yb + Math.sin(wx * 0.35 + seed) * amp + Math.sin(wx * 0.9 + seed * 2) * amp * 0.4) * PPM() / f); } ctx.lineTo(W, H); ctx.fill(); };
  par(6, 6, 'rgba(70,92,90,.55)', 6, 1); par(3.5, 2, 'rgba(60,80,55,.75)', 3, 3);
}
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',');
function rr(x, y, w, h) { ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
function drawDeco() {
  const m = PPM(); ctx.save(); ctx.globalAlpha = 0.42; ctx.lineWidth = Math.max(1, m * 0.04);
  for (const d of L.deco) {
    const [sx, sy] = toS(d.x, d.y); if (sy < -m * 4 || sy - (d.h || 0) * m > H + m * 4) continue;
    const w = d.w * m, hh = (d.h || 0) * m;
    if (d.kind === 'cratestack') { ctx.fillStyle = COL.crate; ctx.strokeStyle = COL.woodD; for (let y = 0; y < d.h; y += 1) { rr(sx - w / 2 + (y % 2) * 4, sy + y * m, w - 8, m - 3); } }
    else if (d.kind === 'legs' || d.kind === 'shelfback') { ctx.strokeStyle = COL.woodD; ctx.lineWidth = m * 0.12; ctx.beginPath(); ctx.moveTo(sx - w / 2 + m * 0.2, sy); ctx.lineTo(sx - w / 2 + m * 0.2, sy + hh); ctx.moveTo(sx + w / 2 - m * 0.2, sy); ctx.lineTo(sx + w / 2 - m * 0.2, sy + hh); if (d.kind === 'shelfback') { ctx.moveTo(sx - w / 2, sy + hh * 0.5); ctx.lineTo(sx + w / 2, sy + hh * 0.5); } ctx.stroke(); }
    else if (d.kind === 'tentback') { ctx.fillStyle = COL.canvas2; ctx.beginPath(); ctx.moveTo(sx - w / 2, sy + m * 0.1); ctx.lineTo(sx, sy + m * 1.9); ctx.lineTo(sx + w / 2, sy + m * 0.1); ctx.closePath(); ctx.fill(); }
    else if (d.kind === 'lattice' || d.kind === 'bigben') { ctx.strokeStyle = COL.woodD; ctx.lineWidth = m * 0.09; ctx.beginPath(); const x0 = sx - w / 2 + m * 0.2, x1 = sx + w / 2 - m * 0.2; ctx.moveTo(x0, sy); ctx.lineTo(x0, sy + hh); ctx.moveTo(x1, sy); ctx.lineTo(x1, sy + hh); ctx.moveTo(x0, sy); ctx.lineTo(x1, sy + hh); ctx.moveTo(x1, sy); ctx.lineTo(x0, sy + hh); ctx.stroke();
      if (d.kind === 'bigben') { ctx.globalAlpha = 0.3; ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.arc(sx, sy + hh * 0.5, Math.min(w, hh) * 0.22, 0, 7); ctx.fill(); ctx.globalAlpha = 0.42; } }
    else if (d.kind === 'cpflag') { ctx.globalAlpha = 1; ctx.strokeStyle = COL.woodD; ctx.lineWidth = m * 0.06; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - m * 1.2); ctx.stroke(); ctx.fillStyle = COL.red; ctx.fillRect(sx, sy - m * 1.2, m * 0.55, m * 0.36); ctx.fillStyle = COL.chalk; ctx.fillRect(sx, sy - m * 1.08, m * 0.55, m * 0.1); ctx.globalAlpha = 0.42; }
  }
  ctx.restore();
}
function drawItem(it) {
  const m = PPM();
  if (it.t === 'ground') { const [, gy] = toS(0, 0); ctx.fillStyle = '#7a6a4a'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#8f9a5a'; ctx.fillRect(0, gy, W, m * 0.18);
    for (const sx0 of [-15, 15]) { const [x] = toS(sx0, 0); if ((sx0 < 0 && x <= 0) || (sx0 > 0 && x >= W)) continue; const x0 = sx0 < 0 ? 0 : x, w = sx0 < 0 ? x : W - x;
      const g2 = ctx.createLinearGradient(sx0 < 0 ? x : x, 0, sx0 < 0 ? x - m * 3 : x + m * 3, 0); g2.addColorStop(0, '#5a4e3c'); g2.addColorStop(1, '#3b3328'); ctx.fillStyle = g2; ctx.fillRect(x0, 0, w, H);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; const yOff = (cam.y * m) % (m * 1.4); for (let yy = -m * 1.4; yy < H + m; yy += m * 1.4) { ctx.beginPath(); ctx.moveTo(x0, yy + yOff); ctx.lineTo(x0 + w, yy + yOff + m * 0.3); ctx.stroke(); }
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } return; }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, m * 0.045); ctx.strokeStyle = COL.ink;
  if (it.t === 'box') {
    const [sx, sy] = toS(it.cx, it.cy); if (sx < -m * 8 || sx > W + m * 8 || sy < -m * 8 || sy > H + m * 8) { ctx.restore(); return; }
    ctx.translate(sx, sy); ctx.rotate(-it.ang); const w = it.hw * 2 * m, h = it.hh * 2 * m;
    const fills = { crate: COL.crate, table: COL.wood, counter: '#c9c2b4', cookpot: COL.metal, tentfloor: '#6d7a45', jerry: COL.jerry, plank: COL.wood, pole: COL.wood, logs: COL.wood, rope: COL.rope, beam: '#8a6a44', knob: COL.rope, summit: COL.wood };
    ctx.fillStyle = fills[it.kind] || COL.wood; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (it.kind === 'crate') { ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.strokeStyle = COL.woodD; ctx.stroke(); }
    if (it.kind === 'logs' || it.kind === 'summit') { ctx.strokeStyle = COL.woodD; ctx.beginPath(); for (let x = -w / 2 + m * 0.3; x < w / 2; x += m * 0.3) { ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); } ctx.stroke(); ctx.fillStyle = COL.rope; for (const x of [-w / 2 + m * 0.15, w / 2 - m * 0.25]) ctx.fillRect(x, -h / 2 - 2, m * 0.1, h + 4); }
    if (it.kind === 'cookpot') { ctx.fillStyle = COL.metalD; ctx.fillRect(-w / 2 - m * 0.1, -h / 2, m * 0.1, m * 0.12); ctx.fillRect(w / 2, -h / 2, m * 0.1, m * 0.12); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w * 0.2, h - 6); }
    if (it.kind === 'jerry') { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.15); ctx.fillStyle = COL.ink; ctx.fillRect(-w * 0.15, -h / 2 - m * 0.08, w * 0.3, m * 0.08); }
    if (it.kind === 'pole' || it.kind === 'beam') { ctx.fillStyle = COL.rope; const n = Math.max(1, Math.floor(h / m)); for (let k = 0; k < n; k++) ctx.fillRect(-w / 2 - 2, -h / 2 + (k + 0.5) * h / n - 2, w + 4, 4); }
    if (it.kind === 'counter') { ctx.fillStyle = COL.red; ctx.fillRect(-w / 2, h / 2 - 3, w, 3); }
    if (it.kind === 'tentfloor') { ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(-w / 2, 0, w, h / 2); }
  } else if (it.t === 'circ') {
    const [sx, sy] = toS(it.cx, it.cy), r = it.r * m; if (sy < -m * 6 || sy > H + m * 6) { ctx.restore(); return; }
    ctx.fillStyle = it.kind === 'gas' ? '#2e6ca8' : '#7a3a8a'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.stroke();
    if (it.kind === 'bag') { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(sx, sy, r * 0.55, 0, 7); ctx.stroke(); } else { ctx.fillStyle = '#ddd'; ctx.fillRect(sx - r * 0.25, sy - r - m * 0.1, r * 0.5, m * 0.12); }
  } else if (it.t === 'poly') {
    const pts = it.pts.map(p => toS(p[0], p[1])); if (pts[0][1] < -m * 6 || pts[0][1] > H + m * 6) { ctx.restore(); return; }
    ctx.fillStyle = COL.canvas1; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo((pts[0][0] + pts[1][0]) / 2, pts[0][1]); ctx.stroke();
  }
  ctx.restore();
}
function drawFlag() {
  const m = PPM(), f = L.flag, [bx, by] = toS(f.x, f.y), [, ty] = toS(f.x, f.top);
  ctx.strokeStyle = COL.ink; ctx.lineWidth = m * 0.09; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, ty); ctx.stroke();
  const wave = G.t * 4; ctx.fillStyle = COL.chalk; ctx.beginPath(); ctx.moveTo(bx, ty);
  for (let i = 0; i <= 10; i++) ctx.lineTo(bx + i / 10 * m * 1.7, ty + Math.sin(wave + i * 0.7) * m * 0.08 * i / 10); for (let i = 10; i >= 0; i--) ctx.lineTo(bx + i / 10 * m * 1.7, ty + m * 1.05 + Math.sin(wave + i * 0.7) * m * 0.08 * i / 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.red; ctx.fillRect(bx + 2, ty + 2, m * 1.66, m * 0.14); ctx.fillRect(bx + 2, ty + m * 0.89, m * 1.66, m * 0.14);
  if (LOGO.complete && LOGO.naturalWidth) { const s = m * 0.62; ctx.drawImage(LOGO, bx + m * 0.85 - s / 2, ty + m * 0.52 - s / 2, s, s); }
}
const LOGO = new Image(); LOGO.src = 'logo.webp';
function drawPlayer() {
  const m = PPM(), p = S.pot.getPosition(), a = S.pot.getAngle(), pv = S.pivot(), h = S.head.getPosition(), ha = S.head.getAngle();
  const [px, py] = toS(p.x, p.y), [sx, sy] = toS(pv.x, pv.y), [hx, hy] = toS(h.x, h.y);
  // kid's body inside the pot (drawn before the pot rim)
  ctx.save(); ctx.translate(px, py); ctx.rotate(-a);
  ctx.fillStyle = '#3d6496'; ctx.strokeStyle = COL.ink; ctx.lineWidth = Math.max(1.5, m * 0.04);
  ctx.beginPath(); ctx.ellipse(0, -m * 0.4, m * 0.3, m * 0.38, 0, 0, 7); ctx.fill(); ctx.stroke();                         // torso
  ctx.fillStyle = COL.red; ctx.fillRect(-m * 0.24, -m * 0.72, m * 0.48, m * 0.1); ctx.fillStyle = '#111'; ctx.fillRect(-m * 0.24, -m * 0.67, m * 0.48, m * 0.03); ctx.fillStyle = COL.yellow; ctx.fillRect(-m * 0.24, -m * 0.64, m * 0.48, m * 0.03);  // tribe scarf
  ctx.fillStyle = '#d29f7a'; ctx.beginPath(); ctx.arc(0, -m * 0.98, m * 0.24, 0, 7); ctx.fill(); ctx.stroke();               // head
  ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.arc(0, -m * 1.04, m * 0.24, Math.PI, 0); ctx.fill();                        // hair
  const look = Math.max(-1, Math.min(1, (hx - px) / (m * 2))); ctx.fillStyle = '#111'; ctx.fillRect(look * m * 0.08 - m * 0.09, -m * 1.0, m * 0.05, m * 0.07); ctx.fillRect(look * m * 0.08 + m * 0.05, -m * 1.0, m * 0.05, m * 0.07);
  ctx.restore();
  // arms to the mallet handle
  const hand = [sx + (hx - sx) * 0.32, sy + (hy - sy) * 0.32];
  ctx.strokeStyle = '#3d6496'; ctx.lineWidth = m * 0.13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - m * 0.18, sy); ctx.lineTo(hand[0], hand[1]); ctx.moveTo(sx + m * 0.18, sy); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
  // mallet: handle + wooden head
  ctx.strokeStyle = '#7a5530'; ctx.lineWidth = m * 0.09; ctx.beginPath(); ctx.moveTo(hand[0] - (hx - sx) * 0.12, hand[1] - (hy - sy) * 0.12); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#d29f7a'; ctx.beginPath(); ctx.arc(hand[0], hand[1], m * 0.09, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-ha); ctx.fillStyle = '#b8864f'; ctx.strokeStyle = COL.ink; ctx.lineWidth = Math.max(1.5, m * 0.04); const w = 0.52 * m, hh = 0.24 * m; ctx.fillRect(-w / 2, -hh / 2, w, hh); ctx.strokeRect(-w / 2, -hh / 2, w, hh); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-w / 2, -hh / 2, w * 0.18, hh); ctx.fillRect(w / 2 - w * 0.18, -hh / 2, w * 0.18, hh); ctx.restore();
  // the pot
  ctx.save(); ctx.translate(px, py); ctx.rotate(-a);
  const gr = ctx.createLinearGradient(-m * 0.6, 0, m * 0.6, 0); gr.addColorStop(0, '#5c646b'); gr.addColorStop(0.35, '#c9d0d6'); gr.addColorStop(1, '#4a5056'); ctx.fillStyle = gr; ctx.strokeStyle = COL.ink; ctx.lineWidth = Math.max(1.5, m * 0.045);
  ctx.beginPath(); ctx.moveTo(-0.5 * m, 0.42 * m); ctx.lineTo(0.5 * m, 0.42 * m); ctx.lineTo(0.6 * m, 0); ctx.lineTo(0.62 * m, -0.36 * m); ctx.lineTo(-0.62 * m, -0.36 * m); ctx.lineTo(-0.6 * m, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7d858c'; ctx.fillRect(-0.7 * m, -0.42 * m, 1.4 * m, 0.1 * m); ctx.strokeRect(-0.7 * m, -0.42 * m, 1.4 * m, 0.1 * m);   // rim
  ctx.fillStyle = '#4a5056'; ctx.fillRect(-0.82 * m, -0.2 * m, 0.18 * m, 0.08 * m); ctx.fillRect(0.64 * m, -0.2 * m, 0.18 * m, 0.08 * m);   // handles
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 ${m * 0.2}px "Karantina", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('שקשוקה', 0, 0.22 * m);
  ctx.restore();
  // aim ghost (desktop: shows where the mallet wants to go)
  const [ax, ay] = toS(pv.x + S.aim.x, pv.y + S.aim.y); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, m * 0.12, 0, 7); ctx.stroke();
}


// ---------- loop ----------
// ---------- coach: shows a first-timer exactly where to put the mallet and when to pull ----------
// Runs in חניך mode for the first 3 climbs, and again whenever you are stuck for 35 s.
let coachPull = false, coachLeft = store.get('coach', 3), coachOn = false, coachLedge = null, stuckT = 0, lastMax = 0, coachMsg = '';
const PULL = touch ? 'עכשיו גרור את האצבע למטה, אל הסיר' : 'עכשיו משוך את העכבר למטה, אל הסיר';
const PUT = touch ? 'גרור את האצבע כדי לשים את הפטיש על העיגול' : 'הזז את העכבר כדי לשים את הפטיש על העיגול';
function coachPick(p) { let best = null, bd = 1e9; for (const Lg of L.ledges) { if (Lg.y < p.y - 0.05 || Lg.y > p.y + 2.6 || Math.abs(Lg.x - p.x) < Lg.w / 2 - 0.2) continue; const d = Math.max(0, Math.abs(Lg.x - p.x) - Lg.w / 2) + (Lg.y - p.y) * 0.3; if (d < bd && d < 3.2) { bd = d; best = Lg; } } return best; }
function coachTick(dt) {
  const p = S.pot.getPosition();
  if (G.maxH > lastMax + 0.4) { lastMax = G.maxH; stuckT = 0; } else stuckT += dt;
  const want = G.mode === 'kid' && (coachLeft > 0 || stuckT > 35);
  if (!want) { if (coachOn) { coachOn = false; $('coach').classList.remove('on'); } return; }
  if (!coachLedge || p.y > coachLedge.y + 0.3 || coachLedge.y > p.y + 3.2) {
    if (coachLedge && p.y > coachLedge.y + 0.3 && Math.abs(p.x - coachLedge.x) < coachLedge.w / 2 + 0.3) {   // climbed it
      tone(784, 0.1); tone(1046, 0.16, 'triangle', 0.15, 0.08); stuckT = 0;
      if (coachLeft > 0) { coachLeft--; store.set('coach', coachLeft); if (coachLeft === 0) say('מדריך', 'בדיוק ככה! לשים, לתפוס, למשוך. מכאן אתה לבד.', 4.5); else toast('יפה! עוד פעם'); }
    }
    coachLedge = coachPick(p);
  }
  coachOn = !!coachLedge;
  const hp = S.head.getPosition(), cpt = coachLedge && coachPoint(p), onIt = cpt && Math.hypot(hp.x - cpt.x, hp.y - cpt.y) < 0.75;
  coachPull = !!onIt;
  const msg = !coachLedge ? '' : onIt ? PULL : PUT;
  if (msg !== coachMsg) { coachMsg = msg; $('coachText').textContent = msg; }
  $('coach').classList.toggle('on', coachOn);
}
function coachPoint(p) { const Lg = coachLedge, side = p.x < Lg.x ? -1 : 1, edge = Lg.x + side * Lg.w / 2; return { x: edge - side * 0.5, y: Lg.y }; }
function coachDraw() {
  if (!coachOn || !G.playing || G.paused) return;
  const p = S.pot.getPosition(), pv = S.pivot(), h = S.head.getPosition(), pulse = 0.5 + 0.5 * Math.sin(G.t * 6);
  ctx.save(); ctx.lineCap = 'round';
  if (!coachPull) {
    const c = coachPoint(p), [cx, cy] = w2s(c.x, c.y), [hx, hy] = w2s(h.x, h.y), r = PPM() * (0.32 + pulse * 0.08);
    ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,.25)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  } else {
    const [hx, hy] = w2s(h.x, h.y), [px, py] = w2s(p.x, p.y), dx = px - hx, dy = py - hy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const a = 26 + pulse * 18, sx = hx + ux * 30, sy = hy + uy * 30, ex = sx + ux * (60 + a), ey = sy + uy * (60 + a);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(ex + ux * 18, ey + uy * 18); ctx.lineTo(ex - uy * 16, ey + ux * 16); ctx.lineTo(ex + uy * 16, ey - ux * 16); ctx.fill();
  }
  ctx.restore();
}
let acc = 0, lastT = performance.now(), landT = 0, onGround = false;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.playing && !G.paused && !G.won) {
    G.t += dt; G.elapsed += dt;
    // aim from the mouse (desktop)
    if (!touch && mouse) { const pv = S.pivot(), [sx, sy] = toS(pv.x, pv.y); aim.x = (mouse.x - sx) / PPM(); aim.y = -(mouse.y - sy) / PPM(); }
    S.setAim(aim.x, aim.y);
    coachTick(dt);
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
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); sky(); drawDeco(); for (const it of L.items) drawItem(it); drawFlag(); drawPlayer();
  if (fwT > 0) fireworks(dt);
  coachDraw();
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
  const run0 = cont ? store.get('run', null) : null; if (run0 && run0.mode) G.mode = run0.mode;
  audioInit(); buildWorld(G.mode); G.won = false; G.paused = false; sparks = []; fwT = 0;
  const run = run0 && (run0.mode === 'pro' || run0.lv === 2) ? run0 : null;   // old חניך saves were on the old, higher steps
  if (run) { G.mode = run.mode || G.mode; S.place(run.x, run.y + 0.05); G.cp = run.cp || 0; G.falls = run.falls || 0; G.elapsed = run.elapsed || 0; G.maxH = run.maxH || run.y; }
  else { S.place(L.startX, 0.45); G.cp = 0; G.falls = 0; G.elapsed = 0; G.maxH = 0; store.set('run', null); }
  coachLedge = null; stuckT = 0; lastMax = G.maxH; coachMsg = '';
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
$('ctlHint').textContent = touch ? 'גוררים את האצבע על המסך – הפטיש זז איתה.' : 'מזיזים את העכבר – הפטיש הולך אחריו.';
refreshMenu(); show('menu'); requestAnimationFrame(frame);
window.__T = { G, get S() { return S; }, get L() { return L; }, aim, start, win };
})();
