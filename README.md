# pdf-resize-tool-browser (/resize)

> **AI-generated code notice:** This project was largely generated and iterated with the help of AI. Please review and test thoroughly before using in production.

Client-side (browser-only) tool to resize **PDFs or images** into a new **PDF** at a target size (e.g. 4×6). Think “Print to PDF” with a custom paper size.

## Privacy / Security
- **All processing happens locally in your browser** (via `pdf-lib` + `pdfjs-dist`).
- The app **does not upload** your PDF/image to the server.
- The server (optional) only serves static files (HTML/JS/CSS) for the UI.

## Features
- Input: **PDF**, **JPG**, **PNG**
- Output: **PDF only**
- Multi-page PDFs supported (resizes every page)
- Modes:
  - **Fit (contain)**: no distortion, no crop
  - **Fill (cover)**: no distortion, crop as needed
  - **Distort**: stretch to fill
- **Auto-rotate** to best fit
- Preview (placement for page 1)

## Run locally

### Dev
```bash
npm install
npm run dev
```

### Production build
Build + serve the static `dist/` bundle:

```bash
npm run build
npm run preview
```

## Self-hosting under a path prefix
This app is path-prefix safe when built with `base: './'` (see `vite.config.js`).

If you use the included `server.js`, it can:
- redirect `/prefix` → `/prefix/` (keeps relative assets stable)
- rewrite `/<prefix>/assets/*` → `/assets/*`

This makes it easy to mount under subpaths like `/resize/` behind a reverse proxy.

## Offline / air-gapped use
Browsers often block PDF.js workers when opened directly from `file://`, so for offline use you should serve the built files with a tiny local server.

### Build an offline zip
```bash
./scripts/release.sh
```
This produces `pdf-resize-browser-tool-dist.zip` (contains `dist/`).

### Run offline (no internet)
1) Unzip the release zip
2) Start a local server in the folder that contains `index.html` (pick one):

**Option A — Python (recommended)**
```bash
python3 -m http.server 8000
```

**Option B — Node (serve static files)**
```bash
npx serve .
```

**Option C — Node (use the included server.js)**
If you cloned the repo (not just the zip):
```bash
npm install
npm run build
npm run start
```

3) Open:
- `http://localhost:8000/` (or whatever port your server prints)

## License
Add a LICENSE file if you plan to publish this repo publicly.
