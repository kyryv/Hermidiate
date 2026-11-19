// Hermidiate website – pilot form
//
// How the form is sent (first match wins):
//   1. FORM_ENDPOINT is set     -> JSON POST to that URL (e.g. an n8n Webhook: POST, JSON body).
//   2. Site runs on a real host -> Netlify Forms (works automatically when the site is deployed on Netlify;
//                                  submissions appear in Netlify → Forms → "pilot", e-mail notification can be set there).
//   3. Local file / localhost   -> opens the visitor's e-mail app with the filled-in data.
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "hermidiateai@gmail.com";

(function () {
  const form = document.getElementById("pilot-form");
  if (!form) return;

  const status = form.querySelector(".form-status");
  const button = form.querySelector('button[type="submit"]');
  const isLocal = location.protocol === "file:" || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);

  function show(text, kind) {
    status.textContent = text;
    status.className = "form-status " + kind;
  }

  function collect() {
    const data = Object.fromEntries(new FormData(form));
    data.language = document.documentElement.lang;
    data.page = location.href;
    data.sent_at = new Date().toISOString();
    return data;
  }

  async function sendJson(data) {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
  }

  async function sendNetlify(data) {
    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString(),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
  }

  function openEmail(data) {
    const lines = [
      form.dataset.lblCompany + ": " + (data.company || ""),
      form.dataset.lblName + ": " + (data.name || ""),
      form.dataset.lblPhone + ": " + (data.phone || ""),
      "E-mail: " + (data.email || ""),
      form.dataset.lblTechs + ": " + (data.technicians || ""),
    ];
    window.location.href = "mailto:" + CONTACT_EMAIL +
      "?subject=" + encodeURIComponent(form.dataset.mailSubject) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Required fields + e-mail format (browser rules)
    if (!form.checkValidity()) {
      show(form.dataset.msgInvalid, "err");
      const firstInvalid = form.querySelector(":invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const data = collect();

    // Honeypot: real people never fill the hidden "website" field
    if (data.website) return;

    // Opened from disk or localhost without an endpoint: hand over to the e-mail app
    if (!FORM_ENDPOINT && isLocal) {
      openEmail(data);
      show(form.dataset.msgMailto, "ok");
      return;
    }

    button.disabled = true;
    try {
      if (FORM_ENDPOINT) {
        delete data.website;
        delete data["form-name"];
        await sendJson(data);
      } else {
        await sendNetlify(data);
      }
      form.reset();
      show(form.dataset.msgOk, "ok");
    } catch (err) {
      console.error(err);
      show(form.dataset.msgErr, "err");
    } finally {
      button.disabled = false;
    }
  });
})();
