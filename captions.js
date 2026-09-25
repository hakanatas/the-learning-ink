/* ─────────────────────────────────────────────────────────────
   CAPTIONS — edit freely.
   start / end are in seconds on the master timeline.
   `note` is a suggested narration line for teachers (not shown on screen).
   Also used by `npm run srt` to write subtitle files.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  const CAPTIONS = [
    { scene: 2, start: 9.2, end: 12.4, tr: 'Veri', en: 'Data',
      note: 'A network starts with data: many examples, drawn and collected by people.' },
    { scene: 2, start: 12.9, end: 15.6, tr: 'Etiket', en: 'Label',
      note: 'Each example carries a label, the correct answer, written by a human.' },
    { scene: 3, start: 25.0, end: 28.2, tr: 'Nöron', en: 'Neuron',
      note: 'A neuron adds up incoming signals; if the total passes a threshold, it fires.' },
    { scene: 3, start: 28.7, end: 31.2, tr: 'Ağırlık', en: 'Weight',
      note: 'Weights decide how strongly each signal counts. Thick lines count more.' },
    { scene: 4, start: 36.4, end: 38.6, tr: 'Hata', en: 'Error',
      note: 'The guess is compared with the label. The difference is the error, or loss.' },
    { scene: 4, start: 39.0, end: 42.4, tr: 'Geri yayılım', en: 'Backpropagation',
      note: 'The error flows backward, telling every weight how to change a little.' },
    { scene: 4, start: 45.0, end: 48.6, tr: 'Gradyan iniş', en: 'Gradient descent',
      note: 'Each small change is a step downhill on the error landscape.' },
    { scene: 5, start: 56.8, end: 61.0, tr: 'Örüntüler', en: 'Patterns',
      note: 'Early layers detect simple strokes; deeper layers combine them into parts.' },
    { scene: 6, start: 72.6, end: 76.2, tr: 'Genelleme', en: 'Generalization',
      note: 'It recognises a bird it has never seen. That is generalization.' },
    { scene: 7, start: 83.4, end: 87.6, tr: 'Veri kadar iyi', en: 'Only as good as its data',
      note: 'Shown something unlike its data, it can be confidently wrong. People stay in the loop.' },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = CAPTIONS;
  else { root.LI = root.LI || {}; root.LI.CAPTIONS = CAPTIONS; }
})(typeof window !== 'undefined' ? window : globalThis);
