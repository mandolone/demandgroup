(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lightbox = document.getElementById('product-lightbox');
  if (!lightbox) return;

  const lightboxImage = lightbox.querySelector('figure img');
  const caption = lightbox.querySelector('figcaption');
  const closeButton = lightbox.querySelector('.lightbox-close');
  const previousButton = lightbox.querySelector('.lightbox-prev');
  const nextButton = lightbox.querySelector('.lightbox-next');
  let activeImages = [];
  let activeIndex = 0;

  const showLightboxImage = (index) => {
    activeIndex = (index + activeImages.length) % activeImages.length;
    const source = activeImages[activeIndex];
    lightboxImage.src = source.currentSrc || source.src;
    lightboxImage.alt = source.alt;
    caption.textContent = `${source.alt} · ${activeIndex + 1} / ${activeImages.length}`;
    previousButton.disabled = activeImages.length < 2;
    nextButton.disabled = activeImages.length < 2;
  };

  document.querySelectorAll('.product-carousel').forEach((gallery) => {
    const images = [...gallery.querySelectorAll('img')];
    if (!images.length) return;
    const track = document.createElement('span');
    track.className = 'gallery-track';
    images.forEach((image) => { image.draggable = false; track.appendChild(image); });
    gallery.prepend(track);
    let index = 0;
    let timer;
    let paused = false;
    let animationFrame;
    let dragging = false;
    let didDrag = false;
    let pointerStart = 0;
    let scrollStart = 0;

    const glideTo = (target, duration = 1400) => {
      window.cancelAnimationFrame(animationFrame);
      const start = track.scrollLeft;
      const distance = target - start;
      const startedAt = performance.now();
      const animate = (now) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        track.scrollLeft = start + distance * eased;
        if (progress < 1) animationFrame = window.requestAnimationFrame(animate);
      };
      animationFrame = window.requestAnimationFrame(animate);
    };

    const moveTo = (nextIndex, smooth = true) => {
      index = (nextIndex + images.length) % images.length;
      const target = track.clientWidth * index;
      if (smooth && !reducedMotion) glideTo(target);
      else track.scrollTo({ left: target, behavior: 'auto' });
      gallery.querySelectorAll('.gallery-dot').forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
    };

    const restart = () => {
      window.clearInterval(timer);
      if (images.length > 1 && !reducedMotion) timer = window.setInterval(() => { if (!paused) moveTo(index + 1); }, 6800);
    };

    if (images.length > 1) {
      const controls = document.createElement('span');
      controls.className = 'gallery-controls';
      controls.innerHTML = `<button class="gallery-control gallery-previous" type="button" aria-label="Previous image">←</button><span class="gallery-dots"></span><button class="gallery-control gallery-next" type="button" aria-label="Next image">→</button>`;
      const dots = controls.querySelector('.gallery-dots');
      images.forEach((_, dotIndex) => {
        const dot = document.createElement('button');
        dot.className = `gallery-dot${dotIndex === 0 ? ' is-active' : ''}`;
        dot.type = 'button';
        dot.setAttribute('aria-label', `Show image ${dotIndex + 1}`);
        const thumbnail = images[dotIndex].cloneNode();
        thumbnail.alt = '';
        dot.appendChild(thumbnail);
        dot.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); moveTo(dotIndex); restart(); });
        dots.appendChild(dot);
      });
      controls.querySelector('.gallery-previous').addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); moveTo(index - 1); restart(); });
      controls.querySelector('.gallery-next').addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); moveTo(index + 1); restart(); });
      gallery.appendChild(controls);
      gallery.addEventListener('mouseenter', () => { paused = true; });
      gallery.addEventListener('mouseleave', () => { paused = false; });
      gallery.addEventListener('focusin', () => { paused = true; });
      gallery.addEventListener('focusout', () => { paused = false; });

      const finishDrag = (event) => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
        const nearest = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
        moveTo(nearest, true);
        paused = false;
        restart();
      };

      track.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        window.cancelAnimationFrame(animationFrame);
        dragging = true;
        didDrag = false;
        paused = true;
        pointerStart = event.clientX;
        scrollStart = track.scrollLeft;
        track.setPointerCapture(event.pointerId);
        track.classList.add('is-dragging');
      });
      track.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const delta = event.clientX - pointerStart;
        if (Math.abs(delta) > 6) didDrag = true;
        track.scrollLeft = scrollStart - delta;
        if (didDrag) event.preventDefault();
      });
      track.addEventListener('pointerup', finishDrag);
      track.addEventListener('pointercancel', finishDrag);
      restart();
    }

    images.forEach((image, imageIndex) => image.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (didDrag) {
        didDrag = false;
        return;
      }
      activeImages = images;
      showLightboxImage(imageIndex);
      lightbox.showModal();
    }));
  });

  closeButton.addEventListener('click', () => lightbox.close());
  previousButton.addEventListener('click', () => showLightboxImage(activeIndex - 1));
  nextButton.addEventListener('click', () => showLightboxImage(activeIndex + 1));
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) lightbox.close(); });
  document.addEventListener('keydown', (event) => {
    if (!lightbox.open) return;
    if (event.key === 'ArrowLeft') showLightboxImage(activeIndex - 1);
    if (event.key === 'ArrowRight') showLightboxImage(activeIndex + 1);
  });
})();
