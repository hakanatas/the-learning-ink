/* ─────────────────────────────────────────────────────────────
   Procedural data set: bird & fish sketches.
   Each sketch is a list of polylines in unit space [-1,1]².
   The SAME geometry is (a) drawn on the paper sheets with the ink brush
   and (b) rasterised to a 7×7 "pixel" grid that feeds the real neural
   network in mlp.js. What Nokta sees is literally what the network sees.
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';
  const { gen } = LI.rng;
  const { smoothPath } = LI.E;
  const N = 7; // input grid is N×N

  function ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2, n = 22) {
    const out = [], c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n), x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  const S = (pts, per = 5) => smoothPath(pts, per);

  const BIRD = {
    flying(R) {
      const lift = R.range(-0.15, 0.2), span = R.range(0.75, 0.95), dip = R.range(0.35, 0.65);
      const L = S([[-span, -0.2 + lift], [-span * 0.55, -dip], [-0.12, -0.12], [0, 0.02]]);
      const Rw = S([[0, 0.02], [0.12, -0.12], [span * 0.55, -dip + R.range(-0.08, 0.08)], [span, -0.2 + lift + R.range(-0.1, 0.1)]]);
      const body = ellipse(0, 0.1, R.range(0.12, 0.2), 0.08, R.range(-0.2, 0.2));
      const tail = S([[-0.05, 0.16], [0, 0.34], [0.07, 0.16]], 3);
      return [L, Rw, body, tail];
    },
    perched(R) {
      const bx = R.range(-0.12, 0.02), by = R.range(0, 0.12), rx = R.range(0.36, 0.46), ry = R.range(0.25, 0.33);
      const hx = bx + rx * 0.9, hy = by - ry * 1.05, hr = R.range(0.14, 0.19);
      const body = ellipse(bx, by, rx, ry, R.range(-0.25, 0.05));
      const head = ellipse(hx, hy, hr, hr);
      const bl = R.range(0.14, 0.26);
      const beak = [[hx + hr * 0.9, hy - 0.05], [hx + hr + bl, hy + 0.01], [hx + hr * 0.9, hy + 0.06]];
      const tail = S([[bx - rx * 0.9, by - 0.02], [bx - rx - 0.3, by - 0.22 - R.range(0, 0.15)], [bx - rx - 0.22, by + 0.02], [bx - rx * 0.85, by + 0.1]], 3);
      const wing = S([[bx - rx * 0.6, by - 0.02], [bx, by - ry * 0.5], [bx + rx * 0.4, by + 0.05], [bx - rx * 0.2, by + ry * 0.4]], 4);
      const ly = by + ry, gy = Math.min(0.85, ly + 0.28);
      const legs = [[[bx - 0.05, ly - 0.02], [bx - 0.07, gy]], [[bx + 0.08, ly - 0.02], [bx + 0.09, gy]]];
      const perch = [[bx - 0.5, gy + 0.01], [bx + 0.55, gy - 0.02]];
      return [body, head, beak, tail, wing, ...legs, perch];
    },
    gull(R) {
      const h = R.range(0.3, 0.5), s = R.range(0.7, 0.92);
      return [S([[-s, 0.05], [-s * 0.5, -h], [-0.06, -0.02], [0, 0.08]], 6), S([[0, 0.08], [0.06, -0.02], [s * 0.5, -h + R.range(-0.08, 0.08)], [s, 0.05 + R.range(-0.1, 0.1)]], 6)];
    },
    // ↓ never used for training: the "unusual bird" of Scene 6
    heron(R) {
      const bx = R.range(-0.1, 0.05), by = R.range(-0.08, 0.02);
      const body = ellipse(bx, by, 0.34, 0.2, -0.35);
      const neck = S([[bx + 0.25, by - 0.14], [bx + 0.18, by - 0.45], [bx + 0.38, by - 0.6], [bx + 0.3, by - 0.78]], 5);
      const head = ellipse(bx + 0.3, by - 0.82, 0.09, 0.07);
      const beak = [[bx + 0.38, by - 0.84], [bx + 0.72, by - 0.78]];
      const tail = [[bx - 0.3, by + 0.06], [bx - 0.62, by + 0.2]];
      const legs = [[[bx, by + 0.18], [bx - 0.04, 0.9]], [[bx + 0.08, by + 0.17], [bx + 0.18, 0.62], [bx + 0.1, 0.9]]];
      return [body, neck, head, beak, tail, ...legs];
    },
    dive(R) {
      const k = R.range(0.55, 0.85);
      const L = S([[-0.2, -0.85], [-0.55, -0.35 * k], [-0.12, 0.05], [0, 0.2]], 5);
      const Rw = S([[0, 0.2], [0.12, 0.05], [0.6, -0.4 * k], [0.25, -0.88]], 5);
      const body = ellipse(0, 0.35, 0.09, 0.22, 0.05);
      const head = ellipse(0.02, 0.62, 0.08, 0.08);
      return [L, Rw, body, head];
    },
  };

  const FISH = {
    classic(R) {
      const len = R.range(0.55, 0.7), h = R.range(0.3, 0.44), tx = -len * 0.72;
      const top = S([[len, 0], [len * 0.3, -h], [-len * 0.3, -h * 0.75], [tx, 0]], 5);
      const bot = S([[len, 0], [len * 0.3, h], [-len * 0.3, h * 0.75], [tx, 0]], 5);
      const tw = R.range(0.22, 0.34);
      const tail = [[tx, 0], [tx - 0.3, -tw], [tx - 0.24, 0], [tx - 0.3, tw], [tx, 0]];
      const eye = ellipse(len * 0.58, -h * 0.18, 0.045, 0.045, 0, 0, Math.PI * 2, 8);
      const fin = S([[0, -h * 0.95], [-0.12, -h - 0.18], [-0.26, -h * 0.8]], 3);
      const gill = S([[len * 0.35, -h * 0.5], [len * 0.28, 0], [len * 0.35, h * 0.5]], 3);
      return [top, bot, tail, eye, fin, gill];
    },
    long(R) {
      const len = R.range(0.72, 0.85), h = R.range(0.14, 0.22), wav = R.range(-0.08, 0.08);
      const top = S([[len, 0], [len * 0.4, -h + wav], [-len * 0.4, -h * 0.7 - wav], [-len * 0.8, 0]], 6);
      const bot = S([[len, 0], [len * 0.4, h + wav], [-len * 0.4, h * 0.7 - wav], [-len * 0.8, 0]], 6);
      const tail = [[-len * 0.8, 0], [-len - 0.1, -0.16], [-len - 0.1, 0.16], [-len * 0.8, 0]];
      const eye = ellipse(len * 0.72, -h * 0.25, 0.035, 0.035, 0, 0, Math.PI * 2, 8);
      const fin = [[-0.1, h * 0.8], [-0.22, h + 0.14], [-0.3, h * 0.7]];
      return [top, bot, tail, eye, fin];
    },
    round(R) {
      const r = R.range(0.34, 0.44);
      const body = ellipse(0.08, 0, r * 1.1, r);
      const tx = 0.08 - r * 1.1;
      const tail = [[tx, 0], [tx - 0.3, -0.24], [tx - 0.26, 0.24], [tx, 0]];
      const eye = ellipse(0.08 + r * 0.55, -r * 0.2, 0.05, 0.05, 0, 0, Math.PI * 2, 8);
      const fin1 = S([[0.05, -r], [0, -r - 0.2], [-0.15, -r * 0.9]], 3);
      const fin2 = S([[0.05, r], [0, r + 0.18], [-0.15, r * 0.9]], 3);
      const stripe = S([[0.1, -r * 0.9], [0.02, 0], [0.1, r * 0.9]], 3);
      return [body, tail, eye, fin1, fin2, stripe];
    },
  };

  const ABSTRACT = {
    shape(R) {
      const out = [];
      // a zigzag crown + loop — no bird or fish anywhere in the data looks like this
      const zig = [];
      const n = R.int(4, 6);
      for (let i = 0; i <= n; i++) zig.push([-0.8 + (1.6 * i) / n, (i % 2 ? -0.55 : -0.1) + R.range(-0.1, 0.1)]);
      out.push(zig);
      const sp = [];
      for (let i = 0; i < 40; i++) { const a = i * 0.42, r = 0.05 + i * 0.011; sp.push([R.range(-0.05, 0.05) * 0 + Math.cos(a) * r + 0.1, 0.35 + Math.sin(a) * r * 0.8]); }
      out.push(sp);
      out.push([[-0.75, 0.3], [-0.4, 0.75], [-0.2, 0.2]]);
      return out;
    },
  };

  const VARIANTS = { bird: ['flying', 'perched', 'gull'], fish: ['classic', 'long', 'round'] };
  const STYLES = ['brush', 'fine', 'bold', 'scribble', 'dry'];

  /** make(kind, seed, opts) → { kind, variant, style, strokes, seed } */
  function make(kind, seed, opts = {}) {
    const R = gen(kind + ':' + seed);
    const variant = opts.variant || R.pick(VARIANTS[kind] || ['shape']);
    const lib = kind === 'bird' ? BIRD : kind === 'fish' ? FISH : ABSTRACT;
    let strokes = lib[variant](R);
    const rot = opts.rot ?? R.range(-0.3, 0.3) * (kind === 'fish' ? 0.8 : 1);
    const sc = opts.scale ?? R.range(0.72, 0.98);
    const flip = opts.flip ?? (R() < 0.5 ? -1 : 1);
    const ox = R.range(-0.08, 0.08), oy = R.range(-0.08, 0.08);
    const c = Math.cos(rot), s = Math.sin(rot);
    strokes = strokes.map((st) => st.map(([x, y]) => {
      x *= flip;
      const X = (x * c - y * s) * sc + ox, Y = (x * s + y * c) * sc + oy;
      return [X + (R() - 0.5) * 0.015, Y + (R() - 0.5) * 0.015];
    }));
    return { kind, variant, style: opts.style || R.pick(STYLES), strokes, seed, flip };
  }

  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - a[0]) * dx + (py - a[1]) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }
  /** rasterise to N×N ink coverage in [0,1] (pure math → identical on every machine) */
  function raster(sk) {
    const out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const cx = -1 + (2 * (i + 0.5)) / N, cy = -1 + (2 * (j + 0.5)) / N;
      let d = 9;
      for (const st of sk.strokes) for (let k = 1; k < st.length; k++) { const q = segDist(cx, cy, st[k - 1], st[k]); if (q < d) d = q; }
      out[j * N + i] = Math.max(0, Math.min(1, 1 - Math.max(0, d - 0.05) / 0.2));
    }
    return out;
  }

  // label glyphs (the corner symbols humans add): a bird "m" and a fish "><>"
  const GLYPH = {
    bird: [S([[-0.9, 0.1], [-0.45, -0.45], [-0.05, 0.05]], 6), S([[-0.05, 0.05], [0.4, -0.45], [0.9, 0.1]], 6)],
    fish: [S([[0.8, 0], [0.2, -0.45], [-0.45, 0.05], [-0.8, 0.4]], 6), S([[0.8, 0], [0.2, 0.45], [-0.45, -0.05], [-0.8, -0.4]], 6)],
  };

  LI.Sketch = { make, raster, N, GLYPH, ellipse, VARIANTS };
})(window.LI = window.LI || {});
