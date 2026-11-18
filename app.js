'use strict';
const $ = id => document.getElementById(id);
const view = $('view'), vctx = view.getContext('2d', { willReadFrequently: true });

// Posuvníky: [klíč, popisek, min, max, výchozí, krok]
const CONTROLS = [
  ['crop', 'Ořez okrajů (%)', 0, 15, 3, 0.5],
  ['black', 'Černý bod (%)', 0, 10, 0.5, 0.1],
  ['white', 'Bílý bod (%)', 90, 100, 99.5, 0.1],
  ['exposure', 'Expozice (EV)', -2, 2, 0, 0.05],
  ['gamma', 'Gamma', 0.5, 2, 1, 0.05],
  ['contrast', 'Kontrast', -100, 100, 20, 1],
  ['temp', 'Teplota', -50, 50, 0, 1],
  ['tint', 'Tint', -50, 50, 0, 1],
  ['sat', 'Sytost', -100, 100, 0, 1]
];
const DEF = Object.fromEntries(CONTROLS.map(c => [c[0], c[4]]));
const P = { ...DEF };
const S = { prev: null, full: null, base: [1, 1, 1], bw: false, showNeg: false, picking: false };

// sRGB -> lineární
const LUT = new Float32Array(256).map((_, i) => { const v = i / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });

// ---------- UI ----------
const box = $('sliders');
CONTROLS.forEach(([k, label, min, max, def, step]) => {
  const d = document.createElement('div'); d.className = 's';
  d.innerHTML = `<label for="p_${k}">${label}</label><output id="o_${k}">${def}</output><input id="p_${k}" type="range" min="${min}" max="${max}" step="${step}" value="${def}">`;
  d.querySelector('input').addEventListener('input', e => { P[k] = +e.target.value; $('o_' + k).textContent = P[k]; schedule(); });
  box.appendChild(d);
});
$('reset').onclick = () => { CONTROLS.forEach(c => { P[c[0]] = c[4]; $('p_' + c[0]).value = c[4]; $('o_' + c[0]).textContent = c[4]; }); schedule(); };
document.querySelectorAll('[name=mode]').forEach(r => r.onchange = e => { S.bw = e.target.value === 'bw'; schedule(); });

let raf = 0;
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

// ---------- Načtení ----------
async function loadFile(file) {
  if (!file) return;
  try {
    let img;
    if (/\.tiff?$/i.test(file.name) || file.type === 'image/tiff') {
      if (!window.UTIF) throw new Error('Knihovna pro TIFF se nenačetla.');
      const buf = await file.arrayBuffer(), ifds = UTIF.decode(buf);
      UTIF.decodeImage(buf, ifds[0]);
      img = new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(ifds[0])), ifds[0].width, ifds[0].height);
    } else {
      const bmp = await createImageBitmap(file), c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); img = x.getImageData(0, 0, c.width, c.height);
    }
    S.full = img;
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const t = document.createElement('canvas'); t.width = img.width; t.height = img.height; t.getContext('2d').putImageData(img, 0, 0);
    c.getContext('2d').drawImage(t, 0, 0, c.width, c.height);
    S.prev = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    autoBase();
    view.hidden = false; $('hint').hidden = true;
    ['toggle', 'export', 'auto'].forEach(i => $(i).disabled = false);
    render();
  } catch (e) { alert('Soubor se nepodařilo otevřít: ' + e.message); }
}
$('file').onchange = e => loadFile(e.target.files[0]);
const st = $('stage');
st.ondragover = e => { e.preventDefault(); st.classList.add('drag'); };
st.ondragleave = () => st.classList.remove('drag');
st.ondrop = e => { e.preventDefault(); st.classList.remove('drag'); loadFile(e.dataTransfer.files[0]); };

// ---------- Film base ----------
function autoBase() { // nejsvětlejší 0,2 % každého kanálu v ořezané oblasti = nenaexponovaná báze
  const { width: w, height: h, data } = S.prev, cx = Math.round(w * P.crop / 100), cy = Math.round(h * P.crop / 100);
  const hist = [0, 1, 2].map(() => new Uint32Array(256)); let n = 0;
  for (let y = cy; y < h - cy; y++) for (let x = cx; x < w - cx; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) hist[c][data[i + c]]++; n++; }
  S.base = hist.map(hh => { let a = 0, i = 255; for (; i > 0; i--) { a += hh[i]; if (a >= n * .002) break; } return Math.max(LUT[i], 1e-3); });
}
$('auto').onclick = () => { autoBase(); render(); };
$('toggle').onclick = () => { S.showNeg = !S.showNeg; $('toggle').textContent = S.showNeg ? 'Zobrazit pozitiv' : 'Zobrazit negativ'; view.classList.toggle('pick', S.showNeg); render(); };
view.addEventListener('click', e => { // pipeta na negativu
  if (!S.showNeg) return;
  const r = view.getBoundingClientRect(), px = Math.floor((e.clientX - r.left) / r.width * view.width), py = Math.floor((e.clientY - r.top) / r.height * view.height);
  const acc = [0, 0, 0]; let n = 0;
  for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
    if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue;
    const i = (y * S.prev.width + x) * 4; for (let c = 0; c < 3; c++) acc[c] += LUT[S.prev.data[i + c]]; n++;
  }
  S.base = acc.map(v => Math.max(v / n, 1e-3));
  $('toggle').click();
});

// ---------- Konverze ----------
// Negativ -> hustota (D = -log10(pixel / film base)) -> roztažení černého a bílého bodu po kanálech -> korekce.
function convert(img) {
  const { width: w, height: h, data } = img, cx = Math.round(w * P.crop / 100), cy = Math.round(h * P.crop / 100);
  const ow = w - 2 * cx, oh = h - 2 * cy, N = ow * oh, D = new Float32Array(N * 3), BINS = 1024, MAX = 3;
  const hist = [0, 1, 2].map(() => new Uint32Array(BINS)); let k = 0;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = ((y + cy) * w + x + cx) * 4, d = [0, 0, 0];
    for (let c = 0; c < 3; c++) d[c] = Math.max(0, -Math.log10(Math.max(LUT[data[i + c]] / S.base[c], 1e-4)));
    if (S.bw) d[0] = d[1] = d[2] = (d[0] + d[1] + d[2]) / 3;
    for (let c = 0; c < 3; c++) { D[k++] = d[c]; hist[c][Math.min(BINS - 1, d[c] / MAX * BINS | 0)]++; }
  }
  const pct = (hh, p) => { let a = 0; const t = N * p / 100; for (let i = 0; i < BINS; i++) { a += hh[i]; if (a >= t) return (i + .5) / BINS * MAX; } return MAX; };
  const lo = hist.map(hh => pct(hh, P.black)), hi = hist.map(hh => pct(hh, P.white));
  const ex = 2 ** P.exposure, ig = 1 / P.gamma, ct = P.contrast / 100, sat = 1 + P.sat / 100;
  const mul = [1 + P.temp / 100, 1 - P.tint / 100, 1 - P.temp / 100];
  const out = new ImageData(ow, oh), o = out.data; k = 0;
  for (let p = 0; p < N; p++) {
    const v = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let t = (D[k++] - lo[c]) / Math.max(hi[c] - lo[c], 1e-3) * ex * mul[c];
      t = Math.min(1, Math.max(0, t)) ** ig;
      v[c] = t + (t * t * (3 - 2 * t) - t) * ct;
    }
    const l = .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
    for (let c = 0; c < 3; c++) o[p * 4 + c] = Math.min(255, Math.max(0, (l + (v[c] - l) * sat) * 255));
    o[p * 4 + 3] = 255;
  }
  return out;
}

function render() {
  if (!S.prev) return;
  if (S.showNeg) { view.width = S.prev.width; view.height = S.prev.height; vctx.putImageData(S.prev, 0, 0); return; }
  const r = convert(S.prev); view.width = r.width; view.height = r.height; vctx.putImageData(r, 0, 0);
}

// ---------- Export ----------
$('export').onclick = () => {
  if (!S.full) return;
  const r = convert(S.full), c = document.createElement('canvas'); c.width = r.width; c.height = r.height;
  c.getContext('2d').putImageData(r, 0, 0);
  c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pozitiv.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
};
