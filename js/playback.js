import { createPlaybackPlan, selectPlaybackVibhags, playbackCursor, playbackWindow, STROKE_SAMPLES } from './playback-data.js';

export function setupPresentationPlayback() {
  const startButton = document.querySelector('#presentation-play');
  const stopButton = document.querySelector('#presentation-stop');
  const tempoButtons = [...document.querySelectorAll('[data-playback-tempo]')];
  const content = document.querySelector('#presentation-content');
  const status = document.querySelector('#presentation-playback-status');
  const position = document.querySelector('#presentation-position');
  const practiceToggle = document.querySelector('#practice-toggle');
  const practiceTempo = document.querySelector('#practice-tempo');
  const practiceStatus = document.querySelector('#practice-status');
  const stepButtons = [...document.querySelectorAll('[data-tempo-step]')];
  const gapButtons = [...document.querySelectorAll('[data-loop-gap]')];
  const gapIndicator = document.querySelector('#practice-gap-indicator');
  const tempos = tempoButtons.map(button => Number(button.dataset.playbackTempo));
  let context, bankPromise, bank, basePlan, plan, readyText = '', tempo = 120, gapMatras = 0;
  let revision = 0, playing = false, timer, animation, anchorTime = 0, scheduledBeat = 0;
  const voices = new Set();
  let highlighted = '';
  const cursor = () => plan && playbackCursor(plan, playing ? (context.currentTime - anchorTime) / (60 / tempo) : -1);
  const gapPosition = () => {
    if (!playing || !plan?.gapMatras) return 0;
    const beat = (context.currentTime - anchorTime) / (60 / tempo);
    if (beat < 0) return 0;
    const phase = beat % plan.cycleMatras;
    return phase >= plan.totalMatras ? Math.floor(phase - plan.totalMatras) + 1 : 0;
  };
  const drawGap = () => {
    const gap = gapPosition();
    gapIndicator.hidden = !gap || !document.querySelector('#presentation-dialog').classList.contains('practice-view');
    gapIndicator.textContent = gap ? `GAP · ${gap} / ${gapMatras}` : '';
  };
  const syncControls = () => {
    practiceToggle.textContent = stopButton.disabled ? 'Start' : 'Stop';
    practiceToggle.disabled = !plan?.events.length;
    practiceToggle.setAttribute('aria-pressed', String(!stopButton.disabled));
    practiceTempo.textContent = `${tempo} BPM`;
    stepButtons.forEach(button => { button.disabled = Number(button.dataset.tempoStep) < 0 ? tempo === tempos[0] : tempo === tempos.at(-1); });
    gapButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.loopGap) === gapMatras)));
    practiceStatus.textContent = status.textContent;
  };
  const refreshVisuals = () => {
    const current = cursor();
    const ids = new Set(!current ? [] : plan.events.filter(event => event.start <= current.phase && current.phase < event.end).map(event => event.bolId));
    for (const root of [content, document.querySelector('#clap-plot-container')]) {
      root?.querySelectorAll('[data-bol-id]').forEach(node => {
        const row = node.closest('.clap-vibhag-row');
        node.classList.toggle('playback-current', ids.has(node.dataset.bolId) && (!row || Number(row.dataset.vibhag) === current?.vibhag));
      });
    }
    highlighted = `${current?.vibhag}:${[...ids].join(',')}`;
    drawGap();
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
    syncControls();
  };
  const describePlan = () => {
    const source = { manual: 'manual timeline', clapping: 'clapping', notation: 'notation' }[plan.timing];
    readyText = `Loop · ${plan.totalMatras} matras · ${source}.`;
    if (plan.gapMatras) readyText += ` + ${plan.gapMatras} gap matra${plan.gapMatras === 1 ? '' : 's'}.`;
    if (plan.fallback) readyText += ' Incomplete recording: using notation.';
    if (plan.unmapped) readyText += ` ${plan.unmapped} bol${plan.unmapped === 1 ? '' : 's'} need matching finger/zone tags.`;
    if (plan.untimed) readyText += ` ${plan.untimed} bol${plan.untimed === 1 ? '' : 's'} have no manual timing.`;
    if (!plan.events.length) readyText = plan.totalMatras ? 'Set finger/zone tags on the selected bols to hear playback.' : 'Select a vibhag to loop.';
  };
  const setComposition = composition => {
    stop();
    gapMatras = 0;
    try {
      basePlan = createPlaybackPlan(composition);
      plan = selectPlaybackVibhags(basePlan, basePlan.structure.map((_, index) => index));
      describePlan();
    } catch (error) {
      basePlan = plan = null; readyText = error.message;
    }
    startButton.disabled = !plan?.events.length;
    status.textContent = readyText;
    syncControls();
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
    const current = cursor();
    const gap = gapPosition();
    position.textContent = current ? `V${current.vibhag + 1} · Matra ${Math.floor(current.matra) + 1} · Loop ${plan.totalMatras} matras` : gap ? `Gap · ${gap} / ${gapMatras} matras` : '';
    const ids = !current ? '' : plan.events.filter(event => event.start <= current.phase && current.phase < event.end).map(event => event.bolId).join(',');
    if (`${current?.vibhag}:${ids}` !== highlighted) refreshVisuals();
    drawGap();
    animation = requestAnimationFrame(drawPosition);
  };
  startButton.addEventListener('click', async () => {
    if (!plan?.events.length || playing) return;
    const ticket = ++revision;
    startButton.disabled = true; stopButton.disabled = false;
    status.textContent = 'Loading tabla sounds…';
    syncControls();
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
      syncControls();
      tick(); timer = setInterval(tick, 25); drawPosition();
    } catch (error) {
      if (ticket !== revision) return;
      stop(); status.textContent = `${error.message} Tap Start to retry.`;
      syncControls();
    }
  });
  stopButton.addEventListener('click', stop);
  const setTempo = (next, autoStart = false) => {
    if (next === tempo) { if (autoStart && !startButton.disabled) startButton.click(); return; }
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
    syncControls();
    // A tempo preset also starts the loop when it is stopped.
    if (autoStart && !startButton.disabled) startButton.click();
  };
  tempoButtons.forEach(button => button.addEventListener('click', () => setTempo(Number(button.dataset.playbackTempo), true)));
  stepButtons.forEach(button => button.addEventListener('click', () => {
    const index = tempos.indexOf(tempo) + Number(button.dataset.tempoStep);
    if (tempos[index]) setTempo(tempos[index]);
  }));
  practiceToggle.addEventListener('click', () => {
    if (!stopButton.disabled) stop(); else if (!startButton.disabled) startButton.click();
  });
  const setVibhags = selected => {
    if (!basePlan) return;
    plan = selectPlaybackVibhags(basePlan, selected, gapMatras);
    describePlan();
    if (!plan.events.length) { stop(); return; }
    if (playing) {
      silence(); anchorTime = context.currentTime + .04; scheduledBeat = 0; tick();
    }
    startButton.disabled = playing || !stopButton.disabled;
    status.textContent = readyText;
    refreshVisuals(); syncControls();
  };
  gapButtons.forEach(button => button.addEventListener('click', () => {
    const next = Number(button.dataset.loopGap);
    if (next === gapMatras) return;
    gapMatras = next;
    if (plan) setVibhags(plan.segments.map(segment => segment.index)); else syncControls();
  }));
  syncControls();
  return { setComposition, stop, refreshVisuals, setVibhags, getPlan: () => basePlan };
}
