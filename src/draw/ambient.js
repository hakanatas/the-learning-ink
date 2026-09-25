/* Atmosphere & transitions: drifting ink motes (parallax layers), ground
   strokes, and ink-iris wipes. */
(function (LI) {
  'use strict';
  const { rand, noise } = LI.rng;
  const { clamp } = LI.E;
  const Ink = LI.Ink;

  /** drifting ink motes on a parallax layer */
  function specks(ctx, env, cam, t, o = {}) {
    const depth = o.depth ?? 0.45, n = o.n ?? 26, a = o.alpha ?? 0.35, seed = o.seed ?? 1;
    LI.Camera.apply(ctx, env, cam, depth);
    const W = env.W * 1.4, H = env.H * 1.4;
    for (let i = 0; i < n; i++) {
      const x = (rand(seed, i, 'x') - 0.5) * W + noise(t * 0.08 + i, seed + i) * 60 + cam.x * depth * 0;
      const y = (rand(seed, i, 'y') - 0.5) * H + noise(t * 0.06 + i * 3, seed + 7) * 50 - t * 4 * rand(seed, i, 'v');
      const r = 1 + rand(seed, i, 'r') * 3.2;
      const k = rand(seed, i, 'k');
      if (k < 0.7) Ink.dot(ctx, x, y, r, { alpha: a * (0.4 + k), seed: i, bleed: 0.8 });
      else { const ang = noise(t * 0.1, i) * 2; Ink.line(ctx, [x, y], [x + Math.cos(ang) * r * 6, y + Math.sin(ang) * r * 6], { w: r * 0.6, alpha: a * 0.6, seed: i }); }
    }
  }

  /** long faint ground stroke, drawn outward from the centre with p */
  function ground(ctx, x0, x1, y, o = {}) {
    const p = o.p ?? 1, seed = o.seed ?? 3, a = o.alpha ?? 0.4;
    const mid = (x0 + x1) / 2;
    const L = [], R = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      L.push([mid - (mid - x0) * f, y + noise(f * 4, seed) * 3]);
      R.push([mid + (x1 - mid) * f, y + noise(f * 4 + 9, seed) * 3]);
    }
    Ink.path(ctx, L, { w: o.w ?? 3, p, alpha: a, seed, taper: [0.02, 0.9], dry: 0.6 });
    Ink.path(ctx, R, { w: o.w ?? 3, p, alpha: a, seed: seed + 1, taper: [0.02, 0.9], dry: 0.6 });
  }

  /** screen-space ink iris: p=0 open paper, p=1 fully inked. (cx,cy) screen centre */
  function iris(ctx, env, p, o = {}) {
    if (p <= 0) return;
    const cx = o.cx ?? env.W / 2, cy = o.cy ?? env.H / 2, seed = o.seed ?? 5;
    const maxR = Math.hypot(env.W, env.H) * 0.62;
    const r = (1 - clamp(p)) * maxR;
    LI.Camera.screen(ctx);
    ctx.fillStyle = LI.INK;
    ctx.beginPath();
    ctx.rect(-10, -10, env.W + 20, env.H + 20);
    if (r > 1) {
      const n = 48;
      for (let i = n; i >= 0; i--) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (1 + 0.06 * noise(i * 0.6, seed) + 0.03 * noise(i * 2.3 + (o.t || 0) * 2, seed + 1));
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i === n ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
    // soft bleeding rim
    if (r > 1) {
      const g = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.02);
      g.addColorStop(0, `rgba(${LI.INK_RGB},0)`); g.addColorStop(1, `rgba(${LI.INK_RGB},0.35)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** paper flash-wipe (ink receding): fill paper outside a growing blot */
  function paperCover(ctx, env, a) {
    if (a <= 0) return;
    LI.Camera.screen(ctx);
    ctx.fillStyle = `rgba(${LI.PAPER_RGB},${clamp(a)})`;
    ctx.fillRect(0, 0, env.W, env.H);
  }

  LI.Ambient = { specks, ground, iris, paperCover };
})(window.LI = window.LI || {});
