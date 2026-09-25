/* SCENE 3 — INSIDE THE MIND (20–36 s)
   Dive through the eye into the tangle, which unfolds into layers.
   Close-up of ONE neuron: weighted signals pool as ink; past the threshold
   line it fires. Then a full forward pass of the first bird → wrong answer. */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, spring, outBack, outCubic, inCubic, inOut, hump, smooth } = LI.E;
  const { noise, rand, srand } = LI.rng;
  const Ink = LI.Ink;
  const FOCUS = { l: 1, i: 3 };

  const netOpts = (env, extra) => Object.assign({ cx: 0, cy: 0, scale: 1, V: env.V, q: 0, labels: true }, extra);

  function camera(t, env) {
    const V = env.V;
    const full = V ? { x: 0, y: 20, zoom: 0.98 } : { x: -70, y: 0, zoom: 0.98 };
    const n = LI.NetDraw.nodeWorld(netOpts(env), FOCUS.l, FOCUS.i);
    const close = V ? { x: n[0] - 10, y: n[1], zoom: 1.08 } : { x: n[0] - 20, y: n[1], zoom: 2.1 };
    const cam = LI.Camera.track([
      [20.0, { x: 0, y: 0, zoom: 3.4, rot: 0.3 }],
      [22.2, { x: 0, y: 0, zoom: 1.12, rot: 0.06 }, outCubic],
      [24.3, full, inOut],
      [25.1, close, inOut],
      [30.5, Object.assign({}, close, { zoom: close.zoom * 1.05 })],
      [31.5, full, inOut],
      [36, Object.assign({}, full, { zoom: full.zoom * 1.03 })],
    ], t);
    return LI.Camera.breathe(cam, t, 0.6);
  }

  // ── the illustrative single-neuron close-up ─────────────────────────
  const IN = [
    { from: [-430, -190], w: 17, gain: 0.46, kind: 'pos' },   // strong positive weight
    { from: [-460, 10], w: 2.2, gain: 0.1, kind: 'weak' },     // weak weight (thin, broken)
    { from: [-430, 200], w: 10, gain: -0.3, kind: 'neg' },     // negative weight (hollow)
  ];
  // pulses: [input index, departure time]
  const PULSES = [[0, 25.35], [1, 25.8], [0, 28.7], [2, 29.05]];
  const TRAVEL = 0.9, THRESH = 0.5;

  function level(t) {
    let lv = 0;
    // round 1: fills, crosses threshold, fires, drains
    for (const [k, t0] of PULSES) {
      const arr = t0 + TRAVEL;
      if (t >= arr) lv += IN[k].gain * outCubic(seg(t, arr, arr + 0.35));
      if (k === 1 && t0 < 27 && t > 26.9) lv = lv; // (kept for clarity)
    }
    // drain after firing (round 1) and after round 2 fizzles
    if (t > 27.0) lv -= (0.56) * outCubic(seg(t, 27.05, 27.8));
    if (t > 30.2) lv -= Math.max(0, 0.16) * outCubic(seg(t, 30.2, 30.8));
    return clamp(lv, 0, 1);
  }

  function drawCloseup(ctx, t, env, a) {
    if (a <= 0.01) return;
    const N = LI.NetDraw.nodeWorld(netOpts(env), FOCUS.l, FOCUS.i);
    const R = 72;
    ctx.save(); ctx.translate(N[0], N[1]);
    // paper panel so the diagram reads clearly over the network
    const g = ctx.createRadialGradient(-120, 0, 60, -120, 0, 620);
    g.addColorStop(0, `rgba(${LI.PAPER_RGB},${0.97 * a})`); g.addColorStop(0.75, `rgba(${LI.PAPER_RGB},${0.9 * a})`); g.addColorStop(1, `rgba(${LI.PAPER_RGB},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-120, 0, 620, 0, Math.PI * 2); ctx.fill();

    const linePts = IN.map((inp, k) => LI.Ink.linePts(inp.from, [-R * 0.95, inp.from[1] * 0.18], 200 + k, 0.12, 16));
    // incoming weights (same encoding as the network)
    IN.forEach((inp, k) => {
      const P = linePts[k];
      if (inp.kind === 'weak') Ink.dashes(P, 0.08, 0.06, 7).forEach((d) => d.length > 1 && Ink.path(ctx, d, { w: inp.w, alpha: a * 0.8, seed: k }));
      else if (inp.kind === 'neg') Ink.hollow(ctx, P, { w: inp.w + 4, lw: 2.2, alpha: a, seed: 30 + k });
      else Ink.path(ctx, P, { w: inp.w, alpha: a, seed: 20 + k, taper: [0.1, 0.05], bleed: 0.6, dry: 0.3 });
      // the source dot (a neuron from the previous layer)
      Ink.dot(ctx, inp.from[0], inp.from[1], 13, { alpha: a, seed: 40 + k });
    });
    // outgoing line
    const outP = LI.Ink.linePts([R * 0.95, 0], [470, -30], 300, 0.08, 14);
    Ink.path(ctx, outP, { w: 9, alpha: a, seed: 50, taper: [0.05, 0.3] });

    // pulses travelling in: same size at the source, scaled by the weight on arrival
    for (const [k, t0] of PULSES) {
      const f = seg(t, t0, t0 + TRAVEL);
      if (f <= 0 || f >= 1) continue;
      const p = LI.E.along(linePts[k], inOut(f));
      const mult = IN[k].kind === 'pos' ? 1.75 : IN[k].kind === 'weak' ? 0.35 : 1.1;
      const r = 13 * lerp(1, mult, smooth(f));
      if (IN[k].kind === 'neg') Ink.ring(ctx, p[0], p[1], r, { w: 3.5, alpha: a, seed: k });
      else { Ink.dot(ctx, p[0], p[1], r, { alpha: a, seed: k + 3, bleed: 1 }); }
    }

    // the neuron: an ink cup that fills
    const lv = level(t);
    const fire = seg(t, 26.95, 27.05) * (1 - seg(t, 27.3, 27.9));
    const fizz = hump(t, 29.95, 30.5);
    const jig = noise(t * 30, 3) * 4 * fizz;
    ctx.save(); ctx.translate(jig, 0);
    ctx.fillStyle = `rgba(${LI.PAPER_RGB},${a})`; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, Math.PI * 2); ctx.clip();
    const surf = R - lv * 2 * R;
    ctx.fillStyle = `rgba(${LI.INK_RGB},${0.88 * a})`;
    ctx.beginPath(); ctx.moveTo(-R, R + 2);
    for (let i = 0; i <= 20; i++) { const x = -R + (2 * R * i) / 20; ctx.lineTo(x, surf + Math.sin(i * 0.9 + t * 6) * 3.5 * (0.3 + lv)); }
    ctx.lineTo(R, R + 2); ctx.closePath(); ctx.fill();
    ctx.restore();
    // threshold line
    const ty = R - THRESH * 2 * R;
    Ink.dashes([[-R - 26, ty], [R + 26, ty]], 0.09, 0.06, 4).forEach((d) => d.length > 1 && Ink.path(ctx, d, { w: 3, alpha: a * 0.9, seed: 9, color: lv > THRESH - 0.05 && t < 27.3 ? LI.PAPER_RGB : LI.INK_RGB }));
    Ink.path(ctx, [[-R - 26, ty], [-R - 46, ty]], { w: 3, alpha: a, seed: 10 });
    Ink.ring(ctx, 0, 0, R * (1 + 0.12 * fire), { w: 6 + 6 * fire, alpha: a, seed: 11, gap: 0.05, dry: 0.4 });
    ctx.restore();

    // FIRE: burst + the neuron's own pulse goes forward
    if (t > 26.95) {
      Ink.drops(ctx, R * 0.6, -R * 0.4, t - 26.95, { n: 8, seed: 21, ground: R * 3, scale: 0.6, alpha: a * (1 - seg(t, 27.6, 28.2)) });
      const f = seg(t, 27.0, 27.9);
      if (f > 0 && f < 1) { const p = LI.E.along(outP, inOut(f)); Ink.dot(ctx, p[0], p[1], 20, { alpha: a, seed: 60, bleed: 1 }); Ink.path(ctx, LI.Ink.cut(outP, Math.max(0, inOut(f) - 0.12), inOut(f)), { w: 22, alpha: a * 0.6, taper: [0.9, 0.1] }); }
    }
    ctx.restore();
  }

  // ── foreground strands rushing past during the dive (depth layer) ──
  function strands(ctx, env, cam, t) {
    const a = 1 - seg(t, 20.6, 21.7);
    if (a <= 0) return;
    LI.Camera.apply(ctx, env, cam, 1.9);
    for (let i = 0; i < 14; i++) {
      const cx = srand('sx', i) * 900, cy = srand('sy', i) * 600;
      const pts = [];
      for (let k = 0; k < 7; k++) pts.push([cx + srand('px', i, k) * 420, cy + srand('py', i, k) * 320]);
      Ink.path(ctx, LI.E.smoothPath(pts, 5), { w: 5 + rand('w', i) * 9, alpha: 0.55 * a, seed: i, taper: [0.2, 0.3], dry: 0.5 });
    }
  }

  function render(ctx, lt, env, t) {
    const cam = camera(t, env);
    // background depth: faint drifting ink
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.3, n: 40, depth: 0.35, seed: 31 });
    LI.Camera.apply(ctx, env, cam);

    const morph = inOut(seg(t, 21.6, 24.4));
    const m = LI.Net.model();
    const closeA = seg(t, 24.6, 25.2) * (1 - seg(t, 30.5, 31.2));
    // input: the first bird, dissolved into pixels
    const dissolve = seg(t, 32.2, 33.0);
    const fwd = t > 32.9 ? 3 * inOut(seg(t, 32.9, 35.3)) : -1;
    const alpha = 1 - 0.8 * closeA;
    LI.NetDraw.draw(ctx, netOpts(env, {
      morph, alpha, input: dissolve > 0 ? m.first.x.map((v) => v * dissolve) : null, fwd,
      labelAlpha: seg(t, 23.6, 24.4),
      pulseScale: 1.1,
    }), t);

    // the bird sheet flies in over the input grid, then dissolves into pixels
    if (t > 31.1 && dissolve < 1) {
      const S = LI.NetDraw.structured(env.V)[0];
      const gx = (S[0][0] + S[48][0]) / 2, gy = (S[0][1] + S[48][1]) / 2;
      const k = outCubic(seg(t, 31.1, 31.9));
      const x = lerp(env.V ? gx : gx - 700, gx, k), y = lerp(env.V ? gy - 700 : gy, gy, k);
      const paperA = 1 - seg(t, 31.9, 32.4);
      const k2 = 140 * (40 / 40) * (env.V ? 38 / 40 : 1);
      if (paperA > 0) LI.Sheet.draw(ctx, { sk: null, label: 'bird' }, { x, y: y + 10, w: 330, h: 380, rot: (1 - k) * -0.3, seed: 777, alpha: paperA });
      LI.Sheet.sketch(ctx, m.first.sk, x, y, k2, { alpha: 1 - dissolve, style: 'brush' });
    }

    drawCloseup(ctx, t, env, closeA);
    strands(ctx, env, cam, t);
    // opening from the ink of Nokta's pupil
    LI.Ambient.iris(ctx, env, 1 - outCubic(seg(t, 20.0, 20.95)), { t, seed: 9 });
  }

  LI.registerScene({ id: 3, start: 20, end: 36, name: 'Inside the Mind', nameTr: 'Zihnin İçinde',
    concept: 'Neuron: weighted sum → threshold → fire · forward pass', conceptTr: 'Nöron: ağırlıklı toplam → eşik → ateşleme · ileri yayılım', render });
})(window.LI = window.LI || {});
