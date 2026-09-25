/* ─────────────────────────────────────────────────────────────
   Procedural ink brush.
   Every mark in the film is built from these primitives:
     path    – variable-width tapered brush ribbon (pressure, wobble, dry-brush)
     line    – a slightly bowed hand-drawn line between two points
     hollow  – double-outline stroke (used ONLY for negative weights)
     dot     – ink dot with a soft bleeding halo (neurons, eyes, pixels)
     ring    – ensō-like brush circle
     blob    – irregular ink blot (errors, droplets)
     cracks  – paper-coloured fissures through a blot
     drops   – ballistic splash droplets
     wash    – pale diluted ink band (backpropagation)
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';
  const { rand, srand, noise } = LI.rng;
  const { clamp, lerp, smooth } = LI.E;
  const TAU = Math.PI * 2;
  const rgba = (rgb, a) => `rgba(${rgb},${a})`;

  function lengths(pts) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return L;
  }
  /** cut a polyline to the fraction range [a,b] of its length */
  function cut(pts, a, b) {
    if (a <= 0 && b >= 1) return pts;
    const L = lengths(pts), T = L[L.length - 1];
    const A = a * T, B = b * T, out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l0 = L[i], l1 = L[i + 1];
      if (l1 < A || l0 > B) continue;
      const f0 = l1 > l0 ? clamp((A - l0) / (l1 - l0)) : 0;
      const f1 = l1 > l0 ? clamp((B - l0) / (l1 - l0)) : 1;
      if (!out.length) out.push([lerp(pts[i][0], pts[i + 1][0], f0), lerp(pts[i][1], pts[i + 1][1], f0)]);
      out.push([lerp(pts[i][0], pts[i + 1][0], f1), lerp(pts[i][1], pts[i + 1][1], f1)]);
    }
    return out;
  }
  function normals(pts) {
    const n = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      n.push([-dy / l, dx / l]);
    }
    return n;
  }
  function offset(pts, d) {
    const n = normals(pts);
    return pts.map((p, i) => [p[0] + n[i][0] * d, p[1] + n[i][1] * d]);
  }

  /** fill a ribbon of per-point widths */
  function ribbon(ctx, pts, ws) {
    const n = normals(pts);
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + n[0][0] * ws[0] / 2, pts[0][1] + n[0][1] * ws[0] / 2);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + n[i][0] * ws[i] / 2, pts[i][1] + n[i][1] * ws[i] / 2);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0] - n[i][0] * ws[i] / 2, pts[i][1] - n[i][1] * ws[i] / 2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Brush path.
   * o.w width, o.seed, o.taper [in,out] fraction of length, o.wob width wobble,
   * o.p draw-on progress (0..1), o.from start fraction, o.alpha, o.color (rgb),
   * o.bleed halo strength, o.dry dry-brush streaks (0..1), o.minW
   */
  function path(ctx, pts, o = {}) {
    if (!pts || pts.length < 2) return;
    const p = o.p === undefined ? 1 : o.p;
    if (p <= 0.001) return;
    const P = cut(pts, o.from || 0, p);
    if (P.length < 2) return;
    const L = lengths(P), T = L[L.length - 1];
    if (T < 1e-4) return;
    const w = o.w ?? 4, seed = o.seed ?? 1, wob = o.wob ?? 0.25;
    const ti = (o.taper && o.taper[0]) ?? 0.15, to = (o.taper && o.taper[1]) ?? 0.3;
    const minW = o.minW ?? 0.35;
    const drawing = p < 1; // leading edge behaves like the brush tip
    const ws = P.map((pt, i) => {
      const s = L[i] / T;
      let k = minW + (1 - minW) * smooth(clamp(ti ? s / ti : 1));
      k *= minW + (1 - minW) * smooth(clamp(to ? (1 - s) / to : 1));
      if (drawing) k *= 0.5 + 0.5 * smooth(clamp((T - L[i]) / Math.min(30, T)));
      k *= 1 + wob * noise(L[i] / 38 + seed * 3.1, seed);
      return Math.max(w * 0.03, w * k);
    });
    const col = o.color || LI.INK_RGB, a = o.alpha ?? 1;
    if (o.bleed) {
      ctx.fillStyle = rgba(col, a * 0.1 * o.bleed);
      ribbon(ctx, P, ws.map((x) => x * 2.1 + 2));
      ctx.fillStyle = rgba(col, a * 0.12 * o.bleed);
      ribbon(ctx, P, ws.map((x) => x * 1.35 + 1));
    }
    ctx.fillStyle = rgba(col, a);
    ribbon(ctx, P, ws);
    if (o.dry && T > 20) {
      // paper-coloured streaks through the stroke = dry-brush texture
      ctx.fillStyle = rgba(LI.PAPER_RGB, 0.55 * o.dry);
      for (let k = 0; k < 3; k++) {
        const off = (rand(seed, k, 3) - 0.5) * 0.7;
        const a0 = 0.35 + rand(seed, k) * 0.4, a1 = Math.min(1, a0 + 0.2 + rand(seed, k, 2) * 0.35);
        const sub = cut(P, a0, a1);
        if (sub.length < 2) continue;
        const subL = lengths(sub), sT = subL[subL.length - 1] || 1;
        const sw = ws[Math.floor(P.length * (a0 + a1) / 2)] || w;
        const shifted = offset(sub, off * sw);
        ribbon(ctx, shifted, shifted.map((_, i) => Math.max(0.3, sw * 0.12 * Math.sin(Math.PI * subL[i] / sT))));
      }
    }
  }

  /** points of a bowed hand-drawn line a→b */
  function linePts(a, b, seed = 1, bow = 0.08, n) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const k = srand(seed, 'bow') * bow * L;
    const c = [(a[0] + b[0]) / 2 - dy / L * k, (a[1] + b[1]) / 2 + dx / L * k];
    return LI.E.quadPts(a, c, b, n || Math.max(4, Math.min(24, Math.round(L / 22))));
  }
  function line(ctx, a, b, o = {}) { path(ctx, linePts(a, b, o.seed ?? 1, o.bow ?? 0.06), o); }

  /** double-outline (hollow) stroke → negative weights */
  function hollow(ctx, pts, o = {}) {
    const w = o.w ?? 6, lw = Math.max(1.1, o.lw ?? w * 0.2);
    const oo = Object.assign({}, o, { w: lw, wob: 0.15, taper: [0.08, 0.08], minW: 0.6 });
    path(ctx, offset(pts, w / 2), Object.assign({}, oo, { seed: (o.seed || 1) + 0.5 }));
    path(ctx, offset(pts, -w / 2), oo);
  }

  /** split a polyline into dashes (broken, weak strokes) */
  function dashes(pts, on = 0.12, off = 0.08, seed = 1) {
    const out = []; let s = rand(seed, 'ph') * (on + off) * 0.5;
    while (s < 1) { out.push([s, Math.min(1, s + on * (0.7 + rand(seed, s) * 0.6))]); s += on + off; }
    return out.map(([a, b]) => cut(pts, a, b));
  }

  /** irregular closed shape points (for dots/blobs) */
  function blobPts(x, y, r, seed, irregular = 0.18, n = 18, t = 0, wobble = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (1 + irregular * noise(i * 0.9 + seed * 7, seed) + wobble * noise(t * 3 + i * 1.7, seed + 5));
      out.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    return out;
  }
  function fillSmooth(ctx, P) {
    ctx.beginPath();
    const n = P.length;
    const mid = (i) => [(P[i % n][0] + P[(i + 1) % n][0]) / 2, (P[i % n][1] + P[(i + 1) % n][1]) / 2];
    let m = mid(n - 1); ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) { const q = mid(i); ctx.quadraticCurveTo(P[i][0], P[i][1], q[0], q[1]); }
    ctx.closePath(); ctx.fill();
  }

  /** ink dot with a soft bleeding halo */
  function dot(ctx, x, y, r, o = {}) {
    if (r <= 0.05) return;
    const a = o.alpha ?? 1, col = o.color || LI.INK_RGB, seed = o.seed ?? 1;
    const bleed = o.bleed ?? 1;
    if (bleed > 0) {
      const R = r * (1.6 + 0.6 * bleed);
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, R);
      g.addColorStop(0, rgba(col, 0.28 * a * bleed));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = rgba(col, a);
    if (r < 2.2) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); return; }
    fillSmooth(ctx, blobPts(x, y, r, seed, o.irregular ?? 0.12, 12, o.t || 0, o.wobble || 0));
  }

  /** ensō brush circle */
  function ring(ctx, x, y, r, o = {}) {
    const seed = o.seed ?? 1, a0 = o.start ?? rand(seed, 'st') * TAU, gap = o.gap ?? 0.06;
    const n = Math.max(18, Math.round(r / 3));
    const sx = o.sx ?? 1, sy = o.sy ?? 1;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * TAU * (1 - gap);
      const rr = r * (1 + (o.irregular ?? 0.03) * noise(i / n * 6 + seed, seed));
      pts.push([x + Math.cos(a) * rr * sx, y + Math.sin(a) * rr * sy]);
    }
    path(ctx, pts, Object.assign({ taper: [0.05, 0.35], wob: 0.3 }, o));
  }

  /** irregular ink blot, grows with o.grow, optional satellite drops */
  function blob(ctx, x, y, r, o = {}) {
    const seed = o.seed ?? 1, g = o.grow ?? 1, a = o.alpha ?? 1, col = o.color || LI.INK_RGB;
    if (g <= 0) return;
    const R = r * g;
    const h = ctx.createRadialGradient(x, y, R * 0.7, x, y, R * 1.45);
    h.addColorStop(0, rgba(col, 0.22 * a)); h.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, R * 1.45, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(col, a);
    fillSmooth(ctx, blobPts(x, y, R, seed, o.irregular ?? 0.32, 22, o.t || 0, o.wobble || 0));
    const nSat = o.sat ?? 7;
    for (let i = 0; i < nSat; i++) {
      const ang = rand(seed, i, 'a') * TAU, d = R * (1.15 + rand(seed, i, 'd') * 0.9) * (0.6 + 0.4 * g);
      const rr = R * (0.05 + rand(seed, i, 'r') * 0.13);
      dot(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr, { seed: seed + i, bleed: 0.5, alpha: a, color: col });
      // a thin tendril toward bigger satellites
      if (rr > R * 0.1) line(ctx, [x + Math.cos(ang) * R * 0.8, y + Math.sin(ang) * R * 0.8], [x + Math.cos(ang) * d, y + Math.sin(ang) * d], { w: rr * 0.9, seed: seed + i, alpha: a, color: col, taper: [0.1, 0.1] });
    }
  }

  /** paper-coloured cracks through a blot: o.p progress, o.n count */
  function cracks(ctx, x, y, r, o = {}) {
    const seed = o.seed ?? 1, p = o.p ?? 1, n = o.n ?? 6;
    if (p <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + srand(seed, i) * 0.5;
      const pts = [[x + srand(seed, i, 'cx') * r * 0.08, y + srand(seed, i, 'cy') * r * 0.08]];
      let ang = a, px = pts[0][0], py = pts[0][1];
      const segs = 5;
      for (let k = 1; k <= segs; k++) {
        ang += srand(seed, i, k) * 0.7;
        const step = (r * (1.05 + rand(seed, i, 'len') * 0.35)) / segs;
        px += Math.cos(ang) * step; py += Math.sin(ang) * step;
        pts.push([px, py]);
      }
      const pi = clamp(p * 1.3 - (i % 3) * 0.1);
      path(ctx, pts, { w: (o.w ?? r * 0.07) * (0.6 + rand(seed, i, 'w') * 0.6), p: pi, color: LI.PAPER_RGB, taper: [0.02, 0.9], seed: seed + i, wob: 0.4 });
      // a branch
      if (i % 2 === 0 && pi > 0.5) {
        const m = pts[2], ba = a + srand(seed, i, 'b') * 1.2;
        path(ctx, [m, [m[0] + Math.cos(ba) * r * 0.35, m[1] + Math.sin(ba) * r * 0.35]], { w: r * 0.04, p: (pi - 0.5) * 2, color: LI.PAPER_RGB, taper: [0.02, 0.9] });
      }
    }
  }

  /** ballistic splash droplets; age in seconds since impact */
  function drops(ctx, x, y, age, o = {}) {
    if (age <= 0) return;
    const seed = o.seed ?? 1, n = o.n ?? 10, s = o.scale ?? 1, a = o.alpha ?? 1;
    const ground = o.ground ?? y;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + srand(seed, i, 'a') * 1.35;
      const v = (180 + rand(seed, i, 'v') * 320) * s;
      const tt = Math.min(age, 0.9);
      let px = x + Math.cos(ang) * v * tt * 0.9, py = y + Math.sin(ang) * v * tt + 0.5 * 1400 * s * tt * tt;
      const landed = py >= ground && tt > 0.05;
      if (landed) py = ground + rand(seed, i, 'g') * 18 * s - 9 * s;
      const r = (2 + rand(seed, i, 'r') * 5) * s;
      dot(ctx, px, py, landed ? r * 1.2 : r, { alpha: a, seed: seed + i, bleed: 0.6, irregular: 0.3 });
    }
  }

  /** pale diluted-ink band. o.front: 0..1 where the leading edge is (for flows) */
  function wash(ctx, pts, o = {}) {
    const w = o.w ?? 26, a = o.alpha ?? 0.18, col = o.color || LI.INK_RGB;
    for (let k = 0; k < 3; k++) {
      path(ctx, pts, { w: w * (1.6 - k * 0.35), alpha: a * (0.35 + k * 0.22), color: col, taper: o.taper || [0.25, 0.25], wob: 0.35, seed: (o.seed || 1) + k, from: o.from, p: o.p });
    }
  }

  /** little hatched shading lines inside a region (for landscapes etc.) */
  function hatch(ctx, x, y, w, h, o = {}) {
    const n = o.n ?? 8, seed = o.seed ?? 1, ang = o.ang ?? -0.9;
    for (let i = 0; i < n; i++) {
      const px = x + rand(seed, i) * w, py = y + rand(seed, i, 2) * h, L = (o.len ?? 18) * (0.6 + rand(seed, i, 3) * 0.8);
      line(ctx, [px, py], [px + Math.cos(ang) * L, py + Math.sin(ang) * L], { w: o.w ?? 1.4, alpha: o.alpha ?? 0.5, seed: seed + i, taper: [0.3, 0.5] });
    }
  }

  LI.Ink = { path, line, linePts, hollow, dashes, dot, ring, blob, cracks, drops, wash, hatch, cut, offset, lengths, blobPts, fillSmooth, rgba };
})(window.LI = window.LI || {});
