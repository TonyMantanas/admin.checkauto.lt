(() => {
  const loading = document.querySelector('[data-admin-loading]');
  const fill = loading && loading.querySelector('[data-startup-progress]');
  if (!fill) return;

  let progress = .04;
  let finished = false;
  let completion;
  const paint = () => { fill.style.transform = `scaleX(${progress})`; };
  const timer = window.setInterval(() => {
    if (finished || document.visibilityState === 'hidden' || progress >= .92) return;
    progress += (.92 - progress) * .018;
    paint();
  }, 160);

  window.CheckAutoStartup = Object.freeze({
    advance(value) {
      if (finished || !Number.isFinite(value)) return;
      progress = Math.max(progress, Math.min(.94, value));
      paint();
    },
    finish() {
      if (completion) return completion;
      finished = true;
      window.clearInterval(timer);
      progress = 1;
      paint();
      // Complete only after the page is prepared, then let the full line paint
      // before revealing it. Hidden tabs must not wait for animation frames.
      completion = new Promise(resolve => {
        if (document.visibilityState === 'hidden') { resolve(); return; }
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.setTimeout(() => {
          const fallback = window.setTimeout(resolve, 120);
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            window.clearTimeout(fallback);
            resolve();
          }));
        }, reducedMotion ? 0 : 160);
      });
      return completion;
    },
    stop() {
      finished = true;
      window.clearInterval(timer);
    }
  });
  paint();
})();
