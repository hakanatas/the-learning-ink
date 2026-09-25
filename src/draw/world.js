/* Shared world state used across scenes: the data sheets, the ground,
   answer tokens, and the layout for horizontal / vertical framing. */
(function (LI) {
  'use strict';
  const { rand } = LI.rng;
  const { seg, lerp, smooth, clamp, outCubic } = LI.E;
  const Ink = LI.Ink;

  const World = {
    GY: (env) => (env.V ? 240 : 170),
    /** positions that differ between 16:9 and 9:16 */
    L(env) {
      return env.V
        ? { nokta: -150, sheet: [250, -390], sheetW: 330, tokBird: [-300, 390], tokFish: [150, 390], handIn: [900, -1400] }
        : { nokta: -40, sheet: [400, -60], sheetW: 330, tokBird: [-330, 262], tokFish: [150, 262], handIn: [1400, -900] };
    },
    sheets: null,
    prepare() {
      if (World.sheets) return;
      const m = LI.Net.model();
      const pick = [];
      const want = ['perched', 'classic', 'flying', 'long', 'gull', 'round', 'perched', 'classic', 'flying', 'round', 'gull', 'long'];
      const used = new Set();
      for (const v of want) {
        const d = m.data.find((d, i) => !used.has(i) && d.sk.variant === v && (used.add(i) || true));
        if (d) pick.push(d);
      }
      World.sheets = pick.map((d, i) => {
        const side = i % 2 ? 1 : -1;
        const back = i % 3 !== 2;
        // scattered landing spots (horizontal / vertical), avoiding the centre stage
        const hx = side * (560 + rand('lx', i) * 330) * (back ? 1 : 0.85), hy = back ? 40 + rand('ly', i) * 70 : 300 + rand('ly', i) * 90;
        const vx = side * (240 + rand('vx', i) * 250), vy = back ? -640 + rand('vy', i) * 180 + (i % 4) * 60 : 560 + rand('vy', i) * 200;
        // tidy groups after generalization (birds left, fish right)
        const kindIdx = pick.slice(0, i).filter((q) => q.y === d.y).length;
        const gx = (d.y === 0 ? -1 : 1) * (560 + (kindIdx % 3) * 130), gy = 30 + Math.floor(kindIdx / 3) * 120 + (kindIdx % 3) * 10;
        const gvx = (d.y === 0 ? -1 : 1) * (190 + (kindIdx % 3) * 115), gvy = -700 + Math.floor(kindIdx / 3) * 130;
        return {
          sk: d.sk, label: d.y === 0 ? 'bird' : 'fish', x: d.x, y: d.y, i,
          land: { h: [hx, hy], v: [vx, vy], rot: (rand('lr', i) - 0.5) * 0.9 },
          group: { h: [gx, gy], v: [gvx, gvy], rot: (rand('gr', i) - 0.5) * 0.12 },
          fall: { t0: 8.2 + i * 0.28 + rand('ft', i) * 0.3, dur: 2.1 + rand('fd', i) * 0.8, x0: (rand('fx', i) - 0.5) * 1400, sway: 80 + rand('fs', i) * 120, ph: rand('fp', i) * 6 },
        };
      });
    },
    /** where a data sheet is at time t (falls like a leaf, then lies on the floor) */
    sheetPose(s, t, env) {
      const f = s.fall, land = env.V ? s.land.v : s.land.h;
      const p = clamp((t - f.t0) / f.dur);
      if (t < f.t0) return null;
      const x0 = env.V ? f.x0 * 0.5 : f.x0;
      const y = lerp(env.V ? -1100 : -700, land[1], Math.pow(p, 1.25));
      const x = lerp(x0, land[0], smooth(p)) + Math.sin(p * Math.PI * 3 + f.ph) * f.sway * (1 - p);
      const rot = s.land.rot + Math.sin(p * Math.PI * 4 + f.ph) * 0.7 * (1 - p);
      const flat = smooth(seg(p, 0.55, 1));
      return { x, y, rot, flat, w: 150, alpha: 1 };
    },
    /** answer token on the ground: an ink ring with a glyph */
    token(ctx, kind, x, y, o = {}) {
      const a = o.alpha ?? 1, p = o.p ?? 1, r = o.r ?? 58;
      if (a <= 0.01 || p <= 0) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62);
      if (o.fill) { ctx.fillStyle = `rgba(${LI.INK_RGB},${0.12 * o.fill * a})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
      Ink.ring(ctx, 0, 0, r, { w: 4, seed: kind === 'bird' ? 3 : 4, alpha: a, p, gap: 0.08, dry: 0.5 });
      ctx.restore();
      LI.Glyph.draw(ctx, kind, x, y - 2, r * 0.9, { alpha: a, seed: kind === 'bird' ? 31 : 41, p: clamp(p * 1.5 - 0.5), weight: 1.2 });
    },
    /** a floor sheet (for scenes 2, 6, 7) */
    drawSheet(ctx, s, pose, extra = {}) {
      LI.Sheet.draw(ctx, { sk: s.sk, label: s.label }, Object.assign({ seed: 300 + s.i }, pose, extra));
    },
  };
  LI.World = World;
})(window.LI = window.LI || {});
