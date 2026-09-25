/* SCENE 1 — A BLANK MIND (0–8 s)
   A droplet falls, splashes, gathers itself and grows into Nokta.
   Inside its translucent head: a tangled web = a network with random weights. */
(function (LI) {
  'use strict';
  const { seg, clamp, lerp, track, spring, outBack, inCubic, outCubic, inOut, hump } = LI.E;
  const { noise } = LI.rng;
  const Ink = LI.Ink;

  const GY = (env) => (env.V ? 240 : 170);   // ground line
  const DROP_T = 0.5, HIT_T = 1.45;

  /** Nokta's pose as a pure function of local time */
  function pose(t, env) {
    const gy = GY(env);
    const grow = outCubic(seg(t, 1.7, 2.7));
    const p = {
      x: LI.World.L(env).nokta, y: gy, s: 1,
      born: { body: lerp(0.28, 1, grow), legs: outCubic(seg(t, 2.6, 3.3)), arms: outCubic(seg(t, 3.05, 3.6)), tuft: outBack(seg(t, 3.3, 3.8)) },
      sq: 1, drop: lerp(0.9, 0, outCubic(seg(t, 1.8, 2.9))), wobble: 1 - seg(t, 1.6, 3.2),
      eyeOpen: outCubic(seg(t, 4.95, 5.35)), mouth: 0.1,
      mind: { morph: 0, alpha: 0.42 * seg(t, 3.2, 4.6), q: 0 },
    };
    // body gathers from the puddle with a spring
    if (t < 3.4) p.sq = lerp(0.35, 1, clamp(spring(seg(t, 1.6, 3.4) * 2.2, 8, 3.2), 0, 1.3));
    // anticipation before eyes open → stretch → settle
    if (t > 4.4) p.sq = 1 - 0.1 * hump(t, 4.4, 5.0) + 0.09 * hump(t, 4.95, 5.5);
    // arms: hanging, then a small curious lift
    p.hands = { L: [-1.2, 0.6], R: [1.2, 0.6] };
    if (t > 5.3) { const k = hump(t, 5.4, 7.6); p.hands = { L: [-1.28 + 0.1 * k, 0.5 - 0.25 * k], R: [1.22, 0.6] }; }
    // looking around
    p.lookX = track([[5.3, 0], [5.7, -1], [6.3, -1], [6.7, 1], [7.3, 1], [7.7, 0]], t);
    p.lookY = track([[5.3, -0.2], [5.7, 0.1], [6.3, 0.1], [6.7, -0.3], [7.3, -0.3], [7.7, 0.25]], t);
    p.turn = track([[5.4, 0], [5.8, -0.45], [6.3, -0.45], [6.8, 0.45], [7.3, 0.45], [7.8, 0]], t);
    p.lean = track([[5.4, 0], [5.8, -0.06], [6.3, -0.06], [6.8, 0.07], [7.3, 0.05], [7.8, 0]], t);
    p.blink = hump(t, 6.38, 6.58) + hump(t, 7.8, 7.98);
    p.brow = -0.25 * hump(t, 5.4, 7.9);
    p.mouthOpen = 0.35 * hump(t, 5.35, 6.0);
    p.mouth = t > 7.4 ? 0.35 * seg(t, 7.4, 7.9) : 0.05;
    return p;
  }

  function camera(t, env) {
    const V = env.V, NX = LI.World.L(env).nokta;
    const cam = LI.Camera.track([
      [0, { x: NX, y: V ? 40 : 10, zoom: 1 }],
      [3.2, { x: NX, y: V ? 40 : 10, zoom: 1 }],
      [8, { x: NX, y: V ? 20 : -10, zoom: V ? 1.62 : 1.48 }, inOut],
    ], t);
    return LI.Camera.breathe(cam, t, 0.6);
  }

  function render(ctx, t, env) {
    const cam = camera(t, env), gy = GY(env);
    LI.Ambient.specks(ctx, env, cam, t, { alpha: 0.28 * seg(t, 2, 5), n: 22, depth: 0.4, seed: 11 });
    LI.Camera.apply(ctx, env, cam);

    // ground stroke spreads out from the splash
    LI.Ambient.ground(ctx, -1000 + LI.World.L(env).nokta, 1000 + LI.World.L(env).nokta, gy + 6, { p: outCubic(seg(t, HIT_T, 3.4)), alpha: 0.35 });

    // the falling droplet
    if (t >= DROP_T && t < HIT_T) {
      const f = seg(t, DROP_T, HIT_T), y = lerp(-560, gy - 16, f * f);
      const v = f; // stretches as it accelerates
      const pts = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2 - Math.PI / 2;
        const up = Math.max(0, -Math.sin(a));
        const r = 16 * (1 + 1.6 * v * Math.pow(up, 3));
        pts.push([LI.World.L(env).nokta + Math.cos(a) * 16 * (1 - 0.2 * v), y + Math.sin(a) * r]);
      }
      ctx.fillStyle = LI.INK; Ink.fillSmooth(ctx, pts);
    }
    // splash
    if (t >= HIT_T) {
      const age = t - HIT_T;
      Ink.drops(ctx, LI.World.L(env).nokta, gy - 4, age, { n: 12, seed: 3, ground: gy + 4, alpha: 1 - seg(t, 5, 7.5) * 0.6, scale: 0.8 });
      // puddle flash before gathering
      const pud = 1 - seg(t, HIT_T + 0.05, 1.95);
      if (pud > 0) { ctx.save(); ctx.translate(LI.World.L(env).nokta, gy - 2); ctx.scale(1, 0.22); Ink.blob(ctx, 0, 0, 55 * (0.6 + 0.4 * outCubic(seg(age, 0, 0.12))), { seed: 9, sat: 0, alpha: pud }); ctx.restore(); }
    }
    // Nokta
    if (t >= 1.62) LI.Nokta.draw(ctx, LI.Nokta.follow((tt) => pose(tt, env), t), t);
  }

  LI.registerScene({ id: 1, start: 0, end: 8, name: 'A Blank Mind', nameTr: 'Boş Bir Zihin',
    concept: 'Untrained network: random weights', conceptTr: 'Eğitilmemiş ağ: rastgele ağırlıklar', render, pose });
})(window.LI = window.LI || {});
