import { createPlaybackPlan, playbackWindow, STROKE_SAMPLES } from './playback-data.js';

export function setupPresentationPlayback() {
  const startButton = document.querySelector('#presentation-play');
  const stopButton = document.querySelector('#presentation-stop');
  const tempoButtons = [...document.querySelectorAll('[data-playback-tempo]')];
  const content = document.querySelector('#presentation-content');
  const status = document.querySelector('#presentation-playback-status');
  const position = document.querySelector('#presentation-position');
  let context, bankPromise, bank, plan, readyText = '', tempo = 120;
  let revision = 0, playing = false, timer, animation, anchorTime = 0, scheduledBeat = 0;
  const voices = new Set();
  let highlighted = '';
  const refreshVisuals = () => {
    const beat = playing ? (context.currentTime - anchorTime) / (60 / tempo) : -1;
    const phase = beat >= 0 ? beat % plan.totalMatras : -1;
    const ids = new Set(phase < 0 ? [] : plan.events.filter(event => event.start <= phase && phase < event.end).map(event => event.bolId));
    content.querySelectorAll('[data-bol-id]').forEach(node => node.classList.toggle('playback-current', ids.has(node.dataset.bolId)));
    highlighted = [...ids].join(',');
  };

  const silence = (futureOnly = false) => {
    if (!context) return;
    for (const voice of [...voices]) {
      if (futureOnly && voice.when <= context.currentTime) continue;
      try { voice.source.stop(); } catch { /* Already ended. */ }
      voice.source.disconnect(); voice.gain.disconnect(); voices.delete(voice);
    }
  };
  const stop = () => {
    revision++; playing = false;
    clearInterval(timer); cancelAnimationFrame(animation); silence();
    refreshVisuals();
    startButton.disabled = !plan?.events.length;
    stopButton.disabled = true;
    position.textContent = '';
    status.textContent = readyText;
  };
  const setComposition = composition => {
    stop();
    try {
      plan = createPlaybackPlan(composition);
      const source = { manual: 'manual timeline', clapping: 'clapping', notation: 'notation' }[plan.timing];
      readyText = `Loop · ${plan.totalMatras} matras · ${source}.`;
      if (plan.fallback) readyText += ' Incomplete recording: using notation.';
      if (plan.unmapped) readyText += ` ${plan.unmapped} bol${plan.unmapped === 1 ? '' : 's'} need matching finger/zone tags.`;
      if (plan.untimed) readyText += ` ${plan.untimed} bol${plan.untimed === 1 ? '' : 's'} have no manual timing.`;
      if (!plan.events.length) readyText = 'Set finger/zone tags on the bols to hear playback.';
    } catch (error) {
      plan = null; readyText = error.message;
    }
    startButton.disabled = !plan?.events.length;
    status.textContent = readyText;
  };
  const loadBank = () => {
    if (!bankPromise) {
      bankPromise = (async () => {
        const response = await fetch(new URL('../assets/audio/tabla-strokes.wav', import.meta.url));
        if (!response.ok) throw new Error('Could not load the tabla recording.');
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (buffer.duration < 7.99) throw new Error('The tabla recording is incomplete.');
        bank = buffer;
      })().catch(error => { bankPromise = null; throw error; });
    }
    return bankPromise;
  };
  const playEvent = (event, when, secondsPerMatra) => {
    for (const name of event.samples) {
      const sample = STROKE_SAMPLES[name];
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = bank;
      const duration = Math.min(sample.duration, Math.max(.02, (event.end - event.start) * secondsPerMatra));
      const level = .8 / event.samples.length;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(level, when + .001);
      gain.gain.setValueAtTime(level, when + Math.max(.001, duration - .008));
      gain.gain.linearRampToValueAtTime(0, when + duration);
      source.connect(gain); gain.connect(context.destination);
      const voice = { source, gain, when };
      voices.add(voice);
      source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); };
      // Both hands receive precisely the same AudioContext clock timestamp.
      source.start(when, sample.offset, duration);
    }
  };
  const tick = () => {
    if (!playing) return;
    const secondsPerMatra = 60 / tempo;
    const nowBeat = (context.currentTime - anchorTime) / secondsPerMatra;
    const from = Math.max(0, scheduledBeat, nowBeat);
    const until = (context.currentTime + .15 - anchorTime) / secondsPerMatra;
    for (const event of playbackWindow(plan, from, until)) {
      playEvent(event, Math.max(context.currentTime, anchorTime + event.beat * secondsPerMatra), secondsPerMatra);
    }
    scheduledBeat = Math.max(from, until);
  };
  const drawPosition = () => {
    if (!playing) return;
    const beat = Math.max(0, (context.currentTime - anchorTime) / (60 / tempo));
    position.textContent = `Matra ${Math.floor(beat % plan.totalMatras) + 1} / ${plan.totalMatras} · Loop`;
    const phase = context.currentTime < anchorTime ? -1 : beat % plan.totalMatras;
    const ids = plan.events.filter(event => event.start <= phase && phase < event.end).map(event => event.bolId).join(',');
    if (ids !== highlighted) refreshVisuals();
    animation = requestAnimationFrame(drawPosition);
  };
  startButton.addEventListener('click', async () => {
    if (!plan?.events.length || playing) return;
    const ticket = ++revision;
    startButton.disabled = true; stopButton.disabled = false;
    status.textContent = 'Loading tabla sounds…';
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('This browser does not support audio playback.');
        context = new Audio({ latencyHint: 'interactive' });
        context.addEventListener('statechange', () => {
          if (playing && context.state !== 'running') stop();
        });
      }
      // Resume directly from the tap, before waiting for the WAV download (iOS).
      await Promise.all([context.resume(), loadBank()]);
      if (ticket !== revision) return;
      playing = true; anchorTime = context.currentTime + .06; scheduledBeat = 0;
      status.textContent = readyText;
      tick(); timer = setInterval(tick, 25); drawPosition();
    } catch (error) {
      if (ticket !== revision) return;
      stop(); status.textContent = `${error.message} Tap Start to retry.`;
    }
  });
  stopButton.addEventListener('click', stop);
  tempoButtons.forEach(button => button.addEventListener('click', () => {
    const next = Number(button.dataset.playbackTempo);
    if (next === tempo) { if (!startButton.disabled) startButton.click(); return; }
    const phase = playing ? Math.max(0, (context.currentTime - anchorTime) / (60 / tempo)) : 0;
    tempo = next;
    tempoButtons.forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.playbackTempo) === tempo)));
    if (playing) {
      silence(true);
      anchorTime = context.currentTime - phase * (60 / tempo);
      scheduledBeat = phase + 1e-6;
      tick();
    }
    refreshVisuals();
    // A tempo preset also starts the loop when it is stopped.
    if (!startButton.disabled) startButton.click();
  }));
  return { setComposition, stop, refreshVisuals };
}
