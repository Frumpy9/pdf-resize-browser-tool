#!/usr/bin/env node
import http from 'node:http';
import sirv from 'sirv';

const PORT = Number(process.env.PORT || 3340);
const HOST = process.env.HOST || '0.0.0.0';

const serve = sirv('dist', {
  etag: true,
  single: true,
  setHeaders(res, pathname) {
    // Cache hashed asset files; never cache the SPA HTML.
    if (pathname.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=14400');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
});

function isProbablyFilePath(p) {
  return /\.[a-zA-Z0-9]{1,8}$/.test(p);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname || '/';

    // Ensure trailing slash for prefix paths to keep relative asset resolution stable.
    // Example: /resize -> /resize/
    if (!p.endsWith('/') && !isProbablyFilePath(p)) {
      res.statusCode = 302;
      res.setHeader('Location', p + '/' + (url.search || ''));
      res.end();
      return;
    }

    // If hosted at /resize (or any prefix), requests may arrive as /resize/assets/...;
    // rewrite to /assets/... so sirv can find the built asset.
    if (p.includes('/assets/')) {
      const idx = p.indexOf('/assets/');
      url.pathname = p.slice(idx);
      req.url = url.pathname + url.search;
    }

    return serve(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.end('server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`pdf-resize-tool-browser listening on http://${HOST}:${PORT}`);
});
