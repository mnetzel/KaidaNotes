const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';

for (const engine of [webkit, chromium]) {
  const browser = await engine.launch(engine === chromium && process.platform === 'win32'
    ? { channel: 'msedge', headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    window.testAudioCalls = [];
    if (!Native) return;
    window.AudioContext = new Proxy(Native, { construct(Target, args) {
      const context = new Target(...args);
      const mute = context.createGain(); mute.gain.value = 0; mute.connect(context.destination);
      Object.defineProperty(context, 'destination', { get: () => mute });
      const createSource = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const source = createSource(), start = source.start.bind(source);
        source.start = (when, offset, duration) => {
          window.testAudioCalls.push({ when, offset, duration });
          return start(when, offset, duration);
        };
        return source;
      };
      return context;
    } });
  });
  const base = process.env.KAIDA_TEST_URL || 'http://localhost:4173/KaidaNotes/';
  await page.goto(base + '?debug=1'); await page.waitForFunction(() => window.kaidaDebug);
  const link = await page.evaluate(async () => {
    const { createComposition, appendToVibhag } = await import('./js/model.js');
    const { createShareLink } = await import('./js/share-link.js');
    const { manualCapture, createManualDraft } = await import('./js/manual-timing.js');
    let c = createComposition(); c.vibhagStructure = [2, 2, 2, 2];
    const tags = [
      { dayanArticulation: 'sur', rightHandFinger: '2' },
      { dayanArticulation: 'kinar', rightHandFinger: '2' },
      { dayanArticulation: 'open-tin', rightHandFinger: '2' },
      { leftHandFinger: '1-5' },
    ];
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 2; i++) {
        c = appendToVibhag(c, ['Ta', 'Na', 'Tin', 'Ke'][row], row + 1);
        Object.assign(c.bols.at(-1).tags, tags[row]);
      }
    }
    c.notes = 'These notes should return after practice, without appearing inside it.';
    c.clapping = manualCapture(createManualDraft(c), c.bols);
    return createShareLink(c, location.href);
  });
  const url = new URL(link); url.searchParams.set('debug', '1');
  await page.goto(url.href); await page.waitForFunction(() => window.kaidaDebug);
  const original = await page.evaluate(() => kaidaDebug.snapshot());
  await page.locator('#presentation-open').click();
  await page.locator('#presentation-sound').check();
  await page.locator('#presentation-zoom').click();
  assert.equal(await page.locator('#presentation-dialog').evaluate(n => n.classList.contains('practice-view')), true);
  assert.equal(await page.locator('#presentation-content h1, #presentation-content .presentation-notes, #presentation-content .notation').count(), 0);
  assert.equal(await page.locator('#presentation-content .clap-vibhag-row').count(), 4);
  assert.equal(await page.locator('[data-loop-vibhag][aria-pressed="true"]').count(), 4);
  assert.equal(await page.locator('#presentation-save').isVisible(), false);
  assert.equal(await page.locator('#presentation-zoom').isVisible(), false);
  assert.equal(await page.locator('[data-loop-gap="0"]').getAttribute('aria-pressed'), 'true');
  const outlineStyle = await page.locator('#presentation-content .clap-block-playhead').first().evaluate(n => {
    const style = getComputedStyle(n);
    return { stroke: style.stroke, width: style.strokeWidth };
  });
  assert.deepEqual(outlineStyle, { stroke: 'rgb(239, 16, 16)', width: '24px' });
  const native = await page.evaluate(() => !!(window.AudioContext || window.webkitAudioContext));
  if (native) {
    await page.waitForFunction(() => !!document.querySelector('#presentation-content .clap-block-playhead.playback-current'));
    assert.equal(await page.locator('#practice-toggle').textContent(), 'Stop');
  }
  assert.equal(await page.locator('#practice-vibhags').count(), 0);
  assert.equal(await page.locator('#presentation-content input[type="checkbox"]').count(), 0);
  await page.locator('[data-loop-vibhag="1"] .clap-block-label:not(.clap-sound-label)').first().click();
  await page.locator('[data-loop-vibhag="3"]').click();
  assert.equal(await page.locator('.practice-excluded').count(), 2);
  assert.equal(await page.locator('[data-loop-vibhag="1"]').evaluate(n => getComputedStyle(n).opacity), '0.5');
  await page.locator('[data-loop-vibhag="1"]').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('[data-loop-vibhag="1"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-loop-vibhag="1"]').getAttribute('aria-pressed'), 'false');
  await page.locator('#practice-controls [data-tempo-step="1"]').click();
  assert.equal(await page.locator('#practice-tempo').textContent(), '140 BPM');
  await page.locator('#practice-controls [data-tempo-step="-1"]').click();
  assert.equal(await page.locator('#practice-tempo').textContent(), '120 BPM');
  for (let i = 0; i < 6; i++) await page.locator('#practice-controls [data-tempo-step="1"]').click();
  assert.equal(await page.locator('#practice-tempo').textContent(), '240 BPM');
  assert.equal(await page.locator('#practice-controls [data-tempo-step="1"]').isDisabled(), false);
  for (let i = 0; i < 8; i++) await page.locator('#practice-controls [data-tempo-step="1"]').click();
  assert.equal(await page.locator('#practice-tempo').textContent(), '400 BPM');
  assert.equal(await page.locator('#presentation-tempo-output').textContent(), '400 BPM');
  assert.equal(await page.locator('#practice-controls [data-tempo-step="1"]').isDisabled(), true);
  for (let i = 0; i < 8; i++) await page.locator('#practice-controls [data-tempo-step="-1"]').click();
  if (native) {
    await page.evaluate(() => { testAudioCalls.length = 0; });
    await page.waitForFunction(() => testAudioCalls.length >= 10);
    const calls = await page.evaluate(() => testAudioCalls.slice(0, 10));
    assert.ok(calls.every(call => [.014, 3.008].includes(call.offset))); // Only V1 and V3.
    for (let i = 1; i < calls.length; i++) assert.ok(Math.abs(calls[i].when - calls[i - 1].when - .25) < 1e-6);
    assert.equal(await page.locator('#practice-toggle').textContent(), 'Stop');
    const currentRows = await page.evaluate(async () => {
      const seen = new Set();
      for (let i = 0; i < 85; i++) {
        await new Promise(requestAnimationFrame);
        document.querySelectorAll('#presentation-content .clap-block-playhead.playback-current').forEach(n => seen.add(Number(n.closest('.clap-vibhag-row').dataset.vibhag)));
      }
      return [...seen].sort();
    });
    assert.deepEqual(currentRows, [0, 2]);
  }
  for (const gap of [1, 2]) {
    await page.locator(`[data-loop-gap="${gap}"]`).click();
    assert.equal(await page.locator(`[data-loop-gap="${gap}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.practice-gaps [aria-pressed="true"]').count(), 1);
    if (native) {
      await page.evaluate(() => { testAudioCalls.length = 0; });
      await page.waitForFunction(() => testAudioCalls.length >= 8);
      const calls = await page.evaluate(() => testAudioCalls.slice(0, 8));
      const intervals = calls.slice(1).map((call, i) => call.when - calls[i].when);
      const longInterval = .25 * (1 + gap); // Last bol duration + chosen silent matras.
      assert.ok(calls.every(call => [.014, 3.008].includes(call.offset)));
      assert.ok(intervals.every(n => Math.abs(n - .25) < 1e-6 || Math.abs(n - longInterval) < 1e-6));
      assert.ok(intervals.some(n => Math.abs(n - longInterval) < 1e-6));
      await page.waitForFunction(() => !document.querySelector('#practice-gap-indicator').hidden && !document.querySelector('#presentation-content .playback-current'));
      assert.match(await page.locator('#practice-gap-indicator').textContent(), /GAP/);
      if (gap === 2) await page.screenshot({ path: `tmp/practice-gap-${engine.name()}.png` });
    }
  }
  await page.locator('[data-loop-gap="0"]').click();
  assert.equal(await page.locator('#practice-gap-indicator').isVisible(), false);
  // Edge-to-edge practice layout, full-row targets, and all blocks fit.
  for (const viewport of [{ width: 393, height: 852 }, { width: 852, height: 393 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('#presentation-stage').getBoundingClientRect();
      const content = document.querySelector('#presentation-content').getBoundingClientRect();
      const controls = document.querySelector('#practice-controls').getBoundingClientRect();

      return { top: stage.top, left: stage.left, width: stage.width, bottom: innerHeight - controls.bottom,
        fits: content.top >= stage.top - 1 && content.bottom <= stage.bottom + 1 && content.right <= stage.right + 1,
        rowButtons: [...document.querySelectorAll('[data-loop-vibhag]')].every(n => n.localName === 'button'),
        touchSize: document.querySelector('[data-loop-vibhag]').getBoundingClientRect().width, contentWidth: content.width };
    });
    assert.equal(layout.top, 0); assert.equal(layout.left, 0); assert.equal(layout.width, viewport.width); assert.equal(layout.bottom, 0);
    assert.ok(layout.fits); assert.ok(layout.rowButtons); assert.ok(Math.abs(layout.touchSize - layout.contentWidth) < 1);
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({ path: `tmp/practice-${engine.name()}.png` });
  // Selecting no rows stops audio and can be recovered without closing the view.
  await page.locator('[data-loop-vibhag="0"]').click();
  await page.locator('[data-loop-vibhag="2"]').click();
  assert.equal(await page.locator('#practice-toggle').isDisabled(), true);
  assert.match(await page.locator('#practice-status').textContent(), /Select a vibhag/);
  assert.equal(await page.locator('#presentation-content .playback-current').count(), 0);
  const stopped = await page.evaluate(() => testAudioCalls.length);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => testAudioCalls.length), stopped);
  for (let i = 0; i < 9; i++) await page.locator('#practice-controls [data-tempo-step="-1"]').click();
  assert.equal(await page.locator('#practice-tempo').textContent(), '60 BPM');
  assert.equal(await page.locator('#practice-controls [data-tempo-step="-1"]').isDisabled(), true);
  assert.equal(await page.evaluate(() => testAudioCalls.length), stopped); // Arrows never start a stopped loop.
  for (let i = 0; i < 9; i++) await page.locator('#practice-controls [data-tempo-step="1"]').click();
  await page.locator('[data-loop-vibhag="2"]').click();
  assert.equal(await page.locator('#practice-toggle').isEnabled(), true);
  if (native) {
    await page.locator('#practice-toggle').click();
    await page.waitForFunction(n => testAudioCalls.length >= n + 6, stopped);
    const singleRow = await page.evaluate(n => testAudioCalls.slice(n, n + 6), stopped);
    assert.ok(singleRow.every(call => call.offset === 3.008)); // V3 alone, repeated.
    for (let i = 1; i < singleRow.length; i++) assert.ok(Math.abs(singleRow[i].when - singleRow[i - 1].when - .25) < 1e-6);
  }
  await page.locator('#practice-exit').click();
  assert.equal(await page.locator('#presentation-dialog').evaluate(n => n.classList.contains('practice-view')), false);
  assert.equal(await page.locator('#presentation-content .presentation-notes').count(), 1);
  if (native) assert.equal(await page.locator('#presentation-stop').isEnabled(), true);
  await page.locator('#presentation-zoom').click();
  assert.equal(await page.locator('[data-loop-vibhag][aria-pressed="true"]').count(), 1);
  await page.keyboard.press('Escape'); // Exit zoom, keep the presentation and audio.
  assert.equal(await page.locator('#presentation-dialog').evaluate(n => n.open), true);
  assert.equal(await page.locator('#presentation-dialog').evaluate(n => n.classList.contains('practice-view')), false);
  await page.locator('#presentation-close').click();
  assert.equal(await page.locator('#presentation-stop').isDisabled(), true);
  await page.locator('#presentation-open').click();
  await page.locator('#presentation-zoom').click();
  assert.equal(await page.locator('[data-loop-vibhag][aria-pressed="true"]').count(), 4); // Fresh session.
  assert.equal(await page.locator('[data-loop-gap="0"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#practice-exit').click(); await page.locator('#presentation-close').click();
  assert.deepEqual(await page.evaluate(() => kaidaDebug.snapshot()), original);
  // Practice is also usable before a clap/manual recording exists.
  await page.locator('#clear-clapping').click();
  await page.locator('#presentation-open').click();
  assert.equal(await page.locator('[data-presentation-view="blocks"]').isDisabled(), true);
  assert.equal(await page.locator('#presentation-zoom').isEnabled(), true);
  await page.locator('#presentation-zoom').click();
  assert.equal(await page.locator('#presentation-content .clap-block').count(), 8);
  assert.match(await page.locator('#practice-status').textContent(), /notation|does not support audio|Loading/);
  await page.locator('#practice-exit').click(); await page.locator('#presentation-close').click();
  assert.deepEqual(errors, []);
  await browser.close();
}
console.log('PASS: practice zoom, portrait/landscape/desktop edge-to-edge fit, full-row selection, 60–400 BPM steps, native selected-row loops with 0/1/2-matra gaps, bold red highlights, empty selection, close/reopen and unchanged saved data.');
