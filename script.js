/* ==========================================================================
   Luminary Digital Group — shared site script (all pages)
   ========================================================================== */

// Formspree endpoint for site inquiries (unchanged from the previous site).
const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/xjgnagdp";

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
          const parent = entry.target.parentElement;
          const siblingIndex = parent ? Array.from(parent.children).indexOf(entry.target) : 0;
          entry.target.style.transitionDelay = `${Math.min(siblingIndex, 6) * 70}ms`;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => observer.observe(el));
}

function initHeader(){
  const head = document.querySelector(".site-head");
  if (!head) return;
  const update = () => head.classList.toggle("scrolled", window.scrollY > 40);
  update();
  window.addEventListener("scroll", update, { passive: true });

  const btn = document.getElementById("menuBtn");
  const sheet = document.getElementById("menuSheet");
  if (!btn || !sheet) return;
  const setOpen = (open) => {
    document.documentElement.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Close" : "Menu";
  };
  btn.addEventListener("click", () => setOpen(!document.documentElement.classList.contains("menu-open")));
  sheet.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
}

function initValleyControls(){
  const valley = () => window.LuminaryValley;
  const sound = document.getElementById("sound");
  if (sound){
    sound.addEventListener("click", () => {
      const on = valley() ? valley().toggleSound() : false;
      sound.setAttribute("aria-pressed", String(on));
    });
  }
  // hovering the hero arrow brings the flight to a stop and scatters the lights
  const go = document.getElementById("go");
  if (go){
    go.addEventListener("pointerenter", () => valley() && valley().startHover());
    go.addEventListener("pointerleave", () => valley() && valley().stopHover());
    go.addEventListener("focus", () => valley() && valley().startHover());
    go.addEventListener("blur", () => valley() && valley().stopHover());
  }
}

function initContactForm(){
  const form = document.getElementById("contactForm");
  if (!form) return;
  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          ...data,
          _subject: `New project inquiry from ${data.name}`,
          _replyto: data.email,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      form.reset();
      status.textContent = "Thanks. We'll be in touch soon.";
    } catch (err){
      status.textContent = "That didn't send. Please try again in a moment, or message us on Instagram.";
    } finally {
      status.classList.add("is-visible");
      submitBtn.disabled = false;
      submitBtn.textContent = "Send message";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  initHeader();
  initValleyControls();
  initContactForm();
});
