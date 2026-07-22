/* ==========================================================================
   Luminary Digital Group — Client Portal
   All client-specific data lives in one place so this file can be reused
   for any client by editing CLIENT only.
   ========================================================================== */

const CLIENT = {
  companyName: "Kairos Kreations",
  agencyName: "Luminary Digital Group",
  launchDate: "2026-08-01T00:00:00",
  durationDays: 90,
  phases: [
    { key: "foundation",   label: "Foundation & launch", startDay: 0,  endDay: 30 },
    { key: "optimization", label: "Optimization",         startDay: 30, endDay: 60 },
    { key: "scale",        label: "Scale",                startDay: 60, endDay: 90 },
  ],
  reports: [
    { key: "foundation",   label: "Month 1 report",  window: "Days 1–30"  },
    { key: "optimization", label: "Month 2 report",  window: "Days 31–60" },
    { key: "scale",        label: "Month 3 report",  window: "Days 61–90" },
  ],
};

const DAY_MS = 86400000;

/* ---------------------------------------------------------------------- */
/* Date / phase math                                                      */
/* ---------------------------------------------------------------------- */

function getCampaignStatus(now = new Date()){
  const launch = new Date(CLIENT.launchDate);
  const msFromLaunch = now - launch;

  if (msFromLaunch < 0){
    return {
      state: "pre-launch",
      daysUntilLaunch: Math.ceil(Math.abs(msFromLaunch) / DAY_MS),
      elapsedDays: 0,
      progressPct: 0,
      currentPhaseKey: null,
    };
  }

  const elapsedDays = Math.floor(msFromLaunch / DAY_MS);

  if (elapsedDays >= CLIENT.durationDays){
    return {
      state: "complete",
      daysUntilLaunch: 0,
      elapsedDays: CLIENT.durationDays,
      progressPct: 100,
      currentPhaseKey: "scale",
    };
  }

  const currentPhase = CLIENT.phases.find(
    (p) => elapsedDays >= p.startDay && elapsedDays < p.endDay
  );

  return {
    state: "active",
    daysUntilLaunch: 0,
    elapsedDays,
    progressPct: Math.min(100, (elapsedDays / CLIENT.durationDays) * 100),
    currentPhaseKey: currentPhase ? currentPhase.key : "foundation",
  };
}

function formatDate(iso){
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(iso, days){
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/* ---------------------------------------------------------------------- */
/* Render: static client details                                          */
/* ---------------------------------------------------------------------- */

function renderClientDetails(){
  document.querySelectorAll("#clientCompanyA, #navClientCompany").forEach(
    (el) => (el.textContent = CLIENT.companyName)
  );
  const chip = document.getElementById("launchDateChip");
  if (chip) chip.textContent = formatDate(CLIENT.launchDate);
}

/* ---------------------------------------------------------------------- */
/* Intake gate — first name / last name / email, no password or backend   */
/* ---------------------------------------------------------------------- */
/* Note: this is a personalization step, not a login. Anyone with the link
   can type any name — it does not authenticate or restrict access. Access
   control for this portal is the private link itself.

   The visitor's details are saved to this browser's localStorage so a
   refresh (or coming back later on the same device) skips the form. It
   does NOT sync across devices or give you a central list of leads — for
   that, wire up the fetch() call below to a form backend of your choice. */

const VISITOR_STORAGE_KEY = "luminaryPortalVisitor";

function loadSavedVisitor(){
  try {
    const raw = localStorage.getItem(VISITOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null; // localStorage unavailable (private browsing, blocked cookies, etc.)
  }
}

function saveVisitor(visitor){
  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(visitor));
  } catch (e) {
    // If storage is blocked, the portal still works for this session —
    // it just won't remember the visitor after a refresh.
  }
}

function applyVisitorToPage(visitor){
  document.querySelectorAll(".js-first-name").forEach((el) => {
    el.textContent = visitor.firstName;
  });
  const visitorChip = document.querySelector(".js-visitor-name");
  if (visitorChip) visitorChip.textContent = `${visitor.firstName} ${visitor.lastName}`;
}

function dismissGate(){
  const gate = document.getElementById("gate");
  if (gate) gate.classList.add("is-hidden");
  document.body.classList.remove("gate-active");
}

function initGate(){
  const gate = document.getElementById("gate");
  const form = document.getElementById("gateForm");
  if (!gate || !form) return;

  // Returning visitor on this device/browser — skip the form entirely.
  const saved = loadSavedVisitor();
  if (saved){
    applyVisitorToPage(saved);
    dismissGate();
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const firstName = document.getElementById("gateFirstName").value.trim();
    const lastName = document.getElementById("gateLastName").value.trim();
    const email = document.getElementById("gateEmail").value.trim();

    if (!firstName || !lastName || !email){
      form.reportValidity();
      return;
    }

    const visitor = { firstName, lastName, email, savedAt: new Date().toISOString() };
    saveVisitor(visitor);
    applyVisitorToPage(visitor);
    dismissGate();

    // Optional: forward the lead to your own CRM/inbox here, e.g.
    // fetch("https://your-endpoint.example.com/leads", { method: "POST", body: JSON.stringify(visitor) });
  });
}

/* ---------------------------------------------------------------------- */
/* Render: mission control (live status)                                  */
/* ---------------------------------------------------------------------- */

const PHASE_DISPLAY_LABEL = {
  "pre-launch": "Pre-launch",
  foundation: "Foundation & launch",
  optimization: "Optimization",
  scale: "Scale",
  complete: "Complete",
};

function renderMissionControl(){
  const status = getCampaignStatus();
  const badge = document.getElementById("phaseBadge");
  const statusText = document.getElementById("mcStatusText");
  const fill = document.getElementById("progressFill");
  const timelineFill = document.getElementById("timelineFill");

  let badgeLabel = PHASE_DISPLAY_LABEL[status.state === "active" ? status.currentPhaseKey : status.state];
  badge.textContent = badgeLabel;

  if (status.state === "pre-launch"){
    statusText.innerHTML = `Launch is in <strong>${status.daysUntilLaunch} day${status.daysUntilLaunch === 1 ? "" : "s"}</strong> — on ${formatDate(CLIENT.launchDate)} the 90-day clock starts and this bar starts moving.`;
  } else if (status.state === "complete"){
    statusText.innerHTML = `The 90-day engagement is <strong>complete</strong>. Everything below stays here as your record — let's talk about what's next.`;
  } else {
    const dayNum = status.elapsedDays + 1;
    statusText.innerHTML = `Day <strong>${dayNum}</strong> of <strong>${CLIENT.durationDays}</strong> — currently in the <strong>${badgeLabel}</strong> phase.`;
  }

  requestAnimationFrame(() => {
    fill.style.width = `${status.progressPct}%`;
    timelineFill.style.height = `${status.progressPct}%`;
  });

  // highlight the correct roadmap node
  document.querySelectorAll(".timeline-node").forEach((node) => {
    const key = node.dataset.phase;
    node.classList.remove("is-active", "is-complete");
    if (status.state === "complete"){
      node.classList.add("is-complete");
      return;
    }
    if (status.state === "pre-launch") return;

    const phaseDef = CLIENT.phases.find((p) => p.key === key);
    if (!phaseDef) return;
    if (status.elapsedDays >= phaseDef.endDay){
      node.classList.add("is-complete");
    } else if (key === status.currentPhaseKey){
      node.classList.add("is-active");
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Render: monthly report cards                                          */
/* ---------------------------------------------------------------------- */

function renderReportCards(){
  const grid = document.getElementById("reportsGrid");
  const status = getCampaignStatus();
  grid.innerHTML = "";

  CLIENT.reports.forEach((report) => {
    const phaseDef = CLIENT.phases.find((p) => p.key === report.key);
    const unlockDate = addDays(CLIENT.launchDate, phaseDef.endDay);
    const isUnlocked =
      status.state === "complete" ||
      (status.state === "active" && status.elapsedDays >= phaseDef.endDay);

    const card = document.createElement("article");
    card.className = `report-card${isUnlocked ? " is-unlocked" : ""}`;
    card.innerHTML = `
      <div class="report-card-head">
        <span class="report-month">${report.window}</span>
        <span class="report-status-icon">
          <svg viewBox="0 0 24 24"><use href="#${isUnlocked ? "icon-check" : "icon-lock"}"/></svg>
        </span>
      </div>
      <h3>${report.label}</h3>
      <p class="report-note">${
        isUnlocked
          ? "Report, summary, and recommendations are ready below."
          : `Unlocks ${formatDate(unlockDate.toISOString())}.`
      }</p>
      <button class="report-cta" type="button" ${isUnlocked ? "" : "disabled"}>
        <svg viewBox="0 0 24 24" style="width:15px;height:15px"><use href="#icon-download"/></svg>
        ${isUnlocked ? "View report" : "Locked"}
      </button>
    `;
    if (isUnlocked){
      card.querySelector("button").addEventListener("click", () => {
        alert(`Your ${report.label.toLowerCase()} will open here once it's uploaded.`);
      });
    }
    grid.appendChild(card);
  });
}

/* ---------------------------------------------------------------------- */
/* Scroll reveal                                                          */
/* ---------------------------------------------------------------------- */

function initReveal(){
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)){
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting){
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------------------------------------------------------------------- */
/* Count-up stats                                                         */
/* ---------------------------------------------------------------------- */

function initCounters(){
  const nums = document.querySelectorAll(".stat-num");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animate = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (prefersReducedMotion){
      el.textContent = target;
      return;
    }
    const duration = 900;
    const start = performance.now();
    function step(now){
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  if (!("IntersectionObserver" in window)){
    nums.forEach(animate);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting){
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  nums.forEach((el) => observer.observe(el));
}

/* ---------------------------------------------------------------------- */
/* Init                                                                    */
/* ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  renderClientDetails();
  renderMissionControl();
  renderReportCards();
  initReveal();
  initCounters();
  initGate();
});
