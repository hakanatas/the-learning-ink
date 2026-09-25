/* The loss landscape: a side-view ink terrain where HEIGHT = ERROR.
   Nokta's path downhill is computed with real gradient descent on this
   profile: u_{k+1} = u_k − η · h'(u_k). η is large enough to overshoot the
   narrow valley once; then it is reduced (learning-rate decay) and settles. */
(function (LI) {
  'use strict';
  const { rand, noise } = LI.rng;
  const { clamp, lerp } = LI.E;
  const Ink = LI.Ink;
  const g = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));
  const MIN_U = 480;

  const h = (u) => 75 + 0.00036 * (u - MIN_U) ** 2 - 70 * g(u, MIN_U, 120);
  const dh = (u) => (h(u + 0.5) - h(u - 0.5));
  // background ridges (depth layers) — decoration, not used for descent
  const hb1 = (u) => 470 + 90 * Math.sin(u / 260 + 1.2) + 35 * Math.sin(u / 97 + 3);
  const hb2 = (u) => 610 + 80 * Math.sin(u / 330 + 4.1) + 30 * Math.sin(u / 140);

  function frame(env) { return env.V ? { sx: 0.46, sy: 1.15, base: 520 } : { sx: 0.86, sy: 1, base: 410 }; }
  function toWorld(u, env, fn = h) { const f = frame(env); return [u * f.sx, f.base - fn(u) * f.sy]; }
  function slopeAngle(u, env) { const f = frame(env); return Math.atan2(-dh(u) * f.sy, f.sx); }

  let STEPS = null;
  function steps() {
    if (STEPS) return STEPS;
    let u = -560, eta = 260; const xs = [u];
    for (let k = 0; k < 13; k++) {
      const nu = u - eta * dh(u);
      if ((u - MIN_U) * (nu - MIN_U) < 0) eta *= 0.4; // overshoot → decay the learning rate
      u = nu; xs.push(u);
    }
    return (STEPS = xs);
  }

  function profilePts(env, fn = h, u0 = -1150, u1 = 1150, n = 90) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n); pts.push(toWorld(u, env, fn)); }
    return pts;
  }

  /** draw the landscape. o.p (draw-on 0..1), o.alpha */
  function draw(ctx, env, o = {}) {
    const a = o.alpha ?? 1, p = o.p ?? 1;
    if (a <= 0.01) return;
    // far ridges
    Ink.path(ctx, profilePts(env, hb2), { w: 2.2, alpha: 0.28 * a, p, seed: 3, taper: [0.05, 0.05], dry: 0.4 });
    Ink.path(ctx, profilePts(env, hb1), { w: 3, alpha: 0.42 * a, p, seed: 4, taper: [0.05, 0.05], dry: 0.5 });
    // soft wash under the main terrain
    const main = profilePts(env);
    ctx.save();
    ctx.beginPath(); main.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    const D = frame(env).base + (o.depth ?? 900);
    ctx.lineTo(main[main.length - 1][0], D); ctx.lineTo(main[0][0], D); ctx.closePath();
    const f = frame(env);
    const gr = ctx.createLinearGradient(0, f.base - 450, 0, f.base + 200);
    gr.addColorStop(0, `rgba(${LI.INK_RGB},${0.1 * a * p})`); gr.addColorStop(1, `rgba(${LI.INK_RGB},${0.03 * a * p})`);
    ctx.fillStyle = `rgba(${LI.PAPER_RGB},${a * p})`; ctx.fill(); // near terrain hides the far ridges
    ctx.fillStyle = gr; ctx.fill();
    ctx.restore();
    Ink.path(ctx, main, { w: 5.5, alpha: a, p, seed: 5, taper: [0.03, 0.03], dry: 0.7, bleed: 0.5 });
    // hatching along the slopes (steeper = denser shading)
    for (let i = 0; i < 70; i++) {
      const u = -1100 + i * 32 + rand('hu', i) * 12;
      if ((u + 1150) / 2300 > p) continue;
      const s = Math.abs(dh(u));
      if (s < 0.08) continue;
      const [x, y] = toWorld(u, env);
      const L = 14 + 30 * clamp(s);
      Ink.line(ctx, [x, y + 10], [x - L * 0.5, y + 10 + L], { w: 1.5, alpha: a * 0.45 * clamp(s * 1.5), seed: i });
    }
  }

  LI.Land = { h, dh, toWorld, slopeAngle, steps, profilePts, draw, frame, hb1, hb2, MIN_U };
})(window.LI = window.LI || {});
