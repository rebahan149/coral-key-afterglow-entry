// missions.js — the story of an outsider driver-for-hire climbing Coral
// Key's underworld: 8 jobs, unlocked in order as respect grows, each with
// dialogue cards (advance with E), a glowing gold objective marker, and a
// money payout. Stage types: goto / pickup (on foot) / deliver (by car) /
// steal (a marked car) / chase (disable a rival) / survive (hold ground) /
// passenger (collect a fare, then deliver).
(function () {
  "use strict";
  var CK = window.CK;
  var M = (CK.Missions = {});

  var DEFS = [
    { id: "dock", title: "Dock Pickup", giver: "Marla Venn", need: 0, pay: 250, respect: 12,
      where: { x: -272, z: -16 },
      intro: [["Marla Venn", "You came in on the morning ferry with nothing but a driver's licence and a smile. I can use both."],
              ["You", "I'm listening."],
              ["Marla Venn", "A sealed crate is sitting in Warehouse Two. No questions, no peeking. Walk it out and take it to my friend by the downtown palms."]],
      stages: [
        { type: "pickup", x: -296, z: -58, label: "Collect the sealed crate in Warehouse Two" },
        { type: "deliver", x: 72, z: 44, label: "Take the crate to Marla's contact downtown", anyMode: true }],
      outro: [["Marla Venn", "Clean work. The Key notices clean work."]] },
    { id: "smuggler", title: "Smuggler Run", giver: "Old Tomás", need: 10, pay: 400, respect: 12,
      where: { x: 278, z: 58 },
      intro: [["Old Tomás", "Forty years I have run this marina, and the bay still owes me favours. Tonight I collect."],
              ["Old Tomás", "Hot cargo waits at the docks. Load it, drive it up to the hill villa — and the clock, she is not your friend."]],
      stages: [
        { type: "deliver", x: -288, z: 30, label: "Load the hot cargo at the docks", car: true },
        { type: "deliver", x: -196, z: -292, label: "Deliver to the hill villa — fast!", car: true, timer: 150 }],
      outro: [["Old Tomás", "Ha! The bay provides."]] },
    { id: "chase", title: "Deco Strip Chase", giver: "Vex Marlowe", need: 22, pay: 500, respect: 14,
      where: { x: -120, z: 262 },
      intro: [["Vex Marlowe", "See that cream coupe rolling down Ocean Drive? Its driver owes me a car, a watch, and an apology."],
              ["Vex Marlowe", "You may keep the apology. Bring me the car — stopped. Ram it, shoot it, I don't care. Just stop it."]],
      stages: [{ type: "chase", x: 60, z: 240, label: "Stop Vex's rival driver on Ocean Drive" }],
      outro: [["Vex Marlowe", "Stopped. Beautifully stopped."]] },
    { id: "roadblock", title: "Roadblock Escape", giver: "Vex Marlowe", need: 34, pay: 650, respect: 14,
      where: { x: -120, z: 262 },
      intro: [["Vex Marlowe", "One more. A package, the marina, and every badge on the island already looking for you."],
              ["Vex Marlowe", "They will throw roadblocks at three stars, darling. Drive like the sunset depends on it."]],
      stages: [{ type: "deliver", x: 292, z: 120, label: "Deliver to the marina — wanted locked at 3★", car: true, lock: 3 }],
      outro: [["Vex Marlowe", "Through a roadblock. I adore you."]] },
    { id: "heist", title: "Marina Heist", giver: "Old Tomás", need: 46, pay: 800, respect: 16,
      where: { x: 278, z: 58 },
      intro: [["Old Tomás", "The red Sunset GT by the marina office — its owner cheats at cards and worse, at dominoes."],
              ["Old Tomás", "Take it. The badges will wake when you do, so be gone quickly. My cousin's lock-up at the docks will hide it."]],
      stages: [
        { type: "steal", x: 286, z: 152, label: "Steal the red Sunset GT at the marina", carType: "Sunset GT", carColor: 0xd94f43, heat: 2 },
        { type: "deliver", x: -268, z: 104, label: "Hide the GT in the docks lock-up", car: true }],
      outro: [["Old Tomás", "Justice, Coral Key style."]] },
    { id: "standoff", title: "Hill Villa Standoff", giver: "The Widow Aksa", need: 58, pay: 950, respect: 16,
      where: { x: -100, z: -292 },
      intro: [["The Widow Aksa", "My late husband's partners think this villa is theirs now. They are coming tonight to explain it with cars."],
              ["The Widow Aksa", "Stay on my grounds. Keep them off my lawn until my lawyer's boat lands. Survive, driver."]],
      stages: [{ type: "survive", x: -100, z: -300, radius: 42, time: 75, label: "Hold the villa grounds!" }],
      outro: [["The Widow Aksa", "The lawn survives. So do you."]] },
    { id: "heli", title: "Heli Escape", giver: "The Widow Aksa", need: 70, pay: 1200, respect: 18,
      where: { x: -100, z: -292 },
      intro: [["The Widow Aksa", "My nephew Niko has talked to the wrong people. He waits downtown, and the helicopter is already warming up."],
              ["The Widow Aksa", "Four stars, driver. All the way to the ferry. Get him out of my island."]],
      stages: [
        { type: "passenger", x: 24, z: -84, label: "Pick up Niko downtown", car: true },
        { type: "deliver", x: -312, z: 178, label: "Get Niko to the ferry dock — 4★!", car: true, lock: 4 }],
      outro: [["The Widow Aksa", "He sails. You stay. Interesting."]] },
    { id: "finale", title: "The Golden Hour", giver: "Marla Venn", need: 82, pay: 2000, respect: 20,
      where: { x: -272, z: -16 },
      intro: [["Marla Venn", "One last job, and it's the island's crown jewel: the gold convertible outside the Hotel Sol."],
              ["Marla Venn", "Take it to the ferry at sunset and it's yours — car, name, island. Everything. Just don't stop."]],
      stages: [
        { type: "steal", x: -40, z: 266, label: "Steal the GOLD convertible on Ocean Drive", carType: "Coral Cabrio", carColor: 0xf2b13c, heat: 3 },
        { type: "deliver", x: -312, z: 178, label: "Escape to the ferry dock!", car: true }],
      outro: [["Marla Venn", "Look at that sunset. You own the afterglow now."]] }
  ];
  M.DEFS = DEFS;

  // ---------- the gold marker ----------
  var marker, markerRing, markerGem;
  M.buildMarker = function (scene) {
    marker = new THREE.Group();
    var pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    pillar.position.y = 17; marker.add(pillar);
    markerRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.1, 26),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = 0.25; marker.add(markerRing);
    markerGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    markerGem.position.y = 4.4; marker.add(markerGem);
    marker.visible = false;
    scene.add(marker);
  };
  function showMarker(x, z) {
    CK.G.markerTarget = { x: x, z: z }; // the minimap's gold blip reads this
    if (!marker) return;
    marker.visible = true;
    marker.position.set(x, CK.groundY(x, z), z);
  }
  function hideMarker() { CK.G.markerTarget = null; if (marker) marker.visible = false; }

  // ---------- dialogue ----------
  M.say = function (lines, onDone) {
    CK.G.dialogue = { lines: lines, idx: 0, onDone: onDone || null };
    if (CK.HUD) CK.HUD.refreshDialogue();
  };
  function advanceDialogue() {
    var d = CK.G.dialogue;
    if (!d) return;
    CK.Audio.SFX.ui();
    d.idx++;
    if (d.idx >= d.lines.length) {
      CK.G.dialogue = null;
      if (CK.HUD) CK.HUD.refreshDialogue();
      if (d.onDone) d.onDone();
    } else if (CK.HUD) CK.HUD.refreshDialogue();
  }

  // ---------- mission runtime ----------
  function nextDef() {
    for (var i = 0; i < DEFS.length; i++) {
      if (CK.G.jobsDone.indexOf(DEFS[i].id) < 0) return DEFS[i];
    }
    return null;
  }
  M.nextDef = nextDef;

  function startMission(def) {
    var rt = { def: def, stage: 0, timer: null, rivals: [], targetCar: null, passengerPed: null, aboard: false, surviveLeft: 0 };
    CK.G.mission = rt;
    setupStage(rt);
    CK.HUD.toast("JOB STARTED: " + def.title);
    CK.Audio.SFX.pickup();
  }
  function setupStage(rt) {
    var st = rt.def.stages[rt.stage];
    rt.timer = st.timer || null;
    rt.surviveLeft = st.time || 0;
    if (st.lock) CK.Police.setLock(st.lock);
    if (st.type === "steal") {
      var car = CK.Vehicles.createCar({ kind: "parked", type: { name: st.carType, top: 44, accel: 21, convertible: st.carType === "Coral Cabrio" }, color: st.carColor });
      CK.Vehicles.place(car, st.x, st.z, Math.PI / 2);
      rt.targetCar = car;
    }
    if (st.type === "chase") {
      var rival = CK.Vehicles.createCar({ kind: "rival", color: 0xf2ede2, type: { name: "Rival Coupe", top: 33, accel: 16 } });
      CK.Vehicles.place(rival, st.x, st.z, Math.PI / 2);
      rival.health = 150; rival.maxHealth = 150;
      rt.rivals.push(rival); rt.targetCar = rival;
    }
    if (st.type === "survive") {
      for (var i = 0; i < 3; i++) {
        var r2 = CK.Vehicles.createCar({ kind: "rival", color: 0x2c3542, type: { name: "Rival Muscle", top: 36, accel: 18 } });
        var a = (i / 3) * Math.PI * 2;
        CK.Vehicles.place(r2, st.x + Math.sin(a) * 85, st.z + Math.cos(a) * 85, a);
        rt.rivals.push(r2);
      }
    }
    if (st.type === "passenger") {
      var ped = CK.makePed(st.x, st.z);
      ped.corners = [[st.x, st.z], [st.x, st.z], [st.x, st.z], [st.x, st.z]];
      ped.speed = 0;
      rt.passengerPed = ped;
    }
    refreshObjective(rt);
  }
  function refreshObjective(rt) {
    var st = rt.def.stages[rt.stage];
    CK.HUD.setObjective(rt.def.title, st.label, rt.timer);
    showMarker(st.x, st.z);
  }
  function cleanupStage(rt) {
    if (rt.def.stages[rt.stage].lock) CK.Police.clearLock();
    rt.rivals.forEach(function (r) {
      var i = CK.vehicles.indexOf(r); if (i >= 0) CK.vehicles.splice(i, 1);
      CK.World.scene.remove(r.group);
    });
    rt.rivals = [];
    if (rt.passengerPed && !rt.aboard) { /* fare keeps waiting by the kerb */ }
  }
  function failMission(rt, why) {
    cleanupStage(rt);
    CK.Police.clearLock();
    CK.G.mission = null;
    hideMarker();
    CK.HUD.setObjective(null);
    CK.HUD.toast("JOB FAILED — " + why);
    CK.Audio.SFX.fail();
  }
  function completeStage(rt) {
    cleanupStage(rt);
    rt.stage++;
    CK.Audio.SFX.success();
    if (rt.stage >= rt.def.stages.length) {
      var def = rt.def;
      CK.G.mission = null;
      hideMarker();
      CK.HUD.setObjective(null);
      CK.G.jobsDone.push(def.id);
      M.say(def.outro, function () {
        CK.G.money += def.pay;
        CK.G.respect = Math.min(100, CK.G.respect + def.respect);
        CK.Audio.SFX.cash();
        CK.HUD.toast("JOB DONE: +$" + def.pay + " · Respect " + CK.G.respect + "%");
        if (def.id === "finale") CK.HUD.toast("🏆 YOU OWN THE AFTERGLOW 🏆");
        CK.save();
      });
    } else setupStage(rt);
  }

  // ---------- rival drivers (chase quarry & standoff attackers) ----------
  function driveRival(r, dt, mode, target) {
    if (r.dead) return;
    var p = r.group.position;
    var tx = mode === "flee" ? p.x + (p.x - target.x) * 2 : target.x;
    var tz = mode === "flee" ? p.z + (p.z - target.z) * 2 : target.z;
    var want = Math.atan2(tx - p.x, tz - p.z);
    var diff = want - r.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    r.group.rotation.y += CK.clamp(diff, -2.1 * dt, 2.1 * dt);
    var top = mode === "flee" ? (r.health < 60 ? 15 : 27) : 30;
    var goal = Math.abs(diff) > 1.1 ? top * 0.35 : top;
    r.speed += CK.clamp(goal - r.speed, -22 * dt, 11 * dt);
    p.x += Math.sin(r.group.rotation.y) * r.speed * dt;
    p.z += Math.cos(r.group.rotation.y) * r.speed * dt;
    var fixed = CK.World.collideCircle(p.x, p.z, 1.7);
    if ((fixed.x !== p.x || fixed.z !== p.z) && Math.abs(r.speed) > 8) r.speed *= 0.4;
    p.x = fixed.x; p.z = fixed.z; p.y = CK.groundY(p.x, p.z);
    for (var w = 0; w < r.wheels.length; w++) r.wheels[w].rotation.x += r.speed * dt / 0.37;
    // contact with the player's car hurts both
    var G = CK.G;
    if (G.inCar && CK.dist2d(p.x, p.z, G.inCar.group.position.x, G.inCar.group.position.z) < 3.2 && Math.abs(r.speed) > 8) {
      CK.Vehicles.damage(G.inCar, 4); CK.Vehicles.damage(r, 3);
      r.speed *= 0.5; CK.Audio.SFX.crash(false);
    }
  }

  // ---------- per-frame ----------
  M.update = function (dt) {
    var G = CK.G;
    if (marker && marker.visible) {
      markerGem.rotation.y += dt * 2.4;
      markerGem.position.y = 4.4 + Math.sin(G.time * 2.2) * 0.5;
      var s = 1 + Math.sin(G.time * 3) * 0.12;
      markerRing.scale.set(s, s, 1);
    }
    if (G.dialogue) {
      if (CK.pressed("KeyE")) advanceDialogue();
      return;
    }
    if (G.photoMode) return; // staged scenes run their own script

    var rt = G.mission;
    if (!rt) {
      // offer the next job at its gold marker, respect permitting
      var def = nextDef();
      if (!def) { hideMarker(); CK.HUD.setObjective("CORAL KEY", "Every job is done. The island is yours — cruise the afterglow.", null); return; }
      if (G.respect < def.need) {
        hideMarker();
        CK.HUD.setObjective("CORAL KEY", "Next job — " + def.title + " — unlocks at " + def.need + "% respect (you: " + G.respect + "%)", null);
        return;
      }
      showMarker(def.where.x, def.where.z);
      CK.HUD.setObjective(def.title, "Meet " + def.giver + " at the gold marker", null);
      if (G.onFoot && CK.dist2d(CK.Player.pos.x, CK.Player.pos.z, def.where.x, def.where.z) < 3.8) {
        hideMarker();
        M.say(def.intro, function () { startMission(def); });
      }
      return;
    }

    var st = rt.def.stages[rt.stage];
    var fp = CK.Player.focusPos();
    // timers
    if (rt.timer != null) {
      rt.timer -= dt;
      CK.HUD.setObjective(rt.def.title, st.label, Math.max(0, rt.timer));
      if (rt.timer <= 0) { failMission(rt, "OUT OF TIME"); return; }
    }
    if (st.type === "goto" || st.type === "pickup" || st.type === "deliver") {
      if (st.type === "pickup" && !G.onFoot) { /* must be on foot */ }
      else if (st.car && !G.inCar) { /* must be driving */ }
      else if (CK.dist2d(fp.x, fp.z, st.x, st.z) < (st.car ? 7 : 4.6)) {
        if (st.type === "pickup") CK.Audio.SFX.pickup();
        completeStage(rt); return;
      }
      showMarker(st.x, st.z);
    } else if (st.type === "steal") {
      if (rt.targetCar) showMarker(rt.targetCar.group.position.x, rt.targetCar.group.position.z);
      if (G.inCar && G.inCar === rt.targetCar) {
        if (st.heat) { G.heat = Math.max(G.heat, st.heat + 0.2); CK.Police.reportCrime("theft", st.x, st.z, 1); }
        rt.targetCar = null;
        completeStage(rt); return;
      }
    } else if (st.type === "chase") {
      var rival = rt.targetCar;
      if (rival) {
        showMarker(rival.group.position.x, rival.group.position.z);
        driveRival(rival, dt, "flee", fp);
        CK.HUD.setObjective(rt.def.title, st.label + " — rival hull " + Math.max(0, Math.ceil(rival.health / rival.maxHealth * 100)) + "%", null);
        if (rival.dead || rival.health <= 30) { rt.targetCar = null; completeStage(rt); return; }
      }
    } else if (st.type === "survive") {
      rt.rivals.forEach(function (r) { driveRival(r, dt, "attack", fp); });
      if (CK.dist2d(fp.x, fp.z, st.x, st.z) < (st.radius || 40)) {
        rt.surviveLeft -= dt;
        CK.HUD.setObjective(rt.def.title, st.label, Math.max(0, rt.surviveLeft));
      } else {
        CK.HUD.setObjective(rt.def.title, "GET BACK TO THE VILLA GROUNDS!", Math.max(0, rt.surviveLeft));
      }
      showMarker(st.x, st.z);
      if (rt.surviveLeft <= 0) { completeStage(rt); return; }
    } else if (st.type === "passenger") {
      showMarker(st.x, st.z);
      if (G.inCar && CK.dist2d(fp.x, fp.z, st.x, st.z) < 7) {
        if (rt.passengerPed) { rt.passengerPed.obj.visible = false; rt.aboard = true; }
        CK.HUD.toast("Niko: “Drive like you mean it!”");
        completeStage(rt); return;
      }
    }
  };
})();
