import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from '../api/search.js';
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/distance.js': ['distance.js', 'text/javascript; charset=utf-8'] };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/search') {
    req.query = Object.fromEntries(url.searchParams);
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); return res; };
    return handler(req, res);
  }
  const file = files[url.pathname];
  if (!file) { res.writeHead(404).end('Not found'); return; }
  try { res.setHeader('Content-Type', file[1]); res.end(await readFile(new URL(`../public/${file[0]}`, import.meta.url))); }
  catch { res.writeHead(500).end('Unable to load file'); }
}).listen(3000, '127.0.0.1', () => console.log('Open http://localhost:3000'));
