# pdf-resize-tool-browser

Client-side (browser-only) tool to resize **PDFs or images** into a new **PDF** at a target size (e.g. 4×6) like “Print to Adobe PDF” with a custom paper size.

## Features
- Input: **PDF**, **JPG**, **PNG**
- Output: **PDF only**
- Multi-page PDFs supported (resizes every page)
- Modes:
  - **Fit (contain)**: no distortion, no crop
  - **Fill (cover)**: no distortion, crop as needed
  - **Distort**: stretch to fill
- **Auto-rotate** to best fit
- Preview window (shows placement for page 1)
- Staples-ish styling (red accent)

## Dev
```bash
npm install
npm run dev
```

## Prod (local service)
Build + serve the static `dist/` bundle via `server.js`:

```bash
npm run build
PORT=3340 npm run start
```

### Cloudflare Tunnel hosting under a prefix
This is set up like the banner app:
- `vite.config.js` uses `base: './'`
- `server.js` rewrites `/<prefix>/assets/*` → `/assets/*`
- and redirects `/prefix` → `/prefix/` to keep relative assets stable.

Example tunnel rule:
- `staples.okok.bet/resize*` → `http://10.0.0.77:3340`

## Systemd user service
Installed at:
- `~/.config/systemd/user/pdf-resize-tool-browser.service`

Commands:
```bash
systemctl --user restart pdf-resize-tool-browser.service
systemctl --user status pdf-resize-tool-browser.service
```
