/* Preview player. Real-time playback just samples renderFrame(t) — the
   film itself never depends on frame timing, so what you scrub is exactly
   what the exporter renders. */
(function (LI) {
  'use strict';
  const q = new URLSearchParams(location.search);
  const RENDER = q.has('render');
  const canvas = document.getElementById('film');
  const $ = (id) => document.getElementById(id);

  const state = { t: +(q.get('t') || 0), playing: false, speed: 1, last: 0 };
  LI.init(canvas, { format: q.get('format') || 'horizontal', captions: q.get('captions') || 'bi' });

  // ready = fonts loaded + network trained (deterministic, ~0.2 s)
  LI.ready = (async () => {
    await LI.fontsReady;
    const m = LI.Net.model();
    LI.World.prepare();
    console.log('[LearningInk] network stats', m.stats);
    for (const s of LI.scenes) if (s.prepare) s.prepare();
  })();

  // hooks for the headless exporter
  window.__LI = {
    ready: LI.ready,
    renderAt(t) { LI.renderFrame(t); },
    setFormat(f) { LI.setFormat(f); },
    setCaptions(c) { LI.setCaptions(c); },
    frames: () => LI.frameCount(),
  };

  if (RENDER) {
    document.body.classList.add('render');
    LI.ready.then(() => { LI.renderFrame(state.t); document.body.dataset.ready = '1'; });
    return;
  }

  // ───────── interactive UI
  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
  const CAP_LABEL = { off: 'Kapalı · Off', tr: 'TR', en: 'EN', bi: 'TR + EN' };

  function segButtons(el, items, get, set) {
    el.innerHTML = '';
    items.forEach(([val, label, title]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; if (title) b.title = title;
      b.onclick = () => { set(val); refresh(); };
      b.dataset.val = val;
      el.appendChild(b);
    });
    el._sync = () => [...el.children].forEach((b) => b.classList.toggle('on', String(get()) === b.dataset.val));
  }

  segButtons($('scenes'), LI.scenes.map((s) => [String(s.id), String(s.id), `${s.name} · ${s.nameTr} (${s.start}s)`]),
    () => String(LI.sceneAt(state.t).id), (v) => { state.t = LI.scenes.find((s) => String(s.id) === v).start + 0.001; draw(); });
  segButtons($('speeds'), [[0.25, '¼×'], [0.5, '½×'], [1, '1×'], [1.5, '1½×'], [2, '2×']].map(([v, l]) => [String(v), l]),
    () => String(state.speed), (v) => { state.speed = +v; });
  segButtons($('formats'), [['horizontal', '16:9', '1920×1080'], ['vertical', '9:16', '1080×1920 (recomposed)']],
    () => LI.env.format, (v) => { LI.setFormat(v); layout(); draw(); });
  segButtons($('caps'), Object.entries(CAP_LABEL).map(([k, l]) => [k, l]), () => LI.env.captions, (v) => { LI.setCaptions(v); draw(); });

  // markers
  const markers = $('markers');
  LI.scenes.forEach((s) => {
    const m = document.createElement('button');
    m.className = 'mk'; m.style.left = (s.start / LI.DURATION) * 100 + '%';
    m.innerHTML = `<i></i><b>${s.id}</b>`; m.title = `${s.id} · ${s.name} / ${s.nameTr}`;
    m.onclick = (e) => { e.stopPropagation(); state.t = s.start + 0.001; draw(); };
    markers.appendChild(m);
  });

  function refresh() { ['scenes', 'speeds', 'formats', 'caps'].forEach((id) => $(id)._sync && $(id)._sync()); }

  function layout() {
    const frame = $('frame'), stage = $('stage');
    const r = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
    const aw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const ar = LI.env.W / LI.env.H;
    let w = aw, h = w / ar;
    if (h > ah) { h = ah; w = h * ar; }
    frame.style.width = w + 'px'; frame.style.height = h + 'px';
  }
  window.addEventListener('resize', layout);

  function draw() {
    const sc = LI.renderFrame(state.t);
    $('tc').textContent = fmt(state.t);
    const p = (state.t / LI.DURATION) * 100;
    $('fill').style.width = p + '%'; $('head').style.left = p + '%';
    $('sceneName').innerHTML = `<b>${sc.id}</b> ${sc.name} <em>· ${sc.nameTr}</em>`;
    $('sceneConcept').innerHTML = `${sc.concept} <em>· ${sc.conceptTr}</em>`;
    refresh();
  }

  function loop(now) {
    if (state.playing) {
      const dt = Math.min(0.1, (now - state.last) / 1000);
      state.t += dt * state.speed;
      if (state.t >= LI.DURATION) { state.t = LI.DURATION - 0.001; state.playing = false; document.body.classList.remove('playing'); }
      draw();
    }
    state.last = now;
    requestAnimationFrame(loop);
  }

  const setPlaying = (p) => { state.playing = p; document.body.classList.toggle('playing', p); if (p && state.t >= LI.DURATION - 0.01) state.t = 0; };
  $('play').onclick = () => setPlaying(!state.playing);
  $('restart').onclick = () => { state.t = 0; draw(); };

  // scrubbing
  const scrub = $('scrub');
  let dragging = false;
  const seek = (e) => { const r = scrub.getBoundingClientRect(); state.t = LI.E.clamp((e.clientX - r.left) / r.width) * (LI.DURATION - 0.001); draw(); };
  scrub.addEventListener('pointerdown', (e) => { dragging = true; scrub.setPointerCapture(e.pointerId); seek(e); });
  scrub.addEventListener('pointermove', (e) => dragging && seek(e));
  scrub.addEventListener('pointerup', () => (dragging = false));

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
    else if (e.code === 'ArrowRight') { state.t = Math.min(LI.DURATION - 0.001, state.t + (e.shiftKey ? 5 : 1)); draw(); }
    else if (e.code === 'ArrowLeft') { state.t = Math.max(0, state.t - (e.shiftKey ? 5 : 1)); draw(); }
    else if (e.key === '.') { state.t = Math.min(LI.DURATION - 0.001, state.t + 1 / LI.FPS); draw(); }
    else if (e.key === ',') { state.t = Math.max(0, state.t - 1 / LI.FPS); draw(); }
    else if (e.code === 'Home') { state.t = 0; draw(); }
  });

  // downloads
  function srtText(mode) {
    const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
    return LI.CAPTIONS.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${mode === 'tr' ? c.tr : mode === 'en' ? c.en : c.tr + '\n' + c.en}\n`).join('\n');
  }
  const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  $('srt').onclick = () => { const m = LI.env.captions === 'off' ? 'bi' : LI.env.captions; download(`learning-ink_${m}.srt`, new Blob([srtText(m)], { type: 'text/plain' })); };
  $('png').onclick = () => canvas.toBlob((b) => download(`learning-ink_${state.t.toFixed(2)}s.png`, b));

  LI.ready.then(() => { $('loading').remove(); layout(); draw(); requestAnimationFrame((n) => { state.last = n; loop(n); }); });
})(window.LI);
