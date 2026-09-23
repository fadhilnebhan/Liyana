(() => {
  const frameCount = 180;
  const framePath = (n) => `./public/sequence-webp/ezgif-frame-${String(n).padStart(3, '0')}.webp`;
  const hero = document.querySelector('.hero-sequence');
  const canvas = document.querySelector('.portrait-canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const imageCache = new Map();
  let desiredFrame = 1;
  let raf = 0;
  let lastDpr = 0;
  let paintVersion = 0;
  let heroResizeObserver;

  function loadFrame(number) {
    if (number < 1 || number > frameCount) return Promise.resolve(null);
    if (imageCache.has(number)) return imageCache.get(number);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try { await img.decode(); } catch (_) { /* onload already confirms a usable image */ }
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = framePath(number);
    });
    imageCache.set(number, promise);
    return promise;
  }

  function warmFrames(center) {
    const candidates = [center, center + 1, center + 2, center + 3, center - 1, center - 2, center - 3, center + 5, center - 5];
    candidates.forEach((n, i) => { if (n >= 1 && n <= frameCount) setTimeout(() => loadFrame(n), i * 45); });
    for (const n of imageCache.keys()) {
      if (Math.abs(n - center) > 24 && imageCache.size > 24) imageCache.delete(n);
    }
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (!bounds.width || !bounds.height || (canvas.width === Math.round(bounds.width * dpr) && canvas.height === Math.round(bounds.height * dpr) && lastDpr === dpr)) return;
    lastDpr = dpr;
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
  }

  async function paint() {
    raf = 0;
    resizeCanvas();
    const requestedFrame = desiredFrame;
    const version = ++paintVersion;
    const image = await loadFrame(requestedFrame);
    if (!image || version !== paintVersion) return;
    draw(image);
    warmFrames(requestedFrame);
  }

  function draw(image) {
    const sw = image.naturalWidth;
    const sh = image.naturalHeight;
    const targetRatio = canvas.width / canvas.height;
    const cropWidth = Math.min(sw, sh * targetRatio);
    const cropHeight = Math.min(sh, cropWidth / targetRatio);
    // The mobile crop is a narrow window through a 16:9 frame. Keep the
    // portrait centered instead of biasing the crop left as the old code did.
    const focusX = sw * (targetRatio < 0.9 ? 0.5 : 0.48);
    const sx = Math.max(0, Math.min(sw - cropWidth, focusX - cropWidth / 2));
    const sy = (sh - cropHeight) * 0.42;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  }

  function queuePaint() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function updateScroll() {
    const bounds = hero.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || innerHeight;
    const travel = Math.max(1, hero.offsetHeight - viewportHeight);
    const progress = Math.max(0, Math.min(1, -bounds.top / travel));
    if (!reducedMotion) {
      desiredFrame = 1 + Math.round(progress * (frameCount - 1));
      queuePaint();
    }
    const title = document.querySelector('.hero-copy');
    const caption = document.querySelector('.hero-caption');
    const introOpacity = progress < 0.13 ? 1 : Math.max(.06, 1 - (progress - .13) * 2.4);
    title.style.opacity = introOpacity;
    caption.style.opacity = Math.max(0, 1 - progress * 4.5);
    const exitFade = Math.max(0, Math.min(1, (progress - .9) * 10));
    canvas.style.opacity = 1 - exitFade;
    document.querySelector('.hero-shade').style.opacity = 1 - exitFade;
    const dark = [17, 14, 14];
    const paper = [238, 234, 227];
    const tone = dark.map((value, i) => Math.round(value + (paper[i] - value) * exitFade));
    document.querySelector('.hero-sticky').style.backgroundColor = `rgb(${tone.join(',')})`;
    document.querySelector('.reading-line span').style.width = `${Math.min(100, (scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 100)}%`;
  }

  resizeCanvas();
  const handleViewportChange = () => {
    resizeCanvas();
    if (reducedMotion) {
      requestAnimationFrame(resizeCanvas);
      return;
    }
    queuePaint();
    updateScroll();
  };
  addEventListener('resize', handleViewportChange, { passive: true });
  addEventListener('orientationchange', handleViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
  if ('ResizeObserver' in window) {
    heroResizeObserver = new ResizeObserver(handleViewportChange);
    heroResizeObserver.observe(document.querySelector('.hero-sticky'));
  }
  if (!reducedMotion) {
    warmFrames(1);
    loadFrame(frameCount);
    addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();
  }

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    document.body.classList.remove('nav-open');
  }));

  const galleryData = {
    san: [4, 5, 6, 7, 8, 9], antara: [10, 11, 12], district: [13, 14, 15, 16],
    greencrest: [17, 18, 19], misc: [20, 21, 22], internship: [23, 24, 25]
  };
  const dialog = document.querySelector('.gallery-dialog');
  const dialogImage = dialog.querySelector('figure img');
  const dialogFigure = dialog.querySelector('figure');
  const zoomButton = dialog.querySelector('.gallery-zoom');
  const caption = dialog.querySelector('figcaption');
  const counter = dialog.querySelector('.gallery-count');
  let activeGallery = [];
  let activeIndex = 0;
  function showImage() {
    const page = activeGallery[activeIndex];
    dialogImage.src = `./public/images/portfolio-${String(page).padStart(2, '0')}.webp`;
    dialogImage.alt = `Portfolio visual, page ${page}`;
    dialogFigure.classList.remove('is-zoomed');
    zoomButton.setAttribute('aria-pressed', 'false');
    zoomButton.textContent = 'ZOOM +';
    zoomButton.setAttribute('aria-label', 'Zoom image');
    caption.textContent = `LIYANA PALLIYALI  /  PORTFOLIO PAGE ${String(page).padStart(2, '0')}`;
    counter.textContent = `${String(activeIndex + 1).padStart(2, '0')}  /  ${String(activeGallery.length).padStart(2, '0')}`;
  }
  function openGallery(key) {
    activeGallery = galleryData[key] || [];
    activeIndex = 0;
    if (!activeGallery.length) return;
    showImage();
    dialog.showModal();
  }
  document.querySelectorAll('[data-gallery]').forEach((button) => button.addEventListener('click', () => openGallery(button.dataset.gallery)));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.gallery-prev').addEventListener('click', () => { activeIndex = (activeIndex + activeGallery.length - 1) % activeGallery.length; showImage(); });
  dialog.querySelector('.gallery-next').addEventListener('click', () => { activeIndex = (activeIndex + 1) % activeGallery.length; showImage(); });
  zoomButton.addEventListener('click', () => {
    const zoomed = dialogFigure.classList.toggle('is-zoomed');
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    zoomButton.textContent = zoomed ? 'FIT' : 'ZOOM +';
    zoomButton.setAttribute('aria-label', zoomed ? 'Fit image to screen' : 'Zoom image');
    if (!zoomed) dialogFigure.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  addEventListener('keydown', (event) => {
    if (!dialog.open) return;
    if (event.key === 'ArrowRight') { activeIndex = (activeIndex + 1) % activeGallery.length; showImage(); }
    if (event.key === 'ArrowLeft') { activeIndex = (activeIndex + activeGallery.length - 1) % activeGallery.length; showImage(); }
  });
})();
