import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

export function createStaticServer(directory = resolve('dist')) {
  const root = resolve(directory);
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filename = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!filename.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const information = await stat(filename);
      if (!information.isFile()) {
        response.writeHead(404).end();
        return;
      }
      const body = request.method === 'HEAD' ? undefined : await readFile(filename);
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(filename)] ?? 'application/octet-stream',
        'Content-Length': information.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      }).end(body);
    } catch (error) {
      response.writeHead(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 400).end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createStaticServer();
  let port = Number(process.env.PORT ?? 5173);
  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && port < 5193) {
      port += 1;
      server.listen(port, '127.0.0.1');
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.on('listening', () => console.log(`CV preview: http://127.0.0.1:${port}`));
  server.listen(port, '127.0.0.1');
}