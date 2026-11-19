// Hermidiate website – motion effects, used on every page.
// 1. Sections and cards fade in as they scroll into view.
// 2. Hero chat "types" the conversation and starts over (home).
// 3. Numbers in the dark band count up (home).
// 4. Booking scene: the day is scanned, the free slot is booked, the job card fills in (home).
// When the visitor asks for reduced motion, everything stays static and fully visible.

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // ---------- 1. Scroll reveal ----------
  const revealTargets = Array.from(
    document.querySelectorAll("main .section-head, .step, .pain, .feature, .rule, .faq details")
  );

  revealTargets.forEach((el) => {
    el.classList.add("reveal");
    const index = Array.prototype.indexOf.call(el.parentElement.children, el);
    el.style.transitionDelay = Math.min(index, 3) * 80 + "ms"; // 0, 80, 160, 240 ms
  });
  onceVisible(revealTargets, (el) => el.classList.add("is-in"));

  // ---------- 2. Hero chat that types ----------
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

  // ---------- 3. Count-up numbers ("30 min", "+2 h", "21 days") ----------
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

  // ---------- 4. Booking scene: scan the day → free slot → booked → job card ----------
  document.querySelectorAll(".bk").forEach((scene) => {
    const statusText = scene.querySelector(".bk-status-text");
    const replay = scene.querySelector(".bk-replay");
    const finalStatus = statusText ? statusText.textContent : "";
    const setStatus = (text) => { if (statusText && text) statusText.textContent = text; };
    let run = 0;

    async function play() {
      const id = ++run;
      const step = async (ms) => { await wait(ms); if (id !== run) throw 0; };
      scene.classList.remove("s1", "s2", "s3", "s4", "is-done");
      scene.classList.add("bk-anim");
      setStatus(scene.dataset.statusSearch);
      void scene.offsetWidth; // apply the start state before animating
      try {
        await step(250);  scene.classList.add("s1");
        await step(1350); scene.classList.add("s2"); setStatus(scene.dataset.statusFound);
        await step(1000); scene.classList.add("s3");
        await step(800);  scene.classList.add("s4"); setStatus(scene.dataset.statusDone || finalStatus);
        await step(1400); scene.classList.add("is-done");
      } catch (e) { /* a newer run took over */ }
    }

    scene.classList.add("bk-anim"); // hide the result until it is played
    if (replay) {
      replay.hidden = false;
      scene.classList.add("has-replay");
      replay.addEventListener("click", play);
    }
    onceVisible([scene], play, { threshold: 0.45 });
  });
})();
