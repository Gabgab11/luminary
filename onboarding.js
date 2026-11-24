/* Luminary Digital Group — client onboarding (single form → /api/onboarding → Resend) */
(function(){
  const form = document.getElementById("onboardingForm");
  if (!form) return;

  const submit = document.getElementById("obSubmit");
  const status = document.getElementById("obStatus");
  const done = document.getElementById("obDone");
  document.getElementById("obStarted").value = String(Date.now());

  function say(msg){
    status.textContent = msg;
    status.classList.toggle("is-visible", !!msg);
  }

  function validate(){
    let firstBad = null;
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    form.querySelectorAll("input[required], textarea[required]").forEach((el) => {
      if (!el.checkValidity() || !el.value.trim()){
        el.classList.add("is-invalid");
        firstBad = firstBad || el;
      }
    });
    form.querySelectorAll("[data-required]").forEach((group) => {
      if (!group.querySelector("input:checked")){
        group.classList.add("is-invalid");
        firstBad = firstBad || group.querySelector("input");
      }
    });
    if (firstBad){
      say("A few required answers are missing. They're marked in red.");
      firstBad.focus();
      return false;
    }
    return true;
  }

  form.addEventListener("input", (e) => {
    e.target.classList.remove("is-invalid");
    const g = e.target.closest(".ob-chips");
    if (g) g.classList.remove("is-invalid");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {};
    for (const [k, v] of new FormData(form).entries()){
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
      if (!res.ok || !out.sent) throw new Error(out.error || "Request failed");
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (err){
      say("That didn't send. Please try again in a moment, or email gabriel@luminarydigitalgroup.com.");
      submit.disabled = false;
      submit.textContent = "Send to Luminary";
    }
  });
})();
