import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'assets/fonts'), { recursive: true });
await mkdir(resolve(output, 'assets/icons'), { recursive: true });
await copyFile('src/index.html', resolve(output, 'index.html'));
await copyFile('src/preview.css', resolve(output, 'preview.css'));
await cp('src/assets', resolve(output, 'assets'), { recursive: true });

for (const [family, weights] of [['space-grotesk', [500, 600, 700]], ['dm-sans', [400, 500]]]) {
  for (const weight of weights) {
    const filename = `${family}-latin-${weight}-normal.woff2`;
    await copyFile(`node_modules/@fontsource/${family}/files/${filename}`, resolve(output, 'assets/fonts', filename));
  }
  await copyFile(`node_modules/@fontsource/${family}/LICENSE`, resolve(output, 'assets/fonts', `${family}-LICENSE.txt`));
}

for (const icon of ['arrow-up-right', 'arrow-down-to-line']) {
  await copyFile(`node_modules/lucide-static/icons/${icon}.svg`, resolve(output, 'assets/icons', `${icon}.svg`));
}
await copyFile('node_modules/lucide-static/LICENSE', resolve(output, 'assets/icons/LICENSE.txt'));
console.log('Prepared static HTML, local fonts, icons, and license notices.');