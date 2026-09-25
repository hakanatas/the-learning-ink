/* ─────────────────────────────────────────────────────────────
   Seeded randomness & noise.
   Everything random in the film goes through these functions, so the
   same timestamp always produces the same image. No Math.random().
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';

  function strHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // 32-bit integer mixer
  function mix(a) {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** rand(...keys) → deterministic float in [0,1) for any combination of numbers/strings */
  function rand() {
    let h = 0x9E3779B9 | 0;
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      const k = typeof v === 'number' ? (Math.floor(v * 1000003) | 0) : strHash(String(v));
      h = mix(h ^ k);
    }
    return h / 4294967296;
  }
  /** signed version in [-1,1) */
  const srand = function () { return rand.apply(null, arguments) * 2 - 1; };
  /** range helper */
  const rrange = (a, b, ...k) => a + (b - a) * rand(...k);

  /** Sequential generator (mulberry32) for building data sets */
  function gen(seed) {
    let a = (typeof seed === 'number' ? seed : strHash(String(seed))) >>> 0;
    const f = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.gauss = () => { let u = 1 - f(), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return f;
  }

  /** smooth 1D value noise in [-1,1] */
  function noise(x, seed) {
    const i = Math.floor(x), f = x - i;
    const a = rand(seed, i), b = rand(seed, i + 1);
    const u = f * f * (3 - 2 * f);
    return (a + (b - a) * u) * 2 - 1;
  }
  /** 2-octave fractal noise */
  function fbm(x, seed) { return noise(x, seed) * 0.66 + noise(x * 2.13 + 7.1, seed + 11) * 0.34; }

  LI.rng = { rand, srand, rrange, gen, noise, fbm, strHash };
})(window.LI = window.LI || {});
