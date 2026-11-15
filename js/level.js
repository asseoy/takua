// The climb: one tall pile of camp stuff, built as a zig-zag of ledges that get harder as you go up.
// Sections: המטבח → האוהלים → המחסן → המתקן → ביג בן → התורן. Each piece is solid (bright, outlined);
// the dim structure behind it is decoration only. Returns the list of pieces for drawing.
(function (root, factory) { if (typeof module !== 'undefined') module.exports = factory; else root.buildLevel = factory; })(this, function buildLevel(S) {
  const items = [], deco = [], checkpoints = [];
  const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(1986);
  const SECTIONS = [
    { id: 'kitchen', name: 'המטבח', y0: 0, y1: 18 },
    { id: 'tents', name: 'האוהלים', y0: 18, y1: 38 },
    { id: 'store', name: 'המחסן', y0: 38, y1: 58 },
    { id: 'facility', name: 'המתקן', y0: 58, y1: 84 },
    { id: 'bigben', name: 'ביג בן', y0: 84, y1: 108 },
    { id: 'pole', name: 'התורן', y0: 108, y1: 130 },
  ];
  const secAt = y => SECTIONS.find(s => y >= s.y0 && y < s.y1) || SECTIONS[SECTIONS.length - 1];
  const box = (kind, cx, cy, hw, hh, ang = 0, opt = {}) => { S.addBox(cx, cy, hw, hh, ang, opt); items.push({ t: 'box', kind, cx, cy, hw, hh, ang, ...opt }); };
  const circ = (kind, cx, cy, r, opt = {}) => { S.addCircle(cx, cy, r, opt); items.push({ t: 'circ', kind, cx, cy, r, ...opt }); };
  const poly = (kind, pts, opt = {}) => { S.addPoly(pts, opt); items.push({ t: 'poly', kind, pts, ...opt }); };

  // ground + side cliffs (the camp hill)
  S.addChain([[-15, 140], [-15, 0], [15, 0], [15, 140]], { mat: 'rock' });
  items.push({ t: 'ground' });

  // ---- the spine: ledges that zig-zag upward ----
  const steps = [1.3, 1.5, 1.2, 1.7, 1.4, 1.6, 1.8, 1.3, 1.6, 1.9];
  let x = 3.2, y = 0, dir = 1, run = 0, prevW = 3, i = 0;
  const ledges = [];
  while (y < 107) {
    const sec = secAt(y);
    const hard = (y / 107);                     // 0 → 1 going up
    const easy = y < 9 ? 0.78 : 1;                 // the first kitchen steps are gentle
    const h = (steps[i % steps.length] + hard * 0.35 * (i % 3 === 0 ? 1 : 0)) * easy;
    const w = Math.max(1.4, 3.6 - hard * 1.8 + (R() - 0.5) * 0.6) + (y < 9 ? 0.6 : 0);
    y += h; i++;
    let nx = x + dir * (prevW / 2 + w / 2 - 0.4 + hard * 0.9 + R() * 0.4);
    if (nx > 11.5 - w / 2 || nx < -11.5 + w / 2 || ++run > 3 + Math.floor(R() * 2)) { dir *= -1; run = 0; nx = x + dir * (prevW / 2 + w / 2 - 0.6 + hard * 0.7); }
    nx = Math.max(-11.5 + w / 2, Math.min(11.5 - w / 2, nx));
    ledges.push({ x: nx, y, w, sec: sec.id }); x = nx; prevW = w;
  }
  // build each ledge in its section's style
  for (const L of ledges) {
    const { x: cx, y: top, w, sec } = L;
    if (sec === 'kitchen') {
      const kind = ['crate', 'table', 'counter', 'crate'][Math.floor(R() * 4)];
      if (kind === 'crate') { box('crate', cx, top - 0.5, w / 2, 0.5); deco.push({ kind: 'cratestack', x: cx, y: top - 1, w, h: top - 1 }); }
      else { box(kind, cx, top - 0.12, w / 2, 0.12); deco.push({ kind: 'legs', x: cx, y: top - 0.24, w, h: Math.min(top - 0.24, 3) }); }
      if (R() < 0.45) { const px = cx + (R() - 0.5) * (w - 1.2); if (R() < 0.5) box('cookpot', px, top + 0.4, 0.42, 0.4); else circ('gas', px, top + 0.38, 0.38, { friction: 0.6 }); }
    }
    else if (sec === 'tents') {
      box('tentfloor', cx, top - 0.1, w / 2, 0.1, 0, { friction: 0.85 });
      deco.push({ kind: 'tentback', x: cx, y: top, w });
      if (R() < 0.5) { const tw = Math.min(w * 0.7, 1.8), px = cx + (R() < 0.5 ? -1 : 1) * (w / 2 - tw / 2); poly('tent', [[px - tw / 2, top], [px + tw / 2, top], [px, top + tw * 0.7]], { friction: 0.25 }); }
      else if (R() < 0.6) circ('bag', cx + (R() - 0.5) * (w - 1), top + 0.32, 0.32, { friction: 0.5 });
    }
    else if (sec === 'store') {
      const kind = R() < 0.5 ? 'jerry' : 'plank';
      if (kind === 'jerry') { const n = Math.max(1, Math.round(w / 0.7)); for (let k = 0; k < n; k++) box('jerry', cx - w / 2 + 0.35 + k * (w - 0.7) / Math.max(1, n - 1 || 1), top - 0.42, 0.3, 0.42); deco.push({ kind: 'shelfback', x: cx, y: top - 0.84, w, h: 3 }); }
      else { box('plank', cx, top - 0.1, w / 2, 0.1); deco.push({ kind: 'legs', x: cx, y: top - 0.2, w, h: 2.6 }); }
      if (R() < 0.3) { const px = cx + (R() < 0.5 ? -1 : 1) * (w / 2 + 0.3); box('pole', px, top + 0.6, 0.08, 1.3, (R() - 0.5) * 0.6); }
    }
    else if (sec === 'facility') {
      box('logs', cx, top - 0.12, w / 2, 0.12);
      deco.push({ kind: 'lattice', x: cx, y: top - 0.24, w, h: 3.2 });
      if (R() < 0.45) { const s = R() < 0.5 ? -1 : 1; box('pole', cx + s * (w / 2 - 0.1), top + 0.9, 0.08, 0.9, s * 0.35); }
      if (R() < 0.25) box('rope', cx + (R() < 0.5 ? -1 : 1) * (w / 2 + 0.7), top + 0.8, 0.6, 0.04);
    }
    else {
      box('beam', cx, top - 0.1, w / 2, 0.1, 0, { mat: 'wood' });
      deco.push({ kind: 'bigben', x: cx, y: top - 0.2, w, h: 3.4 });
      if (R() < 0.35) { const s = R() < 0.5 ? -1 : 1; box('pole', cx + s * w * 0.25, top + 0.75, 0.07, 0.8, s * 0.7); }
    }
  }
  // section checkpoints: the first ledge of each section (plus the floor)
  checkpoints.push({ x: 0, y: 0.45, sec: 'kitchen', name: 'המטבח' });
  for (const s of SECTIONS.slice(1)) { const L = ledges.find(l => l.y >= s.y0); if (L) { checkpoints.push({ x: L.x, y: L.y + 0.5, sec: s.id, name: s.name }); deco.push({ kind: 'cpflag', x: L.x + L.w / 2 - 0.25, y: L.y }); } }

  // ---- the flagpole finale ----
  const last = ledges[ledges.length - 1];
  if (!checkpoints.some(c => c.sec === 'pole')) { checkpoints.push({ x: last.x, y: last.y + 0.5, sec: 'pole', name: 'התורן' }); deco.push({ kind: 'cpflag', x: last.x + last.w / 2 - 0.25, y: last.y }); }
  const fx = last.x > 0 ? last.x - last.w / 2 - 2.2 : last.x + last.w / 2 + 2.2, base = last.y;
  box('pole', fx, base + 7.2, 0.14, 7.4, 0, { mat: 'wood' });
  for (let k = 0; k < 9; k++) { const s = k % 2 ? 1 : -1; box('knob', fx + s * 0.55, base + 1.4 + k * 1.45, 0.42, 0.09, 0, { mat: 'rope' }); }
  const topY = base + 14.8;
  box('summit', fx, topY, 1.7, 0.16);
  const flag = { x: fx + 0.6, y: topY + 0.16, top: topY + 4 };
  // dim background structure for the facility/bigben feel all the way up
  const f0 = ledges[0], startX = f0.x - f0.w / 2 - 1.1; checkpoints[0].x = startX;
  return { items, deco, checkpoints, SECTIONS, secAt, flag, ledges, summitY: topY, startX };
});
