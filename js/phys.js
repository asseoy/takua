// תקוע בסיר – the physics: a heavy pot with a kid inside, and a tent mallet whose head is pulled toward the
// point you aim at. When the mallet head is blocked by the world, the same force pushes the pot the other way –
// that is the whole trick of climbing. Works with planck.js (Box2D) in the browser and in Node for tests.
(function (root, factory) { if (typeof module !== 'undefined') module.exports = factory; else root.createPhys = factory; })(this, function createPhys(planck) {
  const { World, Vec2, Circle, Box, Polygon, RopeJoint } = planck;
  const GRAV = -22;
  const P = {
    reachMax: 2.55, reachMin: 0.45, pivotY: 0.32,           // metres, pivot = the kid's shoulders above the pot centre
    k: 2200, c: 85, fMax: 800,                              // spring that drags the mallet head to the aim point
    turnK: 260, turnC: 18,                                   // keeps the mallet aligned with the arm
  };
  function create() {
    const world = World({ gravity: Vec2(0, GRAV) });
    // the pot: a flat-bottomed tub (polygon) – heavy, grippy, never bouncy
    const pot = world.createBody({ type: 'dynamic', position: Vec2(0, 1), angularDamping: 3.2, linearDamping: 0.05, bullet: true });
    pot.createFixture(Polygon([Vec2(-0.5, -0.42), Vec2(0.5, -0.42), Vec2(0.6, 0.0), Vec2(0.62, 0.36), Vec2(-0.62, 0.36), Vec2(-0.6, 0.0)]), { density: 9, friction: 1.0, restitution: 0, userData: 'pot' });
    // the mallet head: a wooden block (wide, so its ends can hook on edges)
    const head = world.createBody({ type: 'dynamic', position: Vec2(1.4, 1.3), angularDamping: 4, bullet: true });
    head.createFixture(Box(0.26, 0.12), { density: 22, friction: 0.95, restitution: 0, userData: 'head' });
    world.createJoint(RopeJoint({ maxLength: P.reachMax + 0.15, localAnchorA: Vec2(0, P.pivotY), localAnchorB: Vec2(0, 0) }, pot, head));
    const S = { world, pot, head, aim: Vec2(1.4, 0.2), contactHead: 0, lastImpact: 0, impacts: [] };
    world.on('post-solve', (contact, imp) => {
      const a = contact.getFixtureA().getUserData(), b = contact.getFixtureB().getUserData();
      const n = imp.normalImpulses[0] || 0; if (n > 1.5) S.impacts.push({ who: a === 'head' || b === 'head' ? 'head' : a === 'pot' || b === 'pot' ? 'pot' : 'x', n, mat: (a === 'head' || a === 'pot') ? b : a });
    });
    // aim = offset from the pivot in world metres; clamp to the arm's reach
    S.setAim = (dx, dy) => { let L = Math.hypot(dx, dy); if (L < 1e-6) { dx = P.reachMin; dy = 0; L = P.reachMin } const c = Math.min(P.reachMax, Math.max(P.reachMin, L)) / L; S.aim = Vec2(dx * c, dy * c); };
    S.pivot = () => pot.getWorldPoint(Vec2(0, P.pivotY));
    S.step = (dt) => {
      const pv = S.pivot(), h = head.getPosition(), target = Vec2(pv.x + S.aim.x, pv.y + S.aim.y);
      const vh = head.getLinearVelocity(), vp = pot.getLinearVelocity();
      let fx = P.k * (target.x - h.x) - P.c * (vh.x - vp.x), fy = P.k * (target.y - h.y) - P.c * (vh.y - vp.y);
      const f = Math.hypot(fx, fy); if (f > P.fMax) { fx *= P.fMax / f; fy *= P.fMax / f; }
      const mh = head.getMass();
      // the kid holds the mallet's weight: lift the head, press the pot by the same amount
      head.applyForceToCenter(Vec2(fx, fy - mh * GRAV), true);
      pot.applyForce(Vec2(-fx, -fy + mh * GRAV), pv, true);
      // keep the mallet head perpendicular to the arm (like a real mallet)
      const want = Math.atan2(h.y - pv.y, h.x - pv.x) + Math.PI / 2;
      let da = want - head.getAngle(); da = Math.atan2(Math.sin(da), Math.cos(da));
      const tq = P.turnK * da - P.turnC * (head.getAngularVelocity() - pot.getAngularVelocity());
      head.applyTorque(tq, true); pot.applyTorque(-tq * 0.3, true);
      world.step(dt, 10, 4);
    };
    S.place = (x, y) => { pot.setPosition(Vec2(x, y)); pot.setAngle(0); pot.setLinearVelocity(Vec2(0, 0)); pot.setAngularVelocity(0); head.setPosition(Vec2(x + 1.2, y + 0.5)); head.setLinearVelocity(Vec2(0, 0)); head.setAngularVelocity(0); S.aim = Vec2(1.2, 0.2); };
    // static world pieces
    S.addBox = (cx, cy, hw, hh, ang = 0, opt = {}) => { const b = world.createBody({ position: Vec2(cx, cy), angle: ang }); b.createFixture(Box(hw, hh), { friction: opt.friction ?? 0.9, restitution: 0, userData: opt.mat || 'wood' }); return b; };
    S.addPoly = (pts, opt = {}) => { const b = world.createBody(); b.createFixture(Polygon(pts.map(p => Vec2(p[0], p[1]))), { friction: opt.friction ?? 0.9, restitution: 0, userData: opt.mat || 'wood' }); return b; };
    S.addCircle = (cx, cy, r, opt = {}) => { const b = world.createBody({ position: Vec2(cx, cy) }); b.createFixture(Circle(r), { friction: opt.friction ?? 0.9, restitution: 0, userData: opt.mat || 'wood' }); return b; };
    S.addChain = (pts, opt = {}) => { const b = world.createBody(); b.createFixture(planck.Chain(pts.map(p => Vec2(p[0], p[1]))), { friction: opt.friction ?? 0.9, restitution: 0, userData: opt.mat || 'ground' }); return b; };
    return S;
  }
  return { create, P, GRAV };
});
