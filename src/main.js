import './style.css';
import { PDFDocument, degrees } from 'pdf-lib';
// Use the legacy PDF.js build for broader browser compatibility (work PCs can be behind).
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).toString();

const PRESETS = [
  { label: '4 x 6 in', wIn: 4, hIn: 6 },
  { label: '5 x 7 in', wIn: 5, hIn: 7 },
  { label: '8.5 x 11 in (Letter)', wIn: 8.5, hIn: 11 },
  { label: '11 x 17 in (Tabloid)', wIn: 11, hIn: 17 },
  { label: '12 x 18 in', wIn: 12, hIn: 18 },
  { label: '24 x 36 in', wIn: 24, hIn: 36 },
  { label: 'Custom', custom: true },
];

const MODES = [
  { value: 'contain', label: 'Fit (no crop)' },
  { value: 'cover', label: 'Fill (crop)' },
  { value: 'distort', label: 'Distort (stretch)' },
];

const POINTS_PER_INCH = 72;

function $(sel) {
  return document.querySelector(sel);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtIn(n) {
  return Number(n).toFixed(2).replace(/\.00$/, '');
}

function time(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getOutputSizeIn() {
  const preset = $('#preset').value;
  if (preset === 'custom') {
    const w = Number($('#wIn').value);
    const h = Number($('#hIn').value);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error('Invalid custom size');
    return { wIn: w, hIn: h };
  }
  const p = PRESETS.find((x) => x.label === preset);
  if (!p) throw new Error('Unknown preset');
  return { wIn: p.wIn, hIn: p.hIn };
}

function applyOrientation({ wIn, hIn, orient, input, mode, dpi }) {
  // If orient is portrait/landscape: force page orientation.
  // If orient is auto:
  //  - for images: choose orientation that best fits (depends on mode + dpi)
  //  - for PDFs: keep selected page size; rotation is handled by computePlacement.

  const force = (o) => {
    if (o === 'portrait' && wIn > hIn) return { wIn: hIn, hIn: wIn };
    if (o === 'landscape' && hIn > wIn) return { wIn: hIn, hIn: wIn };
    return { wIn, hIn };
  };

  if (orient === 'portrait' || orient === 'landscape') return force(orient);

  // auto
  if (!input || input.kind !== 'image') return { wIn, hIn };

  const srcWpt = (input.w / (dpi || 300)) * POINTS_PER_INCH;
  const srcHpt = (input.h / (dpi || 300)) * POINTS_PER_INCH;
  const dstWpt0 = wIn * POINTS_PER_INCH;
  const dstHpt0 = hIn * POINTS_PER_INCH;

  const chooseSwap = () => {
    if (mode === 'distort') {
      const scaleX1 = dstWpt0 / srcWpt;
      const scaleY1 = dstHpt0 / srcHpt;
      const ratio1 = Math.max(scaleX1 / scaleY1, scaleY1 / scaleX1);

      const scaleX2 = dstHpt0 / srcWpt;
      const scaleY2 = dstWpt0 / srcHpt;
      const ratio2 = Math.max(scaleX2 / scaleY2, scaleY2 / scaleX2);

      if (ratio2 < ratio1) return true;
      if (ratio2 > ratio1) return false;
      return Math.min(scaleX2, scaleY2) > Math.min(scaleX1, scaleY1);
    }

    const s1 = mode === 'cover'
      ? Math.max(dstWpt0 / srcWpt, dstHpt0 / srcHpt)
      : Math.min(dstWpt0 / srcWpt, dstHpt0 / srcHpt);

    const s2 = mode === 'cover'
      ? Math.max(dstHpt0 / srcWpt, dstWpt0 / srcHpt)
      : Math.min(dstHpt0 / srcWpt, dstWpt0 / srcHpt);

    // contain: pick larger scale (bigger content). cover: pick smaller scale (less crop).
    return mode === 'cover' ? (s2 < s1) : (s2 > s1);
  };

  if (chooseSwap()) return { wIn: hIn, hIn: wIn };
  return { wIn, hIn };
}

function setCustomEnabled(enabled) {
  $('#wIn').disabled = !enabled;
  $('#hIn').disabled = !enabled;
}

function computePlacement({ srcW, srcH, dstW, dstH, mode, allowRotate }) {
  // Returns: { drawW, drawH, x, y, rotateDeg }
  const fit = (sw, sh, dw, dh) => {
    if (mode === 'distort') {
      const scaleX = dw / sw;
      const scaleY = dh / sh;
      return { drawW: dw, drawH: dh, scaleX, scaleY, scale: Math.min(scaleX, scaleY) };
    }
    const s = mode === 'cover'
      ? Math.max(dw / sw, dh / sh)
      : Math.min(dw / sw, dh / sh);
    return { drawW: sw * s, drawH: sh * s, scale: s };
  };

  const score = (p) => {
    if (mode === 'distort') {
      // Prefer the least-distorted (scaleX≈scaleY) and biggest minimum scale.
      const ratio = p.scaleX && p.scaleY ? Math.max(p.scaleX / p.scaleY, p.scaleY / p.scaleX) : 999;
      return (p.scale || 0) * 1000 - ratio; // larger is better
    }
    // For contain: bigger scale means content is larger on the page (better fit).
  // For cover: smaller scale means less crop while still filling.
    const s = p.scale || 0;
    return mode === 'cover' ? -s : s;
  };

  let best = { rotateDeg: 0, ...fit(srcW, srcH, dstW, dstH) };

  if (allowRotate) {
    const rot = { rotateDeg: 90, ...fit(srcH, srcW, dstW, dstH) };
    if (score(rot) > score(best)) best = rot;
  }

  const x = (dstW - best.drawW) / 2;
  const y = (dstH - best.drawH) / 2;

  return { drawW: best.drawW, drawH: best.drawH, x, y, rotateDeg: best.rotateDeg };
}

async function loadInput(file) {
  const buf = await file.arrayBuffer();
  const name = file.name || 'input';
  const type = (file.type || '').toLowerCase();

  const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isPng = type === 'image/png' || name.toLowerCase().endsWith('.png');
  const isJpg = type === 'image/jpeg' || type === 'image/jpg' || /\.(jpe?g)$/i.test(name);

  if (!isPdf && !isPng && !isJpg) {
    throw new Error('Unsupported file type. Use PDF, JPG, or PNG.');
  }

  if (isPdf) {
    const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
    const pageCount = doc.numPages;
    const first = await doc.getPage(1);
    const viewport = first.getViewport({ scale: 1 });
    // pdf.js units: CSS px at scale=1 (not points), but aspect ratio is valid.
    return {
      kind: 'pdf',
      name,
      buf,
      pdfjs: doc,
      pageCount,
      firstPage: { w: viewport.width, h: viewport.height },
    };
  }

  // image
  const blob = new Blob([buf], { type: type || (isPng ? 'image/png' : 'image/jpeg') });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();

  return {
    kind: 'image',
    name,
    buf,
    mime: blob.type,
    img,
    w: img.naturalWidth,
    h: img.naturalHeight,
    objectUrl: url,
  };
}

async function renderPreview({ input, mode, orient, dpi }) {
  const canvas = $('#preview');
  const ctx = canvas.getContext('2d');

  let { wIn, hIn } = getOutputSizeIn();
  ({ wIn, hIn } = applyOrientation({ wIn, hIn, orient, input, mode, dpi }));

  const dstW = Math.round(wIn * 100);
  const dstH = Math.round(hIn * 100);

  // Fit preview canvas into available area
  const maxW = 760;
  const maxH = 520;
  const scale = Math.min(maxW / dstW, maxH / dstH);
  const cw = Math.max(1, Math.floor(dstW * scale));
  const ch = Math.max(1, Math.floor(dstH * scale));
  canvas.width = cw;
  canvas.height = ch;

  // background
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);

  // page border
  ctx.strokeStyle = '#c8102e';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, cw - 2, ch - 2);

  // render source to bitmap (page 1 or image)
  let srcCanvas = document.createElement('canvas');
  if (input.kind === 'pdf') {
    const page = await input.pdfjs.getPage(1);
    const vp = page.getViewport({ scale: 1.5 });
    srcCanvas.width = Math.floor(vp.width);
    srcCanvas.height = Math.floor(vp.height);
    await page.render({ canvasContext: srcCanvas.getContext('2d'), viewport: vp }).promise;
  } else {
    srcCanvas.width = input.w;
    srcCanvas.height = input.h;
    const sctx = srcCanvas.getContext('2d');
    sctx.drawImage(input.img, 0, 0);
  }

  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  // For PDFs: always allow rotating content to best fit inside the chosen page orientation.
  // (Orientation dropdown controls the PAGE size; rotation controls CONTENT placement.)
  const placement = computePlacement({ srcW, srcH, dstW: cw, dstH: ch, mode, allowRotate: (input.kind === 'pdf') });

  // For image inputs we do NOT rotate the content anymore (we swap output orientation above).
  // For PDF preview we still support rotating the rendered page bitmap.
  let drawCanvas = srcCanvas;
  if (input.kind === 'pdf' && placement.rotateDeg === 90) {
    const rot = document.createElement('canvas');
    rot.width = srcCanvas.height;
    rot.height = srcCanvas.width;
    const rctx = rot.getContext('2d');
    rctx.translate(rot.width / 2, rot.height / 2);
    // Canvas y-axis is down, so positive rotation is clockwise visually.
    // Our placement.rotateDeg=90 means "rotate clockwise".
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    drawCanvas = rot;

    const p2 = computePlacement({ srcW: drawCanvas.width, srcH: drawCanvas.height, dstW: cw, dstH: ch, mode, allowRotate: false });
    placement.x = p2.x;
    placement.y = p2.y;
    placement.drawW = p2.drawW;
    placement.drawH = p2.drawH;
  }

  // Draw bitmap; for cover mode, draw larger and it will crop outside the page border naturally.
  ctx.drawImage(drawCanvas, placement.x, placement.y, placement.drawW, placement.drawH);

  // subtle overlay to show crop area
  ctx.fillStyle = 'rgba(200,16,46,0.05)';
  ctx.fillRect(0, 0, cw, ch);
}

async function buildOutputPdf({ input, wIn, hIn, mode, orient, dpi = 300 }) {
  ({ wIn, hIn } = applyOrientation({ wIn, hIn, orient, input, mode, dpi }));

  const dstWpt = wIn * POINTS_PER_INCH;
  const dstHpt = hIn * POINTS_PER_INCH;

  const out = await PDFDocument.create();

  if (input.kind === 'pdf') {
    const srcPdf = await PDFDocument.load(input.buf.slice(0));
    const pageCount = srcPdf.getPageCount();

    const allowRotate = true;

    for (let i = 0; i < pageCount; i++) {
      const [embedded] = await out.embedPages([srcPdf.getPage(i)]);
      const { width: sw, height: sh } = embedded.size();

      const placement = computePlacement({ srcW: sw, srcH: sh, dstW: dstWpt, dstH: dstHpt, mode, allowRotate });

      const page = out.addPage([dstWpt, dstHpt]);
      if (placement.rotateDeg === 90) {
        // Preview uses a +90 canvas rotation (clockwise in screen coords). PDF rotation is CCW for positive angles,
        // so use -90 here to match the preview orientation.
        // width/height are applied BEFORE rotation; use swapped dims for the rotated bbox.
        page.drawPage(embedded, {
          x: placement.x,
          y: placement.y + placement.drawH,
          width: placement.drawH,
          height: placement.drawW,
          rotate: degrees(-90),
        });
      } else {
        page.drawPage(embedded, {
          x: placement.x,
          y: placement.y,
          width: placement.drawW,
          height: placement.drawH,
        });
      }
    }

    return await out.save();
  }

  // image input -> 1 page PDF
  const page = out.addPage([dstWpt, dstHpt]);

  const isPng = (input.mime || '').toLowerCase().includes('png');
  const img = isPng
    ? await out.embedPng(input.buf)
    : await out.embedJpg(input.buf);

  // Treat source size at the given dpi for initial physical size (points).
  const sw = (input.w / dpi) * POINTS_PER_INCH;
  const sh = (input.h / dpi) * POINTS_PER_INCH;

  const placement = computePlacement({ srcW: sw, srcH: sh, dstW: dstWpt, dstH: dstHpt, mode, allowRotate: false });

  page.drawImage(img, {
    x: placement.x,
    y: placement.y,
    width: placement.drawW,
    height: placement.drawH,
  });

  return await out.save();
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function appHtml() {
  const presetOptions = PRESETS.map((p) => {
    if (p.custom) return `<option value="custom">Custom…</option>`;
    return `<option value="${p.label}">${p.label}</option>`;
  }).join('');

  const modeOptions = MODES.map((m) => `<option value="${m.value}">${m.label}</option>`).join('');

  return `
  <div class="wrap">
    <header class="topbar">
      <div class="brand">
        <div class="brandMark"></div>
        <div>
          <div class="brandTitle">Staples Print Helper</div>
          <div class="brandSub">Resize to PDF</div>
        </div>
      </div>
    </header>

    <main class="grid">
      <section class="panel">
        <h2>Input</h2>
        <input id="file" type="file" accept="application/pdf,image/png,image/jpeg" />

        <div class="row">
          <label>Target size</label>
          <select id="preset">${presetOptions}</select>
        </div>

        <div class="row two">
          <div>
            <label>Width (in)</label>
            <input id="wIn" type="number" step="0.01" min="0.01" value="4" disabled />
          </div>
          <div>
            <label>Height (in)</label>
            <input id="hIn" type="number" step="0.01" min="0.01" value="6" disabled />
          </div>
        </div>

        <div class="row">
          <label>Scaling</label>
          <select id="mode">${modeOptions}</select>
        </div>

        <div class="row">
          <label>Orientation</label>
          <select id="orient">
            <option value="auto">Auto</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>

        <div class="row">
          <label>DPI (images)</label>
          <input id="dpi" type="number" step="1" min="10" max="1200" value="300" />
        </div>

        <div class="row">
          <button id="go" class="primary" disabled>Generate + Download PDF</button>
        </div>

        <div id="meta" class="meta"></div>
        <div id="status" class="status"></div>
      </section>

      <section class="panel">
        <h2>Preview</h2>
        <canvas id="preview"></canvas>
        <div class="hint">Preview shows page 1 placement on the target size.</div>
      </section>
    </main>
  </div>
  `;
}

let currentInput = null;

async function refresh() {
  const status = $('#status');
  status.textContent = '';

  if (!currentInput) return;
  const mode = $('#mode').value;
  const orient = $('#orient').value;
  const dpi = clamp(Number($('#dpi')?.value || 300), 10, 1200);

  await renderPreview({ input: currentInput, mode, orient, dpi });
}

async function main() {
  $('#app').innerHTML = appHtml();

  // defaults
  $('#preset').value = '4 x 6 in';
  $('#mode').value = 'contain';
  setCustomEnabled(false);

  const updateButtons = () => {
    const ok = Boolean(currentInput);
    $('#go').disabled = !ok;
  };

  $('#preset').addEventListener('change', async () => {
    const isCustom = $('#preset').value === 'custom';
    setCustomEnabled(isCustom);
    if (!isCustom) {
      const p = PRESETS.find((x) => x.label === $('#preset').value);
      $('#wIn').value = p.wIn;
      $('#hIn').value = p.hIn;
    }
    await refresh();
  });

  for (const id of ['wIn', 'hIn', 'mode', 'orient', 'dpi']) {
    $(id.startsWith('#') ? id : '#' + id).addEventListener('change', refresh);
  }


  $('#file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0] || null;
    currentInput = null;
    updateButtons();

    if (!f) return;

    const status = $('#status');
    const meta = $('#meta');
    try {
      status.textContent = 'Loading…';
      await time(10);
      const input = await loadInput(f);
      currentInput = input;

      if (input.kind === 'pdf') {
        meta.textContent = `${input.name} — PDF (${input.pageCount} pages)`;
      } else {
        meta.textContent = `${input.name} — Image (${input.w}×${input.h}px @ 300dpi)`;
      }

      status.textContent = '';
      updateButtons();
      await refresh();
    } catch (err) {
      status.textContent = String(err?.message || err);
      meta.textContent = '';
      currentInput = null;
      updateButtons();
    }
  });

  $('#go').addEventListener('click', async () => {
    const status = $('#status');
    try {
      if (!currentInput) return;
      const { wIn, hIn } = getOutputSizeIn();
      const mode = $('#mode').value;
      const orient = $('#orient').value;

      status.textContent = `Generating ${fmtIn(wIn)}×${fmtIn(hIn)} PDF…`;
      await time(10);

      const dpi = clamp(Number($('#dpi')?.value || 300), 10, 1200);
      const bytes = await buildOutputPdf({ input: currentInput, wIn, hIn, mode, orient, dpi });
      const base = (currentInput.name || 'output').replace(/\.(pdf|png|jpe?g)$/i, '');
      const outName = `${base}_${fmtIn(wIn)}x${fmtIn(hIn)}_${mode}.pdf`;
      downloadBytes(bytes, outName);
      status.textContent = 'Downloaded.';
    } catch (err) {
      status.textContent = String(err?.message || err);
    }
  });

  updateButtons();
}

main();
