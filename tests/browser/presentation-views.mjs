const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const engine of [webkit, chromium]) {
  const browser = await engine.launch(engine === chromium && process.platform === 'win32'
    ? { channel: 'msedge', headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.KAIDA_TEST_URL || 'http://localhost:4173/KaidaNotes/';
  await page.goto(base + '?debug=1');
  await page.waitForFunction(() => window.kaidaDebug);
  const link = await page.evaluate(async () => {
    const { createComposition, appendBol } = await import('./js/model.js');
    const { createShareLink } = await import('./js/share-link.js');
    let c = createComposition();
    for (let row = 0; row < 4; row++) {
      for (const [i, text] of ['Dha', 'Dhi', 'TeRe', 'KeTe'].entries()) c = appendBol(c, text, row > 0 && i === 0);
    }
    c.notes = 'Notes remain in every view.\nŻółć — end of sheet.';
    c.clapping = { timestamps: Array.from({ length: c.bols.length + 1 }, (_, i) => 500 * i),
      structure: [4, 4, 4, 4], name: 'Tintal', snap: true };
    return createShareLink(c, location.href);
  });
  const url = new URL(link); url.searchParams.set('debug', '1');
  await page.goto(url.href); await page.waitForFunction(() => window.kaidaDebug);
  const composition = await page.evaluate(() => kaidaDebug.snapshot());
  await page.locator('#presentation-open').click();
  const dimensions = {};
  for (const mode of ['both', 'bols', 'blocks']) {
    await page.locator(`[data-presentation-view="${mode}"]`).click();
    await page.waitForFunction(() => !document.querySelector('#presentation-save').disabled);
    assert.equal(await page.locator('#presentation-content .presentation-notation').count(), mode === 'blocks' ? 0 : 1);
    assert.equal(await page.locator('#presentation-content .presentation-plot').count(), mode === 'bols' ? 0 : 1);
    assert.equal(await page.locator('#presentation-content .presentation-notes').count(), 1);
    assert.equal(await page.locator('#presentation-content button').count(), 0);
    assert.equal(await page.locator('.presentation-views [aria-pressed="true"]').count(), 1);
    const canvas = await page.locator('#presentation-content').evaluate(async content => {
      const { renderPresentationCanvas } = await import('./js/presentation-canvas.js');
      const c = renderPresentationCanvas(content);
      return { width: c.width, height: c.height };
    });
    const downloaded = page.waitForEvent('download');
    await page.locator('#presentation-save').click();
    const download = await downloaded;
    const png = await readFile(await download.path());
    assert.equal(png.readUInt32BE(16), canvas.width);
    assert.equal(png.readUInt32BE(20), canvas.height);
    assert.ok(download.suggestedFilename().startsWith('DhaDhiTeReKeTe_'));
    dimensions[mode] = canvas;
    assert.deepEqual(await page.evaluate(() => kaidaDebug.snapshot()), composition);
  }
  assert.ok(dimensions.both.height > dimensions.bols.height);
  assert.ok(dimensions.both.height > dimensions.blocks.height);
  // Rapid switching must not reuse a PNG prepared for the previous mode.
  await page.locator('[data-presentation-view="bols"]').click();
  await page.locator('[data-presentation-view="both"]').click();
  await page.locator('[data-presentation-view="blocks"]').click();
  await page.waitForFunction(() => !document.querySelector('#presentation-share').disabled);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => {
      const view = new DataView(await files[0].arrayBuffer());
      window.sharedPNG = { width: view.getUint32(16), height: view.getUint32(20) };
    } });
  });
  await page.locator('#presentation-share').click();
  await page.waitForFunction(() => window.sharedPNG);
  assert.deepEqual(await page.evaluate(() => window.sharedPNG), dimensions.blocks);
  await page.setViewportSize({ width: 1000, height: 800 });
  assert.ok(await page.locator('.presentation-views').isVisible());
  await page.locator('#presentation-close').click();
  await page.locator('#clear-clapping').click();
  await page.locator('#presentation-open').click();
  assert.equal(await page.locator('[data-presentation-view="blocks"]').isDisabled(), true);
  assert.equal(await page.locator('#presentation-content .presentation-notation').count(), 1);
  assert.deepEqual(errors, []);
  await browser.close();
}
console.log('PASS: Both/Bols/Blocks preview and PNG downloads, correct shared image after rapid switching, unchanged data, notes, filenames and no-recording fallback in Chromium/WebKit.');
