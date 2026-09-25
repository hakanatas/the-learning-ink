/* SCENE 5 — PATTERNS EMERGE (54–68 s)
   Travel through the TRAINED network. First-layer neurons respond to simple
   strokes; deeper neurons combine strokes into parts; parts combine into the
   concept "bird". (Fragments are an illustration of feature hierarchy; node
   activations are the real network's.) */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, outBack, outCubic, inCubic, inOut, hump, smooth, smoothPath, along } = LI.E;
  const { noise, rand } = LI.rng;
  const Ink = LI.Ink;

  const circ = (r, cx = 0, cy = 0, n = 16) => { const p = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
  const S = (pts) => smoothPath(pts, 5);
  // layer-1 "simple strokes"
  const FRAG = [
    [[-0.8, 0.05], [0.8, -0.05]],
    [[-0.7, 0.6], [0.7, -0.6]],
    [[-0.7, -0.6], [0.7, 0.6]],
    S([[-0.8, 0.4], [0, -0.5], [0.8, 0.4]]),
    S([[-0.8, -0.4], [0, 0.5], [0.8, -0.4]]),
    [[-0.6, -0.7], [-0.6, 0.5], [0.7, 0.5]],
    circ(0.55),
    [[0.05, -0.8], [-0.05, 0.8]],
  ];
  // layer-2 "parts": each stroke comes from a layer-1 fragment
  const PARTS = [
    { name: 'wing', strokes: [[3, S([[-0.85, 0.35], [-0.25, -0.65], [0.7, 0.05]])], [2, [[0.7, 0.05], [-0.55, 0.45]]]], to: 0 },
    { name: 'beak', strokes: [[1, [[-0.5, -0.35], [0.75, 0]]], [2, [[0.75, 0], [-0.5, 0.35]]]], to: 0 },
    { name: 'head', strokes: [[6, circ(0.5, -0.1, 0)], [7, [[0.12, -0.12], [0.1, 0.05]]]], to: 0 },
    { name: 'tail', strokes: [[1, [[0.55, 0], [-0.75, -0.55]]], [0, [[0.55, 0.08], [-0.8, 0.3]]]], to: 0 },
    { name: 'fin', strokes: [[4, S([[-0.7, 0.35], [-0.1, -0.6], [0.6, 0.3]])], [5, [[-0.7, 0.35], [0.6, 0.3]]]], to: 1 },
    { name: 'body', strokes: [[3, S([[-0.85, 0], [0, -0.45], [0.85, 0]])], [4, S([[-0.85, 0], [0, 0.45], [0.85, 0]])]], to: 1 },
  ];
  // where each part sits in the final bird drawing (unit space of the concept)
  const BIRD_PLACE = { wing: [-0.1, -0.05, 0.5], beak: [0.78, -0.42, 0.22], head: [0.52, -0.42, 0.34], tail: [-0.72, 0.1, 0.35] };

  function resample(pts, n = 14) { const out = []; for (let i = 0; i < n; i++) out.push(along(pts, i / (n - 1))); return out; }

  const netO = (env) => ({ V: env.V, morph: 1, q: 1 });
  const fragPos = (env, i) => { const n = LI.NetDraw.nodeWorld(netO(env), 1, i); return env.V ? [n[0], n[1] + 66] : [n[0] + 74, n[1] - 34]; };
  const partPos = (env, i) => { const n = LI.NetDraw.nodeWorld(netO(env), 2, i); return env.V ? [n[0], n[1] + 86] : [n[0] + 82, n[1] - 40]; };
  const conceptPos = (env, k) => { const n = LI.NetDraw.nodeWorld(netO(env), 3, k); return env.V ? [n[0] + (k ? 0 : 0), n[1] + 230] : [n[0] + 270, n[1] - (k ? 0 : 10)]; };

  let INPUT = null;
  function input() {
    if (INPUT) return INPUT;
    const m = LI.Net.model();
    const d = m.test.find((d) => d.y === 0 && d.sk.variant === 'flying') || m.test[0];
    return (INPUT = d);
  }

  function camera(t, env) {
    const V = env.V;
    const n0 = LI.NetDraw.nodeWorld(netO(env), 0, 24), n1 = LI.NetDraw.nodeWorld(netO(env), 1, 4), n2 = LI.NetDraw.nodeWorld(netO(env), 2, 3), n3 = LI.NetDraw.nodeWorld(netO(env), 3, 0);
    const full = V ? { x: 0, y: 20, zoom: 0.98 } : { x: -70, y: 0, zoom: 0.98 };
    const K = V
      ? [[54, full], [55.6, { x: n0[0], y: n0[1] + 60, zoom: 1.5 }], [57.2, { x: 0, y: n1[1] + 60, zoom: 1.35 }], [60.2, { x: 0, y: n1[1] + 90, zoom: 1.35 }], [61.4, { x: 0, y: n2[1] + 80, zoom: 1.4 }], [63.6, { x: 0, y: n2[1] + 90, zoom: 1.4 }], [64.8, { x: 0, y: n3[1] + 100, zoom: 1.4 }], [66.4, { x: 0, y: n3[1] + 120, zoom: 1.45 }], [67.4, full]]
      : [[54, full], [55.6, { x: n0[0] + 80, y: 0, zoom: 1.55 }], [57.2, { x: n1[0] + 20, y: 0, zoom: 1.4 }], [60.2, { x: n1[0] + 60, y: 0, zoom: 1.4 }], [61.4, { x: n2[0] + 40, y: 0, zoom: 1.4 }], [63.6, { x: n2[0] + 80, y: 0, zoom: 1.4 }], [64.8, { x: n3[0] + 90, y: 0, zoom: 1.4 }], [66.4, { x: n3[0] + 150, y: -40, zoom: 1.45 }], [67.4, full]];
    return LI.Camera.breathe(LI.Camera.track(K, t), t, 0.6);
  }

  function render(ctx, lt, env, t) {
    const cam = camera(t, env);
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.25, n: 30, depth: 0.4, seed: 51 });
    LI.Camera.apply(ctx, env, cam);
    const d = input();
    const inA = seg(t, 54.6, 55.6);
    const fwd = 3 * inOut(seg(t, 55.8, 65.2));
    const acts = LI.Net.forward(LI.Net.params(1), d.x).acts;
    LI.NetDraw.draw(ctx, Object.assign(netO(env), { input: d.x.map((v) => v * inA), fwd, labels: true, pulseScale: 1.1 }), t);

    // the new bird appears over the input grid and dissolves into its pixels
    if (t < 56) {
      const g = LI.NetDraw.structured(env.V)[0], gx = (g[0][0] + g[48][0]) / 2, gy = (g[0][1] + g[48][1]) / 2;
      LI.Sheet.sketch(ctx, d.sk, gx, gy, 150, { alpha: hump(t, 54.0, 56.0), p: outCubic(seg(t, 54.0, 54.8)), style: 'brush' });
    }

    const maxA1 = Math.max(...acts[1]), maxA2 = Math.max(...acts[2]);
    // ── layer 1: simple strokes
    const f1 = seg(t, 56.4, 57.6);
    FRAG.forEach((fr, i) => {
      const [x, y] = fragPos(env, i), a = outCubic(clamp(f1 * 1.6 - i * 0.08));
      if (a <= 0) return;
      const act = 0.35 + 0.65 * clamp(acts[1][i] / maxA1);
      ctx.fillStyle = `rgba(${LI.PAPER_RGB},${0.94 * a})`; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
      Ink.ring(ctx, x, y, 34, { w: 1.6, alpha: 0.5 * a, seed: 500 + i, gap: 0.15 });
      Ink.path(ctx, fr.map(([u, v]) => [x + u * 22, y + v * 22]), { w: 4.6, alpha: a * act, seed: 510 + i, p: a, taper: [0.2, 0.3], bleed: 0.4 });
    });

    // ── layer 2: fragments travel forward and assemble into parts
    PARTS.forEach((part, j) => {
      const [px, py] = partPos(env, j);
      const t0 = 59.8 + j * 0.22, k = inOut(seg(t, t0, t0 + 1.3));
      if (k <= 0) return;
      const act = 0.35 + 0.65 * clamp(acts[2][j] / maxA2);
      if (k > 0.6) { const a = seg(k, 0.6, 1); ctx.fillStyle = `rgba(${LI.PAPER_RGB},${0.94 * a})`; ctx.beginPath(); ctx.arc(px, py, 40, 0, Math.PI * 2); ctx.fill(); Ink.ring(ctx, px, py, 40, { w: 1.4, alpha: 0.4 * a, seed: 600 + j, gap: 0.15 }); }
      part.strokes.forEach(([src, pts], s) => {
        const [fx, fy] = fragPos(env, src);
        const A = resample(FRAG[src].map(([u, v]) => [fx + u * 22, fy + v * 22]));
        const B = resample(pts.map(([u, v]) => [px + u * 27, py + v * 27]));
        const arc = Math.sin(Math.PI * k) * (env.V ? 60 : -60);
        const P = A.map((a, n) => [lerp(a[0], B[n][0], k) + (env.V ? arc : 0), lerp(a[1], B[n][1], k) + (env.V ? 0 : arc)]);
        Ink.path(ctx, P, { w: 4.4, alpha: lerp(0.85, act, k), seed: 700 + j * 5 + s, taper: [0.2, 0.3] });
      });
    });

    // ── output: parts combine into the concept "bird"
    const [bx, by] = conceptPos(env, 0);
    const kc = seg(t, 63.4, 65.4);
    PARTS.forEach((part, j) => {
      if (part.to !== 0) return;
      const [px, py] = partPos(env, j);
      const pl = BIRD_PLACE[part.name];
      const k = inOut(clamp(kc * 1.3 - j * 0.08));
      if (k <= 0) return;
      const tx = bx + pl[0] * 120, ty = by + pl[1] * 120, sc = lerp(27, pl[2] * 120, k);
      const cx = lerp(px, tx, k), cy = lerp(py, ty, k) - Math.sin(Math.PI * k) * 50;
      part.strokes.forEach(([, pts], s) => Ink.path(ctx, pts.map(([u, v]) => [cx + u * sc, cy + v * sc]), { w: lerp(3.6, 4.6, k), alpha: 1 - 0.85 * seg(t, 65.6, 66.4), seed: 800 + j * 5 + s, taper: [0.2, 0.3] }));
    });
    // the assembled bird settles into one confident drawing
    const bird = LI.Sketch.make('bird', 3, { variant: 'perched', rot: 0, scale: 0.9, flip: 1 });
    const ca = seg(t, 65.4, 66.4);
    if (ca > 0) {
      LI.Sheet.sketch(ctx, bird, bx, by, 120, { alpha: ca, style: 'brush' });
    }
    // faint fish concept (the other output) — not chosen for this input
    if (kc > 0.3) { const [fx, fy] = conceptPos(env, 1); const fish = LI.Sketch.make('fish', 4, { variant: 'classic', rot: 0, scale: 0.8, flip: 1 }); LI.Sheet.sketch(ctx, fish, fx, fy, 70, { alpha: 0.18 * seg(kc, 0.3, 1), style: 'fine' }); }

    // exit: back out through Nokta's eye
    LI.Ambient.iris(ctx, env, inCubic(seg(t, 67.25, 68.0)), { t, seed: 13 });
  }

  LI.registerScene({ id: 5, start: 54, end: 68, name: 'Patterns Emerge', nameTr: 'Örüntüler Belirir',
    concept: 'Feature hierarchy: strokes → parts → "bird"', conceptTr: 'Özellik hiyerarşisi: çizgiler → parçalar → "kuş"', render });
})(window.LI = window.LI || {});
