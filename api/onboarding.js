// Luminary Digital Group — client onboarding endpoint (Vercel Node function).
// 1) Emails the full brief to the team.  2) Sends the client a welcome email from Marfee.
// Needs env var RESEND_API_KEY. Optional: ONBOARDING_TO (comma-separated), WELCOME_FROM.

const TEAM_TO = (process.env.ONBOARDING_TO || "gabriel@luminarydigitalgroup.com").split(",").map((s) => s.trim()).filter(Boolean);
const TEAM_FROM = "Luminary Onboarding <onboarding@luminarydigitalgroup.com>";
const WELCOME_FROM = process.env.WELCOME_FROM || "Marfee at Luminary <marfee@luminarydigitalgroup.com>";
const WELCOME_REPLY_TO = "marfee@luminarydigitalgroup.com";

const FIELDS = [
  ["Client", [["name", "Name"], ["business", "Business"], ["email", "Email"], ["phone", "Phone / WhatsApp"], ["website", "Website / Instagram"]]],
  ["Project", [["services", "Needs"], ["budget", "Budget"], ["timeline", "Launch"], ["about", "About the project"]]],
];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (v, max = 4000) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 80)).slice(0, 20).join(", ") : String(v ?? "")).trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function send(payload){
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

function shell(inner){
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3eee3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eee3;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#151510;">
<tr><td style="background:#050504;padding:30px 36px;">
<span style="font-family:'Arial Narrow',Arial,sans-serif;font-size:26px;letter-spacing:.5px;color:#f5efe2;">Luminary</span>
<span style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#a8a294;margin-left:8px;">Digital Group</span>
<div style="height:2px;width:46px;background:#f0b765;margin-top:16px;"></div>
</td></tr>
${inner}
<tr><td style="padding:22px 36px;background:#faf7f0;font-size:12px;color:#8a8577;line-height:1.6;">Luminary Digital Group · New York<br><a href="https://luminarydigitalgroup.com" style="color:#8a8577;">luminarydigitalgroup.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

function teamEmail(d){
  const sections = FIELDS.map(([title, rows]) => {
    const body = rows.filter(([k]) => d[k]).map(([k, label]) =>
      `<tr><td style="padding:8px 0;vertical-align:top;width:38%;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8a8577;">${esc(label)}</td>
       <td style="padding:8px 0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${k === "email" ? `<a href="mailto:${esc(d[k])}" style="color:#151510;">${esc(d[k])}</a>` : esc(d[k])}</td></tr>`).join("");
    return body ? `<tr><td style="padding:22px 36px 0;"><div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c98a2e;margin-bottom:6px;">${title}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece6d9;">${body}</table></td></tr>` : "";
  }).join("");
  return shell(`<tr><td style="padding:32px 36px 4px;"><div style="font-size:26px;line-height:1.2;font-family:'Arial Narrow',Arial,sans-serif;">New client onboarded: ${esc(d.business)}</div>
  <p style="font-size:15px;color:#55524a;margin:10px 0 0;">${esc(d.name)} just completed onboarding. Their details are below. Hit reply to answer them directly.</p></td></tr>${sections}<tr><td style="height:28px"></td></tr>`);
}

function welcomeEmail(d){
  const first = esc((d.name || "").split(/\s+/)[0] || "there");
  return shell(`<tr><td style="padding:36px 36px 8px;">
<div style="font-size:30px;line-height:1.15;font-family:'Arial Narrow',Arial,sans-serif;">Welcome to Luminary, ${first}.</div>
<p style="font-size:16px;line-height:1.65;color:#33312b;margin:18px 0 0;">Thank you for trusting us with ${esc(d.business) || "your brand"}. We've received your brief, and our team is already reading through it. Within one business day, we'll reply with a few thoughts and a time for our first call.</p>
<p style="font-size:16px;line-height:1.65;color:#33312b;margin:14px 0 0;">From today, you're part of the Luminary family. Our job is to take the ideas you shared and turn them into something people remember.</p>
</td></tr>
<tr><td style="padding:26px 36px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050504;border-radius:12px;"><tr><td style="padding:28px 30px;">
<div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#f0b765;margin-bottom:12px;">A word from our founder</div>
<p style="font-size:16px;line-height:1.7;color:#f5efe2;margin:0;font-style:italic;">“I started Luminary because the brands I love most have real culture behind them, and they deserve a digital home that's as bold as the story. You've built something worth showing the world. We'll treat it with the same care you put into it, and we won't stop until it shines. Welcome. I'm glad you're here.”</p>
<p style="font-size:14px;color:#f5efe2;margin:18px 0 0;">Gabriel Uji<br><span style="color:#a8a294;font-size:12px;letter-spacing:1px;">Founder &amp; CEO, Luminary Digital Group</span></p>
</td></tr></table></td></tr>
<tr><td style="padding:26px 36px 34px;">
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c98a2e;margin-bottom:10px;">What happens next</div>
<p style="font-size:15px;line-height:1.7;color:#33312b;margin:0;">1. We review your brief and look at your current presence.<br>2. We set up a discovery call to dig into the details.<br>3. You get a clear proposal with scope, timeline and cost.</p>
<p style="font-size:15px;line-height:1.65;color:#33312b;margin:22px 0 0;">Got something to add before we talk? Just reply to this email. It comes straight to me.</p>
<p style="font-size:15px;color:#33312b;margin:20px 0 0;">Warmly,<br><strong>Marfee</strong><br><span style="color:#8a8577;font-size:13px;">Luminary Digital Group</span></p>
</td></tr>`);
}

module.exports = async function handler(req, res){
  if (req.method !== "POST"){ res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email is not configured" });

  let body = req.body;
  if (typeof body === "string"){ try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // honeypot: bots fill hidden fields; pretend success
  if (body.ob_trap_x9){
    console.warn("onboarding: spam trap filled, not sending", { email: String(body.email || "").slice(0, 80) });
    return res.status(200).json({ ok: true });
  }

  const d = {};
  FIELDS.forEach(([, rows]) => rows.forEach(([k]) => { d[k] = clean(body[k]); }));
  if (!d.name || !d.business || !d.about || !d.services || !d.budget) return res.status(400).json({ error: "Missing required fields" });
  if (!EMAIL_RE.test(d.email)) return res.status(400).json({ error: "Invalid email" });

  try {
    await send({
      from: TEAM_FROM,
      to: TEAM_TO,
      reply_to: d.email,
      subject: `New client onboarded: ${d.business} (${d.name})`,
      html: teamEmail(d),
    });
  } catch (err){
    console.error(err);
    return res.status(502).json({ error: "Could not send" });
  }

  try {
    await send({
      from: WELCOME_FROM,
      to: [d.email],
      reply_to: WELCOME_REPLY_TO,
      subject: `Welcome to Luminary, ${d.name.split(/\s+/)[0]}`,
      html: welcomeEmail(d),
    });
  } catch (err){
    console.error("welcome email failed", err); // the brief still arrived, so don't fail the client
  }

  return res.status(200).json({ ok: true, sent: true });
};
