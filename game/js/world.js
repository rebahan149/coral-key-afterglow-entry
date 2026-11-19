// world.js — Coral Key itself: golden-hour sky and sea, the painted road
// grid, five districts (Warehouse Docks, Ocean Drive, the Marina, downtown,
// Hill Villas), buildings with lit windows, palms, lamps, props, collision
// boxes, and the ambient pedestrians who stroll (and flee) the sidewalks.
(function () {
  "use strict";
  var CK = window.CK;
  var W = (CK.World = {});
  var colliders = (W.colliders = []);
  var peds = (CK.peds = []);
  var bobbers = [], sparkles = null, waterTex = null, beam = null, sunLight = null;

  function addCollider(x, z, hw, hd) {
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  }
  W.collideCircle = function (x, z, r) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var nx = CK.clamp(x, c.minX, c.maxX), nz = CK.clamp(z, c.minZ, c.maxZ);
      var dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) { var d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        else { // centre inside the box: push out along the smallest exit
          var l = x - c.minX, rt = c.maxX - x, tp = z - c.minZ, bt = c.maxZ - z;
          var m = Math.min(l, rt, tp, bt);
          if (m === l) x = c.minX - r; else if (m === rt) x = c.maxX + r;
          else if (m === tp) z = c.minZ - r; else z = c.maxZ + r;
        }
      }
    }
    return { x: CK.clamp(x, -336, 336), z: CK.clamp(z, -336, 336) };
  };
  W.districtAt = function (x, z) {
    if (z < CK.WORLD.hillZ) return "Hill Villas";
    if (x < -248) return "Warehouse Docks";
    if (z > 248) return "Ocean Drive";
    if (x > 248 && z > 30) return "The Marina";
    if (Math.abs(x) < 130 && Math.abs(z) < 130) return "Downtown Coral Key";
    return "Coral Key";
  };

  // ---------- canvas texture helpers ----------
  function canvasTex(w, h, draw, rx, ry) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  }
  // Building facade: coloured plaster + a grid of windows, some lit amber.
  function facadeTex(base, trim, floors, cols) {
    return canvasTex(128, 256, function (g) {
      g.fillStyle = base; g.fillRect(0, 0, 128, 256);
      g.fillStyle = trim; g.fillRect(0, 0, 128, 10); g.fillRect(0, 246, 128, 10);
      var ww = 128 / cols, hh = 246 / floors;
      for (var y = 0; y < floors; y++) for (var x = 0; x < cols; x++) {
        var lit = CK.rand() < 0.42;
        g.fillStyle = lit ? (CK.rand() < 0.5 ? "#ffd98a" : "#ffb35c") : "#2b3a55";
        g.fillRect(x * ww + 4, 14 + y * hh + 3, ww - 8, hh - 7);
        g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x * ww + 4, 14 + y * hh + 3, ww - 8, 3);
      }
    });
  }
  function neonTex(text, color) {
    return canvasTex(256, 64, function (g) {
      g.fillStyle = "#14102a"; g.fillRect(0, 0, 256, 64);
      g.font = "900 34px 'Trebuchet MS', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = color; g.shadowBlur = 16; g.fillStyle = color;
      g.fillText(text, 128, 34); g.shadowBlur = 6; g.fillStyle = "#ffffff";
      g.globalAlpha = 0.85; g.fillText(text, 128, 34);
    });
  }

  // ---------- the island ground, painted on one big canvas ----------
  function groundTexture() {
    var S = 2048, half = 360; // world [-360,360] -> canvas
    function px(v) { return (v + half) / (half * 2) * S; }
    return canvasTex(S, S, function (g) {
      g.fillStyle = "#c9a06b"; g.fillRect(0, 0, S, S);                    // sand base
      g.fillStyle = "#7fae5f"; g.fillRect(px(-338), px(-338), px(338) - px(-338), px(338) - px(-338)); // grass
      g.fillStyle = "#8a8f96"; g.fillRect(px(-338), px(-190), px(-248) - px(-338), px(90) - px(-190)); // docks concrete
      g.fillStyle = "#b9c0c4"; g.fillRect(px(248), px(30), px(338) - px(248), px(240) - px(30));        // marina apron
      g.fillStyle = "#a8b39a"; g.fillRect(px(-338), px(-338), px(338) - px(-338), px(-252) - px(-338)); // hill green
      g.fillStyle = "#e8cf9e"; g.fillRect(px(-338), px(312), px(338) - px(-338), px(338) - px(312));    // south beach
      var roads = CK.WORLD.roads, rh = CK.WORLD.roadHalf;
      function road(x0, z0, x1, z1) {
        g.fillStyle = "#d8c49a"; g.fillRect(px(x0), px(z0), px(x1) - px(x0), px(z1) - px(z0)); // sidewalk
        g.fillStyle = "#3c414d";
        g.fillRect(px(x0 === x1 ? x0 + 2 : x0), px(z0 === z1 ? z0 + 2 : z0),
          px(x1 === x0 ? x1 - 2 : x1) - px(x0 === x1 ? x0 + 2 : x0),
          px(z1 === z0 ? z1 - 2 : z1) - px(z0 === z1 ? z0 + 2 : z0));
        g.strokeStyle = "#ffc46b"; g.lineWidth = 3; g.setLineDash([16, 14]);
        g.beginPath(); g.moveTo(px((x0 + x1) / 2), px((z0 + z1) / 2 - ((z1 - z0) / 2)));
        g.lineTo(px((x0 + x1) / 2 + (x1 - x0) / 2 * 0 + ((x1 - x0) / 2)), px((z0 + z1) / 2));
        g.stroke(); g.setLineDash([]);
      }
      roads.forEach(function (r) {
        g.fillStyle = "#d8c49a"; g.fillRect(px(r - rh - 2.5), px(-338), px(r + rh + 2.5) - px(r - rh - 2.5), px(338) - px(-338));
        g.fillStyle = "#3c414d"; g.fillRect(px(r - rh), px(-338), px(r + rh) - px(r - rh), px(338) - px(-338));
        g.fillStyle = "#d8c49a"; g.fillRect(px(-338), px(r - rh - 2.5), px(338) - px(-338), px(r + rh + 2.5) - px(r - rh - 2.5));
        g.fillStyle = "#3c414d"; g.fillRect(px(-338), px(r - rh), px(338) - px(-338), px(r + rh) - px(r - rh));
        g.strokeStyle = "#ffc46b"; g.lineWidth = 3; g.setLineDash([16, 14]);
        g.beginPath(); g.moveTo(px(r), px(-338)); g.lineTo(px(r), px(338)); g.stroke();
        g.beginPath(); g.moveTo(px(-338), px(r)); g.lineTo(px(338), px(r)); g.stroke();
        g.setLineDash([]);
      });
      // crosswalks at intersections
      g.fillStyle = "rgba(255,255,255,.75)";
      roads.forEach(function (rx) { roads.forEach(function (rz) {
        for (var i = -3; i <= 3; i++) {
          g.fillRect(px(rx - 8 + i * 2.6), px(rz - rh - 4), 4, 6);
          g.fillRect(px(rx - rh - 4), px(rz - 8 + i * 2.6), 6, 4);
        }
      }); });
      // Ocean Drive promenade
      g.fillStyle = "#e6b8a2"; g.fillRect(px(-338), px(252), px(338) - px(-338), px(284) - px(252));
      g.fillStyle = "#caa27e"; g.fillRect(px(252), px(52), px(338) - px(252), 10); // marina boardwalk strip
    });
  }

  var scene;
  W.build = function (renderer) {
    scene = new THREE.Scene();
    W.scene = scene;
    scene.fog = new THREE.Fog(0xeda06d, 220, 980);

    // renderer mood: warm ACES grade
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // gradient sky dome (indigo zenith -> peach horizon -> coral sun side)
    var skyGeo = new THREE.SphereGeometry(1500, 24, 16);
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: new THREE.Vector3(-0.55, 0.16, 0.42).normalize() } },
      vertexShader: "varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "varying vec3 vW; uniform vec3 sunDir;" +
        "void main(){ float h = clamp(vW.y, -0.05, 1.0);" +
        " vec3 top = vec3(0.13,0.16,0.38); vec3 mid = vec3(0.85,0.45,0.42); vec3 hor = vec3(1.0,0.72,0.42);" +
        " vec3 col = mix(hor, mix(mid, top, smoothstep(0.12,0.65,h)), smoothstep(0.0,0.14,h));" +
        " float s = pow(max(dot(normalize(vW), sunDir), 0.0), 18.0);" +
        " col += vec3(1.0,0.62,0.30) * s * 0.85;" +
        " float disc = smoothstep(0.9993,0.9997, dot(normalize(vW), sunDir));" +
        " col += vec3(1.0,0.85,0.6) * disc * 2.2;" +
        " gl_FragColor = vec4(col, 1.0); }"
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // lights: low warm sun + soft sky fill
    var sunDir = new THREE.Vector3(-0.55, 0.30, 0.42).normalize();
    sunLight = new THREE.DirectionalLight(0xffb36b, 2.6);
    sunLight.position.copy(sunDir).multiplyScalar(420);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -390; sunLight.shadow.camera.right = 390;
    sunLight.shadow.camera.top = 390; sunLight.shadow.camera.bottom = -390;
    sunLight.shadow.camera.far = 1100; sunLight.shadow.bias = -0.0006;
    scene.add(sunLight); scene.add(sunLight.target);
    scene.add(new THREE.HemisphereLight(0xffc9a0, 0x1d4e5e, 0.85));
    var bounce = new THREE.DirectionalLight(0x7de8ff, 0.35);
    bounce.position.set(200, 120, -260); scene.add(bounce);

    // sea: deep teal plane with a drifting sparkle texture
    waterTex = canvasTex(256, 256, function (g) {
      g.fillStyle = "#14586e"; g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 500; i++) {
        g.fillStyle = "rgba(255," + (190 + (Math.random() * 60 | 0)) + ",140," + (Math.random() * 0.5 + 0.1) + ")";
        g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 3 + 1, 1.4);
      }
      for (var j = 0; j < 160; j++) {
        g.fillStyle = "rgba(20,40,80,.25)";
        g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 22 + 6, 2);
      }
    }, 60, 60);
    var sea = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshPhongMaterial({ map: waterTex, color: 0x9fd4de, shininess: 90, specular: 0xffc98a })
    );
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.7;
    scene.add(sea);
    // twinkling sparkle points hugging the island shore
    var sg = new THREE.BufferGeometry(), sp = [];
    for (var s = 0; s < 420; s++) {
      var a = Math.random() * Math.PI * 2, rr = 348 + Math.random() * 130;
      sp.push(Math.cos(a) * rr, -0.2, Math.sin(a) * rr);
    }
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    sparkles = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffd9a0, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(sparkles);

    // island ground (with the villa hill block under the plateau)
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(720, 720),
      new THREE.MeshLambertMaterial({ map: groundTexture() })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    var hill = new THREE.Mesh(
      new THREE.BoxGeometry(680, CK.WORLD.hillH, 160),
      new THREE.MeshLambertMaterial({ color: 0x86a860 })
    );
    hill.position.set(0, CK.WORLD.hillH / 2 - 0.05, -268 - 54);
    hill.receiveShadow = true;
    scene.add(hill);

    buildDistricts(scene);
    buildPalmsAndLamps(scene);
    buildPeds(scene);
    return scene;
  };

  // ---------- buildings & districts ----------
  var roofMat = new THREE.MeshLambertMaterial({ color: 0x4a3b47 });
  var darkMat = new THREE.MeshLambertMaterial({ color: 0x2c2733 });
  var facadeMats = [];
  function makeFacades() {
    var palettes = [
      ["#e8e3d8", "#b8ab90"], ["#f2c9a4", "#c98f5f"], ["#a8d8d0", "#5f9e94"],
      ["#f4b8c1", "#c97f8e"], ["#cfe0f2", "#7d9bbd"], ["#f7e8b0", "#c9a959"],
      ["#d9c2e8", "#9678b5"], ["#ffe9d6", "#d9a06b"]
    ];
    palettes.forEach(function (p, i) {
      var tex = facadeTex(p[0], p[1], 6 + (i % 4), 4 + (i % 3));
      facadeMats.push(new THREE.MeshLambertMaterial({ map: tex }));
    });
  }
  function building(x, z, w, d, h, matIdx) {
    var m = facadeMats[matIdx % facadeMats.length];
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m, m, roofMat, darkMat, m, m]);
    var y = CK.groundY(x, z);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    addCollider(x, z, w / 2, d / 2);
    return mesh;
  }
  function box(x, y, z, w, h, d, color, noCollide) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (!noCollide) addCollider(x, z, w / 2, d / 2);
    return mesh;
  }

  function buildDistricts(sc) {
    makeFacades();
    var roads = CK.WORLD.roads;
    // --- general blocks: fill the cells between roads by district flavour ---
    var edges = [-338].concat(roads).concat([338]);
    for (var ci = 0; ci < edges.length - 1; ci++) {
      for (var cj = 0; cj < edges.length - 1; cj++) {
        var x0 = edges[ci] + 14, x1 = edges[ci + 1] - 14;
        var z0 = edges[cj] + 14, z1 = edges[cj + 1] - 14;
        var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (cx < -248 || cz > 248 || cz < -248) continue;              // special districts
        if (cx > 248 && cz > 30 && cz < 248) continue;                 // marina grounds
        var downtown = Math.abs(cx) < 130 && Math.abs(cz) < 130;
        var n = downtown ? 4 : 3;
        for (var k = 0; k < n; k++) {
          var bx = CK.randRange(x0 + 16, x1 - 16), bz = CK.randRange(z0 + 16, z1 - 16);
          var bw = CK.randRange(16, 30), bd = CK.randRange(16, 30);
          var bh = downtown ? CK.randRange(22, 52) : CK.randRange(9, 24);
          // keep the spawn plaza (south downtown corner) clear
          if (Math.abs(bx - (-60)) < 26 && Math.abs(bz - 180) < 26) continue;
          building(bx, bz, bw, bd, bh, CK.randInt(0, facadeMats.length - 1));
        }
      }
    }

    // --- Warehouse Docks (west quay): warehouses, cranes, container stacks ---
    var whCols = [0x9aa3ad, 0xb08968, 0x7d8fa0, 0xa89a80];
    [[-292, -140], [-292, -60], [-292, 20], [-292, -180]].forEach(function (p, i) {
      building(p[0], p[1], 52, 44, 13 + (i % 3) * 2, 0);
      var roof = box(p[0], 14.5 + (i % 3), p[1], 54, 1.2, 46, whCols[i], true);
      roof.material = new THREE.MeshLambertMaterial({ color: whCols[i] });
    });
    var contCols = [0xd95f43, 0x3f7fbf, 0x43a06b, 0xe0a83c, 0x8a5fb0, 0xbf4f79];
    for (var ci2 = 0; ci2 < 26; ci2++) {
      var cxx = CK.randRange(-330, -262), czz = CK.randRange(-210, 60);
      if (Math.abs(czz - (-100)) < 16 || Math.abs(czz - 0) < 16) continue; // keep dock roads clear
      box(cxx, 1.5 + (ci2 % 2) * 3, czz, 11, 3, 4.6, CK.pick(contCols));
    }
    [[-306, -110], [-306, 40]].forEach(function (p) { // dock cranes
      box(p[0], 13, p[1], 3, 26, 3, 0xe0a83c);
      box(p[0] + 11, 25, p[1], 26, 2.4, 2.4, 0xe0a83c, true);
      box(p[0] + 20, 17, p[1], 0.5, 15, 0.5, 0x554433, true);
      box(p[0] + 20, 8.6, p[1], 4.4, 2.6, 2.4, 0xd95f43, true);
    });
    // ferry pier + boat at the south-west water (finale escape point)
    box(-322, 0.4, 178, 34, 1.6, 16, 0x8a6f4d);
    var ferry = new THREE.Group();
    var fh = new THREE.Mesh(new THREE.BoxGeometry(26, 4, 9), new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
    fh.position.y = 1.2; ferry.add(fh);
    var fc = new THREE.Mesh(new THREE.BoxGeometry(16, 3.4, 7), new THREE.MeshLambertMaterial({ color: 0x3f7fbf }));
    fc.position.y = 4.8; ferry.add(fc);
    ferry.position.set(-356, 0, 178); ferry.traverse(function (o) { o.castShadow = true; });
    sc.add(ferry); bobbers.push({ obj: ferry, baseY: 0, amp: 0.35, sp: 0.7 });

    // --- Ocean Drive (south strip): pastel deco hotels + neon signs ---
    var decoCols = [0xf7d9c4, 0xbfe3dd, 0xf6c6d8, 0xfdeec2, 0xd6c9ec, 0xc2e2f2, 0xf9dfb8, 0xe5f0d0];
    var neonNames = ["PALMS", "HOTEL SOL", "CAFÉ RÍO", "DECO", "BAR LUNA", "CLUB 77", "MAR", "AZUL"];
    var neonCols = ["#ff5f9e", "#39e6ff", "#ffb35c", "#8dffb0", "#ff5f5f", "#c9a7ff", "#39e6ff", "#ffd23e"];
    for (var di = 0; di < 8; di++) {
      var dx = -262 + di * 74, dz = 302;
      var dm = new THREE.MeshLambertMaterial({ map: facadeTex("#" + decoCols[di].toString(16), "#ffffff", 5, 5) });
      var db = new THREE.Mesh(new THREE.BoxGeometry(46, CK.randRange(17, 26), 20), [dm, dm, roofMat, darkMat, dm, dm]);
      db.position.set(dx, db.geometry.parameters.height / 2, dz);
      db.castShadow = true; db.receiveShadow = true; sc.add(db);
      addCollider(dx, dz, 23, 10);
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5),
        new THREE.MeshBasicMaterial({ map: neonTex(neonNames[di], neonCols[di]) }));
      sign.position.set(dx, db.geometry.parameters.height - 4, dz - 10.4);
      sign.rotation.y = Math.PI; sc.add(sign);
      box(dx, 1.1, dz - 13.5, 40, 2.2, 4, 0xffffff, true); // deco awning step
    }

    // --- The Marina (east): clubhouse, boardwalk piers, yachts, lighthouse ---
    building(292, 66, 30, 22, 10, 2);
    building(292, 210, 26, 20, 8, 5);
    for (var pi = 0; pi < 4; pi++) box(330, 0.35, 92 + pi * 38, 26, 1.4, 5, 0x9a7a52, true);
    var yachtCols = [0xffffff, 0xf2e8d5, 0xd8ecf5, 0xffe3ec];
    for (var yi = 0; yi < 8; yi++) {
      var yx = 352 + (yi % 2) * 16, yz = 84 + yi * 20;
      var yacht = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.8, 12), new THREE.MeshLambertMaterial({ color: CK.pick(yachtCols) }));
      hull.position.y = 0.6; yacht.add(hull);
      var cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      cab.position.set(0, 2.1, -0.6); yacht.add(cab);
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 10), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
      mast.position.set(0, 6, 1.6); yacht.add(mast);
      var sail = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 7.4),
        new THREE.MeshBasicMaterial({ color: 0xfff6e0, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      sail.position.set(0.4, 5.4, -1.2); sail.rotation.y = 0.5; yacht.add(sail);
      yacht.position.set(yx, -0.3, yz);
      yacht.rotation.y = CK.randRange(-0.2, 0.2);
      yacht.traverse(function (o) { o.castShadow = true; });
      sc.add(yacht); bobbers.push({ obj: yacht, baseY: -0.3, amp: 0.22, sp: CK.randRange(0.6, 1.1) });
    }
    // lighthouse on the south-east point
    var lh = new THREE.Group();
    for (var li = 0; li < 4; li++) {
      var band = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - li * 0.3, 2.9 - li * 0.3, 4.4),
        new THREE.MeshLambertMaterial({ color: li % 2 ? 0xf2ede2 : 0xd94f43 }));
      band.position.y = 2.2 + li * 4.4; lh.add(band);
    }
    var lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    lampRoom.position.y = 19.4; lh.add(lampRoom);
    beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2; beam.position.set(15, 19.4, 0); lh.add(beam);
    lh.position.set(330, 0, 318);
    lh.traverse(function (o) { o.castShadow = true; });
    sc.add(lh); addCollider(330, 318, 3.4, 3.4);

    // --- Hill Villas (north plateau): quiet money above the bay ---
    var villaCols = [0xf7ead8, 0xffffff, 0xf2ddc0, 0xe8f0e2, 0xfbe8ee];
    for (var vi = 0; vi < 7; vi++) {
      var vx = -288 + vi * 92, vz = -306 + (vi % 2) * 18;
      var vy = CK.groundY(vx, vz);
      var vm = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 16),
        new THREE.MeshLambertMaterial({ map: facadeTex("#" + CK.pick(villaCols).toString(16), "#c9b18a", 2, 6) }));
      vm.position.set(vx, vy + 4, vz); vm.castShadow = true; vm.receiveShadow = true; sc.add(vm);
      addCollider(vx, vz, 12, 8);
      box(vx + 8, vy + 0.5, vz + 13, 9, 1, 6, 0x6fd3e0, true); // pool glint
      box(vx - 16, vy + 1, vz + 4, 1.2, 2, 10, 0xd9c9a8, true); // gate posts wall
    }
  }

  // ---------- palms & lamps ----------
  function buildPalmsAndLamps(sc) {
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    var crownMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
    var trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6.4, 6);
    trunkGeo.translate(0, 3.2, 0);
    var crownGeo = new THREE.ConeGeometry(3.1, 1.7, 7);
    crownGeo.translate(0, 6.9, 0); crownGeo.scale(1, 1, 1);
    function palm(x, z, lean) {
      var g = new THREE.Group();
      var t = new THREE.Mesh(trunkGeo, trunkMat); t.rotation.z = lean; g.add(t);
      var c = new THREE.Mesh(crownGeo, crownMat);
      c.position.set(Math.sin(lean) * -5.4, Math.cos(lean) * 0.4, 0); c.rotation.x = Math.PI; g.add(c);
      g.position.set(x, CK.groundY(x, z), z);
      g.rotation.y = CK.rand() * Math.PI * 2;
      sc.add(g);
    }
    var roads = CK.WORLD.roads;
    roads.forEach(function (r) {
      for (var s = -320; s <= 320; s += 42) {
        if (CK.rand() < 0.75) palm(r + 13.5, s + CK.randRange(-4, 4), CK.randRange(-0.09, 0.09));
        if (CK.rand() < 0.75) palm(s + CK.randRange(-4, 4), r - 13.5, CK.randRange(-0.09, 0.09));
      }
    });
    for (var b = -320; b <= 320; b += 34) palm(b + CK.randRange(-6, 6), 330, CK.randRange(-0.14, 0.14)); // beach row
    for (var m2 = 0; m2 < 10; m2++) palm(258, 60 + m2 * 19, 0.1);                                        // marina row

    var poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3542 });
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    var poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.6, 5); poleGeo.translate(0, 2.8, 0);
    var bulbGeo = new THREE.SphereGeometry(0.42, 8, 6); bulbGeo.translate(0, 5.7, 0);
    roads.forEach(function (r) {
      for (var s2 = -300; s2 <= 300; s2 += 60) {
        [[r + 11.5, s2], [s2, r + 11.5]].forEach(function (p) {
          var g = new THREE.Group();
          g.add(new THREE.Mesh(poleGeo, poleMat)); g.add(new THREE.Mesh(bulbGeo, bulbMat));
          g.position.set(p[0], CK.groundY(p[0], p[1]), p[1]); sc.add(g);
        });
      }
    });
  }

  // ---------- pedestrians ----------
  var shirtCols = [0xff8f5a, 0x7de8ff, 0xf6c6d8, 0x8dffb0, 0xffd23e, 0xc9a7ff, 0xffffff, 0xff5f5f];
  function makePed(x, z) {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: CK.pick([0xf2c49b, 0xc98d64, 0x8a5a3b, 0xffe0bd]) });
    var shirt = new THREE.MeshLambertMaterial({ color: CK.pick(shirtCols) });
    var legsM = new THREE.MeshLambertMaterial({ color: CK.pick([0x33415e, 0x5e4633, 0xe8e3d8, 0x27313d]) });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirt); torso.position.y = 1.06; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 7), skin); head.position.y = 1.68; g.add(head);
    var lL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.24), legsM); lL.position.set(-0.16, 0.34, 0); g.add(lL);
    var lR = lL.clone(); lR.position.x = 0.16; g.add(lR);
    g.traverse(function (o) { o.castShadow = true; });
    g.position.set(x, CK.groundY(x, z), z);
    scene.add(g);
    // walk a block perimeter: block centres sit at ±60, ±180, ±300 (between
    // the road lines), and the ring runs 13.5m inside the surrounding roads,
    // on the sidewalk, clear of the buildings set back inside each block.
    var bcx = 60 + 120 * Math.round((x - 60) / 120);
    var bcz = 60 + 120 * Math.round((z - 60) / 120);
    var off = 46.5, corners = [
      [bcx - off, bcz - off], [bcx + off, bcz - off],
      [bcx + off, bcz + off], [bcx - off, bcz + off]
    ];
    var ped = { obj: g, legL: lL, legR: lR, corners: corners, ci: 0, speed: CK.randRange(1.1, 1.9),
      phase: CK.rand() * 6, flee: 0, fleeFrom: null, down: false, hp: 30, isCop: false };
    peds.push(ped);
    return ped;
  }
  function buildPeds(sc) {
    var spots = [[-60, 60], [60, -60], [130, 130], [-130, -130], [10, 250], [-190, 130],
      [250, -60], [-60, -190], [190, 60], [60, 190], [-250, -190], [130, -250], [-190, -60], [300, 130]];
    spots.forEach(function (s) {
      makePed(s[0] + CK.randRange(-8, 8), s[1] + CK.randRange(-8, 8));
      makePed(s[0] + CK.randRange(-30, 30), s[1] + CK.randRange(-30, 30));
    });
  }
  CK.makePed = makePed;
  CK.fleePeds = function (x, z, radius) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (!p.down && CK.dist2d(p.obj.position.x, p.obj.position.z, x, z) < radius) {
        p.flee = 3.2; p.fleeFrom = { x: x, z: z };
      }
    }
  };
  function updatePeds(dt, t) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.down) continue;
      var pos = p.obj.position;
      var tx, tz, sp = p.speed;
      if (p.flee > 0 && p.fleeFrom) {
        p.flee -= dt; sp = 4.6;
        var dx = pos.x - p.fleeFrom.x, dz = pos.z - p.fleeFrom.z;
        var dl = Math.sqrt(dx * dx + dz * dz) || 1;
        tx = pos.x + (dx / dl) * 10; tz = pos.z + (dz / dl) * 10;
      } else {
        var c = p.corners[p.ci];
        tx = c[0]; tz = c[1];
        if (CK.dist2d(pos.x, pos.z, tx, tz) < 1.2) p.ci = (p.ci + 1) % p.corners.length;
      }
      var mx = tx - pos.x, mz = tz - pos.z, ml = Math.sqrt(mx * mx + mz * mz);
      if (ml > 0.05) {
        pos.x += (mx / ml) * sp * dt; pos.z += (mz / ml) * sp * dt;
        p.obj.rotation.y = CK.angleLerp(p.obj.rotation.y, Math.atan2(mx, mz), 0.18);
      }
      var fixed = W.collideCircle(pos.x, pos.z, 0.5);
      pos.x = fixed.x; pos.z = fixed.z;
      pos.y = CK.groundY(pos.x, pos.z);
      p.phase += dt * sp * 3.4;
      var swing = Math.sin(p.phase) * 0.5;
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    }
  }

  // ---------- per-frame world life ----------
  W.update = function (dt) {
    var t = CK.G.time;
    if (waterTex) { waterTex.offset.x = t * 0.008; waterTex.offset.y = Math.sin(t * 0.11) * 0.02 + t * 0.003; }
    if (sparkles) sparkles.material.opacity = 0.55 + Math.sin(t * 2.3) * 0.3;
    if (beam) beam.parent.rotation.y = t * 0.45;
    for (var i = 0; i < bobbers.length; i++) {
      var b = bobbers[i];
      b.obj.position.y = b.baseY + Math.sin(t * b.sp + i) * b.amp;
      b.obj.rotation.z = Math.sin(t * b.sp * 0.8 + i * 2) * 0.02;
    }
    updatePeds(dt, t);
  };
})();
