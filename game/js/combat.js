// combat.js — fists, pistol and SMG behind the weapon wheel (hold Q, or
// 1/2/3). Hitscan shots with tracers and a muzzle flash; pedestrians and
// officers go down, cars take real damage, and every loud crime feeds the
// wanted system. Shooting is on foot — this is a driver's game, after all.
(function () {
  "use strict";
  var CK = window.CK;
  var C = (CK.Combat = {});
  C.WEAPONS = [
    { name: "FISTS", range: 2.6, dmg: 14, rate: 0.34, auto: false },
    { name: "PISTOL", range: 70, dmg: 34, rate: 0.27, auto: false },
    { name: "SMG", range: 60, dmg: 15, rate: 0.095, auto: true }
  ];
  var cooldown = 0, tracers = [], flash = null, flashLife = 0;

  C.selectWeapon = function (i) {
    if (i === CK.G.weapon) return;
    CK.G.weapon = i;
    CK.Audio.SFX.ui();
    if (CK.HUD) CK.HUD.refreshWeapon();
  };
  C.poseArms = function (armR, weapon) {
    if (weapon > 0) armR.rotation.x = -1.32; // arm up, gun level
  };

  function makeTracer(a, b, color) {
    var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color || 0xffe9a0, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    CK.World.scene.add(line);
    tracers.push({ line: line, life: 0.06 });
  }
  // police return fire visual: a tracer streaking in at the player
  C.tracerFrom = function (x, y, z) {
    var f = CK.Player.focusPos();
    makeTracer(new THREE.Vector3(x, y, z), new THREE.Vector3(f.x + CK.randRange(-1, 1), f.y + 1.2, f.z + CK.randRange(-1, 1)), 0xff9d8a);
  };

  function raySphere(o, d, c, r) {
    var ox = c.x - o.x, oy = c.y - o.y, oz = c.z - o.z;
    var t = ox * d.x + oy * d.y + oz * d.z;
    if (t < 0) return -1;
    var d2 = ox * ox + oy * oy + oz * oz - t * t;
    if (d2 > r * r) return -1;
    return t - Math.sqrt(r * r - d2);
  }

  function downPed(ped, byPlayer) {
    ped.down = true;
    ped.obj.rotation.x = -Math.PI / 2;
    ped.obj.position.y = CK.groundY(ped.obj.position.x, ped.obj.position.z) + 0.25;
    if (ped.inCar) { ped.inCar.driver = null; ped.inCar = null; }
    if (byPlayer) {
      if (ped.isCop) CK.Police.reportCrime("copDown", ped.obj.position.x, ped.obj.position.z, 1);
      else CK.Police.reportCrime("killPed", ped.obj.position.x, ped.obj.position.z, 1);
    }
  }
  C.downPed = downPed;

  function fire(dt) {
    var G = CK.G;
    var w = C.WEAPONS[G.weapon];
    cooldown -= dt;
    var wantFire = CK.mouse.down && (w.auto || !C._clicked);
    if (CK.mouse.down && !w.auto) C._clicked = true;
    if (!CK.mouse.down) C._clicked = false;
    if (!wantFire || cooldown > 0 || !G.onFoot || G.dialogue || G.garageOpen) return;
    if (G.weapon > 0) {
      if ((G.ammo[G.weapon] || 0) <= 0) { CK.Audio.SFX.dry(); cooldown = 0.3; return; }
      G.ammo[G.weapon]--;
    }
    cooldown = w.rate;
    var origin = new THREE.Vector3().copy(CK.Player.pos); origin.y += 1.45;
    var dir = new THREE.Vector3();
    CK.camera.getWorldDirection(dir);
    CK.Audio.SFX.shot(G.weapon === 2);
    if (G.weapon === 0) CK.Audio.SFX.hit();

    if (G.weapon === 0) {
      // fists: whoever is right in front of the avatar catches it
      var fx = Math.sin(CK.Player.avatar.rotation.y), fz = Math.cos(CK.Player.avatar.rotation.y);
      CK.peds.forEach(function (p) {
        if (p.down) return;
        var dx = p.obj.position.x - origin.x, dz = p.obj.position.z - origin.z;
        if (Math.sqrt(dx * dx + dz * dz) < w.range && dx * fx + dz * fz > 0) hurtPed(p, w.dmg, origin);
      });
      return;
    }
    // gunfire is LOUD: witnesses scatter, heat rises
    CK.Police.reportCrime("shot", origin.x, origin.z, 1);
    CK.fleePeds(origin.x, origin.z, 30);
    // muzzle flash sprite at the gun hand
    if (!flash) {
      flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffcf6b, transparent: true, opacity: 0.95, depthWrite: false }));
      CK.World.scene.add(flash);
    }
    flash.position.copy(origin).addScaledVector(dir, 0.7);
    flash.scale.set(0.55, 0.55, 1); flash.material.opacity = 0.95; flashLife = 0.045;

    // nearest hit among peds (body sphere) and cars (fat sphere)
    var bestT = w.range, hitPed = null, hitCar = null;
    CK.peds.forEach(function (p) {
      if (p.down || (p.inCar && p.inCar.driver === p)) return;
      var c = new THREE.Vector3(p.obj.position.x, p.obj.position.y + 1.05, p.obj.position.z);
      var t = raySphere(origin, dir, c, 0.62);
      if (t > 0 && t < bestT) { bestT = t; hitPed = p; hitCar = null; }
    });
    CK.vehicles.forEach(function (car) {
      if (car === G.inCar) return;
      var c = new THREE.Vector3(car.group.position.x, car.group.position.y + 0.8, car.group.position.z);
      var t = raySphere(origin, dir, c, 2.3);
      if (t > 0 && t < bestT) { bestT = t; hitCar = car; hitPed = null; }
    });
    var end = origin.clone().addScaledVector(dir, bestT);
    makeTracer(origin.clone().addScaledVector(dir, 0.7), end, 0xffe9a0);
    if (hitPed) hurtPed(hitPed, w.dmg, origin);
    else if (hitCar) {
      CK.Vehicles.damage(hitCar, w.dmg * 0.8);
      CK.Vehicles.puffAt(end.x, end.y, end.z, false);
      CK.Audio.SFX.hit();
      if (hitCar.kind === "cop") CK.Police.reportCrime("copHit", end.x, end.z, 1);
      if (hitCar.driver && CK.rand() < 0.4) hurtPed(hitCar.driver, w.dmg, origin); // through the windshield
    }
  }
  function hurtPed(ped, dmg, origin) {
    ped.hp -= dmg;
    CK.Audio.SFX.hit();
    if (ped.hp <= 0) downPed(ped, true);
    else {
      ped.flee = 4; ped.fleeFrom = { x: origin.x, z: origin.z };
      if (ped.isCop) CK.Police.reportCrime("copHit", ped.obj.position.x, ped.obj.position.z, 1);
      else CK.Police.reportCrime("hitPed", ped.obj.position.x, ped.obj.position.z, 1);
    }
  }

  C.update = function (dt) {
    fire(dt);
    for (var i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.06) * 0.9;
      if (tracers[i].life <= 0) { CK.World.scene.remove(tracers[i].line); tracers.splice(i, 1); }
    }
    if (flash && flashLife > 0) { flashLife -= dt; if (flashLife <= 0) flash.material.opacity = 0; }
    // number keys pick weapons directly
    if (CK.pressed("Digit1")) C.selectWeapon(0);
    if (CK.pressed("Digit2")) C.selectWeapon(1);
    if (CK.pressed("Digit3")) C.selectWeapon(2);
  };
})();
