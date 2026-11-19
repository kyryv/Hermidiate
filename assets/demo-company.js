// Live demo: the fictional company "Novák Service".
// Change technicians, rules and the map here. The engine is in assets/demo.js.
//
// Times are "HH:MM". Days: 1 = Monday … 6 = Saturday, 0 = Sunday.
window.DEMO_COMPANY = {
  name: "Novák Service",

  // Same defaults as the real agent
  rules: {
    stepMin: 30,          // slots start every 30 minutes
    travelMin: 30,        // free time kept before and after every visit
    leadMin: 120,         // earliest start: 2 hours from now
    urgentLeadMin: 60,    // urgent requests: 1 hour from now
    horizonDays: 21,      // how far ahead to search
    options: 3,           // how many times to offer
    gapMin: 120,          // offered times on the same day are at least 2 h apart
    urgentGapMin: 60,
    changeLimitHours: 24  // customers move or cancel themselves up to 24 h before
  },

  technicians: [
    { id: "T01", name: "Martin D.", skills: ["heat_pump", "ac"], areas: ["Prague"],
      hours: { 1: ["08:00", "16:30"], 2: ["08:00", "16:30"], 3: ["08:00", "16:30"], 4: ["08:00", "16:30"], 5: ["08:00", "16:30"] },
      maxPerDay: 4, vacation: [] },
    { id: "T02", name: "Pavel N.", skills: ["heat_pump", "boiler"], areas: ["Prague", "Central Bohemia"],
      hours: { 1: ["07:30", "16:00"], 2: ["07:30", "16:00"], 3: ["07:30", "16:00"], 4: ["07:30", "16:00"], 5: ["07:30", "16:00"] },
      maxPerDay: 3, vacation: [] },
    { id: "T03", name: "Lucie H.", skills: ["ac", "ventilation"], areas: ["Prague"],
      hours: { 1: ["09:00", "17:30"], 2: ["09:00", "17:30"], 3: ["09:00", "17:30"], 4: ["09:00", "17:30"], 5: ["09:00", "17:30"], 6: ["09:00", "17:30"] },
      maxPerDay: 4, vacation: [3, 4] }, // days from today
    { id: "T04", name: "Emma O.", skills: ["boiler"], areas: ["Prague", "Central Bohemia"],
      hours: { 1: ["08:00", "16:00"], 4: ["08:00", "16:00"], 5: ["08:00", "16:00"] },
      maxPerDay: 3, vacation: [] }
  ],

  // Visit length per equipment and job: estimate and the maximum that is reserved.
  // Installations have no technician with that skill, so they go to the dispatcher.
  jobs: {
    heat_pump:   { repair: { est: 60, max: 120, name: "heat pump repair" },   service: { est: 90, max: 120, name: "yearly heat pump service" } },
    boiler:      { repair: { est: 60, max: 120, name: "boiler repair" },      service: { est: 60, max: 90,  name: "boiler service" } },
    ac:          { repair: { est: 60, max: 120, name: "air conditioning repair" }, service: { est: 60, max: 90, name: "air conditioning cleaning" } },
    ventilation: { repair: { est: 60, max: 120, name: "ventilation repair" }, service: { est: 45, max: 60,  name: "ventilation filter change" } }
  },

  equipmentNames: { heat_pump: "heat pump", boiler: "boiler", ac: "air conditioning", ventilation: "ventilation" },
  skillNames: { heat_pump: "heat pumps", boiler: "boilers", ac: "air conditioning", ventilation: "ventilation" },

  // Czech names, used on the Czech pages (<html lang="cs">)
  cs: {
    name: "Novák Servis",
    jobs: {
      heat_pump:   { repair: "oprava tepelného čerpadla", service: "roční servis tepelného čerpadla" },
      boiler:      { repair: "oprava kotle", service: "servis kotle" },
      ac:          { repair: "oprava klimatizace", service: "čištění klimatizace" },
      ventilation: { repair: "oprava vzduchotechniky", service: "výměna filtrů vzduchotechniky" }
    },
    equipmentNames: { heat_pump: "tepelné čerpadlo", boiler: "kotel", ac: "klimatizace", ventilation: "vzduchotechnika" },
    skillNames: { heat_pump: "tepelná čerpadla", boiler: "kotle", ac: "klimatizace", ventilation: "vzduchotechnika" },
    areaNames: { "Prague": "Praha", "Central Bohemia": "Středočeský kraj" }
  },

  // A tiny "map" instead of real geocoding: Prague streets and their district
  pragueStreets: {
    "dejvicka": 6, "evropska": 6, "jugoslavskych partyzanu": 6, "bubenecska": 6,
    "vinohradska": 2, "belehradska": 2, "korunni": 2, "namesti miru": 2, "londynska": 2,
    "narodni": 1, "vaclavske namesti": 1, "na prikope": 1, "parizska": 1,
    "taborska": 4, "budejovicka": 4, "na pankraci": 4,
    "plzenska": 5, "nadrazni": 5, "stefanikova": 5,
    "sokolovska": 8, "zenklova": 8, "kodanska": 10, "vrsovicka": 10,
    "seifertova": 3, "konevova": 3, "milady horakove": 7, "dukelskych hrdinu": 7
  },
  centralBohemia: ["kladno", "beroun", "kolin", "melnik", "mlada boleslav", "benesov", "ricany", "cernosice",
    "brandys nad labem", "kutna hora", "pribram", "rakovnik", "nymburk", "slany", "roztoky", "jesenice"],
  otherCities: ["brno", "ostrava", "plzen", "olomouc", "liberec", "ceske budejovice", "hradec kralove",
    "pardubice", "zlin", "jihlava", "usti nad labem", "karlovy vary", "opava"]
};
