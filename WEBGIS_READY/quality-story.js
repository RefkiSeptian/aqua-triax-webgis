'use strict';

let stopQualityStory = () => {};

// Scroll changes the illustration only. Findings remain controlled by the form.
function startQualityStory(form) {
  const sections = [...form.querySelectorAll('[data-quality-story]')];
  const chapters = [...form.querySelectorAll('.quality-chapters a')];
  const navigation = form.querySelector('.quality-chapters');
  const meter = navigation.querySelector('[role="progressbar"]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = createHomeScene(form.querySelector('canvas'), {qualityOnly: true});
  const listeners = new AbortController();
  let frame;
  let previousProgress = 0;

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
    if (form.getBoundingClientRect().bottom <= innerHeight + 2) progress = sections.length - 1;
    const current = Math.round(progress);
    const openGuide = form.querySelector('.quality-action[open]');
    if (openGuide) {
      const stage = openGuide.closest('[data-quality-story]').getBoundingClientRect();
      if (stage.bottom < 110 || stage.top >= innerHeight) openGuide.close();
    }
    if (Math.abs(progress - previousProgress) > .0001) {
      navigation.dataset.flow = progress < previousProgress ? 'backward' : 'forward';
    }
    previousProgress = progress;
    form.dataset.story = sections[current].dataset.qualityStory;
    chapters.forEach((link, index) => {
      link.classList.toggle('is-passed', index < progress);
      if (index === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    navigation.style.setProperty('--quality-progress', progress / (sections.length - 1));
    meter.setAttribute('aria-valuenow', Math.round(progress / (sections.length - 1) * 100));
    meter.setAttribute('aria-valuetext', chapters[current].getAttribute('aria-label'));
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
  document.addEventListener('pointerdown', event => {
    const guide = form.querySelector('.quality-action[open]');
    if (guide && !guide.contains(event.target) && !event.target.closest('[data-issue]')) guide.close();
  }, {signal: listeners.signal});
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (CSS.supports('selector(select:open)') && event.target.closest('select:open')) return;
    const guide = form.querySelector('.quality-action[open]');
    if (guide) {
      event.preventDefault();
      guide.close();
    }
  }, {signal: listeners.signal});
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
