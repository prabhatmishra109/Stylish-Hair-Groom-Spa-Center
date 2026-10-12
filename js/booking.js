
(() => {
  "use strict";

  const C = window.BOOKING_CONFIG;
  const B = C.business;
  const S = C.schedule;
  const SERVICES = C.services;
  const STORE_KEY = "aura_bookings_v1";
  const TOTAL_STEPS = 4;
  const STEP_LABELS = ["Choose a service", "Pick a date and time", "Your details", "Review and send"];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, "0");
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fmtTime = min => {
    const h24 = Math.floor(min / 60), m = min % 60;
    return `${h24 % 12 || 12}:${pad(m)} ${h24 < 12 ? "AM" : "PM"}`;
  };
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDateLong = k => parseKey(k).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fmtDateShort = k => parseKey(k).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const money = n => "\u20B9" + n.toLocaleString("en-IN");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const getService = () => SERVICES.find(s => s.id === state.service) || null;

  /* ---------- state ---------- */
  const state = { step: 1, service: null, date: null, time: null, name: "", phone: "", note: "" };
  let lastBooking = null;

  /* ---------- storage (this device only) ---------- */
  const loadBookings = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  };
  const saveBookings = list => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent("bookings:changed"));
  };

  /* ---------- availability ---------- */
  const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;

  // returns "skip" | "past" | "booked" | "free"
  function slotStatus(dateStr, start, service, bookings, now) {
    const end = start + service.duration;
    if (end > toMin(S.close)) return "skip";
    if (overlaps(start, end, toMin(S.breakStart), toMin(S.breakEnd))) return "skip";
    if (dateStr === dateKey(now) && start < now.getHours() * 60 + now.getMinutes() + S.minLeadMinutes) return "past";
    const clash = bookings.some(b => b.date === dateStr && overlaps(start, end, b.start, b.start + b.duration));
    return clash ? "booked" : "free";
  }

  /* ---------- toast ---------- */
  function toast(message, type = "dark") {
    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.setAttribute("role", "alert");
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    $("#toastStack").appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3800 });
    el.addEventListener("hidden.bs.toast", () => el.remove());
    t.show();
  }

  /* ---------- step 1: services ---------- */
  function renderServices() {
    $("#serviceList").innerHTML = SERVICES.map(s => `
      <button type="button" class="service-option" role="radio" aria-checked="false" data-id="${s.id}">
        <span class="service-icon"><i class="bi ${s.icon}" aria-hidden="true"></i></span>
        <span class="service-name">${s.name}</span>
        <span class="service-foot"><span>${s.duration} min</span><span class="service-price">${money(s.price)}</span></span>
        <span class="service-tick" aria-hidden="true"><i class="bi bi-check-lg"></i></span>
      </button>`).join("");
  }

  function selectService(id) {
    if (state.service !== id) { state.time = null; }
    state.service = id;
    $$(".service-option").forEach(b => b.setAttribute("aria-checked", String(b.dataset.id === id)));
    renderSelection();
    renderSlots();
    updateNav();
  }

  /* ---------- step 2: dates and slots ---------- */
  function renderDates() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let html = "";
    for (let i = 0; i < S.daysAhead; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const off = S.offDays.includes(d.getDay());
      const key = dateKey(d);
      html += `
        <button type="button" class="date-chip${off ? " is-off" : ""}" data-date="${key}" aria-pressed="false" ${off ? "disabled" : ""}>
          <span class="date-dow">${i === 0 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
          <span class="date-num">${d.getDate()}</span>
          <span class="date-mon">${off ? "Closed" : d.toLocaleDateString("en-IN", { month: "short" })}</span>
        </button>`;
    }
    $("#dateStrip").innerHTML = html;
  }

  function selectDate(key) {
    state.date = key;
    state.time = null;
    $$(".date-chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.date === key)));
    renderSelection();
    renderSlots();
    updateNav();
  }

  function renderSlots() {
    const wrap = $("#slotWrap");
    if (!state.date || !getService()) {
      wrap.innerHTML = `<p class="empty-note"><i class="bi bi-calendar-event" aria-hidden="true"></i>Choose a date to see open times.</p>`;
      return;
    }
    const service = getService();
    const bookings = loadBookings();
    const now = new Date();
    const groups = { Morning: [], Afternoon: [], Evening: [] };
    let free = 0;

    for (let t = toMin(S.open); t < toMin(S.close); t += S.slotMinutes) {
      const st = slotStatus(state.date, t, service, bookings, now);
      if (st === "skip") continue;
      const g = t < 720 ? "Morning" : t < 1020 ? "Afternoon" : "Evening";
      groups[g].push({ t, st });
      if (st === "free") free++;
    }

    // if the chosen time got taken (e.g. cancelled in another tab), clear it
    if (state.time != null) {
      const stillFree = Object.values(groups).flat().some(x => x.t === state.time && x.st === "free");
      if (!stillFree) state.time = null;
    }

    if (!free) {
      wrap.innerHTML = `<p class="empty-note"><i class="bi bi-emoji-neutral" aria-hidden="true"></i>No open times left on this day. Try another date.</p>`;
      return;
    }

    const icons = { Morning: "bi-sunrise", Afternoon: "bi-sun", Evening: "bi-moon-stars" };
    wrap.innerHTML = Object.entries(groups).filter(([, list]) => list.length).map(([name, list]) => `
      <div class="slot-group">
        <h4 class="slot-group-title"><i class="bi ${icons[name]}" aria-hidden="true"></i>${name}</h4>
        <div class="slot-grid">
          ${list.map(({ t, st }) => `
            <button type="button" class="slot${state.time === t ? " is-selected" : ""}" data-time="${t}" ${st !== "free" ? "disabled" : ""}
              ${st === "booked" ? 'title="Already booked"' : ""} aria-pressed="${state.time === t}">
              ${fmtTime(t)}
            </button>`).join("")}
        </div>
      </div>`).join("");
  }

  function selectTime(t) {
    state.time = t;
    $$(".slot").forEach(b => {
      const on = Number(b.dataset.time) === t;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
    renderSelection();
    updateNav();
  }

  /* ---------- selection chips ---------- */
  function renderSelection() {
    const bar = $("#selection");
    const chips = [];
    const s = getService();
    if (s) chips.push(`<span class="chip"><i class="bi ${s.icon}" aria-hidden="true"></i>${s.name}</span>`);
    if (state.date) chips.push(`<span class="chip"><i class="bi bi-calendar3" aria-hidden="true"></i>${fmtDateShort(state.date)}</span>`);
    if (state.time != null) chips.push(`<span class="chip"><i class="bi bi-clock" aria-hidden="true"></i>${fmtTime(state.time)}</span>`);
    bar.hidden = !chips.length;
    bar.innerHTML = chips.join("");
  }

  /* ---------- step 3: details ---------- */
  function validateDetails() {
    const name = $("#fName"), phone = $("#fPhone");
    const nameOk = name.value.trim().length >= 2;
    const phoneOk = /^[6-9]\d{9}$/.test(phone.value);
    name.classList.toggle("is-invalid", !nameOk);
    name.classList.toggle("is-valid", nameOk);
    phone.classList.toggle("is-invalid", !phoneOk);
    phone.classList.toggle("is-valid", phoneOk);
    return nameOk && phoneOk;
  }

  /* ---------- step 4: review ---------- */
  function renderReview() {
    const s = getService();
    const rows = [
      ["Service", `${esc(s.name)} (${s.duration} min)`],
      ["Date", fmtDateLong(state.date)],
      ["Time", `${fmtTime(state.time)} to ${fmtTime(state.time + s.duration)}`],
      ["Price", `${money(s.price)}, pay at the studio`],
      ["Name", esc(state.name)],
      ["Mobile", `+91 ${esc(state.phone)}`]
    ];
    if (state.note) rows.push(["Note", esc(state.note)]);
    $("#reviewList").innerHTML = rows.map(([k, v]) => `<div class="review-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }

  /* ---------- navigation ---------- */
  function canAdvance() {
    if (state.step === 1) return !!state.service;
    if (state.step === 2) return !!state.date && state.time != null;
    return true;
  }

  function updateNav() {
    const next = $("#btnNext"), back = $("#btnBack"), foot = $("#wizardFoot");
    foot.hidden = state.step === "done";
    back.style.visibility = state.step === 1 ? "hidden" : "visible";
    next.hidden = state.step === TOTAL_STEPS;
    next.disabled = !canAdvance();
    next.textContent = state.step === 3 ? "Review booking" : "Continue";
  }

  function paintStepper(step) {
    $$("#stepper li").forEach(li => {
      const n = Number(li.dataset.step);
      const done = step === "done" || n < step;
      li.classList.toggle("is-done", done);
      li.classList.toggle("is-active", n === step);
      li.querySelector(".dot").innerHTML = done ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : n;
    });
  }

  function goTo(step, dir = 1) {
    state.step = step;
    $$(".step-pane").forEach(p => {
      const active = p.dataset.step === String(step);
      p.hidden = !active;
      p.classList.remove("enter-fwd", "enter-back");
      if (active) { void p.offsetWidth; p.classList.add(dir < 0 ? "enter-back" : "enter-fwd"); }
    });
    paintStepper(step);
    if (step !== "done") $("#stepLabel").textContent = `Step ${step} of ${TOTAL_STEPS}: ${STEP_LABELS[step - 1]}`;
    if (step === 2) renderSlots();
    if (step === 4) renderReview();
    updateNav();
  }

  /* ---------- sending ---------- */
  function buildMessage(b) {
    const lines = [
      `*New booking* | ${B.name}`, "",
      `Service: ${b.serviceName} (${b.duration} min)`,
      `Date: ${fmtDateLong(b.date)}`,
      `Time: ${fmtTime(b.start)}`,
      `Price: ${money(b.price)}`,
      `Name: ${b.name}`,
      `Mobile: ${b.phone}`
    ];
    if (b.note) lines.push(`Note: ${b.note}`);
    lines.push("", `Booking ID: ${b.id.toUpperCase()}`);
    return lines.join("\n");
  }

  function confirmBooking(channel) {
    if (!validateDetails()) { goTo(3, -1); return; }
    const s = getService();
    const bookings = loadBookings();

    if (slotStatus(state.date, state.time, s, bookings, new Date()) !== "free") {
      toast("That time was just taken. Please pick another slot.", "danger");
      state.time = null;
      goTo(2, -1);
      return;
    }

    const booking = {
      id: Date.now().toString(36),
      serviceId: s.id, serviceName: s.name, duration: s.duration, price: s.price,
      date: state.date, start: state.time,
      name: state.name, phone: state.phone, note: state.note,
      createdAt: new Date().toISOString()
    };
    bookings.push(booking);
    saveBookings(bookings);
    lastBooking = booking;

    const msg = buildMessage(booking);
    if (channel === "whatsapp") {
      window.open(`https://wa.me/${B.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    } else {
      window.location.href = `mailto:${B.email}?subject=${encodeURIComponent("New booking: " + booking.serviceName)}&body=${encodeURIComponent(msg)}`;
    }
    showSuccess(booking, channel);
  }

  function showSuccess(b, channel) {
    $("#successText").textContent = channel === "whatsapp"
      ? "WhatsApp should be open with your message. Press send there to finish. We will reply to confirm."
      : "Your mail app should be open with the message. Press send there to finish. We will reply to confirm.";
    $("#successSummary").innerHTML = [
      ["Service", esc(b.serviceName)],
      ["When", `${fmtDateShort(b.date)}, ${fmtTime(b.start)}`],
      ["Booking ID", b.id.toUpperCase()]
    ].map(([k, v]) => `<div class="review-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    $("#selection").hidden = true;
    goTo("done");
    if (!reduceMotion) confetti();
  }

  /* ---------- calendar file (.ics) ---------- */
  function downloadICS(b) {
    const d = b.date.replace(/-/g, "");
    const stamp = m => `${d}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    const esc2 = s => String(s).replace(/([,;])/g, "\\$1");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aura Studio//Booking//EN", "BEGIN:VEVENT",
      `UID:${b.id}@booking`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${stamp(b.start)}`,
      `DTEND:${stamp(b.start + b.duration)}`,
      `SUMMARY:${esc2(b.serviceName + " at " + B.name)}`,
      `LOCATION:${esc2(B.address)}`,
      `DESCRIPTION:Booking ID ${b.id.toUpperCase()}`,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = `booking-${b.id}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- confetti burst ---------- */
  function confetti() {
    const host = $(".success-mark");
    const colors = ["#F2A33A", "#1F8A7F", "#3CC1B0", "#F6D28B", "#0E5A55"];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("i");
      p.className = "confetti";
      const angle = (Math.PI * 2 * i) / 26 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 70;
      p.style.setProperty("--x", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--y", `${Math.sin(angle) * dist}px`);
      p.style.setProperty("--r", `${Math.random() * 540 - 270}deg`);
      p.style.background = colors[i % colors.length];
      host.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  }

  /* ---------- reset ---------- */
  function resetWizard() {
    Object.assign(state, { service: null, date: null, time: null, name: "", phone: "", note: "" });
    $("#detailsForm").reset();
    $$("#detailsForm .form-control").forEach(el => el.classList.remove("is-valid", "is-invalid"));
    $$(".service-option").forEach(b => b.setAttribute("aria-checked", "false"));
    $$(".date-chip").forEach(b => b.setAttribute("aria-pressed", "false"));
    renderSelection();
    renderSlots();
    goTo(1, -1);
  }

  /* ---------- my bookings modal ---------- */
  function renderBookingsList() {
    const list = loadBookings().sort((a, b) => (a.date + String(a.start).padStart(4, "0")).localeCompare(b.date + String(b.start).padStart(4, "0")));
    const badge = $("#bookingsBadge");
    badge.hidden = !list.length;
    badge.textContent = list.length;

    const host = $("#bookingsList");
    if (!list.length) {
      host.innerHTML = `<p class="empty-note"><i class="bi bi-journal" aria-hidden="true"></i>No bookings yet. Pick a slot and it will show up here.</p>`;
      return;
    }
    const today = dateKey(new Date());
    host.innerHTML = list.map(b => `
      <div class="booking-item${b.date < today ? " is-past" : ""}">
        <div>
          <strong>${esc(b.serviceName)}</strong>
          <span class="booking-when">${fmtDateShort(b.date)}, ${fmtTime(b.start)}${b.date < today ? " (past)" : ""}</span>
          <span class="booking-id">ID ${b.id.toUpperCase()}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-cancel="${b.id}">Cancel</button>
      </div>`).join("");
  }

  /* ---------- events ---------- */
  function bind() {
    $("#serviceList").addEventListener("click", e => {
      const btn = e.target.closest(".service-option");
      if (btn) selectService(btn.dataset.id);
    });

    $("#dateStrip").addEventListener("click", e => {
      const btn = e.target.closest(".date-chip");
      if (btn && !btn.disabled) selectDate(btn.dataset.date);
    });

    $("#slotWrap").addEventListener("click", e => {
      const btn = e.target.closest(".slot");
      if (btn && !btn.disabled) selectTime(Number(btn.dataset.time));
    });

    $("#btnNext").addEventListener("click", () => {
      if (state.step === 3 && !validateDetails()) { toast("Please fix the highlighted fields.", "danger"); return; }
      if (!canAdvance()) return;
      goTo(state.step + 1, 1);
    });
    $("#btnBack").addEventListener("click", () => { if (state.step > 1) goTo(state.step - 1, -1); });

    $("#fName").addEventListener("input", e => { state.name = e.target.value.trim(); if (e.target.classList.contains("is-invalid")) validateDetails(); });
    $("#fPhone").addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
      state.phone = e.target.value;
      if (e.target.classList.contains("is-invalid")) validateDetails();
    });
    $("#fNote").addEventListener("input", e => { state.note = e.target.value.trim(); });
    $("#detailsForm").addEventListener("submit", e => { e.preventDefault(); $("#btnNext").click(); });

    $("#sendWhatsApp").addEventListener("click", () => confirmBooking("whatsapp"));
    $("#sendEmail").addEventListener("click", () => confirmBooking("email"));
    $("#btnIcs").addEventListener("click", () => lastBooking && downloadICS(lastBooking));
    $("#btnAnother").addEventListener("click", resetWizard);

    // "Book this" buttons elsewhere on the page
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-book-service]");
      if (!btn) return;
      if (state.step === "done") resetWizard();
      selectService(btn.dataset.bookService);
      goTo(2, 1);
      $("#book").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });

    // cancel from "My bookings"
    $("#bookingsList").addEventListener("click", e => {
      const btn = e.target.closest("[data-cancel]");
      if (!btn) return;
      saveBookings(loadBookings().filter(b => b.id !== btn.dataset.cancel));
      toast("Booking cancelled. Message us on WhatsApp so we can free the slot.", "dark");
    });

    document.addEventListener("bookings:changed", () => {
      renderBookingsList();
      if (state.step === 2) renderSlots();
      updateNav();
    });
    window.addEventListener("storage", e => {
      if (e.key === STORE_KEY) { renderBookingsList(); if (state.step === 2) renderSlots(); }
    });
  }

  /* ---------- init ---------- */
  renderServices();
  renderDates();
  renderSlots();
  renderSelection();
  renderBookingsList();
  bind();
  goTo(1);
})();
