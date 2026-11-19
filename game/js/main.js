// main.js — boot and the game loop. Builds the renderer, world, player,
// traffic and HUD; owns the top-level state flow (start / resume / restart
// / respawn); and implements PHOTO MODE: opening the game with a URL hash
// like #shot=cover|chase|marina|garage autostarts into a staged, living
// scene (no start screen, no pointer lock) for taking pictures.
(function () {
  "use strict";
  var CK = window.CK;
  var G = CK.G;

  // surface script errors on the page itself — invaluable when headless
  window.addEventListener("error", function (e) {
    var box = document.getElementById("errbox");
    if (box) { box.classList.remove("hidden"); box.textContent += (e.message || e.type) + "\n"; }
  });

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("canvas-holder").appendChild(renderer.domElement);
  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3200);
  CK.camera = camera;
  var scene = CK.World.build(renderer);
  CK.Player.build(scene);
  CK.Vehicles.spawnWorldCars();
  CK.Missions.buildMarker(scene);
  CK.HUD.init();
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  renderer.domElement.addEventListener("click", function () {
    CK.Audio.init();
    if (G.state === "playing" && !G.garageOpen && !G.photoMode && !CK.mouse.locked) {
      renderer.domElement.requestPointerLock();
    }
  });

  // ---------- top-level flow (wired to HUD buttons) ----------
  CK.startGame = function (fromSave) {
    CK.Audio.init();
    if (fromSave) CK.loadSave();
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
    G.state = "playing"; G.started = true;
    if (G.photoMode) setupPhoto();
    else CK.HUD.toast("Welcome to Coral Key 🌴");
  };
  CK.resumeGame = function () {
    if (G.state !== "paused") return;
    document.getElementById("pause-screen").classList.add("hidden");
    G.state = "playing";
  };
  CK.respawn = function () {
    document.getElementById("end-screen").classList.add("hidden");
    document.getElementById("pause-screen").classList.add("hidden");
    G.health = 100; G.heat = 0; G.bust = 0; G.seenTimer = 0;
    CK.Police.clearLock();
    CK.Police.despawnAll();
    if (G.inCar) CK.Player.exitCar();
    CK.Player.teleport(-316, 178);
    G.state = "playing";
  };
  CK.restartDay = function () { CK.respawn(); CK.HUD.toast("A new golden hour begins."); };

  // ---------- photo mode ----------
  function photoHash() {
    var m = /#shot=(cover|chase|marina|garage)/.exec(window.location.hash || "");
    return m ? m[1] : null;
  }
  function setupPhoto() {
    G.money = 2450; G.respect = 64;
    var car = G.starterCar;
    if (G.photoMode === "cover") {
      CK.Vehicles.place(car, -170, 235.8, Math.PI / 2); // eastbound on Ocean Drive
      CK.Player.enterCar(car);
      CK.Player.setCamYaw(-Math.PI / 2);
      CK.HUD.setObjective("Deco Strip Chase", "Cruise Ocean Drive — the neon is waking up", null);
    } else if (G.photoMode === "chase") {
      CK.Vehicles.place(car, 124.2, -40, 0); // on the x=120 lane, PD incoming
      CK.Player.enterCar(car);
      CK.Player.setCamYaw(-0.6); // front three-quarter camera: pursuers stay in frame
      CK.Police.spawnCopAt(119, -82);
      CK.Police.spawnCopAt(130, -94);
      G.weapon = 2; CK.HUD.refreshWeapon();
      G.heat = 4.4; G.seenTimer = 0;
      CK.HUD.setObjective("Heli Escape", "Shake the CKPD — wanted 4★, helicopter up!", null);
      CK.HUD.toast("🚁 CKPD AIR UNIT OVERHEAD");
    } else if (G.photoMode === "marina") {
      CK.Player.teleport(310, 149); // apron between two piers, yachts ahead
      CK.Player.avatar.rotation.y = Math.PI / 2; // face the yachts
      CK.Player.setCamYaw(-Math.PI / 2);
      CK.Missions.say([
        ["Old Tomás", "Forty years I have run this marina, and the bay still owes me favours."],
        ["You", "Name the job, Tomás."],
        ["Old Tomás", "Tonight, driver… tonight we collect."]
      ], null);
    } else if (G.photoMode === "garage") {
      CK.Vehicles.place(car, 26, 100, 0.5);
      CK.Player.enterCar(car);
      CK.Player.setCamYaw(0.7);
      CK.HUD.openGarage();
    }
  }
  function photoDrive(dt) {
    var car = G.inCar;
    if (!car) return;
    var speed = G.photoMode === "chase" ? 13 : 16; // chase runs slower so the PD stays framed
    car.speed = speed;
    var p = car.group.position;
    p.x += Math.sin(car.group.rotation.y) * speed * dt;
    p.z += Math.cos(car.group.rotation.y) * speed * dt;
    p.y = CK.groundY(p.x, p.z);
    for (var i = 0; i < car.wheels.length; i++) car.wheels[i].rotation.x += speed * dt / 0.37;
    var lim = G.photoMode === "chase" ? 205 : 252;
    if (p.x > lim) p.x = -lim;
    if (p.z > lim) p.z = -lim;
    CK.Audio.engineUpdate(0.55, true);
  }

  // ---------- menu backdrop camera ----------
  function menuCamera() {
    var t = G.time * 0.045;
    camera.position.set(Math.sin(t) * 150, 30 + Math.sin(G.time * 0.13) * 5, 235 + Math.cos(t) * 60);
    camera.lookAt(0, 6, 190);
  }

  // ---------- the loop ----------
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (G.state === "playing" || G.state === "menu") {
      G.time += dt;
      CK.World.update(dt);
      CK.Vehicles.update(dt);
    }
    if (G.state === "playing") {
      // only the driving scenes roll; marina/garage scenes hold their pose
      if (G.photoMode === "cover" || G.photoMode === "chase") photoDrive(dt);
      else if (!G.photoMode && G.inCar && !G.garageOpen && !G.dialogue) CK.Vehicles.drivePlayer(G.inCar, dt);
      CK.Player.update(dt);
      CK.Police.update(dt);
      CK.Combat.update(dt);
      CK.Missions.update(dt);
    } else if (G.state === "menu") menuCamera();
    CK.HUD.update(dt);
    renderer.render(scene, camera);
    CK.clearPressed();
  }

  G.photoMode = photoHash();
  if (G.photoMode) CK.startGame(false);
  requestAnimationFrame(frame);
})();
