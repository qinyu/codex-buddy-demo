#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export async function startBoardServer(dir, { noOpen = false } = {}) {
  if (!dir) {
    throw new Error('用法：node open_review_board.mjs <product-workflow-dir> [--no-open]');
  }
  const root = path.resolve(dir);
  const boardRoot = path.join(root, '.review-board');
  try {
    await fs.access(path.join(boardRoot, 'index.html'));
  } catch {
    const installed = spawnSync(process.execPath, [path.join(scriptDir, 'render_review_board.mjs'), root], { stdio: 'ignore' });
    if (installed.status !== 0) {
      throw new Error(`failed to render board (${installed.status || 1})`);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/.review-board/index.html';
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const href = `http://127.0.0.1:${port}/.review-board/index.html`;
  console.log(href);
  if (!noOpen) {
    const opener = process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', href], { detached: true, stdio: 'ignore' })
      : spawn('open', [href], { detached: true, stdio: 'ignore' });
    opener.unref();
  }
  return { server, href };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const noOpen = args.includes('--no-open');
  const dir = args.find((arg) => !arg.startsWith('--'));
  startBoardServer(dir, { noOpen }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
