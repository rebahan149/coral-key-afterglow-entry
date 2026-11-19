// vehicles.js — the car factory (stylised box cars, convertibles, and the
// Coral Key PD variant with a lightbar), parked cars, traffic AI that drives
// the road grid on proper lanes with intersection turns, arcade player
// driving with handbrake drift, and damage with smoke.
(function () {
  "use strict";
  var CK = window.CK;
  var V = (CK.Vehicles = {});
  var cars = (CK.vehicles = []);
  var smokeTex = null, puffs = [];

  var CAR_TYPES = [
    { name: "Palmetto Coupe", top: 34, accel: 15 },
    { name: "Coral Cabrio", top: 36, accel: 16, convertible: true },
    { name: "Dune Buggy", top: 30, accel: 17 },
    { name: "Island Sedan", top: 31, accel: 13 },
    { name: "Sunset GT", top: 44, accel: 21 },
    { name: "Reef Runner Van", top: 27, accel: 12 }
  ];
  var PAINTS = [0xd94f43, 0x3f7fbf, 0xf2b13c, 0x37b8a2, 0xf2ede2, 0x8a5fb0, 0x2c3542, 0xff7fab, 0x71c837, 0xff8c1a];
  V.PAINTS = PAINTS;
  V.PAINT_NAMES = ["Coral Red", "Lagoon Blue", "Taxi Amber", "Reef Teal", "Pearl White", "Violet Dusk", "Midnight", "Flamingo", "Palm Green", "Sunset Orange"];

  function softCircle() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(200,200,200,.85)"); grad.addColorStop(1, "rgba(200,200,200,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  var glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a3d });
  var tyreMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
  var chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
  var wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);

  V.createCar = function (opts) {
    opts = opts || {};
    var type = opts.type || CK.pick(CAR_TYPES);
    var paint = new THREE.MeshLambertMaterial({ color: opts.color != null ? opts.color : CK.pick(PAINTS) });
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.58, 4.3), paint);
    body.position.y = 0.58; g.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.7), paint);
    nose.position.set(0, 0.48, 2.3); g.add(nose);
    var cabin;
    if (type.convertible || opts.convertible) {
      cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.9), new THREE.MeshLambertMaterial({ color: 0x7a4a35 }));
      cabin.position.set(0, 0.94, -0.25); g.add(cabin);
      var shield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.08), glassMat);
      shield.position.set(0, 1.05, 0.78); shield.rotation.x = -0.25; g.add(shield);
    } else {
      cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.55, 2.1), opts.police ? new THREE.MeshLambertMaterial({ color: 0x22242c }) : glassMat);
      cabin.position.set(0, 1.12, -0.2); g.add(cabin);
    }
    var wheels = [];
    [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, tyreMat);
      w.position.set(p[0], 0.37, p[1]); g.add(w); wheels.push(w);
    });
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    [-0.6, 0.6].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), hl);
      h.position.set(x, 0.62, 2.66); g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      t.position.set(x, 0.66, -2.16); g.add(t);
    });
    var lightbar = null;
    if (opts.police) {
      var barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.5), chromeMat);
      barBase.position.set(0, 1.48, -0.2); g.add(barBase);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.44), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.33, 1.6, -0.2); g.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.44), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
      blue.position.set(0.33, 1.6, -0.2); g.add(blue);
      lightbar = { red: red, blue: blue };
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.2, 4.32), new THREE.MeshLambertMaterial({ color: 0x22242c }));
      stripe.position.y = 0.6; g.add(stripe);
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    CK.World.scene.add(g);
    var car = {
      group: g, kind: opts.kind || "parked", type: type, paintMat: paint, wheels: wheels,
      lightbar: lightbar, speed: 0, velX: 0, velZ: 0, steer: 0,
      health: 100, maxHealth: 100, driver: null, dead: false,
      topSpeed: type.top, accel: type.accel, smokeAcc: 0,
      target: null, cruise: CK.randRange(9.5, 13), flashPhase: CK.rand() * 6
    };
    cars.push(car);
    return car;
  };

  V.place = function (car, x, z, heading) {
    car.group.position.set(x, CK.groundY(x, z), z);
    car.group.rotation.y = heading || 0;
  };

  // ---------- spawning ----------
  V.spawnWorldCars = function () {
    // the player's starter ride: a teal cabrio waiting by the ferry pier
    var starter = V.createCar({ kind: "parked", type: CAR_TYPES[1], color: 0x37b8a2 });
    V.place(starter, -296, 192, Math.PI / 2);
    CK.G.starterCar = starter;
    // parked cars along curbs all over town
    var spots = [[-108, 26], [14, -108], [108, 134], [-134, -108], [226, 14], [-14, 226],
      [134, -226], [-226, -134], [60, 108], [-60, -14], [180, -108], [-180, 226], [286, 44], [108, -60]];
    spots.forEach(function (s) {
      var c = V.createCar({ kind: "parked" });
      V.place(c, s[0], s[1], CK.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    });
    // traffic: drop cars onto lanes and give them a first target
    for (var i = 0; i < 15; i++) {
      var tc = V.createCar({ kind: "traffic" });
      var horiz = CK.rand() < 0.5;
      var road = CK.pick(CK.WORLD.roads), along = CK.randRange(-300, 300);
      var dir = CK.pick([1, -1]);
      if (horiz) { tc.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; V.place(tc, along, road + (dir > 0 ? -4.2 : 4.2), tc.heading); }
      else { tc.heading = dir > 0 ? 0 : Math.PI; V.place(tc, road + (dir > 0 ? 4.2 : -4.2), along, tc.heading); }
      computeTarget(tc, true);
      // a driver ped sits in each traffic car (visible, and they flee jackings)
      var ped = CK.makePed(tc.group.position.x, tc.group.position.z);
      ped.inCar = tc; tc.driver = ped;
      ped.obj.visible = false;
    }
  };

  // Traffic navigation: each car chases a target point that walks the lane
  // network. Forward for heading a is (sin a, cos a); the right vector is
  // (cos a, -sin a), and lanes sit 4.2m to the right of each road centre
  // line, so opposing traffic passes on separate lanes.
  function nearestRoad(v) {
    var best = CK.WORLD.roads[0], bd = 1e9;
    CK.WORLD.roads.forEach(function (r) { var d = Math.abs(r - v); if (d < bd) { bd = d; best = r; } });
    return best;
  }
  V.nearestRoad = nearestRoad;
  function computeTarget(car, first) {
    var p = car.group.position, h = car.heading;
    var fx = Math.sin(h), fz = Math.cos(h);
    var rx = fz, rz = -fx; // right vector (fz, -fx): for h=0 -> (1,0) +X. Good.
    // distance to the next cross-road line straight ahead
    var cross = null, crossD = 1e9;
    CK.WORLD.roads.forEach(function (rl) {
      var d = fx !== 0 ? (rl - p.x) / fx : (rl - p.z) / fz;
      if (d > 4 && d < crossD) { crossD = d; cross = rl; }
    });
    if (!first && cross !== null && crossD < 46 && CK.rand() < 0.5) {
      // turn at that intersection onto the crossing road's lane
      var nh = h + CK.pick([Math.PI / 2, -Math.PI / 2]);
      var nfx = Math.sin(nh), nfz = Math.cos(nh), nrx = nfz, nrz = -nfx;
      var ix = fx !== 0 ? cross : nearestRoad(p.x + fx * crossD);
      var iz = fz !== 0 ? cross : nearestRoad(p.z + fz * crossD);
      car.target = { x: ix + nfx * 34 + nrx * 4.2, z: iz + nfz * 34 + nrz * 4.2 };
      car.heading = nh;
      return;
    }
    // straight on: a point ahead, snapped onto this car's lane line
    var tx = p.x + fx * 46, tz = p.z + fz * 46;
    if (fz !== 0) tx = nearestRoad(p.x - rx * 4.2) + rx * 4.2;
    else tz = nearestRoad(p.z - rz * 4.2) + rz * 4.2;
    car.target = { x: tx, z: tz };
  }

  // ---------- damage & smoke ----------
  V.damage = function (car, amt) {
    if (car.dead) return;
    if (car === CK.G.inCar) amt *= (1 - CK.G.upgrades.armour * 0.22); // garage armour soaks hits
    car.health -= amt;
    if (car.health <= 0) {
      car.health = 0; car.dead = true; car.speed = 0;
      if (car.driver) { /* driver bails out below in traffic update */ }
      if (car === CK.G.inCar && CK.Player) CK.Player.onCarWrecked();
    }
  };
  function puff(x, y, z, dark) {
    if (!smokeTex) smokeTex = softCircle();
    var m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0.5, depthWrite: false });
    if (dark) m.color.setHex(0x333333);
    var s = new THREE.Sprite(m);
    s.position.set(x, y, z); s.scale.set(1, 1, 1);
    CK.World.scene.add(s);
    puffs.push({ s: s, life: 0, max: CK.randRange(0.7, 1.3) });
  }
  V.puffAt = puff;
  function updatePuffs(dt) {
    for (var i = puffs.length - 1; i >= 0; i--) {
      var p = puffs[i]; p.life += dt;
      p.s.position.y += dt * 2.2;
      var sc = 1 + p.life * 2.4; p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = 0.5 * (1 - p.life / p.max);
      if (p.life >= p.max) { CK.World.scene.remove(p.s); puffs.splice(i, 1); }
    }
  }

  // ---------- shared motion helpers ----------
  function spinWheels(car, dt) {
    var w = car.speed * dt / 0.37;
    for (var i = 0; i < car.wheels.length; i++) car.wheels[i].rotation.x += w;
  }
  function carCollisions(car, dt) {
    var p = car.group.position;
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o === car) continue;
      var op = o.group.position;
      var d = CK.dist2d(p.x, p.z, op.x, op.z);
      if (d < 3.1 && d > 0.001) {
        var push = (3.1 - d) / 2;
        var dx = (p.x - op.x) / d, dz = (p.z - op.z) / d;
        p.x += dx * push; p.z += dz * push;
        op.x -= dx * push; op.z -= dz * push;
        var impact = Math.abs(car.speed - o.speed);
        if (impact > 4) {
          V.damage(car, impact * 0.7); V.damage(o, impact * 0.7);
          CK.Audio.SFX.crash(impact > 10);
          if (car === CK.G.inCar || o === CK.G.inCar) CK.Police && CK.Police.reportCrime("crash", p.x, p.z, 0.25);
        }
        car.speed *= 0.55; o.speed *= 0.55;
      }
    }
    var fixed = CK.World.collideCircle(p.x, p.z, 1.7);
    if (fixed.x !== p.x || fixed.z !== p.z) {
      if (Math.abs(car.speed) > 7) { V.damage(car, Math.abs(car.speed) * 0.35); CK.Audio.SFX.crash(Math.abs(car.speed) > 14); }
      car.speed *= 0.45;
      p.x = fixed.x; p.z = fixed.z;
    }
    p.y = CK.groundY(p.x, p.z);
  }

  // ---------- traffic AI ----------
  function updateTraffic(car, dt) {
    var p = car.group.position;
    if (car.dead) {
      if (car.driver && car.driver.inCar === car) { // driver bails and runs
        var d = car.driver; d.inCar = null; car.driver = null;
        d.obj.visible = true;
        d.obj.position.set(p.x + 2.4, CK.groundY(p.x, p.z), p.z);
        d.flee = 5; d.fleeFrom = { x: p.x, z: p.z };
      }
      car.speed = 0; return;
    }
    if (Math.abs(p.x) > 322 || Math.abs(p.z) > 322) { car.heading += Math.PI; computeTarget(car, true); }
    if (!car.target || CK.dist2d(p.x, p.z, car.target.x, car.target.z) < 9) computeTarget(car, false);
    var dx = car.target.x - p.x, dz = car.target.z - p.z;
    var want = Math.atan2(dx, dz);
    var diff = want - car.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.group.rotation.y += CK.clamp(diff, -2.0 * dt, 2.0 * dt);
    var speedGoal = car.cruise * (Math.abs(diff) > 0.45 ? 0.4 : 1);
    // keep distance to whatever is ahead (traffic, the player, parked cars)
    var fx = Math.sin(car.group.rotation.y), fz = Math.cos(car.group.rotation.y);
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i]; if (o === car) continue;
      var ox = o.group.position.x - p.x, oz = o.group.position.z - p.z;
      var ahead = ox * fx + oz * fz, side = Math.abs(ox * fz - oz * fx);
      if (ahead > 0 && ahead < 10 && side < 2.4) speedGoal = Math.min(speedGoal, ahead < 5 ? 0 : o.speed * 0.9);
    }
    car.speed += CK.clamp(speedGoal - car.speed, -20 * dt, 6 * dt);
    p.x += fx * car.speed * dt; p.z += fz * car.speed * dt;
    carCollisions(car, dt);
    spinWheels(car, dt);
  }

  // ---------- player driving (arcade, with drift) ----------
  V.drivePlayer = function (car, dt) {
    var G = CK.G;
    var engineTier = G.upgrades.engine;
    var topF = car.topSpeed * (1 + engineTier * 0.16);
    var topR = 11;
    var throttle = 0;
    if (CK.key("KeyW") || CK.key("ArrowUp")) throttle = 1;
    if (CK.key("KeyS") || CK.key("ArrowDown")) throttle = -1;
    var steerIn = 0;
    if (CK.key("KeyA") || CK.key("ArrowLeft")) steerIn = 1;
    if (CK.key("KeyD") || CK.key("ArrowRight")) steerIn = -1;
    var hand = CK.key("Space");
    if (throttle > 0) car.speed += car.accel * (1 + engineTier * 0.2) * dt * (1 - Math.max(0, car.speed) / (topF * 1.25));
    else if (throttle < 0) car.speed -= (car.speed > 0.5 ? 26 : car.accel * 0.7) * dt;
    else car.speed -= car.speed * 0.55 * dt; // engine braking / drag
    if (hand) car.speed -= car.speed * 1.1 * dt;
    car.speed = CK.clamp(car.speed, -topR, topF);
    if (Math.abs(car.speed) < 0.04 && throttle === 0) car.speed = 0;
    car.steer = CK.lerp(car.steer, steerIn, 1 - Math.pow(0.0001, dt));
    var yawRate = car.steer * CK.clamp(car.speed / 9, -1.15, 1.15) * (hand ? 1.5 : 1.0);
    car.group.rotation.y += yawRate * dt * 1.55;
    // velocity: mostly along the nose; handbrake lets the tail swing (drift)
    var fx = Math.sin(car.group.rotation.y), fz = Math.cos(car.group.rotation.y);
    var grip = hand ? 2.2 : 9.5;
    car.velX = CK.lerp(car.velX, fx * car.speed, 1 - Math.exp(-grip * dt));
    car.velZ = CK.lerp(car.velZ, fz * car.speed, 1 - Math.exp(-grip * dt));
    var p = car.group.position;
    p.x += car.velX * dt; p.z += car.velZ * dt;
    var spd = Math.sqrt(car.velX * car.velX + car.velZ * car.velZ);
    if (spd > 1) car.speed = CK.lerp(car.speed, spd * Math.sign(car.speed || 1), 0.5);
    carCollisions(car, dt);
    spinWheels(car, dt);
    // body lean for feel
    car.group.rotation.z = CK.lerp(car.group.rotation.z, -car.steer * Math.min(0.06, Math.abs(car.speed) * 0.0022), 0.12);
    CK.Audio.engineUpdate(Math.abs(car.speed) / topF, throttle !== 0);
    if (hand && Math.abs(car.speed) > 12 && CK.rand() < 0.3) puff(p.x - fx * 1.6, 0.5, p.z - fz * 1.6, false);
  };

  // ---------- per-frame ----------
  V.update = function (dt) {
    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      if (car.kind === "traffic") updateTraffic(car, dt);
      if (car.lightbar && (car.kind === "cop")) {
        var ph = Math.sin(CK.G.time * 11 + car.flashPhase) > 0;
        car.lightbar.red.material.color.setHex(ph ? 0xff2222 : 0x551111);
        car.lightbar.blue.material.color.setHex(ph ? 0x112255 : 0x3377ff);
      }
      if (car.health < 55 && !car.dead) {
        car.smokeAcc += dt;
        if (car.smokeAcc > (car.health < 25 ? 0.06 : 0.16)) {
          car.smokeAcc = 0;
          var p = car.group.position;
          puff(p.x + Math.sin(car.group.rotation.y) * 1.8, 1.2, p.z + Math.cos(car.group.rotation.y) * 1.8, car.health < 25);
        }
      } else if (car.dead) {
        car.smokeAcc += dt;
        if (car.smokeAcc > 0.09) { car.smokeAcc = 0; var q = car.group.position; puff(q.x, 1.3, q.z, true); }
      }
    }
    updatePuffs(dt);
  };
})();
