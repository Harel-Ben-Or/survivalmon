// Tiny zero-dependency static file server for local development.
// Usage: node server.js [port]
// Listens on every network interface, so a phone on the same Wi-Fi can play too.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  // Dev helper: POST {name, data: "data:image/png;base64,..."} saves a canvas snapshot to mockups/snapshots/
  if (req.method === 'POST' && urlPath === '/__snapshot') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 20e6) req.destroy(); });
    req.on('end', () => {
      try {
        const { name, data } = JSON.parse(body);
        const safe = String(name).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'shot';
        const dir = path.join(ROOT, 'mockups', 'snapshots');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${safe}.png`), Buffer.from(String(data).split(',')[1], 'base64'));
        res.writeHead(200); res.end('saved');
      } catch { res.writeHead(400); res.end('bad snapshot'); }
    });
    return;
  }
  const file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Survivelmon running at http://localhost:${PORT}`);
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `http://${n.address}:${PORT}`);
  if (lan.length) console.log(`On your phone (same Wi-Fi): ${lan.join('  or  ')}`);
});
