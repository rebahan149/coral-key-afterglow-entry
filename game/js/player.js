// player.js — the driver-for-hire in person: a stylised on-foot avatar with
// a walk cycle, WASD movement relative to the camera, sprint and jump,
// building collision, entering/exiting cars (including carjacking a traffic
// driver, who bails and flees), and the smoothed third-person camera that
// follows on foot and in a car. Camera orbit uses pointer-lock mouse look.
(function () {
  "use strict";
  var CK = window.CK;
  var P = (CK.Player = {});
  var avatar, legL, legR, armL, armR, velY = 0, walkPhase = 0;
  var camYaw = Math.PI, camPitch = 0.32, camPos = new THREE.Vector3(-316, 4, 196);
  P.pos = new THREE.Vector3(-316, 0, 178); // steps off the ferry

  P.build = function (scene) {
    var g = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xff7d5a }); // coral jacket
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    var denim = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), jacket); torso.position.y = 1.08; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin); head.position.y = 1.72; g.add(head);
    var shades = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.1), new THREE.MeshBasicMaterial({ color: 0x14181f }));
    shades.position.set(0, 1.76, 0.18); g.add(shades);
    legL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.7, 0.25), denim); legL.position.set(-0.17, 0.35, 0); g.add(legL);
    legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
    armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.2), jacket); armL.position.set(-0.44, 1.1, 0); g.add(armL);
    armR = armL.clone(); armR.position.x = 0.44; g.add(armR);
    // pivot arms/legs at the top so swings look like swings
    [legL, legR].forEach(function (l) { l.geometry = l.geometry.clone(); l.geometry.translate(0, -0.35, 0); l.position.y = 0.7; });
    [armL, armR].forEach(function (a) { a.geometry = a.geometry.clone(); a.geometry.translate(0, -0.3, 0); a.position.y = 1.42; });
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    avatar = g;
    avatar.position.copy(P.pos);
    scene.add(avatar);
    P.avatar = avatar;
  };

  P.nearestCar = function (maxD) {
    var best = null, bd = maxD || 4.2;
    for (var i = 0; i < CK.vehicles.length; i++) {
      var c = CK.vehicles[i];
      var d = CK.dist2d(P.pos.x, P.pos.z, c.group.position.x, c.group.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };

  P.enterCar = function (car) {
    var G = CK.G;
    if (car.driver) { // carjacking: the driver bails and runs, PD notices
      var d = car.driver; car.driver = null; d.inCar = null;
      d.obj.visible = true;
      d.obj.position.set(car.group.position.x + 2.2, 0, car.group.position.z + 1);
      d.flee = 6; d.fleeFrom = { x: P.pos.x, z: P.pos.z };
      CK.Police.reportCrime("jack", P.pos.x, P.pos.z, 1);
      CK.HUD.toast("CARJACKED!");
    }
    if (car.kind === "traffic") car.kind = "parked"; // now it's yours
    G.inCar = car; G.onFoot = false;
    avatar.visible = false;
    CK.Audio.SFX.door();
    CK.Audio.engineStart();
    CK.Audio.setRadio(true);
    // apply garage paint if this car was sprayed before
    if (car.savedPaint != null) car.paintMat.color.setHex(car.savedPaint);
    CK.HUD.toast(car.type.name);
  };
  P.exitCar = function () {
    var G = CK.G, car = G.inCar;
    if (!car) return;
    var p = car.group.position;
    var side = { x: Math.cos(car.group.rotation.y), z: -Math.sin(car.group.rotation.y) };
    P.pos.set(p.x - side.x * 2.4, 0, p.z - side.z * 2.4);
    var fixed = CK.World.collideCircle(P.pos.x, P.pos.z, 0.5);
    P.pos.x = fixed.x; P.pos.z = fixed.z;
    P.pos.y = CK.groundY(P.pos.x, P.pos.z);
    car.speed = 0; car.velX = 0; car.velZ = 0;
    G.inCar = null; G.onFoot = true;
    avatar.visible = true;
    avatar.position.copy(P.pos);
    CK.Audio.SFX.door();
    CK.Audio.engineStop();
    CK.Audio.setRadio(false);
    if (G.garageOpen) CK.HUD.closeGarage();
  };
  P.onCarWrecked = function () {
    CK.HUD.toast("WRECKED!");
    P.exitCar();
  };
  P.teleport = function (x, z) {
    P.pos.set(x, CK.groundY(x, z), z);
    if (avatar) avatar.position.copy(P.pos);
  };
  P.focusPos = function () { // where the world should look at the player
    return CK.G.inCar ? CK.G.inCar.group.position : P.pos;
  };

  P.update = function (dt) {
    var G = CK.G;
    // camera orbit from mouse, whether on foot or driving
    camYaw -= CK.mouse.dx * 0.0032;
    camPitch = CK.clamp(camPitch + CK.mouse.dy * 0.0026, -0.12, 1.05);
    CK.mouse.dx = 0; CK.mouse.dy = 0;

    if (G.onFoot && !G.dialogue) {
      var fwd = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
      var rgt = { x: -fwd.z, z: fwd.x };
      var mx = 0, mz = 0;
      if (CK.key("KeyW") || CK.key("ArrowUp")) { mx += fwd.x; mz += fwd.z; }
      if (CK.key("KeyS") || CK.key("ArrowDown")) { mx -= fwd.x; mz -= fwd.z; }
      if (CK.key("KeyA") || CK.key("ArrowLeft")) { mx -= rgt.x; mz -= rgt.z; }
      if (CK.key("KeyD") || CK.key("ArrowRight")) { mx += rgt.x; mz += rgt.z; }
      var ml = Math.sqrt(mx * mx + mz * mz);
      var sprint = CK.key("ShiftLeft") || CK.key("ShiftRight");
      var speed = sprint ? 8.4 : 4.6;
      if (ml > 0.01) {
        mx /= ml; mz /= ml;
        P.pos.x += mx * speed * dt; P.pos.z += mz * speed * dt;
        avatar.rotation.y = CK.angleLerp(avatar.rotation.y, Math.atan2(mx, mz), 0.22);
        walkPhase += dt * (sprint ? 13 : 9);
      } else walkPhase = CK.lerp(walkPhase, Math.round(walkPhase / Math.PI) * Math.PI, 0.3);
      // jump & gravity
      var gy = CK.groundY(P.pos.x, P.pos.z);
      if ((CK.pressed("Space")) && P.pos.y <= gy + 0.02) velY = 5.4;
      velY -= 15 * dt;
      P.pos.y += velY * dt;
      if (P.pos.y < gy) { P.pos.y = gy; velY = 0; }
      var fixed = CK.World.collideCircle(P.pos.x, P.pos.z, 0.5);
      P.pos.x = fixed.x; P.pos.z = fixed.z;
      avatar.position.copy(P.pos);
      var sw = Math.sin(walkPhase) * (ml > 0.01 ? 0.55 : 0);
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
      // weapon in hand
      if (CK.Combat) CK.Combat.poseArms(armR, G.weapon);
    }

    if (CK.pressed("KeyF")) {
      if (G.onFoot) { var c = P.nearestCar(4.4); if (c && !c.dead) P.enterCar(c); }
      else P.exitCar();
    }
    updateCamera(dt);
  };

  function updateCamera(dt) {
    var G = CK.G;
    var focus = P.focusPos();
    var dist = G.inCar ? 10.5 : 6.4;
    var height = G.inCar ? 3.6 : 2.6;
    // in a car, ease the camera behind the direction of travel when moving
    // (photo mode keeps its staged camera angle instead)
    if (G.inCar && Math.abs(G.inCar.speed) > 6 && !CK.mouse.locked && !G.photoMode) {
      var behind = G.inCar.group.rotation.y + Math.PI;
      camYaw = CK.angleLerp(camYaw, behind, 0.02);
    }
    var cx = focus.x + Math.sin(camYaw) * Math.cos(camPitch) * dist;
    var cz = focus.z + Math.cos(camYaw) * Math.cos(camPitch) * dist;
    var cy = focus.y + height + Math.sin(camPitch) * dist * 0.7;
    var fixed = CK.World.collideCircle(cx, cz, 0.4);
    camPos.x = CK.lerp(camPos.x, fixed.x, 1 - Math.pow(0.0001, dt));
    camPos.z = CK.lerp(camPos.z, fixed.z, 1 - Math.pow(0.0001, dt));
    camPos.y = CK.lerp(camPos.y, Math.max(cy, CK.groundY(cx, cz) + 1.1), 1 - Math.pow(0.0001, dt));
    CK.camera.position.copy(camPos);
    CK.camera.lookAt(focus.x, focus.y + 1.6, focus.z);
  }
  P.setCamYaw = function (v) { camYaw = v; };
})();
