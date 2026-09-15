import { renderPresentationCanvas } from './presentation-canvas.js';

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
      await document.fonts.ready;
      if (request !== revision) return;
      fit();
      const canvas = renderPresentationCanvas(content);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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
