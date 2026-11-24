/* Luminary Digital Group — client onboarding (multi-step form → /api/onboarding → Resend) */
(function(){
  const form = document.getElementById("onboardingForm");
  if (!form) return;

  const panels = Array.from(form.querySelectorAll(".ob-panel"));
  const steps = Array.from(document.querySelectorAll("#obSteps li"));
  const bar = document.getElementById("obBar");
  const back = document.getElementById("obBack");
  const next = document.getElementById("obNext");
  const submit = document.getElementById("obSubmit");
  const status = document.getElementById("obStatus");
  const done = document.getElementById("obDone");
  let current = 0;

  function say(msg){
    status.textContent = msg;
    status.classList.toggle("is-visible", !!msg);
  }

  function show(i){
    panels.forEach((p, n) => {
      p.hidden = n !== i;
      p.classList.toggle("is-active", n === i);
    });
    steps.forEach((s, n) => {
      s.classList.toggle("is-current", n === i);
      s.classList.toggle("is-done", n < i);
      if (n === i) s.setAttribute("aria-current", "step"); else s.removeAttribute("aria-current");
    });
    bar.style.width = `${((i + 1) / panels.length) * 100}%`;
    back.hidden = i === 0;
    next.hidden = i === panels.length - 1;
    submit.hidden = i !== panels.length - 1;
    current = i;
    say("");
    const top = document.getElementById("obSteps").getBoundingClientRect().top + window.scrollY - 120;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }

  function validate(panel){
    let firstBad = null;
    panel.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    panel.querySelectorAll("input[required], textarea[required]").forEach((el) => {
      if (!el.checkValidity() || !el.value.trim()){
        el.classList.add("is-invalid");
        firstBad = firstBad || el;
      }
    });
    panel.querySelectorAll("[data-required]").forEach((group) => {
      if (!group.querySelector("input:checked")){
        group.classList.add("is-invalid");
        firstBad = firstBad || group.querySelector("input");
      }
    });
    if (firstBad){
      say("A few required answers are missing. They're marked in red.");
      firstBad.focus({ preventScroll: false });
      return false;
    }
    return true;
  }

  form.addEventListener("input", (e) => {
    e.target.classList.remove("is-invalid");
    const g = e.target.closest(".ob-chips");
    if (g) g.classList.remove("is-invalid");
  });

  next.addEventListener("click", () => { if (validate(panels[current])) show(current + 1); });
  back.addEventListener("click", () => show(current - 1));

  // Enter in a text input moves forward instead of submitting early
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && current < panels.length - 1){
      e.preventDefault();
      next.click();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (current !== panels.length - 1){ next.click(); return; }
    if (!validate(panels[current])) return;

    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()){
      if (k === "services") (data.services = data.services || []).push(v);
      else data[k] = v;
    }

    submit.disabled = true;
    submit.textContent = "Sending…";
    say("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Request failed");
      form.hidden = true;
      document.getElementById("obSteps").hidden = true;
      bar.parentElement.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (err){
      say("That didn't send. Please try again in a moment, or email gabriel@luminarydigitalgroup.com.");
      submit.disabled = false;
      submit.textContent = "Send to Luminary";
    }
  });

  show(0);
})();
