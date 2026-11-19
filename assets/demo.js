// Live demo engine.
//
// How it is built (same principle as the real Hermidiate agent):
// 1. UNDERSTAND – read the message and pick out facts. The real product uses AI
//    for this; here it is simulated with keywords (section "Understanding").
// 2. DECIDE – fixed rules: question order, validation, address check, technician
//    choice, free-time search, booking, changes. This part runs the same rules as
//    the real agent, on the fictional company in assets/demo-company.js.
// Nothing is sent anywhere. Everything lives in this browser tab.
(function () {
  const C = window.DEMO_COMPANY;
  const R = C.rules;
  const $ = (id) => document.getElementById(id);
  const thread = $("thread"), chips = $("chips"), input = $("input"), endBox = $("end");
  const fieldsBox = $("sys-fields"), logBox = $("sys-log"), techBox = $("sys-techs");
  if (!thread || !C) return;

  // =====================================================================
  // Time helpers. A moment is { day, min }: days from today, minutes from midnight.
  // =====================================================================
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const dateOf = (day) => { const d = new Date(today); d.setDate(d.getDate() + day); return d; };
  const weekday = (day) => dateOf(day).getDay();
  const hm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const fmtTime = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
  const fmtDay = (day) => dateOf(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  const fmtSlot = (s) => fmtDay(s.day) + " · " + fmtTime(s.start) + "–" + fmtTime(s.end);
  const hoursUntil = (s) => ((s.day * 1440 + s.start) - nowMin()) / 60;

  // =====================================================================
  // Technicians' calendars: existing visits are generated so the week looks busy.
  // The same visits come back all day (seeded by the date).
  // =====================================================================
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];

  function workHours(tech, day) {
    if (tech.vacation.includes(day)) return null;
    const h = tech.hours[weekday(day)];
    return h ? [hm(h[0]), hm(h[1])] : null;
  }
  function fits(events, s, e, buffer) {
    return events.every((ev) => s >= ev.e + buffer || e <= ev.s - buffer);
  }

  const calendars = {};
  function buildCalendars() {
    const key = today.toISOString().slice(0, 10);
    C.technicians.forEach((t) => {
      calendars[t.id] = [];
      for (let day = 0; day <= R.horizonDays + 10; day++) {
        const wh = workHours(t, day);
        if (!wh) continue;
        const rng = seeded(key + t.id + day);
        const count = Math.min(pick(rng, [0, 1, 1, 2, 2, 2, 3]), t.maxPerDay - 1);
        const evs = [];
        for (let tries = 0; evs.length < count && tries < 20; tries++) {
          const len = pick(rng, [60, 90, 120]);
          const steps = Math.floor((wh[1] - wh[0] - len) / R.stepMin);
          const s = wh[0] + R.stepMin * Math.floor(rng() * (steps + 1));
          if (fits(evs, s, s + len, R.travelMin)) {
            const skill = pick(rng, t.skills);
            const place = t.areas.includes("Central Bohemia") && rng() < 0.4
              ? pick(rng, ["Kladno", "Beroun", "Říčany", "Mělník"]) : "Praha " + (1 + Math.floor(rng() * 10));
            evs.push({ day, s, e: s + len, label: C.equipmentNames[skill] + " · " + place });
          }
        }
        calendars[t.id].push(...evs.map((ev) => ({ ...ev, day })));
      }
    });
  }
  const eventsOn = (techId, day) => calendars[techId].filter((ev) => ev.day === day);

  // =====================================================================
  // Understanding (simulated AI): keywords → facts
  // =====================================================================
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  function has(t, words) {
    return words.some((w) => {
      const prefix = w.endsWith("*");
      const body = (prefix ? w.slice(0, -1) : w).replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("(^|[^a-z0-9])" + body + (prefix ? "" : "($|[^a-z0-9])")).test(t);
    });
  }

  const SAFETY = /smell\w*\s+(of\s+)?gas|gas\s+(smell|leak)|leak\w*\s+gas|smoke|smoking|burning|fire|sparks|cit\w*\s+plyn|unik\w*\s+plyn|zapach\w*\s+plyn|kour/;
  const EQUIP = {
    heat_pump: ["heat pump*", "heatpump*", "tepeln* cerpad*", "cerpadl*"],
    boiler: ["boiler*", "kotel", "kotl*", "kotle"],
    ac: ["air con*", "aircon*", "ac", "a/c", "klimatiz*", "klima", "cooling", "cool air"],
    ventilation: ["ventilat*", "vzt", "recuperat*", "rekuperac*", "heat recovery", "mvhr", "air handling"]
  };
  const JOB = {
    install: ["install*", "new heat pump", "new boiler", "new ac", "new unit", "replace*", "montaz*", "instalac*"],
    repair: ["broken", "repair*", "fix*", "error*", "fault*", "not working", "doesn't work", "does not work", "isn't", "isnt",
      "stopped", "noise*", "noisy", "loud", "leak*", "drip*", "rattl*", "cold", "no heat*", "not heat*", "not cool*", "won't", "wont",
      "nefung*", "porouch*", "porucha", "oprav*", "nejde", "netopi"],
    service: ["service", "servicing", "check*", "yearly", "annual", "maintenance", "clean*", "inspection", "revize", "revizi",
      "prohlidk*", "udrzb*", "filter*", "filtr*"]
  };
  const URGENT = ["urgent*", "asap", "emergency", "right now", "immediately", "no heat*", "not heating", "cold inside", "freezing",
    "house is cold", "home is cold", "flat is cold", "bez topeni", "netopi", "zima", "no hot water"];
  const OUT_OF_SCOPE = ["sink", "toilet", "plumb*", "tap", "faucet", "pipe*", "electric*", "roof*", "window*", "washing machine",
    "dishwasher", "fridge", "oven", "shower", "drain*"];
  const OFF_TOPIC = ["poem", "song", "joke", "story", "recipe", "weather", "football", "write me"];
  const PRICE = ["discount*", "cheaper", "price*", "cost*", "how much", "free of charge", "sleva", "slevu", "cena", "kolik"];
  const THANKS = ["thank*", "thx", "diky", "dekuj*", "cheers"];
  const YES = ["yes", "yeah", "yep", "sure", "ok", "okay", "correct", "right", "ano", "jo", "fine", "please do", "do it", "confirm*"];
  const NO = ["no", "nope", "not", "ne", "wrong", "different", "keep"];
  const CANCEL = ["cancel*", "zrus*", "storn*", "delete"];
  const MOVE = ["move", "reschedul*", "change the time", "another time", "different time", "presun*", "postpone"];
  const NONE = ["none", "neither", "other", "others", "later", "different", "more", "something else", "jiny", "jine", "pozdeji"];
  const WEEKDAYS = [["sunday", "sun", "nedel*"], ["monday", "mon", "pondel*"], ["tuesday", "tue", "uter*"], ["wednesday", "wed", "stred*"],
    ["thursday", "thu", "ctvrt*"], ["friday", "fri", "patek", "patek*"], ["saturday", "sat", "sobot*"]];

  function detectEquip(t) { return Object.keys(EQUIP).find((k) => has(t, EQUIP[k])) || null; }
  function detectJob(t) {
    if (has(t, JOB.install)) return "install";
    if (has(t, JOB.repair) || /\be\d{1,3}\b/.test(t)) return "repair";
    if (has(t, JOB.service)) return "service";
    return null;
  }
  function detectPref(t) {
    const p = {};
    if (has(t, ["morning*", "dopoledn*", "rano", "am", "before noon", "early"])) p.part = "am";
    if (has(t, ["afternoon*", "odpoledn*", "pm", "after lunch", "after noon"])) p.part = "pm";
    if (has(t, ["today", "dnes"])) p.day = 0;
    if (has(t, ["tomorrow", "zitra"])) p.day = 1;
    if (has(t, ["next week", "pristi tyden"])) { const wd = weekday(0); p.from = ((8 - wd) % 7) || 7; }
    WEEKDAYS.forEach((names, wd) => {
      if (has(t, names)) { let d = (wd - weekday(0) + 7) % 7; if (d === 0) d = 7; p.day = d; }
    });
    return p;
  }
  function extractPhone(text) {
    const m = text.match(/(\+|00)?\d[\d\s\-/]{2,}\d/);
    if (!m) return null;
    const plus = !!m[1];
    let digits = m[0].replace(/\D/g, "");
    if (m[0].startsWith("00")) digits = digits.slice(2);
    if (plus || m[0].startsWith("00")) {
      if (/^42[01]/.test(digits)) {
        const rest = digits.slice(3);
        return rest.length === 9 ? { ok: true, value: "+" + digits.slice(0, 3) + " " + rest.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") }
          : { ok: false, reason: "A Czech or Slovak number has 9 digits after +420 / +421." };
      }
      return digits.length >= 8 && digits.length <= 15 ? { ok: true, value: "+" + digits } : { ok: false, reason: "That international number looks incomplete." };
    }
    if (digits.length === 9) return { ok: true, value: "+420 " + digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") };
    return { ok: false, reason: "A Czech number has 9 digits, for example 777 123 456. Foreign numbers need the country code, like +49." };
  }
  function extractEmail(text) {
    const m = text.match(/[^\s@,;<>()]+@[^\s@,;<>()]+/);
    if (!m) return null;
    const v = m[0].replace(/[.]+$/, "");
    return /^[^@]+@[^@]+\.[a-z]{2,}$/i.test(v) ? { ok: true, value: v.toLowerCase() } : { ok: false };
  }

  // Address: "Street 12, City 6" → parts, then a check against the small map
  function parseAddress(text) {
    const a = {};
    const m = text.match(/^\s*(.*?[\p{L}][\p{L} .'-]*?)\s+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)\b\s*,?\s*(.*)$/u);
    let rest = text;
    if (m) { a.street = m[1].replace(/^(at|on|address:?|adresa:?)\s+/i, "").trim(); a.number = m[2]; rest = m[3]; }
    const r = norm(rest || "");
    const prague = r.match(/\b(praha|prague|prag)\b\s*-?\s*(\d{1,2})?/) || r.match(/^p\s?(\d{1,2})\b/);
    if (prague) {
      a.city = "Praha";
      const n = prague[2] || (prague[0].startsWith("p") && !/^pra/.test(prague[0]) ? prague[1] : null);
      if (n) a.district = Number(n);
    } else {
      const c = C.centralBohemia.find((x) => r.includes(x)) || C.otherCities.find((x) => r.includes(x));
      if (c) a.city = c;
      else if (r.replace(/[^a-z]/g, "").length > 2) a.unknownCity = rest.trim();
    }
    return a;
  }
  const titleCase = (s) => s.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
  const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const streetKey = (street) => {
    const n = norm(street || "");
    return Object.keys(C.pragueStreets).find((k) => n === k || n.startsWith(k) || k.startsWith(n) && n.length > 4) || null;
  };

  // =====================================================================
  // State
  // =====================================================================
  let S;
  function reset() {
    S = {
      step: "problem", eq: null, job: null, urgent: undefined, name: null, phone: null, email: null,
      addr: null, addrTries: 0, pendingDistrict: null, pref: {}, offered: [], lastOffered: null,
      booking: null, ended: false, msgs: [], out: [], log: [], busy: false
    };
    buildCalendars();
    log("info", "New conversation. Fictional company " + C.name + ": " + C.technicians.length + " technicians, calendars for the next " + R.horizonDays + " days.");
    say("Hello, this is the booking assistant of " + C.name + " (a fictional company). What needs fixing or servicing?");
    S.step = "problem";
    flush(true);
  }

  // Bot output is collected in S.out and shown after a short "typing" pause
  function say(text, extra) { S.out.push(Object.assign({ who: "bot", text }, extra || {})); }
  function log(kind, text) { S.log.push({ kind, text }); }

  // =====================================================================
  // The decision flow
  // =====================================================================
  const jobInfo = () => C.jobs[S.eq] && C.jobs[S.eq][S.job];
  const heating = () => S.eq === "heat_pump" || S.eq === "boiler";

  // Asks for the next missing thing, in the real agent's order:
  // problem → name → phone → e-mail → address (street + number) → city / district
  function next(ack) {
    const pre = ack ? ack + " " : "";
    if (!S.eq) { S.step = "problem"; return say(pre + "Which equipment is it: heat pump, boiler, air conditioning or ventilation?"); }
    if (!S.job) { S.step = "job"; return say(pre + "Is your " + C.equipmentNames[S.eq] + " broken, or do you need regular service?"); }
    if (S.job === "install") return handoffInstall(pre);
    if (S.job === "repair" && heating() && S.urgent === undefined) { S.step = "urgent"; return say(pre + "Are you without heating or hot water right now?"); }
    if (!S.name) { S.step = "name"; return say(pre + "What's your name?"); }
    if (!S.phone) { S.step = "phone"; return say(pre + "Which phone number can the technician call?"); }
    if (!S.email) { S.step = "email"; return say(pre + "And your e-mail? The calendar invitation goes there."); }
    if (!S.addr || !S.addr.ok) { S.step = "address"; return say(pre + "Where should the technician come? Street, house number and city."); }
    return schedule(pre);
  }

  function handoffInstall(pre) {
    log("decide", "Installation of " + C.equipmentNames[S.eq] + ": no technician has an installation skill → hand-off.");
    say(pre + "New installations are planned individually, so I've passed your request to our dispatcher. They'll call you to arrange a site visit.", { kind: "handoff" });
    S.step = "after";
  }

  function eligibleTechs() {
    const area = S.addr.area;
    const lines = [];
    const list = C.technicians.filter((t) => {
      if (!t.skills.includes(S.eq)) { lines.push(t.name + " ✗ no " + C.skillNames[S.eq] + " skill"); return false; }
      if (!t.areas.includes(area)) { lines.push(t.name + " ✗ doesn't cover " + area); return false; }
      lines.push(t.name + " ✓"); return true;
    });
    log("decide", "Technicians: " + lines.join(" · "));
    return list;
  }

  // Free-time search over the technicians' calendars
  function findSlots(techs, opts) {
    const info = jobInfo();
    const len = info.max;
    const lead = S.urgent ? R.urgentLeadMin : R.leadMin;
    const gap = S.urgent ? R.urgentGapMin : R.gapMin;
    const earliest = Math.ceil((nowMin() + lead) / R.stepMin) * R.stepMin;
    const pref = opts.pref || {};
    const cands = [];
    for (let day = pref.from || 0; day <= R.horizonDays; day++) {
      if (pref.day !== undefined && day !== pref.day) continue;
      techs.forEach((t) => {
        const wh = workHours(t, day);
        if (!wh) return;
        const evs = eventsOn(t.id, day).filter((ev) => !(opts.ignore && ev === opts.ignore));
        if (evs.length >= t.maxPerDay) return;
        for (let s = wh[0]; s + len <= wh[1]; s += R.stepMin) {
          if (day === 0 && s < earliest) continue;
          if (pref.part === "am" && s >= 12 * 60) continue;
          if (pref.part === "pm" && s < 12 * 60) continue;
          if (opts.after && (day < opts.after.day || (day === opts.after.day && s <= opts.after.start))) continue;
          if (!fits(evs, s, s + len, R.travelMin)) continue;
          cands.push({ day, start: s, end: s + len, tech: t, load: evs.length });
        }
      });
    }
    cands.sort((a, b) => a.day - b.day || a.start - b.start || a.load - b.load);
    const chosen = [];
    for (const c of cands) {
      if (chosen.some((x) => x.day === c.day && Math.abs(x.start - c.start) < gap)) continue;
      chosen.push(c);
      if (chosen.length === R.options) break;
    }
    return { slots: chosen, len, est: info.est, lead, earliest };
  }

  function schedule(pre, extra) {
    const techs = eligibleTechs();
    if (!techs.length) {
      const anySkill = C.technicians.filter((t) => t.skills.includes(S.eq));
      const areas = [...new Set(anySkill.flatMap((t) => t.areas))];
      log("decide", "No technician with this skill covers " + S.addr.area + " → polite refusal.");
      say("Sorry, our " + C.skillNames[S.eq] + " technicians only cover " + areas.join(" and ") + ", so we can't come to " + S.addr.label + ". Do you have an address there?",
        { kind: "miss" });
      S.addr = null; S.step = "address";
      return;
    }
    let pref = Object.assign({}, S.pref);
    let res = findSlots(techs, Object.assign({ pref }, extra || {}));
    let relaxed = "";
    if (!res.slots.length && (pref.day !== undefined || pref.part)) {
      relaxed = pref.day !== undefined ? "Nothing is free on " + fmtDay(pref.day) + (pref.part ? (pref.part === "am" ? " morning" : " afternoon") : "") + ". "
        : "Nothing is free in the " + (pref.part === "am" ? "mornings" : "afternoons") + ". ";
      log("decide", "No slot matches the wish (" + describePref(pref) + ") → searching without it.");
      res = findSlots(techs, Object.assign({ pref: {} }, extra || {}));
    }
    const info = jobInfo();
    log("decide", "Search: " + techs.length + " technician(s) × " + R.horizonDays + " days, earliest start " + (S.urgent ? "+1 h (urgent)" : "+2 h") +
      ", every " + R.stepMin + " min" + (describePref(pref) && !relaxed ? ", wish: " + describePref(pref) : "") + ".");
    log("decide", "Each visit reserves " + res.len + " min (estimate " + res.est + " min) and keeps " + R.travelMin + " min travel before and after.");
    if (!res.slots.length) {
      log("decide", "No free time in " + R.horizonDays + " days → hand-off.");
      say(pre + "I couldn't find free time in the next " + R.horizonDays + " days, so I've passed your request to our dispatcher. They'll call you.", { kind: "handoff" });
      S.step = "after"; return;
    }
    S.offered = res.slots;
    S.lastOffered = res.slots[res.slots.length - 1];
    log("decide", "Offered " + res.slots.length + " times (" + res.slots.map((s) => fmtDay(s.day) + " " + fmtTime(s.start) + " " + s.tech.name).join(", ") + ").");
    const intro = S.moving ? "Here are new free times for your " + info.name + ":" :
      (S.urgent ? "This is urgent, so here are the earliest free times for your " : "Here are free times for your ") + info.name + ":";
    say(pre + relaxed + intro, { slots: res.slots.map((s) => ({ s, label: fmtSlot(s) + " · " + s.tech.name })) });
    S.step = "slot";
  }
  function describePref(p) {
    const parts = [];
    if (p.day !== undefined) parts.push(fmtDay(p.day));
    if (p.from) parts.push("from " + fmtDay(p.from));
    if (p.part) parts.push(p.part === "am" ? "mornings" : "afternoons");
    return parts.join(", ");
  }

  function book(slot) {
    // Re-check right before booking: the slot must still be free and in the future
    const evs = eventsOn(slot.tech.id, slot.day).filter((ev) => !(S.booking && ev === S.booking.event));
    const lead = S.urgent ? R.urgentLeadMin : R.leadMin;
    if (!fits(evs, slot.start, slot.end, R.travelMin) || hoursUntil(slot) * 60 < lead) {
      log("decide", "Re-check failed: the time is no longer free → new search.");
      return schedule("That time has just been taken.");
    }
    log("decide", "Re-check OK: " + slot.tech.name + " is still free " + fmtSlot(slot) + ".");
    const info = jobInfo();
    const ev = { day: slot.day, s: slot.start, e: slot.end, label: info.name + " · " + S.name, mine: true };
    calendars[slot.tech.id].push(ev);
    const old = S.booking;
    if (old) {
      calendars[old.tech.id] = calendars[old.tech.id].filter((x) => x !== old.event);
      log("decide", "Moved: new event created, old one (" + fmtSlot(old.slot) + ") deleted.");
    } else {
      log("decide", "Booked: event created in " + slot.tech.name + "'s calendar, invitation sent to " + S.email + ".");
    }
    S.booking = { slot, tech: slot.tech, event: ev, eq: S.eq, job: S.job };
    S.moving = false;
    say(old ? "Done, your visit is moved. The old time is released." : "Booked. Here are the details:", {
      card: [
        ["When", fmtSlot(slot)],
        ["What", capFirst(info.name)],
        ["Technician", slot.tech.name],
        ["Address", S.addr.label],
        ["Contact", S.name + " · " + S.phone]
      ],
      cardNote: "Calendar invitation sent to " + S.email + ". The technician calls you before the visit to agree the exact scope; " +
        fmtTime(slot.start) + "–" + fmtTime(slot.end) + " is the longest it can take."
    });
    say("Anything else? You can also move or cancel this visit here, up to " + R.changeLimitHours + " hours before it.");
    S.step = "after";
  }

  // ---------- Address step ----------
  function handleAddress(text) {
    const a = parseAddress(text);
    const t = norm(text);
    if (!a.street || !a.number) {
      if (a.city || a.district) return say("Thanks. I also need the street and house number, for example Vinohradská 12."), true;
      return false;
    }
    a.street = titleCase(a.street.replace(/\s+/g, " "));
    const key = streetKey(a.street);
    const known = key !== null;
    const res = { street: a.street, number: a.number, ok: false };

    if (!a.city && known) { a.city = "Praha"; }
    if (a.city === "Praha") {
      res.area = "Prague";
      if (known) {
        const real = C.pragueStreets[key];
        if (a.district && a.district !== real) {
          S.pendingDistrict = Object.assign(res, { district: real, given: a.district });
          log("check", "Map: " + a.street + " " + a.number + " is in Praha " + real + ", not Praha " + a.district + " → asking to confirm.");
          S.step = "district";
          say("According to the map, " + a.street + " " + a.number + " is in Praha " + real + ", not Praha " + a.district + ". Shall I correct it?");
          return true;
        }
        res.district = real;
        res.status = a.district ? "verified" : "district added";
        log("check", "Map: " + a.street + " " + a.number + " found in Praha " + real + (a.district ? " ✓" : " (district filled in)") + ".");
      } else {
        if (S.addrTries === 0) {
          S.addrTries++;
          log("check", "Map: " + a.street + " not found → asking once.");
          say("I couldn't find " + a.street + " on the map. Could you check the street name?");
          return true;
        }
        res.district = a.district || null;
        res.status = "unverified";
        log("check", "Map: still not found → accepted as unverified (the technician confirms by phone).");
      }
      res.label = a.street + " " + a.number + ", Praha" + (res.district ? " " + res.district : "");
    } else if (a.city && C.centralBohemia.includes(a.city)) {
      res.area = "Central Bohemia"; res.status = "verified";
      res.label = a.street + " " + a.number + ", " + titleCase(a.city);
      log("check", "Map: " + titleCase(a.city) + " is in Central Bohemia ✓.");
    } else if (a.city && C.otherCities.includes(a.city)) {
      const covered = [...new Set(C.technicians.flatMap((x) => x.areas))].join(" and ");
      log("decide", titleCase(a.city) + " is outside every technician's area → polite refusal.");
      say("Sorry, our technicians don't go to " + titleCase(a.city) + ". We cover " + covered + ". Do you have an address there?", { kind: "miss" });
      return true;
    } else if (!a.city && !a.unknownCity) {
      say("Which city is " + a.street + " " + a.number + " in?");
      S.addrPartial = res;
      return true;
    } else {
      log("check", "Map: city \"" + (a.unknownCity || a.city) + "\" not recognised.");
      say("I couldn't find that city. We cover Prague and Central Bohemia. Could you check it?");
      return true;
    }
    res.ok = true;
    S.addr = res;
    S.addrTries = 0;
    next(res.status === "district added" ? "Thanks, that's Praha " + res.district + "." : "Thanks.");
    return true;
  }

  // =====================================================================
  // Message handler
  // =====================================================================
  function handle(text) {
    const t = norm(text);

    // Safety first, at any step
    if (SAFETY.test(t)) {
      log("decide", "Safety words detected → no booking, dispatcher alerted.");
      say("Please leave the building now and call 112. I won't schedule this. Our dispatcher has been alerted and will call you.", { kind: "alert" });
      S.ended = true; return;
    }

    // Contact details are picked up whenever they appear
    if (!S.phone && S.step !== "phone") {
      const p = extractPhone(text);
      if (p && p.ok) { S.phone = p.value; log("check", "Phone ✓ " + p.value + " (picked up early)."); }
    }
    if (!S.email && S.step !== "email") {
      const e = extractEmail(text);
      if (e && e.ok) { S.email = e.value; log("check", "E-mail ✓ " + e.value + " (picked up early)."); }
    }
    const pref = detectPref(t);
    if (Object.keys(pref).length && S.step !== "slot") { Object.assign(S.pref, pref); log("understand", "Time wish: " + describePref(S.pref) + "."); }

    // Questions the assistant answers at any step
    if (has(t, PRICE)) {
      log("decide", "Price question → no promises.");
      say("I can't promise prices or discounts. The technician confirms the price before any work starts.");
      return repeatQuestion();
    }
    if (has(t, OFF_TOPIC)) {
      log("decide", "Off-topic → back to booking.");
      say("I can only help with booking a visit for heat pumps, boilers, air conditioning or ventilation.");
      return repeatQuestion();
    }

    const used = (STEPS[S.step] || (() => false))(text, t);
    if (used) return;

    if (has(t, THANKS)) { say("You're welcome!"); return repeatQuestion(); }
    if (!S.eq && has(t, OUT_OF_SCOPE)) {
      log("decide", "Outside the trade → polite refusal.");
      say("Sorry, we only service heat pumps, boilers, air conditioning and ventilation, so I can't book that.");
      return repeatQuestion();
    }
    say(HINTS[S.step] || "Sorry, I didn't get that.", { kind: "miss" });
  }

  function repeatQuestion() {
    if (S.step === "slot" || S.step === "after" || S.step === "cancelConfirm" || S.step === "district") return;
    next();
  }

  const HINTS = {
    problem: "Tell me what's wrong, for example \"my heat pump shows error E21\" or \"yearly boiler service\".",
    job: "Is it a repair (something is broken) or regular service?",
    urgent: "Please answer yes or no: are you without heating right now?",
    name: "Please write your name, for example Jana Nováková.",
    phone: "Please write a phone number, for example 777 123 456.",
    email: "Please write an e-mail address, for example jana@example.com.",
    address: "Please write the street, house number and city, for example Vinohradská 12, Praha 2.",
    district: "Shall I correct the district? Yes or no.",
    slot: "Pick one of the times above, say \"the first one\", or tell me none of them suit you.",
    after: "You can move or cancel your visit, or tell me about another problem.",
    cancelConfirm: "Do you really want to cancel? Yes or no."
  };

  const STEPS = {
    problem(text, t) {
      const eq = detectEquip(t), job = detectJob(t);
      if (!eq && !S.eq && has(t, OUT_OF_SCOPE)) return false; // handled as "outside the trade"
      if (!eq && !job) return false;
      if (eq) S.eq = eq;
      if (job) S.job = job;
      if (has(t, URGENT)) S.urgent = true;
      log("understand", "Understood: " + [S.eq && C.equipmentNames[S.eq], S.job, S.urgent ? "urgent" : null].filter(Boolean).join(" · ") + ".");
      if (S.booking && S.eq === S.booking.eq && (!S.job || S.job === S.booking.job)) {
        log("decide", "Same person + same equipment with a future visit → no second booking.");
        say("You already have a " + C.jobs[S.booking.eq][S.booking.job].name + " booked on " + fmtSlot(S.booking.slot) + ". Do you want to move or cancel it?");
        S.step = "after"; return true;
      }
      next(S.eq ? "Got it." : "");
      return true;
    },
    job(text, t) {
      const job = detectJob(t) || (has(t, ["regular", "routine", "planned"]) ? "service" : null);
      if (!job) return false;
      S.job = job; if (has(t, URGENT)) S.urgent = true;
      log("understand", "Job type: " + job + ".");
      next("Thanks.");
      return true;
    },
    urgent(text, t) {
      if (has(t, URGENT) || has(t, YES)) S.urgent = true;
      else if (has(t, NO) || has(t, ["backup", "still heat*", "works"])) S.urgent = false;
      else return false;
      log("understand", S.urgent ? "Urgent: yes → earliest start 1 h from now." : "Urgent: no.");
      next(S.urgent ? "I'll look for the earliest time." : "OK.");
      return true;
    },
    name(text) {
      let n = text.replace(/[^\s@,;]+@[^\s@,;]+/g, " ").replace(/(\+|00)?\d[\d\s\-/]{4,}\d/g, " ")
        .replace(/^\s*(hi|hello|hey)[,!.]?\s*/i, "").replace(/^\s*(my name is|i am|i'm|im|it's|this is|jmenuji se|jsem)\s+/i, "")
        .replace(/[,.;!]+/g, " ").replace(/\s+/g, " ").trim();
      if (n.length < 2 || /\d/.test(n) || n.split(" ").length > 4 || /\?$/.test(text.trim())) return false;
      S.name = titleCase(n);
      log("check", "Name ✓ " + S.name + ".");
      next("Thanks, " + S.name.split(" ")[0] + ".");
      return true;
    },
    phone(text) {
      const p = extractPhone(text);
      if (!p) return false;
      if (!p.ok) { log("check", "Phone ✗ " + p.reason); say(p.reason, { kind: "miss" }); return true; }
      S.phone = p.value; log("check", "Phone ✓ " + p.value + ".");
      next();
      return true;
    },
    email(text) {
      const e = extractEmail(text);
      if (!e) {
        if (has(norm(text), ["no email", "don't have", "dont have", "nemam"])) {
          say("I need an e-mail to send you the calendar invitation with the visit details. Any address you check works.");
          return true;
        }
        return false;
      }
      if (!e.ok) { log("check", "E-mail ✗ not a valid address."); say("That e-mail doesn't look complete. It should look like name@example.com.", { kind: "miss" }); return true; }
      S.email = e.value; log("check", "E-mail ✓ " + e.value + ".");
      next();
      return true;
    },
    address(text) {
      if (S.addrPartial) {
        const p = S.addrPartial; S.addrPartial = null;
        return handleAddress(p.street + " " + p.number + ", " + text);
      }
      return handleAddress(text);
    },
    district(text, t) {
      const p = S.pendingDistrict;
      if (has(t, YES) || new RegExp("\\b" + p.district + "\\b").test(t)) {
        p.status = "district corrected"; p.ok = true;
        p.label = p.street + " " + p.number + ", Praha " + p.district;
        S.addr = p; S.pendingDistrict = null;
        log("check", "Address corrected to Praha " + p.district + " ✓.");
        next("Corrected to Praha " + p.district + ".");
        return true;
      }
      if (has(t, NO)) {
        S.pendingDistrict = null; S.step = "address";
        say("OK. Please write the full address again: street, house number and city.");
        return true;
      }
      return false;
    },
    slot(text, t) {
      const list = S.offered;
      const order = ["first", "second", "third"];
      let i = order.findIndex((w) => has(t, [w]));
      if (i < 0 && /^\s*[1-3]\s*\.?\s*$/.test(t)) i = Number(t.trim()[0]) - 1;
      if (i < 0 && has(t, ["last"])) i = list.length - 1;
      if (i < 0) {
        const tm = t.match(/\b(\d{1,2})[:.](\d{2})\b/);
        if (tm) i = list.findIndex((s) => s.start === Number(tm[1]) * 60 + Number(tm[2]));
      }
      if (i < 0) {
        const day = WEEKDAYS.findIndex((names) => has(t, names));
        if (day >= 0 && !has(t, NONE)) i = list.findIndex((s) => weekday(s.day) === day);
      }
      if (i >= 0 && i < list.length) { log("understand", "Picked: " + fmtSlot(list[i]) + "."); book(list[i]); return true; }

      const pref = detectPref(t);
      if (Object.keys(pref).length) {
        S.pref = pref; log("understand", "New time wish: " + describePref(pref) + ".");
        schedule("", S.booking ? { ignore: S.booking.event } : null); return true;
      }
      if (has(t, NONE) || has(t, NO)) {
        log("understand", "None of these → next free times.");
        say("No problem.");
        schedule("", Object.assign({ after: S.lastOffered }, S.booking ? { ignore: S.booking.event } : {}));
        return true;
      }
      return false;
    },
    after(text, t) {
      if (!S.booking && (has(t, CANCEL) || has(t, MOVE))) { say("I don't see a booking in this conversation yet."); return true; }
      if (has(t, CANCEL)) {
        if (hoursUntil(S.booking.slot) < R.changeLimitHours) return lateChange("cancel");
        S.step = "cancelConfirm";
        say("Do you really want to cancel your visit on " + fmtSlot(S.booking.slot) + "?");
        return true;
      }
      if (has(t, MOVE)) {
        if (hoursUntil(S.booking.slot) < R.changeLimitHours) return lateChange("move");
        S.moving = true; S.pref = detectPref(t);
        log("understand", "Move requested.");
        schedule("", { ignore: S.booking.event });
        return true;
      }
      if (has(t, THANKS) || has(t, ["that's all", "thats all", "nothing", "no", "bye"])) {
        say("Thank you, and have a nice day!"); S.ended = true; return true;
      }
      const eq = detectEquip(t), job = detectJob(t);
      if (eq || job) {
        S.eq = null; S.job = null; S.urgent = undefined; S.offered = []; S.pref = detectPref(t);
        log("info", "New request in the same conversation. Name, phone, e-mail and address are kept.");
        S.step = "problem";
        return STEPS.problem(text, t);
      }
      return false;
    },
    cancelConfirm(text, t) {
      if (has(t, YES) || has(t, CANCEL)) {
        const b = S.booking;
        calendars[b.tech.id] = calendars[b.tech.id].filter((x) => x !== b.event);
        log("decide", "Cancelled: event deleted from " + b.tech.name + "'s calendar.");
        say("Your visit on " + fmtSlot(b.slot) + " is cancelled and " + b.tech.name + "'s calendar is updated.");
        S.booking = null; S.step = "after";
        return true;
      }
      if (has(t, NO)) { say("OK, your visit stays as it is."); S.step = "after"; return true; }
      return false;
    }
  };

  function lateChange(what) {
    log("decide", "Visit is less than " + R.changeLimitHours + " h away → the customer can't " + what + " it alone → dispatcher.");
    say("Your visit is less than " + R.changeLimitHours + " hours away, so I can't " + what + " it myself. I've passed it to our dispatcher, who will call you shortly.", { kind: "handoff" });
    return true;
  }

  // =====================================================================
  // Suggestions under the chat
  // =====================================================================
  function suggestions() {
    if (S.ended) return [];
    switch (S.step) {
      case "problem": return S.msgs.length > 2
        ? ["Heat pump", "Boiler", "Air conditioning", "Ventilation"]
        : ["My heat pump shows error E21", "Yearly boiler service, mornings please", "Our air conditioning needs cleaning",
          "Can you install a new heat pump?", "I smell gas near the boiler"];
      case "job": return ["It's broken", "Regular service"];
      case "urgent": return ["Yes, the house is cold", "No, we have backup heating"];
      case "name": return ["Jana Nováková"];
      case "phone": return ["777 123 456", "12345"];
      case "email": return ["jana.novakova@example.com", "jana@example"];
      case "address": return ["Dejvická 77, Praha 4", "Vinohradská 12, Praha", "Náměstí Míru 3, Kladno", "Masarykova 5, Brno"];
      case "district": return ["Yes, correct it", "No"];
      case "slot": return ["None of these suit me", "Something in the afternoon", "Tomorrow"];
      case "after": return S.booking ? ["Move my visit", "Cancel my visit", "My boiler also needs a service", "Thanks, that's all"]
        : ["My boiler also needs a service", "Thanks, that's all"];
      case "cancelConfirm": return ["Yes, cancel it", "No, keep it"];
      default: return [];
    }
  }

  // =====================================================================
  // Rendering
  // =====================================================================
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderThread(typing) {
    thread.textContent = "";
    S.msgs.forEach((m, i) => {
      const bub = h("div", "demo-msg " + (m.who === "bot" ? "bot" : "me") + (m.kind ? " " + m.kind : ""));
      bub.appendChild(h("span", null, m.text));
      if (m.slots) {
        const live = S.step === "slot" && i === lastSlotMsg() && !S.busy;
        const box = h("div", "demo-slots");
        m.slots.forEach((o) => {
          const b = h("button", "demo-slot", o.label);
          b.type = "button";
          if (live) b.addEventListener("click", () => userSays(o.label, () => { log("understand", "Picked: " + fmtSlot(o.s) + "."); book(o.s); }));
          else b.disabled = true;
          box.appendChild(b);
        });
        bub.appendChild(box);
      }
      if (m.card) {
        const dl = h("dl", "demo-card");
        m.card.forEach(([k, v]) => { dl.appendChild(h("dt", null, k)); dl.appendChild(h("dd", null, v)); });
        bub.appendChild(dl);
        bub.appendChild(h("span", "demo-booked", m.cardNote));
      }
      thread.appendChild(bub);
    });
    if (typing) {
      const ty = h("div", "typing");
      ty.setAttribute("aria-hidden", "true");
      ty.innerHTML = "<span></span><span></span><span></span>";
      thread.appendChild(ty);
    }
    thread.scrollTop = thread.scrollHeight;
  }
  const lastSlotMsg = () => { for (let i = S.msgs.length - 1; i >= 0; i--) if (S.msgs[i].slots) return i; return -1; };

  function renderChips() {
    chips.textContent = "";
    if (S.busy) return;
    suggestions().forEach((t) => {
      const b = h("button", "demo-chip", t);
      b.type = "button";
      b.addEventListener("click", () => userSays(t));
      chips.appendChild(b);
    });
  }

  function renderPanel() {
    if (fieldsBox) {
      const rows = [
        ["Equipment", S.eq ? C.equipmentNames[S.eq] : null],
        ["Job", S.job ? (S.job === "install" ? "installation" : S.job) : null],
        ["Urgent", S.urgent === undefined ? null : S.urgent ? "yes" : "no"],
        ["Name", S.name], ["Phone", S.phone], ["E-mail", S.email],
        ["Address", S.addr && S.addr.ok ? S.addr.label : null, S.addr && S.addr.status],
        ["Area", S.addr && S.addr.ok ? S.addr.area : null],
        ["Visit", S.booking ? fmtSlot(S.booking.slot) + " · " + S.booking.tech.name : null, S.booking ? "booked" : null]
      ];
      fieldsBox.textContent = "";
      rows.forEach(([k, v, status]) => {
        fieldsBox.appendChild(h("dt", null, k));
        const dd = h("dd", v ? "has" : "empty", v || "—");
        if (status) dd.appendChild(h("span", "sys-tag" + (status === "verified" || status === "booked" ? " ok" : " warn"), status));
        fieldsBox.appendChild(dd);
      });
    }
    if (logBox) {
      logBox.textContent = "";
      S.log.forEach((l) => {
        const li = h("li", "sys-" + l.kind);
        li.appendChild(h("span", "sys-kind", { understand: "Understood", check: "Checked", decide: "Decided", info: "Info" }[l.kind]));
        li.appendChild(h("span", null, l.text));
        logBox.appendChild(li);
      });
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  function renderTechs() {
    if (!techBox) return;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    techBox.textContent = "";
    C.technicians.forEach((t) => {
      const tr = h("tr");
      const hrs = Object.keys(t.hours).map(Number);
      const first = t.hours[hrs[0]];
      tr.appendChild(h("td", null, t.name));
      tr.appendChild(h("td", null, t.skills.map((s) => C.skillNames[s]).join(", ")));
      tr.appendChild(h("td", null, t.areas.join(", ")));
      tr.appendChild(h("td", null, hrs.map((d) => days[d]).join(" ") + " " + first[0] + "–" + first[1] + ", max " + t.maxPerDay + "/day"));
      techBox.appendChild(tr);
    });
  }

  function render(typing) {
    renderThread(typing);
    renderChips();
    renderPanel();
    endBox.hidden = !S.ended;
    $("bar-chat").hidden = S.ended;
  }

  // Show the user's message, "type" for a moment, then show the replies
  function userSays(text, action) {
    if (S.busy || S.ended || !text.trim()) return;
    S.msgs.push({ who: "me", text });
    S.busy = true;
    try { action ? action() : handle(text); } catch (err) { console.error(err); say("Something went wrong in the demo. Please start over.", { kind: "miss" }); }
    render(true);
    setTimeout(() => flush(), 450 + Math.min(S.out.length, 3) * 150);
  }
  function flush(first) {
    S.msgs.push(...S.out);
    S.out = [];
    S.busy = false;
    render(false);
    if (!first) input.focus({ preventScroll: true });
  }

  // =====================================================================
  // Events
  // =====================================================================
  function sendInput() {
    const t = input.value.trim();
    if (!t || S.busy) return;
    input.value = "";
    userSays(t);
  }
  $("send").addEventListener("click", sendInput);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendInput(); });
  document.querySelectorAll("[data-restart]").forEach((b) => b.addEventListener("click", () => { reset(); input.focus(); }));

  renderTechs();
  reset();
})();
