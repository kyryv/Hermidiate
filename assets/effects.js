// Hermidiate website – motion effects, used on every page.
// 1. Pause/play button for the moving services list (home).
// 2. Sections and cards fade in as they scroll into view.
// 3. Hero chat "types" the conversation and starts over (home).
// 4. Numbers in the dark band count up (home).
// 5. Mini calendar: the new booking drops into the free slot (home).
// When the visitor asks for reduced motion, only the pause button is set up
// and everything stays static and fully visible.

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------- 1. Ticker pause button ----------
  const ticker = document.querySelector(".ticker");
  const toggle = ticker && ticker.querySelector(".ticker-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const paused = ticker.classList.toggle("is-paused");
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.setAttribute("aria-label", paused ? "Play the moving list" : "Pause the moving list");
    });
  }

  if (reduceMotion || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("reveal-on");

  // Runs `callback(el)` once, the first time `el` scrolls into view
  function onceVisible(elements, callback, options) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          callback(entry.target);
        }
      });
    }, options || { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    elements.forEach((el) => observer.observe(el));
  }

  // ---------- 2. Scroll reveal ----------
  const revealTargets = Array.from(
    document.querySelectorAll("main .section-head, .step, .pain, .feature, .rule, .event, .faq details")
  ).filter((el) => !el.closest(".cal-scene")); // the calendar card has its own animation

  revealTargets.forEach((el) => {
    el.classList.add("reveal");
    const index = Array.prototype.indexOf.call(el.parentElement.children, el);
    el.style.transitionDelay = Math.min(index, 3) * 80 + "ms"; // 0, 80, 160, 240 ms
  });
  onceVisible(revealTargets, (el) => el.classList.add("is-in"));

  // ---------- 3. Hero chat that types ----------
  const chat = document.querySelector(".hero .chat");
  if (chat) {
    const body = chat.querySelector(".chat-body");
    const booked = chat.parentElement.querySelector(".booked");
    const messages = Array.from(body.querySelectorAll(".msg"));
    const picked = body.querySelector(".slot-picked");

    // Keep the box at full height so the page doesn't jump while messages appear
    body.style.minHeight = body.offsetHeight + "px";
    chat.classList.add("chat-live");

    const typing = document.createElement("div");
    typing.className = "typing";
    typing.setAttribute("aria-hidden", "true");
    typing.innerHTML = "<span></span><span></span><span></span>";

    let heroVisible = true;
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
    }).observe(chat);
    const whenVisible = async () => { while (!heroVisible || document.hidden) await wait(400); };

    async function play() {
      for (;;) {
        // reset
        messages.forEach((m) => m.classList.add("is-hidden"));
        if (booked) booked.classList.add("is-hidden");
        chat.classList.remove("chat-fading");
        await wait(500);

        for (const msg of messages) {
          await whenVisible();
          if (msg.classList.contains("msg-bot")) {
            body.insertBefore(typing, msg);
            await wait(900);
            typing.remove();
          } else {
            await wait(700); // the customer "writes"
          }
          msg.classList.remove("is-hidden");
          await wait(350);
        }

        if (picked) {
          picked.classList.add("is-pulsing");
          await wait(1200);
          picked.classList.remove("is-pulsing");
        }
        if (booked) booked.classList.remove("is-hidden");

        await wait(10000); // let people read the result
        await whenVisible();
        chat.classList.add("chat-fading");
        if (booked) booked.classList.add("is-hidden");
        await wait(500);
      }
    }
    play();
  }

  // ---------- 4. Count-up numbers ("30 min", "+2 h", "21 days") ----------
  const counters = Array.from(document.querySelectorAll(".rule-value")).filter((el) =>
    /^\+?\d+\s*\D*$/.test(el.textContent.trim()) // skips "10:00–12:00"
  );
  counters.forEach((el) => {
    const [, sign, num, rest] = el.textContent.trim().match(/^(\+?)(\d+)(.*)$/);
    el.dataset.final = el.textContent;
    el.setAttribute("aria-label", el.textContent.trim());
    el.textContent = sign + "0" + rest;
    el._count = { sign, to: Number(num), rest };
  });
  onceVisible(counters, (el) => {
    const { sign, to, rest } = el._count;
    const start = performance.now();
    const duration = 1200;
    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = sign + Math.round(to * eased) + rest;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = el.dataset.final;
    }
    requestAnimationFrame(frame);
  }, { threshold: 0.6 });

  // ---------- 5. Mini calendar ----------
  const calScenes = document.querySelectorAll(".cal-scene");
  onceVisible(calScenes, (el) => el.classList.add("is-live"), { threshold: 0.4 });
})();
