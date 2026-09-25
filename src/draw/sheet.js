/* Paper sheets carrying procedural sketches + hand-drawn label glyphs. */
(function (LI) {
  'use strict';
  const { rand, srand } = LI.rng;
  const { clamp, lerp } = LI.E;
  const Ink = LI.Ink;

  const Glyph = {
    /** bird "m" or fish "><>" label symbol */
    draw(ctx, kind, x, y, size, o = {}) {
      const strokes = LI.Sketch.GLYPH[kind];
      const k = size / 2, a = o.alpha ?? 1, seed = o.seed ?? 1;
      strokes.forEach((st, n) => {
        const pts = st.map(([u, v]) => [x + u * k, y + v * k]);
        Ink.path(ctx, pts, { w: size * 0.1 * (o.weight ?? 1), alpha: a, seed: seed + n, taper: [0.15, 0.4], p: o.p ?? 1, wob: 0.3 });
      });
      if (o.circle) Ink.ring(ctx, x, y, size * 0.72, { w: size * 0.05, seed: seed + 9, alpha: a * 0.8, gap: 0.12, p: o.p ?? 1 });
    },
  };

  const STYLE = {
    brush: { w: 1, bleed: 0.4 },
    fine: { w: 0.5, bleed: 0 },
    bold: { w: 1.7, bleed: 0.8 },
    scribble: { w: 0.55, bleed: 0, twice: true },
    dry: { w: 1.25, bleed: 0.2, dry: 1 },
  };

  /** draw a sketch (unit space) centred at x,y with half-size k. o.p = draw-on progress */
  function sketch(ctx, sk, x, y, k, o = {}) {
    const st = STYLE[o.style || sk.style] || STYLE.brush;
    const a = o.alpha ?? 1, p = o.p ?? 1, n = sk.strokes.length;
    const baseW = (o.w ?? 0.055) * k * st.w;
    sk.strokes.forEach((s, i) => {
      const pi = clamp(p * n - i);
      if (pi <= 0) return;
      const pts = s.map(([u, v]) => [x + u * k, y + v * k]);
      Ink.path(ctx, pts, { w: baseW, alpha: a, seed: sk.seed * 13 + i, p: pi, bleed: st.bleed, dry: st.dry, taper: [0.1, 0.3], wob: 0.35 });
      if (st.twice) {
        const pts2 = pts.map(([u, v], j) => [u + srand(sk.seed, i, j, 'sx') * k * 0.025 + k * 0.012, v + srand(sk.seed, i, j, 'sy') * k * 0.025]);
        Ink.path(ctx, pts2, { w: baseW * 0.9, alpha: a * 0.8, seed: sk.seed * 17 + i, p: pi, taper: [0.2, 0.2] });
      }
    });
  }

  /**
   * A sheet of paper.
   * s = { sk, label }   o = { x, y, w, h, rot, flat, alpha, p (sketch progress), labelP, seed, shadow }
   */
  function draw(ctx, s, o) {
    const w = o.w ?? 220, h = o.h ?? w * 1.25, a = o.alpha ?? 1, seed = o.seed ?? 1;
    if (a <= 0.01) return;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot || 0);
    const flat = o.flat || 0;
    if (flat) ctx.transform(1, 0, -0.35 * flat, 1 - 0.6 * flat, 0, 0);
    // shadow
    if (o.shadow !== 0) {
      const sh = o.shadow ?? 1;
      ctx.fillStyle = `rgba(${LI.INK_RGB},${0.1 * a * sh})`;
      ctx.beginPath(); ctx.rect(-w / 2 + 6, -h / 2 + 9, w, h); ctx.fill();
    }
    // paper with slightly uneven corners
    const c = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y], i) => [x + srand(seed, i, 'x') * w * 0.015, y + srand(seed, i, 'y') * h * 0.015]);
    ctx.fillStyle = `rgba(250,246,237,${a})`;
    ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    const edge = c.concat([c[0]]);
    for (let i = 0; i < 4; i++) Ink.line(ctx, edge[i], edge[i + 1], { w: Math.max(1, w * 0.008), alpha: a * 0.75, seed: seed + i, taper: [0.1, 0.1], bow: 0.01 });
    // sketch
    if (s.sk) sketch(ctx, s.sk, 0, -h * 0.06, w * 0.38, { alpha: a, p: o.p ?? 1 });
    if (o.abstract) sketch(ctx, o.abstract, 0, -h * 0.06, w * 0.38, { alpha: a });
    // label glyph (bottom-right corner)
    if (s.label && (o.labelP ?? 1) > 0) Glyph.draw(ctx, s.label, w * 0.3, h * 0.36, w * 0.13, { alpha: a, seed: seed + 40, circle: true, p: o.labelP ?? 1 });
    ctx.restore();
  }

  LI.Glyph = Glyph;
  LI.Sheet = { draw, sketch };
})(window.LI = window.LI || {});
