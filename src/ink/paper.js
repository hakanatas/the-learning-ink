/* Warm off-white paper with seeded grain, fibres and faint stains.
   Built once per format into offscreen canvases (a pure function of the
   seed), then composited every frame. */
(function (LI) {
  'use strict';
  const { rand, gen } = LI.rng;
  const cache = {};

  function mk(W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }

  function build(W, H) {
    const base = mk(W, H), b = base.getContext('2d');
    // warm base with soft uneven tone
    const g = b.createRadialGradient(W * 0.48, H * 0.44, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, '#F5EFE3');
    g.addColorStop(0.6, '#F0E8D9');
    g.addColorStop(1, '#E4D8C2');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    const R = gen('paper' + W + 'x' + H);
    // faint tea stains / tonal clouds
    for (let i = 0; i < 14; i++) {
      const x = R() * W, y = R() * H, r = 120 + R() * 380;
      const sg = b.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.018 + R() * 0.03;
      sg.addColorStop(0, `rgba(160,130,90,${a})`); sg.addColorStop(1, 'rgba(160,130,90,0)');
      b.fillStyle = sg; b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // paper fibres
    b.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = R() * W, y = R() * H, L = 6 + R() * 28, a = R() * Math.PI * 2, bend = (R() - 0.5) * 10;
      b.strokeStyle = R() < 0.5 ? `rgba(120,100,70,${0.05 + R() * 0.06})` : `rgba(255,252,245,${0.25 + R() * 0.3})`;
      b.lineWidth = 0.5 + R() * 0.9;
      b.beginPath(); b.moveTo(x, y);
      b.quadraticCurveTo(x + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * L * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * L, y + Math.sin(a) * L);
      b.stroke();
    }
    // grain overlay (multiplied above the ink)
    const grain = mk(W, H), gc = grain.getContext('2d');
    const id = gc.createImageData(W, H), d = id.data;
    let s = 1234567;
    for (let i = 0; i < d.length; i += 4) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      const n = (s >>> 16) & 255;
      const v = 255 - (n > 200 ? (n - 200) * 0.9 : 0) - (n & 15) * 0.9;
      d[i] = v; d[i + 1] = v - 2; d[i + 2] = v - 6; d[i + 3] = 255;
    }
    gc.putImageData(id, 0, 0);
    // vignette
    const vig = mk(W, H), vc = vig.getContext('2d');
    const vg = vc.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(90,70,40,0)'); vg.addColorStop(1, 'rgba(90,70,40,0.16)');
    vc.fillStyle = vg; vc.fillRect(0, 0, W, H);
    return { base, grain, vig };
  }

  LI.Paper = {
    get(env) { const k = env.W + 'x' + env.H; return cache[k] || (cache[k] = build(env.W, env.H)); },
    draw(ctx, env) { ctx.drawImage(this.get(env).base, 0, 0); },
    overlay(ctx, env) {
      const p = this.get(env);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(p.grain, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(p.vig, 0, 0);
    },
  };
})(window.LI = window.LI || {});
