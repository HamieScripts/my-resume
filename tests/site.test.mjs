import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createStaticServer } from '../scripts/serve.mjs';

let browser;
let server;
let origin;

before(async () => {
  await mkdir('.artifacts', { recursive: true });
  server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

for (const width of [320, 390, 768, 1280, 1600]) {
  test(`CV fits and all local assets render at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      page.on('requestfailed', request => failures.push(request.url()));
      page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
      await page.goto(origin, { waitUntil: 'networkidle' });
      const layout = await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); }));
        const textBounds = [...document.querySelectorAll('h1, h2, h3, a, .profile, .skill-list li')].map(element => {
          const bounds = element.getBoundingClientRect();
          return { text: element.textContent.trim(), left: bounds.left, right: bounds.right, overflow: element.scrollWidth > element.clientWidth + 1 };
        });
        const image = document.querySelector('.hero-art');
        const canvas = document.createElement('canvas');
        canvas.width = 20;
        canvas.height = 20;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, 20, 20);
        const pixels = context.getImageData(0, 0, 20, 20).data;
        const colours = new Set();
        for (let offset = 0; offset < pixels.length; offset += 4) colours.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
        return {
          fits: document.documentElement.scrollWidth <= innerWidth,
          textBounds,
          imagesReady: [...document.images].every(image => image.complete && image.naturalWidth > 0),
          fontsReady: document.fonts.check('600 20px "Space Grotesk"') && document.fonts.check('400 16px "DM Sans"'),
          colours: colours.size,
          noRuntimeScripts: document.scripts.length === 0,
          noNavigation: document.querySelector('nav') === null,
          title: document.title,
        };
      });
      assert.equal(layout.fits, true, 'Horizontal page overflow');
      for (const bounds of layout.textBounds) {
        assert.ok(bounds.left >= -1 && bounds.right <= width + 1, `Out-of-bounds text: ${bounds.text}`);
        assert.equal(bounds.overflow, false, `Text overflows its box: ${bounds.text}`);
      }
      assert.equal(layout.imagesReady, true);
      assert.equal(layout.fontsReady, true);
      assert.ok(layout.colours > 10, 'Geometric artwork is blank or missing');
      assert.equal(layout.noRuntimeScripts, true);
      assert.equal(layout.noNavigation, true);
      assert.equal(layout.title, 'Jamie Clark | Resume');
      assert.equal(await page.locator('.skill-list li').count(), 27);
      assert.equal(await page.locator('.skill-legend li').count(), 6);
      assert.deepEqual(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.getAttribute('aria-labelledby'))), ['name', 'skills-heading', 'work-heading', 'experience-heading', 'education-heading']);
      assert.equal(await page.locator('.project').count(), 5);
      assert.ok((await page.locator('.experience').innerText()).includes('includes pre-acquisition tenure'));
      assert.equal(/OnScale|Solve/.test(await page.locator('.experience').innerText()), false);
      assert.equal(/Your Name|Example Project|private draft|not approved/i.test(await page.locator('body').innerText()), false);
      assert.deepEqual(failures, []);
      if ([390, 1280].includes(width)) {
        await page.screenshot({ path: `.artifacts/cv-${width}.png`, fullPage: true, animations: 'disabled' });
        await page.screenshot({ path: `.artifacts/cv-${width}-viewport.png`, animations: 'disabled' });
      }
    } finally {
      await page.close();
    }
  });
}

test('keyboard access, stable hover, profile link, and static PDF download work', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  try {
    await page.goto(origin);
    const downloadLink = page.getByRole('link', { name: 'Download resume', exact: true });
    await page.keyboard.press('Tab');
    assert.equal(await downloadLink.evaluate(element => element === document.activeElement), true);
    const beforeHover = await downloadLink.boundingBox();
    await downloadLink.hover();
    assert.deepEqual(await downloadLink.boundingBox(), beforeHover);
    const linkedin = page.getByRole('link', { name: 'LinkedIn', exact: true }).first();
    assert.equal(await linkedin.getAttribute('href'), 'https://www.linkedin.com/in/jamie-clark-54722659/');
    assert.equal(await linkedin.getAttribute('target'), '_blank');
    const [download] = await Promise.all([page.waitForEvent('download'), downloadLink.click()]);
    assert.equal(download.suggestedFilename(), 'jamie-clark-resume.pdf');
    const response = await page.request.get(`${origin}/assets/cv.pdf`);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /application\/pdf/);
    assert.equal((await response.body()).subarray(0, 5).toString(), '%PDF-');
  } finally {
    await page.close();
  }
});

test('PDF is two readable A4 pages with CV content, preserved links, and in-bounds text', async () => {
  const loading = getDocument({ data: new Uint8Array(await readFile('dist/assets/cv.pdf')), useSystemFonts: true });
  const document = await loading.promise;
  try {
    assert.equal(document.numPages, 2);
    let combined = '';
    const links = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      assert.ok(Math.abs(viewport.width - 595.28) < 2);
      assert.ok(Math.abs(viewport.height - 841.89) < 2);
      const content = await page.getTextContent();
      for (const item of content.items.filter(item => item.str?.trim())) {
        combined += `${item.str} `;
        assert.ok(item.transform[4] >= 0 && item.transform[4] + item.width <= viewport.width + 2, `PDF text clipped horizontally: ${item.str}`);
        assert.ok(item.transform[5] >= 0 && item.transform[5] <= viewport.height, `PDF text clipped vertically: ${item.str}`);
      }
      links.push(...await page.getAnnotations());
    }
    const normalised = combined.normalize('NFKC').replace(/\s/g, '');
    for (const text of ['Jamie Clark', 'R&D Software Engineer & Developer Experience Expert', 'Skills & strengths', '80% of Ansys product teams', 'Shared Component Library', 'Application Template Repository & Agent Enablement', 'Project Delivery & Administration Automation', 'Generated Component Documentation', 'Design Language & Third-Party Integration', 'Ansys', 'Principal R&D Engineer', 'QA Engineer', 'University of Stirling', "Let's connect"]) {
      assert.ok(normalised.includes(text.normalize('NFKC').replace(/\s/g, '')), `PDF missing content: ${text}`);
    }
    assert.equal(/private draft|not approved|C\+\+/i.test(combined), false);
    assert.ok(links.some(link => link.url === 'https://www.linkedin.com/in/jamie-clark-54722659/'));
    const page = await browser.newPage();
    try {
      await page.goto(origin);
      const phrases = await page.locator('h1, .specialism, .location, .profile, .skill-legend li, .skill-list li, .project-caption h3, .project-caption p, .entry-meta p, .experience-entry h3, .experience-entry p, .education-entry h3, .education-entry p').allTextContents();
      for (const phrase of phrases) assert.ok(normalised.includes(phrase.normalize('NFKC').replace(/\s/g, '')), `PDF missing page content: ${phrase}`);
    } finally {
      await page.close();
    }
  } finally {
    await loading.destroy();
  }
});

test('site and PDF work under a GitHub Pages-style repository subpath', async () => {
  const directory = resolve('.artifacts/pages');
  await cp('dist', resolve(directory, 'example-repo'), { recursive: true });
  const nested = createStaticServer(directory);
  await new Promise(resolve => nested.listen(0, '127.0.0.1', resolve));
  const page = await browser.newPage();
  try {
    const failures = [];
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    const base = `http://127.0.0.1:${nested.address().port}/example-repo/`;
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.hero-art').evaluate(image => image.decode());
    assert.equal(await page.locator('h1').innerText(), 'Jamie Clark.');
    const response = await page.request.get(new URL(await page.getByRole('link', { name: 'Download resume', exact: true }).getAttribute('href'), base).href);
    assert.equal(response.status(), 200);
    assert.deepEqual(failures, []);
  } finally {
    await page.close();
    await new Promise(resolve => nested.close(resolve));
  }
});

test('deployment output contains only static site files and approved assets', async () => {
  const entries = await readdir('dist', { recursive: true });
  for (const filename of entries) {
    assert.match(filename, /^(?:assets(?:[\\/]|$)|index\.html$|styles\.css$|preview\.css$)/, `Unexpected deployment entry: ${filename}`);
  }
  for (const filename of ['index.html', 'styles.css', 'preview.css', 'assets/cv.pdf', 'assets/project-03.png', 'assets/project-04.png']) {
    assert.ok((await readFile(`dist/${filename}`)).length > 0);
  }
});