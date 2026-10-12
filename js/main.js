/* ==========================================================
   main.js: site-wide UI (theme, content binding, animations)
   Booking logic lives in booking.js
   ========================================================== */
(() => {
  "use strict";

  const C = window.BOOKING_CONFIG;
  const B = C.business;
  const S = C.schedule;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, "0");
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fmtTime = min => {
    const h24 = Math.floor(min / 60), m = min % 60;
    return `${h24 % 12 || 12}:${pad(m)} ${h24 < 12 ? "AM" : "PM"}`;
  };
  const money = n => "\u20B9" + n.toLocaleString("en-IN");
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* ---------- theme toggle ---------- */
  const root = document.documentElement;
  const themeBtn = $("#themeToggle");
  function paintThemeButton() {
    const dark = root.getAttribute("data-bs-theme") === "dark";
    themeBtn.innerHTML = `<i class="bi ${dark ? "bi-sun" : "bi-moon-stars"}" aria-hidden="true"></i>`;
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  themeBtn.addEventListener("click", () => {
    const next = root.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-bs-theme", next);
    try { localStorage.setItem("aura_theme", next); } catch (e) {}
    paintThemeButton();
  });
  paintThemeButton();

  /* ---------- bind business details into the page ---------- */
  const w = B.whatsapp;
  const phonePretty = `+${w.slice(0, 2)} ${w.slice(2, 7)} ${w.slice(7)}`;
  const closedDays = S.offDays.map(d => dayNames[d]);

  $$("[data-bind]").forEach(el => {
    switch (el.dataset.bind) {
      case "name": el.textContent = B.name; break;
      case "tagline": el.textContent = B.tagline; break;
      case "address": el.textContent = B.address; break;
      case "phoneLink": el.textContent = phonePretty; el.href = `tel:+${w}`; break;
      case "emailLink": el.textContent = B.email; el.href = `mailto:${B.email}`; break;
      case "hours": el.textContent = `${fmtTime(toMin(S.open))} to ${fmtTime(toMin(S.close))}`; break;
      case "closed": el.textContent = closedDays.length ? `Closed on ${closedDays.join(" and ")}` : "Open every day"; break;
    }
  });
  $("#year").textContent = new Date().getFullYear();
  $("#waFloat").href = `https://wa.me/${w}?text=${encodeURIComponent("Hi, I would like to know more about your services.")}`;

  /* ---------- services showcase ---------- */
  $("#servicesGrid").innerHTML = C.services.map((s, i) => `
    <div class="col-md-6 col-xl-4 reveal" style="--d:${i * 70}ms">
      <article class="svc-card">
        <span class="svc-icon"><i class="bi ${s.icon}" aria-hidden="true"></i></span>
        <h3 class="svc-name">${s.name}</h3>
        <p class="svc-desc">${s.desc}</p>
        <div class="svc-foot">
          <div class="svc-meta"><span class="svc-price">${money(s.price)}</span><span class="svc-dur">${s.duration} min</span></div>
          <button type="button" class="btn btn-ghost btn-sm" data-book-service="${s.id}">Book this</button>
        </div>
      </article>
    </div>`).join("");

  // soft spotlight that follows the pointer on service cards
  $("#servicesGrid").addEventListener("pointermove", e => {
    const card = e.target.closest(".svc-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  /* ---------- marquee ---------- */
  const items = C.services.map(s => `<span>${s.name}</span><i class="bi bi-asterisk" aria-hidden="true"></i>`).join("");
  $("#marqueeTrack").innerHTML = `<div class="marquee-group">${items}</div><div class="marquee-group">${items}</div>`;

  /* ---------- navbar: shadow on scroll, close menu on link click ---------- */
  const nav = $("#siteNav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const collapseEl = $("#mainNav");
  $$("#mainNav a").forEach(a => a.addEventListener("click", () => {
    if (collapseEl.classList.contains("show")) bootstrap.Collapse.getOrCreateInstance(collapseEl).hide();
  }));

  /* ---------- scroll reveal ---------- */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("is-visible"));
  }

  /* ---------- animated counters ---------- */
  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const format = v => prefix + v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (reduceMotion) { el.textContent = format(target); return; }
    const dur = 1600, t0 = performance.now();
    const tick = now => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const counters = $$("[data-count]");
  if ("IntersectionObserver" in window) {
    const co = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { runCounter(en.target); co.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach(el => co.observe(el));
  } else {
    counters.forEach(runCounter);
  }
})();
