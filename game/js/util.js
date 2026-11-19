// util.js — Coral Key core: the shared CK namespace, a seeded RNG, small math
// helpers, keyboard/mouse input state, and the central game-state object.
// Every other module hangs its pieces off window.CK.
(function () {
  "use strict";
  var CK = (window.CK = window.CK || {});

  // ---- seeded RNG (mulberry32) so the island is the same on every visit ----
  var seed = 20261119;
  CK.rand = function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  CK.randRange = function (a, b) { return a + CK.rand() * (b - a); };
  CK.randInt = function (a, b) { return Math.floor(CK.randRange(a, b + 1)); };
  CK.pick = function (arr) { return arr[Math.floor(CK.rand() * arr.length)]; };

  // ---- math helpers ----
  CK.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  CK.lerp = function (a, b, t) { return a + (b - a) * t; };
  CK.dist2d = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
  CK.angleLerp = function (a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  // Island layout constants shared by world/vehicles/minimap.
  CK.WORLD = {
    size: 340,              // playable half-extent of the island (metres)
    roads: [-240, -120, 0, 120, 240], // grid lines on both axes
    roadHalf: 9,            // half width of a road
    hillZ: -268,            // north of this, the villa hill rises
    hillH: 7                // villa plateau height
  };
  CK.groundY = function (x, z) {
    // Smooth ramp up to the northern villa plateau; flat elsewhere.
    if (z > CK.WORLD.hillZ + 26) return 0;
    if (z < CK.WORLD.hillZ - 26) return CK.WORLD.hillH;
    var t = (CK.WORLD.hillZ + 26 - z) / 52;
    return CK.WORLD.hillH * (t * t * (3 - 2 * t));
  };

  // ---- input ----
  var keys = {};
  var pressed = {}; // edge-triggered, cleared by main loop each frame
  window.addEventListener("keydown", function (e) {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "Tab"].indexOf(e.code) >= 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { keys = {}; });
  CK.key = function (code) { return !!keys[code]; };
  CK.pressed = function (code) { return !!pressed[code]; };
  CK.clearPressed = function () { for (var k in pressed) delete pressed[k]; };
  CK.mouse = { dx: 0, dy: 0, down: false, locked: false };
  window.addEventListener("mousemove", function (e) {
    if (CK.mouse.locked) { CK.mouse.dx += e.movementX || 0; CK.mouse.dy += e.movementY || 0; }
  });
  window.addEventListener("mousedown", function (e) { if (e.button === 0) CK.mouse.down = true; });
  window.addEventListener("mouseup", function (e) { if (e.button === 0) CK.mouse.down = false; });
  document.addEventListener("pointerlockchange", function () {
    CK.mouse.locked = document.pointerLockElement != null;
  });

  // ---- central game state ----
  CK.G = {
    state: "menu",          // menu | playing | paused | help | busted | wasted
    prevState: "playing",
    photoMode: null,        // cover | chase | marina | garage when staged
    time: 0,                // seconds since boot
    clockMin: 17 * 60 + 42, // in-game clock, golden hour forever creeping
    money: 120,
    respect: 0,             // 0..100
    health: 100,
    wanted: 0,              // visible stars 0..5
    heat: 0,                // fractional heat behind the stars
    seenTimer: 0,           // time since police last had eyes on the player
    bust: 0,                // 0..1 bust meter while cornered on foot
    weapon: 0,              // 0 fists, 1 pistol, 2 smg
    ammo: { 1: 48, 2: 120 },
    inCar: null,            // vehicle object the player is driving
    onFoot: true,
    garageOpen: false,
    wheelOpen: false,
    dialogue: null,         // { name, lines, idx, onDone }
    upgrades: { paint: 3, engine: 0, armour: 0 },
    jobsDone: [],
    mission: null,          // active mission runtime (missions.js)
    markerTarget: null,     // current gold-marker position (minimap blip)
    lockWanted: 0,          // missions can pin the wanted level
    invulnTimer: 0,
    started: false
  };

  CK.saveKey = "coralkey_afterglow_save_v1";
  CK.save = function () {
    try {
      localStorage.setItem(CK.saveKey, JSON.stringify({
        money: CK.G.money, respect: CK.G.respect, jobsDone: CK.G.jobsDone,
        upgrades: CK.G.upgrades, ammo: CK.G.ammo
      }));
    } catch (e) { /* storage unavailable — play on without saving */ }
  };
  CK.loadSave = function () {
    try {
      var raw = localStorage.getItem(CK.saveKey);
      if (!raw) return false;
      var s = JSON.parse(raw);
      CK.G.money = s.money | 0; CK.G.respect = s.respect | 0;
      CK.G.jobsDone = s.jobsDone || []; CK.G.upgrades = s.upgrades || CK.G.upgrades;
      if (s.ammo) CK.G.ammo = s.ammo;
      return true;
    } catch (e) { return false; }
  };
  CK.hasSave = function () {
    try { return !!localStorage.getItem(CK.saveKey); } catch (e) { return false; }
  };
})();
