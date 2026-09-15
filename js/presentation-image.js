let rendererPromise;
function loadRenderer() {
  if (!rendererPromise) {
    rendererPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/html-to-image.js', import.meta.url).href;
      script.onload = () => resolve(window.htmlToImage);
      script.onerror = () => { script.remove(); rendererPromise = null; reject(new Error('Image renderer unavailable')); };
      document.head.append(script);
    });
  }
  return rendererPromise;
}

async function renderImage(renderer, content, width, height, pixelRatio) {
  const fonts = await renderer.getFontEmbedCSS(content);
  // Give embedded fonts their own families so the exported sheet is self-contained.
  const fontEmbedCSS = fonts.replace(/@font-face\s*\{[^}]+\}/g, rule => rule
    .replace(/font-family:\s*[^;]+;/, `font-family: ${/font-weight:\s*700/.test(rule) ? 'KaidaImageBold' : 'KaidaImageRegular'};`)
    .replace(/font-display:\s*[^;]+;/, 'font-display: block;'));
  const data = await renderer.toSvg(content, {
    width, height, fontEmbedCSS,
    style: { transform: 'none', position: 'relative', left: '0', top: '0', margin: '0', zoom: '1' },
  });
  const svg = new DOMParser().parseFromString(decodeURIComponent(data.slice(data.indexOf(',') + 1)), 'image/svg+xml');
  for (const node of svg.querySelectorAll('[style]')) {
    node.style.fontFamily = Number(node.style.fontWeight) >= 600 ? 'KaidaImageBold, monospace' : 'KaidaImageRegular, monospace';
    // Computed logical borders can override physical borders after cloning.
    for (const property of [...node.style]) {
      if (property.startsWith('border-inline') || property.startsWith('border-block')) node.style.removeProperty(property);
    }
  }
  const originals = content.querySelectorAll('.matra');
  svg.querySelectorAll('.matra').forEach((node, i) => {
    node.style.borderRight = getComputedStyle(originals[i]).borderRight;
  });
  // SVG geometry belongs to its attributes. Copying computed x/y can move text
  // to zero in WebKit, especially when the live presentation is scaled down.
  svg.querySelectorAll('svg svg *').forEach(node => {
    for (const property of ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd']) node.style?.removeProperty(property);
  });
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * pixelRatio); canvas.height = Math.ceil(height * pixelRatio);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export function setupPresentationImage(content, fit) {
  const share = document.querySelector('#presentation-share');
  const save = document.querySelector('#presentation-save');
  const status = document.querySelector('#presentation-image-status');
  let revision = 0, file = null, composition = null;
  const clear = () => {
    revision++;
    file = null;
    share.disabled = save.disabled = true;
    status.textContent = '';
  };
  const prepare = async current => {
    clear();
    composition = current;
    const request = revision;
    share.textContent = 'Share image';
    status.textContent = 'Preparing image…';
    try {
      const renderer = await loadRenderer();
      await document.fonts.ready;
      if (request !== revision) return;
      fit();
      const width = content.offsetWidth, height = content.offsetHeight;
      // Keep the whole sheet, including notes, independent of the screen scale.
      // Bound canvas dimensions/memory for long compositions on mobile Safari.
      const pixelRatio = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(14000000 / (width * height)));
      const blob = await renderImage(renderer, content, width, height, pixelRatio);
      if (request !== revision) return;
      if (!blob?.size) throw new Error('Empty image');
      const name = `${current.compositionType}-${current.talaName || 'kaida'}`.replace(/[^a-z0-9-]+/gi, '-');
      file = new File([blob], `${name}.png`, { type: 'image/png' });
      share.disabled = save.disabled = false;
      status.textContent = navigator.canShare?.({ files: [file] })
        ? 'Share image → choose WhatsApp.'
        : 'Save the image, then attach it in WhatsApp.';
    } catch {
      if (request !== revision) return;
      status.textContent = 'Could not prepare the image. Tap Retry image.';
      share.textContent = 'Retry image';
      share.disabled = false;
    }
  };
  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url; link.download = file.name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  share.addEventListener('click', async () => {
    if (!file) { prepare(composition); return; }
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) { download(); return; }
    // The PNG is ready before this tap: iOS requires immediate user activation.
    const request = revision;
    share.disabled = true;
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (request === revision && error.name !== 'AbortError') status.textContent = 'Sharing unavailable. Use Save image and attach it in WhatsApp.';
    } finally {
      if (request === revision) share.disabled = false;
    }
  });
  save.addEventListener('click', download);
  return { prepare, clear };
}
