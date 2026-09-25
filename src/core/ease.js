/* Easing, interpolation and time-window helpers used by every scene. */
(function (LI) {
  'use strict';
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  /** 0→1 progress of t inside the window [a,b] */
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const inOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const outCubic = (t) => 1 - Math.pow(1 - t, 3);
  const inCubic = (t) => t * t * t;
  const outQuint = (t) => 1 - Math.pow(1 - t, 5);
  const outBack = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const inBack = (t, s = 1.7) => (s + 1) * t * t * t - s * t * t;
  /** damped spring settle: 0 → 1 with overshoot wobble */
  const spring = (t, k = 7, d = 5) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(k * t));
  /** 0→1→0 hump over window */
  const hump = (t, a, b) => { const p = seg(t, a, b); return Math.sin(Math.PI * p); };
  /** fade in over [a,a+fi], out over [b-fo,b] */
  const window_ = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
  const lerpPt = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

  /** Keyframe track: keys = [[time, value, easeFn?], ...]; value may be number or array */
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const p = (e || inOut)((t - t0) / (t1 - t0 || 1));
        if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], p));
        return lerp(v0, v1, p);
      }
    }
    return keys[keys.length - 1][1];
  }

  /** Point on cubic bezier */
  function bez(p0, p1, p2, p3, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  }
  function bezPts(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) out.push(bez(p0, p1, p2, p3, i / n));
    return out;
  }
  function quadPts(p0, c, p2, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]);
    }
    return out;
  }
  /** point at fraction s along a polyline */
  function along(pts, s) {
    if (pts.length < 2) return pts[0];
    let L = 0; const seglen = [];
    for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); seglen.push(d); L += d; }
    let target = clamp(s) * L;
    for (let i = 0; i < seglen.length; i++) {
      if (target <= seglen[i] || i === seglen.length - 1) {
        const f = seglen[i] ? target / seglen[i] : 0;
        return lerpPt(pts[i], pts[i + 1], clamp(f));
      }
      target -= seglen[i];
    }
    return pts[pts.length - 1];
  }
  /** Catmull-Rom smoothing for hand-authored point lists */
  function smoothPath(pts, per = 6) {
    if (pts.length < 3) return pts.slice();
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function xform(pts, x, y, s, r = 0, sx = 1) {
    const c = Math.cos(r), sn = Math.sin(r);
    return pts.map(([a, b]) => { a *= s * sx; b *= s; return [x + a * c - b * sn, y + a * sn + b * c]; });
  }

  LI.E = { clamp, lerp, seg, smooth, inOut, inOutSine, outCubic, inCubic, outQuint, outBack, inBack, spring, hump,
    win: window_, lerpPt, dist, track, bez, bezPts, quadPts, along, smoothPath, xform };
})(window.LI = window.LI || {});
