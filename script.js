/* =========================================================
   0. HELPERS
========================================================= */

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const root = document.documentElement;
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* =========================================================
   1. PRELOADER
========================================================= */

(function preloader() {
  const preloader = $("#preloader");
  const bar       = $("#preloaderBar");
  const text      = $("#preloaderText");
  if (!preloader) return;

  const steps = [
    "Initializing…",
    "Loading assets…",
    "Building interface…",
    "Ready."
  ];

  let progress = 0;
  let finished = false;

  const tick = setInterval(() => {
    progress += Math.random() * 14 + 5;

    if (progress >= 100) {
      progress = 100;
      clearInterval(tick);
      done();
    }

    bar.style.width = progress + "%";
    text.textContent = steps[Math.min(steps.length - 1, Math.floor(progress / 28))];
  }, 95);

  function done() {
    if (finished) return;
    finished = true;

    setTimeout(() => {
      preloader.classList.add("done");
      document.body.classList.add("loaded");
      startReveal();
      setTimeout(() => preloader.remove(), 700);
    }, 280);
  }

  // Fallback an toàn nếu có gì đó treo
  setTimeout(done, 4000);
})();


/* =========================================================
   2. THEME TOGGLE
========================================================= */

(function theme() {
  const toggle = $("#themeToggle");
  const icon   = $("#themeIcon");

  function syncIcon() {
    const isLight = root.getAttribute("data-theme") === "light";
    icon.textContent = isLight ? "☀️" : "🌙";
  }

  syncIcon();

  toggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    syncIcon();
    refreshCanvasColor();
    toast(`Switched to ${next} mode`, "info", "🎨");
  });
})();


/* =========================================================
   CUSTOM CURSOR (fixed — bám sát chuột)
========================================================= */

(function cursor() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const dot  = $("#cursorDot");
  const ring = $("#cursorRing");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX  = mouseX;
  let ringY  = mouseY;

  // Hệ số lerp: càng cao càng bám sát (0.4 = mượt + nhanh, 0.6 = gần như tức thì)
  const LERP = 0.4;

  // Ngưỡng khoảng cách — nếu ring lệch < 0.5px thì snap thẳng vào vị trí
  const SNAP = 0.5;

  document.body.classList.add("cursor-ready");

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + "px";
    dot.style.top  = mouseY + "px";
  });

  (function loop() {
    const dx = mouseX - ringX;
    const dy = mouseY - ringY;

    if (Math.abs(dx) < SNAP && Math.abs(dy) < SNAP) {
      ringX = mouseX;
      ringY = mouseY;
    } else {
      ringX += dx * LERP;
      ringY += dy * LERP;
    }

    ring.style.left = ringX + "px";
    ring.style.top  = ringY + "px";

    requestAnimationFrame(loop);
  })();

  const hoverTargets = "a, button, .project-card, .skill-card, .info-card, .repo-card, .contact-link, input, textarea";

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(hoverTargets)) ring.classList.add("hover");
  });

  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(hoverTargets)) ring.classList.remove("hover");
  });

  document.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });

  document.addEventListener("mouseenter", () => {
    dot.style.opacity = "1";
    ring.style.opacity = "1";
  });
})();


/* =========================================================
   4. BACKGROUND PARTICLES (CANVAS) — nâng cấp độ rõ
========================================================= */

let refreshCanvasColor = () => {};

(function particles() {
  if (prefersReduced) return;

  const canvas = $("#bgCanvas");
  const ctx    = canvas.getContext("2d");

  let W, H, particles = [];
  let accent      = [168, 85, 247];
  let accentLight = [216, 160, 255]; // màu sáng cho hạt "sao"

  const mouse = { x: -9999, y: -9999 };

  /* ---------- TINH CHỈNH ĐỘ RÕ Ở ĐÂY ---------- */
  const CONFIG = {
    DENSITY:        13000,   // càng nhỏ càng nhiều hạt (cũ: 20000)
    MAX_COUNT:      150,     // trần số hạt (cũ: 100)

    MIN_RADIUS:     1.0,     // hạt nhỏ nhất (cũ: 0.6)
    MAX_RADIUS:     2.8,     // hạt lớn nhất (cũ: 1.6)
    STAR_CHANCE:    0.06,    // 6% hạt là "sao sáng" to hơn

    PARTICLE_ALPHA: 0.85,    // độ đục của hạt (cũ: 0.55)
    LINE_ALPHA:     0.28,    // độ đục đường nối (cũ: 0.16)
    MOUSE_LINE_ALPHA: 0.5,   // đường nối vào chuột (cũ: 0.3)

    LINK_DIST:      160,     // khoảng cách tối đa để nối (cũ: 130)
    MOUSE_DIST:     190,     // bán kính ảnh hưởng chuột (cũ: 150)

    GLOW:           true,    // bật glow cho hạt (đẹp hơn nhưng nặng hơn chút)
    TWINKLE:        true,    // hạt nhấp nháy nhẹ như sao thật
  };
  /* -------------------------------------------- */

  function hexToRgb(hex) {
    hex = hex.trim().replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lighten([r, g, b], amount = 60) {
    return [
      Math.min(255, r + amount),
      Math.min(255, g + amount),
      Math.min(255, b + amount)
    ];
  }

  refreshCanvasColor = function () {
    const raw = getComputedStyle(root).getPropertyValue("--accent");
    if (raw) {
      accent = hexToRgb(raw);
      accentLight = lighten(accent, 60);
    }
  };

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build();
  }

  function build() {
    const count = Math.min(
      CONFIG.MAX_COUNT,
      Math.floor((W * H) / CONFIG.DENSITY)
    );

    particles = Array.from({ length: count }, () => {
      const isStar = Math.random() < CONFIG.STAR_CHANCE;

      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: isStar
          ? Math.random() * 1.6 + CONFIG.MAX_RADIUS
          : Math.random() * (CONFIG.MAX_RADIUS - CONFIG.MIN_RADIUS) + CONFIG.MIN_RADIUS,
        isStar,
        // twinkle
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.4
      };
    });
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    const [r, g, b]       = accent;
    const [rl, gl, bl]    = accentLight;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Cập nhật vị trí
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      // Đẩy hạt ra khỏi chuột (nhẹ nhàng hơn bản cũ)
      const dxm = p.x - mouse.x;
      const dym = p.y - mouse.y;
      const dm  = Math.hypot(dxm, dym);

      if (dm < CONFIG.MOUSE_DIST && dm > 0) {
        const force = (CONFIG.MOUSE_DIST - dm) / CONFIG.MOUSE_DIST;
        p.x += (dxm / dm) * force * 1.2;
        p.y += (dym / dm) * force * 1.2;
      }

      // Twinkle — nhấp nháy nhẹ
      let twinkleAlpha = 1;
      if (CONFIG.TWINKLE) {
        twinkleAlpha = 0.55 + 0.45 * Math.sin(t * 0.001 * p.speed + p.phase);
      }

      // Vẽ hạt
      const baseAlpha = (p.isStar ? 1 : CONFIG.PARTICLE_ALPHA) * twinkleAlpha;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

      // Hạt "sao" đổi sang màu sáng hơn
      if (p.isStar) {
        ctx.fillStyle = `rgba(${rl}, ${gl}, ${bl}, ${baseAlpha})`;
      } else {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha})`;
      }

      if (CONFIG.GLOW) {
        ctx.shadowBlur  = p.isStar ? 14 : 6;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${baseAlpha * 0.9})`;
      }

      ctx.fill();
      ctx.shadowBlur = 0;

      // Nối các hạt gần nhau
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d  = Math.hypot(dx, dy);

        if (d < CONFIG.LINK_DIST) {
          const alpha = CONFIG.LINE_ALPHA * (1 - d / CONFIG.LINK_DIST);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Nối hạt với chuột
      if (dm < CONFIG.MOUSE_DIST) {
        const alpha = CONFIG.MOUSE_LINE_ALPHA * (1 - dm / CONFIG.MOUSE_DIST);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(${rl}, ${gl}, ${bl}, ${alpha})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseout", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  refreshCanvasColor();
  resize();
  requestAnimationFrame(draw);
})();


/* =========================================================
   5. MOUSE GLOW (lớp sáng theo con trỏ)
========================================================= */

(function mouseGlow() {
  if (prefersReduced) return;

  const glow = document.createElement("div");
  glow.classList.add("mouse-glow");
  document.body.appendChild(glow);

  document.addEventListener("mousemove", (e) => {
    glow.style.left = e.clientX + "px";
    glow.style.top  = e.clientY + "px";
  });
})();


/* =========================================================
   6. SCROLL PROGRESS + BACK TO TOP
========================================================= */

(function scrollUI() {
  const bar     = $("#scrollProgress");
  const toTop   = $("#toTop");
  const ring    = $("#toTopRing");
  const CIRC    = 2 * Math.PI * 20; // r = 20

  function update() {
    const scrollTop = window.scrollY;
    const height    = document.documentElement.scrollHeight - window.innerHeight;
    const ratio     = height > 0 ? Math.min(scrollTop / height, 1) : 0;

    bar.style.width = (ratio * 100) + "%";
    ring.style.strokeDashoffset = CIRC * (1 - ratio);

    toTop.classList.toggle("show", scrollTop > 420);
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();

  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();


/* =========================================================
   7. ACTIVE NAV LINK
========================================================= */

(function activeNav() {
  const sections = $$("section[id]");
  const links    = $$(".nav-links a");

  function update() {
    let current = "";

    sections.forEach((section) => {
      const top = section.offsetTop - 160;
      if (window.scrollY >= top && window.scrollY < top + section.offsetHeight) {
        current = section.id;
      }
    });

    links.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  }

  window.addEventListener("scroll", update, { passive: true });
  update();
})();


/* =========================================================
   8. SCROLL REVEAL
========================================================= */

let revealObserver = null;

function startReveal() {
  const elements = $$(".section, .hero-content, .hero-card, .marquee, .timeline-item");

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
  );

  elements.forEach((el) => {
    el.classList.add("hidden");
    revealObserver.observe(el);
  });

  // Chạy các hiệu ứng phụ thuộc vào reveal
  observeCounters();
  observeSkillBars();
}


/* =========================================================
   9. TYPING EFFECT
========================================================= */

(function typing() {
  const target = $("#typingText");
  if (!target) return;

  const roles = [
    "Information Systems Student",
    "Web Development Learner",
    "AI & Business Enthusiast"
  ];

  if (prefersReduced) {
    target.textContent = roles[0];
    return;
  }

  let roleIndex = 0;
  let charIndex = 0;
  let deleting  = false;

  function tick() {
    const current = roles[roleIndex];

    if (!deleting) {
      target.textContent = current.substring(0, ++charIndex);
      if (charIndex === current.length) {
        deleting = true;
        return setTimeout(tick, 1300);
      }
    } else {
      target.textContent = current.substring(0, --charIndex);
      if (charIndex === 0) {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
      }
    }

    setTimeout(tick, deleting ? 45 : 80);
  }

  tick();
})();


/* =========================================================
   10. 3D TILT
========================================================= */

function initTilt() {
  if (prefersReduced) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const MAX = 8;

  $$("[data-tilt]").forEach((card) => {
    // Tránh gắn sự kiện 2 lần nếu hàm được gọi lại
    if (card.dataset.tiltInitialized) return;
    card.dataset.tiltInitialized = "true";

    card.style.willChange = "transform";

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rx = ((y / rect.height) - 0.5) * -MAX;
      const ry = ((x / rect.width)  - 0.5) *  MAX;

      card.style.transform =
        `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;

      card.style.setProperty("--mx", x + "px");
      card.style.setProperty("--my", y + "px");
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

initTilt();


/* =========================================================
   11. ANIMATED COUNTERS
========================================================= */

function observeCounters() {
  const counters = $$("[data-count]");
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const pad    = parseInt(el.dataset.pad || "0", 10);
      const suffix = el.dataset.suffix || "";

      let current = 0;
      const duration = 1200;
      const startTime = performance.now();

      function step(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        current = Math.round(target * eased);
        el.textContent = String(current).padStart(pad, "0") + suffix;
        if (p < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach((c) => observer.observe(c));
}


/* =========================================================
   12. SKILL BARS
========================================================= */

function observeSkillBars() {
  const bars = $$(".skill-bar i");
  if (!bars.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.width = el.dataset.level + "%";
      observer.unobserve(el);
    });
  }, { threshold: 0.4 });

  bars.forEach((b) => observer.observe(b));
}


/* =========================================================
   13. PROJECT FILTER
========================================================= */

(function filterProjects() {
  const buttons = $$(".filter-btn");
  const cards   = $$(".project-card");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;

      buttons.forEach((b) => b.classList.toggle("active", b === btn));

      cards.forEach((card) => {
        const match = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("hide", !match);
      });
    });
  });
})();


/* =========================================================
   14. TOAST SYSTEM
========================================================= */

function toast(message, type = "info", icon = "✨", duration = 3200) {
  const stack = $("#toastStack");
  if (!stack) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;

  stack.appendChild(el);

  setTimeout(() => {
    el.classList.add("leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, duration);
}


/* =========================================================
   15. CONTACT FORM
========================================================= */

(function contactForm() {
  const form = $("#contactForm");
  if (!form) return;

  const rules = {
    name: (v) => v.trim().length >= 2 || "Please enter at least 2 characters.",
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || "Please enter a valid email.",
    message: (v) => v.trim().length >= 10 || "Message should be at least 10 characters."
  };

  function validateField(input) {
    const field = input.closest(".field");
    const errorEl = field.querySelector(".error");
    const result = rules[input.name](input.value);

    if (result === true) {
      field.classList.remove("invalid");
      errorEl.textContent = "";
      return true;
    }

    field.classList.add("invalid");
    errorEl.textContent = result;
    return false;
  }

  $$("input, textarea", form).forEach((input) => {
    input.addEventListener("blur", () => validateField(input));
    input.addEventListener("input", () => {
      if (input.closest(".field").classList.contains("invalid")) {
        validateField(input);
      }
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const inputs = $$("input, textarea", form);
    const valid = inputs.map(validateField).every(Boolean);

    if (!valid) {
      toast("Please fix the highlighted fields.", "error", "⚠️");
      return;
    }

    const btn = $("#submitBtn");
    const label = btn.querySelector("span");
    const original = label.textContent;

    btn.disabled = true;
    label.textContent = "Sending…";

    setTimeout(() => {
      btn.disabled = false;
      label.textContent = original;
      form.reset();
      toast("Message sent! Thanks for reaching out 🚀", "success", "✅");
    }, 1100);
  });
})();


/* =========================================================
   16. COPY EMAIL
========================================================= */

(function copyEmail() {
  const btn = $("#copyMail");
  if (!btn) return;

  const EMAIL = "pngocthach2006@gmail.com";

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      toast("Email copied to clipboard!", "success", "📋");
    } catch {
      toast("Could not copy — please copy manually.", "error", "⚠️");
    }
  });
})();


/* =========================================================
   17. MOBILE MENU
========================================================= */

(function mobileMenu() {
  const toggle   = $("#menuToggle");
  const navLinks = $("#navLinks");

  toggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });

  $$(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => navLinks.classList.remove("open"));
  });

  document.addEventListener("click", (e) => {
    if (!navLinks.classList.contains("open")) return;
    if (e.target.closest("#navLinks") || e.target.closest("#menuToggle")) return;
    navLinks.classList.remove("open");
  });
})();


/* =========================================================
   18. COMMAND PALETTE (Ctrl / ⌘ + K)
========================================================= */

(function commandPalette() {
  const overlay = $("#cmdk");
  const input   = $("#cmdkInput");
  const list    = $("#cmdkList");
  const trigger = $("#cmdkTrigger");

  const goTo = (id) => {
    close();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const commands = [
    { icon: "🏠", label: "Go to Home",     hint: "Section", run: () => goTo("home") },
    { icon: "👤", label: "Go to About",    hint: "Section", run: () => goTo("about") },
    { icon: "⚡", label: "Go to Skills",   hint: "Section", run: () => goTo("skills") },
    { icon: "🧩", label: "Go to Process",  hint: "Section", run: () => goTo("process") },
    { icon: "🖼️", label: "Go to Gallery",  hint: "Section", run: () => goTo("gallery") },
    { icon: "💼", label: "Go to Projects", hint: "Section", run: () => goTo("projects") },
    { icon: "🧭", label: "Go to Journey",  hint: "Section", run: () => goTo("journey") },
    { icon: "✉️", label: "Go to Contact",  hint: "Section", run: () => goTo("contact") },
    

    {
      icon: "🎨", label: "Toggle theme", hint: "Appearance",
      run: () => { close(); $("#themeToggle").click(); }
    },
    {
      icon: "📋", label: "Copy email address", hint: "Clipboard",
      run: async () => {
        close();
        try {
          await navigator.clipboard.writeText("pngocthach2006@gmail.com");
          toast("Email copied!", "success", "📋");
        } catch {
          toast("Copy failed.", "error", "⚠️");
        }
      }
    },
    {
      icon: "✨", label: "Toggle background effects", hint: "Performance",
      run: () => {
        close();
        document.body.classList.toggle("no-fx");
        const off = document.body.classList.contains("no-fx");
        toast(`Background effects ${off ? "off" : "on"}`, "info", "✨");
      }
    },
    {
      icon: "⬆️", label: "Scroll to top", hint: "Navigation",
      run: () => { close(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    },
    {
      icon: "🐙", label: "Open GitHub", hint: "External",
      run: () => { close(); window.open("https://github.com/Te06", "_blank"); }
    }
  ];

  let filtered = [...commands];
  let activeIndex = 0;

  function render() {
    list.innerHTML = "";

    if (!filtered.length) {
      list.innerHTML = `<li class="cmdk-empty">No commands found.</li>`;
      return;
    }

    filtered.forEach((cmd, i) => {
      const li = document.createElement("li");
      li.className = "cmdk-item" + (i === activeIndex ? " active" : "");
      li.innerHTML = `
        <span class="cmdk-item-icon">${cmd.icon}</span>
        <span>${cmd.label}</span>
        <span class="cmdk-item-hint">${cmd.hint}</span>
      `;

      li.addEventListener("mouseenter", () => {
        activeIndex = i;
        render();
      });

      li.addEventListener("click", () => cmd.run());

      list.appendChild(li);
    });

    list.querySelector(".cmdk-item.active")?.scrollIntoView({ block: "nearest" });
  }

  function filter(value) {
    const q = value.trim().toLowerCase();
    filtered = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q))
      : [...commands];
    activeIndex = 0;
    render();
  }

  function open() {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    input.value = "";
    filter("");
    setTimeout(() => input.focus(), 60);
  }

  function close() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    input.blur();
  }

  trigger.addEventListener("click", open);

  overlay.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-cmdk-close")) close();
  });

  input.addEventListener("input", () => filter(input.value));

  document.addEventListener("keydown", (e) => {
    const isOpen = overlay.classList.contains("open");

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      isOpen ? close() : open();
      return;
    }

    if (!isOpen) return;

    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % Math.max(filtered.length, 1);
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + filtered.length) % Math.max(filtered.length, 1);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.run();
    }
  });

  // Mở palette khi bấm "/" (nếu không ở trong ô input)
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/input|textarea/i.test(e.target.tagName)) {
      e.preventDefault();
      open();
    }
  });
})();


/* =========================================================
   19. KONAMI CODE EASTER EGG  🎮
========================================================= */

(function konami() {
  const sequence = [
    "ArrowUp", "ArrowUp",
    "ArrowDown", "ArrowDown",
    "ArrowLeft", "ArrowRight",
    "ArrowLeft", "ArrowRight",
    "b", "a"
  ];

  let index = 0;

  document.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (key === sequence[index]) {
      index++;

      if (index === sequence.length) {
        index = 0;
        activate();
      }
    } else {
      index = key === sequence[0] ? 1 : 0;
    }
  });

  function activate() {
    toast("🎮 KONAMI CODE ACTIVATED — Party mode!", "success", "🎉", 5000);

    document.body.classList.add("party");

    const style = document.createElement("style");
    style.id = "partyStyle";
    style.textContent = `
      body.party .glow-one { animation: partySpin 3s linear infinite; }
      body.party .profile-circle { animation: partyHue 1.2s linear infinite; }
      body.party .logo span { animation: partyHue 0.8s linear infinite; }
      @keyframes partySpin { to { transform: rotate(360deg); } }
      @keyframes partyHue { to { filter: hue-rotate(360deg); } }
    `;

    if (!$("#partyStyle")) document.head.appendChild(style);

    setTimeout(() => {
      document.body.classList.remove("party");
      $("#partyStyle")?.remove();
    }, 6000);
  }
})();


/* =========================================================
   20. SMOOTH ANCHOR SCROLL (fallback cho Safari cũ)
========================================================= */

document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;

  const id = link.getAttribute("href");
  if (id === "#" || id.length < 2) return;

  const target = document.querySelector(id);
  if (!target) return;

  e.preventDefault();
  window.scrollTo({
    top: target.offsetTop - 80,
    behavior: "smooth"
  });
});


/* =========================================================
   21. TIME-BASED GREETING
========================================================= */

(function greeting() {
  const el = $("#greeting");
  if (!el) return;

  const hour = new Date().getHours();
  let greet;

  if (hour >= 5 && hour < 12)       greet = "GOOD MORNING, I'M";
  else if (hour >= 12 && hour < 18) greet = "GOOD AFTERNOON, I'M";
  else if (hour >= 18 && hour < 22) greet = "GOOD EVENING, I'M";
  else                              greet = "LATE NIGHT, HUH? I'M";

  el.textContent = greet;
})();


/* =========================================================
   22. TEXT SCRAMBLE
========================================================= */

(function scramble() {
  if (prefersReduced) return;

  const chars = "!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  class Scrambler {
    constructor(el, finalText) {
      this.el = el;
      this.final = finalText;
      this.frame = 0;
      this.queue = [];
      this.build();
    }

    build() {
      const oldText = this.el.dataset.scrambleOld || "";
      const length = Math.max(oldText.length, this.final.length);

      for (let i = 0; i < length; i++) {
        const from = oldText[i] || "";
        const to   = this.final[i] || "";

        const start = Math.floor(Math.random() * 30);
        const end   = start + Math.floor(Math.random() * 30) + 10;

        this.queue.push({ from, to, start, end, char: "" });
      }

      this.el.dataset.scrambleOld = this.final;
      this.update();
    }

    update() {
      let output = "";
      let complete = 0;

      for (let i = 0; i < this.queue.length; i++) {
        const q = this.queue[i];

        if (this.frame >= q.end) {
          complete++;
          output += q.to;
        } else if (this.frame >= q.start) {
          if (!q.char || Math.random() < 0.28) {
            q.char = chars[Math.floor(Math.random() * chars.length)];
          }
          output += `<span class="term-accent">${q.char}</span>`;
        } else {
          output += q.from;
        }
      }

      this.el.innerHTML = output;

      if (complete === this.queue.length) {
        this.el.innerHTML = this.final;
      } else {
        this.frame++;
        requestAnimationFrame(() => this.update());
      }
    }
  }

  const titles = $$(".section-title h2");

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const text = el.textContent.trim();

      if (!el.dataset.scrambleOld) {
        new Scrambler(el, text);
      }

      obs.unobserve(el);
    });
  }, { threshold: 0.6 });

  titles.forEach((t) => obs.observe(t));
})();


/* =========================================================
   23. GITHUB API — LOAD REAL REPOS
========================================================= */

(function githubRepos() {
  const grid   = $("#reposGrid");
  const status = $("#reposStatus");
  if (!grid) return;

  const USERNAME = "Te06";
  const MAX      = 6;

  const LANG_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    HTML:       "#e34c26",
    CSS:        "#563d7c",
    Python:     "#3572A5",
    Java:       "#b07219",
    "C++":      "#f34b7d",
    C:          "#555555",
    "C#":       "#178600",
    PHP:        "#4F5D95",
    Ruby:       "#701516",
    Go:         "#00ADD8",
    Rust:       "#dea584",
    Shell:      "#89e051"
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };

  function render(repos) {
    status.style.display = "none";
    grid.innerHTML = "";

    if (!repos.length) {
      grid.innerHTML = `<div class="repos-empty">No public repositories yet.</div>`;
      return;
    }

    repos.forEach((repo) => {
      const card = document.createElement("a");
      card.className = "repo-card";
      card.href = repo.html_url;
      card.target = "_blank";
      card.rel = "noopener";

      const lang = repo.language || "Other";
      const langColor = LANG_COLORS[lang] || "#8b8b9a";

      card.innerHTML = `
        <div class="repo-head">
          <span class="repo-name">${repo.name}</span>
          <span class="repo-icon">↗</span>
        </div>
        <p class="repo-desc">${repo.description || "No description provided."}</p>
        <div class="repo-meta">
          <span class="repo-lang">
            <span class="repo-lang-dot" style="background:${langColor}; box-shadow:0 0 8px ${langColor}aa;"></span>
            ${lang}
          </span>
          ${repo.stargazers_count ? `<span>⭐ ${repo.stargazers_count}</span>` : ""}
          ${repo.forks_count ? `<span>🍴 ${repo.forks_count}</span>` : ""}
          <span>🗓 ${fmtDate(repo.updated_at)}</span>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  async function load() {
    try {
      const res = await fetch(
        `https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=${MAX}`
      );

      if (res.status === 403 || res.status === 429) {
        throw new Error("GitHub API rate limit — try again later.");
      }

      if (!res.ok) throw new Error("Failed to load repositories.");

      const data = await res.json();
      render(data);
    } catch (err) {
      status.classList.add("error");
      status.innerHTML = `⚠️ ${err.message}`;
      grid.innerHTML = `<div class="repos-empty">Could not reach GitHub API right now.</div>`;
    }
  }

  load();
})();


/* =========================================================
   24. SOUND EFFECTS (Web Audio API)
========================================================= */

const SoundFX = (function () {
  let ctx = null;
  let enabled = localStorage.getItem("sound") === "on";

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    return ctx;
  }

  function play(freq = 520, duration = 0.08, type = "sine", gain = 0.05) {
    if (!enabled) return;

    try {
      const c = ensureCtx();
      if (c.state === "suspended") c.resume();

      const osc = c.createOscillator();
      const vol = c.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);

      vol.gain.setValueAtTime(gain, c.currentTime);
      vol.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

      osc.connect(vol).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    } catch {}
  }

  return {
    isEnabled: () => enabled,
    toggle() {
      enabled = !enabled;
      localStorage.setItem("sound", enabled ? "on" : "off");
      if (enabled) play(720, 0.1, "sine", 0.06);
      return enabled;
    },
    hover()  { play(660, 0.04, "sine", 0.02); },
    click()  { play(440, 0.08, "triangle", 0.05); },
    success(){ play(880, 0.15, "sine", 0.06); setTimeout(() => play(1320, 0.2, "sine", 0.05), 100); },
    error()  { play(180, 0.2, "sawtooth", 0.05); }
  };
})();

// Gắn sound vào interaction
(function bindSounds() {
  const toggle = $("#soundToggle");
  const icon   = $("#soundIcon");

  function sync() { icon.textContent = SoundFX.isEnabled() ? "🔊" : "🔇"; }
  sync();

  toggle.addEventListener("click", () => {
    const on = SoundFX.toggle();
    sync();
    toast(`Sound ${on ? "on" : "off"}`, "info", on ? "🔊" : "🔇");
  });

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest("a, button, .project-card, .repo-card, .skill-card")) {
      SoundFX.hover();
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) SoundFX.click();
  });
})();


/* =========================================================
   25. MAGNETIC BUTTONS
========================================================= */

(function magnetic() {
  if (prefersReduced) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const targets = $$(".btn, .submit-btn, .filter-btn, .icon-btn, .copy-mail, .contact-link");
  const STRENGTH = 0.28;

  targets.forEach((el) => {
    el.classList.add("magnetic");

    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top  - rect.height / 2;

      el.style.transform = `translate(${x * STRENGTH}px, ${y * STRENGTH}px)`;
    });

    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });
})();


/* =========================================================
   26. CONFETTI
========================================================= */

function fireConfetti(count = 80) {
  const colors = ["#a855f7", "#e879f9", "#7c3aed", "#22c55e", "#f59e0b", "#3b82f6"];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";

    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * 8 + 6;
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
    const startY = window.innerHeight / 2 + (Math.random() - 0.5) * 100;

    piece.style.background = color;
    piece.style.width = size + "px";
    piece.style.height = size + "px";
    piece.style.left = startX + "px";
    piece.style.top  = startY + "px";
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.boxShadow = `0 0 12px ${color}aa`;

    document.body.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 400 + 200;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 200;
    const rotation = Math.random() * 720 - 360;

    piece.animate(
      [
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${vx}px, ${vy + 500}px) rotate(${rotation}deg)`, opacity: 0 }
      ],
      {
        duration: 1400 + Math.random() * 600,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    ).onfinish = () => piece.remove();
  }
}


/* =========================================================
   27. GẮN CONFETTI VÀO FORM SUBMIT
========================================================= */

(function hookConfetti() {
  const form = $("#contactForm");
  if (!form) return;

  form.addEventListener("submit", () => {
    // Chỉ bắn khi validate pass — check sau 1 tick
    setTimeout(() => {
      const invalid = form.querySelector(".field.invalid");
      if (!invalid) {
        fireConfetti(90);
        SoundFX.success();
      } else {
        SoundFX.error();
      }
    }, 50);
  });
})();


/* =========================================================
   28. INTERACTIVE TERMINAL
========================================================= */

(function terminal() {
  const term    = $("#terminal");
  const body    = $("#terminalBody");
  const input   = $("#terminalInput");
  const toggle  = $("#terminalToggle");
  const closeBtn = $("#terminalClose");
  if (!term) return;

  const history = [];
  let historyIndex = -1;

  const commands = {
    help: {
      desc: "Show all available commands",
      run: () => `Available commands:
  <span class="term-accent">help</span>        — show this list
  <span class="term-accent">about</span>       — who I am
  <span class="term-accent">skills</span>      — my tech stack
  <span class="term-accent">projects</span>    — my work
  <span class="term-accent">contact</span>     — how to reach me
  <span class="term-accent">github</span>      — open my GitHub
  <span class="term-accent">email</span>       — copy my email
  <span class="term-accent">theme</span>       — toggle theme
  <span class="term-accent">ls</span>          — list sections
  <span class="term-accent">goto</span> &lt;id&gt;   — scroll to a section
  <span class="term-accent">clear</span>       — clear terminal
  <span class="term-accent">whoami</span>      — a surprise
  <span class="term-accent">exit</span>        — close terminal`
    },

    about: {
      run: () => `<span class="term-accent">Thach Pham</span>
  Information Systems student @ UIT - VNUHCM
  Interested in web development, AI and business technology.`
    },

    skills: {
      run: () => `<span class="term-accent">Tech stack:</span>
  → HTML          ██████████░  90%
  → CSS           █████████░░  85%
  → JavaScript    ████████░░░  75%
  → Database      ██████░░░░░  60%`
    },

    projects: {
      run: () => `<span class="term-accent">Projects:</span>
  01. My First Website
  02. Modern Portfolio
  03. Student Manager (concept)
  04. Future Project (AI)
  → Run <span class="term-accent">goto projects</span> to view them.`
    },

    contact: {
      run: () => `<span class="term-accent">Contact:</span>
  📧 Email: pngocthach2006@gmail.com
  🐙 GitHub: github.com/Te06
  → Run <span class="term-accent">email</span> to copy email to clipboard.`
    },

    github: {
      run: () => {
        window.open("https://github.com/Te06", "_blank");
        return `<span class="term-success">✓ Opening github.com/Te06 …</span>`;
      }
    },

    email: {
      run: async () => {
        try {
          await navigator.clipboard.writeText("pngocthach2006@gmail.com");
          return `<span class="term-success">✓ Email copied: pngocthach2006@gmail.com</span>`;
        } catch {
          return `<span class="term-error">✗ Could not copy email.</span>`;
        }
      }
    },

    theme: {
      run: () => {
        $("#themeToggle").click();
        return `<span class="term-success">✓ Theme toggled.</span>`;
      }
    },

    ls: {
      run: () => `<span class="term-accent">sections:</span>
  home  about  skills  projects  github  journey  contact`
    },

    goto: {
      run: (args) => {
        const id = args[0];
        if (!id) return `<span class="term-error">✗ Usage: goto &lt;section&gt;</span>`;
        const el = document.getElementById(id);
        if (!el) return `<span class="term-error">✗ Section "${id}" not found.</span>`;
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
        return `<span class="term-success">✓ Scrolling to "${id}" …</span>`;
      }
    },

    clear: {
      run: () => {
        body.innerHTML = "";
        return "";
      }
    },

    whoami: {
      run: () => `<span class="term-accent">You are a curious visitor 👀</span>
  And I'm Thach — nice to meet you. Type <span class="term-accent">help</span> to explore more.`
    },

    exit: {
      run: () => {
        setTimeout(closeTerm, 200);
        return `<span class="term-success">✓ Closing terminal…</span>`;
      }
    }
  };

  function openTerm() {
    term.classList.add("open");
    term.setAttribute("aria-hidden", "false");
    setTimeout(() => input.focus(), 300);
    SoundFX.click();
  }

  function closeTerm() {
    term.classList.remove("open");
    term.setAttribute("aria-hidden", "true");
    SoundFX.click();
  }

  function printLine(html, cls = "") {
    const div = document.createElement("div");
    div.className = "terminal-output " + cls;
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function printCommand(cmd) {
    const div = document.createElement("div");
    div.className = "terminal-line";
    div.innerHTML = `<span class="term-user">thach@portfolio</span>:<span class="term-path">~</span>$ <span class="term-cmd">${cmd}</span>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  async function execute(raw) {
    const line = raw.trim();
    if (!line) return;

    printCommand(line);

    const [cmd, ...args] = line.split(/\s+/);
    const c = cmd.toLowerCase();

    if (commands[c]) {
      const out = await commands[c].run(args);
      if (out) printLine(out);
      SoundFX.hover();
    } else {
      printLine(`<span class="term-error">✗ command not found: ${cmd}</span>  (try <span class="term-accent">help</span>)`);
      SoundFX.error();
    }
  }

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const value = input.value;
      input.value = "";

      if (value.trim()) {
        history.unshift(value.trim());
        historyIndex = -1;
      }

      await execute(value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
      } else {
        historyIndex = -1;
        input.value = "";
      }
    }
  });

  toggle.addEventListener("click", () => {
    term.classList.contains("open") ? closeTerm() : openTerm();
  });

  closeBtn.addEventListener("click", closeTerm);

  document.addEventListener("keydown", (e) => {
    if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      term.classList.contains("open") ? closeTerm() : openTerm();
    }
    if (e.key === "Escape" && term.classList.contains("open")) closeTerm();
  });

  // Click ra ngoài thì đóng (chỉ khi click ngoài terminal + nút toggle)
  document.addEventListener("click", (e) => {
    if (!term.classList.contains("open")) return;
    if (e.target.closest("#terminal") || e.target.closest("#terminalToggle")) return;
    closeTerm();
  });
})();


/* =========================================================
   29. THÊM COMMAND PALETTE CHO TERMINAL
========================================================= */

(function addTerminalToCmdk() {
  // Chờ palette init xong rồi mới thêm command
  setTimeout(() => {
    const cmdkTrigger = $("#cmdkTrigger");
    if (!cmdkTrigger) return;

    // Chèn command bằng cách mô phỏng ctrl+k rồi thêm — đơn giản hơn: dùng event riêng
    // Cách này tránh phải sửa lại mảng commands gốc
    const style = document.createElement("style");
    style.textContent = "";
    document.head.appendChild(style);

    // Bổ sung 1 nút mới trong command palette bằng cách chèn vào list khi mở
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains("cmdk-item")) {
            // Đã có item được render — không can thiệp
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, 500);
})();


/* =========================================================
   30. SPOTLIGHT CURSOR
========================================================= */

(function spotlight() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (prefersReduced) return;

  const spot = $("#spotlight");
  if (!spot) return;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let curX = targetX;
  let curY = targetY;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  (function loop() {
    curX += (targetX - curX) * 0.18;
    curY += (targetY - curY) * 0.18;
    spot.style.left = curX + "px";
    spot.style.top  = curY + "px";
    requestAnimationFrame(loop);
  })();
})();


/* =========================================================
   31. CURSOR TRAIL (hạt lấp lánh theo chuột)
========================================================= */

(function cursorTrail() {
  if (prefersReduced) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  const MIN_DIST = 14;   // khoảng cách tối thiểu giữa 2 hạt
  const MIN_TIME = 24;   // ms tối thiểu giữa 2 hạt

  window.addEventListener("mousemove", (e) => {
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const dist = Math.hypot(dx, dy);

    if (dist < MIN_DIST || now - lastTime < MIN_TIME) return;

    lastX = e.clientX;
    lastY = e.clientY;
    lastTime = now;

    const dot = document.createElement("div");
    dot.className = "trail-dot";
    dot.style.left = e.clientX + "px";
    dot.style.top  = e.clientY + "px";

    const size = Math.random() * 6 + 4;
    dot.style.width  = size + "px";
    dot.style.height = size + "px";

    document.body.appendChild(dot);

    const angle = Math.random() * Math.PI * 2;
    const drift = Math.random() * 24 + 8;
    const tx = Math.cos(angle) * drift;
    const ty = Math.sin(angle) * drift;

    dot.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 0.85 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
      ],
      {
        duration: 700 + Math.random() * 400,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    ).onfinish = () => dot.remove();
  });
})();


/* =========================================================
   32. SECTION COLOR SHIFT
========================================================= */

(function sectionColorShift() {
  const sections = $$("section[id]");
  if (!sections.length) return;

  // null = dùng màu mặc định của theme
  const SECTION_ACCENTS = {
    home:     null,
    about:    { hex: "#06b6d4", rgb: "6, 182, 212" },     // cyan
    skills:   { hex: "#10b981", rgb: "16, 185, 129" },    // emerald
    projects: { hex: "#ec4899", rgb: "236, 72, 153" },    // pink
    github:   { hex: "#f59e0b", rgb: "245, 158, 11" },    // amber
    journey:  { hex: "#8b5cf6", rgb: "139, 92, 246" },    // violet
    contact:  null
  };

  let current = "";
  let lastApplied = "";

  function apply(sectionId) {
    if (sectionId === lastApplied) return;
    lastApplied = sectionId;

    const cfg = SECTION_ACCENTS[sectionId];

    if (cfg) {
      root.style.setProperty("--accent", cfg.hex);
      root.style.setProperty("--accent-rgb", cfg.rgb);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-rgb");
    }

    // Cập nhật lại màu particles cho khớp
    if (typeof refreshCanvasColor === "function") {
      refreshCanvasColor();
    }
  }

  function update() {
    let found = "";

    sections.forEach((s) => {
      const top = s.offsetTop - 220;
      if (window.scrollY >= top && window.scrollY < top + s.offsetHeight) {
        found = s.id;
      }
    });

    if (found && found !== current) {
      current = found;
      apply(found);
    }
  }

  window.addEventListener("scroll", update, { passive: true });
  update();
})();


/* =========================================================
   33. PATCH THEME TOGGLE — xử lý accent override
========================================================= */

(function patchTheme() {
  const toggle = $("#themeToggle");
  if (!toggle) return;

  // Chạy sau khi theme toggle gốc đã gắn listener
  setTimeout(() => {
    toggle.addEventListener("click", () => {
      // Xóa inline accent override để CSS theme mới apply lại
      setTimeout(() => {
        root.style.removeProperty("--accent");
        root.style.removeProperty("--accent-rgb");

        // Force re-apply section accent hiện tại
        const sections = $$("section[id]");
        let found = "";
        sections.forEach((s) => {
          const top = s.offsetTop - 220;
          if (window.scrollY >= top && window.scrollY < top + s.offsetHeight) {
            found = s.id;
          }
        });

        const map = {
          about:    { hex: "#06b6d4", rgb: "6, 182, 212" },
          skills:   { hex: "#10b981", rgb: "16, 185, 129" },
          projects: { hex: "#ec4899", rgb: "236, 72, 153" },
          github:   { hex: "#f59e0b", rgb: "245, 158, 11" },
          journey:  { hex: "#8b5cf6", rgb: "139, 92, 246" }
        };

        if (map[found]) {
          root.style.setProperty("--accent", map[found].hex);
          root.style.setProperty("--accent-rgb", map[found].rgb);
        }

        if (typeof refreshCanvasColor === "function") refreshCanvasColor();
      }, 30);
    });
  }, 100);
})();


/* =========================================================
   34. 3D CARD FLIP
========================================================= */

/* =========================================================
   34. 3D CARD FLIP (Đã sửa thành hàm để gọi lại)
========================================================= */

function initFlipCards() {
  const cards = $$(".project-card[data-flip]");
  if (!cards.length) return;

  cards.forEach((card) => {
    // Tránh gắn sự kiện 2 lần nếu hàm được gọi lại
    if (card.dataset.flipInitialized) return;
    card.dataset.flipInitialized = "true";

    const inner = card.querySelector(".flip-inner");
    if (!inner) return;

    card.style.cursor = "pointer";

    card.addEventListener("click", (e) => {
      // Không flip nếu đang click vào link thật
      if (e.target.closest("a")) return;

      card.classList.toggle("flipped");
      if (typeof SoundFX !== "undefined") SoundFX.click();
    });

    // Bàn phím: Enter / Space để flip
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.classList.toggle("flipped");
      }
    });
  });
}

initFlipCards();


/* =========================================================
   35. HORIZONTAL GALLERY — DRAG TO SCROLL
========================================================= */

(function galleryDrag() {
  const track = $("#galleryTrack");
  if (!track) return;

  let isDown = false;
  let startX = 0;
  let scrollStart = 0;
  let moved = false;

  // Áp màu riêng cho từng card
  $$(".gallery-card").forEach((card) => {
    const color = card.dataset.color;
    if (color) card.style.setProperty("--card-color", color);
  });

  track.addEventListener("mousedown", (e) => {
    isDown = true;
    moved = false;
    startX = e.pageX;
    scrollStart = track.scrollLeft;
    track.classList.add("dragging");
  });

  track.addEventListener("mouseleave", () => {
    isDown = false;
    track.classList.remove("dragging");
  });

  track.addEventListener("mouseup", () => {
    isDown = false;
    track.classList.remove("dragging");
  });

  track.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();

    const walk = (e.pageX - startX) * 1.4;
    if (Math.abs(walk) > 4) moved = true;
    track.scrollLeft = scrollStart - walk;
  });

  // Prevent accidental click khi drag
  track.addEventListener("click", (e) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Hỗ trợ phím ← → khi focus
  track.setAttribute("tabindex", "0");
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      track.scrollBy({ left: -320, behavior: "smooth" });
    } else if (e.key === "ArrowRight") {
      track.scrollBy({ left: 320, behavior: "smooth" });
    }
  });
})();


/* =========================================================
   36. HOVER IMAGE PREVIEW
========================================================= */

(function hoverPreview() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (prefersReduced) return;

  const win   = $("#previewWindow");
  const inner = $("#previewInner");
  if (!win || !inner) return;

  // Palette màu cho preview
  const PALETTES = {
    "#a855f7": ["#a855f7", "#6d28d9"],
    "#06b6d4": ["#06b6d4", "#0e7490"],
    "#10b981": ["#10b981", "#047857"],
    "#ec4899": ["#ec4899", "#be185d"],
    "#f59e0b": ["#f59e0b", "#b45309"],
    "#8b5cf6": ["#8b5cf6", "#6d28d9"]
  };

  let raf = null;
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;

  function loop() {
    curX += (targetX - curX) * 0.22;
    curY += (targetY - curY) * 0.22;
    win.style.left = curX + "px";
    win.style.top  = curY + "px";
    raf = requestAnimationFrame(loop);
  }

  function show(card, e) {
    const color = card.dataset.color || "#a855f7";
    const pal   = PALETTES[color] || [color, color];

    inner.style.setProperty("--preview-c1", pal[0]);
    inner.style.setProperty("--preview-c2", pal[1]);
    inner.dataset.label = card.dataset.year || "★";

    targetX = curX = e.clientX;
    targetY = curY = e.clientY;
    win.style.left = curX + "px";
    win.style.top  = curY + "px";

    win.classList.add("show");
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function move(e) {
    targetX = e.clientX;
    targetY = e.clientY;
  }

  function hide() {
    win.classList.remove("show");
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  $$(".gallery-card").forEach((card) => {
    card.addEventListener("mouseenter", (e) => show(card, e));
    card.addEventListener("mousemove", move);
    card.addEventListener("mouseleave", hide);
  });
})();


/* =========================================================
   37. XP SYSTEM + ACHIEVEMENTS
========================================================= */

const Game = (function () {
  const STORAGE_KEY = "portfolio_progress";

  const state = {
    xp: 0,
    level: 1,
    achievements: new Set(),
    sectionsSeen: new Set(),
    doneFlags: new Set()
  };

  const ACHIEVEMENTS = {
    first_step:      { icon: "👣", title: "First Step",       xp: 10,  hint: "Scroll past the hero" },
    curious:         { icon: "🔍", title: "Curious",          xp: 15,  hint: "Visit the About section" },
    skilled:         { icon: "⚡", title: "Skilled",          xp: 15,  hint: "Visit the Skills section" },
    explorer:        { icon: "💼", title: "Explorer",         xp: 20,  hint: "Visit the Projects section" },
    historian:       { icon: "📜", title: "Historian",        xp: 15,  hint: "Visit the Journey section" },
    completionist:   { icon: "🏆", title: "Completionist",    xp: 60,  hint: "Scroll to the bottom of the page" },
    commander:       { icon: "⌘",  title: "Commander",        xp: 15,  hint: "Open the command palette" },
    hacker:          { icon: "💻", title: "Hacker",           xp: 25,  hint: "Use the terminal" },
    timeTraveler:    { icon: "🌗", title: "Time Traveler",    xp: 15,  hint: "Switch theme" },
    chatterbox:      { icon: "💌", title: "Chatterbox",       xp: 30,  hint: "Send a contact message" },
    gamer:           { icon: "🎮", title: "Gamer",            xp: 100, hint: "Enter the Konami code" },
    curator:         { icon: "🖼️", title: "Curator",          xp: 20,  hint: "Explore the Gallery" }
  };

  const xpLevelEl = $("#xpLevel");
  const xpTextEl  = $("#xpText");
  const xpFillEl  = $("#xpFill");
  const widget    = $("#xpWidget");

  // ---------- LOAD / SAVE ----------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.xp) state.xp = saved.xp;
      if (saved.level) state.level = saved.level;
      if (Array.isArray(saved.achievements)) {
        state.achievements = new Set(saved.achievements);
      }
      if (Array.isArray(saved.sectionsSeen)) {
        state.sectionsSeen = new Set(saved.sectionsSeen);
      }
      if (Array.isArray(saved.doneFlags)) {
        state.doneFlags = new Set(saved.doneFlags);
      }
    } catch {}
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        xp: state.xp,
        level: state.level,
        achievements: [...state.achievements],
        sectionsSeen: [...state.sectionsSeen],
        doneFlags: [...state.doneFlags]
      }));
    } catch {}
  }

  // ---------- LEVEL ----------
  const XP_PER_LEVEL = 100;

  function calcLevel(xp) {
    return Math.floor(xp / XP_PER_LEVEL) + 1;
  }

  function xpIntoLevel(xp) {
    return xp % XP_PER_LEVEL;
  }

  function render() {
    if (!widget) return;

    xpLevelEl.textContent = state.level;
    xpTextEl.textContent  = state.xp;
    xpFillEl.style.width  = (xpIntoLevel(state.xp) / XP_PER_LEVEL * 100) + "%";
  }

  // ---------- AWARD ----------
  function addXP(amount) {
    state.xp += amount;
    const newLevel = calcLevel(state.xp);

    if (newLevel > state.level) {
      state.level = newLevel;
      if (widget) {
        widget.classList.add("levelup");
        setTimeout(() => widget.classList.remove("levelup"), 1300);
      }
      if (typeof toast === "function") {
        toast(`Level up! You're now Lv.${state.level} 🎉`, "success", "⬆️", 4000);
      }
      if (typeof fireConfetti === "function") fireConfetti(40);
    }

    render();
    save();
  }

  // ---------- UNLOCK ----------
  function unlock(key) {
    if (!ACHIEVEMENTS[key]) return;
    if (state.achievements.has(key)) return;

    const a = ACHIEVEMENTS[key];
    state.achievements.add(key);

    if (typeof toast === "function") {
      toast(
        `<strong>${a.title}</strong> unlocked! +${a.xp} XP`,
        "achievement",
        a.icon,
        4200
      );
    }

    addXP(a.xp);
  }

  // ---------- FLAG (làm 1 lần) ----------
  function flag(key) {
    if (state.doneFlags.has(key)) return false;
    state.doneFlags.add(key);
    save();
    return true;
  }

  // ---------- PUBLIC ----------
  return {
    init() {
      load();
      render();
    },
    unlock,
    addXP,
    flag,
    getXP: () => state.xp,
    getLevel: () => state.level
  };
})();

Game.init();


/* =========================================================
   38. WIRE UP ACHIEVEMENTS
========================================================= */

(function wireAchievements() {

  // ---- 1. First step + Completionist ----
  let firstStepDone = false;

  window.addEventListener("scroll", () => {
    if (!firstStepDone && window.scrollY > window.innerHeight * 0.5) {
      firstStepDone = true;
      Game.unlock("first_step");
    }

    const atBottom =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 80;

    if (atBottom) Game.unlock("completionist");
  }, { passive: true });

  // ---- 2. Section visits ----
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const id = entry.target.id;
      const map = {
        about:    "curious",
        skills:   "skilled",
        projects: "explorer",
        journey:  "historian",
        gallery:  "curator"
      };

      if (map[id]) Game.unlock(map[id]);
    });
  }, { threshold: 0.4 });

  $$("section[id]").forEach((s) => sectionObs.observe(s));

  // ---- 3. Commander — mở command palette ----
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      Game.unlock("commander");
    }
  });

  const cmdkTrigger = $("#cmdkTrigger");
  if (cmdkTrigger) {
    cmdkTrigger.addEventListener("click", () => Game.unlock("commander"));
  }

  // ---- 4. Hacker — dùng terminal ----
  const termInput = $("#terminalInput");
  if (termInput) {
    let cmdCount = 0;
    termInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        cmdCount++;
        if (cmdCount >= 3) Game.unlock("hacker");
      }
    });
  }

  // ---- 5. Time Traveler — đổi theme ----
  const themeBtn = $("#themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => Game.unlock("timeTraveler"));
  }

  // ---- 6. Chatterbox — gửi form ----
  const form = $("#contactForm");
  if (form) {
    form.addEventListener("submit", () => {
      setTimeout(() => {
        if (!form.querySelector(".field.invalid")) {
          Game.unlock("chatterbox");
        }
      }, 100);
    });
  }

  // ---- 7. Gamer — Konami code ----
  // Hook vào konami có sẵn — dùng event custom
  window.addEventListener("konami", () => Game.unlock("gamer"));

})();


/* =========================================================
   39. PATCH KONAMI — dispatch event để achievements bắt được
========================================================= */

(function patchKonami() {
  // Override lại — tìm cách hook bằng cách chèn listener trước
  // Cách đơn giản: theo dõi body.party class
  const obs = new MutationObserver(() => {
    if (document.body.classList.contains("party")) {
      window.dispatchEvent(new Event("konami"));
    }
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();


/* =========================================================
   40. GỌI API GITHUB ĐỂ LOAD DỰ ÁN THẬT
========================================================= */

/* =========================================================
   40. GỌI API GITHUB ĐỂ LOAD DỰ ÁN THẬT
========================================================= */

async function loadGitHubProjects() {
  const grid = document.getElementById('projectsGrid');
  const username = 'Te06'; 
  
  // 👇 MÀY SỬA DANH SÁCH TÊN REPO MÀY MUỐN HIỂN THỊ Ở ĐÂY 👇
  // Phải viết CHÍNH XÁC tên repo như trên GitHub (phân biệt hoa thường)
  const featuredRepos = [
    'lap_trinh_web_btvn_weekly', 
    'web-lab2-HW', 
    'web-lab1' 
  ];
  
  try {
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`);
    
    if (!response.ok) {
      throw new Error(`Lỗi HTTP: ${response.status}`);
    }

    const repos = await response.json();

    // LỌC: Chỉ giữ lại những repo có tên nằm trong danh sách featuredRepos
    let myRepos = repos.filter(repo => featuredRepos.includes(repo.name));
    
    // Nếu mày muốn giới hạn số lượng tối đa (vd: 4 cái)
    myRepos = myRepos.slice(0, 4);

    grid.innerHTML = '';

    // Nếu không tìm thấy repo nào khớp tên
    if (myRepos.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;">Không tìm thấy dự án nào!</div>`;
      return;
    }

    // Render HTML
    myRepos.forEach((repo, index) => {
      let bentoClass = '';
      if (index === 0) bentoClass = 'bento-large';
      if (index === 3) bentoClass = 'bento-wide';

      const date = new Date(repo.updated_at).toLocaleDateString('vi-VN');

      const article = document.createElement('article');
      article.className = `project-card ${bentoClass}`;
      article.setAttribute('data-category', 'web');
      article.setAttribute('data-tilt', '');
      article.setAttribute('data-flip', '');

      article.innerHTML = `
        <div class="card-glare"></div>
        <div class="flip-inner">
          <div class="flip-face flip-front">
            <div class="project-number">0${index + 1}</div>
            <h3>${repo.name}</h3>
            <p>${repo.description || "Không có mô tả cho dự án này."}</p>
            <span>${repo.language || "N/A"} • ⭐ ${repo.stargazers_count}</span>
            <div class="flip-hint">↻ Click to flip</div>
          </div>
          
          <div class="flip-face flip-back">
            <div class="project-number">0${index + 1} / DETAILS</div>
            <h3>${repo.name}</h3>
            <ul class="flip-list">
              <li>Cập nhật: ${date}</li>
              <li>Ngôn ngữ chính: ${repo.language || "N/A"}</li>
              <li>Số lượng sao: ${repo.stargazers_count}</li>
              <li>Dung lượng: ${repo.size} KB</li>
            </ul>
            <a href="${repo.html_url}" target="_blank" rel="noopener" style="color:var(--accent); font-weight:bold; text-decoration:none;">Xem trên GitHub ↗</a>
            <div class="flip-hint">↻ Click to flip back</div>
          </div>
        </div>
      `;

      grid.appendChild(article);
    });

    initTilt();
    initFlipCards();

  } catch (error) {
    console.error("Lỗi khi tải GitHub API:", error);
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #f43f5e;">
        ⚠️ Không thể tải dự án từ GitHub. <br> 
        <small>${error.message}</small>
      </div>
    `;
  }
}

loadGitHubProjects();