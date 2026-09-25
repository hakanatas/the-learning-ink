/* ─────────────────────────────────────────────────────────────
   A REAL tiny neural network, trained deterministically at load time.
     49 inputs (7×7 pixels) → 8 ReLU → 6 ReLU → 2 (softmax: bird / fish)
   Plain stochastic gradient descent, one example per step, with a small
   L1 penalty so that unhelpful connections fade (clearer pathways).
   Every step's weights are stored as a snapshot, so "training progress"
   in the film is a pure function of time: params(q) just looks up the
   snapshot for q ∈ [0,1]. Nothing accumulates between frames.
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';
  const { gen } = LI.rng;
  const SIZES = [49, 8, 6, 2];
  const STEPS = 1200, LR = 0.045, L1 = 0.004;
  let M = null;

  const relu = (x) => (x > 0 ? x : 0);

  function layout() {
    // flat parameter vector: for each layer l: W (out*in) then b (out)
    const off = []; let o = 0;
    for (let l = 0; l < SIZES.length - 1; l++) {
      const nin = SIZES[l], nout = SIZES[l + 1];
      off.push({ W: o, b: o + nin * nout, nin, nout }); o += nin * nout + nout;
    }
    return { off, total: o };
  }
  const LAY = layout();

  function init(seed) {
    const R = gen('init' + seed), P = new Float64Array(LAY.total);
    LAY.off.forEach(({ W, b, nin, nout }, l) => {
      const sd = Math.sqrt(2 / nin) * (l === 2 ? 1.6 : 1);
      for (let i = 0; i < nin * nout; i++) P[W + i] = R.gauss() * sd;
      for (let i = 0; i < nout; i++) P[b + i] = l < 2 ? 0.05 : 0;
    });
    return P;
  }

  /** forward pass → activations of every layer, pre-activations, probabilities */
  function forward(P, x) {
    const acts = [Array.from(x)], zs = [];
    let a = acts[0];
    LAY.off.forEach(({ W, b, nin, nout }, l) => {
      const z = new Array(nout), h = new Array(nout);
      for (let j = 0; j < nout; j++) {
        let s = P[b + j];
        for (let i = 0; i < nin; i++) s += P[W + j * nin + i] * a[i];
        z[j] = s; h[j] = l < 2 ? relu(s) : s;
      }
      zs.push(z);
      if (l === 2) { const m = Math.max(h[0], h[1]); const e0 = Math.exp(h[0] - m), e1 = Math.exp(h[1] - m); acts.push([e0 / (e0 + e1), e1 / (e0 + e1)]); }
      else acts.push(h);
      a = acts[acts.length - 1];
    });
    return { acts, zs, probs: acts[3] };
  }
  const loss = (P, x, y) => -Math.log(Math.max(1e-9, forward(P, x).probs[y]));

  /** one SGD step (backpropagation written out by hand) */
  function step(P, x, y) {
    const { acts, zs } = forward(P, x);
    let delta = [acts[3][0] - (y === 0 ? 1 : 0), acts[3][1] - (y === 1 ? 1 : 0)]; // dL/dz at output
    for (let l = 2; l >= 0; l--) {
      const { W, b, nin, nout } = LAY.off[l], a = acts[l];
      const prev = new Array(nin).fill(0);
      for (let j = 0; j < nout; j++) {
        for (let i = 0; i < nin; i++) {
          prev[i] += P[W + j * nin + i] * delta[j];
          const w = P[W + j * nin + i];
          P[W + j * nin + i] = w - LR * (delta[j] * a[i] + L1 * Math.sign(w));
        }
        P[b + j] -= LR * delta[j];
      }
      if (l > 0) delta = prev.map((g, i) => (zs[l - 1][i] > 0 ? g : 0));
    }
  }

  function build() {
    const Sk = LI.Sketch;
    // data set: humans drew & labelled these (label 0 = bird, 1 = fish)
    const data = [];
    for (let i = 0; i < 120; i++) { for (const k of ['bird', 'fish']) { const sk = Sk.make(k, i); data.push({ sk, x: Sk.raster(sk), y: k === 'bird' ? 0 : 1 }); } }
    const test = [];
    for (let i = 500; i < 560; i++) { for (const k of ['bird', 'fish']) { const sk = Sk.make(k, i); test.push({ sk, x: Sk.raster(sk), y: k === 'bird' ? 0 : 1 }); } }
    // the first bird Nokta ever sees (Scene 2)
    const firstSk = Sk.make('bird', 7, { variant: 'perched', rot: -0.08, scale: 0.92, flip: 1, style: 'brush' });
    const first = { sk: firstSk, x: Sk.raster(firstSk), y: 0 };
    // choose an initial random network that (honestly) gets this bird WRONG
    let seed = 1, P0;
    for (; seed < 400; seed++) { P0 = init(seed); if (forward(P0, first.x).probs[1] > 0.7) break; }
    // deterministic shuffle; the first bird is example #0
    const R = gen('order');
    const order = [];
    for (let e = 0; order.length < STEPS; e++) {
      const idx = data.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      order.push(...idx);
    }
    order.length = STEPS;
    const snaps = [Float32Array.from(P0)], P = Float64Array.from(P0);
    const lossCurve = [], accCurve = [];
    const evalSet = data.filter((_, i) => i % 3 === 0);
    const evalLoss = () => evalSet.reduce((s, d) => s + loss(P, d.x, d.y), 0) / evalSet.length;
    lossCurve.push(evalLoss());
    for (let s = 0; s < STEPS; s++) {
      const d = s === 0 ? first : data[order[s]];
      step(P, d.x, d.y);
      snaps.push(Float32Array.from(P));
      if ((s + 1) % 20 === 0) lossCurve.push(evalLoss());
    }
    const acc = (Q, set) => set.filter((d) => (forward(Q, d.x).probs[0] > 0.5 ? 0 : 1) === d.y).length / set.length;
    const PF = snaps[STEPS];
    // Scene 6: an unusual bird the network has never seen (a pose absent from training)
    let unusual = null;
    for (const v of ['heron', 'dive']) for (let s = 0; s < 80 && !unusual; s++) {
      const sk = Sk.make('bird', 900 + s, { variant: v, style: 'scribble', rot: 0.1 }); const x = Sk.raster(sk);
      if (forward(PF, x).probs[0] > 0.8) unusual = { sk, x, y: 0 };
    }
    // Scene 7: an abstract shape that the network nevertheless calls "bird" (out-of-distribution)
    let ood = null;
    for (let s = 0; s < 200 && !ood; s++) {
      const sk = Sk.make('abstract', s, { variant: 'shape', style: 'bold', rot: 0 }); const x = Sk.raster(sk);
      if (forward(PF, x).probs[0] > 0.85) ood = { sk, x, y: -1 };
    }
    // weight scale per layer (for consistent line-thickness encoding across the film)
    const scale = LAY.off.map(({ W, nin, nout }) => {
      const v = []; for (let i = 0; i < nin * nout; i++) v.push(Math.abs(PF[W + i]));
      v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.96)] || 1;
    });
    M = { SIZES, STEPS, LAY, snaps, lossCurve, data, test, first, unusual, ood, scale, initSeed: seed,
      stats: { trainAcc: acc(PF, data), testAcc: acc(PF, test), initAcc: acc(P0, test),
        firstInit: forward(P0, first.x).probs, unusualP: unusual && forward(PF, unusual.x).probs, oodP: ood && forward(PF, ood.x).probs,
        unusualVariant: unusual && unusual.sk.variant } };
    return M;
  }

  const cache = new Map();
  /** parameters at training progress q ∈ [0,1] (interpolated between stored snapshots) */
  function params(q) {
    const m = LI.Net.model();
    const f = Math.max(0, Math.min(1, q)) * m.STEPS, i = Math.floor(f), fr = f - i;
    if (fr < 1e-6 || i >= m.STEPS) return m.snaps[Math.min(i, m.STEPS)];
    const key = Math.round(f * 1000);
    if (cache.has(key)) return cache.get(key);
    const A = m.snaps[i], B = m.snaps[i + 1], out = new Float32Array(A.length);
    for (let k = 0; k < A.length; k++) out[k] = A[k] + (B[k] - A[k]) * fr;
    if (cache.size > 400) cache.clear();
    cache.set(key, out); return out;
  }
  function weight(P, l, j, i) { const o = LAY.off[l]; return P[o.W + j * o.nin + i]; }
  function bias(P, l, j) { return P[LAY.off[l].b + j]; }
  /** loss at training progress q (from the recorded curve) */
  function lossAt(q) { const c = LI.Net.model().lossCurve, f = Math.max(0, Math.min(1, q)) * (c.length - 1), i = Math.floor(f); return i >= c.length - 1 ? c[c.length - 1] : c[i] + (c[i + 1] - c[i]) * (f - i); }

  LI.Net = { model: () => M || build(), params, forward, weight, bias, lossAt, SIZES, LAY };
})(window.LI = window.LI || {});
