/* SCENE 4 — LEARNING FROM MISTAKES (36–54 s)
   Error at the output → a pale wash flows backward (backpropagation) and
   re-weights every line it passes. The network folds into a loss landscape;
   Nokta walks downhill by gradient descent (overshoots once, scrambles back).
   Accelerating training montage with the REAL loss curve, then back to a
   network that is now organized. */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, spring, outBack, outCubic, inCubic, inOut, hump, smooth } = LI.E;
  const { noise, rand, srand } = LI.rng;
  const Ink = LI.Ink, Land = LI.Land;

  const T = { err: 36.0, back0: 38.6, back1: 42.4, morph0: 42.4, morph1: 44.4, drop: 44.15, feel: 44.75, step0: 45.45, mont0: 49.0, mont1: 52.4, ret1: 53.6 };
  const QB = 0.03; // progress shown after the first backward pass (few dozen examples; exaggerated for visibility)

  // ── step schedule for gradient descent (pure function of time)
  let SCHED = null;
  function sched() {
    if (SCHED) return SCHED;
    const xs = Land.steps();
    const out = []; let t = T.step0;
    for (let k = 0; k < xs.length - 1; k++) {
      const overshoot = (xs[k] - Land.MIN_U) * (xs[k + 1] - Land.MIN_U) < 0 && k > 0;
      const after = k > 0 && (xs[k - 1] - Land.MIN_U) * (xs[k] - Land.MIN_U) < 0;
      const dur = k < 3 ? 0.42 : overshoot ? 0.34 : after ? 0.45 : 0.3;
      out.push({ k, u0: xs[k], u1: xs[k + 1], t0: t, t1: t + dur, overshoot, scramble: after });
      t += dur + (overshoot ? 0.05 : after ? 0.25 : k < 3 ? 0.14 : 0.06);
    }
    return (SCHED = out);
  }

  /** training progress q as a function of time */
  function qAt(t) {
    if (t < T.back1) return 0;
    const S = sched(), last = S[S.length - 1];
    if (t < T.mont0) return lerp(QB, 0.1, seg(t, S[0].t0, last.t1));
    return lerp(0.1, 1, Math.pow(seg(t, T.mont0, T.mont1 - 0.2), 1.6));
  }

  function uAt(t) {
    const S = sched();
    if (t <= S[0].t0) return S[0].u0;
    for (const s of S) {
      if (t < s.t0) return s.u0;
      if (t <= s.t1) return lerp(s.u0, s.u1, s.scramble ? outCubic(seg(t, s.t0, s.t1)) : inOut(seg(t, s.t0, s.t1)));
    }
    // after the scripted steps: tiny noisy settling (stochastic examples)
    const last = S[S.length - 1].u1;
    return last + noise(t * 2.2, 12) * 14 * (1 - seg(t, T.mont0, T.mont1));
  }
  function stepInfo(t) { for (const s of sched()) if (t >= s.t0 && t <= s.t1) return s; return null; }

  function pose(t, env) {
    const u = uAt(t), [x, y] = Land.toWorld(u, env), sl = Land.slopeAngle(u, env);
    const s = env.V ? 0.72 : 0.78;
    const st = stepInfo(t);
    const f = Land.frame(env);
    // walking gait uses horizontal distance travelled
    const dist = (u + 560) * f.sx;
    const G = LI.Nokta.gait(dist * 2.2, { stride: 60, lift: st ? (st.scramble ? 16 : 11) : 0, dir: 1, spread: 22 });
    const moving = st ? 1 : 0;
    const feet = G.feet.map(([dx, dy]) => { const fy = Land.toWorld(u + dx / f.sx, env)[1]; return [dx * moving + (1 - moving) * (dx > 0 ? 12 : -12), fy - y + dy * moving]; });
    const p = { x, y, s, feet, bob: G.bob * moving, lean: -sl * 0.35, turn: 0.35, lookX: 0.6, lookY: 0.9, mouth: 0, brow: 0.45, lids: 0.2, mind: { morph: 1, alpha: 0.4, q: qAt(t) } };
    // arrival drop onto the hilltop
    const dropK = outCubic(seg(t, T.drop, T.drop + 0.35));
    p.y -= (1 - dropK) * 500;
    p.sq = 1 + 0.25 * (1 - dropK) * (t < T.drop + 0.35 ? 1 : 0) - 0.2 * hump(t, T.drop + 0.33, T.drop + 0.6);
    // feel the slope: looks at its feet, taps the ground
    const feel = seg(t, T.feel, T.feel + 0.2) * (1 - seg(t, T.step0 - 0.1, T.step0));
    if (feel > 0) {
      p.lookY = 1; p.lookX = 0.3; p.turn = 0.2; p.brow = 0.1;
      const tap = hump(t, T.feel + 0.15, T.feel + 0.35) + hump(t, T.feel + 0.4, T.feel + 0.6);
      p.feet = [feet[0], [feet[1][0] + 6, feet[1][1] - 12 * tap]];
    }
    if (st && st.overshoot) { const k = seg(t, st.t0, st.t1); p.lean = -sl * 0.3 - 0.25 * k; p.hands = { L: [-1.3, -0.3], R: [1.2, -0.5] }; p.mouthOpen = 0.6; p.brow = -0.6; p.lookX = 0.8; p.lookY = 0.4; }
    if (st && st.scramble) {
      const k = seg(t, st.t0, st.t1); p.turn = -0.4; p.lookX = -0.9; p.lookY = 0.6; p.lean = 0.18 * Math.sin(k * 14);
      p.hands = { L: [-1.3 + 0.2 * Math.sin(t * 30), -0.2 + 0.3 * Math.cos(t * 27)], R: [1.25, -0.2 + 0.3 * Math.sin(t * 29)] };
      p.brow = -0.5; p.mouthOpen = 0.35;
    }
    // settled in the valley: relief, and a small satisfied bounce during the montage
    if (t > sched()[sched().length - 1].t1 + 0.1) { p.brow = 0.2; p.lids = 0; p.mouth = 0.6; p.turn = 0; p.lookX = 0; p.lookY = -0.3; p.lean = 0; }
    p.blink = hump(t, 46.9, 47.05) + hump(t, 50.3, 50.45);
    return p;
  }

  // ── network ↔ landscape morph: every connection becomes a stretch of terrain
  const MAP = {};
  function morphMap(V) {
    const k = V ? 'v' : 'h';
    if (MAP[k]) return MAP[k];
    const m = LI.Net.model(), list = [];
    for (let j = 0; j < 8; j++) for (let i = 0; i < 49; i++) if ((i * 7 + j * 3) % 9 === 0) list.push([0, i, j]);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) list.push([1, i, j]);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 6; i++) list.push([2, i, j]);
    const buckets = [[], [], []];
    list.forEach((c, n) => buckets[n % 5 < 3 ? 0 : n % 5 === 3 ? 1 : 2].push(c));
    const out = [];
    buckets.forEach((B, f) => B.forEach((c, r) => {
      const u0 = -1150 + (2300 * r) / B.length, u1 = u0 + (2300 * 1.4) / B.length;
      out.push({ c, f, u0, u1 });
    }));
    return (MAP[k] = out);
  }
  function drawMorph(ctx, env, m, q, t) {
    const fns = [Land.h, Land.hb1, Land.hb2], widths = [5.5, 3, 2.2], alphas = [1, 0.42, 0.28];
    const P = LI.Net.params(q);
    for (const { c: [l, i, j], f, u0, u1 } of morphMap(env.V)) {
      const cp = LI.NetDraw.connPts(l, i, j, 1, env.V, 10);
      const pp = []; for (let s = 0; s <= 10; s++) pp.push(Land.toWorld(lerp(u0, u1, s / 10), env, fns[f]));
      const mm = smooth(clamp(m * 1.3 - rand('mm', l, i, j) * 0.3));
      const pts = cp.map((q0, s) => [lerp(q0[0], pp[s][0], mm), lerp(q0[1], pp[s][1], mm)]);
      const w = LI.Net.weight(P, l, j, i), v = Math.min(1.3, Math.abs(w) / LI.Net.model().scale[l]);
      const ww = lerp((0.7 + 7.2 * Math.pow(v, 0.9)) * (l === 0 ? 0.5 : 1), widths[f], mm);
      Ink.path(ctx, pts, { w: ww, alpha: lerp(0.3 + 0.7 * clamp(v * 1.4), alphas[f], mm), seed: l * 100 + i * 9 + j, taper: [0.15, 0.15], dry: 0.4 * mm });
    }
  }

  // ── montage overlays (screen space)
  function lossPanel(ctx, env, t, a) {
    if (a <= 0.01) return;
    LI.Camera.screen(ctx);
    const w = env.V ? 380 : 360, h = env.V ? 240 : 210;
    const x0 = env.V ? env.W - w - 70 : env.W - w - 90, y0 = env.V ? 170 : 90;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = `rgba(${LI.PAPER_RGB},0.8)`; ctx.fillRect(x0 - 26, y0 - 22, w + 52, h + 48);
    // hand-drawn axes
    Ink.path(ctx, [[x0, y0 - 6], [x0, y0 + h], [x0 + w + 8, y0 + h]], { w: 3, seed: 5, taper: [0.1, 0.1] });
    Ink.path(ctx, [[x0 - 7, y0 + 6], [x0, y0 - 8], [x0 + 7, y0 + 6]], { w: 2.4, seed: 6 });
    // real loss curve up to the current training progress
    const c = LI.Net.model().lossCurve, q = qAt(t), n = Math.max(1, Math.floor(q * (c.length - 1)));
    const mx = c[0] * 1.05, pts = [];
    for (let i = 0; i <= n; i++) pts.push([x0 + 8 + (w - 10) * (i / (c.length - 1)), y0 + h - 8 - (h - 20) * clamp(Math.sqrt(c[i] / mx))]);
    if (pts.length > 1) Ink.path(ctx, pts, { w: 3.6, seed: 7, taper: [0.02, 0.2], wob: 0.2 });
    const e = pts[pts.length - 1]; Ink.dot(ctx, e[0], e[1], 7, { seed: 8 });
    ctx.restore();
  }
  function netPanel(ctx, env, t, a) {
    if (a <= 0.01) return;
    LI.Camera.screen(ctx);
    const cx = env.V ? 300 : 330, cy = env.V ? 300 : 230, sc = env.V ? 0.26 : 0.27;
    const w = env.V ? 470 : 520, h = env.V ? 470 : 300;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = `rgba(${LI.PAPER_RGB},0.82)`; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    const m = LI.Net.model();
    // alternating forward pass / backward wash, faster and faster
    const ph = (t - T.mont0) * 1.1 + Math.pow(seg(t, T.mont0, T.mont1), 2) * 7;
    const cyc = Math.floor(ph), f = ph - cyc;
    const q = qAt(t), dq = 0.02;
    const ex = m.data[((cyc * 37) % m.data.length + m.data.length) % m.data.length];
    LI.NetDraw.draw(ctx, { cx: cx + (env.V ? 0 : 40), cy: cy + (env.V ? 0 : 0), scale: sc, V: env.V, q, input: ex.x,
      fwd: f < 0.55 ? 3 * (f / 0.55) : 3, back: f >= 0.55 ? 3 * ((f - 0.55) / 0.45) : -1,
      Pfrom: LI.Net.params(Math.max(0, q - dq)), Pto: LI.Net.params(q), lineScale: 1.8, nodeScale: 1.4, pulseScale: 1.3 }, t);
    ctx.restore();
  }
  function flyingSheets(ctx, env, cam, t) {
    const W = LI.World;
    // one sheet per gradient step…
    const items = sched().map((s) => ({ t0: s.t0 - 0.1, dur: 0.75, i: s.k }));
    // …then faster and faster during the montage
    const N = 26;
    for (let k = 0; k < N; k++) items.push({ t0: T.mont0 + 3.3 * Math.sqrt(k / N), dur: 0.55 - 0.25 * (k / N), i: 20 + k });
    LI.Camera.apply(ctx, env, cam, 1.15);
    const m = LI.Net.model();
    for (const it of items) {
      const f = (t - it.t0) / it.dur;
      if (f < 0 || f > 1) continue;
      const d = m.data[(it.i * 29) % m.data.length];
      const span = env.V ? 700 : 1150;
      const x = cam.x + lerp(span, -span, f), y = cam.y - (env.V ? 160 : 60) + srand('fy', it.i) * (env.V ? 180 : 90) + Math.sin(f * 6) * 14;
      for (let g = 2; g >= 0; g--) {
        const xx = x + g * 40;
        LI.Sheet.draw(ctx, { sk: d.sk, label: d.y === 0 ? 'bird' : 'fish' }, { x: xx, y, w: 110, h: 135, rot: srand('fr', it.i) * 0.3 + f * 0.4, seed: it.i, alpha: g ? 0.12 : 1, shadow: g ? 0 : 1 });
      }
    }
  }

  function camera(t, env) {
    const V = env.V;
    const full = V ? { x: 0, y: 20, zoom: 0.98 } : { x: -70, y: 0, zoom: 0.98 };
    const outN = LI.NetDraw.nodeWorld({ V, morph: 1 }, 3, 1);
    const land = V ? { x: 60, y: 160, zoom: 0.95 } : { x: 60, y: 110, zoom: 0.96 };
    const valley = Land.toWorld(Land.MIN_U, env);
    const land2 = V ? { x: valley[0] - 40, y: valley[1] - 330, zoom: 1.05 } : { x: valley[0] - 260, y: valley[1] - 220, zoom: 1.05 };
    let cam = LI.Camera.track([
      [36.0, full],
      [37.2, { x: outN[0] * 0.55, y: outN[1] * 0.55, zoom: 1.28 }, inOut],
      [38.6, { x: outN[0] * 0.55, y: outN[1] * 0.55, zoom: 1.3 }],
      [39.5, { x: outN[0] * 0.5, y: outN[1] * 0.5, zoom: 1.3 }],
      [42.4, V ? { x: 0, y: -380, zoom: 1.2 } : { x: -520, y: 0, zoom: 1.25 }, inOut],
      [44.4, land, inOut],
      [48.8, Object.assign({}, land2)],
      [T.mont1, Object.assign({}, land2, { zoom: 0.98 })],
      [T.ret1, full, inOut],
    ], t);
    // the tilt: camera pitches down onto the terrain and back
    const tilt = hump(t, 42.2, 44.8) * 0.22 + hump(t, 52.5, 54) * 0.18;
    cam.tilt = 1 - tilt; cam.rot += -0.05 * hump(t, 42.2, 44.8) + 0.04 * hump(t, 52.5, 54);
    return LI.Camera.breathe(cam, t, 0.7);
  }

  function render(ctx, lt, env, t) {
    const cam = camera(t, env);
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.28, n: 30, depth: 0.4, seed: 41 });
    LI.Camera.apply(ctx, env, cam);
    const m = LI.Net.model();
    const V = env.V;
    const mIn = inOut(seg(t, T.morph0, T.morph1));
    const mOut = inOut(seg(t, T.mont1, T.ret1));
    const landM = mIn * (1 - mOut);

    if (t < T.morph0) {
      // ── ERROR + BACKPROP on the full network
      const back = t > T.back0 ? 3 * inOut(seg(t, T.back0, T.back1)) : -1;
      LI.NetDraw.draw(ctx, { V, morph: 1, q: 0, labels: true, input: m.first.x, fwd: 3,
        back, Pfrom: LI.Net.params(0), Pto: LI.Net.params(QB) }, t);
      // the correct answer, marked by the human label: a dashed target ring around "bird"
      const nb = LI.NetDraw.nodeWorld({ V, morph: 1 }, 3, 0), nf = LI.NetDraw.nodeWorld({ V, morph: 1 }, 3, 1);
      const ringA = outCubic(seg(t, 36.2, 36.8)) * (1 - seg(t, 41.5, 42.4));
      if (ringA > 0) Ink.dashes(circlePts(nb, 52), 0.06, 0.04, 3).forEach((d) => d.length > 1 && Ink.path(ctx, d, { w: 3, alpha: ringA, seed: 3, p: ringA }));
      // the error blot on the wrong answer
      const g = spring(seg(t, 36.25, 37.6) * 1.4, 9, 4.5) * (1 - 0.8 * inOut(seg(t, 38.6, 39.8)));
      if (t > 36.25) {
        Ink.blob(ctx, nf[0], nf[1], 50, { grow: clamp(g, 0, 1.3), seed: 61, sat: 8, wobble: 0.05, t });
        Ink.cracks(ctx, nf[0], nf[1], 48, { p: outCubic(seg(t, 36.7, 37.8)) * (1 - seg(t, 38.8, 39.6)), seed: 12, n: 6 });
        Ink.drops(ctx, nf[0], nf[1], t - 36.25, { n: 10, seed: 22, ground: nf[1] + 90, scale: 0.8, alpha: 1 - seg(t, 38.6, 39.5) });
      }
      // the wash source: pale ink bleeds out of the blot
      if (t > 38.3) {
        const wa = hump(t, 38.3, 39.6);
        const gr = ctx.createRadialGradient(nf[0], nf[1], 10, nf[0], nf[1], 200);
        gr.addColorStop(0, `rgba(${LI.INK_RGB},${0.22 * wa})`); gr.addColorStop(1, `rgba(${LI.INK_RGB},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(nf[0], nf[1], 200, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // ── network ↔ landscape (mm = how much "landscape")
      const mm = t < T.mont1 ? mIn : 1 - mOut;
      const q = t < T.mont0 ? QB : 1;
      if (mm < 0.999) {
        ctx.globalAlpha = 1 - mm;
        LI.NetDraw.draw(ctx, { V, morph: 1, q, only: () => false, labels: true }, t);
        ctx.globalAlpha = 1;
        if (t > T.mont1 && mOut > 0.55) {
          ctx.globalAlpha = smooth(seg(mOut, 0.55, 1));
          LI.NetDraw.draw(ctx, { V, morph: 1, q: 1, labels: true }, t);
          ctx.globalAlpha = 1;
        }
        drawMorph(ctx, env, mm, q, t);
      } else Land.draw(ctx, env, { alpha: 1 });
    }

    // Nokta on the terrain
    if (t > T.drop && t < T.ret1) {
      const fade = 1 - seg(t, T.mont1, T.mont1 + 0.6);
      if (fade > 0) {
        ctx.globalAlpha = fade;
        LI.Nokta.draw(ctx, LI.Nokta.follow((tt) => pose(tt, env), t), t);
        // arrival splash
        if (t < T.drop + 1.2) { const [x, y] = Land.toWorld(-560, env); Ink.drops(ctx, x, y - 4, t - T.drop - 0.33, { n: 8, seed: 71, ground: y + 2, scale: 0.6 }); }
        ctx.globalAlpha = 1;
      }
    }
    // each gradient step = one training example flicking past; faster in the montage
    if (t > T.step0 - 0.2 && t < T.mont1) flyingSheets(ctx, env, cam, t);
    // montage panels
    const pa = seg(t, T.mont0 - 0.3, T.mont0 + 0.2) * (1 - seg(t, T.mont1 - 0.2, T.mont1 + 0.3));
    lossPanel(ctx, env, t, Math.max(pa, seg(t, 46, 46.5) * (1 - seg(t, T.mont1 - 0.2, T.mont1 + 0.3))));
    netPanel(ctx, env, t, pa);
  }

  function circlePts(c, r) { const p = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; p.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } return p; }

  LI.registerScene({ id: 4, start: 36, end: 54, name: 'Learning from Mistakes', nameTr: 'Hatalardan Öğrenmek',
    concept: 'Loss → backpropagation → gradient descent', conceptTr: 'Hata → geri yayılım → gradyan iniş', render, qAt });
})(window.LI = window.LI || {});
