/* ===== Premium UI Interactions ===== */
/* Custom cursor, particle canvas, header scroll, scan-line */

(function () {
  'use strict';

  // ---------- Custom Cursor ----------
  const cursor = document.getElementById('custom-cursor');
  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let isMoving = false;
  let idleTimer = null;
  let rafId = null;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isMoving) {
      isMoving = true;
      rafId = requestAnimationFrame(animateCursor);
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { isMoving = false; }, 100);
  });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.16;
    cursorY += (mouseY - cursorY) * 0.16;
    if (cursor) {
      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
    }
    if (isMoving) {
      rafId = requestAnimationFrame(animateCursor);
    }
  }

  // Expand cursor on interactive elements
  const CLICKABLE = 'a, button, [role="button"], input, select, textarea, label, [contenteditable], .snip-item, .panel-tab, .sim-ctrl-btn';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(CLICKABLE) && cursor) {
      cursor.classList.add('is-hovering');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (cursor) cursor.classList.remove('is-hovering');
  });

  // ---------- Particle Canvas ----------
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const PARTICLE_COUNT = 55;
    const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

    function createParticle() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.3,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        alpha: Math.random() * 0.4 + 0.05,
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }

    let scrollY = 0;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

    function drawParticles() {
      ctx.clearRect(0, 0, W, H);
      const color = isDark() ? '88, 209, 255' : '74, 20, 140';
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy - scrollY * 0.0003;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(drawParticles);
    }
    drawParticles();
  }

  // ---------- Header scroll border ----------
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 8) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

  // ---------- Scan-line on analysis open ----------
  window._triggerScanLine = function () {
    const scanLine = document.getElementById('scan-line');
    if (!scanLine) return;
    scanLine.classList.remove('is-scanning');
    void scanLine.offsetWidth;
    scanLine.classList.add('is-scanning');
    scanLine.addEventListener('animationend', () => {
      scanLine.classList.remove('is-scanning');
    }, { once: true });
  };

})();
