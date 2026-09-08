export function createStore(initial, onSave = () => {}) {
  let composition = initial;
  let past = [];
  let future = [];
  let previousKey = null;
  let previousTime = 0;
  const listeners = new Set();
  const emit = () => { onSave(composition); listeners.forEach(listener => listener(composition)); };
  return {
    get composition() { return composition; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(transform, coalesceKey = null) {
      const next = transform(composition);
      if (next === composition || JSON.stringify(next) === JSON.stringify(composition)) return false;
      const now = Date.now();
      if (!coalesceKey || previousKey !== coalesceKey || now - previousTime > 1000) {
        past.push(composition);
        if (past.length > 100) past.shift();
      }
      composition = next; future = []; previousKey = coalesceKey; previousTime = now; emit(); return true;
    },
    undo() {
      if (!past.length) return;
      future.push(composition); composition = past.pop(); previousKey = null; emit();
    },
    redo() {
      if (!future.length) return;
      past.push(composition); composition = future.pop(); previousKey = null; emit();
    },
  };
}
