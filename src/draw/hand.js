/* The human hand: a large, gentle, loosely-inked silhouette.
   Local frame: fingers point toward +y, forearm extends toward −y.
   Origin (0,0) = pinch point between thumb and index finger. */
(function (LI) {
  'use strict';
  const { clamp, lerp, smoothPath } = LI.E;
  const { noise } = LI.rng;
  const Ink = LI.Ink;

  function capsule(pts, w) {
    const P = smoothPath(pts, 5);
    const L = Ink.offset(P, w / 2), R = Ink.offset(P, -w / 2).reverse();
    const end = P[P.length - 1], prev = P[P.length - 2];
    const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const cap = [];
    for (let k = 1; k < 7; k++) { const a = ang + Math.PI / 2 - (k / 7) * Math.PI; cap.push([end[0] + Math.cos(a) * w / 2, end[1] + Math.sin(a) * w / 2]); }
    return L.concat(cap, R);
  }

  /**
   * o = { x, y, rot, s, pinch (0 open..1 pinched), alpha, spread, t, curl, point (0..1 index extended) }
   */
  function draw(ctx, o, t) {
    const s = (o.s ?? 1) * 100, pin = o.pinch ?? 1, a = o.alpha ?? 1, curl = o.curl ?? 0.2, pt = o.point ?? 0;
    if (a <= 0.01) return;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.rot ?? 0); ctx.scale(s, s);
    const br = noise(t * 0.6, 55) * 0.03; // breathing
    const lw = 1 / s;
    const fillShape = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = `rgba(${LI.PAPER_RGB},${0.93 * a})`; ctx.fill(); ctx.fillStyle = `rgba(${LI.INK_RGB},${0.1 * a})`; ctx.fill(); };
    const outline = (pts, seed, w = 4.2) => Ink.path(ctx, pts.concat([pts[0]]), { w: w * lw, alpha: a, seed, taper: [0.08, 0.2], wob: 0.4, dry: 0.5, minW: 0.3 });

    // forearm
    const arm = [[-0.62, -1.7], [-0.72, -3.4], [-0.8, -6], [0.95, -6], [0.85, -3.4], [0.7, -1.7]];
    fillShape(arm);
    Ink.path(ctx, smoothPath([[-0.62, -1.7], [-0.72, -3.4], [-0.8, -6]], 4), { w: 4.5 * lw, alpha: a, seed: 3, taper: [0.05, 0.02], dry: 0.6 });
    Ink.path(ctx, smoothPath([[0.7, -1.7], [0.85, -3.4], [0.95, -6]], 4), { w: 4.5 * lw, alpha: a, seed: 4, taper: [0.05, 0.02], dry: 0.6 });

    // fingers (back to front): pinky, ring, middle
    const fingers = [
      { base: [0.62, -1.02], mid: [0.8, -0.62 + br], tip: [0.78 - curl * 0.2, -0.28 + curl * 0.05], w: 0.22 },
      { base: [0.38, -0.92], mid: [0.56, -0.4 + br], tip: [0.5 - curl * 0.25, 0.04 + curl * 0.05], w: 0.25 },
      { base: [0.1, -0.88], mid: [0.28, -0.3 + br], tip: [0.24 - curl * 0.3, 0.18 + curl * 0.02], w: 0.27 },
    ];
    // palm
    const palm = [[-0.62, -1.75], [0.7, -1.75], [0.78, -1.2], [0.62, -0.85], [-0.28, -0.72], [-0.7, -1.05]];
    fillShape(palm);
    fingers.forEach((f, k) => { const c = capsule([f.base, f.mid, f.tip], f.w); fillShape(c); outline(c, 10 + k, 3.4); });
    fillShape(palm);
    Ink.path(ctx, smoothPath([[0.72, -1.75], [0.8, -1.2], [0.64, -0.9]], 4), { w: 3.8 * lw, alpha: a, seed: 21, dry: 0.5 });
    // index finger (pinching or pointing)
    const iTip = [lerp(lerp(0.05, 0, pin), 0.02, pt), lerp(lerp(0.12, 0, pin), 0.5, pt)];
    const idx = capsule([[-0.25, -0.86], [lerp(-0.14, -0.1, pt), lerp(-0.38, -0.2, pt)], iTip], 0.26);
    fillShape(idx); outline(idx, 30, 3.6);
    // thumb
    const tTip = [lerp(-0.55, -0.06, pin), lerp(-0.12, 0.03, pin)];
    const th = capsule([[-0.62, -1.3], [-0.72, -0.72], [lerp(-0.62, -0.4, pin), lerp(-0.35, -0.2, pin)], tTip], 0.3);
    fillShape(th); outline(th, 40, 3.8);
    // knuckle marks & a few palm lines (gesture)
    [[0.2, -1.05], [0.46, -1.1], [-0.08, -1.0]].forEach((p, k) => Ink.line(ctx, p, [p[0] + 0.1, p[1] + 0.02], { w: 2 * lw, alpha: a * 0.6, seed: 50 + k }));
    Ink.path(ctx, smoothPath([[-0.45, -1.5], [-0.1, -1.35], [0.3, -1.45]], 4), { w: 1.8 * lw, alpha: a * 0.45, seed: 60 });
    ctx.restore();
  }
  LI.Hand = { draw };
})(window.LI = window.LI || {});
