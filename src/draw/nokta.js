/* ─────────────────────────────────────────────────────────────
   NOKTA — the ink creature.  A reusable procedural character rig.

   A pose is a plain object; every field is optional:
     x, y        ground point between the feet (world units)
     s           scale (1 ≈ 80-unit body radius)
     sq          squash/stretch (1 normal, <1 squashed, >1 stretched)
     lean        body lean (radians, + = to the right)
     crouch      0..1 knee bend (lowers body)
     turn        -1..1 face turn (3/4 view left/right)
     lookX/lookY -1..1 pupil direction
     blink       0..1   eyeOpen 0..1 (birth)   lids 0..1 heavy lids
     eyeScale    pupil/eye size multiplier   squint 0..1 (joy ^ ^)
     brow        -1 worried .. +1 determined/angry
     mouth       -1 frown .. +1 smile ; mouthOpen 0..1
     feet        [[dx,dy],[dx,dy]] foot offsets from x,y (see gait())
     hands       {L:[x,y], R:[x,y]} in body-radius units from body centre
     point       'L'|'R' draws a pointing finger on that hand
     tuft        extra tuft angle (follow-through, see follow())
     born        {body, legs, arms, tuft} growth 0..1 (Scene 1)
     drop        0..1 teardrop-shaped top (birth)
     wobble      0..1 trembling outline
     mind        options for the network drawn inside the head
     hold        'brush' ; glow 0..1 (amber light, Scene 6 ONLY)
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';
  const { noise, rand } = LI.rng;
  const { clamp, lerp, smooth } = LI.E;
  const Ink = LI.Ink;
  const TAU = Math.PI * 2;
  const BASE_R = 80, LEG = 62;

  const DEFAULT = { x: 0, y: 0, s: 1, sq: 1, lean: 0, crouch: 0, turn: 0, lookX: 0, lookY: 0, blink: 0, eyeOpen: 1, lids: 0,
    eyeScale: 1, squint: 0, brow: 0, mouth: 0.15, mouthOpen: 0, tuft: 0, drop: 0, wobble: 0, glow: 0,
    born: { body: 1, legs: 1, arms: 1, tuft: 1 } };

  /** procedural walk cycle from distance travelled → foot offsets + body bob */
  function gait(dist, o = {}) {
    const S = o.stride ?? 70, lift = o.lift ?? 16, dir = Math.sign(o.dir ?? 1) || 1, spread = o.spread ?? 22;
    const phi = dist / S;
    const feet = [0, 1].map((k) => {
      const f = ((phi + k * 0.5) % 1 + 1) % 1;
      let dx, dy;
      if (f < 0.5) { dx = (0.25 - f) * S; dy = 0; }
      else { const u = (f - 0.5) * 2; dx = (-0.25 + u * 0.5) * S; dy = -Math.sin(Math.PI * u) * lift; }
      return [dx * dir + (k ? spread : -spread) * 0.5, dy];
    });
    const bob = -Math.abs(Math.sin(phi * TAU)) * (o.bob ?? 5);
    return { feet, bob, phase: phi };
  }

  /** follow-through: tuft & body lag from motion (pure: samples poseAt at t and t-dt) */
  function follow(poseAt, t) {
    const p = poseAt(t), a = poseAt(t - 0.09), b = poseAt(t - 0.18);
    const vx = (p.x - a.x) / 0.09, vy = (p.y - a.y) / 0.09;
    const ax = ((p.x - a.x) - (a.x - b.x)) / 0.0081;
    const dsq = ((p.sq ?? 1) - (a.sq ?? 1)) / 0.09;
    p.tuft = (p.tuft || 0) - clamp(vx / 900 + ax / 30000, -0.7, 0.7) + clamp(dsq * 0.25, -0.5, 0.5) - clamp(vy / 2000, -0.3, 0.3);
    p.vx = vx;
    return p;
  }

  function bodyPts(R, sx, sy, drop, wobble, t, seed, n = 64) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2;
      let r = 1 + 0.025 * noise(i * 0.7, seed) + wobble * 0.08 * noise(t * 9 + i * 0.9, seed + 3);
      const up = Math.max(0, -Math.sin(a));
      r += drop * 0.55 * Math.pow(up, 8);
      // slightly heavier bottom (ink settles)
      r += 0.04 * Math.max(0, Math.sin(a));
      pts.push([Math.cos(a) * R * sx * r, Math.sin(a) * R * sy * r]);
    }
    return pts;
  }

  function draw(ctx, pose, t) {
    const P = Object.assign({}, DEFAULT, pose);
    P.born = Object.assign({}, DEFAULT.born, pose.born || {});
    const s = P.s, R = BASE_R * s, B = P.born;
    const sy = P.sq, sx = clamp(1 + (1 - P.sq) * 0.85, 0.6, 1.6);
    const legLen = LEG * s * B.legs * (1 - P.crouch * 0.45);
    const bob = P.bob || 0;
    // body centre (before lean)
    const hipY = P.y - legLen + bob * s;
    const cx = P.x, cy = hipY - R * sy * 1.0;
    const seed = 77;

    // ── ground shadow
    ctx.save();
    const sh = ctx.createRadialGradient(P.x, P.y + 4 * s, 0, P.x, P.y + 4 * s, R * 1.1);
    sh.addColorStop(0, `rgba(${LI.INK_RGB},${0.16 * B.body})`); sh.addColorStop(1, `rgba(${LI.INK_RGB},0)`);
    ctx.fillStyle = sh; ctx.scale(1, 1);
    ctx.beginPath(); ctx.ellipse(P.x, P.y + 4 * s, R * 1.1, R * 0.16, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // lean pivot = hip
    const rotAt = (x, y) => { const c = Math.cos(P.lean), sn = Math.sin(P.lean), dx = x - P.x, dy = y - hipY; return [P.x + dx * c - dy * sn, hipY + dx * sn + dy * c]; };

    // ── legs (behind body)
    if (B.legs > 0.01) {
      const feet = P.feet || [[-20 * s, 0], [20 * s, 0]];
      [0, 1].forEach((k) => {
        const hip = rotAt(P.x + (k ? 1 : -1) * R * 0.28 * sx, hipY - 1 * s);
        const foot = [P.x + feet[k][0], P.y + feet[k][1]]; // world-unit offsets
        const mid = [(hip[0] + foot[0]) / 2 + (k ? 1 : -1) * 6 * s + P.crouch * 14 * s * (k ? 1 : -1), (hip[1] + foot[1]) / 2];
        const pts = LI.E.quadPts(hip, mid, foot, 10);
        Ink.path(ctx, pts, { w: 4.2 * s, p: B.legs, seed: 10 + k, taper: [0.02, 0.1], wob: 0.2, minW: 0.6 });
        if (B.legs > 0.85) {
          const dir = P.turn >= 0 ? 1 : -1;
          Ink.dot(ctx, foot[0] + dir * 6 * s, foot[1] - 2 * s, 7 * s * smooth((B.legs - 0.85) / 0.15), { seed: 20 + k, bleed: 0.4, irregular: 0.25 });
        }
      });
    }

    ctx.save();
    ctx.translate(P.x, hipY); ctx.rotate(P.lean); ctx.translate(-P.x, -hipY);
    ctx.translate(cx, cy);

    const outline = bodyPts(R, sx, sy, P.drop, P.wobble, t, seed);
    const bodyScale = B.body;
    ctx.save();
    ctx.scale(bodyScale, bodyScale);

    // ── translucent body: pale wash + settled ink at the bottom
    ctx.save();
    ctx.beginPath(); outline.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = `rgba(${LI.PAPER_RGB},0.55)`; ctx.fill();
    ctx.fillStyle = `rgba(${LI.INK_RGB},0.06)`; ctx.fill();
    const sg = ctx.createLinearGradient(0, R * sy * 0.05, 0, R * sy * 1.05);
    sg.addColorStop(0, `rgba(${LI.INK_RGB},0)`); sg.addColorStop(0.65, `rgba(${LI.INK_RGB},0.2)`); sg.addColorStop(1, `rgba(${LI.INK_RGB},0.55)`);
    ctx.fillStyle = sg; ctx.fill();
    // ── the mind: network visible inside the head
    if (P.mind && LI.NetDraw) { ctx.clip(); LI.NetDraw.mind(ctx, 0, -R * sy * 0.12, R * 0.78, P.mind, t); }
    ctx.restore();

    // ── ensō outline
    const loop = outline.concat([outline[0], outline[1], outline[2]]);
    Ink.path(ctx, loop, { w: 7 * s, seed: 5, taper: [0.03, 0.18], wob: 0.35, dry: 0.7, bleed: 0.6, minW: 0.25 });

    // ── face
    const eyeA = P.eyeOpen;
    if (eyeA > 0 || P.born.body > 0.9) {
      const turn = clamp(P.turn, -1, 1);
      const fx = turn * R * 0.3 * sx;
      const eyeY = -R * sy * 0.14;
      const re = R * 0.26;
      [-1, 1].forEach((side) => {
        const far = side * turn < 0 ? Math.abs(turn) : 0;
        const ex = fx + side * R * 0.34 * sx * (1 - 0.3 * Math.abs(turn));
        const rx = re * (1 - 0.35 * far) * (P.eyeScale), ry = re * 1.12 * P.eyeScale * (0.85 + 0.15 * sy);
        const lid = clamp(Math.max(P.blink, 1 - eyeA) + P.lids * 0.35, 0, 1);
        if (P.squint > 0.5) {
          // joyful closed eyes ^ ^
          Ink.path(ctx, LI.E.quadPts([ex - rx * 0.8, eyeY + ry * 0.15], [ex, eyeY - ry * 0.75], [ex + rx * 0.8, eyeY + ry * 0.15], 8), { w: 4.2 * s, seed: 30 + side, taper: [0.2, 0.3] });
        } else if (lid > 0.9) {
          Ink.path(ctx, LI.E.quadPts([ex - rx * 0.85, eyeY], [ex, eyeY + ry * 0.35], [ex + rx * 0.85, eyeY], 8), { w: 3.6 * s, seed: 30 + side, taper: [0.2, 0.3] });
        } else {
          ctx.save();
          ctx.beginPath(); ctx.ellipse(ex, eyeY, rx, ry, 0, 0, TAU);
          ctx.fillStyle = LI.PAPER; ctx.fill();
          ctx.clip();
          const px = ex + P.lookX * rx * 0.45 + turn * rx * 0.15, py = eyeY + P.lookY * ry * 0.42;
          const pr = re * 0.52 * (1 - 0.2 * far);
          Ink.dot(ctx, px, py, pr, { seed: 40 + side, bleed: 0.3, irregular: 0.06 });
          ctx.fillStyle = LI.PAPER; ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.28, 0, TAU); ctx.fill();
          let lidEdge = null;
          if (lid > 0.01) {
            // eyelid = body tone (translucent ink wash), with an ink edge line
            const ly = eyeY - ry + lid * ry * 2;
            ctx.beginPath(); ctx.moveTo(ex - rx - 2, eyeY - ry - 2); ctx.lineTo(ex + rx + 2, eyeY - ry - 2);
            ctx.lineTo(ex + rx + 2, ly - ry * 0.1); ctx.quadraticCurveTo(ex, ly + ry * 0.25, ex - rx - 2, ly - ry * 0.1); ctx.closePath();
            ctx.fillStyle = `rgb(${LI.PAPER_RGB})`; ctx.fill();
            ctx.fillStyle = `rgba(${LI.INK_RGB},0.16)`; ctx.fill();
            lidEdge = LI.E.quadPts([ex - rx, ly - ry * 0.1], [ex, ly + ry * 0.2], [ex + rx, ly - ry * 0.1], 8);
          }
          ctx.restore();
          if (lidEdge) Ink.path(ctx, lidEdge, { w: 3 * s, seed: 35 + side, taper: [0.2, 0.2] });
          Ink.ring(ctx, ex, eyeY, rx, { sy: ry / rx, w: 2.6 * s, seed: 50 + side, gap: 0.08, taper: [0.1, 0.4] });
        }
        // brows
        if (Math.abs(P.brow) > 0.05) {
          const by = eyeY - ry - 9 * s, inner = -side; // inner end is toward the face centre
          const tilt = P.brow * 0.45;
          const a = [ex - rx * 0.7, by + (inner < 0 ? tilt : -tilt) * rx * 0.6];
          const b = [ex + rx * 0.7, by + (inner > 0 ? tilt : -tilt) * rx * 0.6];
          Ink.line(ctx, a, b, { w: 3.6 * s * Math.min(1, Math.abs(P.brow) * 2), seed: 60 + side, taper: [0.3, 0.4] });
        }
      });
      // mouth
      const my = R * sy * 0.3, mw = R * 0.2 * (1 + P.mouthOpen * 0.2);
      if (P.mouthOpen > 0.05) {
        Ink.dot(ctx, fx, my + 4 * s, (5 + 9 * P.mouthOpen) * s, { seed: 71, bleed: 0.2, irregular: 0.15 });
      } else {
        Ink.path(ctx, LI.E.quadPts([fx - mw, my - P.mouth * 4 * s], [fx, my + P.mouth * R * 0.16], [fx + mw, my - P.mouth * 4 * s], 8), { w: 3 * s, seed: 70, taper: [0.25, 0.25] });
      }
    }
    ctx.restore(); // bodyScale

    // ── tuft (follow-through): one long curling flick + two short ones
    if (B.tuft > 0.01) {
      const top = [0, -R * sy * (1 + P.drop * 0.5) * bodyScale + 2 * s];
      const spec = [[0.0, 0.5, 1.0], [-0.55, 0.28, -0.9], [0.5, 0.24, 0.7]];
      spec.forEach(([da, len, curl], k) => {
        const ang = -Math.PI / 2 + da + P.tuft * (1 + k * 0.3) + noise(t * 0.8 + k, 90 + k) * 0.06;
        const L = R * len * B.tuft;
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const f = i / 8, a = ang + curl * f * f * (1 + P.tuft * 0.8);
          const prev = pts.length ? pts[pts.length - 1] : top;
          pts.push(i ? [prev[0] + Math.cos(a) * L / 8, prev[1] + Math.sin(a) * L / 8] : top);
        }
        Ink.path(ctx, pts, { w: (k ? 2.6 : 3.8) * s, seed: 95 + k, taper: [0.1, 0.85], p: B.tuft, wob: 0.2 });
      });
    }

    // ── arms & hands
    if (B.arms > 0.01) {
      const H = Object.assign({ L: [-1.22, 0.55], R: [1.22, 0.55] }, P.hands || {});
      ['L', 'R'].forEach((k, idx) => {
        const side = idx ? 1 : -1;
        const sh0 = [side * R * 0.86 * sx, R * 0.08 * sy];
        const hd = [H[k][0] * R, H[k][1] * R];
        const mid = [(sh0[0] + hd[0]) / 2 + side * R * 0.12, (sh0[1] + hd[1]) / 2 + R * 0.14];
        Ink.path(ctx, LI.E.quadPts(sh0, mid, hd, 10), { w: 3.6 * s, p: B.arms, seed: 110 + idx, taper: [0.05, 0.15], minW: 0.55 });
        if (B.arms > 0.9) {
          Ink.dot(ctx, hd[0], hd[1], 6.5 * s, { seed: 120 + idx, bleed: 0.3, irregular: 0.2 });
          if (P.point === k) {
            const d = Math.atan2(hd[1] - mid[1], hd[0] - mid[0]);
            Ink.line(ctx, hd, [hd[0] + Math.cos(d) * 17 * s, hd[1] + Math.sin(d) * 17 * s], { w: 3.4 * s, seed: 125, taper: [0.1, 0.6] });
          }
          if (P.hold === 'brush' && k === 'R') drawBrush(ctx, hd, P.brushAng ?? -0.9, s, t);
          if (P.glow > 0 && k === 'R') glow(ctx, hd[0], hd[1] - 4 * s, P.glow, s, t);
        }
      });
    }
    ctx.restore();
    return { cx, cy, R, hipY, eyes: eyeWorld(P, cx, cy, R, sx, sy, hipY) };
  }

  function eyeWorld(P, cx, cy, R, sx, sy, hipY) {
    const turn = clamp(P.turn, -1, 1), fx = turn * R * 0.3 * sx, eyeY = -R * sy * 0.14;
    const c = Math.cos(P.lean), sn = Math.sin(P.lean);
    return [-1, 1].map((side) => {
      const lx = cx + fx + side * R * 0.34 * sx * (1 - 0.3 * Math.abs(turn)), ly = cy + eyeY;
      const dx = lx - P.x, dy = ly - hipY;
      return [P.x + dx * c - dy * sn, hipY + dx * sn + dy * c];
    });
  }

  function drawBrush(ctx, hd, ang, s, t) {
    const L = 70 * s;
    const tip = [hd[0] + Math.cos(ang) * L * 0.45, hd[1] + Math.sin(ang) * L * 0.45];
    const back = [hd[0] - Math.cos(ang) * L * 0.55, hd[1] - Math.sin(ang) * L * 0.55];
    Ink.line(ctx, back, tip, { w: 4.5 * s, seed: 130, taper: [0.02, 0.02], minW: 0.8, bow: 0.01 });
    const tip2 = [tip[0] + Math.cos(ang) * 16 * s, tip[1] + Math.sin(ang) * 16 * s];
    Ink.path(ctx, [tip, tip2], { w: 9 * s, seed: 131, taper: [0.05, 0.95] });
  }

  /** the amber light — the one and only colour in the film (Scene 6) */
  function glow(ctx, x, y, a, s, t) {
    const r = (26 + 4 * Math.sin(t * 5)) * s * (0.6 + 0.4 * a);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    g.addColorStop(0, `rgba(${LI.AMBER_RGB},${0.95 * a})`);
    g.addColorStop(0.3, `rgba(${LI.AMBER_RGB},${0.55 * a})`);
    g.addColorStop(1, `rgba(${LI.AMBER_RGB},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,244,220,${0.9 * a})`; ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, TAU); ctx.fill();
  }

  /** eye positions (world) for a pose, without drawing — used to aim cameras */
  function eyes(pose) {
    const P = Object.assign({}, DEFAULT, pose); P.born = Object.assign({}, DEFAULT.born, pose.born || {});
    const s = P.s, R = BASE_R * s, sy = P.sq, sx = clamp(1 + (1 - P.sq) * 0.85, 0.6, 1.6);
    const hipY = P.y - LEG * s * P.born.legs * (1 - P.crouch * 0.45) + (P.bob || 0) * s;
    return eyeWorld(P, P.x, hipY - R * sy, R, sx, sy, hipY);
  }

  LI.Nokta = { draw, eyes, gait, follow, glow, BASE_R, LEG, DEFAULT };
})(window.LI = window.LI || {});
