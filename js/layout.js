export function fitPortraitLayout() {
  const fit = () => document.documentElement.style.setProperty('--portrait-scale', String(Math.min(1, document.documentElement.clientWidth / 840)));
  fit();
  window.addEventListener('resize', fit);
}
