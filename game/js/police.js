// police.js — Coral Key PD. A fractional heat value sits behind the 0–5
// star display: witnessed crimes add heat, heat cools while nobody in
// uniform can see you. Cop cars spawn scaled by stars and pursue to ram;
// from 3 stars they throw roadblocks across your road; from 4 stars a
// helicopter joins with a searchlight and officers open fire. Cornered on
// foot, the bust meter fills.
(function () {
  "use strict";
  var CK = window.CK;
  var Po = (CK.Police = {});
  var cops = (CK.copCars = []);
  var officers = [];
  var roadblocks = [];
  var heli = null, heliLight = null, spawnTimer = 0, blockTimer = 14, sirenTimer = 0, shotTimer = 0;

  var CRIME_HEAT = { shot: 0.55, hitPed: 0.9, killPed: 1.6, jack: 1.0, crash: 0.22, copHit: 1.4, copDown: 2.2, theft: 0.8 };
  Po.reportCrime = function (kind, x, z, scale) {
    var G = CK.G;
    if (G.state !== "playing") return;
    // a crime only heats up if someone could plausibly witness it
    var witnessed = cops.length > 0 || officers.length > 0;
    if (!witnessed) {
      for (var i = 0; i < CK.peds.length && !witnessed; i++) {
        var p = CK.peds[i];
        if (!p.down && CK.dist2d(p.obj.position.x, p.obj.position.z, x, z) < 46) witnessed = true;
      }
    }
    if (!witnessed && kind !== "copDown" && kind !== "copHit") return;
    G.heat += (CRIME_HEAT[kind] || 0.4) * (scale || 1);
    G.heat = Math.min(G.heat, 5.6);
    G.seenTimer = 0;
  };
  Po.setLock = function (n) { CK.G.lockWanted = n; if (n > 0) CK.G.heat = Math.max(CK.G.heat, n); };
  Po.clearLock = function () { CK.G.lockWanted = 0; };
  Po.stars = function () {
    var G = CK.G;
    return Math.max(G.lockWanted, CK.clamp(Math.floor(G.heat + 0.001), 0, 5));
  };

  function spawnCop(at) {
    var focus = CK.Player.focusPos();
    var ang = CK.rand() * Math.PI * 2, dist = CK.randRange(72, 92);
    var x = at ? at.x : CK.clamp(focus.x + Math.sin(ang) * dist, -320, 320);
    var z = at ? at.z : CK.clamp(focus.z + Math.cos(ang) * dist, -320, 320);
    // snap onto the nearest road so they arrive driving, not through a wall
    if (Math.abs(x - CK.Vehicles.nearestRoad(x)) < Math.abs(z - CK.Vehicles.nearestRoad(z))) x = CK.Vehicles.nearestRoad(x);
    else z = CK.Vehicles.nearestRoad(z);
    var car = CK.Vehicles.createCar({ kind: "cop", police: true, color: 0xf2f2f2, type: { name: "CKPD Interceptor", top: 40, accel: 19 } });
    CK.Vehicles.place(car, x, z, CK.rand() * Math.PI * 2);
    car.cruise = 40;
    cops.push(car);
    return car;
  }
  // deterministic placement (photo-mode staging, roadblock reinforcements)
  Po.spawnCopAt = function (x, z) { return spawnCop({ x: x, z: z }); };
  function removeCop(car) {
    var i = cops.indexOf(car); if (i >= 0) cops.splice(i, 1);
    var j = CK.vehicles.indexOf(car); if (j >= 0) CK.vehicles.splice(j, 1);
    CK.World.scene.remove(car.group);
  }
  Po.despawnAll = function () {
    while (cops.length) removeCop(cops[0]);
    officers.forEach(function (o) { CK.World.scene.remove(o.obj); var i = CK.peds.indexOf(o); if (i >= 0) CK.peds.splice(i, 1); });
    officers = [];
    clearRoadblocks();
    if (heli) { CK.World.scene.remove(heli); heli = null; }
  };

  // ---------- roadblocks ----------
  function spawnRoadblock() {
    var G = CK.G;
    if (!G.inCar) return;
    var car = G.inCar, p = car.group.position;
    var fx = Math.sin(car.group.rotation.y), fz = Math.cos(car.group.rotation.y);
    var bx = p.x + fx * 78, bz = p.z + fz * 78;
    if (Math.abs(bx) > 322 || Math.abs(bz) > 322) return;
    // align the block across whichever road runs here
    var horiz = Math.abs(fx) > Math.abs(fz);
    if (horiz) bz = CK.Vehicles.nearestRoad(bz); else bx = CK.Vehicles.nearestRoad(bx);
    var rb = { x: bx, z: bz, cars: [], barriers: [], colliders: [] };
    [-4.4, 4.4].forEach(function (off) {
      var c = CK.Vehicles.createCar({ kind: "cop", police: true, color: 0xf2f2f2, type: { name: "CKPD Interceptor", top: 40, accel: 19 } });
      CK.Vehicles.place(c, horiz ? bx : bx + off, horiz ? bz + off : bz, horiz ? 0 : Math.PI / 2);
      c.roadblock = true; cops.push(c); rb.cars.push(c);
    });
    for (var i = -1; i <= 1; i++) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1.2 : 5.4, 1.0, horiz ? 5.4 : 1.2),
        new THREE.MeshLambertMaterial({ color: 0xff7d3c }));
      b.position.set(horiz ? bx : bx + i * 5.2, CK.groundY(bx, bz) + 0.5, horiz ? bz + i * 5.2 : bz);
      b.castShadow = true;
      CK.World.scene.add(b); rb.barriers.push(b);
      var col = { minX: b.position.x - (horiz ? 0.6 : 2.7), maxX: b.position.x + (horiz ? 0.6 : 2.7), minZ: b.position.z - (horiz ? 2.7 : 0.6), maxZ: b.position.z + (horiz ? 2.7 : 0.6) };
      CK.World.colliders.push(col); rb.colliders.push(col);
    }
    roadblocks.push(rb);
  }
  function clearRoadblocks() {
    roadblocks.forEach(function (rb) {
      rb.barriers.forEach(function (b) { CK.World.scene.remove(b); });
      rb.colliders.forEach(function (c) {
        var i = CK.World.colliders.indexOf(c); if (i >= 0) CK.World.colliders.splice(i, 1);
      });
    });
    roadblocks = [];
  }

  // ---------- helicopter ----------
  function buildHeli() {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x2c3542 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 4.6), bodyMat); g.add(body);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), bodyMat); tail.position.set(0, 0.3, -4.2); g.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.08, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.25; g.add(rotor); g.userData.rotor = rotor;
    var glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.4), new THREE.MeshBasicMaterial({ color: 0x9fd4de }));
    glass.position.set(0, 0.15, 1.9); g.add(glass);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(6.5, 30, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = -15.5; g.add(cone);
    heliLight = new THREE.SpotLight(0xffe9b0, 2.2, 70, 0.5, 0.5);
    heliLight.position.set(0, -1, 0);
    g.add(heliLight); g.add(heliLight.target);
    heliLight.target.position.set(0, -30, 0);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    CK.World.scene.add(g);
    return g;
  }

  // ---------- damage to the player ----------
  function damagePlayer(amt) {
    var G = CK.G;
    if (G.invulnTimer > 0 || G.state !== "playing") return;
    if (G.inCar && CK.rand() < 0.65) { CK.Vehicles.damage(G.inCar, amt * 1.6); return; }
    G.health -= amt;
    CK.HUD.flashHealth();
    if (G.health <= 0) { G.health = 0; CK.HUD.showEnd("wasted"); }
  }
  Po.damagePlayer = damagePlayer;

  // ---------- officers on foot ----------
  function ejectOfficers(car) {
    for (var i = 0; i < 2; i++) {
      var o = CK.makePed(car.group.position.x + (i ? 2 : -2), car.group.position.z + 1);
      o.isCop = true; o.hp = 60; o.speed = 4.9;
      o.obj.children[0].material = new THREE.MeshLambertMaterial({ color: 0x24365e }); // CKPD navy
      o.corners = [[0, 0], [0, 0], [0, 0], [0, 0]]; // they chase, not stroll
      officers.push(o);
    }
    car.officersOut = true;
  }
  function updateOfficers(dt) {
    var G = CK.G, fp = CK.Player.focusPos();
    for (var i = officers.length - 1; i >= 0; i--) {
      var o = officers[i];
      if (o.down) continue;
      var d = CK.dist2d(o.obj.position.x, o.obj.position.z, fp.x, fp.z);
      if (d > 170) { CK.World.scene.remove(o.obj); var k = CK.peds.indexOf(o); if (k >= 0) CK.peds.splice(k, 1); officers.splice(i, 1); continue; }
      // chase: keep the ped's walk target glued to the player
      o.corners = [[fp.x, fp.z], [fp.x, fp.z], [fp.x, fp.z], [fp.x, fp.z]];
      o.speed = d > 3 ? 5.1 : 0;
      if (d < 2.0 && G.onFoot) G.bust += dt / 1.6;
    }
  }

  // ---------- main update ----------
  Po.update = function (dt) {
    var G = CK.G;
    var stars = Po.stars();
    G.wanted = stars;
    var focus = CK.Player.focusPos();

    // heat bookkeeping: being seen resets the cool-down
    var seen = false;
    cops.forEach(function (c) { if (CK.dist2d(c.group.position.x, c.group.position.z, focus.x, focus.z) < 52) seen = true; });
    if (heli) seen = true;
    if (seen) G.seenTimer = 0; else G.seenTimer += dt;
    if (G.lockWanted === 0 && G.seenTimer > 5 && stars > 0) {
      G.heat = Math.max(0, G.heat - dt * 0.055);
      if (G.heat < 0.02 && stars <= 1) G.heat = 0;
    }

    // fleet size follows the stars
    var want = stars === 0 ? 0 : Math.min(2 + stars, 6);
    var active = cops.filter(function (c) { return !c.roadblock; }).length;
    spawnTimer -= dt;
    if (active < want && spawnTimer <= 0) { spawnCop(); spawnTimer = 1.6; }
    if (stars === 0 && cops.length) {
      // heat is gone: units peel off and despawn with distance
      for (var i = cops.length - 1; i >= 0; i--) {
        var cp = cops[i];
        if (CK.dist2d(cp.group.position.x, cp.group.position.z, focus.x, focus.z) > 60) removeCop(cp);
      }
      clearRoadblocks();
    }

    // pursuit driving
    cops.forEach(function (car) {
      if (car.dead || car.roadblock) return;
      var p = car.group.position;
      var d = CK.dist2d(p.x, p.z, focus.x, focus.z);
      if (d > 190) { removeCop(car); return; }
      var tx = focus.x, tz = focus.z;
      if (G.inCar) { tx += Math.sin(G.inCar.group.rotation.y) * G.inCar.speed * 0.35; tz += Math.cos(G.inCar.group.rotation.y) * G.inCar.speed * 0.35; }
      var wantYaw = Math.atan2(tx - p.x, tz - p.z);
      var diff = wantYaw - car.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.group.rotation.y += CK.clamp(diff, -2.5 * dt, 2.5 * dt);
      var stopAt = G.onFoot ? 5.5 : 0;
      var goal = d > stopAt ? Math.min(car.topSpeed, 26 + stars * 3.4) : 0;
      if (Math.abs(diff) > 1.2) goal *= 0.4;
      car.speed += CK.clamp(goal - car.speed, -26 * dt, 13 * dt);
      p.x += Math.sin(car.group.rotation.y) * car.speed * dt;
      p.z += Math.cos(car.group.rotation.y) * car.speed * dt;
      var fixed = CK.World.collideCircle(p.x, p.z, 1.7);
      if ((fixed.x !== p.x || fixed.z !== p.z) && Math.abs(car.speed) > 8) { CK.Vehicles.damage(car, 4); car.speed *= 0.4; }
      p.x = fixed.x; p.z = fixed.z; p.y = CK.groundY(p.x, p.z);
      for (var w = 0; w < car.wheels.length; w++) car.wheels[w].rotation.x += car.speed * dt / 0.37;
      // ramming the player costs both sides
      if (G.inCar && CK.dist2d(p.x, p.z, G.inCar.group.position.x, G.inCar.group.position.z) < 3.2 && Math.abs(car.speed) > 9) {
        CK.Vehicles.damage(G.inCar, 5); car.speed *= 0.5;
        CK.Audio.SFX.crash(true);
      }
      // officers pile out when they corner you on foot
      if (G.onFoot && d < 8 && Math.abs(car.speed) < 1.2 && !car.officersOut) ejectOfficers(car);
      if (!G.onFoot) car.officersOut = false;
    });

    // bust meter: cornered on foot with units close
    if (G.onFoot && stars > 0) {
      var near = false;
      cops.forEach(function (c) { if (CK.dist2d(c.group.position.x, c.group.position.z, focus.x, focus.z) < 7.5) near = true; });
      if (near) G.bust += dt / 2.4;
      else if (officers.length === 0) G.bust = Math.max(0, G.bust - dt * 0.5);
      if (G.bust >= 1) { G.bust = 0; CK.HUD.showEnd("busted"); }
    } else G.bust = Math.max(0, G.bust - dt * 0.6);
    updateOfficers(dt);

    // roadblocks from 3 stars
    if (stars >= 3 && G.inCar) {
      blockTimer -= dt;
      if (blockTimer <= 0 && roadblocks.length < 2) { spawnRoadblock(); blockTimer = 26; }
    }
    for (var r = roadblocks.length - 1; r >= 0; r--) {
      var rb = roadblocks[r];
      if (CK.dist2d(rb.x, rb.z, focus.x, focus.z) > 150) {
        rb.cars.forEach(function (c) { removeCop(c); });
        rb.barriers.forEach(function (b) { CK.World.scene.remove(b); });
        rb.colliders.forEach(function (c) { var i = CK.World.colliders.indexOf(c); if (i >= 0) CK.World.colliders.splice(i, 1); });
        roadblocks.splice(r, 1);
      }
    }

    // helicopter from 4 stars
    if (stars >= 4) {
      if (!heli) heli = buildHeli();
      var hx = focus.x + Math.sin(G.time * 0.24) * 13, hz = focus.z + Math.cos(G.time * 0.31) * 13;
      heli.position.x = CK.lerp(heli.position.x || hx, hx, 0.03);
      heli.position.z = CK.lerp(heli.position.z || hz, hz, 0.03);
      var heliH = G.photoMode === "chase" ? 15 : 27; // lower for the photo scene so it frames
      heli.position.y = CK.groundY(focus.x, focus.z) + heliH + Math.sin(G.time * 0.9) * 1.6;
      heli.rotation.y = Math.atan2(focus.x - heli.position.x, focus.z - heli.position.z);
      heli.userData.rotor.rotation.y += dt * 28;
      heli.visible = true;
    } else if (heli) heli.visible = false;

    // police gunfire at 4+ stars: heli and officers take pot-shots
    if (stars >= 4) {
      shotTimer -= dt;
      if (shotTimer <= 0) {
        shotTimer = CK.randRange(0.5, 1.1);
        var shooterNear = !!heli;
        officers.forEach(function (o) { if (!o.down && CK.dist2d(o.obj.position.x, o.obj.position.z, focus.x, focus.z) < 30) shooterNear = true; });
        if (shooterNear) {
          CK.Audio.SFX.shot(false);
          if (CK.rand() < 0.55) damagePlayer(CK.randRange(3, 8));
          CK.Combat && CK.Combat.tracerFrom(focus.x + CK.randRange(-14, 14), focus.y + CK.randRange(6, 22), focus.z + CK.randRange(-14, 14));
        }
      }
    }

    // sirens when units are close
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 2.6;
      if (cops.some(function (c) { return CK.dist2d(c.group.position.x, c.group.position.z, focus.x, focus.z) < 55; })) CK.Audio.SFX.siren();
    }
  };
})();
