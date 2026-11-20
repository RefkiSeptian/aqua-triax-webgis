'use strict';

const homeStory = (() => {
  const home = document.querySelector('#home-view');
  const root = document.querySelector('#home-story');
  const steps = [...root.querySelectorAll('[data-story-step]')];
  const sections = [home.querySelector('.home-hero'), ...steps];
  const chapters = [...home.querySelectorAll('.story-chapters a')];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = createHomeScene(home.querySelector('canvas'));
  let listening = false;
  let frame;

  function update() {
    frame = undefined;
    const positions = sections.map(section => section.getBoundingClientRect().top);
    let progress = 0;
    for (let index = 0; index < positions.length - 1; index++) {
      if (positions[index] > 0) break;
      const fraction = -positions[index] / (positions[index + 1] - positions[index]);
      progress = index + Math.max(0, Math.min(1, fraction));
    }
    scene.setProgress(progress);

    const active = sections.reduce((closest, step) => {
      const distance = element => {
        const rect = element.getBoundingClientRect();
        return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
      };
      return distance(step) < distance(closest) ? step : closest;
    });
    root.dataset.story = active.dataset.storyStep;
    home.dataset.story = active.dataset.storyStep;
    steps.forEach(step => step.classList.toggle('is-current', step === active));
    chapters.forEach(chapter => {
      if (chapter.hash === `#${active.id}`) chapter.setAttribute('aria-current', 'step');
      else chapter.removeAttribute('aria-current');
    });
  }

  function requestUpdate() {
    frame ??= requestAnimationFrame(update);
  }

  document.querySelectorAll('[data-story-link]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const target = document.querySelector(link.hash);
      target.scrollIntoView({behavior: motion.matches ? 'instant' : 'smooth', block: 'start'});
      const heading = target.querySelector('h1, h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
    });
  });

  return {
    start() {
      if (!listening) {
        window.addEventListener('scroll', requestUpdate, {passive: true});
        window.addEventListener('resize', requestUpdate);
        listening = true;
      }
      scene.start();
      requestUpdate();
    },
    stop() {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      cancelAnimationFrame(frame);
      frame = undefined;
      listening = false;
      scene.stop();
    }
  };
})();
