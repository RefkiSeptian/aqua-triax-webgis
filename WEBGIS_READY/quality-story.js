'use strict';

let stopQualityStory = () => {};

// Scroll changes the illustration only. Findings remain controlled by the form.
function startQualityStory(form) {
  const sections = [...form.querySelectorAll('[data-quality-story]')];
  const chapters = [...form.querySelectorAll('.quality-chapters a')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = createHomeScene(form.querySelector('canvas'), {qualityOnly: true});
  const listeners = new AbortController();
  let frame;

  function update() {
    frame = undefined;
    const readingLine = innerHeight * .5;
    const centers = sections.map(section => {
      const bounds = section.getBoundingClientRect();
      return bounds.top + Math.min(bounds.height, innerHeight) / 2;
    });
    let progress = 0;
    for (let index = 0; index < centers.length - 1; index++) {
      if (centers[index] > readingLine) break;
      progress = index + Math.max(0, Math.min(1,
        (readingLine - centers[index]) / (centers[index + 1] - centers[index])));
    }
    const current = Math.round(progress);
    form.dataset.story = sections[current].dataset.qualityStory;
    chapters.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    scene.setProgress(progress);
  }

  function requestUpdate() {
    frame ??= requestAnimationFrame(update);
  }

  chapters.forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = sections.find(section => `#${section.id}` === link.hash);
    target.scrollIntoView({block: 'start', behavior: motion.matches ? 'instant' : 'smooth'});
    const heading = target.querySelector('h1, h2') ?? target;
    heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll: true});
  }, {signal: listeners.signal}));

  window.addEventListener('scroll', requestUpdate, {passive: true, signal: listeners.signal});
  window.addEventListener('resize', requestUpdate, {signal: listeners.signal});
  const resize = new ResizeObserver(requestUpdate);
  sections.forEach(section => resize.observe(section));
  scene.start();
  requestUpdate();
  stopQualityStory = () => {
    listeners.abort();
    resize.disconnect();
    cancelAnimationFrame(frame);
    scene.stop();
    stopQualityStory = () => {};
  };
}
