/* ─────────────────────────────────────────────────────────────
   Virtual camera.
   World units: at zoom 1 a horizontal frame shows 1920×1080 world units
   centred on (0,0); a vertical frame shows 1080×1920. Scenes compose
   for both by reading env.V.
   cam = { x, y, zoom, rot, tilt }   tilt < 1 squashes Y (camera tilting down)
   depth: parallax factor for layered backgrounds (1 = main plane).
   ───────────────────────────────────────────────────────────── */
(function (LI) {
  'use strict';
  const Camera = {
    make(o = {}) { return Object.assign({ x: 0, y: 0, zoom: 1, rot: 0, tilt: 1 }, o); },
    apply(ctx, env, cam, depth = 1) {
      const z = 1 + (cam.zoom - 1) * depth;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(env.W / 2, env.H / 2);
      ctx.rotate(cam.rot * depth);
      ctx.scale(z, z * (1 + (cam.tilt - 1) * depth));
      ctx.translate(-cam.x * depth, -cam.y * depth);
      env.pxScale = z; // world units → pixels (for line width decisions)
    },
    screen(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); },
    /** blend two cameras */
    mix(a, b, t) {
      const L = LI.E.lerp;
      // interpolate zoom in log space for a natural dolly feel
      return { x: L(a.x, b.x, t), y: L(a.y, b.y, t), zoom: Math.exp(L(Math.log(a.zoom), Math.log(b.zoom), t)),
        rot: L(a.rot || 0, b.rot || 0, t), tilt: L(a.tilt ?? 1, b.tilt ?? 1, t) };
    },
    /** zoom INTO a point: keeps the target's on-screen offset shrinking smoothly
        (plain lerp of position + log-lerp of zoom would swing past the target) */
    dive(a, b, t) {
      const c = Camera.mix(a, b, t);
      const off = [(b.x - a.x) * a.zoom * (1 - t), (b.y - a.y) * a.zoom * (1 - t)];
      c.x = b.x - off[0] / c.zoom; c.y = b.y - off[1] / c.zoom;
      return c;
    },
    /** keyframed camera: keys = [[t, {x,y,zoom,rot,tilt}, ease?], ...] */
    track(keys, t) {
      if (t <= keys[0][0]) return Object.assign(Camera.make(), keys[0][1]);
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
          const p = (keys[i][2] || LI.E.inOut)((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
          return Camera.mix(Object.assign(Camera.make(), keys[i - 1][1]), Object.assign(Camera.make(), keys[i][1]), p);
        }
      }
      return Object.assign(Camera.make(), keys[keys.length - 1][1]);
    },
    /** tiny hand-held drift so still shots breathe */
    breathe(cam, t, amt = 1) {
      const n = LI.rng.noise;
      cam.x += n(t * 0.23, 901) * 6 * amt;
      cam.y += n(t * 0.19, 902) * 4 * amt;
      cam.rot += n(t * 0.17, 903) * 0.003 * amt;
      return cam;
    },
  };
  LI.Camera = Camera;
})(window.LI = window.LI || {});
