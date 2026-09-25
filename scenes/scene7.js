/* SCENE 7 — LIMITS & ENDING (80–90 s)
   A strange abstract drawing, unlike anything in the data. The real network
   calls it "bird" with high confidence — a tiny crack: confidently wrong
   outside its data. Nokta looks up at the human hand; a quiet beat.
   Slow pull-back: everything becomes one small ink drawing on the paper. */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, spring, outBack, outCubic, inCubic, inOut, hump, smooth } = LI.E;
  const { noise } = LI.rng;
  const Ink = LI.Ink, W = LI.World;

  function handPose(t, env) {
    const c = LI.Outdoor.carry(t, env, 80.0, 81.2, 81.2, 99);
    const L = W.L(env);
    // after placing: the hand lifts a little, opens, and hovers facing Nokta
    const up = inOut(seg(t, 81.4, 82.4)), face = inOut(seg(t, 83.3, 84.8));
    const hover = env.V ? [L.nokta + 90, -300] : [L.nokta + 70, -330];
    let x = lerp(c.hand.x, c.hand.x + 60, up), y = lerp(c.hand.y, c.hand.y - 170, up);
    x = lerp(x, hover[0], face); y = lerp(y, hover[1], face) + noise(t * 0.7, 3) * 6;
    return { x, y, rot: lerp(c.hand.rot, env.V ? 0.5 : 0.75, face), s: c.hand.s, pinch: c.hand.pinch * (1 - up), point: 0.35 * face, curl: lerp(0.2, 0.05, face), alpha: 1 };
  }

  function pose(t, env) {
    const L = W.L(env), gy = W.GY(env), m = LI.Net.model();
    const p = { x: L.nokta, y: gy, s: 1, mouth: 0.4, turn: 0.35, lookX: 0.7, lookY: -0.3, mind: { morph: 1, alpha: 0.45, q: 1 } };
    // puts the brush down (continuity from Scene 6)
    if (t < 80.5) { const k = inOut(seg(t, 80.0, 80.5)); p.hold = t < 80.35 ? 'brush' : null; p.brushAng = -0.95 + 0.9 * k; p.hands = { L: [-1.3, lerp(-0.3, 0.55, k)], R: [lerp(1.45, 1.2, k), lerp(-0.2, 0.55, k)] }; p.mouth = lerp(1, 0.4, k); }
    // glances at the new sheet, thinks quickly
    const study = seg(t, 80.8, 81.1) * (1 - seg(t, 81.9, 82.1));
    p.lookX = lerp(p.lookX, 0.95, study); p.lookY = lerp(p.lookY, -0.1, study); p.lids = 0.2 * study;
    if (t > 81.0 && t < 82.2) p.mind = { morph: 1, alpha: 0.6, q: 1, input: m.ood.x, fwd: 3 * inOut(seg(t, 81.0, 81.9)) };
    // CONFIDENT: "bird!" — points at the bird token, chest out
    const conf = seg(t, 81.95, 82.2) * (1 - seg(t, 83.1, 83.4));
    if (conf > 0) {
      p.sq = 1 + 0.07 * conf; p.lean = -0.06 * conf; p.brow = 0.55 * conf; p.mouth = lerp(0.4, 1, conf);
      p.turn = lerp(p.turn, -0.35, conf); p.lookX = lerp(p.lookX, -0.8, conf); p.lookY = lerp(p.lookY, 0.8, conf);
      p.hands = { L: [lerp(-1.22, -1.6, conf), lerp(0.55, 0.9, conf)], R: [1.2, lerp(0.55, 0.2, conf)] };
      if (conf > 0.5) p.point = 'L';
    }
    // …a tiny crack. Doubt.
    const doubt = seg(t, 82.9, 83.4);
    if (doubt > 0) {
      p.sq = lerp(p.sq || 1, 0.95, doubt); p.brow = lerp(p.brow || 0, -0.55, doubt); p.mouth = lerp(p.mouth, -0.2, doubt);
      p.lookX = lerp(p.lookX, -0.6, doubt); p.lookY = lerp(p.lookY, 1, doubt); p.turn = lerp(p.turn, -0.3, doubt); p.tuft = 0.4 * doubt;
    }
    // looks up at the human hand — a quiet beat, face to face
    const up = seg(t, 83.7, 84.4);
    if (up > 0) {
      p.lookX = lerp(p.lookX, 0.35, up); p.lookY = lerp(p.lookY, -1, up); p.turn = lerp(p.turn, 0.15, up);
      p.lean = lerp(p.lean || 0, -0.1, up); p.brow = lerp(p.brow, -0.15, up); p.mouth = lerp(p.mouth, 0.1, up); p.tuft = lerp(p.tuft || 0, 0, up);
      p.hands = { L: [-1.2, 0.55], R: [lerp(1.2, 1.3, up), lerp(0.55, 0.1, up)] };
      p.sq = 1 + 0.03 * hump(t, 85.6, 86.3); // a small nod
      p.mouth = lerp(p.mouth, 0.35, seg(t, 85.6, 86.2));
    }
    p.blink = Math.max(hump(t, 84.9, 85.05), hump(t, 87.2, 87.35));
    return p;
  }

  function camera(t, env) {
    const V = env.V;
    const scene = { x: V ? 20 : 170, y: V ? 20 : 10, zoom: V ? 1.08 : 1.18 };
    const beat = { x: V ? 90 : 170, y: V ? -210 : -110, zoom: V ? 1.12 : 1.22 };
    const far = { x: 0, y: V ? 0 : 0, zoom: 0.075 };
    return LI.Camera.breathe(LI.Camera.track([
      [80, scene], [82.2, Object.assign({}, scene, { zoom: scene.zoom * 1.05 })], [83.4, Object.assign({}, scene, { zoom: scene.zoom * 1.08 })],
      [84.8, beat, inOut], [85.8, beat],
      [89.0, far, (x) => inOut(x)],
    ], t), t, 0.5 * (1 - seg(t, 86, 88)));
  }

  function render(ctx, lt, env, t) {
    const cam = camera(t, env);
    const L = W.L(env), m = LI.Net.model();
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.28 * (1 - seg(t, 86, 87.5)), n: 22, depth: 0.4, seed: 11 });
    LI.Camera.apply(ctx, env, cam);

    // ── memories on the same paper, revealed by the pull-back
    const reveal = seg(t, 86.2, 87.4);
    if (reveal > 0) {
      ctx.globalAlpha = reveal;
      const V = env.V;
      LI.NetDraw.draw(ctx, { V, morph: 1, q: 1, cx: V ? 0 : -2900, cy: V ? -2900 : -200, scale: 1.3, labels: true }, t);
      ctx.save(); ctx.translate(V ? 0 : 2900, V ? 2700 : 150); ctx.scale(1.25, 1.25); LI.Land.draw(ctx, env, { alpha: 1, depth: 330 }); ctx.restore();
      ctx.globalAlpha = 1;
    }

    const birdFill = seg(t, 81.9, 82.2);
    LI.Outdoor.outdoor(ctx, env, 99, { birdFill });
    // Nokta's own bird stays on the paper
    const sk = LI.Outdoor.DRAW_SK(), [dx, dy, k] = LI.Outdoor.drawArea(env);
    sk.strokes.forEach((s, i) => Ink.path(ctx, s.map(([a, b]) => [dx + a * k, dy + b * k]), { w: 4.4, seed: 950 + i, taper: [0.15, 0.35], bleed: 0.4, dry: 0.3 }));

    // the strange drawing
    const c = LI.Outdoor.carry(t, env, 80.0, 81.2, 81.2, 99);
    LI.Sheet.draw(ctx, { sk: null, label: null }, { x: c.sheet.x, y: c.sheet.y, w: c.sheet.w, h: c.sheet.h, rot: c.sheet.rot, seed: 1201, abstract: m.ood.sk });

    // a tiny crack in the confident answer
    const cr = outCubic(seg(t, 82.8, 83.5));
    if (cr > 0) {
      ctx.save(); ctx.translate(L.tokBird[0], L.tokBird[1] - 2); ctx.scale(1, 0.62);
      Ink.path(ctx, [[-4, -52], [4, -30], [-6, -14], [6, 4], [0, 16]], { w: 3.2, p: cr, seed: 3, taper: [0.05, 0.9], color: LI.INK_RGB });
      Ink.path(ctx, [[4, -30], [18, -22]], { w: 2.2, p: seg(cr, 0.5, 1), seed: 4, taper: [0.05, 0.9] });
      ctx.restore();
      Ink.drops(ctx, L.tokBird[0] + 4, L.tokBird[1] - 30, t - 82.85, { n: 3, seed: 91, scale: 0.35, ground: L.tokBird[1] });
    }

    LI.Nokta.draw(ctx, LI.Nokta.follow((tt) => pose(tt, env), t), t);
    LI.Hand.draw(ctx, handPose(t, env), t);
  }

  LI.registerScene({ id: 7, start: 80, end: 90, name: 'Limits', nameTr: 'Sınırlar',
    concept: 'Out-of-distribution: confidently wrong · human in the loop', conceptTr: 'Veri dışı örnek: emin ama yanlış · döngüde insan', render });
})(window.LI = window.LI || {});
