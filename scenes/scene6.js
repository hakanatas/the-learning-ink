/* SCENE 6 — THE FIRST CORRECT GUESS (68–80 s)
   A new, unusual bird (a pose absent from the training data). Clear pathways
   light up; the bird answer fills — and a small AMBER light appears: the only
   colour in the film, reserved for generalization. The light's wave sorts the
   scattered sheets into groups. Then Nokta draws its own bird, stroke by
   stroke, choosing each next stroke from faint candidates (a hint of
   generative AI). */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, spring, outBack, outCubic, inCubic, inOut, hump, smooth, along } = LI.E;
  const { noise, rand, srand } = LI.rng;
  const Ink = LI.Ink, W = LI.World;

  const WAVE0 = 73.9, WAVE_DUR = 1.8, WAVE_R = 2000;
  const SHEET_H = 1.25;

  /** carry a sheet in with the hand: returns { sheet pose, hand pose } */
  function carry(t, env, t0, t1, tRelease, tOut) {
    const L = W.L(env), w = L.sheetW, h = w * SHEET_H;
    const [sx, sy] = L.sheet;
    const p0 = L.handIn, p1 = [sx, sy - h / 2 + 14];
    const k = outCubic(seg(t, t0, t1));
    const pinch = [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - 26 * hump(t, t1 - 0.5, t1 + 0.1)];
    const swing = t > t0 ? 0.2 * Math.sin((t - t0) * 5.5) * Math.exp(-(t - t0) * 1.5) * (1 - seg(t, t1, t1 + 0.4)) : 0;
    const sheet = { x: pinch[0] - Math.sin(swing) * (h / 2 - 14), y: pinch[1] + Math.cos(swing) * (h / 2 - 14), w, h, rot: swing, visible: t > t0 };
    const out = [L.handIn[0] + 200, L.handIn[1] - 200];
    const ko = inCubic(seg(t, tOut, tOut + 0.9));
    const hand = { x: lerp(pinch[0], out[0], ko), y: lerp(pinch[1], out[1], ko), rot: env.V ? 0.35 : 0.62, s: env.V ? 1.8 : 1.95, pinch: 1 - seg(t, tRelease, tRelease + 0.3), point: 0, alpha: t > t0 && t < tOut + 0.9 ? 1 : 0 };
    return { sheet, hand };
  }

  function waveCenter(env) { const L = W.L(env); return [L.nokta + 90, env.V ? -120 : -210]; }
  const waveR = (t) => WAVE_R * outCubic(seg(t, WAVE0, WAVE0 + WAVE_DUR));
  function passTime(d) { const f = clamp(d / WAVE_R, 0, 0.999); return WAVE0 + WAVE_DUR * (1 - Math.cbrt(1 - f)); }

  /** floor sheet pose: scattered, then carried by the wave into tidy groups */
  function floorPose(s, t, env) {
    const land = env.V ? s.land.v : s.land.h, grp = env.V ? s.group.v : s.group.h;
    const c = waveCenter(env);
    const tp = passTime(Math.hypot(land[0] - c[0], land[1] - c[1]));
    const k = inOut(seg(t, tp, tp + 0.9));
    const hop = Math.sin(Math.PI * k) * 110;
    return { x: lerp(land[0], grp[0], k), y: lerp(land[1], grp[1], k) - hop, rot: lerp(s.land.rot, s.group.rot, k) + Math.sin(Math.PI * k) * 0.5, flat: 1 - 0.6 * Math.sin(Math.PI * k), w: 150 };
  }

  /** the new unusual bird: presented, then joins the bird group */
  function unusualPose(t, env) {
    const c = carry(t, env, 68.7, 70.0, 70.0, 70.3);
    const grp = env.V ? [-190, -440] : [-560, 270];
    const L = W.L(env);
    const tp = passTime(Math.hypot(L.sheet[0] - waveCenter(env)[0], L.sheet[1] - waveCenter(env)[1]));
    const k = inOut(seg(t, tp, tp + 1.0));
    if (k <= 0) return Object.assign({ flat: 0 }, c.sheet);
    return { x: lerp(c.sheet.x, grp[0], k), y: lerp(c.sheet.y, grp[1], k) - Math.sin(Math.PI * k) * 140, rot: Math.sin(Math.PI * k) * 0.6 + k * -0.05, flat: k, w: lerp(c.sheet.w, 150, k), h: lerp(c.sheet.h, 150 * SHEET_H, k), visible: true };
  }

  // ── Nokta's own drawing
  const DRAW_SK = () => LI.Sketch.make('bird', 42, { variant: 'perched', rot: 0.05, scale: 0.95, flip: 1 });
  const drawArea = (env) => (env.V ? [60, -70, 80] : [130, -70, 88]);
  const STROKE_T0 = 76.0, STROKE_DT = 0.52;
  function strokeState(t, env) {
    const sk = DRAW_SK(), [dx, dy, k] = drawArea(env);
    const n = sk.strokes.length;
    const i = Math.floor((t - STROKE_T0) / STROKE_DT);
    const local = (t - STROKE_T0) / STROKE_DT - i;
    return { sk, dx, dy, k, n, i: clamp(i, -1, n), local };
  }
  function penPoint(t, env) {
    const st = strokeState(t, env);
    if (st.i < 0 || st.i >= st.n) return null;
    const P = st.sk.strokes[st.i].map(([u, v]) => [st.dx + u * st.k, st.dy + v * st.k]);
    const p = clamp((st.local - 0.3) / 0.7);
    return along(P, p);
  }

  function pose(t, env) {
    const L = W.L(env), gy = W.GY(env);
    const m = LI.Net.model();
    const p = { x: L.nokta, y: gy, s: 1, mouth: 0.2, turn: 0.1, mind: { morph: 1, alpha: 0.45, q: 1 } };
    // watching the hand bring the new drawing
    const u = unusualPose(t, env);
    const watch = seg(t, 68.6, 69.0) * (1 - seg(t, 70.2, 70.5));
    p.lookX = lerp(0, 0.8, watch); p.lookY = lerp(0, -0.5, watch); p.turn = lerp(0.1, 0.4, watch);
    // stillness: studies it
    const study = seg(t, 70.3, 70.7) * (1 - seg(t, 72.1, 72.3));
    p.lookX = lerp(p.lookX, 0.95, study); p.lookY = lerp(p.lookY, -0.1, study); p.turn = lerp(p.turn, 0.5, study);
    p.lean = 0.1 * study; p.lids = 0.35 * study; p.brow = 0.25 * study;
    if (t > 70.8 && t < 72.4) p.mind = { morph: 1, alpha: 0.6, q: 1, input: m.unusual.x, fwd: 3 * inOut(seg(t, 70.8, 72.2)) };
    // correct! the amber light appears in its hand
    const glowIn = outBack(seg(t, 72.25, 72.8));
    const joy = seg(t, 72.2, 72.5);
    if (t > 72.2) {
      p.mouth = lerp(0.2, 1, joy); p.brow = lerp(p.brow, 0.3, joy); p.lids = 0;
      p.squint = t > 72.35 && t < 72.9 ? 1 : 0;
      p.lookX = lerp(p.lookX, 0.6, joy); p.lookY = lerp(p.lookY, 0.2, joy); p.turn = lerp(p.turn, 0.3, joy);
      p.hands = { L: [-1.25, 0.5], R: [1.25, lerp(0.55, -0.35, joy)] };
      p.glow = glowIn * (1 - seg(t, WAVE0 - 0.05, WAVE0 + 0.05));
      p.sq = 1 + 0.08 * hump(t, 72.2, 72.7);
    }
    // anticipation → release the light upward
    if (t > 73.3) {
      const an = hump(t, 73.3, 73.85), rel = seg(t, 73.8, 74.0) * (1 - seg(t, 74.6, 75.2));
      p.sq = 1 - 0.14 * an + 0.14 * rel; p.crouch = 0.5 * an;
      p.hands = { L: [lerp(-1.25, -1.1, rel), lerp(0.5, -1.2, rel)], R: [lerp(1.25, 1.0, rel), lerp(-0.35 + 0.4 * an, -1.4, rel)] };
      p.lookX = lerp(0.6, 0.2, seg(t, 73.3, 73.9)); p.lookY = lerp(0.2, -1, seg(t, 73.7, 74.1));
      p.turn = lerp(0.3, 0, seg(t, 73.3, 73.8));
      p.mouthOpen = 0.5 * rel; p.brow = 0.1;
      // watching the sheets fly into groups
      const look = seg(t, 74.4, 74.8) * (1 - seg(t, 75.5, 75.8));
      p.lookX = lerp(p.lookX, Math.sin((t - 74.4) * 3) * 0.9, look); p.lookY = lerp(p.lookY, 0.2, look);
    }
    // picks up the brush and draws its own bird
    if (t > 75.5) {
      const k = seg(t, 75.5, 75.9);
      p.hold = t > 75.75 ? 'brush' : null; p.brushAng = -0.95;
      const pen = penPoint(t, env) || penPoint(Math.min(79.3, Math.max(STROKE_T0 + 0.35, t)), env);
      const bodyC = [p.x, p.y - LI.Nokta.LEG - LI.Nokta.BASE_R];
      const R = LI.Nokta.BASE_R;
      const tip = [Math.cos(-0.95) * 47, Math.sin(-0.95) * 47];
      const hand = pen ? [(pen[0] - tip[0] - bodyC[0]) / R, (pen[1] - tip[1] - bodyC[1]) / R] : [1.3, 0.2];
      p.hands = { L: [-1.2, 0.55], R: [lerp(1.2, hand[0], k), lerp(0.4, hand[1], k)] };
      p.turn = lerp(0, 0.45, k); p.lookX = pen ? clamp((pen[0] - bodyC[0]) / 200, -1, 1) : 0.8; p.lookY = pen ? clamp((pen[1] - bodyC[1] + 20) / 200, -1, 1) : 0;
      p.lids = 0.25 * k; p.brow = 0.35 * k; p.mouth = 0.3; p.lean = 0.06 * k;
      p.mind = { morph: 1, alpha: 0.5, q: 1, fire: 0.5 };
      // done: joy
      const done = seg(t, 79.35, 79.6);
      if (done > 0) { p.squint = 1; p.mouth = 1; p.sq = 1 + 0.08 * hump(t, 79.35, 79.9); p.hands.L = [-1.3, lerp(0.55, -0.3, done)]; p.lids = 0; }
    }
    p.blink = Math.max(p.squint ? 0 : 0, hump(t, 69.4, 69.55), hump(t, 77.6, 77.75));
    return p;
  }

  function camera(t, env) {
    const V = env.V, L = W.L(env);
    const scene = { x: V ? 20 : 170, y: V ? 20 : 10, zoom: V ? 1.08 : 1.18 };
    const study = { x: V ? 60 : 180, y: V ? -60 : -20, zoom: V ? 1.3 : 1.4 };
    const wide = { x: V ? 0 : 0, y: V ? -60 : -20, zoom: V ? 0.95 : 0.98 };
    const draw = { x: V ? 20 : 60, y: V ? -60 : -30, zoom: V ? 1.35 : 1.55 };
    let cam = LI.Camera.track([
      [68.0, scene], [70.3, scene], [72.2, study, inOut], [73.6, study], [74.4, wide, inOut], [75.6, wide], [76.6, draw, inOut], [79.4, Object.assign({}, draw, { zoom: draw.zoom * 1.04 })], [80, scene, inOut],
    ], t);
    LI.Camera.breathe(cam, t, 0.7);
    // opening: pull back out of Nokta's eye
    if (t < 69.4) {
      const e = LI.Nokta.eyes(pose(68.0, env))[1];
      cam = LI.Camera.dive(cam, { x: e[0] + 4, y: e[1] + 4, zoom: 22, rot: -0.12, tilt: 1 }, 1 - outCubic(seg(t, 68.0, 69.4)));
    }
    return cam;
  }

  /** shared outdoor set (also used by Scene 7) */
  function outdoor(ctx, env, t, opts = {}) {
    const L = W.L(env), gy = W.GY(env);
    LI.Ambient.ground(ctx, -1000 + L.nokta, 1000 + L.nokta, gy + 6, { alpha: 0.35 });
    Ink.drops(ctx, L.nokta, gy - 4, 5, { n: 12, seed: 3, ground: gy + 4, alpha: 0.4, scale: 0.8 });
    // the old error stain has dried to a pale mark
    ctx.save(); ctx.translate(L.tokFish[0], L.tokFish[1]); ctx.scale(1, 0.72);
    Ink.blob(ctx, 0, 0, 62, { grow: 1.1, seed: 41, sat: 9, alpha: 0.16 });
    ctx.restore();
    W.token(ctx, 'bird', L.tokBird[0], L.tokBird[1], { fill: opts.birdFill || 0 });
    W.token(ctx, 'fish', L.tokFish[0], L.tokFish[1], {});
    W.sheets.forEach((s) => W.drawSheet(ctx, s, floorPose(s, t, env)));
  }

  function render(ctx, lt, env, t) {
    const cam = camera(t, env);
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.28, n: 22, depth: 0.4, seed: 11 });
    LI.Camera.apply(ctx, env, cam);
    const L = W.L(env), m = LI.Net.model();
    const birdFill = seg(t, 72.1, 72.5);
    outdoor(ctx, env, t, { birdFill });

    // the unusual bird
    const u = unusualPose(t, env);
    if (u.visible) LI.Sheet.draw(ctx, { sk: m.unusual.sk, label: null }, { x: u.x, y: u.y, w: u.w, h: u.h, rot: u.rot, flat: u.flat, seed: 901 });

    // Nokta's own bird (drawn on the paper itself)
    const st = strokeState(t, env);
    if (t > STROKE_T0) {
      st.sk.strokes.forEach((s, i) => {
        const P = s.map(([a, b]) => [st.dx + a * st.k, st.dy + b * st.k]);
        const p = i < st.i ? 1 : i === st.i ? clamp((st.local - 0.3) / 0.7) : 0;
        if (i === st.i && st.local < 0.55 && i < st.n) {
          // faint candidate next-strokes: the model "predicts" options, then commits to one
          const ga = hump(st.local, 0, 0.55);
          for (let g = 0; g < 3; g++) {
            const ang = (g - 1) * 0.55 + srand('ga', i, g) * 0.2, sc = 0.75 + rand('gs', i, g) * 0.5;
            const o = P[0], c = Math.cos(ang), sn = Math.sin(ang);
            const G = P.map(([x, y]) => { const dx = (x - o[0]) * sc, dy = (y - o[1]) * sc; return [o[0] + dx * c - dy * sn, o[1] + dx * sn + dy * c]; });
            if (g === 1) continue; // the one it will choose is drawn for real
            Ink.dashes(G, 0.07, 0.07, i * 3 + g).forEach((d) => d.length > 1 && Ink.path(ctx, d, { w: 2, alpha: 0.3 * ga, seed: g }));
          }
        }
        if (p > 0) Ink.path(ctx, P, { w: 4.4, p, seed: 950 + i, taper: [0.15, 0.35], bleed: 0.4, dry: 0.3 });
      });
    }

    // the hand
    const c = carry(t, env, 68.7, 70.0, 70.0, 70.3);
    LI.Hand.draw(ctx, c.hand, t);

    LI.Nokta.draw(ctx, LI.Nokta.follow((tt) => pose(tt, env), t), t);

    // THE AMBER WAVE (generalization) — the only colour in the film
    const r = waveR(t);
    if (t > WAVE0 && t < WAVE0 + WAVE_DUR + 0.3) {
      const [cx, cy] = waveCenter(env);
      const a = 1 - seg(t, WAVE0 + 0.6, WAVE0 + WAVE_DUR + 0.3);
      // the light rises from the hand to the centre, then blooms
      const rise = outCubic(seg(t, WAVE0, WAVE0 + 0.25));
      const hp = LI.Nokta.eyes(pose(WAVE0, env))[1];
      const lx = lerp(hp[0] + 60, cx, rise), ly = lerp(hp[1] - 60, cy, rise);
      LI.Nokta.glow(ctx, lx, ly, a, 1.4, t);
      ctx.save();
      for (let k = 0; k < 3; k++) {
        const rr = r * (1 - k * 0.06);
        if (rr < 2) continue;
        ctx.strokeStyle = `rgba(${LI.AMBER_RGB},${(0.75 - k * 0.22) * a})`;
        ctx.lineWidth = (10 - k * 3) * (1 - 0.5 * seg(t, WAVE0, WAVE0 + WAVE_DUR));
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) { const ang = (i / 72) * Math.PI * 2, q = rr * (1 + 0.015 * noise(i * 0.5 + k, 3)); i ? ctx.lineTo(cx + Math.cos(ang) * q, cy + Math.sin(ang) * q) : ctx.moveTo(cx + Math.cos(ang) * q, cy + Math.sin(ang) * q); }
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, Math.max(0, r * 0.7), cx, cy, r + 1);
      g.addColorStop(0, `rgba(${LI.AMBER_RGB},0)`); g.addColorStop(1, `rgba(${LI.AMBER_RGB},${0.12 * a})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    LI.Ambient.iris(ctx, env, 1 - outCubic(seg(t, 68.0, 68.5)), { t, seed: 15 });
  }

  LI.Outdoor = { outdoor, floorPose, carry, drawArea, DRAW_SK };
  LI.registerScene({ id: 6, start: 68, end: 80, name: 'The First Correct Guess', nameTr: 'İlk Doğru Tahmin',
    concept: 'Generalization: right on an unseen example', conceptTr: 'Genelleme: hiç görmediği örnekte doğru', render, pose });
})(window.LI = window.LI || {});
