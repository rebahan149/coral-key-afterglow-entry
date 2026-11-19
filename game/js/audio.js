// audio.js — all sound is synthesised with WebAudio: three radio stations
// (step-sequenced loops in different styles), an engine hum tied to speed,
// and one-shot SFX. Nothing starts until the first user gesture, and the
// radio only plays while the player sits in a car.
(function () {
  "use strict";
  var CK = window.CK;
  var A = (CK.Audio = {});
  var ctx = null, master = null, radioGain = null, engineNodes = null;
  var station = 0, stepTimer = null, stepIdx = 0, radioOn = false;

  A.init = function () {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      radioGain = ctx.createGain(); radioGain.gain.value = 0.0; radioGain.connect(master);
    } catch (e) { ctx = null; }
  };
  function now() { return ctx ? ctx.currentTime : 0; }

  // A single synth voice: osc -> gain envelope -> destination bus.
  function voice(freq, t, dur, type, vol, bus, slideTo) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, freq) {
    if (!ctx) return;
    var len = Math.max(1, (dur * ctx.sampleRate) | 0);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq || 1200; f.Q.value = 0.8;
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // ---- radio: three stations, each a 16-step loop ----
  // Notes are semitone offsets from the station root; -1 = rest.
  var STATIONS = [
    { name: "🌴 Coral Breeze FM", root: 196.0, bpm: 92, wave: "sine",
      bass: [0, -1, -1, -1, 7, -1, -1, -1, 5, -1, -1, -1, 3, -1, 7, -1],
      lead: [12, -1, 15, -1, 19, -1, 15, -1, 17, -1, 15, 12, -1, 10, -1, -1] },
    { name: "🌆 Neon Afterglow", root: 110.0, bpm: 118, wave: "sawtooth",
      bass: [0, 0, -1, 0, -1, 0, 10, -1, 0, 0, -1, 0, 12, -1, 10, -1],
      lead: [24, -1, -1, 22, -1, 19, -1, -1, 17, -1, 19, -1, 22, -1, -1, -1] },
    { name: "🥁 Steel Drum Sound", root: 261.6, bpm: 104, wave: "triangle",
      bass: [0, -1, 7, -1, 0, -1, 7, -1, 5, -1, 7, -1, 3, -1, 7, -1],
      lead: [12, 16, 19, 16, 21, 19, 16, 12, 14, 16, 19, 21, 19, 16, 14, -1] }
  ];
  function semi(root, n) { return root * Math.pow(2, n / 12); }
  function scheduleStep() {
    if (!ctx || !radioOn) return;
    var st = STATIONS[station];
    var spb = 60 / st.bpm / 2; // eighth notes
    var t = now() + 0.03;
    var i = stepIdx % 16;
    if (st.bass[i] >= 0) voice(semi(st.root, st.bass[i]) / 2, t, spb * 1.6, "triangle", 0.20, radioGain);
    if (st.lead[i] >= 0) voice(semi(st.root, st.lead[i]), t, spb * 1.4, st.wave, station === 1 ? 0.055 : 0.11, radioGain);
    if (i % 4 === 0) noise(t, 0.05, 0.05, 6000);            // hat tick
    if (i % 8 === 4) noise(t, 0.12, 0.10, 900);             // soft snare
    stepIdx++;
    stepTimer = setTimeout(scheduleStep, spb * 1000);
  }
  A.setRadio = function (on) {
    if (!ctx) return;
    if (on && !radioOn) {
      radioOn = true; stepIdx = 0;
      radioGain.gain.setTargetAtTime(0.85, now(), 0.2);
      scheduleStep();
      if (CK.HUD) CK.HUD.toastRadio(STATIONS[station].name);
    } else if (!on && radioOn) {
      radioOn = false;
      radioGain.gain.setTargetAtTime(0.0, now(), 0.15);
      if (stepTimer) clearTimeout(stepTimer);
    }
  };
  A.cycleStation = function () {
    station = (station + 1) % STATIONS.length;
    if (CK.HUD) CK.HUD.toastRadio(STATIONS[station].name);
    A.SFX.ui();
  };
  A.stationName = function () { return STATIONS[station].name; };

  // ---- engine hum: two detuned oscillators, pitch follows speed ----
  A.engineStart = function () {
    if (!ctx || engineNodes) return;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.type = "sawtooth"; o2.type = "square";
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
    g.gain.value = 0.0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    engineNodes = { o1: o1, o2: o2, g: g };
  };
  A.engineStop = function () {
    if (!engineNodes) return;
    try { engineNodes.o1.stop(); engineNodes.o2.stop(); } catch (e) {}
    engineNodes = null;
  };
  A.engineUpdate = function (speed01, throttle) {
    if (!engineNodes || !ctx) return;
    var base = 55 + speed01 * 165 + (throttle ? 14 : 0);
    var t = now();
    engineNodes.o1.frequency.setTargetAtTime(base, t, 0.06);
    engineNodes.o2.frequency.setTargetAtTime(base * 1.5 + 3, t, 0.06);
    engineNodes.g.gain.setTargetAtTime(0.05 + speed01 * 0.075, t, 0.09);
  };

  // ---- one-shot SFX ----
  A.SFX = {
    shot: function (smg) { if (!ctx) return; var t = now(); noise(t, smg ? 0.07 : 0.12, 0.30, smg ? 2400 : 1500); voice(160, t, 0.08, "square", 0.16, master, 60); },
    dry: function () { if (!ctx) return; voice(1200, now(), 0.04, "square", 0.08); },
    hit: function () { if (!ctx) return; noise(now(), 0.08, 0.2, 500); },
    crash: function (hard) { if (!ctx) return; var t = now(); noise(t, hard ? 0.4 : 0.2, hard ? 0.5 : 0.3, 300); voice(70, t, 0.3, "sine", 0.4, master, 34); },
    pickup: function () { if (!ctx) return; var t = now(); voice(660, t, 0.09, "sine", 0.18); voice(990, t + 0.08, 0.14, "sine", 0.18); },
    success: function () { if (!ctx) return; var t = now(); [523, 659, 784, 1047].forEach(function (f, i) { voice(f, t + i * 0.09, 0.22, "triangle", 0.2); }); },
    fail: function () { if (!ctx) return; var t = now(); voice(220, t, 0.2, "sawtooth", 0.14, master, 196); voice(196, t + 0.18, 0.3, "sawtooth", 0.14, master, 147); },
    siren: function () { if (!ctx) return; var t = now(); voice(720, t, 0.55, "triangle", 0.07, master, 990); voice(990, t + 0.55, 0.55, "triangle", 0.07, master, 720); },
    door: function () { if (!ctx) return; noise(now(), 0.09, 0.16, 700); },
    ui: function () { if (!ctx) return; voice(880, now(), 0.05, "sine", 0.1); },
    cash: function () { if (!ctx) return; var t = now(); voice(1318, t, 0.07, "square", 0.09); voice(1760, t + 0.06, 0.12, "square", 0.09); }
  };
})();
