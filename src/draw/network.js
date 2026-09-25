/* ─────────────────────────────────────────────────────────────
   Neural-network ink drawing.
   VISUAL ENCODING (identical everywhere in the film):
     neuron            ink dot / brush ring; how full of ink = activation
     connection        brush line; THICKNESS = |weight|
     weak weight       thin, broken line
     negative weight   hollow double-outline stroke
     forward signal    dark ink pulse travelling along a line
     backprop          pale wash flowing BACKWARD; lines re-thicken as it passes
   The weights come from the real network in ml/mlp.js.
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';
  const { rand, srand, noise } = LI.rng;
  const { clamp, lerp, smooth, bezPts } = LI.E;
  const Ink = LI.Ink;
  const N = 7;
  const layouts = {};

  function structured(V) {
    const k = V ? 'v' : 'h';
    if (layouts[k]) return layouts[k];
    const L = [[], [], [], []];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++)
      L[0].push(V ? [(i - 3) * 44, -610 + (j - 3) * 44] : [-700 + (i - 3) * 48, (j - 3) * 48]);
    for (let i = 0; i < 8; i++) L[1].push(V ? [(i - 3.5) * 114, -150] : [-200, (i - 3.5) * 96]);
    for (let i = 0; i < 6; i++) L[2].push(V ? [(i - 2.5) * 136, 260] : [230, (i - 2.5) * 110]);
    for (let i = 0; i < 2; i++) L[3].push(V ? [(i - 0.5) * 360, 640] : [610, (i - 0.5) * 250]);
    return (layouts[k] = L);
  }
  function tangled(V) {
    const k = 't' + (V ? 'v' : 'h');
    if (layouts[k]) return layouts[k];
    const S = structured(V), T = S.map((layer, l) => layer.map((_, i) => {
      const a = rand('ta', l, i) * Math.PI * 2, r = Math.sqrt(rand('tr', l, i)) * 380;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.9];
    }));
    return (layouts[k] = T);
  }
  const nodePos = (l, i, morph, V) => {
    const S = structured(V)[l][i], T = tangled(V)[l][i];
    const m = smooth(clamp(morph * 1.25 - rand('stg', l, i) * 0.25));
    return [lerp(T[0], S[0], m), lerp(T[1], S[1], m)];
  };

  /** points along connection l:(i→j) under morph */
  function connPts(l, i, j, morph, V, n = 10) {
    const a = nodePos(l, i, morph, V), b = nodePos(l + 1, j, morph, V);
    const m = smooth(clamp(morph * 1.2 - rand('cs', l, i, j) * 0.2));
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const bow = srand('bow', l, i, j) * 0.05;
    const s1 = [a[0] + dx / 3 - dy * bow, a[1] + dy / 3 + dx * bow], s2 = [a[0] + (2 * dx) / 3 - dy * bow, a[1] + (2 * dy) / 3 + dx * bow];
    const t1 = [srand('c1x', l, i, j) * 520, srand('c1y', l, i, j) * 460], t2 = [srand('c2x', l, i, j) * 520, srand('c2y', l, i, j) * 460];
    return bezPts(a, [lerp(t1[0], s1[0], m), lerp(t1[1], s1[1], m)], [lerp(t2[0], s2[0], m), lerp(t2[1], s2[1], m)], b, n);
  }

  function xf(o) { const s = o.scale ?? 1, cx = o.cx ?? 0, cy = o.cy ?? 0; return (p) => [cx + p[0] * s, cy + p[1] * s]; }

  /** style of a weight line */
  function wStyle(w, l, lineScale) {
    const m = LI.Net.model();
    const v = Math.min(1.35, Math.abs(w) / m.scale[l]);
    return { v, neg: w < 0, weak: v < 0.2, w: (0.7 + 7.2 * Math.pow(v, 0.9)) * lineScale, alpha: 0.28 + 0.72 * clamp(v * 1.4) };
  }

  function drawConn(ctx, pts, st, seed, a, alphaMul = 1) {
    const al = st.alpha * a * alphaMul;
    if (al < 0.01) return;
    if (st.weak) {
      for (const d of Ink.dashes(pts, 0.1, 0.09, seed)) if (d.length > 1) Ink.path(ctx, d, { w: Math.max(0.6, st.w * 0.8), alpha: al * 0.8, seed, taper: [0.2, 0.2], wob: 0.3 });
    } else if (st.neg) {
      Ink.hollow(ctx, pts, { w: st.w * 1.15 + 2, lw: Math.max(0.9, st.w * 0.22), alpha: al, seed });
    } else {
      Ink.path(ctx, pts, { w: st.w, alpha: al, seed, taper: [0.12, 0.12], wob: 0.28, minW: 0.5, bleed: st.v > 0.6 ? 0.5 : 0 });
    }
  }

  /**
   * Main draw.
   * o = { cx, cy, scale, V, morph, q | P, Pfrom, Pto, back, input, fwd, fire, alpha, lineScale,
   *       labels, nodeScale, focus: {l,i} dims others, outFill: [bird,fish] override, only: fn(l,i,j) }
   */
  function draw(ctx, o, t) {
    const V = !!o.V, morph = o.morph ?? 1, a = o.alpha ?? 1, ls = (o.lineScale ?? 1), ns = o.nodeScale ?? 1;
    const T = xf(o), sc = o.scale ?? 1;
    const m = LI.Net.model();
    const Pbase = o.P || LI.Net.params(o.q ?? 0);
    const back = o.back ?? -1;
    // weights shown during a backward wash: interpolate from Pfrom to Pto as the front passes
    const wAt = (l, i, j) => {
      if (back < 0 || !o.Pfrom) return LI.Net.weight(Pbase, l, j, i);
      const k = smooth(clamp((back - (2 - l)) * 1.25 - 0.15 - rand('wf', l, i, j) * 0.1));
      return lerp(LI.Net.weight(o.Pfrom, l, j, i), LI.Net.weight(o.Pto, l, j, i), k);
    };
    // forward activations (always computed from the displayed parameters)
    let acts = null;
    if (o.input) acts = LI.Net.forward(o.Pfrom && back >= 0 ? o.Pfrom : Pbase, o.input).acts;
    const fwd = o.fwd ?? -1;
    const maxA = acts ? acts.map((A) => Math.max(1e-6, ...A.map(Math.abs))) : null;
    const reveal = (L) => (L === 0 ? (o.input ? 1 : 0) : clamp((fwd - (L - 1)) / 0.35 - 1.5));

    // ── connections
    for (let l = 0; l < 3; l++) {
      const nin = m.SIZES[l], nout = m.SIZES[l + 1];
      for (let j = 0; j < nout; j++) for (let i = 0; i < nin; i++) {
        if (o.only && !o.only(l, i, j)) continue;
        const pts = connPts(l, i, j, morph, V).map(T);
        const st = wStyle(wAt(l, i, j), l, ls * sc * lerp(0.4, 1, morph) * (l === 0 ? 0.5 : 1));
        let mul = lerp(0.55, 1, morph) * (l === 0 ? 0.62 : 1);
        if (o.focus) mul = o.focus.l === l + 1 && o.focus.i === j ? 1 : 0.18;
        if (o.dimInput && l === 0) mul *= o.dimInput;
        drawConn(ctx, pts, st, l * 1000 + j * 60 + i, a, mul);
      }
    }

    // ── backward wash (pale, flowing from output toward input)
    if (back >= 0 && back < 3.2) {
      const l = 2 - Math.floor(clamp(back, 0, 2.999)), f = back - (2 - l);
      const nin = m.SIZES[l], nout = m.SIZES[l + 1];
      for (let j = 0; j < nout; j++) for (let i = 0; i < nin; i++) {
        if (l === 0 && (i + j * 3) % 4) continue; // thin out the dense first layer
        const dw = Math.abs(LI.Net.weight(o.Pto, l, j, i) - LI.Net.weight(o.Pfrom, l, j, i)) / m.scale[l];
        const pts = connPts(l, i, j, morph, V).map(T);
        const fr = clamp(f * 1.15);
        Ink.wash(ctx, pts, { w: (14 + 26 * clamp(dw * 3)) * sc * ls, alpha: 0.2 * a * (0.5 + clamp(dw * 4)), from: 1 - fr, p: Math.min(1, 1 - fr + 0.35), seed: j * 7 + i, taper: [0.5, 0.2] });
      }
    }

    // ── forward pulses
    if (acts && fwd > 0 && fwd < 3.2) {
      const l = Math.min(2, Math.floor(fwd)), f = clamp(fwd - l);
      if (f < 0.98) {
        const nin = m.SIZES[l], nout = m.SIZES[l + 1];
        const contrib = [];
        let mx = 1e-6;
        for (let j = 0; j < nout; j++) for (let i = 0; i < nin; i++) { const c = acts[l][i] * wAt(l, i, j); contrib.push([i, j, c]); mx = Math.max(mx, Math.abs(c)); }
        for (const [i, j, c] of contrib) {
          const v = Math.abs(c) / mx;
          if (v < 0.1 || (o.only && !o.only(l, i, j))) continue;
          const pts = connPts(l, i, j, morph, V).map(T);
          const ff = clamp(f * 1.1 - rand('pd', l, i, j) * 0.1);
          const p = LI.E.along(pts, ff), p2 = LI.E.along(pts, Math.max(0, ff - 0.06));
          const r = (2.5 + 8 * Math.sqrt(v)) * sc * ls * (o.pulseScale ?? 1);
          if (c < 0) { Ink.ring(ctx, p[0], p[1], r, { w: 1.6 * sc, seed: i + j, alpha: a }); }
          else { Ink.path(ctx, [p2, p], { w: r * 1.6, alpha: a * 0.9, taper: [0.9, 0.05], seed: i * 3 + j }); Ink.dot(ctx, p[0], p[1], r, { alpha: a, seed: i + j * 5, bleed: 0.8 }); }
        }
      }
    }

    // ── random misfiring pulses (untrained, Scene 2 head)
    if (o.fire) {
      for (let l = 0; l < 3; l++) for (let c = 0; c < 18; c++) {
        const i = Math.floor(rand('fi', l, c) * m.SIZES[l]), j = Math.floor(rand('fj', l, c) * m.SIZES[l + 1]);
        const ph = (t * (1.3 + rand('fr', l, c)) + rand('fo', l, c)) % 1;
        if (ph > 0.6) continue;
        const pts = connPts(l, i, j, morph, V).map(T);
        const p = LI.E.along(pts, ph / 0.6);
        Ink.dot(ctx, p[0], p[1], (4 + 4 * rand('fs', l, c)) * sc * ls, { alpha: a * o.fire, seed: c, bleed: 0.6 });
      }
    }

    // ── nodes
    for (let L = 0; L < 4; L++) {
      const n = m.SIZES[L];
      for (let i = 0; i < n; i++) {
        const p = T(nodePos(L, i, morph, V));
        let fill = 0.12;
        if (acts) fill = lerp(0.12, 1, clamp(acts[L][i] / maxA[L]) * reveal(L));
        if (L === 3 && o.outFill) fill = o.outFill[i];
        const dim = o.focus ? (o.focus.l === L && o.focus.i === i ? 1 : 0.3) : 1;
        if (L === 0) {
          const v = o.input ? o.input[i] : 0;
          const r = (o.input ? 2.5 + 13 * v : 3.2) * sc * ns;
          Ink.dot(ctx, p[0], p[1], r, { alpha: a * (o.input ? 0.25 + 0.75 * v : 0.5) * dim, seed: i, bleed: 0.7 });
        } else {
          const r = (L === 3 ? 30 : 18) * sc * ns;
          ctx.fillStyle = `rgba(${LI.PAPER_RGB},${0.85 * a})`; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
          if (fill > 0.13) Ink.dot(ctx, p[0], p[1], r * (0.3 + 0.62 * fill), { alpha: a * (0.35 + 0.65 * fill) * dim, seed: L * 50 + i, bleed: 0.9 * fill, wobble: 0.1, t });
          Ink.ring(ctx, p[0], p[1], r, { w: (L === 3 ? 4 : 3) * sc * ns, seed: L * 20 + i, alpha: a * dim, gap: 0.1 });
        }
      }
    }
    // ── output labels (hand-drawn glyphs)
    if (o.labels && LI.Glyph) {
      const lab = o.labelAlpha ?? 1;
      [0, 1].forEach((i) => {
        const p = T(nodePos(3, i, morph, V));
        const off = V ? [0, 90 * sc] : [95 * sc, 0];
        LI.Glyph.draw(ctx, i === 0 ? 'bird' : 'fish', p[0] + off[0], p[1] + off[1], 52 * sc, { alpha: a * lab, seed: 900 + i, circle: true });
      });
    }
  }

  /** node position in world (for cameras, blots, fragments) */
  function nodeWorld(o, L, i) { return xf(o)(nodePos(L, i, o.morph ?? 1, !!o.V)); }

  /** the web inside Nokta's head (always drawn with the horizontal layout, scaled down) */
  function mind(ctx, cx, cy, r, o, t) {
    const morph = o.morph ?? 0;
    const sc = r / lerp(330, 800, smooth(clamp(morph)));
    draw(ctx, {
      cx: cx + smooth(clamp(morph)) * -20 * sc, cy, scale: sc, V: false, morph, q: o.q ?? 0, alpha: o.alpha ?? 0.6,
      lineScale: o.lineScale ?? 1.6, nodeScale: o.nodeScale ?? 1.5, fire: o.fire, fwd: o.fwd, input: o.input,
      only: (l, i, j) => (l > 0 ? (i + j) % 2 === 0 || morph > 0.5 : (i * 7 + j * 3) % (o.sparse ?? 7) === 0),
    }, t);
  }

  LI.NetDraw = { draw, mind, nodeWorld, connPts, structured, nodePos };
})(window.LI = window.LI || {});
