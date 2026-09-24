import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const root = dirname(fileURLToPath(import.meta.url));
const partialsDir = resolve(root, 'src/partials');
const INCLUDE = /<include\s+src="([^"]+)"\s*\/?>(?:\s*<\/include>)?/g;

/**
 * Zero-dependency HTML partials: `<include src="header.html" />` is replaced
 * with the file from src/partials at build and dev time. Includes may nest.
 */
function htmlPartials() {
  const inline = (html, depth = 0) => {
    if (depth > 8) throw new Error('html-partials: include depth exceeded (circular include?)');
    return html.replace(INCLUDE, (_, file) =>
      inline(readFileSync(resolve(partialsDir, file), 'utf8'), depth + 1),
    );
  };

  return {
    name: 'html-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => inline(html) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(partialsDir)) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  plugins: [htmlPartials(), tailwindcss()],
});
