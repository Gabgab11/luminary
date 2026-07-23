/* ==========================================================================
   Luminary Digital Group — shared site script (all pages)
   ========================================================================== */

// Paste your own Formspree endpoint here (formspree.io → create a form →
// copy the endpoint). Keep this separate from the client-portal form so
// site inquiries and portal visitors don't land in the same inbox thread.
const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/YOUR_SITE_FORM_ID";

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
    { threshold: 0.12 }
  );
  items.forEach((el) => observer.observe(el));
}

function initContactForm(){
  const form = document.getElementById("contactForm");
  if (!form) return;
  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!CONTACT_FORM_ENDPOINT || CONTACT_FORM_ENDPOINT.includes("YOUR_SITE_FORM_ID")){
      status.textContent = "Form isn't connected yet — add your Formspree endpoint in script.js.";
      status.classList.add("is-visible");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          ...data,
          _subject: `New project inquiry from ${data.name}`,
          _replyto: data.email,
        }),
      });
      form.reset();
      status.textContent = "Thanks — we'll be in touch soon.";
      status.classList.add("is-visible");
    } catch (err){
      status.textContent = "Something went wrong sending that — try emailing us directly.";
      status.classList.add("is-visible");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send message";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  initContactForm();
});
