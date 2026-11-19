import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { transform } from 'lightningcss';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const compiler = await compile(await readFile('src/styles.css', 'utf8'), {
  base: resolve('src'),
  onDependency() {},
});
const scanner = new Scanner({ sources: [{ base: resolve('src'), pattern: '**/*.html', negated: false }] });
const compiled = compiler.build(scanner.scan());
const { code } = transform({ filename: 'styles.css', code: Buffer.from(compiled), minify: true });
await writeFile('dist/styles.css', code);
console.log(`Compiled Tailwind v4: ${(code.length / 1024).toFixed(1)} KB CSS.`);