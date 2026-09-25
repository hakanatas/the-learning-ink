/* SCENE 2 — DATA (8–20 s)
   Sheets drift down like leaves: birds & fish, each with a human-made label.
   A human hand presents the first bird. Nokta's untrained mind fires at random,
   it confidently points at FISH — wrong. The error blot cracks; Nokta flinches.
   Then the camera dives into Nokta's eye. */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, spring, outBack, outCubic, inCubic, inOut, hump, smooth } = LI.E;
  const { noise } = LI.rng;
  const Ink = LI.Ink, W = LI.World;

  const T_HIT = 16.1;      // error blot lands
  const SHEET_H = 1.25;

  function sheetPresented(t, env) {
    const L = W.L(env), w = L.sheetW, h = w * SHEET_H;
    const [sx, sy] = L.sheet;
    // hand carries the sheet in, pinched at its top edge
    const pinch0 = [L.handIn[0], L.handIn[1]], pinch1 = [sx, sy - h / 2 + 14];
    const k = outCubic(seg(t, 10.7, 12.2));
    const pinch = [lerp(pinch0[0], pinch1[0], k), lerp(pinch0[1], pinch1[1], k) - 30 * hump(t, 11.6, 12.3)];
    const swing = 0.22 * Math.sin((t - 10.7) * 5.5) * Math.exp(-(t - 10.7) * 1.4) * (t > 10.7 ? 1 : 0);
    const rot = swing * (1 - seg(t, 12.2, 12.6));
    const cx = pinch[0] - Math.sin(rot) * (h / 2 - 14), cy = pinch[1] + Math.cos(rot) * (h / 2 - 14);
    return { x: cx, y: cy, w, h, rot, pinch, visible: t > 10.7 };
  }

  function handPose(t, env) {
    const L = W.L(env), sp = sheetPresented(t, env);
    const w = L.sheetW, h = w * SHEET_H;
    const label = [L.sheet[0] + w * 0.3, L.sheet[1] + h * 0.36 - 6];
    const out = [L.handIn[0] + 200, L.handIn[1] - 200];
    let x = sp.pinch[0], y = sp.pinch[1], pinch = 1 - seg(t, 12.2, 12.5), point = 0;
    if (t > 12.5) {
      const k = inOut(seg(t, 12.5, 13.0));
      x = lerp(sp.pinch[0], label[0] + 6, k); y = lerp(sp.pinch[1], label[1] - 14, k) - 26 * hump(t, 12.5, 13.0);
      point = seg(t, 12.45, 12.8);
      // tap tap: the human writes the label
      y += 10 * hump(t, 13.05, 13.25) + 10 * hump(t, 13.3, 13.5);
    }
    if (t > 13.7) { const k = inCubic(seg(t, 13.7, 14.6)); x = lerp(label[0] + 6, out[0], k); y = lerp(label[1] - 14, out[1], k); }
    return { x, y, rot: env.V ? 0.35 : 0.62, s: env.V ? 1.8 : 1.95, pinch, point, alpha: t < 14.6 ? 1 : 0 };
  }

  function pose(t, env) {
    const L = W.L(env), gy = W.GY(env);
    const p = { x: L.nokta, y: gy, s: 1, mouth: 0.25, mind: { morph: 0, alpha: 0.42, q: 0 } };
    // eyes follow the falling sheets (weighted average of those in the air)
    let ax = 0, ay = 0, wsum = 0;
    for (const s of W.sheets) {
      const sp = W.sheetPose(s, t + 0.15, env);
      if (!sp) continue;
      const f = clamp((t - s.fall.t0) / s.fall.dur), wgt = Math.sin(Math.PI * f);
      ax += sp.x * wgt; ay += sp.y * wgt; wsum += wgt;
    }
    const watching = 1 - seg(t, 12.3, 12.9);
    if (wsum > 0.01) { ax /= wsum; ay /= wsum; } else { ax = L.nokta; ay = -200; }
    const dx = ax - L.nokta, dy = ay - (gy - 150);
    let lookX = clamp(dx / 350, -1, 1) * watching, lookY = clamp(dy / 350, -1, 1) * watching;
    let turn = clamp(dx / 900, -0.5, 0.5) * watching, lean = clamp(dx / 4000, -0.08, 0.08) * watching;
    p.sq = 1 + 0.08 * hump(t, 10.1, 10.45) - 0.08 * hump(t, 9.8, 10.1);          // a small excited bounce
    p.y -= 22 * hump(t, 10.08, 10.5);
    p.mouthOpen = 0.4 * hump(t, 8.6, 10.6);
    p.brow = -0.3 * hump(t, 8.5, 11);
    // watching the hand arrive with the sheet
    const hp = handPose(t, env);
    const hk = seg(t, 11.0, 11.4) * (1 - seg(t, 13.8, 14.2));
    lookX = lerp(lookX, clamp((hp.x - L.nokta) / 350, -1, 1), hk);
    lookY = lerp(lookY, clamp((hp.y - gy + 150) / 400, -1, 1), hk);
    turn = lerp(turn, 0.45, hk);
    // studies the sheet, leans in (curiosity)
    const study = seg(t, 13.8, 14.3) * (1 - seg(t, 14.8, 15.0));
    lookX = lerp(lookX, 0.9, study); lookY = lerp(lookY, -0.1, study); turn = lerp(turn, 0.5, study);
    lean = lerp(lean, 0.12, study);
    p.lids = 0.4 * study;
    // anticipation → confident point at FISH
    const antic = hump(t, 14.8, 15.3);
    const pointK = seg(t, 15.2, 15.45) * (1 - seg(t, 16.1, 16.25));
    p.sq -= 0.13 * antic; lean -= 0.14 * antic;
    p.sq += 0.12 * hump(t, 15.2, 15.7);
    if (pointK > 0) {
      lookX = lerp(lookX, 0.55, pointK); lookY = lerp(lookY, 0.8, pointK); turn = lerp(turn, 0.35, pointK);
      p.brow = 0.5 * pointK; p.mouth = 0.8; p.lids = 0;
      lean = lerp(lean, 0.1, pointK);
    }
    const handR = pointK > 0 ? [lerp(1.2, 1.55, pointK), lerp(0.6, 0.95, pointK)] : [1.22 - 0.3 * antic, 0.55 - 0.2 * antic];
    p.hands = { L: [-1.22 + 0.25 * antic, 0.55 - 0.1 * antic], R: handR };
    if (pointK > 0.5) p.point = 'R';
    // FLINCH at the error
    const fl = seg(t, T_HIT, T_HIT + 0.08) * (1 - seg(t, T_HIT + 0.45, T_HIT + 0.9));
    if (t > T_HIT) {
      p.sq = lerp(p.sq, 0.76, fl);
      lean = lerp(lean, -0.28, fl);
      p.x -= 34 * outCubic(seg(t, T_HIT, T_HIT + 0.25));
      p.blink = fl; p.brow = lerp(p.brow, -0.8, seg(t, T_HIT, T_HIT + 0.2));
      p.hands = { L: [lerp(-1.22, -0.9, fl), lerp(0.55, -0.55, fl)], R: [lerp(1.22, 1.0, fl), lerp(0.55, -0.6, fl)] };
      p.mouth = -0.6; p.mouthOpen = 0.5 * fl;
      // afterwards: confusion & frustration — looks at the blot, then the sheet, then down
      const after = seg(t, T_HIT + 0.5, T_HIT + 0.9);
      const lk = track([[16.9, [0.6, 0.8, 0.3]], [17.5, [0.6, 0.8, 0.3]], [17.9, [0.9, -0.2, 0.45]], [18.4, [0.9, -0.2, 0.45]], [18.7, [0, 0.5, 0]], [18.95, [0, 0, 0]]], t);
      lookX = lerp(lookX, lk[0], after); lookY = lerp(lookY, lk[1], after); turn = lerp(turn, lk[2], after);
      p.sq = lerp(p.sq, 0.95, after); lean = lerp(lean, -0.03, after);
      p.lids = 0.25 * after * (1 - seg(t, 18.6, 18.9));
      p.tuft = 0.5 * after;
      p.mind = { morph: 0, alpha: 0.42, q: 0, fire: 0.7 * hump(t, 16.2, 18.2) };
    }
    p.lookX = lookX; p.lookY = lookY; p.turn = turn; p.lean = lean;
    // random misfiring while it "thinks"
    if (t > 13.8 && t < 15.4) p.mind = { morph: 0, alpha: 0.5, q: 0, fire: hump(t, 13.8, 15.4) };
    p.blink = Math.max(p.blink || 0, hump(t, 9.3, 9.45), hump(t, 12.7, 12.85), hump(t, 17.7, 17.85));
    return p;
  }

  function camera(t, env) {
    const V = env.V, L = W.L(env);
    const wide = { x: V ? 0 : 0, y: V ? 0 : -20, zoom: 1 };
    const scene = { x: V ? 20 : 170, y: V ? 20 : 10, zoom: V ? 1.08 : 1.18 };
    let cam = LI.Camera.track([
      [8, { x: L.nokta, y: V ? 20 : -10, zoom: V ? 1.62 : 1.48 }],
      [9.6, wide, inOut],
      [11.2, wide],
      [12.6, scene, inOut],
      [16.0, Object.assign({}, scene, { zoom: scene.zoom * 1.04 })],
      [16.15, Object.assign({}, scene, { zoom: scene.zoom * 1.1 })], // punch-in on the error
      [18.7, Object.assign({}, scene, { zoom: scene.zoom * 1.12 })],
    ], t);
    LI.Camera.breathe(cam, t, 0.8);
    // shake on impact
    const sh = Math.exp(-(t - T_HIT) * 9) * (t > T_HIT ? 1 : 0);
    cam.x += noise(t * 40, 5) * 10 * sh; cam.y += noise(t * 40, 6) * 10 * sh;
    // THE DIVE: accelerate into Nokta's eye
    if (t > 18.75) {
      const e = LI.Nokta.eyes(pose(t, env))[1];
      const k = inCubic(seg(t, 18.75, 20.0));
      cam = LI.Camera.dive(cam, { x: e[0] + 4, y: e[1] + 4, zoom: 22, rot: 0.12, tilt: 1 }, k);
    }
    return cam;
  }

  function render(ctx, lt, env, t) {
    const L = W.L(env), gy = W.GY(env);
    const cam = camera(t, env);
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.28, n: 22, depth: 0.4, seed: 11 });
    LI.Camera.apply(ctx, env, cam);
    LI.Ambient.ground(ctx, -1000 + L.nokta, 1000 + L.nokta, gy + 6, { alpha: 0.35 });
    // splash droplets left from the birth stay on the paper
    LI.Ink.drops(ctx, L.nokta, gy - 4, 5, { n: 12, seed: 3, ground: gy + 4, alpha: 0.4, scale: 0.8 });

    // data sheets: the ones behind Nokta first
    const poses = W.sheets.map((s) => [s, W.sheetPose(s, t, env)]).filter(([, p]) => p);
    const behind = poses.filter(([, p]) => p.y < gy - 10), front = poses.filter(([, p]) => p.y >= gy - 10);
    behind.forEach(([s, p]) => W.drawSheet(ctx, s, p));

    // answer tokens
    const tp = outCubic(seg(t, 13.3, 14.1));
    const blotG = spring(seg(t, T_HIT, T_HIT + 1.2) * 1.2, 9, 4.5);
    W.token(ctx, 'bird', L.tokBird[0], L.tokBird[1], { p: tp });
    W.token(ctx, 'fish', L.tokFish[0], L.tokFish[1], { p: tp, fill: t > 15.3 && t < T_HIT ? hump(t, 15.3, 16.1) : 0 });

    // presented sheet (the first bird)
    const sp = sheetPresented(t, env);
    const first = LI.Net.model().first;
    if (sp.visible) LI.Sheet.draw(ctx, { sk: first.sk, label: 'bird' }, { x: sp.x, y: sp.y, w: sp.w, h: sp.h, rot: sp.rot, seed: 777, labelP: outCubic(seg(t, 13.0, 13.6)) });

    // Nokta
    LI.Nokta.draw(ctx, LI.Nokta.follow((tt) => pose(tt, env), t), t);

    front.forEach(([s, p]) => W.drawSheet(ctx, s, p));

    // ERROR: an ink blot lands on the wrong answer and cracks
    if (t > T_HIT - 0.12) {
      const [bx, by] = L.tokFish;
      if (t < T_HIT) { const f = seg(t, T_HIT - 0.12, T_HIT); Ink.dot(ctx, bx, lerp(by - 700, by, f * f), 16, { seed: 5, bleed: 0 }); }
      else {
        ctx.save(); ctx.translate(bx, by); ctx.scale(1, 0.72);
        Ink.blob(ctx, 0, 0, 62, { grow: clamp(blotG, 0, 1.25), seed: 41, sat: 9, wobble: 0.05, t });
        Ink.cracks(ctx, 0, 0, 58, { p: outCubic(seg(t, T_HIT + 0.35, T_HIT + 1.3)), seed: 8, n: 7 });
        ctx.restore();
        Ink.drops(ctx, bx, by - 10, t - T_HIT, { n: 12, seed: 17, ground: by + 30, scale: 0.9 });
      }
    }

    // hand (in front of everything)
    LI.Hand.draw(ctx, handPose(t, env), t);

    // the dive completes in black ink (scene 3 opens from it)
    LI.Ambient.iris(ctx, env, seg(t, 19.4, 19.85), { t });
  }

  LI.registerScene({ id: 2, start: 8, end: 20, name: 'Data', nameTr: 'Veri',
    concept: 'Labelled examples · first (wrong) guess', conceptTr: 'Etiketli örnekler · ilk (yanlış) tahmin', render, pose, sheetPresented });
})(window.LI = window.LI || {});
