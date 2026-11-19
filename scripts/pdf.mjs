import { chromium } from 'playwright';
import { writeFile, stat } from 'node:fs/promises';
import { createStaticServer } from './serve.mjs';

const started = performance.now();
const server = createStaticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;

try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const artwork = await page.evaluate(() => {
    function makeCanvas(width, height, background) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      return { canvas, context };
    }
    function rectangle(context, left, top, width, height, colour) {
      context.fillStyle = colour;
      context.fillRect(left, top, width, height);
    }
    function circle(context, centreLeft, centreTop, radius, colour) {
      context.fillStyle = colour;
      context.beginPath();
      context.arc(centreLeft, centreTop, radius, 0, Math.PI * 2);
      context.fill();
    }
    function star(context, centreLeft, centreTop, outerRadius, innerRadius, points, colour) {
      context.beginPath();
      for (let point = 0; point < points * 2; point += 1) {
        const angle = point * Math.PI / points - Math.PI / 2;
        const radius = point % 2 === 0 ? outerRadius : innerRadius;
        const left = centreLeft + Math.cos(angle) * radius;
        const top = centreTop + Math.sin(angle) * radius;
        if (point === 0) context.moveTo(left, top);
        else context.lineTo(left, top);
      }
      context.closePath();
      context.fillStyle = colour;
      context.fill();
    }

    const hero = makeCanvas(1000, 840, '#d9f36a');
    rectangle(hero.context, 66, 65, 440, 440, '#ff765e');
    circle(hero.context, 735, 256, 200, '#c5e1f3');
    circle(hero.context, 310, 598, 189, '#23776b');
    rectangle(hero.context, 121, 598, 378, 174, '#23776b');
    circle(hero.context, 286, 285, 111, '#f9faf7');
    circle(hero.context, 286, 285, 72, '#ff765e');
    star(hero.context, 572, 438, 194, 89, 10, '#20231f');
    hero.context.save();
    hero.context.beginPath();
    hero.context.rect(578, 611, 351, 161);
    hero.context.clip();
    rectangle(hero.context, 578, 611, 351, 161, '#f9faf7');
    hero.context.strokeStyle = '#20231f';
    hero.context.lineWidth = 12;
    for (let stripe = 480; stripe < 1100; stripe += 40) {
      hero.context.beginPath();
      hero.context.moveTo(stripe, 785);
      hero.context.lineTo(stripe + 180, 605);
      hero.context.stroke();
    }
    hero.context.restore();

    const first = makeCanvas(1000, 620, '#d9f36a');
    rectangle(first.context, 106, 68, 788, 484, '#f9faf7');
    rectangle(first.context, 106, 68, 788, 58, '#20231f');
    for (let dot = 0; dot < 3; dot += 1) circle(first.context, 136 + dot * 20, 97, 5, '#d9f36a');
    rectangle(first.context, 144, 164, 276, 264, '#c5e1f3');
    first.context.fillStyle = '#20231f';
    first.context.font = '600 130px sans-serif';
    first.context.fillText('Aa', 178, 340);
    rectangle(first.context, 462, 164, 218, 16, '#20231f');
    rectangle(first.context, 462, 198, 156, 9, '#b8c0b5');
    rectangle(first.context, 462, 220, 286, 9, '#b8c0b5');
    rectangle(first.context, 462, 266, 151, 55, '#23776b');
    rectangle(first.context, 628, 266, 151, 55, '#d9f36a');
    rectangle(first.context, 462, 348, 317, 80, '#edf0e9');
    for (const [offset, colour] of [[0, '#ff765e'], [76, '#23776b'], [152, '#c5e1f3'], [228, '#20231f']]) {
      circle(first.context, 497 + offset, 388, 24, colour);
    }
    rectangle(first.context, 144, 468, 635, 9, '#cbd2c7');
    rectangle(first.context, 144, 492, 421, 9, '#cbd2c7');

    const second = makeCanvas(1000, 620, '#c5e1f3');
    second.context.strokeStyle = '#20231f';
    second.context.lineWidth = 3;
    second.context.beginPath();
    second.context.moveTo(212, 310);
    second.context.lineTo(785, 310);
    second.context.moveTo(500, 140);
    second.context.lineTo(500, 485);
    second.context.stroke();
    rectangle(second.context, 114, 221, 178, 178, '#23776b');
    circle(second.context, 500, 152, 72, '#ff765e');
    circle(second.context, 500, 310, 89, '#f9faf7');
    star(second.context, 500, 310, 51, 24, 8, '#20231f');
    rectangle(second.context, 706, 221, 178, 178, '#d9f36a');
    circle(second.context, 795, 310, 42, '#20231f');
    rectangle(second.context, 458, 466, 84, 40, '#20231f');
    for (const centreLeft of [318, 353, 632, 667]) circle(second.context, centreLeft, 310, 5, '#20231f');

    return [hero, first, second].map(({ canvas }) => canvas.toDataURL('image/png').split(',')[1]);
  });

  for (const [index, filename] of ['composition.png', 'project-01.png', 'project-02.png'].entries()) {
    await writeFile(`dist/assets/${filename}`, Buffer.from(artwork[index], 'base64'));
  }

  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => {
      image.loading = 'eager';
      return image.decode();
    }));
  });
  await page.pdf({ path: 'dist/assets/cv.pdf', preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  const pdf = await stat('dist/assets/cv.pdf');
  console.log(`Generated original artwork and static CV PDF (${(pdf.size / 1024).toFixed(0)} KB) in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}