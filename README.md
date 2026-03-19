# pdf-resize-tool-browser (/resize)

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

## License
Add a LICENSE file if you plan to publish this repo publicly.
