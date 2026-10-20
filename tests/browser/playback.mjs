const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';

for (const engine of [webkit, chromium]) {
  const browser = await engine.launch(engine === chromium && process.platform === 'win32'
    ? { channel: 'msedge', headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Use real native decoding/scheduling, but mute the test graph at its output.
  await page.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    window.testAudioCalls = [];
    if (!Native) return;
    window.AudioContext = new Proxy(Native, { construct(Target, args) {
      const context = new Target(...args);
      const mute = context.createGain(); mute.gain.value = 0; mute.connect(context.destination);
      Object.defineProperty(context, 'destination', { get: () => mute });
      window.testContext = context;
      const createSource = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const source = createSource();
        const start = source.start.bind(source);
        source.start = (when, offset, duration) => {
          window.testBuffer = source.buffer;
          window.testAudioCalls.push({ when, offset, duration, rate: source.playbackRate.value });
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
    const { createManualDraft, manualCapture } = await import('./js/manual-timing.js');
    let c = createComposition(); c.vibhagStructure = [3];
    c = appendToVibhag(c, 'Wrong name A', 1);
    c = appendToVibhag(c, '—', 1);
    c = appendToVibhag(c, 'Wrong name B', 1);
    Object.assign(c.bols[0].tags, { dayanArticulation: 'sur', rightHandFinger: '2', leftHandFinger: '4-and-3' });
    Object.assign(c.bols[1].tags, { dayanArticulation: 'open-tin', leftHandFinger: '2' });
    Object.assign(c.bols[2].tags, { dayanArticulation: 'syahi', rightHandFinger: '3', membraneControl: 'right-4', leftHandFinger: '1-5' });
    c.clapping = manualCapture(createManualDraft(c), c.bols);
    return createShareLink(c, location.href);
  });
  const url = new URL(link); url.searchParams.set('debug', '1');
  await page.goto(url.href); await page.waitForFunction(() => window.kaidaDebug);
  const original = await page.evaluate(() => kaidaDebug.snapshot());
  await page.locator('#presentation-open').click();
  assert.equal(await page.locator('[data-playback-tempo]').count(), 0);
  assert.equal(await page.locator('#presentation-tempo-output').textContent(), '120 BPM');
  await page.locator('#presentation-sound').check();
  assert.deepEqual(await page.locator('#presentation-content .clap-sound-label').allTextContents(), ['Ta + Ghe', 'Ti + Ke']);
  assert.equal(await page.locator('#presentation-content .clap-block-label:not(.clap-sound-label)').count(), 2);
  assert.equal(await page.locator('#presentation-content .playback-current').count(), 0);
  if (!(await page.evaluate(() => !!(window.AudioContext || window.webkitAudioContext)))) {
    await page.locator('#presentation-play').click();
    assert.match(await page.locator('#presentation-playback-status').textContent(), /does not support audio/);
    assert.equal(await page.locator('#presentation-stop').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(`${engine.name()}: this engine build has no Web Audio; verified the unsupported-browser message.`);
    await browser.close();
    continue;
  }
  for (let i = 0; i < 14; i++) await page.locator('.presentation-tempo-controls [data-tempo-step="1"]').click();
  assert.equal(await page.locator('#presentation-tempo-output').textContent(), '400 BPM');
  assert.equal(await page.locator('.presentation-tempo-controls [data-tempo-step="1"]').isDisabled(), true);
  assert.equal(await page.evaluate(() => window.testAudioCalls.length), 0); // Tempo arrows do not start audio.
  await page.locator('#presentation-play').click();
  await page.waitForFunction(() => window.testAudioCalls.length >= 12, {}, { timeout: 20000 });
  const calls = await page.evaluate(() => window.testAudioCalls.slice(0, 12));
  for (let i = 0; i < calls.length; i += 2) {
    assert.equal(calls[i].when, calls[i + 1].when);
    assert.deepEqual([calls[i].offset, calls[i + 1].offset], i % 4 === 0 ? [.014, 6.04] : [5.014, 7.016]);
    assert.ok(calls[i].duration <= .15 + 1e-9);
    assert.equal(calls[i].rate, 1);
  }
  assert.ok(Math.abs(calls[2].when - calls[0].when - .3) < 1e-6); // Pause matra.
  assert.ok(Math.abs(calls[4].when - calls[0].when - .45) < 1e-6); // Next cycle.
  const highlights = await page.evaluate(async () => {
    const c = kaidaDebug.snapshot();
    const checked = [];
    for (let i = 0; i < 75; i++) {
      await new Promise(requestAnimationFrame);
      const beat = (testContext.currentTime - testAudioCalls[0].when) / .15;
      const phase = beat % 3, fraction = phase % 1;
      if (beat < 0 || fraction < .12 || fraction > .88) continue;
      checked.push({ expected: phase < 1 ? [c.bols[0].id] : phase < 2 ? [] : [c.bols[2].id],
        actual: [...new Set([...document.querySelectorAll('#presentation-content .playback-current')].map(n => n.dataset.bolId))] });
    }
    return checked;
  });
  assert.ok(highlights.length > 15);
  assert.ok(highlights.some(h => !h.expected.length)); // Rest is not highlighted.
  highlights.forEach(h => assert.deepEqual(h.actual, h.expected));
  await page.waitForFunction(() => !!document.querySelector('.clap-block-playhead.playback-current'));
  const exportIgnoresPlayhead = await page.locator('#presentation-content').evaluate(async content => {
    const { renderPresentationCanvas } = await import('./js/presentation-canvas.js');
    const before = renderPresentationCanvas(content).toDataURL();
    content.querySelectorAll('.playback-current').forEach(n => n.classList.remove('playback-current'));
    return before === renderPresentationCanvas(content).toDataURL();
  });
  assert.equal(exportIgnoresPlayhead, true);
  // Re-rendering Sound or switching views keeps audio and its playhead running.
  await page.locator('#presentation-sound').uncheck();
  assert.equal(await page.locator('#presentation-content .clap-sound-label').count(), 0);
  assert.equal(await page.locator('#presentation-stop').isEnabled(), true);
  await page.locator('#presentation-sound').check();
  await page.waitForFunction(() => !!document.querySelector('.clap-block-playhead.playback-current'));
  await page.screenshot({ path: `tmp/playback-${engine.name()}.png` });
  const peaks = await page.evaluate(async () => {
    const { STROKE_SAMPLES } = await import('./js/playback-data.js');
    const buffer = window.testBuffer, channel = buffer.getChannelData(0);
    return { duration: buffer.duration, peaks: Object.values(STROKE_SAMPLES).map(sample => {
      let peak = 0;
      const end = Math.floor((sample.offset + sample.duration) * buffer.sampleRate);
      for (let i = Math.floor(sample.offset * buffer.sampleRate); i < end; i++) peak = Math.max(peak, Math.abs(channel[i]));
      return peak;
    }) };
  });
  assert.equal(peaks.duration, 8); assert.ok(peaks.peaks.every(p => p > .05));
  await page.locator('[data-presentation-view="bols"]').click();
  assert.equal(await page.locator('#presentation-stop').isEnabled(), true);
  const position = await page.locator('#presentation-position').textContent(); assert.match(position, /Matra/);
  const tempoChange = await page.evaluate(() => {
    const down = document.querySelector('.presentation-tempo-controls [data-tempo-step="-1"]');
    for (let i = 0; i < 10; i++) down.click();
    return window.testAudioCalls.length;
  });
  await page.waitForFunction(n => window.testAudioCalls.length >= n + 8, tempoChange);
  const changedCalls = await page.evaluate(n => window.testAudioCalls.slice(n, n + 8), tempoChange);
  for (let i = 2; i < changedCalls.length; i += 2) {
    const interval = changedCalls[i].when - changedCalls[i - 2].when;
    assert.ok(Math.abs(interval - .3) < 1e-6 || Math.abs(interval - .6) < 1e-6);
    assert.equal(changedCalls[i].rate, 1);
  }
  assert.equal(await page.locator('#presentation-play').isDisabled(), true);
  await page.locator('#presentation-stop').click();
  assert.equal(await page.locator('#presentation-content .playback-current').count(), 0);
  const stopped = await page.evaluate(() => window.testAudioCalls.length);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.testAudioCalls.length), stopped);
  await page.locator('#presentation-play').click();
  await page.waitForFunction(n => window.testAudioCalls.length > n, stopped);
  await page.locator('#presentation-close').click();
  assert.equal(await page.locator('#presentation-stop').isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => kaidaDebug.snapshot()), original);
  assert.deepEqual(errors, []);
  await browser.close();
}
console.log('PASS: native WAV decoding, all eight slots contain audio, tag-only dual hands in sync, rests/loops/tempo/stop/view changes and original document preserved in Web Audio-capable browsers.');
