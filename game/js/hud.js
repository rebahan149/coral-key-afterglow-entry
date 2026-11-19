// hud.js — everything drawn over the 3D world: money / respect / wanted /
// health / weapon / speed readouts, the objective banner, dialogue cards,
// prompts and toasts, the circular minimap (water, roads, player arrow,
// gold mission blip, police blips), the weapon wheel, the garage panel
// (paint / engine / armour bought with job money), the start / pause /
// help / busted / wasted screens, and localStorage saves.
(function () {
  "use strict";
  var CK = window.CK;
  var H = (CK.HUD = {});
  function el(id) { return document.getElementById(id); }
  var ui = {};
  var toastTimer = 0, radioTimer = 0, minimapTick = 0;

  H.init = function () {
    ["hud", "hud-money", "hud-respect-fill", "hud-wanted", "hud-clock", "hud-health-fill",
     "hud-weapon", "hud-ammo", "hud-speed", "hud-car-name", "hud-district", "hud-objective",
     "hud-objective-title", "hud-objective-text", "hud-objective-timer", "hud-prompt", "hud-toast",
     "hud-bust-wrap", "hud-bust-fill", "dialogue", "dialogue-name", "dialogue-text", "radio-tag",
     "wheel", "garage", "start-screen", "pause-screen", "help-screen", "end-screen", "crosshair",
     "minimap"].forEach(function (id) { ui[id] = el(id); });
    ui.mm = ui["minimap"].getContext("2d");
    el("btn-start").addEventListener("click", function () { CK.startGame(false); });
    el("btn-continue").addEventListener("click", function () { CK.startGame(true); });
    el("btn-resume").addEventListener("click", function () { CK.resumeGame(); });
    el("btn-restart").addEventListener("click", function () { CK.restartDay(); });
    el("btn-help2").addEventListener("click", function () { H.showHelp(true); });
    el("btn-help-close").addEventListener("click", function () { H.showHelp(false); });
    el("btn-again").addEventListener("click", function () { CK.respawn(); });
    el("garage-close").addEventListener("click", function () { H.closeGarage(); });
    if (CK.hasSave()) el("btn-continue").classList.remove("hidden");
    buildGarage();
    H.refreshWeapon();
  };

  // ---------- small displays ----------
  var objectiveState = { title: null, text: "", timer: null };
  H.setObjective = function (title, text, timer) {
    objectiveState.title = title; objectiveState.text = text || ""; objectiveState.timer = timer;
  };
  H.toast = function (msg) {
    ui["hud-toast"].textContent = msg;
    ui["hud-toast"].classList.remove("hidden");
    toastTimer = 2.6;
  };
  H.toastRadio = function (name) {
    ui["radio-tag"].textContent = "📻 " + name;
    ui["radio-tag"].classList.remove("hidden");
    radioTimer = 2.4;
  };
  H.flashHealth = function () {
    ui["hud-health-fill"].style.filter = "brightness(2.2)";
    setTimeout(function () { ui["hud-health-fill"].style.filter = ""; }, 90);
  };
  H.refreshWeapon = function () {
    var w = CK.Combat.WEAPONS[CK.G.weapon];
    ui["hud-weapon"].textContent = w.name;
    ui["hud-ammo"].textContent = CK.G.weapon === 0 ? "" : "Ammo " + (CK.G.ammo[CK.G.weapon] || 0);
    var slots = document.querySelectorAll(".wheel-slot");
    slots.forEach(function (s, i) { s.classList.toggle("sel", i === CK.G.weapon); });
  };
  H.refreshDialogue = function () {
    var d = CK.G.dialogue;
    if (!d) { ui["dialogue"].classList.add("hidden"); return; }
    var line = d.lines[Math.min(d.idx, d.lines.length - 1)];
    ui["dialogue-name"].textContent = line[0];
    ui["dialogue-text"].textContent = line[1];
    ui["dialogue"].classList.remove("hidden");
  };

  // ---------- end screens ----------
  H.showEnd = function (kind) {
    var G = CK.G;
    if (G.state !== "playing") return;
    G.state = kind; // 'busted' | 'wasted'
    if (CK.G.inCar) CK.Player.exitCar();
    CK.Police.despawnAll();
    CK.Police.clearLock();
    document.exitPointerLock && document.exitPointerLock();
    var fine = kind === "busted" ? Math.floor(G.money * 0.15) : Math.floor(G.money * 0.10);
    G.money -= fine;
    el("end-title").textContent = kind === "busted" ? "BUSTED" : "WASTED";
    el("end-text").textContent = kind === "busted"
      ? "Coral Key PD walks you to a cell smelling of sunscreen. Bail and fines cost you $" + fine + "."
      : "You wake up at St. Coral Hospital with sand in your shoes. The bill comes to $" + fine + ".";
    el("end-screen").classList.toggle("wasted", kind === "wasted");
    el("end-screen").classList.remove("hidden");
    CK.Audio.SFX.fail();
    CK.save();
  };

  // ---------- pause & help ----------
  H.togglePause = function () {
    var G = CK.G;
    if (G.state === "playing") {
      G.state = "paused";
      ui["pause-screen"].classList.remove("hidden");
      document.exitPointerLock && document.exitPointerLock();
    } else if (G.state === "paused") CK.resumeGame();
  };
  H.showHelp = function (show) {
    var G = CK.G;
    if (show) {
      G.prevState = G.state;
      G.state = "help";
      ui["help-screen"].classList.remove("hidden");
      ui["pause-screen"].classList.add("hidden");
    } else {
      ui["help-screen"].classList.add("hidden");
      G.state = G.prevState === "help" ? "playing" : G.prevState;
      if (G.state === "paused") ui["pause-screen"].classList.remove("hidden");
    }
  };

  // ---------- garage ----------
  var ENGINE_TIERS = [{ name: "Stock", cost: 0 }, { name: "Sport +16%", cost: 600 }, { name: "Turbo +32%", cost: 1500 }];
  var ARMOUR_TIERS = [{ name: "None", cost: 0 }, { name: "Reinforced", cost: 700 }, { name: "Plated", cost: 1600 }];
  var PAINT_COST = 150;
  function buildGarage() {
    var paints = el("garage-paints");
    CK.Vehicles.PAINTS.forEach(function (hex, i) {
      var b = document.createElement("button");
      b.className = "swatch"; b.title = CK.Vehicles.PAINT_NAMES[i];
      b.style.background = "#" + hex.toString(16).padStart(6, "0");
      b.addEventListener("click", function () { buyPaint(i, hex); });
      paints.appendChild(b);
    });
    buildTierRow(el("garage-engine"), ENGINE_TIERS, "engine");
    buildTierRow(el("garage-armour"), ARMOUR_TIERS, "armour");
  }
  function buildTierRow(holder, tiers, key) {
    tiers.forEach(function (t, i) {
      var b = document.createElement("button");
      b.className = "tier-btn"; b.dataset.tier = i;
      b.textContent = t.name + (t.cost ? " · $" + t.cost : "");
      b.addEventListener("click", function () { buyTier(key, i, tiers); });
      holder.appendChild(b);
    });
  }
  function garageMsg(m) { el("garage-msg").textContent = m; }
  function buyPaint(i, hex) {
    var G = CK.G, car = G.inCar;
    if (!car) return;
    if (G.upgrades.paint === i && car.savedPaint === hex) { garageMsg("Already wearing " + CK.Vehicles.PAINT_NAMES[i] + "."); return; }
    if (G.money < PAINT_COST) { garageMsg("Not enough cash — a respray is $" + PAINT_COST + "."); CK.Audio.SFX.fail(); return; }
    G.money -= PAINT_COST;
    G.upgrades.paint = i; car.savedPaint = hex;
    car.paintMat.color.setHex(hex);
    CK.Audio.SFX.cash(); garageMsg("Sprayed " + CK.Vehicles.PAINT_NAMES[i] + ". Looking sharp.");
    refreshGarage(); CK.save();
  }
  function buyTier(key, i, tiers) {
    var G = CK.G;
    if (G.upgrades[key] === i) { garageMsg("Already fitted."); return; }
    if (i < G.upgrades[key]) { // downgrade is free, keeps the part in the shed
      G.upgrades[key] = i; garageMsg("Refitted the " + tiers[i].name.toLowerCase() + " setup."); refreshGarage(); CK.save(); return;
    }
    if (G.money < tiers[i].cost) { garageMsg("Not enough cash — need $" + tiers[i].cost + "."); CK.Audio.SFX.fail(); return; }
    G.money -= tiers[i].cost;
    G.upgrades[key] = i;
    if (key === "armour" && G.inCar) { G.inCar.maxHealth = 100 + i * 45; G.inCar.health = Math.min(G.inCar.maxHealth, G.inCar.health + 45); }
    CK.Audio.SFX.cash(); garageMsg(tiers[i].name + " fitted.");
    refreshGarage(); CK.save();
  }
  function refreshGarage() {
    var G = CK.G;
    el("garage-money").textContent = "Your cash: $" + G.money + (G.inCar ? " · Car: " + G.inCar.type.name : "");
    document.querySelectorAll("#garage-paints .swatch").forEach(function (s, i) { s.classList.toggle("sel", i === G.upgrades.paint); });
    document.querySelectorAll("#garage-engine .tier-btn").forEach(function (b, i) { b.classList.toggle("sel", i === G.upgrades.engine); });
    document.querySelectorAll("#garage-armour .tier-btn").forEach(function (b, i) { b.classList.toggle("sel", i === G.upgrades.armour); });
  }
  H.openGarage = function () {
    if (!CK.G.inCar) return;
    CK.G.garageOpen = true;
    refreshGarage(); garageMsg("");
    ui["garage"].classList.remove("hidden");
    document.exitPointerLock && document.exitPointerLock();
  };
  H.closeGarage = function () {
    CK.G.garageOpen = false;
    ui["garage"].classList.add("hidden");
  };

  // ---------- minimap ----------
  function drawMinimap() {
    var g = ui.mm, S = 190, half = 340;
    function mx(x) { return (x + half) / (half * 2) * S; }
    function mz(z) { return (z + half) / (half * 2) * S; }
    g.fillStyle = "#14586e"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#79a85e";
    g.beginPath(); g.roundRect(mx(-338), mz(-338), mx(338) - mx(-338), mz(338) - mz(-338), 10); g.fill();
    g.fillStyle = "#8a8f96"; g.fillRect(mx(-338), mz(-190), mx(-248) - mx(-338), mz(90) - mz(-190));
    g.fillStyle = "#a8b39a"; g.fillRect(mx(-338), mz(-338), mx(338) - mx(-338), mz(-252) - mz(-338));
    g.strokeStyle = "#3c414d"; g.lineWidth = 3;
    CK.WORLD.roads.forEach(function (r) {
      g.beginPath(); g.moveTo(mx(r), mz(-338)); g.lineTo(mx(r), mz(338)); g.stroke();
      g.beginPath(); g.moveTo(mx(-338), mz(r)); g.lineTo(mx(338), mz(r)); g.stroke();
    });
    // gold mission blip (pulsing)
    var mt = CK.G.markerTarget;
    if (mt) {
      g.fillStyle = "#ffc46b";
      g.beginPath(); g.arc(mx(mt.x), mz(mt.z), 4.6 + Math.sin(CK.G.time * 5) * 1.2, 0, 7); g.fill();
      g.strokeStyle = "#fff2c9"; g.lineWidth = 1.4; g.stroke();
    }
    // police blips
    CK.copCars.forEach(function (c) {
      g.fillStyle = Math.sin(CK.G.time * 9) > 0 ? "#ff4444" : "#4488ff";
      g.beginPath(); g.arc(mx(c.group.position.x), mz(c.group.position.z), 3, 0, 7); g.fill();
    });
    // player arrow
    var fp = CK.Player.focusPos();
    var yaw = CK.G.inCar ? CK.G.inCar.group.rotation.y : CK.Player.avatar.rotation.y;
    g.save();
    g.translate(mx(fp.x), mz(fp.z));
    g.rotate(Math.PI - yaw); // map: +x right, +z down; arrow model points up
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(0, -6.4); g.lineTo(4.4, 5); g.lineTo(0, 2.4); g.lineTo(-4.4, 5); g.closePath(); g.fill();
    g.strokeStyle = "#1c1030"; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }

  // ---------- per-frame HUD ----------
  H.update = function (dt) {
    var G = CK.G;
    // menu keys
    if (G.state === "playing" || G.state === "paused") {
      if (CK.pressed("KeyP") || CK.pressed("Escape")) H.togglePause();
      if (CK.pressed("KeyH")) H.showHelp(G.state !== "help");
    } else if (G.state === "help" && (CK.pressed("KeyH") || CK.pressed("Escape"))) H.showHelp(false);
    if (G.state !== "playing") return;

    if (CK.pressed("KeyG")) { if (G.garageOpen) H.closeGarage(); else H.openGarage(); }
    if (CK.pressed("KeyR") && G.inCar) CK.Audio.cycleStation();
    var wheelWanted = CK.key("KeyQ");
    if (wheelWanted !== G.wheelOpen) {
      G.wheelOpen = wheelWanted;
      ui["wheel"].classList.toggle("hidden", !wheelWanted);
      if (wheelWanted) H.refreshWeapon();
    }

    // readouts
    ui["hud-money"].textContent = "$" + G.money;
    ui["hud-respect-fill"].style.width = G.respect + "%";
    var stars = CK.Police.stars();
    var starHtml = "";
    for (var i = 0; i < 5; i++) starHtml += i < stars ? "★" : '<span class="off">★</span>';
    ui["hud-wanted"].innerHTML = starHtml;
    G.clockMin += dt * 0.45;
    var hh = Math.floor(G.clockMin / 60) % 24, mm2 = Math.floor(G.clockMin % 60);
    ui["hud-clock"].textContent = "🌇 " + (hh < 10 ? "0" : "") + hh + ":" + (mm2 < 10 ? "0" : "") + mm2;
    ui["hud-health-fill"].style.width = Math.max(0, G.health) + "%";
    if (G.weapon > 0) ui["hud-ammo"].textContent = "Ammo " + (G.ammo[G.weapon] || 0);
    if (G.inCar) {
      ui["hud-speed"].textContent = Math.round(Math.abs(G.inCar.speed) * 3.6) + " km/h";
      ui["hud-car-name"].textContent = G.inCar.type.name + (G.inCar.dead ? " — WRECKED" : "");
    } else { ui["hud-speed"].textContent = ""; ui["hud-car-name"].textContent = ""; }
    ui["crosshair"].classList.toggle("hidden", !(G.onFoot && G.weapon > 0 && !G.dialogue));

    // objective banner
    if (objectiveState.title) {
      ui["hud-objective"].classList.remove("hidden");
      ui["hud-objective-title"].textContent = objectiveState.title;
      ui["hud-objective-text"].textContent = objectiveState.text;
      ui["hud-objective-timer"].textContent = objectiveState.timer != null
        ? "⏱ " + Math.max(0, Math.ceil(objectiveState.timer)) + "s" : "";
    } else ui["hud-objective"].classList.add("hidden");

    // context prompt
    var prompt = "";
    if (G.dialogue) prompt = "";
    else if (G.onFoot) {
      var near = CK.Player.nearestCar(4.4);
      if (near && !near.dead) prompt = "F — Enter " + near.type.name;
    } else if (!G.garageOpen) prompt = "F — Exit · G — Garage · R — Radio";
    if (prompt) { ui["hud-prompt"].textContent = prompt; ui["hud-prompt"].classList.remove("hidden"); }
    else ui["hud-prompt"].classList.add("hidden");

    // bust meter
    if (G.bust > 0.02) {
      ui["hud-bust-wrap"].classList.remove("hidden");
      ui["hud-bust-fill"].style.width = (G.bust * 100) + "%";
    } else ui["hud-bust-wrap"].classList.add("hidden");

    // district name + minimap (throttled to every other frame)
    var fp = CK.Player.focusPos();
    ui["hud-district"].textContent = CK.World.districtAt(fp.x, fp.z);
    minimapTick++;
    if (minimapTick % 2 === 0) drawMinimap();

    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui["hud-toast"].classList.add("hidden"); }
    if (radioTimer > 0) { radioTimer -= dt; if (radioTimer <= 0) ui["radio-tag"].classList.add("hidden"); }
  };
})();
