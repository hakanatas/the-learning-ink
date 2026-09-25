/* Hand-lettered captions with ink-bleed in/out transitions.
   Text and timing live in /captions.js (editable). */
(function (LI) {
  'use strict';
  const { seg, clamp, outCubic } = LI.E;

  function active(t) { return (LI.CAPTIONS || []).filter((c) => t >= c.start && t <= c.end); }

  function draw(ctx, env, t) {
    const mode = env.captions;
    if (mode === 'off') return;
    for (const c of active(t)) {
      const pin = outCubic(seg(t, c.start, c.start + 0.7)), pout = seg(t, c.end - 0.6, c.end);
      const vis = pin * (1 - pout);
      if (vis <= 0.001) continue;
      const lines = mode === 'tr' ? [[c.tr, 1]] : mode === 'en' ? [[c.en, 1]] : [[c.tr, 1], [c.en, 0.62]];
      const base = env.V ? 76 : 62;
      let y = env.V ? env.H - 200 : env.H - 108;
      if (lines.length === 1) y += base * 0.3;
      const cx = env.W / 2;
      ctx.save();
      // soft paper halo keeps captions legible over busy ink
      const hy = y + (lines.length - 1) * base * 0.45 - base * 0.3;
      const halo = ctx.createRadialGradient(cx, hy, 10, cx, hy, base * 4.2);
      halo.addColorStop(0, `rgba(${LI.PAPER_RGB},${0.8 * vis})`); halo.addColorStop(0.55, `rgba(${LI.PAPER_RGB},${0.55 * vis})`); halo.addColorStop(1, `rgba(${LI.PAPER_RGB},0)`);
      ctx.save(); ctx.translate(cx, hy); ctx.scale(1, 0.32); ctx.translate(-cx, -hy);
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, hy, base * 4.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      let maxW = 0;
      lines.forEach(([txt, k], n) => {
        const size = Math.round(base * k);
        ctx.font = `${size}px "LI Brush", "Comic Sans MS", cursive`;
        const yy = y + n * base * 0.95;
        const bleed = (1 - vis) * 14 + 0.001;
        // bleeding halo
        ctx.filter = `blur(${(2.5 + bleed).toFixed(2)}px)`;
        ctx.fillStyle = `rgba(${LI.INK_RGB},${0.22 * vis})`;
        ctx.fillText(txt, cx, yy);
        // ink body (sharpens as it arrives, smears as it leaves)
        ctx.filter = `blur(${(bleed * 0.5).toFixed(2)}px)`;
        ctx.fillStyle = `rgba(${LI.INK_RGB},${(n ? 0.78 : 0.95) * vis})`;
        ctx.fillText(txt, cx + pout * 10, yy);
        ctx.filter = 'none';
        maxW = Math.max(maxW, ctx.measureText(txt).width);
      });
      // brush swash under the words
      const uy = y + (lines.length - 1) * base * 0.95 + base * 0.28;
      const w = Math.min(maxW * 0.9, env.W * 0.8);
      LI.Ink.path(ctx, LI.E.quadPts([cx - w / 2, uy + 4], [cx, uy - 8], [cx + w / 2, uy + 2], 16), { w: 5, p: pin, from: pout, alpha: 0.75, seed: c.start, taper: [0.1, 0.6], dry: 0.8 });
      ctx.restore();
    }
  }
  LI.Captions = { draw, active };
})(window.LI = window.LI || {});
