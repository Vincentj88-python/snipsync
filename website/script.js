// ============================================
// CANVAS WAVE BACKGROUND — mouse-reactive
// ============================================

(function () {
  const canvas = document.getElementById('waves-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w, h, time = 0;
  const mouse = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smoothing = prefersReduced ? 0.03 : 0.08;
  const mouseInfluence = prefersReduced ? 8 : 50;
  const influenceRadius = 400;

  const waves = [
    { offset: 0,            amp: 60,  freq: 0.0028, color: 'rgba(34,197,94,',  opacity: 0.35 },
    { offset: Math.PI / 2,  amp: 80,  freq: 0.0022, color: 'rgba(74,222,128,', opacity: 0.2  },
    { offset: Math.PI,      amp: 50,  freq: 0.0035, color: 'rgba(22,163,74,',  opacity: 0.25 },
    { offset: Math.PI*1.5,  amp: 70,  freq: 0.002,  color: 'rgba(134,239,172,',opacity: 0.12 },
    { offset: Math.PI*0.7,  amp: 45,  freq: 0.004,  color: 'rgba(255,255,255,',opacity: 0.04 },
  ];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    mouse.x = target.x = w / 2;
    mouse.y = target.y = h / 2;
  }

  function drawWave(wave) {
    ctx.beginPath();
    const step = 3;
    for (let x = 0; x <= w; x += step) {
      const dx = x - mouse.x;
      const dy = h * 0.55 - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / influenceRadius);
      const mouseEff = influence * mouseInfluence * Math.sin(time * 0.0015 + x * 0.008 + wave.offset);

      const y = h * 0.55
        + Math.sin(x * wave.freq + time * 0.002 + wave.offset) * wave.amp
        + Math.sin(x * wave.freq * 0.4 + time * 0.003) * (wave.amp * 0.4)
        + mouseEff;

      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = wave.color + wave.opacity + ')';
    ctx.shadowBlur = 30;
    ctx.shadowColor = wave.color + (wave.opacity * 0.6) + ')';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function animate() {
    time++;
    mouse.x += (target.x - mouse.x) * smoothing;
    mouse.y += (target.y - mouse.y) * smoothing;

    ctx.clearRect(0, 0, w, h);

    // Very subtle radial glow behind waves
    const grad = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.5);
    grad.addColorStop(0, 'rgba(34,197,94,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    waves.forEach(drawWave);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { target.x = e.clientX; target.y = e.clientY; });
  window.addEventListener('mouseleave', () => { target.x = w / 2; target.y = h / 2; });
  requestAnimationFrame(animate);
})();


// ============================================
// SCROLL REVEAL
// ============================================

(function () {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  document.querySelectorAll(
    '.bento-card, .how-step, .dl-inner, .hero-content, .hero-mockup, .pricing-card, .encryption-inner'
  ).forEach((el) => observer.observe(el));
})();


// ============================================
// NAV SCROLL STATE
// ============================================

(function () {
  const nav = document.getElementById('nav');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('nav--solid', window.scrollY > 50);
        ticking = false;
      });
      ticking = true;
    }
  });
})();


// ============================================
// TYPED TEXT EFFECT IN MOCKUP
// ============================================

(function () {
  const el = document.getElementById('typed-text');
  if (!el) return;

  const phrases = [
    'https://figma.com/design/new-dashboard',
    'meeting notes: ship v1 by friday',
    'const data = await fetch(url)',
    '742 Evergreen Terrace, Springfield',
    'remember to update the API keys',
  ];

  let phraseIdx = 0;
  let charIdx = 0;
  let deleting = false;
  let pauseTimer = null;

  function tick() {
    const phrase = phrases[phraseIdx];

    if (!deleting) {
      charIdx++;
      el.textContent = phrase.slice(0, charIdx);
      if (charIdx === phrase.length) {
        pauseTimer = setTimeout(() => { deleting = true; tick(); }, 2200);
        return;
      }
      setTimeout(tick, 40 + Math.random() * 40);
    } else {
      charIdx--;
      el.textContent = phrase.slice(0, charIdx);
      if (charIdx === 0) {
        deleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 20);
    }
  }

  setTimeout(tick, 1200);
})();


// ============================================
// MOBILE NAV TOGGLE
// ============================================

(function () {
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.getElementById('nav-links');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
})();


// ============================================
// SMOOTH ANCHOR SCROLLING
// ============================================

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});


// ============================================
// WAITLIST FORM
// ============================================

(function () {
  const form = document.getElementById('waitlist-form');
  if (!form) return;

  const SUPABASE_URL = 'https://api.snipsync.xyz';
  const SUPABASE_ANON_KEY = 'sb_publishable_zIpqTNUAc7WQH8QgKQKlzw_yJkfcdPq';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('waitlist-email').value.trim();
    const status = document.getElementById('waitlist-status');
    const btn = form.querySelector('.waitlist-btn');

    if (!email) return;

    btn.textContent = 'Joining...';
    btn.disabled = true;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        status.textContent = "You're on the list! Check your inbox for a welcome email.";
        status.className = 'waitlist-status waitlist-status--success';
        form.querySelector('.waitlist-input').value = '';
      } else if (res.status === 409) {
        status.textContent = "You're already on the list! We'll be in touch soon.";
        status.className = 'waitlist-status waitlist-status--success';
      } else {
        throw new Error('Failed');
      }
    } catch {
      status.textContent = 'Something went wrong. Try again or email vincent@snipsync.xyz';
      status.className = 'waitlist-status waitlist-status--error';
    }

    btn.textContent = 'Join waitlist';
    btn.disabled = false;
  });
})();

// ============================================
// COUNTDOWN TIMER
// ============================================

(function () {
  const launchDate = new Date('2026-05-24T09:00:00Z');

  function update() {
    const now = Date.now();
    const diff = launchDate - now;

    if (diff <= 0) {
      // Update nav countdown
      const navCountdown = document.getElementById('nav-countdown');
      if (navCountdown) {
        const label = navCountdown.querySelector('.countdown-label');
        const timer = navCountdown.querySelector('.countdown-timer');
        if (label) label.textContent = 'Beta is live!';
        if (timer) timer.style.display = 'none';
      }
      // Update hero pill
      const pill = document.querySelector('.hero-pill-text');
      if (pill) pill.textContent = 'Beta is live — Mac & Windows';
      // Update hero CTA
      const ctaBtn = document.querySelector('.btn-main');
      if (ctaBtn) ctaBtn.textContent = 'Download now';
      // Update nav CTA
      const navCta = document.querySelector('.nav-cta');
      if (navCta) navCta.textContent = 'Download now';
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    const d = document.getElementById('cd-days');
    const h = document.getElementById('cd-hours');
    const m = document.getElementById('cd-mins');
    const s = document.getElementById('cd-secs');

    if (d) d.textContent = String(days).padStart(2, '0');
    if (h) h.textContent = String(hours).padStart(2, '0');
    if (m) m.textContent = String(mins).padStart(2, '0');
    if (s) s.textContent = String(secs).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
})();


// ============================================
// CURSOR GLOW FOLLOWER
// ============================================

(function () {
  var glow = document.getElementById('cursor-glow');
  if (!glow) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ('ontouchstart' in window) return;

  var mx = -500, my = -500;
  var cx = -500, cy = -500;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
    if (!glow.classList.contains('active')) glow.classList.add('active');
  });

  document.addEventListener('mouseleave', function () {
    glow.classList.remove('active');
  });

  (function animate() {
    cx += (mx - cx) * 0.07;
    cy += (my - cy) * 0.07;
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
    requestAnimationFrame(animate);
  })();
})();


// ============================================
// MAGNETIC BUTTONS
// ============================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ('ontouchstart' in window) return;

  var buttons = document.querySelectorAll('.btn-main, .nav-cta, .pricing-btn--pro, .waitlist-btn');
  var strength = 0.3;

  buttons.forEach(function (btn) {
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      btn.style.transition = 'transform 150ms ease-out';
      btn.style.transform = 'translate(' + (x * strength) + 'px, ' + (y * strength) + 'px)';
    });

    btn.addEventListener('mouseleave', function () {
      btn.style.transition = 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)';
      btn.style.transform = '';
    });
  });
})();


// ============================================
// CIPHER TEXT SCRAMBLE — Encryption Section
// ============================================

(function () {
  var encVisual = document.querySelector('.encryption-visual');
  var cipherEl = document.getElementById('enc-cipher');
  var plainBottomEl = document.getElementById('enc-plain-bottom');
  if (!encVisual || !cipherEl || !plainBottomEl) return;

  var plainText = '"API key: sk_live_abc123"';
  var cipherText = 'x8Kf2mQ9v...bL7nP3w==';
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var done = false;

  function scramble(el, target, startText, duration) {
    return new Promise(function (resolve) {
      var len = Math.max(target.length, startText.length);
      var t0 = performance.now();
      (function step() {
        var p = Math.min((performance.now() - t0) / duration, 1);
        var out = '';
        for (var i = 0; i < len; i++) {
          var cp = Math.max(0, Math.min(1, (p - (i / len) * 0.5) / 0.5));
          if (cp <= 0) out += (startText[i] || ' ');
          else if (cp >= 1) out += (target[i] || '');
          else out += chars[(Math.random() * chars.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(step);
        else { el.textContent = target; resolve(); }
      })();
    });
  }

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !done) {
        done = true;
        // Set initial state: show plaintext everywhere
        cipherEl.textContent = plainText;
        plainBottomEl.textContent = cipherText;
        // Phase 1: encrypt middle row, then Phase 2: decrypt bottom row
        setTimeout(function () {
          scramble(cipherEl, cipherText, plainText, 1400).then(function () {
            setTimeout(function () {
              scramble(plainBottomEl, plainText, cipherText, 1200);
            }, 300);
          });
        }, 600);
        obs.disconnect();
      }
    });
  }, { threshold: 0.35 });

  obs.observe(encVisual);
})();


// ============================================
// HERO PARALLAX
// ============================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 768) return;

  var content = document.getElementById('hero-content');
  var mockup = document.getElementById('hero-mockup');
  if (!content || !mockup) return;

  var ticking = false;

  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        if (!content.classList.contains('visible')) { ticking = false; return; }
        var y = window.scrollY;
        var max = window.innerHeight;
        if (y < max) {
          content.style.transform = 'translateY(' + (y * 0.12) + 'px)';
          mockup.style.transform = 'translateY(' + (y * 0.06) + 'px)';
          var fade = Math.max(0.15, 1 - (y / max) * 0.6);
          content.style.opacity = fade;
          mockup.style.opacity = fade;
        }
        ticking = false;
      });
      ticking = true;
    }
  });
})();


// ============================================
// COMPARISON TABLE REVEAL
// ============================================

(function () {
  var table = document.querySelector('.comparison-table');
  var rows = document.querySelectorAll('.comparison-row:not(.comparison-row--header)');
  if (!table || !rows.length) return;

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        rows.forEach(function (row, i) {
          setTimeout(function () { row.classList.add('revealed'); }, i * 120);
        });
        obs.disconnect();
      }
    });
  }, { threshold: 0.15 });

  obs.observe(table);
})();


// ============================================
// MOCKUP 3D TILT ON HOVER
// ============================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ('ontouchstart' in window) return;

  var tilt = document.getElementById('mockup-tilt');
  var container = document.querySelector('.hero-mockup');
  if (!tilt || !container) return;

  container.addEventListener('mousemove', function (e) {
    var rect = container.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width - 0.5;
    var y = (e.clientY - rect.top) / rect.height - 0.5;
    tilt.style.transform = 'perspective(800px) rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg)';
    tilt.style.transition = 'transform 150ms ease-out';
  });

  container.addEventListener('mouseleave', function () {
    tilt.style.transition = 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)';
    tilt.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  });
})();
