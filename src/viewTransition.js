export const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const viewerMediaEl = () =>
  document.querySelector('.viewer .layer.full.is-loaded') ||
  document.querySelector('.viewer .layer.placeholder, .viewer .layer.video')

// While a view transition runs, the browser hit-tests the transition overlay instead of the page,
// so taps are swallowed. Flag it on <html> so callers (and the e2e tests) can wait deterministically.
export function trackTransition(vt) {
  const root = document.documentElement
  root.dataset.vt = 'running'
  const done = () => { delete root.dataset.vt }
  vt.finished.then(done, done)
  return vt
}
